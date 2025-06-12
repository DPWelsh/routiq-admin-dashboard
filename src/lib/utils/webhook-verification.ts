import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import crypto from 'crypto';

/**
 * Clerk webhook signature verification utility
 * Implements HMAC SHA256 verification for Clerk webhook payloads
 */

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
  payload?: WebhookEvent;
}

export interface ClerkWebhookHeaders {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
}

export class WebhookVerificationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Verifies Clerk webhook signature using HMAC SHA256
 * @param payload - Raw webhook payload as string
 * @param signature - Signature from Svix-Signature header
 * @param timestamp - Timestamp from Svix-Timestamp header
 * @param secret - Clerk webhook signing secret
 * @returns boolean indicating if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    if (!payload || !signature || !timestamp || !secret) {
      throw new WebhookVerificationError(
        'Missing required parameters for webhook verification',
        'MISSING_PARAMETERS'
      );
    }

    // Remove the webhook secret prefix if present
    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    
    // Decode the base64 secret
    const secretBytes = Buffer.from(cleanSecret, 'base64');

    // Create the signed payload: timestamp + '.' + payload
    const signedPayload = `${timestamp}.${payload}`;

    // Generate HMAC SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedPayload, 'utf8')
      .digest('base64');

    // Parse signatures from header (format: "v1,signature1 v1,signature2")
    const signatures = signature.split(' ').map(sig => {
      const [version, sig_value] = sig.split(',');
      return { version, signature: sig_value };
    });

    // Check if any signature matches (Svix sends multiple signatures)
    return signatures.some(sig => 
      sig.version === 'v1' && 
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'base64'),
        Buffer.from(sig.signature, 'base64')
      )
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

/**
 * Extracts and validates webhook headers from Next.js request
 * @param headersList - Headers from Next.js request
 * @returns Validated webhook headers
 */
export function extractWebhookHeaders(headersList: Headers): ClerkWebhookHeaders {
  const svixId = headersList.get('svix-id');
  const svixTimestamp = headersList.get('svix-timestamp');
  const svixSignature = headersList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new WebhookVerificationError(
      'Missing required Svix headers',
      'MISSING_HEADERS'
    );
  }

  return {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  };
}

/**
 * Validates webhook timestamp to prevent replay attacks
 * @param timestamp - Timestamp from Svix-Timestamp header
 * @param toleranceInSeconds - Maximum age of webhook in seconds (default: 300)
 * @returns boolean indicating if timestamp is valid
 */
export function isTimestampValid(
  timestamp: string,
  toleranceInSeconds: number = 300
): boolean {
  try {
    const webhookTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTimestamp - webhookTimestamp);

    return timeDifference <= toleranceInSeconds;
  } catch (error) {
    console.error('Invalid timestamp format:', error);
    return false;
  }
}

/**
 * Complete webhook verification function that combines all checks
 * @param payload - Raw webhook payload as string
 * @param headersList - Next.js headers object
 * @param secret - Clerk webhook signing secret
 * @returns WebhookVerificationResult with validation status and parsed payload
 */
export async function verifyClerkWebhook(
  payload: string,
  headersList: Headers,
  secret?: string
): Promise<WebhookVerificationResult> {
  try {
    // Get webhook secret from environment if not provided
    const webhookSecret = secret || process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new WebhookVerificationError(
        'CLERK_WEBHOOK_SECRET environment variable is required',
        'MISSING_SECRET'
      );
    }

    // Extract required headers
    const headers = extractWebhookHeaders(headersList);

    // Validate timestamp to prevent replay attacks
    if (!isTimestampValid(headers['svix-timestamp'])) {
      throw new WebhookVerificationError(
        'Webhook timestamp is too old or invalid',
        'INVALID_TIMESTAMP'
      );
    }

    // Verify signature
    const isValidSignature = verifyWebhookSignature(
      payload,
      headers['svix-signature'],
      headers['svix-timestamp'],
      webhookSecret
    );

    if (!isValidSignature) {
      throw new WebhookVerificationError(
        'Webhook signature verification failed',
        'INVALID_SIGNATURE'
      );
    }

    // Parse the payload
    let parsedPayload: WebhookEvent;
    try {
      parsedPayload = JSON.parse(payload) as WebhookEvent;
    } catch (error) {
      throw new WebhookVerificationError(
        'Invalid JSON payload',
        'INVALID_PAYLOAD'
      );
    }

    return {
      isValid: true,
      payload: parsedPayload,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof WebhookVerificationError ? error.code : 'VERIFICATION_FAILED';
    
    console.error('Clerk webhook verification failed:', {
      error: errorMessage,
      code: errorCode,
    });

    return {
      isValid: false,
      error: errorMessage,
    };
  }
}

/**
 * Type guards for specific Clerk webhook event types
 */
export function isUserEvent(event: WebhookEvent): boolean {
  return event.type.startsWith('user.');
}

export function isOrganizationEvent(event: WebhookEvent): boolean {
  return event.type.startsWith('organization');
}

export function isOrganizationMembershipEvent(event: WebhookEvent): boolean {
  return event.type.startsWith('organizationMembership.');
}

/**
 * Utility to log webhook events for debugging (remove in production)
 */
export function logWebhookEvent(event: WebhookEvent, prefix = 'WEBHOOK'): void {
  console.log(`[${prefix}] Event received:`, {
    type: event.type,
    id: event.data?.id || 'unknown',
    timestamp: new Date().toISOString(),
  });
} 