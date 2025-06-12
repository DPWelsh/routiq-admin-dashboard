import { NextRequest } from 'next/server'
import { requirePermissions } from '@/lib/rbac/rbac-middleware'
import { Permission } from '@/lib/rbac/permissions'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
    })
  : null

/**
 * GET /api/organization/billing/invoices
 * Returns invoice history for the organization
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export const GET = requirePermissions([Permission.ORGANIZATION_BILLING])(
  async (context, request: NextRequest) => {
    if (!stripe) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Stripe not configured',
          code: 'STRIPE_NOT_CONFIGURED'
        }),
        { 
          status: 500,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    try {
      const url = new URL(request.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
      const startingAfter = url.searchParams.get('starting_after') || undefined
      const status = url.searchParams.get('status') as Stripe.InvoiceListParams.Status || undefined

      // Audit log for invoice access
      console.log(`[AUDIT] Organization invoice history accessed`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        userRole: context.userRole,
        filters: { limit, startingAfter, status }
      })

      // Get organization from database
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: {
          id: true,
          name: true,
          stripeCustomerId: true
        }
      })

      if (!organization) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Organization not found',
            code: 'ORGANIZATION_NOT_FOUND'
          }),
          { 
            status: 404,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (!organization.stripeCustomerId) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              invoices: [],
              hasMore: false,
              totalCount: 0
            }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      // Fetch invoices from Stripe
      const invoicesResponse = await stripe.invoices.list({
        customer: organization.stripeCustomerId,
        limit,
        starting_after: startingAfter,
        status,
        expand: ['data.payment_intent', 'data.subscription']
      })

      // Transform invoice data for frontend consumption
      const invoices = invoicesResponse.data.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount: invoice.amount_paid,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        createdAt: invoice.created,
        dueDate: invoice.due_date,
        paidAt: invoice.status_transitions?.paid_at,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
        subtotal: invoice.subtotal,
        total: invoice.total,
        description: invoice.description,
        invoicePdf: invoice.invoice_pdf,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        lines: invoice.lines.data.map(line => ({
          id: line.id,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          quantity: line.quantity,
          period: {
            start: line.period?.start,
            end: line.period?.end
          }
        }))
      }))

      // Get total invoice count for pagination
      const totalInvoices = await stripe.invoices.list({
        customer: organization.stripeCustomerId,
        limit: 1
      })

      const result = {
        invoices,
        hasMore: invoicesResponse.has_more,
        totalCount: totalInvoices.data.length,
        pagination: {
          limit,
          startingAfter,
          lastInvoiceId: invoices.length > 0 ? invoices[invoices.length - 1].id : null
        },
        metadata: {
          accessedAt: new Date().toISOString(),
          accessedBy: context.clerkUserId,
          organizationId: context.organizationId
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: result
        }),
        {
          status: 200,
          headers: { 
            'content-type': 'application/json',
            'x-content-type-options': 'nosniff',
            'cache-control': 'private, no-cache, no-store, must-revalidate'
          }
        }
      )

    } catch (error) {
      console.error(`[ERROR] Organization invoice fetch failed`, {
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch invoice history',
          code: 'INVOICE_FETCH_ERROR',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' }
        }
      )
    } finally {
      await prisma.$disconnect()
    }
  }
) 