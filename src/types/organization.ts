/**
 * Organization Types for Multi-Tenant Architecture
 * Task #1: Create Organizations Table - TypeScript Interfaces
 */

// =====================================================
// ORGANIZATION TYPES
// =====================================================

export interface Organization {
  id: string
  
  // Basic Information
  name: string
  slug?: string | null
  displayName?: string | null
  description?: string | null
  
  // Integration IDs
  clinikoInstanceId?: string | null
  chatwootAccountId?: string | null
  manychatWorkspaceId?: string | null
  
  // Billing Information
  stripeCustomerId?: string | null
  subscriptionStatus: SubscriptionStatus
  subscriptionPlan: SubscriptionPlan
  billingEmail?: string | null
  billingAddress: Record<string, unknown>
  
  // Configuration & Settings
  settings: Record<string, unknown>
  timezone: string
  locale: string
  
  // Business Information
  phone?: string | null
  website?: string | null
  address: Record<string, unknown>
  
  // Status & Metadata
  status: OrganizationStatus
  onboardedAt?: Date | null
  trialEndsAt?: Date | null
  
  // Audit Fields
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
  
  // Relations
  organizationUsers?: OrganizationUser[]
}

export interface OrganizationUser {
  id: string
  
  // Foreign Keys
  organizationId: string
  clerkUserId: string
  
  // Role & Permissions
  role: UserRole
  permissions: Record<string, unknown>
  
  // Invitation System
  invitedBy?: string | null
  invitationToken?: string | null
  invitationEmail?: string | null
  invitationExpiresAt?: Date | null
  invitationAcceptedAt?: Date | null
  
  // User Status & Activity
  status: UserStatus
  lastLoginAt?: Date | null
  lastActivityAt?: Date | null
  
  // User Preferences (org-specific)
  preferences: Record<string, unknown>
  
  // Audit Fields
  createdAt: Date
  updatedAt: Date
  
  // Relations
  organization?: Organization
  inviter?: OrganizationUser | null
  invitedUsers?: OrganizationUser[]
}

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  SUSPENDED = 'suspended'
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  STAFF = 'staff',
  VIEWER = 'viewer'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

// =====================================================
// CREATE/UPDATE TYPES
// =====================================================

export interface CreateOrganizationInput {
  name: string
  slug?: string
  displayName?: string
  description?: string
  
  // Integration IDs
  clinikoInstanceId?: string
  chatwootAccountId?: string
  manychatWorkspaceId?: string
  
  // Billing Information
  stripeCustomerId?: string
  subscriptionStatus?: SubscriptionStatus
  subscriptionPlan?: SubscriptionPlan
  billingEmail?: string
  billingAddress?: Record<string, unknown>
  
  // Configuration
  settings?: Record<string, unknown>
  timezone?: string
  locale?: string
  
  // Business Information
  phone?: string
  website?: string
  address?: Record<string, unknown>
  
  // Status
  status?: OrganizationStatus
  onboardedAt?: Date
  trialEndsAt?: Date
}

export interface UpdateOrganizationInput extends Partial<CreateOrganizationInput> {
  id: string
}

export interface CreateOrganizationUserInput {
  organizationId: string
  clerkUserId: string
  role?: UserRole
  permissions?: Record<string, unknown>
  
  // Invitation
  invitedBy?: string
  invitationEmail?: string
  
  // User preferences
  preferences?: Record<string, unknown>
}

export interface UpdateOrganizationUserInput extends Partial<CreateOrganizationUserInput> {
  id: string
}

export interface InviteUserInput {
  organizationId: string
  invitationEmail: string
  role: UserRole
  invitedBy: string
  permissions?: Record<string, unknown>
}

// =====================================================
// QUERY TYPES
// =====================================================

export interface OrganizationQueryParams {
  status?: OrganizationStatus
  subscriptionStatus?: SubscriptionStatus
  subscriptionPlan?: SubscriptionPlan
  search?: string
  limit?: number
  offset?: number
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface OrganizationUserQueryParams {
  organizationId?: string
  role?: UserRole
  status?: UserStatus
  search?: string
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'lastLoginAt' | 'lastActivityAt'
  sortOrder?: 'asc' | 'desc'
}

// =====================================================
// RESPONSE TYPES
// =====================================================

export interface OrganizationListResponse {
  organizations: Organization[]
  total: number
  limit: number
  offset: number
}

export interface OrganizationUserListResponse {
  users: OrganizationUser[]
  total: number
  limit: number
  offset: number
}

// =====================================================
// VALIDATION SCHEMAS (for use with zod or similar)
// =====================================================

export const ORGANIZATION_VALIDATION_RULES = {
  name: {
    minLength: 1,
    maxLength: 255,
    required: true
  },
  slug: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-z0-9-]+$/,
    required: false
  },
  displayName: {
    maxLength: 255,
    required: false
  },
  phone: {
    maxLength: 20,
    pattern: /^\+?[\d\s\-\(\)]+$/,
    required: false
  },
  website: {
    maxLength: 255,
    pattern: /^https?:\/\/.+/,
    required: false
  }
} as const

export const ORGANIZATION_USER_VALIDATION_RULES = {
  role: {
    allowedValues: Object.values(UserRole),
    required: true
  },
  status: {
    allowedValues: Object.values(UserStatus),
    required: true
  },
  invitationEmail: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    required: false
  }
} as const

// =====================================================
// UTILITY TYPES
// =====================================================

export type OrganizationWithUsers = Organization & {
  organizationUsers: OrganizationUser[]
}

export type OrganizationUserWithOrg = OrganizationUser & {
  organization: Organization
}

// Permission checker type
export type PermissionChecker = (
  user: OrganizationUser,
  permission: string,
  resource?: string
) => boolean

// Organization context for requests
export interface OrganizationContext {
  organizationId: string
  userId: string
  userRole: UserRole
  permissions: Record<string, unknown>
} 