import { useState, useEffect, useCallback } from 'react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'

export interface UsageMetrics {
  users: {
    total: number
    limit: number
    percentage: number
  }
  patients: {
    total: number
    limit: number
    percentage: number
  }
  conversations: {
    total: number
    limit: number
    percentage: number
  }
  messages: {
    total: number
    limit: number
    percentage: number
  }
}

export interface UsageWarning {
  type: string
  level: 'warning' | 'critical'
  current: number
  limit: number
  percentage: number
}

export interface PlanLimits {
  users: number
  patients: number
  conversations: number
  messages: number
}

export interface UsageData {
  period: {
    days: number
    organizationAge: number
  }
  metrics: UsageMetrics
  warnings: UsageWarning[]
  plan: {
    name: string
    status: string | null
    limits: PlanLimits
  }
  metadata: {
    accessedAt: string
    accessedBy: string
    organizationId: string
  }
}

export interface UseUsageMetricsResult {
  usageData: UsageData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  
  // Convenience accessors
  isNearLimit: (type: keyof UsageMetrics) => boolean
  isOverLimit: (type: keyof UsageMetrics) => boolean
  warningsByLevel: (level: 'warning' | 'critical') => UsageWarning[]
  hasAnyWarnings: boolean
  criticalWarnings: UsageWarning[]
}

/**
 * Hook to manage organization usage metrics and warnings
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export function useUsageMetrics(period: number = 30): UseUsageMetricsResult {
  const { organizationContext, isAdmin, isOwner } = useOrganizationContext()
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user has billing permissions
  const hasBillingPermissions = isAdmin || isOwner

  const fetchUsageData = useCallback(async (): Promise<void> => {
    if (!organizationContext || !hasBillingPermissions) {
      setIsLoading(false)
      setError(hasBillingPermissions ? null : 'Insufficient permissions to view usage metrics')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.append('period', period.toString())

      const response = await fetch(`/api/organization/billing/usage?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        if (response.status === 403) {
          throw new Error('You do not have permission to view usage metrics')
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch usage metrics')
      }

      setUsageData(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch usage metrics:', err)
      setUsageData(null)
    } finally {
      setIsLoading(false)
    }
  }, [organizationContext, hasBillingPermissions, period])

  // Convenience functions
  const isNearLimit = useCallback((type: keyof UsageMetrics): boolean => {
    if (!usageData) return false
    return usageData.metrics[type].percentage >= 80
  }, [usageData])

  const isOverLimit = useCallback((type: keyof UsageMetrics): boolean => {
    if (!usageData) return false
    return usageData.metrics[type].percentage >= 100
  }, [usageData])

  const warningsByLevel = useCallback((level: 'warning' | 'critical'): UsageWarning[] => {
    if (!usageData) return []
    return usageData.warnings.filter(warning => warning.level === level)
  }, [usageData])

  // Initial fetch
  useEffect(() => {
    fetchUsageData()
  }, [fetchUsageData])

  const hasAnyWarnings = usageData?.warnings.length ? usageData.warnings.length > 0 : false
  const criticalWarnings = warningsByLevel('critical')

  return {
    usageData,
    isLoading,
    error,
    refetch: fetchUsageData,
    isNearLimit,
    isOverLimit,
    warningsByLevel,
    hasAnyWarnings,
    criticalWarnings,
  }
} 