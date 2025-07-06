# Data Flow Architecture Guide

## 🏗️ Overview

This document explains how data flows from the backend Railway API to populate the dashboard frontend. The architecture uses a multi-layer approach with authentication, caching, error handling, and real-time updates.

## 📊 Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Dashboard     │    │   React Query    │    │   API Client    │    │   Next.js API    │
│   Components    │◄──►│   (Caching)      │◄──►│   (RoutiqAPI)   │◄──►│   Proxy Routes   │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
         ▲                       ▲                       ▲                       ▲
         │                       │                       │                       │
    UI Updates              Query Keys              Auth Headers            Clerk Middleware
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Loading &     │    │   Automatic      │    │   Retry Logic   │    │   Railway        │
│   Error States  │    │   Refetching     │    │   Rate Limiting │    │   Backend API    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
```

## 🔄 Data Flow Layers

### 1. Backend API (Railway)
**Base URL:** `https://routiq-backend-prod.up.railway.app`

### 2. Next.js API Proxy Routes
**Purpose:** CORS handling, authentication, request validation

### 3. RoutiqAPI Client
**Purpose:** Centralized API communication, auth headers, retry logic

### 4. React Query
**Purpose:** Caching, background updates, loading states

### 5. Dashboard Components
**Purpose:** UI rendering, user interactions

## 🚀 Implementation Details

### 1. Backend Endpoints

#### **Current Production Endpoints**
```typescript
// Unified dashboard data (recommended)
GET /api/v1/dashboard/{organizationId}

// Legacy sync endpoints  
POST /api/v1/clerk/sync
GET  /api/v1/clerk/status
GET  /api/v1/clerk/database-summary

// New consolidated sync
POST /api/v1/cliniko/sync/{organizationId}
GET  /api/v1/cliniko/sync-logs/{organizationId}
```

#### **Response Examples**

**Dashboard Data Response:**
```json
{
  "success": true,
  "organization_id": "org_2xwHiNrj68eaRUlX10anlXGvzX7",
  "summary": {
    "total_patients": 650,
    "active_patients": 37,
    "patients_with_upcoming": 23,
    "patients_with_recent": 32,
    "total_upcoming_appointments": 44,
    "total_recent_appointments": 67,
    "total_all_appointments": 292,
    "avg_upcoming_per_patient": 1.91,
    "avg_recent_per_patient": 2.09,
    "avg_total_per_patient": 4.57,
    "last_sync_time": "2024-12-27T11:32:22.000Z",
    "synced_patients": 650,
    "sync_percentage": 100,
    "integration_status": "Connected",
    "activity_status": "Active",
    "engagement_rate": 8.5,
    "generated_at": "2024-12-27T11:38:15.123Z"
  },
  "recent_activity": [
    {
      "id": "sync_123",
      "source_system": "cliniko",
      "operation_type": "full_patients",
      "status": "completed",
      "records_processed": 650,
      "records_success": 650,
      "records_failed": 0,
      "started_at": "2024-12-27T11:30:00.000Z",
      "completed_at": "2024-12-27T11:32:22.000Z",
      "activity_type": "sync",
      "description": "Comprehensive sync: 650 patients + appointments",
      "minutes_ago": 6
    }
  ],
  "timestamp": "2024-12-27T11:38:15.123Z"
}
```

### 2. Next.js API Proxy Routes

#### **Main Dashboard Route**
**File:** `src/app/api/dashboard/[organizationId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { RoutiqAPI } from '@/lib/routiq-api'

export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const { organizationId } = params
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    const api = new RoutiqAPI(organizationId)
    const dashboardData = await api.getDashboardData(organizationId)
    
    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

**Key Features:**
- ✅ Organization ID validation
- ✅ Error handling with details
- ✅ Direct backend communication via RoutiqAPI
- ✅ Clerk authentication (via middleware)

### 3. RoutiqAPI Client Class

#### **Core API Client**
**File:** `src/lib/routiq-api.ts`

```typescript
export class RoutiqAPI {
  private baseUrl: string = 'https://routiq-backend-prod.up.railway.app'
  private organizationId?: string

  constructor(organizationId?: string) {
    this.organizationId = organizationId
  }

  // Authentication headers with Clerk integration
  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      // Client-side: Use Clerk session token
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken()
        return {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...(this.organizationId && { 'x-organization-id': this.organizationId })
        }
      }
      
      // Server-side: Basic headers (middleware handles auth)
      return {
        'Content-Type': 'application/json',
        ...(this.organizationId && { 'x-organization-id': this.organizationId })
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error)
      return { 'Content-Type': 'application/json' }
    }
  }

  // Request method with retry logic and error handling
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}, 
    retries = 2
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const authHeaders = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: { ...authHeaders, ...options.headers },
          ...options
        })

        if (!response.ok) {
          const errorText = await response.text()
          
          // Handle rate limiting with exponential backoff
          if (response.status === 429 && attempt < retries) {
            const waitTime = Math.min(parseInt(
              response.headers.get('retry-after') || '30'
            ) * 1000, 60000)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
          
          // Retry database connection errors
          if (response.status === 500 && 
              errorText.includes('connection already closed') && 
              attempt < retries) {
            await new Promise(resolve => 
              setTimeout(resolve, 1000 * (attempt + 1))
            )
            continue
          }
          
          throw new Error(`API Error ${response.status}: ${errorText}`)
        }

        return response.json()
      } catch (error) {
        // Network error retry logic
        if (attempt < retries && (
          error instanceof TypeError || 
          String(error).includes('fetch')
        )) {
          await new Promise(resolve => 
            setTimeout(resolve, 1000 * (attempt + 1))
          )
          continue
        }
        throw error
      }
    }
    throw new Error('All retry attempts failed')
  }

  // Main dashboard data method
  async getDashboardData(organizationId: string): Promise<DashboardResponse> {
    return await this.request<DashboardResponse>(
      `/api/v1/dashboard/${organizationId}`
    )
  }
}
```

**Key Features:**
- ✅ Automatic Clerk authentication
- ✅ Retry logic with exponential backoff
- ✅ Rate limiting handling
- ✅ Network error recovery
- ✅ TypeScript type safety

### 4. React Query Integration

#### **Data Fetching Hook**
**File:** `src/components/dashboard/sync-dashboard.tsx`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function SyncDashboard() {
  const queryClient = useQueryClient()
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  
  // Single API call to get all dashboard data
  const getDashboardData = useCallback(async (): Promise<DashboardResponse | null> => {
    if (!selectedOrgId) return null
    
    const response = await fetch(`/api/dashboard/${selectedOrgId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.status}`)
    }
    
    return await response.json()
  }, [selectedOrgId])

  // Main dashboard data query with intelligent caching
  const { 
    data: dashboardData, 
    isLoading: isDashboardLoading, 
    refetch: refetchDashboard, 
    error: dashboardError 
  } = useQuery({
    queryKey: ['dashboard-unified', selectedOrgId],
    queryFn: getDashboardData,
    enabled: !!selectedOrgId,
    refetchInterval: activeSyncId ? 5000 : 30000,  // Fast refresh during sync
    staleTime: 10000,  // Consider data fresh for 10 seconds
  })

  // Extract data from unified response
  const summary = dashboardData?.summary
  const recentActivity = dashboardData?.recent_activity || []
}
```

**Query Configuration:**
- **Query Key:** `['dashboard-unified', organizationId]` - Unique per organization
- **Enabled:** Only when organization is selected
- **Refetch Interval:** 5s during active sync, 30s normally
- **Stale Time:** 10s to prevent unnecessary requests

#### **Sync Trigger Mutation**

```typescript
const startSyncMutation = useMutation({
  mutationFn: async ({ organizationId }: { organizationId: string }) => {
    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/cliniko/sync/${organizationId}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    )
    
    if (!response.ok) throw new Error(`Sync failed: ${response.status}`)
    return await response.json()
  },
  onSuccess: (data) => {
    // Trigger multiple refreshes to catch sync appearing
    setTimeout(() => refetchDashboard(), 1000)
    setTimeout(() => refetchDashboard(), 3000)
    setTimeout(() => refetchDashboard(), 5000)
  },
  onError: (error: Error) => {
    console.error('Sync failed:', error.message)
  },
})
```

### 5. Dashboard Component Data Consumption

#### **Unified Data Display**

```typescript
export function SyncDashboard() {
  // ... query setup above ...

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {isDashboardLoading && <LoadingSpinner />}
      
      {/* Error State */}
      {dashboardError && (
        <Alert>
          <AlertDescription>
            Error: {dashboardError.message}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Patient Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Patients
                </p>
                <p className="text-2xl font-bold">
                  {summary?.total_patients || 0}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {summary?.sync_percentage || 0}% synced
                  </Badge>
                  {summary?.last_sync_time && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(summary.last_sync_time), { 
                        addSuffix: true 
                      })}
                    </p>
                  )}
                </div>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        {/* More cards... */}
      </div>
      
      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} 
                     className={`flex items-center gap-3 p-3 border rounded-lg ${
                       activity.status === 'running' ? 'border-blue-200 bg-blue-50' : ''
                     }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    getStatusColor(activity.status)
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.records_success} / {activity.records_processed} processed
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                      {activity.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.minutes_ago} min ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

## 🔐 Authentication Flow

### 1. Clerk Middleware
**File:** `src/middleware.ts`

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId, orgRole } = await auth()
  
  // Inject organization headers for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const headers = new Headers(req.headers)
    headers.set('x-clerk-user-id', userId)
    if (orgId) {
      headers.set('x-clerk-org-id', orgId)
      headers.set('x-clerk-org-role', orgRole || '')
    }
    return NextResponse.next({ request: { headers } })
  }
})
```

### 2. Client-Side Token Flow

```typescript
// In RoutiqAPI.getAuthHeaders()
if (typeof window !== 'undefined' && window.Clerk?.session) {
  const token = await window.Clerk.session.getToken()
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}
```

### 3. Organization Context

```typescript
// Custom hook for organization management
import { useClerkOrganization } from '@/hooks/useClerkOrganization'

function Dashboard() {
  const { organizationId, organizationName, isAdmin } = useClerkOrganization()
  
  // Use organizationId for data fetching
  const { data } = useQuery({
    queryKey: ['dashboard', organizationId],
    queryFn: () => getDashboardData(organizationId),
    enabled: !!organizationId
  })
}
```

## 🔄 Real-Time Updates

### 1. Sync State Management

```typescript
const [activeSyncId, setActiveSyncId] = useState<string | null>(null)

// Detect active syncs from recent activity
useEffect(() => {
  const runningSyncs = recentActivity.filter(activity => 
    activity.status === 'running'
  )
  
  if (runningSyncs.length > 0) {
    setActiveSyncId(runningSyncs[0].id)
  } else if (activeSyncId) {
    setActiveSyncId(null) // Sync completed
  }
}, [recentActivity, activeSyncId])
```

### 2. Dynamic Refresh Rates

```typescript
const { data } = useQuery({
  queryKey: ['dashboard-unified', selectedOrgId],
  queryFn: getDashboardData,
  refetchInterval: activeSyncId ? 5000 : 30000,  // Faster during sync
  staleTime: 10000,
})
```

### 3. Manual Refresh Strategy

```typescript
// After starting sync, refresh multiple times to catch state changes
const startSync = () => {
  startSyncMutation.mutate({ organizationId })
  
  // Staggered refreshes to catch sync appearing in activity
  setTimeout(() => refetchDashboard(), 1000)
  setTimeout(() => refetchDashboard(), 3000)
  setTimeout(() => refetchDashboard(), 5000)
}
```

## ⚡ Performance Optimizations

### 1. Query Caching Strategy

```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes stale time
      cacheTime: 1000 * 60 * 30,   // 30 minutes cache time
      retry: 3,                    // Retry failed requests 3 times
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
  },
})
```

### 2. Request Deduplication

React Query automatically deduplicates identical requests made within a short time window.

### 3. Background Updates

```typescript
// Automatic background refetching
refetchInterval: activeSyncId ? 5000 : 30000
```

### 4. Optimistic Updates

```typescript
// For sync triggers - immediately show "starting" state
onMutate: () => {
  setActiveSyncId('monitoring')
  addSyncLog('info', 'Starting sync...')
}
```

## 🚨 Error Handling

### 1. API Client Level

```typescript
// Retry logic with exponential backoff
private async request<T>(endpoint: string, options: RequestInit = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // ... request logic ...
    } catch (error) {
      if (attempt < retries && shouldRetry(error)) {
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * (attempt + 1))
        )
        continue
      }
      throw error
    }
  }
}
```

### 2. React Query Level

```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['dashboard', orgId],
  queryFn: getDashboardData,
  retry: (failureCount, error) => {
    // Don't retry on 4xx errors
    if (error.message.includes('4')) return false
    return failureCount < 3
  },
  onError: (error) => {
    console.error('Dashboard query failed:', error)
    // Could trigger notification system here
  }
})
```

### 3. Component Level

```typescript
if (dashboardError) {
  return (
    <Card>
      <CardContent className="p-6">
        <Alert>
          <AlertDescription>
            Error loading dashboard: {dashboardError.message}
            <Button onClick={() => refetchDashboard()} className="ml-2">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
```

## 📝 TypeScript Integration

### 1. Response Type Definitions

```typescript
export interface DashboardResponse {
  success: boolean
  organization_id: string
  summary: {
    total_patients: number
    active_patients: number
    patients_with_upcoming: number
    patients_with_recent: number
    total_upcoming_appointments: number
    total_recent_appointments: number
    total_all_appointments: number
    avg_upcoming_per_patient: number
    avg_recent_per_patient: number
    avg_total_per_patient: number
    last_sync_time: string
    synced_patients: number
    sync_percentage: number
    integration_status: string
    activity_status: string
    engagement_rate: number
    generated_at: string
  }
  recent_activity: Array<{
    id: string
    source_system: string
    operation_type: string
    status: string
    records_processed: number
    records_success: number
    records_failed: number
    started_at: string
    completed_at: string | null
    activity_type: string
    description: string
    minutes_ago: number
  }>
  timestamp: string
}
```

### 2. API Client Types

```typescript
export class RoutiqAPI {
  async getDashboardData(organizationId: string): Promise<DashboardResponse> {
    return await this.request<DashboardResponse>(`/api/v1/dashboard/${organizationId}`)
  }
}
```

### 3. Component Props Types

```typescript
interface SyncDashboardProps {
  organizationId?: string
}

export function SyncDashboard({ organizationId }: SyncDashboardProps) {
  // Component implementation
}
```

## 🔧 Development Tools

### 1. API Testing

```typescript
// Test all endpoints
const api = new RoutiqAPI('org_2xwHiNrj68eaRUlX10anlXGvzX7')

// Test dashboard data
const dashboard = await api.getDashboardData('org_2xwHiNrj68eaRUlX10anlXGvzX7')
console.log('Dashboard data:', dashboard)

// Test sync trigger
const sync = await api.triggerClinikoSync('org_2xwHiNrj68eaRUlX10anlXGvzX7')
console.log('Sync started:', sync)
```

### 2. React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export default function App() {
  return (
    <QueryClient>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClient>
  )
}
```

### 3. Debug Logging

```typescript
// In RoutiqAPI
console.log(`🔍 API Request: ${method} ${endpoint}`)
console.log(`📊 Response:`, data)
console.log(`⚠️ Error:`, error)

// In components
console.log(`🔄 Query state:`, { isLoading, error, data: !!data })
```

## 🎯 Best Practices

### 1. **Single Source of Truth**
- Use unified `/api/v1/dashboard/{organizationId}` endpoint
- Avoid multiple API calls for same data

### 2. **Smart Caching**
- Cache data for 10-30 seconds to reduce API calls
- Faster refresh during active operations

### 3. **Error Recovery**
- Implement retry logic with exponential backoff
- Provide user-friendly error messages
- Allow manual retry actions

### 4. **Loading States**
- Show loading indicators for better UX
- Use skeleton loaders for content areas
- Differentiate between initial load and refresh

### 5. **Organization Context**
- Always include organization ID in requests
- Validate organization access via Clerk
- Clear state when switching organizations

### 6. **Real-Time Updates**
- Use polling during active operations
- Implement optimistic updates for immediate feedback
- Show progress indicators for long-running operations

---

This architecture provides a robust, scalable foundation for healthcare dashboard applications with real-time data synchronization and comprehensive error handling. 