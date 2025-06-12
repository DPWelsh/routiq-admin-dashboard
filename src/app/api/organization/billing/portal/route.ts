import { NextRequest } from 'next/server'
import { withOrganizationContext } from '@/lib/auth/request-context'
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
 * POST /api/organization/billing/portal
 * Creates a Stripe customer portal session for organization billing management
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export const POST = requirePermissions([Permission.ORGANIZATION_BILLING])(
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
      const { returnUrl } = await request.json().catch(() => ({}))
      
      // Default return URL if not provided
      const defaultReturnUrl = `${request.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/billing`

      // Audit log for portal access
      console.log(`[AUDIT] Customer portal session requested`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        userRole: context.userRole,
        returnUrl: returnUrl || defaultReturnUrl,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })

      // Get organization from database
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: {
          id: true,
          name: true,
          stripeCustomerId: true,
          subscriptionStatus: true,
          billingEmail: true
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

      // Check if organization has a Stripe customer
      if (!organization.stripeCustomerId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No billing account found for this organization',
            code: 'NO_STRIPE_CUSTOMER',
            message: 'Please set up billing first by subscribing to a plan.'
          }),
          { 
            status: 400,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      // Verify the Stripe customer exists
      let customer
      try {
        customer = await stripe.customers.retrieve(organization.stripeCustomerId)
        if (customer.deleted) {
          throw new Error('Customer was deleted')
        }
      } catch (stripeError) {
        console.error('Error retrieving Stripe customer:', stripeError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Billing account not found',
            code: 'STRIPE_CUSTOMER_NOT_FOUND'
          }),
          { 
            status: 400,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      // Create customer portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: organization.stripeCustomerId,
        return_url: returnUrl || defaultReturnUrl,
      })

      // Audit log successful portal creation
      console.log(`[AUDIT] Customer portal session created`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        stripeCustomerId: organization.stripeCustomerId,
        portalSessionId: portalSession.id,
        returnUrl: portalSession.return_url
      })

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: portalSession.url,
            sessionId: portalSession.id,
            returnUrl: portalSession.return_url
          },
          metadata: {
            createdAt: new Date().toISOString(),
            createdBy: context.clerkUserId,
            organizationId: context.organizationId
          }
        }),
        {
          status: 200,
          headers: { 
            'content-type': 'application/json',
            'x-content-type-options': 'nosniff'
          }
        }
      )

    } catch (error) {
      console.error(`[ERROR] Customer portal session creation failed`, {
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create customer portal session',
          code: 'PORTAL_CREATION_ERROR',
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