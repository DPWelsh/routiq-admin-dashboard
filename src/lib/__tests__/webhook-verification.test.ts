import crypto from 'crypto';
import {
  verifyWebhookSignature,
  extractWebhookHeaders,
  isTimestampValid,
  verifyClerkWebhook,
  WebhookVerificationError,
  isUserEvent,
  isOrganizationEvent,
  isOrganizationMembershipEvent,
  logWebhookEvent,
} from '../utils/webhook-verification';
import { WebhookEvent } from '@clerk/nextjs/server';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// Helper function to create a valid signature
function createValidSignature(payload: string, timestamp: string, secret: string): string {
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(cleanSecret, 'base64');
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedPayload, 'utf8')
    .digest('base64');
  return `v1,${signature}`;
}

// Helper function to create mock headers
function createMockHeaders(headers: Record<string, string>): Headers {
  const mockHeaders = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    mockHeaders.set(key, value);
  });
  return mockHeaders;
}

describe('WebhookVerificationError', () => {
  it('should create error with message and code', () => {
    const error = new WebhookVerificationError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('WebhookVerificationError');
  });
});

describe('verifyWebhookSignature', () => {
  const testSecret = 'whsec_' + Buffer.from('test-secret-key').toString('base64');
  const testPayload = '{"test": "data"}';
  const testTimestamp = '1640995200';

  it('should verify valid signature successfully', () => {
    const validSignature = createValidSignature(testPayload, testTimestamp, testSecret);
    const result = verifyWebhookSignature(testPayload, validSignature, testTimestamp, testSecret);
    expect(result).toBe(true);
  });

  it('should reject invalid signature', () => {
    const invalidSignature = 'v1,invalid-signature';
    const result = verifyWebhookSignature(testPayload, invalidSignature, testTimestamp, testSecret);
    expect(result).toBe(false);
  });

  it('should handle multiple signatures', () => {
    const validSignature = createValidSignature(testPayload, testTimestamp, testSecret);
    const multipleSignatures = `v1,invalid-sig ${validSignature}`;
    const result = verifyWebhookSignature(testPayload, multipleSignatures, testTimestamp, testSecret);
    expect(result).toBe(true);
  });

  it('should handle secret without whsec_ prefix', () => {
    const secretWithoutPrefix = Buffer.from('test-secret-key').toString('base64');
    const validSignature = createValidSignature(testPayload, testTimestamp, secretWithoutPrefix);
    const result = verifyWebhookSignature(testPayload, validSignature, testTimestamp, secretWithoutPrefix);
    expect(result).toBe(true);
  });

  it('should return false for missing parameters', () => {
    const result = verifyWebhookSignature('', 'sig', 'time', 'secret');
    expect(result).toBe(false);
  });

  it('should return false for invalid base64 secret', () => {
    const invalidSecret = 'whsec_invalid-base64!';
    const result = verifyWebhookSignature(testPayload, 'v1,sig', testTimestamp, invalidSecret);
    expect(result).toBe(false);
  });
});

describe('extractWebhookHeaders', () => {
  it('should extract valid headers successfully', () => {
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': '1640995200',
      'svix-signature': 'v1,test-signature',
    });

    const result = extractWebhookHeaders(headers);
    expect(result).toEqual({
      'svix-id': 'test-id',
      'svix-timestamp': '1640995200',
      'svix-signature': 'v1,test-signature',
    });
  });

  it('should throw error for missing svix-id', () => {
    const headers = createMockHeaders({
      'svix-timestamp': '1640995200',
      'svix-signature': 'v1,test-signature',
    });

    expect(() => extractWebhookHeaders(headers)).toThrow(WebhookVerificationError);
    expect(() => extractWebhookHeaders(headers)).toThrow('Missing required Svix headers');
  });

  it('should throw error for missing svix-timestamp', () => {
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-signature': 'v1,test-signature',
    });

    expect(() => extractWebhookHeaders(headers)).toThrow(WebhookVerificationError);
  });

  it('should throw error for missing svix-signature', () => {
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': '1640995200',
    });

    expect(() => extractWebhookHeaders(headers)).toThrow(WebhookVerificationError);
  });
});

describe('isTimestampValid', () => {
  it('should validate current timestamp', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();
    const result = isTimestampValid(currentTimestamp);
    expect(result).toBe(true);
  });

  it('should validate timestamp within tolerance', () => {
    const timestamp = (Math.floor(Date.now() / 1000) - 100).toString(); // 100 seconds ago
    const result = isTimestampValid(timestamp, 300); // 5 minute tolerance
    expect(result).toBe(true);
  });

  it('should reject timestamp outside tolerance', () => {
    const timestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
    const result = isTimestampValid(timestamp, 300); // 5 minute tolerance
    expect(result).toBe(false);
  });

  it('should reject future timestamp outside tolerance', () => {
    const timestamp = (Math.floor(Date.now() / 1000) + 400).toString(); // 400 seconds in future
    const result = isTimestampValid(timestamp, 300); // 5 minute tolerance
    expect(result).toBe(false);
  });

  it('should handle invalid timestamp format', () => {
    const result = isTimestampValid('invalid-timestamp');
    expect(result).toBe(false);
  });

  it('should use default tolerance', () => {
    const timestamp = (Math.floor(Date.now() / 1000) - 200).toString(); // 200 seconds ago
    const result = isTimestampValid(timestamp); // Default 300 second tolerance
    expect(result).toBe(true);
  });
});

describe('verifyClerkWebhook', () => {
  const testSecret = 'whsec_' + Buffer.from('test-secret-key').toString('base64');
  const testPayload = '{"type": "user.created", "data": {"id": "user_123"}}';
  const currentTimestamp = Math.floor(Date.now() / 1000).toString();

  it('should verify valid webhook successfully', async () => {
    const validSignature = createValidSignature(testPayload, currentTimestamp, testSecret);
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': currentTimestamp,
      'svix-signature': validSignature,
    });

    const result = await verifyClerkWebhook(testPayload, headers, testSecret);
    expect(result.isValid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload?.type).toBe('user.created');
    expect(result.error).toBeUndefined();
  });

  it('should use environment variable for secret', async () => {
    process.env.CLERK_WEBHOOK_SECRET = testSecret;
    const validSignature = createValidSignature(testPayload, currentTimestamp, testSecret);
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': currentTimestamp,
      'svix-signature': validSignature,
    });

    const result = await verifyClerkWebhook(testPayload, headers);
    expect(result.isValid).toBe(true);
  });

  it('should fail when secret is missing', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': currentTimestamp,
      'svix-signature': 'v1,signature',
    });

    const result = await verifyClerkWebhook(testPayload, headers);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('CLERK_WEBHOOK_SECRET environment variable is required');
  });

  it('should fail with invalid timestamp', async () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const validSignature = createValidSignature(testPayload, oldTimestamp, testSecret);
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': oldTimestamp,
      'svix-signature': validSignature,
    });

    const result = await verifyClerkWebhook(testPayload, headers, testSecret);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Webhook timestamp is too old or invalid');
  });

  it('should fail with invalid signature', async () => {
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': currentTimestamp,
      'svix-signature': 'v1,invalid-signature',
    });

    const result = await verifyClerkWebhook(testPayload, headers, testSecret);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Webhook signature verification failed');
  });

  it('should fail with invalid JSON payload', async () => {
    const invalidPayload = 'invalid-json{';
    const validSignature = createValidSignature(invalidPayload, currentTimestamp, testSecret);
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      'svix-timestamp': currentTimestamp,
      'svix-signature': validSignature,
    });

    const result = await verifyClerkWebhook(invalidPayload, headers, testSecret);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid JSON payload');
  });

  it('should fail with missing headers', async () => {
    const headers = createMockHeaders({
      'svix-id': 'test-id',
      // Missing timestamp and signature
    });

    const result = await verifyClerkWebhook(testPayload, headers, testSecret);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Missing required Svix headers');
  });
});

describe('Event type guards', () => {
  const mockUserEvent: WebhookEvent = {
    type: 'user.created',
    data: { id: 'user_123' },
    object: 'event',
  } as WebhookEvent;

  const mockOrgEvent: WebhookEvent = {
    type: 'organization.created',
    data: { id: 'org_123' },
    object: 'event',
  } as WebhookEvent;

  const mockOrgMembershipEvent: WebhookEvent = {
    type: 'organizationMembership.created',
    data: { id: 'orgmem_123' },
    object: 'event',
  } as WebhookEvent;

  describe('isUserEvent', () => {
    it('should identify user events', () => {
      expect(isUserEvent(mockUserEvent)).toBe(true);
      expect(isUserEvent(mockOrgEvent)).toBe(false);
      expect(isUserEvent(mockOrgMembershipEvent)).toBe(false);
    });
  });

  describe('isOrganizationEvent', () => {
    it('should identify organization events', () => {
      expect(isOrganizationEvent(mockOrgEvent)).toBe(true);
      expect(isOrganizationEvent(mockOrgMembershipEvent)).toBe(true); // organizationMembership starts with 'organization'
      expect(isOrganizationEvent(mockUserEvent)).toBe(false);
    });
  });

  describe('isOrganizationMembershipEvent', () => {
    it('should identify organization membership events', () => {
      expect(isOrganizationMembershipEvent(mockOrgMembershipEvent)).toBe(true);
      expect(isOrganizationMembershipEvent(mockOrgEvent)).toBe(false);
      expect(isOrganizationMembershipEvent(mockUserEvent)).toBe(false);
    });
  });
});

describe('logWebhookEvent', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log webhook event with default prefix', () => {
    const mockEvent: WebhookEvent = {
      type: 'user.created',
      data: { id: 'user_123' },
      object: 'event',
    } as WebhookEvent;

    logWebhookEvent(mockEvent);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[WEBHOOK] Event received:',
      expect.objectContaining({
        type: 'user.created',
        id: 'user_123',
        timestamp: expect.any(String),
      })
    );
  });

  it('should log webhook event with custom prefix', () => {
    const mockEvent: WebhookEvent = {
      type: 'user.updated',
      data: { id: 'user_456' },
      object: 'event',
    } as WebhookEvent;

    logWebhookEvent(mockEvent, 'CUSTOM');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[CUSTOM] Event received:',
      expect.objectContaining({
        type: 'user.updated',
        id: 'user_456',
        timestamp: expect.any(String),
      })
    );
  });

  it('should handle event without data.id', () => {
    const mockEvent: WebhookEvent = {
      type: 'test.event',
      data: {},
      object: 'event',
    } as WebhookEvent;

    logWebhookEvent(mockEvent);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[WEBHOOK] Event received:',
      expect.objectContaining({
        type: 'test.event',
        id: 'unknown',
        timestamp: expect.any(String),
      })
    );
  });
}); 