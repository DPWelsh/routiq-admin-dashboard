'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building2, Crown, User } from 'lucide-react'
import { useClerkOrganization } from '@/hooks/useClerkOrganization'
import { useOrganizationList } from '@clerk/nextjs'

interface OrganizationSelectorProps {
  selectedOrgId?: string
  onOrgChange?: (orgId: string, orgName: string) => void
  className?: string
}

export function OrganizationSelector({ 
  selectedOrgId, 
  onOrgChange, 
  className 
}: OrganizationSelectorProps) {
  const { 
    organization: currentOrg, 
    userMemberships, 
    isLoading 
  } = useClerkOrganization()
  const { setActive } = useOrganizationList()
  
  const effectiveSelectedOrgId = selectedOrgId || currentOrg?.id

  const handleOrgChange = async (orgId: string) => {
    const selectedMembership = userMemberships.find(m => m.organization.id === orgId)
    if (selectedMembership && setActive) {
      // Switch Clerk's active organization
      await setActive({ organization: orgId })
      
      // Notify parent component
      onOrgChange?.(orgId, selectedMembership.organization.name)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3 text-yellow-600" />
      default:
        return <User className="h-3 w-3 text-blue-600" />
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default" className="text-xs">Admin</Badge>
      default:
        return <Badge variant="secondary" className="text-xs">Member</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-md h-10 w-64 ${className}`} />
    )
  }

  if (userMemberships.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No organizations found
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700">
        Select Organization
      </label>
      <Select 
        value={effectiveSelectedOrgId} 
        onValueChange={handleOrgChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose organization...">
            {effectiveSelectedOrgId && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  {userMemberships.find(m => m.organization.id === effectiveSelectedOrgId)?.organization.name || 'Unknown'}
                </span>
                {userMemberships.find(m => m.organization.id === effectiveSelectedOrgId) && 
                  getRoleIcon(userMemberships.find(m => m.organization.id === effectiveSelectedOrgId)!.role)
                }
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {userMemberships.map((membership) => (
            <SelectItem 
              key={membership.organization.id} 
              value={membership.organization.id}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2 flex-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{membership.organization.name}</span>
                    {membership.organization.slug && (
                      <span className="text-xs text-muted-foreground">
                        {membership.organization.slug}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {getRoleIcon(membership.role)}
                  {getRoleBadge(membership.role)}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Organization Stats */}
      <div className="text-xs text-muted-foreground">
        {userMemberships.length} organization{userMemberships.length !== 1 ? 's' : ''} available
      </div>
    </div>
  )
} 