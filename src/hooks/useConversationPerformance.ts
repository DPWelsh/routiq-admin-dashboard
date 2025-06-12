import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

interface ConversationPerformanceData {
  id: string
  routiqConversationId?: string
  chatwootConversationId?: number
  conversationSource: string
  patientName?: string
  patientPhone?: string
  assignedAgentId?: string
  agentName?: string
  botHandled: boolean
  status: string
  firstResponseTimeSeconds?: number
  avgResponseTimeSeconds?: number
  resolutionTimeSeconds?: number
  satisfactionScore?: number
  satisfactionFeedback?: string
  sentimentScore?: number
  slaTarget: number
  slaMet?: boolean
  issueCategory?: string
  businessOutcome?: string
  revenueImpact?: number
  overallPerformanceScore?: number
  createdAt: Date
  updatedAt: Date
}

interface PerformanceHookResult {
  performance: ConversationPerformanceData | null
  loading: boolean
  error: string | null
  updatePerformance: (updates: Record<string, unknown>) => Promise<boolean>
  submitRating: (rating: 1 | 2 | 3 | 4 | 5, feedback?: string) => Promise<boolean>
}

export function useConversationPerformance(
  routiqConversationId?: string,
  chatwootConversationId?: number
): PerformanceHookResult {
  const { getToken } = useAuth()
  const [performance, setPerformance] = useState<ConversationPerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch performance data
  useEffect(() => {
    if (!routiqConversationId && !chatwootConversationId) {
      setLoading(false)
      return
    }

    fetchPerformance()
  }, [routiqConversationId, chatwootConversationId])

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = await getToken()
      const params = new URLSearchParams({
        limit: '1',
        analytics: 'false',
        agentStats: 'false'
      })

      if (routiqConversationId) {
        params.set('routiqConversationId', routiqConversationId)
      }
      if (chatwootConversationId) {
        params.set('chatwootConversationId', chatwootConversationId.toString())
      }

      const response = await fetch(`/api/conversations/performance?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch performance: ${response.statusText}`)
      }

      const data = await response.json()
      
      console.log('🔍 Debug performance API response:', {
        success: data.success,
        conversationsLength: data.conversations?.length,
        firstConversation: data.conversations?.[0],
        satisfactionScore: data.conversations?.[0]?.satisfactionScore,
        satisfactionFeedback: data.conversations?.[0]?.satisfactionFeedback,
        satisfaction_feedback: data.conversations?.[0]?.satisfaction_feedback,
        rawFirstConversation: JSON.stringify(data.conversations?.[0], null, 2),
        allFields: data.conversations?.[0] ? Object.keys(data.conversations[0]) : null
      })
      
      if (data.success && data.conversations.length > 0) {
        console.log('🔍 Setting performance data:', data.conversations[0])
        setPerformance(data.conversations[0])
      } else {
        // No performance record exists yet
        console.log('🔍 No performance data found, setting to null')
        setPerformance(null)
      }
    } catch (err) {
      console.error('Error fetching performance:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const updatePerformance = async (updates: Record<string, unknown>): Promise<boolean> => {
    try {
      const token = await getToken()
      
      const payload = {
        routiqConversationId,
        chatwootConversationId,
        ...updates
      }

      console.log('🔄 Sending performance update:', {
        url: '/api/conversations/performance',
        method: 'POST',
        payload,
        routiqConversationId,
        chatwootConversationId
      })

      const response = await fetch('/api/conversations/performance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      console.log('📡 Performance API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error details:', errorText)
        throw new Error(`Failed to update performance: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setPerformance(data.data)
        return true
      }
      return false
    } catch (err) {
      console.error('Error updating performance:', err)
      setError(err instanceof Error ? err.message : 'Update failed')
      return false
    }
  }

  const submitRating = async (rating: 1 | 2 | 3 | 4 | 5, feedback?: string): Promise<boolean> => {
    const updates: Record<string, unknown> = {
      satisfaction_score: rating
    }

    // Set status based on rating if not already set
    if (!performance?.status || performance.status === 'active') {
      updates.status = 'resolved'
    }

    // Add feedback if provided
    if (feedback) {
      updates.satisfaction_feedback = feedback
    }

    return updatePerformance(updates)
  }

  return {
    performance,
    loading,
    error,
    updatePerformance,
    submitRating
  }
} 