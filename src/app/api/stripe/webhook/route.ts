import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Only initialize Stripe if we have the secret key
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
    })
  : null

export async function POST(req: NextRequest) {
  // Check if we're in a build environment
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('No Stripe signature found')
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  console.log('Received Stripe webhook:', event.type)

  try {
    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        
        // Get customer to find the organization ID from metadata
        const customer = await stripe.customers.retrieve(customerId)
        
        if (customer.deleted) {
          console.error('Customer was deleted')
          break
        }

        const organizationId = customer.metadata?.organizationId
        
        if (!organizationId) {
          console.error('No organizationId found in customer metadata')
          break
        }

        // Update organization subscription status in database
        const updatedOrganization = await prisma.organization.update({
          where: { id: organizationId },
          data: {
            stripeCustomerId: customerId,
            subscriptionStatus: subscription.status,
            subscriptionPlan: subscription.items.data[0]?.price.nickname || 'unknown',
            billingEmail: customer.email || undefined,
            updatedAt: new Date()
          }
        })
        
        console.log(`[AUDIT] Organization subscription updated`, {
          timestamp: new Date().toISOString(),
          organizationId,
          organizationName: updatedOrganization.name,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          customerId,
          eventType: event.type
        })
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        const deletedCustomerId = deletedSubscription.customer as string
        
        const deletedCustomer = await stripe.customers.retrieve(deletedCustomerId)
        
        if (deletedCustomer.deleted) {
          console.error('Customer was deleted')
          break
        }

        const deletedOrganizationId = deletedCustomer.metadata?.organizationId
        
        if (!deletedOrganizationId) {
          console.error('No organizationId found in customer metadata')
          break
        }

        // Update organization to reflect canceled subscription
        const canceledOrganization = await prisma.organization.update({
          where: { id: deletedOrganizationId },
          data: {
            subscriptionStatus: 'canceled',
            subscriptionPlan: undefined,
            updatedAt: new Date()
          }
        })
        
        console.log(`[AUDIT] Organization subscription canceled`, {
          timestamp: new Date().toISOString(),
          organizationId: deletedOrganizationId,
          organizationName: canceledOrganization.name,
          subscriptionId: deletedSubscription.id,
          customerId: deletedCustomerId,
          eventType: event.type
        })
        break

      case 'invoice.payment_succeeded':
        const successfulInvoice = event.data.object as Stripe.Invoice
        const invoiceCustomerId = successfulInvoice.customer as string
        
        if (invoiceCustomerId) {
          const invoiceCustomer = await stripe.customers.retrieve(invoiceCustomerId)
          
          if (!invoiceCustomer.deleted) {
            const invoiceOrganizationId = invoiceCustomer.metadata?.organizationId
            
            if (invoiceOrganizationId) {
              // Update organization's billing status (no lastPaymentAt field in schema)
              await prisma.organization.update({
                where: { id: invoiceOrganizationId },
                data: {
                  updatedAt: new Date()
                }
              })
              
              console.log(`[AUDIT] Organization payment succeeded`, {
                timestamp: new Date().toISOString(),
                organizationId: invoiceOrganizationId,
                invoiceId: successfulInvoice.id,
                amount: successfulInvoice.amount_paid,
                currency: successfulInvoice.currency
              })
            }
          }
        }
        break

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice
        const failedCustomerId = failedInvoice.customer as string
        
        if (failedCustomerId) {
          const failedCustomer = await stripe.customers.retrieve(failedCustomerId)
          
          if (!failedCustomer.deleted) {
            const failedOrganizationId = failedCustomer.metadata?.organizationId
            
            if (failedOrganizationId) {
              console.log(`[AUDIT] Organization payment failed`, {
                timestamp: new Date().toISOString(),
                organizationId: failedOrganizationId,
                invoiceId: failedInvoice.id,
                amount: failedInvoice.amount_due,
                currency: failedInvoice.currency,
                attemptCount: failedInvoice.attempt_count
              })
              
              // TODO: Implement payment failure handling logic
              // Could include email notifications, grace period tracking, etc.
            }
          }
        }
        break

      default:
        console.log(`[AUDIT] Unhandled webhook event`, {
          timestamp: new Date().toISOString(),
          eventType: event.type,
          eventId: event.id
        })
    }
  } catch (error) {
    console.error(`[ERROR] Webhook processing failed`, {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      eventId: event.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }

  return NextResponse.json({ 
    received: true,
    eventType: event.type,
    eventId: event.id,
    processedAt: new Date().toISOString()
  })
} 