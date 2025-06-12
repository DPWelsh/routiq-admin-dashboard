import { useState, useEffect, useCallback } from 'react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'

export interface OrganizationBillingData {
  organization: {
    id: string
    name: string
    subscriptionStatus: string
    subscriptionPlan: string
    billingEmail: string | null
    billingAddress: Record<string, unknown>
    hasStripeCustomer: boolean
  }
  trial: {
    isInTrial: boolean
    trialEndsAt: string | null
    daysRemaining: number | null
  }
  stripe: {
    customer: {
      id: string
      email: string | null
      created: number
      defaultSource: string | null
      invoiceSettings: Record<string, unknown>
    } | null
    subscription: {
      id: string
      status: string
      currentPeriodStart: number
      currentPeriodEnd: number
      cancelAtPeriodEnd: boolean
      canceledAt: number | null
      trialStart: number | null
      trialEnd: number | null
      items: Array<{
        id: string
        priceId: string
        quantity: number
        amount: number | null
        currency: string
        interval: string | undefined
        productName: string | Record<string, unknown>
      }>
    } | null
  }
  metadata: {
    accessedAt: string
    accessedBy: string
    securityLevel: string
  }
}

export interface UseOrganizationBillingResult {
  billingData: OrganizationBillingData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  
  // Convenience accessors
  isSubscribed: boolean
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  trialDaysRemaining: number | null
  hasActiveSubscription: boolean
  nextBillingDate: Date | null
  
  // Actions
  openCustomerPortal: (returnUrl?: string) => Promise<string | null>
}

/**
 * Hook to manage organization billing data and actions
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export function useOrganizationBilling(): UseOrganizationBillingResult {
  const { organizationContext, isAdmin, isOwner } = useOrganizationContext()
  const [billingData, setBillingData] = useState<OrganizationBillingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user has billing permissions
  const hasBillingPermissions = isAdmin || isOwner

  const fetchBillingData = useCallback(async (): Promise<void> => {
    if (!organizationContext || !hasBillingPermissions) {
      setIsLoading(false)
      setError(hasBillingPermissions ? null : 'Insufficient permissions to view billing')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/organization/billing', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        if (response.status === 403) {
          throw new Error('You do not have permission to view billing information')
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch billing data')
      }

      setBillingData(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch organization billing data:', err)
      setBillingData(null)
    } finally {
      setIsLoading(false)
    }
  }, [organizationContext, hasBillingPermissions])

  // Open Stripe Customer Portal
  const openCustomerPortal = useCallback(async (returnUrl?: string): Promise<string | null> => {
    if (!organizationContext || !hasBillingPermissions) {
      throw new Error('Insufficient permissions to access billing portal')
    }

    try {
      const response = await fetch('/api/organization/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ returnUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create portal session')
      }

      // Return the portal URL for the caller to redirect to
      return result.data.url
    } catch (err) {
      console.error('Failed to open customer portal:', err)
      throw err
    }
  }, [organizationContext, hasBillingPermissions])

  // Fetch billing data when organization context is available
  useEffect(() => {
    fetchBillingData()
  }, [fetchBillingData])

  // Computed values for convenience
  const isSubscribed = billingData?.organization.subscriptionStatus === 'active'
  const subscriptionStatus = billingData?.organization.subscriptionStatus || null
  const subscriptionPlan = billingData?.organization.subscriptionPlan || null
  const trialDaysRemaining = billingData?.trial.daysRemaining || null
  
  const hasActiveSubscription = billingData?.stripe.subscription?.status 
    ? ['active', 'trialing'].includes(billingData.stripe.subscription.status)
    : false
    
  const nextBillingDate = billingData?.stripe.subscription?.currentPeriodEnd 
    ? new Date(billingData.stripe.subscription.currentPeriodEnd * 1000)
    : null

  return {
    billingData,
    isLoading,
    error,
    refetch: fetchBillingData,
    
    // Convenience accessors
    isSubscribed,
    subscriptionStatus,
    subscriptionPlan,
    trialDaysRemaining,
    hasActiveSubscription,
    nextBillingDate,
    
    // Actions
    openCustomerPortal,
  }
}

/**
 * Simplified hook for checking subscription status
 */
export function useOrganizationSubscription() {
  const { isSubscribed, subscriptionStatus, subscriptionPlan, hasActiveSubscription, nextBillingDate } = useOrganizationBilling()
  
  return {
    isSubscribed,
    subscriptionStatus,
    subscriptionPlan,
    hasActiveSubscription,
    nextBillingDate,
  }
} 