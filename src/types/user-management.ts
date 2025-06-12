/**
 * Enhanced User Management Types
 * Comprehensive type definitions for role-based user management system
 */

// =====================================================
// CORE USER TYPES
// =====================================================

export type UserRole = 'owner' | 'admin' | 'staff' | 'viewer';

export type UserStatus = 'active' | 'pending' | 'suspended' | 'deleted';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

// =====================================================
// PERMISSIONS SYSTEM
// =====================================================

export interface UserPermissions {
  // Patient Management
  patients: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    export: boolean;
  };
  
  // Conversation Management
  conversations: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    export: boolean;
    assign: boolean;
  };
  
  // Analytics & Reports
  analytics: {
    view: boolean;
    export: boolean;
    advanced: boolean;
  };
  
  // User Management
  users: {
    view: boolean;
    invite: boolean;
    edit: boolean;
    deactivate: boolean;
    delete: boolean;
    manage_roles: boolean;
  };
  
  // Organization Settings
  organization: {
    view_settings: boolean;
    edit_settings: boolean;
    manage_billing: boolean;
    manage_integrations: boolean;
  };
  
  // System Administration
  system: {
    view_logs: boolean;
    manage_security: boolean;
    manage_backups: boolean;
  };
}

// =====================================================
// USER PREFERENCES
// =====================================================

export interface UserPreferences {
  // Notification Settings
  notifications: {
    email: {
      new_messages: boolean;
      patient_updates: boolean;
      system_alerts: boolean;
      weekly_reports: boolean;
    };
    in_app: {
      new_messages: boolean;
      patient_updates: boolean;
      system_alerts: boolean;
    };
  };
  
  // UI Preferences
  interface: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    date_format: 'US' | 'EU' | 'ISO';
    dashboard_layout: 'compact' | 'comfortable' | 'spacious';
  };
  
  // Workflow Preferences
  workflow: {
    default_patient_view: 'list' | 'cards' | 'table';
    auto_assign_conversations: boolean;
    conversation_refresh_interval: number; // seconds
    show_archived_by_default: boolean;
  };
}

// =====================================================
// ENHANCED USER INTERFACE
// =====================================================

export interface EnhancedUser {
  id: string;
  clerkUserId: string;
  organizationId: string;
  
  // Profile Information
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  
  // Role & Status
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  preferences: UserPreferences;
  
  // Activity Tracking
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  loginCount: number;
  sessionCount: number;
  
  // Invitation Information
  invitationEmail?: string;
  invitationToken?: string;
  invitationStatus?: InvitationStatus;
  invitationExpiresAt?: Date;
  invitedBy?: string;
  invitedAt?: Date;
  acceptedAt?: Date;
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // Related Data
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

// =====================================================
// QUERY & FILTER TYPES
// =====================================================

export interface UserSearchFilters {
  // Text Search
  search?: string; // Search in name, email
  
  // Status Filters
  roles?: UserRole[];
  statuses?: UserStatus[];
  invitationStatuses?: InvitationStatus[];
  
  // Date Filters
  createdAfter?: Date;
  createdBefore?: Date;
  lastActiveAfter?: Date;
  lastActiveBefore?: Date;
  
  // Activity Filters
  hasLoggedIn?: boolean;
  isOnline?: boolean; // Active in last 5 minutes
  isRecentlyActive?: boolean; // Active in last 24 hours
  
  // Permission Filters
  hasPermission?: {
    category: keyof UserPermissions;
    action: string;
  };
}

export interface UserSortOptions {
  field: 'name' | 'email' | 'role' | 'status' | 'lastActivityAt' | 'createdAt' | 'loginCount';
  direction: 'asc' | 'desc';
}

export interface UserQueryOptions {
  filters?: UserSearchFilters;
  sort?: UserSortOptions;
  pagination?: {
    page: number;
    limit: number;
  };
  include?: {
    organization?: boolean;
    activityStats?: boolean;
    permissions?: boolean;
  };
}

// =====================================================
// BULK OPERATIONS
// =====================================================

export interface BulkUserOperation {
  userIds: string[];
  operation: 'activate' | 'deactivate' | 'delete' | 'update_role' | 'update_permissions';
  data?: {
    role?: UserRole;
    status?: UserStatus;
    permissions?: Partial<UserPermissions>;
    reason?: string;
  };
  performedBy: string;
}

export interface BulkOperationResult {
  success: string[]; // User IDs that were successfully updated
  failed: Array<{
    userId: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  failureCount: number;
}

// =====================================================
// ACTIVITY TRACKING
// =====================================================

export interface UserActivity {
  id: string;
  userId: string;
  organizationId: string;
  
  // Activity Details
  action: string;
  category: 'login' | 'logout' | 'patient' | 'conversation' | 'settings' | 'user_management' | 'system';
  description: string;
  metadata?: Record<string, unknown>;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  // Timestamps
  timestamp: Date;
}

export interface UserActivityStats {
  userId: string;
  
  // Login Statistics
  totalLogins: number;
  lastLoginAt?: Date;
  averageSessionDuration: number; // minutes
  
  // Activity Statistics
  totalActivities: number;
  lastActivityAt?: Date;
  activitiesLast24h: number;
  activitiesLast7d: number;
  activitiesLast30d: number;
  
  // Most Active Categories
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  
  // Recent Activity
  recentActivities: UserActivity[];
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface UserManagementResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedUserResponse {
  users: EnhancedUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: UserSearchFilters;
  sort: UserSortOptions;
}

// =====================================================
// ROLE DEFINITIONS
// =====================================================

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  owner: {
    patients: { view: true, create: true, edit: true, delete: true, export: true },
    conversations: { view: true, create: true, edit: true, delete: true, export: true, assign: true },
    analytics: { view: true, export: true, advanced: true },
    users: { view: true, invite: true, edit: true, deactivate: true, delete: true, manage_roles: true },
    organization: { view_settings: true, edit_settings: true, manage_billing: true, manage_integrations: true },
    system: { view_logs: true, manage_security: true, manage_backups: true }
  },
  
  admin: {
    patients: { view: true, create: true, edit: true, delete: true, export: true },
    conversations: { view: true, create: true, edit: true, delete: true, export: true, assign: true },
    analytics: { view: true, export: true, advanced: true },
    users: { view: true, invite: true, edit: true, deactivate: true, delete: false, manage_roles: true },
    organization: { view_settings: true, edit_settings: true, manage_billing: false, manage_integrations: true },
    system: { view_logs: true, manage_security: false, manage_backups: false }
  },
  
  staff: {
    patients: { view: true, create: true, edit: true, delete: false, export: true },
    conversations: { view: true, create: true, edit: true, delete: false, export: true, assign: false },
    analytics: { view: true, export: false, advanced: false },
    users: { view: true, invite: false, edit: false, deactivate: false, delete: false, manage_roles: false },
    organization: { view_settings: false, edit_settings: false, manage_billing: false, manage_integrations: false },
    system: { view_logs: false, manage_security: false, manage_backups: false }
  },
  
  viewer: {
    patients: { view: true, create: false, edit: false, delete: false, export: false },
    conversations: { view: true, create: false, edit: false, delete: false, export: false, assign: false },
    analytics: { view: true, export: false, advanced: false },
    users: { view: false, invite: false, edit: false, deactivate: false, delete: false, manage_roles: false },
    organization: { view_settings: false, edit_settings: false, manage_billing: false, manage_integrations: false },
    system: { view_logs: false, manage_security: false, manage_backups: false }
  }
};

// =====================================================
// DEFAULT VALUES
// =====================================================

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    email: {
      new_messages: true,
      patient_updates: true,
      system_alerts: true,
      weekly_reports: false
    },
    in_app: {
      new_messages: true,
      patient_updates: true,
      system_alerts: true
    }
  },
  interface: {
    theme: 'auto',
    language: 'en',
    timezone: 'UTC',
    date_format: 'US',
    dashboard_layout: 'comfortable'
  },
  workflow: {
    default_patient_view: 'list',
    auto_assign_conversations: false,
    conversation_refresh_interval: 30,
    show_archived_by_default: false
  }
}; 