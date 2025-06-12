import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationContext } from '@/lib/auth/request-context'
import { requirePermissions } from '@/lib/rbac/rbac-middleware'
import { Permission } from '@/lib/rbac/permissions'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()

// Only initialize Stripe if we have the secret key
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
    })
  : null

/**
 * POST /api/stripe/checkout
 * Creates a Stripe checkout session for organization billing
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export const POST = requirePermissions([Permission.ORGANIZATION_BILLING])(
  async (context, req: NextRequest) => {
    // Check if we're in a build environment
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    try {
      const { priceId } = await req.json()
      
      if (!priceId) {
        return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
      }

      // Audit log for checkout session creation
      console.log(`[AUDIT] Checkout session requested`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        userRole: context.userRole,
        priceId,
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      })

      // Get organization from database
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: {
          id: true,
          name: true,
          stripeCustomerId: true,
          billingEmail: true,
          status: true
        }
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      // Check if organization is active
      if (organization.status !== 'active') {
        return NextResponse.json({ 
          error: 'Organization is not active', 
          code: 'ORGANIZATION_INACTIVE' 
        }, { status: 403 })
      }

      let customerId = organization.stripeCustomerId

      // Create or retrieve Stripe customer for organization
      if (!customerId) {
        // Create a new Stripe customer for the organization
        const customer = await stripe.customers.create({
          email: organization.billingEmail || `billing+${organization.id}@example.com`,
          name: organization.name,
          description: `Organization: ${organization.name}`,
          metadata: {
            organizationId: organization.id,
            organizationName: organization.name,
            createdBy: context.clerkUserId,
            createdAt: new Date().toISOString()
          },
        })
        
        customerId = customer.id

        // Update organization with the new Stripe customer ID
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            stripeCustomerId: customerId,
            billingEmail: organization.billingEmail || `billing+${organization.id}@example.com`
          }
        })

        console.log(`[AUDIT] Stripe customer created for organization`, {
          timestamp: new Date().toISOString(),
          organizationId: organization.id,
          stripeCustomerId: customerId,
          createdBy: context.clerkUserId
        })
      } else {
        // Verify existing customer and update metadata if needed
        try {
          const existingCustomer = await stripe.customers.retrieve(customerId)
          if (existingCustomer.deleted) {
            throw new Error('Customer was deleted')
          }
          
          // Update customer metadata to ensure it's current
          await stripe.customers.update(customerId, {
            name: organization.name,
            metadata: {
              organizationId: organization.id,
              organizationName: organization.name,
              lastUpdatedBy: context.clerkUserId,
              lastUpdatedAt: new Date().toISOString()
            }
          })
        } catch (stripeError) {
          console.error('Error with existing Stripe customer:', stripeError)
          return NextResponse.json({
            error: 'Issue with existing billing account. Please contact support.',
            code: 'STRIPE_CUSTOMER_ERROR'
          }, { status: 400 })
        }
      }

      // Create checkout session for organization
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.get('origin')}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get('origin')}/dashboard/billing?canceled=true`,
        metadata: {
          organizationId: organization.id,
          organizationName: organization.name,
          initiatedBy: context.clerkUserId,
          userRole: context.userRole,
          priceId: priceId
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
        },
        tax_id_collection: {
          enabled: true,
        },
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Subscription for ${organization.name}`,
            metadata: {
              organizationId: organization.id,
              organizationName: organization.name
            }
          }
        }
      })

      // Audit log successful session creation
      console.log(`[AUDIT] Checkout session created`, {
        timestamp: new Date().toISOString(),
        organizationId: organization.id,
        stripeCustomerId: customerId,
        sessionId: session.id,
        priceId,
        initiatedBy: context.clerkUserId,
        sessionUrl: session.url
      })

      return NextResponse.json({ 
        url: session.url,
        sessionId: session.id,
        metadata: {
          organizationId: organization.id,
          customerId: customerId,
          createdAt: new Date().toISOString()
        }
      })

    } catch (error) {
      console.error(`[ERROR] Checkout session creation failed`, {
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      return NextResponse.json(
        { 
          error: 'Failed to create checkout session',
          code: 'CHECKOUT_CREATION_ERROR',
          timestamp: new Date().toISOString()
        }, 
        { status: 500 }
      )
    } finally {
      await prisma.$disconnect()
    }
  }
) 