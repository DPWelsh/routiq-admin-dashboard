'use client'

import React from 'react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useRBAC } from '@/hooks/useRBAC'
import { Permission } from '@/lib/rbac/permissions'

/**
 * Test component to verify organization context service functionality
 * This can be used to debug and verify the organization context integration
 */
export function OrganizationContextTest() {
  const {
    organizationContext,
    isLoading: contextLoading,
    error: contextError,
    organizationId,
    organizationName,
    userRole,
    isAdmin,
    isOwner,
    canManageUsers,
  } = useOrganizationContext()

  const {
    permissions,
    can,
    isLoading: rbacLoading,
    roleDisplayName,
    roleDescription,
  } = useRBAC()

  if (contextLoading || rbacLoading) {
    return (
      <div className="p-4 border rounded-lg bg-blue-50">
        <h3 className="font-semibold text-blue-900">Organization Context Test</h3>
        <p className="text-blue-700">Loading organization context...</p>
      </div>
    )
  }

  if (contextError) {
    return (
      <div className="p-4 border rounded-lg bg-red-50">
        <h3 className="font-semibold text-red-900">Organization Context Test</h3>
        <p className="text-red-700">Error: {contextError}</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg bg-green-50">
      <h3 className="font-semibold text-green-900 mb-3">Organization Context Test ✅</h3>
      
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-4">
          {/* Organization Info */}
          <div>
            <h4 className="font-medium text-green-800">Organization Info</h4>
            <p><strong>ID:</strong> {organizationId || 'N/A'}</p>
            <p><strong>Name:</strong> {organizationName || 'N/A'}</p>
            <p><strong>Status:</strong> {organizationContext?.organizationStatus || 'N/A'}</p>
          </div>

          {/* User Info */}
          <div>
            <h4 className="font-medium text-green-800">User Info</h4>
            <p><strong>Role:</strong> {roleDisplayName}</p>
            <p><strong>Status:</strong> {organizationContext?.userStatus || 'N/A'}</p>
            <p><strong>User ID:</strong> {organizationContext?.clerkUserId || 'N/A'}</p>
          </div>
        </div>

        {/* Role Checks */}
        <div>
          <h4 className="font-medium text-green-800">Role Checks</h4>
          <div className="flex gap-4 text-xs">
            <span className={isAdmin ? 'text-green-600' : 'text-gray-500'}>
              Admin: {isAdmin ? '✅' : '❌'}
            </span>
            <span className={isOwner ? 'text-green-600' : 'text-gray-500'}>
              Owner: {isOwner ? '✅' : '❌'}
            </span>
            <span className={canManageUsers ? 'text-green-600' : 'text-gray-500'}>
              Can Manage Users: {canManageUsers ? '✅' : '❌'}
            </span>
          </div>
        </div>

        {/* Permission Checks */}
        <div>
          <h4 className="font-medium text-green-800">Permission Checks</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className={can(Permission.PATIENTS_VIEW) ? 'text-green-600' : 'text-gray-500'}>
              View Patients: {can(Permission.PATIENTS_VIEW) ? '✅' : '❌'}
            </span>
            <span className={can(Permission.CONVERSATIONS_VIEW) ? 'text-green-600' : 'text-gray-500'}>
              View Conversations: {can(Permission.CONVERSATIONS_VIEW) ? '✅' : '❌'}
            </span>
            <span className={can(Permission.ANALYTICS_VIEW) ? 'text-green-600' : 'text-gray-500'}>
              View Analytics: {can(Permission.ANALYTICS_VIEW) ? '✅' : '❌'}
            </span>
            <span className={can(Permission.USERS_MANAGE_ROLES) ? 'text-green-600' : 'text-gray-500'}>
              Manage User Roles: {can(Permission.USERS_MANAGE_ROLES) ? '✅' : '❌'}
            </span>
          </div>
        </div>

        {/* Raw Data */}
        <details className="mt-3">
          <summary className="font-medium text-green-800 cursor-pointer">Raw Organization Context</summary>
          <pre className="mt-2 p-2 bg-white border rounded text-xs overflow-auto">
            {JSON.stringify(organizationContext, null, 2)}
          </pre>
        </details>

        <details>
          <summary className="font-medium text-green-800 cursor-pointer">All Permissions</summary>
          <div className="mt-2 p-2 bg-white border rounded text-xs">
            {permissions.length > 0 ? (
              <div className="grid grid-cols-2 gap-1">
                {permissions.map((permission) => (
                  <span key={permission} className="text-green-600">✅ {permission}</span>
                ))}
              </div>
            ) : (
              <span className="text-gray-500">No permissions</span>
            )}
          </div>
        </details>
      </div>
    </div>
  )
} 