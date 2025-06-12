import { useState, useEffect, useCallback } from 'react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useOrganizationBilling } from '@/hooks/useOrganizationBilling'
import { useUsageMetrics } from '@/hooks/useUsageMetrics'

export interface BillingAlert {
  id: string
  type: 'payment_failed' | 'trial_expiring' | 'usage_warning' | 'invoice_ready' | 'subscription_changed'
  level: 'info' | 'warning' | 'critical'
  title: string
  message: string
  actionText?: string
  actionUrl?: string
  canDismiss: boolean
  timestamp: string
}

export interface UseBillingAlertsResult {
  alerts: BillingAlert[]
  isLoading: boolean
  error: string | null
  dismissAlert: (alertId: string) => void
  refetch: () => Promise<void>
  
  // Convenience accessors
  criticalAlerts: BillingAlert[]
  warningAlerts: BillingAlert[]
  infoAlerts: BillingAlert[]
  hasCriticalAlerts: boolean
  alertCount: number
}

/**
 * Hook to manage billing alerts and notifications for organization admins
 * Combines data from billing, usage, and subscription sources
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export function useBillingAlerts(): UseBillingAlertsResult {
  const { organizationContext, isAdmin, isOwner } = useOrganizationContext()
  const { billingData, isLoading: billingLoading, error: billingError } = useOrganizationBilling()
  const { usageData, isLoading: usageLoading, error: usageError } = useUsageMetrics()
  
  const [alerts, setAlerts] = useState<BillingAlert[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user has billing permissions
  const hasBillingPermissions = isAdmin || isOwner

  const generateAlerts = useCallback((): BillingAlert[] => {
    if (!hasBillingPermissions || !billingData || !usageData) return []

    const newAlerts: BillingAlert[] = []

    // Trial expiration alert
    if (billingData.trial.isInTrial && billingData.trial.daysRemaining !== null) {
      if (billingData.trial.daysRemaining <= 3) {
        newAlerts.push({
          id: 'trial-expiring',
          type: 'trial_expiring',
          level: billingData.trial.daysRemaining <= 1 ? 'critical' : 'warning',
          title: 'Trial Expiring Soon',
          message: `Your trial expires in ${billingData.trial.daysRemaining} day${billingData.trial.daysRemaining !== 1 ? 's' : ''}. Upgrade to continue using all features.`,
          actionText: 'Upgrade Now',
          actionUrl: '/dashboard/billing',
          canDismiss: false,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Subscription status alerts
    if (billingData.stripe.subscription) {
      const subscription = billingData.stripe.subscription
      
      if (subscription.status === 'past_due') {
        newAlerts.push({
          id: 'payment-failed',
          type: 'payment_failed',
          level: 'critical',
          title: 'Payment Failed',
          message: 'Your last payment failed. Please update your payment method to avoid service interruption.',
          actionText: 'Update Payment',
          actionUrl: '/dashboard/billing',
          canDismiss: false,
          timestamp: new Date().toISOString()
        })
      }

      if (subscription.cancelAtPeriodEnd) {
        const endDate = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd * 1000) : null
        newAlerts.push({
          id: 'subscription-canceling',
          type: 'subscription_changed',
          level: 'warning',
          title: 'Subscription Canceling',
          message: `Your subscription will end on ${endDate ? endDate.toLocaleDateString() : 'the current period end'}. Reactivate to continue service.`,
          actionText: 'Reactivate',
          actionUrl: '/dashboard/billing',
          canDismiss: true,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Usage warnings
    if (usageData.warnings.length > 0) {
      usageData.warnings.forEach(warning => {
        newAlerts.push({
          id: `usage-${warning.type}`,
          type: 'usage_warning',
          level: warning.level === 'critical' ? 'critical' : 'warning',
          title: `${warning.type.charAt(0).toUpperCase() + warning.type.slice(1)} Limit Reached`,
          message: `You've used ${warning.percentage}% of your ${warning.type} limit (${warning.current}/${warning.limit}). Consider upgrading your plan.`,
          actionText: 'View Plans',
          actionUrl: '/dashboard/billing',
          canDismiss: true,
          timestamp: new Date().toISOString()
        })
      })
    }

    // Filter out dismissed alerts
    return newAlerts.filter(alert => !dismissedAlerts.has(alert.id))
  }, [billingData, usageData, hasBillingPermissions, dismissedAlerts])

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]))
  }, [])

  const refetch = useCallback(async (): Promise<void> => {
    // This will trigger re-generation of alerts when billing/usage data updates
    setIsLoading(true)
    setError(null)
    
    try {
      // Generate new alerts based on current data
      const newAlerts = generateAlerts()
      setAlerts(newAlerts)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to generate billing alerts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [generateAlerts])

  // Update alerts when billing or usage data changes
  useEffect(() => {
    if (!billingLoading && !usageLoading) {
      const newAlerts = generateAlerts()
      setAlerts(newAlerts)
      setIsLoading(false)
      
      // Set error if either billing or usage has errors
      if (billingError || usageError) {
        setError(billingError || usageError)
      } else {
        setError(null)
      }
    } else {
      setIsLoading(true)
    }
  }, [billingData, usageData, billingLoading, usageLoading, billingError, usageError, generateAlerts])

  // Convenience accessors
  const criticalAlerts = alerts.filter(alert => alert.level === 'critical')
  const warningAlerts = alerts.filter(alert => alert.level === 'warning')
  const infoAlerts = alerts.filter(alert => alert.level === 'info')
  const hasCriticalAlerts = criticalAlerts.length > 0
  const alertCount = alerts.length

  return {
    alerts,
    isLoading,
    error,
    dismissAlert,
    refetch,
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    hasCriticalAlerts,
    alertCount,
  }
} 