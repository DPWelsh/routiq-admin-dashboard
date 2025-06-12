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
 * GET /api/organization/billing
 * Returns billing information for the organization
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
      // Audit log for billing access
      console.log(`[AUDIT] Organization billing accessed`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        userRole: context.userRole,
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
          subscriptionPlan: true,
          billingEmail: true,
          billingAddress: true,
          trialEndsAt: true,
          createdAt: true
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

      let stripeData = null
      let subscriptionData = null

      // If organization has a Stripe customer ID, fetch Stripe data
      if (organization.stripeCustomerId) {
        try {
          // Get Stripe customer
          const customer = await stripe.customers.retrieve(organization.stripeCustomerId)
          
          if (!customer.deleted) {
            stripeData = {
              id: customer.id,
              email: customer.email,
              created: customer.created,
              defaultSource: customer.default_source,
              invoiceSettings: customer.invoice_settings
            }

            // Get active subscriptions
            const subscriptions = await stripe.subscriptions.list({
              customer: organization.stripeCustomerId,
              status: 'all',
              limit: 10
            })

            if (subscriptions.data.length > 0) {
              const activeSubscription = subscriptions.data.find(sub => 
                ['active', 'trialing', 'past_due'].includes(sub.status)
              ) || subscriptions.data[0]

              subscriptionData = {
                id: activeSubscription.id,
                status: activeSubscription.status,
                currentPeriodStart: activeSubscription.items.data[0]?.current_period_start || null,
                currentPeriodEnd: activeSubscription.items.data[0]?.current_period_end || null,
                cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
                canceledAt: activeSubscription.canceled_at,
                trialStart: activeSubscription.trial_start,
                trialEnd: activeSubscription.trial_end,
                items: activeSubscription.items.data.map(item => ({
                  id: item.id,
                  priceId: item.price.id,
                  quantity: item.quantity,
                  amount: item.price.unit_amount,
                  currency: item.price.currency,
                  interval: item.price.recurring?.interval,
                  productName: item.price.product
                }))
              }
            }
          }
        } catch (stripeError) {
          console.error('Error fetching Stripe data:', stripeError)
          // Continue without Stripe data rather than failing entirely
        }
      }

      // Calculate trial information
      const isInTrial = organization.subscriptionStatus === 'trial' && organization.trialEndsAt
      const trialDaysRemaining = isInTrial 
        ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null

      const billingInfo = {
        organization: {
          id: organization.id,
          name: organization.name,
          subscriptionStatus: organization.subscriptionStatus,
          subscriptionPlan: organization.subscriptionPlan,
          billingEmail: organization.billingEmail,
          billingAddress: organization.billingAddress,
          hasStripeCustomer: !!organization.stripeCustomerId
        },
        trial: {
          isInTrial,
          trialEndsAt: organization.trialEndsAt,
          daysRemaining: trialDaysRemaining
        },
        stripe: {
          customer: stripeData,
          subscription: subscriptionData
        },
        metadata: {
          accessedAt: new Date().toISOString(),
          accessedBy: context.clerkUserId,
          securityLevel: 'ORGANIZATION_BILLING'
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: billingInfo
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
      console.error(`[ERROR] Organization billing fetch failed`, {
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch billing information',
          code: 'BILLING_FETCH_ERROR',
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