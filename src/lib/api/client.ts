/**
 * Production-grade API Client
 * Uses Next.js API routes as proxies to avoid CORS issues
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface ApiOptions extends RequestInit {
  timeout?: number
}

class ApiClient {
  private baseUrl: string
  private defaultTimeout: number

  constructor(baseUrl: string = '/api', defaultTimeout: number = 30000) {
    this.baseUrl = baseUrl
    this.defaultTimeout = defaultTimeout
  }

  private async request<T>(
    endpoint: string, 
    options: ApiOptions = {}
  ): Promise<T> {
    const { timeout = this.defaultTimeout, ...fetchOptions } = options
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      
      throw error
    }
  }

  // Active Patients API
  async getActivePatients(params?: {
    filter?: string
    limit?: number
    page?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.filter) searchParams.set('filter', params.filter)
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.page) searchParams.set('page', params.page.toString())
    
    const queryString = searchParams.toString()
    const endpoint = `/active-patients${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  async getActivePatientById(id: string) {
    return this.request(`/active-patients/${id}`)
  }

  async getActivePatientStats(params?: {
    period?: string
    includeInactive?: boolean
  }) {
    const searchParams = new URLSearchParams()
    if (params?.period) searchParams.set('period', params.period)
    if (params?.includeInactive) searchParams.set('includeInactive', 'true')
    
    const queryString = searchParams.toString()
    const endpoint = `/active-patients/stats${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  // Conversations API
  async getConversations(params?: {
    page?: number
    limit?: number
    filter?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.filter) searchParams.set('filter', params.filter)
    
    const queryString = searchParams.toString()
    const endpoint = `/conversations${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  async getConversationStats() {
    return this.request('/conversations/stats')
  }

  // Health check
  async healthCheck() {
    return this.request('/health')
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Export types
export interface ActivePatient {
  id: number
  clinikoPatientId: string
  name: string
  email: string
  phone: string
  recentAppointmentCount: number
  upcomingAppointmentCount: number
  totalAppointmentCount: number
  lastAppointmentDate: string | null
  churnRisk: 'high' | 'medium' | 'low'
  rebookingPriority: 'high' | 'medium' | 'low'
  segment: 'active' | 'inactive' | 'at_risk' | 'dormant' | 'churned'
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  timestamp?: string
} 