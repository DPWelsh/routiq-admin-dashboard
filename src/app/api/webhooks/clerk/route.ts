import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyClerkWebhook, logWebhookEvent, isUserEvent, isOrganizationEvent, isOrganizationMembershipEvent } from '@/lib/utils/webhook-verification';
import {
  handleUserCreated,
  handleUserUpdated,
  handleUserDeleted,
  handleOrganizationCreated,
  handleOrganizationUpdated,
  handleOrganizationDeleted,
  handleOrganizationMembershipCreated,
  handleOrganizationMembershipUpdated,
  handleOrganizationMembershipDeleted,
} from '@/lib/auth/webhook-handlers';

/**
 * Clerk Webhook Endpoint
 * Handles incoming webhook events from Clerk for user and organization synchronization
 * 
 * Supported events:
 * - user.created, user.updated, user.deleted
 * - organization.created, organization.updated, organization.deleted  
 * - organizationMembership.created, organizationMembership.updated, organizationMembership.deleted
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let eventType = 'unknown';
  let eventId = 'unknown';

  try {
    const headersList = await headers();
    const payload = await request.text();
    
    console.log('[CLERK_WEBHOOK] Incoming webhook request', {
      timestamp: new Date().toISOString(),
      payloadSize: payload.length,
    });

    const verificationResult = await verifyClerkWebhook(payload, headersList);
    
    if (!verificationResult.isValid) {
      console.error('[CLERK_WEBHOOK] Signature verification failed', {
        error: verificationResult.error,
        timestamp: new Date().toISOString(),
        payloadSize: payload.length,
      });
      
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 401 });
    }

    const event = verificationResult.payload!;
    eventType = event.type;
    eventId = event.data?.id || 'unknown';

    logWebhookEvent(event, 'CLERK_VERIFIED');
    
    console.log('[CLERK_WEBHOOK] Processing verified event', {
      type: eventType,
      id: eventId,
      timestamp: new Date().toISOString(),
    });

    let handlerResult;
    
    // Route events to specific handlers based on type
    if (isUserEvent(event)) {
      switch (eventType) {
        case 'user.created':
          handlerResult = await handleUserCreated(event);
          break;
        case 'user.updated':
          handlerResult = await handleUserUpdated(event);
          break;
        case 'user.deleted':
          handlerResult = await handleUserDeleted(event);
          break;
        default:
          console.warn('[CLERK_WEBHOOK] Unhandled user event type', { type: eventType });
          handlerResult = { handled: false, action: 'unhandled_user_event' };
      }
    } else if (isOrganizationMembershipEvent(event)) {
      switch (eventType) {
        case 'organizationMembership.created':
          handlerResult = await handleOrganizationMembershipCreated(event);
          break;
        case 'organizationMembership.updated':
          handlerResult = await handleOrganizationMembershipUpdated(event);
          break;
        case 'organizationMembership.deleted':
          handlerResult = await handleOrganizationMembershipDeleted(event);
          break;
        default:
          console.warn('[CLERK_WEBHOOK] Unhandled membership event type', { type: eventType });
          handlerResult = { handled: false, action: 'unhandled_membership_event' };
      }
    } else if (isOrganizationEvent(event)) {
      switch (eventType) {
        case 'organization.created':
          handlerResult = await handleOrganizationCreated(event);
          break;
        case 'organization.updated':
          handlerResult = await handleOrganizationUpdated(event);
          break;
        case 'organization.deleted':
          handlerResult = await handleOrganizationDeleted(event);
          break;
        default:
          console.warn('[CLERK_WEBHOOK] Unhandled organization event type', { type: eventType });
          handlerResult = { handled: false, action: 'unhandled_organization_event' };
      }
    } else {
      console.warn('[CLERK_WEBHOOK] Unhandled event type', {
        type: eventType,
        id: eventId,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json({ 
        message: 'Event type not supported', 
        type: eventType, 
        handled: false 
      }, { status: 200 });
    }

    const processingTime = Date.now() - startTime;
    
    console.log('[CLERK_WEBHOOK] Event processed successfully', {
      type: eventType,
      id: eventId,
      processingTimeMs: processingTime,
      result: handlerResult,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      message: 'Webhook processed successfully', 
      type: eventType, 
      id: eventId,
      handled: handlerResult.handled,
      action: handlerResult.action,
      processingTimeMs: processingTime
    }, { status: 200 });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[CLERK_WEBHOOK] Error processing webhook', { 
      type: eventType, 
      id: eventId, 
      error: errorMessage,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook',
      type: eventType,
      handled: false
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    error: 'Method not allowed', 
    message: 'This endpoint only accepts POST requests' 
  }, { status: 405 });
} 