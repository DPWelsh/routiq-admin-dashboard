'use client'

import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs'

export function useClerkOrganization() {
  const { user, isLoaded: isUserLoaded } = useUser()
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization()
  const { userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList({
    userMemberships: {
      infinite: false,
    },
  })

  const isLoading = !isUserLoaded || !isOrgLoaded || !isOrgListLoaded

  return {
    // User info
    user,
    userId: user?.id,
    
    // Current organization
    organization,
    organizationId: organization?.id,
    organizationName: organization?.name,
    organizationSlug: organization?.slug,
    
    // User's role in current organization
    membershipRole: membership?.role, // 'admin' | 'member'
    isAdmin: membership?.role === 'admin',
    isMember: membership?.role === 'member',
    
    // All organizations user belongs to
    userMemberships: userMemberships?.data || [],
    
    // Loading states
    isLoading,
    isLoaded: !isLoading,
    
    // Utility functions
    hasOrganization: !!organization,
    canInviteMembers: membership?.role === 'admin',
    canManageOrganization: membership?.role === 'admin',
  }
}

// Simple permission check hook
export function useOrgPermission(permission: 'admin' | 'member') {
  const { membershipRole } = useClerkOrganization()
  
  if (permission === 'admin') {
    return membershipRole === 'admin'
  }
  
  return !!membershipRole // Any role has member permissions
} 