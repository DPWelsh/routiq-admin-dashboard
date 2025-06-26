import { useAuth, useOrganization } from '@clerk/nextjs'
import { useMemo } from 'react'
import { RoutiqAPI } from '@/lib/routiq-api'

export function useAuthenticatedAPI() {
  const { getToken } = useAuth()
  const { organization } = useOrganization()
  
  const api = useMemo(() => {
    const orgId = organization?.id
    if (!orgId) return null
    
    return new RoutiqAPI(orgId)
  }, [organization?.id])
  
  return { api, isAuthenticated: !!api, organizationId: organization?.id }
} 