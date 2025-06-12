import { useState, useEffect, useCallback } from 'react'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'

export interface Invoice {
  id: string
  number: string | null
  status: string
  amount: number
  amountDue: number
  currency: string
  createdAt: number
  dueDate: number | null
  paidAt: number | null
  periodStart: number | null
  periodEnd: number | null
  subtotal: number
  total: number
  description: string | null
  invoicePdf: string | null
  hostedInvoiceUrl: string | null
  lines: Array<{
    id: string
    description: string | null
    amount: number
    currency: string
    quantity: number | null
    period: {
      start: number | null
      end: number | null
    }
  }>
}

export interface InvoiceHistoryData {
  invoices: Invoice[]
  hasMore: boolean
  totalCount: number
  pagination: {
    limit: number
    startingAfter: string | undefined
    lastInvoiceId: string | null
  }
  metadata: {
    accessedAt: string
    accessedBy: string
    organizationId: string
  }
}

export interface UseInvoiceHistoryResult {
  invoiceData: InvoiceHistoryData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  loadMore: () => Promise<void>
  canLoadMore: boolean
  
  // Filter and search
  fetchWithFilters: (filters: {
    status?: string
    limit?: number
    startingAfter?: string
  }) => Promise<void>
}

/**
 * Hook to manage organization invoice history
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export function useInvoiceHistory(): UseInvoiceHistoryResult {
  const { organizationContext, isAdmin, isOwner } = useOrganizationContext()
  const [invoiceData, setInvoiceData] = useState<InvoiceHistoryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user has billing permissions
  const hasBillingPermissions = isAdmin || isOwner

  const fetchInvoices = useCallback(async (filters: {
    status?: string
    limit?: number
    startingAfter?: string
  } = {}): Promise<void> => {
    if (!organizationContext || !hasBillingPermissions) {
      setIsLoading(false)
      setError(hasBillingPermissions ? null : 'Insufficient permissions to view invoices')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.startingAfter) params.append('starting_after', filters.startingAfter)
      if (filters.status) params.append('status', filters.status)

      const response = await fetch(`/api/organization/billing/invoices?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        if (response.status === 403) {
          throw new Error('You do not have permission to view invoice history')
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch invoice history')
      }

      setInvoiceData(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch invoice history:', err)
      setInvoiceData(null)
    } finally {
      setIsLoading(false)
    }
  }, [organizationContext, hasBillingPermissions])

  // Load more invoices (pagination)
  const loadMore = useCallback(async (): Promise<void> => {
    if (!invoiceData?.hasMore || !invoiceData.pagination.lastInvoiceId) return

    try {
      setError(null)

      const params = new URLSearchParams()
      params.append('limit', invoiceData.pagination.limit.toString())
      params.append('starting_after', invoiceData.pagination.lastInvoiceId)

      const response = await fetch(`/api/organization/billing/invoices?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load more invoices')
      }

      // Append new invoices to existing data
      setInvoiceData(prevData => {
        if (!prevData) return result.data

        return {
          ...result.data,
          invoices: [...prevData.invoices, ...result.data.invoices]
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to load more invoices:', err)
    }
  }, [invoiceData])

  // Fetch with specific filters
  const fetchWithFilters = useCallback(async (filters: {
    status?: string
    limit?: number
    startingAfter?: string
  }): Promise<void> => {
    await fetchInvoices(filters)
  }, [fetchInvoices])

  // Initial fetch
  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  return {
    invoiceData,
    isLoading,
    error,
    refetch: () => fetchInvoices(),
    loadMore,
    canLoadMore: !!invoiceData?.hasMore,
    fetchWithFilters,
  }
}