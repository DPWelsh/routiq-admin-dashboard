import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { UserRole, UserStatus, OrganizationStatus } from '@/types/organization'

export interface ClientOrganizationContext {
  organizationId: string
  organizationName: string
  organizationSlug: string | null
  userRole: UserRole
  userStatus: UserStatus
  organizationStatus: OrganizationStatus
  clerkUserId: string
  permissions: Record<string, unknown>
}

export interface UseOrganizationContextResult {
  organizationContext: ClientOrganizationContext | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  
  // Convenience accessors
  organizationId: string | null
  organizationName: string | null
  userRole: UserRole | null
  isAdmin: boolean
  isOwner: boolean
  canManageUsers: boolean
}

/**
 * Hook to access organization context from the client side
 * Fetches organization context from the API and provides it to React components
 */
export function useOrganizationContext(): UseOrganizationContextResult {
  const { user, isLoaded: isUserLoaded } = useUser()
  const [organizationContext, setOrganizationContext] = useState<ClientOrganizationContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizationContext = useCallback(async (): Promise<void> => {
    if (!isUserLoaded || !user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/organization/context', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch organization context')
      }

      setOrganizationContext(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch organization context:', err)
      setOrganizationContext(null)
    } finally {
      setIsLoading(false)
    }
  }, [isUserLoaded, user])

  // Fetch organization context when user is loaded
  useEffect(() => {
    fetchOrganizationContext()
  }, [fetchOrganizationContext])

  // Computed values for convenience
  const organizationId = organizationContext?.organizationId || null
  const organizationName = organizationContext?.organizationName || null
  const userRole = organizationContext?.userRole || null
  const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.OWNER
  const isOwner = userRole === UserRole.OWNER
  const canManageUsers = isAdmin || isOwner

  return {
    organizationContext,
    isLoading,
    error,
    refetch: fetchOrganizationContext,
    
    // Convenience accessors
    organizationId,
    organizationName,
    userRole,
    isAdmin,
    isOwner,
    canManageUsers,
  }
}

/**
 * Hook for organization permissions (wrapper around useOrganizationContext)
 */
export function useOrganizationPermissions() {
  const { userRole, isAdmin, isOwner, canManageUsers } = useOrganizationContext()
  
  return {
    userRole,
    isAdmin,
    isOwner,
    canManageUsers,
    canViewPatients: userRole !== null,
    canEditPatients: userRole === UserRole.STAFF || isAdmin,
    canViewConversations: userRole !== null,
    canEditConversations: userRole === UserRole.STAFF || isAdmin,
    canViewAnalytics: isAdmin,
    canManageOrganization: isOwner,
  }
} 