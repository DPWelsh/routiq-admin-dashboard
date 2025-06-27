"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Play, 
  RefreshCw, 
  Clock, 
  Users, 
  Calendar, 
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { RoutiqAPI, type DashboardResponse } from '@/lib/routiq-api'
import { formatDistanceToNow } from 'date-fns'

interface SyncDashboardProps {
  organizationId?: string
}

export function SyncDashboard({ organizationId: propOrgId }: SyncDashboardProps) {
  const { organization } = useOrganization()
  const queryClient = useQueryClient()
  const orgId = propOrgId || organization?.id
  
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([])

  // Single API call to get all dashboard data
  const getDashboardData = useCallback(async (): Promise<DashboardResponse | null> => {
    if (!orgId) return null
    
    const response = await fetch(`/api/dashboard/${orgId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.status}`)
    }
    
    return await response.json()
  }, [orgId])

  // Main dashboard data query
  const { 
    data: dashboardData, 
    isLoading: isDashboardLoading, 
    refetch: refetchDashboard, 
    error: dashboardError 
  } = useQuery({
    queryKey: ['dashboard-unified', orgId],
    queryFn: getDashboardData,
    enabled: !!orgId,
    refetchInterval: activeSyncId ? 5000 : 30000,
    staleTime: 10000,
  })

  // Extract data from unified response
  const summary = dashboardData?.summary
  const recentActivity = dashboardData?.recent_activity || []
  
  // Check if we have an active sync
  useEffect(() => {
    if (!recentActivity.length) return
    
    const runningSyncs = recentActivity.filter(activity => activity.status === 'running')
    if (runningSyncs.length > 0 && !activeSyncId) {
      setActiveSyncId(runningSyncs[0].id)
      addSyncLog('info', `Found active sync: ${runningSyncs[0].id}`)
    } else if (runningSyncs.length === 0 && activeSyncId) {
      addSyncLog('success', `Sync completed`)
      setActiveSyncId(null)
    }
  }, [recentActivity, activeSyncId])

  // Sync logging
  const addSyncLog = useCallback((level: string, message: string) => {
    const timestamp = new Date().toISOString()
    const logEntry = { timestamp, level, message }
    
    const emoji = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`${emoji} [SYNC] ${timestamp} - ${message}`)
    
    setLogs(prev => [logEntry, ...prev.slice(0, 49)])
  }, [])

  // Start sync mutation
  const startSyncMutation = useMutation({
    mutationFn: async ({ organizationId }: { organizationId: string }) => {
      addSyncLog('info', 'Starting sync...')
      const authenticatedAPI = new RoutiqAPI(organizationId)
      return await authenticatedAPI.triggerClinikoSync(organizationId)
    },
    onSuccess: (data) => {
      const response = data as { message?: string };
      addSyncLog('success', `Sync started: ${response.message || 'Success'}`)
      setActiveSyncId('monitoring')
      
      // Refresh data after a delay
      setTimeout(() => {
        refetchDashboard()
      }, 2000)
    },
    onError: (error: Error) => {
      addSyncLog('error', `Failed to start sync: ${error.message}`)
    },
  })

  // Status helpers
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-500'
      case 'running': return 'bg-blue-500 animate-pulse'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'running': return <Loader2 className="h-4 w-4 animate-spin" />
      case 'failed': return <XCircle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  if (!orgId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Organization not found</p>
        </CardContent>
      </Card>
    )
  }

  if (dashboardError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>
              Error loading dashboard data: {dashboardError.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sync Dashboard</h2>
          <p className="text-muted-foreground">Real-time patient data synchronization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDashboard()}
            disabled={isDashboardLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!activeSyncId ? (
            <Button
              onClick={() => orgId && startSyncMutation.mutate({ organizationId: orgId })}
              disabled={startSyncMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {startSyncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Sync
                </>
              )}
            </Button>
          ) : (
            <Badge variant="secondary" className="px-3 py-1">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Sync in progress
            </Badge>
          )}
        </div>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Integration Status</span>
            <Badge variant={summary?.integration_status === 'Connected' ? "default" : "destructive"}>
              {summary?.integration_status || 'Unknown'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                summary?.integration_status === 'Connected' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="font-medium">Cliniko Practice Management</p>
                <p className="text-sm text-muted-foreground">
                  {summary?.integration_status === 'Connected' ? 'API configured and working' : 'Configuration required'}
                </p>
              </div>
            </div>
            {summary?.integration_status === 'Connected' && (
              <div className="text-right">
                <p className="text-sm font-medium">{summary.total_patients} Total Patients</p>
                <p className="text-sm text-muted-foreground">{summary.active_patients} Active Patients</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{summary?.total_patients || 0}</p>
                {summary?.last_sync_time && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDistanceToNow(new Date(summary.last_sync_time), { addSuffix: true })}
                  </p>
                )}
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Patients</p>
                <p className="text-2xl font-bold">{summary?.active_patients || 0}</p>
                {summary?.total_patients && summary.total_patients > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((summary.active_patients / summary.total_patients) * 100)}% of total
                  </p>
                )}
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming Appointments</p>
                <p className="text-2xl font-bold">{summary?.patients_with_upcoming || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {summary?.total_upcoming_appointments || 0} total appointments
                </p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recent Appointments</p>
                <p className="text-2xl font-bold">{summary?.patients_with_recent || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {summary?.total_recent_appointments || 0} total appointments
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(activity.status)}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{activity.description}</p>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(activity.status)}
                        <Badge variant="outline" className="text-xs">
                          {activity.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span>{activity.records_success}/{activity.records_processed} records processed</span>
                      {activity.completed_at && (
                        <span className="ml-4">
                          Completed {formatDistanceToNow(new Date(activity.completed_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`ml-2 ${
                    log.level === 'error' ? 'text-red-600' : 
                    log.level === 'success' ? 'text-green-600' : 
                    log.level === 'warning' ? 'text-yellow-600' : ''
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 