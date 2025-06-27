"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Play, 
  Square, 
  RefreshCw, 
  Clock, 
  Users, 
  Calendar, 
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react'
import { api, RoutiqAPI, type DashboardResponse } from '@/lib/routiq-api'
import { formatDistanceToNow } from 'date-fns'
import { type ServiceConfig, type ClinikoConnectionTest } from '@/lib/routiq-api'

// Local interface to handle the actual API response format
interface PatientsApiResponse {
  organization_id: string;
  total_active_patients: number;
  patients_with_recent_appointments?: number;
  patients_with_upcoming_appointments?: number;
  last_sync_date?: string | null;
  avg_recent_appointments?: number;
  avg_upcoming_appointments?: number;
  avg_total_appointments?: number;
  timestamp: string;
}

interface SyncDashboardProps {
  organizationId?: string
}

export function SyncDashboard({ organizationId: propOrgId }: SyncDashboardProps) {
  const { organization } = useOrganization()
  const queryClient = useQueryClient()
  const orgId = propOrgId || organization?.id
  
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([])
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig | null>(null)
  const [connectionTest, setConnectionTest] = useState<ClinikoConnectionTest | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [syncMode, setSyncMode] = useState<'full' | 'incremental' | 'quick'>('full')

  // Single API call to get all dashboard data
  const getDashboardData = useCallback(async (): Promise<DashboardResponse | null> => {
    if (!orgId) return null
    
    const response = await fetch(`/api/dashboard/${orgId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.status}`)
    }
    
    return await response.json()
  }, [orgId])

  // Main dashboard data query - replaces all previous separate queries
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
    retry: (failureCount, error) => {
      if (error?.message?.includes('404') || error?.message?.includes('429')) return false;
      return failureCount < 2;
    }
  })

  // Extract data from unified response
  const summary = dashboardData?.summary
  const recentActivity = dashboardData?.recent_activity || []
  
  // Computed values based on unified dashboard data
  const clinikoConnected = summary?.integration_status === 'Connected'
  const effectivePatientStats = {
    total_patients: summary?.total_patients || 0,
    active_patients: summary?.active_patients || 0,
    patients_with_upcoming_appointments: summary?.patients_with_upcoming || 0,
    patients_with_recent_appointments: summary?.patients_with_recent || 0,
    last_sync_time: summary?.last_sync_time || null,
    last_sync_date: summary?.last_sync_time || null,
  }
  
  // Legacy compatibility object for existing code
  const clinikoStatus = {
    total_patients: summary?.total_patients || 0,
    active_patients: summary?.active_patients || 0,
    sync_percentage: summary?.sync_percentage || 0,
    integration_status: summary?.integration_status || 'Not Connected',
  }
  
  const patientsSummary = {
    total_active_patients: summary?.active_patients || 0,
    patients_with_upcoming_appointments: summary?.patients_with_upcoming || 0,
    patients_with_recent_appointments: summary?.patients_with_recent || 0,
    last_sync_date: summary?.last_sync_time || null,
  }
  
  // Process recent activity to find active syncs
  useEffect(() => {
    if (!recentActivity.length) return
    
    // Check if there's a currently running sync
    const runningSyncs = recentActivity.filter(activity => activity.status === 'running')
    if (runningSyncs.length > 0 && !activeSyncId) {
      setActiveSyncId(runningSyncs[0].id)
      addSyncLog('info', `Found active sync: ${runningSyncs[0].id}`)
    } else if (runningSyncs.length === 0 && activeSyncId) {
      addSyncLog('success', `Sync ${activeSyncId} completed`)
      setActiveSyncId(null)
    }
  }, [recentActivity, activeSyncId])

  // Dedicated sync logger
  const addSyncLog = useCallback((level: string, message: string, syncId?: string) => {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message: syncId ? `[${syncId}] ${message}` : message
    }
    
    const emoji = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`${emoji} [SYNC] ${timestamp} - ${logEntry.message}`)
    
    setLogs(prev => [logEntry, ...prev.slice(0, 49)])
  }, [])

  // Legacy sync functions for mutations (keep only essential ones)
  const getSyncProgress = useCallback(async () => {
    if (!activeSyncId || !orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getSyncProgress(activeSyncId)
  }, [activeSyncId, orgId])

  // Query for current sync progress (only when there's an active sync)
  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: ['sync-progress', activeSyncId, orgId],
    queryFn: getSyncProgress,
    enabled: !!activeSyncId && !!orgId && activeSyncId !== 'monitoring',
    refetchInterval: activeSyncId && activeSyncId !== 'monitoring' ? 2000 : false,
  })

  // Enhanced refresh function
  const forceRefresh = useCallback(() => {
    addSyncLog('info', 'Force refreshing dashboard data...')
    
    queryClient.removeQueries({ queryKey: ['dashboard-unified'] })
    
    refetchDashboard()
      .then(() => {
        addSyncLog('success', 'Dashboard data refresh completed')
      })
      .catch((error) => {
        addSyncLog('error', `Dashboard data refresh failed: ${error}`)
      })
  }, [queryClient, refetchDashboard, addSyncLog])

  // Clear stale activeSyncId when no running syncs are found
  useEffect(() => {
    if (dashboardData && recentActivity.length > 0) {
      const hasRunningSyncs = recentActivity.some(activity => activity.status === 'running')
      if (!hasRunningSyncs && activeSyncId) {
        addSyncLog('info', 'Clearing stale sync state - no running syncs found', activeSyncId)
        setActiveSyncId(null)
      }
    }
  }, [dashboardData, recentActivity, activeSyncId, addSyncLog])

  // Backend team's recommended sync approach - ALL patients sync
  const startSyncMutation = useMutation({
    mutationFn: async ({ organizationId }: { organizationId: string }) => {
      addSyncLog('info', 'Starting ALL patients sync (using new simplified endpoint)...')
      const authenticatedAPI = new RoutiqAPI(organizationId)
      // Use the new simplified sync endpoint
      return await authenticatedAPI.triggerClinikoSync(organizationId)
    },
    onSuccess: (data) => {
      const response = data as any;
      addSyncLog('success', `✅ ${response.message || 'Sync started successfully'}`)
      addSyncLog('info', '🔄 Real-time monitoring started')
      setActiveSyncId('monitoring') // Use monitoring state instead of actual sync_id
      
      // Start monitoring for completion
      startSyncMonitoring()
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addSyncLog('error', `❌ Failed to start sync: ${errorMessage}`)
    },
  })

  // Backend team's monitoring pattern implementation
  const startSyncMonitoring = async () => {
    if (!orgId) return
    
    try {
      const authenticatedAPI = new RoutiqAPI(orgId)
      const result = await authenticatedAPI.monitorSyncProgress(orgId, 300000) // 5 minutes timeout
      
      if (result.status === 'completed') {
        addSyncLog('success', `✅ Sync completed! ${result.recordsSuccess}/${result.recordsProcessed} patients synced (${result.successRate.toFixed(1)}% success rate)`)
        if (result.metadata.patients_found) {
          addSyncLog('info', `📊 Total patients processed: ${result.metadata.patients_found}`)
        }
      } else if (result.status === 'failed') {
        addSyncLog('error', `❌ Sync failed after processing ${result.recordsProcessed} patients`)
        if (result.metadata.errors) {
          result.metadata.errors.forEach((error: string) => addSyncLog('error', `Error: ${error}`))
        }
      } else if (result.status === 'timeout') {
        addSyncLog('warning', '⏰ Sync monitoring timeout - sync may still be running')
      }
      
      cleanup()
      
    } catch (error: unknown) {
      addSyncLog('error', `❌ Monitoring failed: ${error}`)
      cleanup()
    }
  }

  // Mutation to cancel sync
  const cancelSyncMutation = useMutation({
    mutationFn: async (syncId: string) => {
      if (!orgId) throw new Error('No organization ID')
      const authenticatedAPI = new RoutiqAPI(orgId)
      return await authenticatedAPI.cancelSync(syncId)
    },
    onSuccess: () => {
      addSyncLog('warning', 'Sync cancelled', activeSyncId || undefined)
      cleanup()
    },
    onError: (error: Error) => {
      addSyncLog('error', `Failed to cancel sync: ${error}`, activeSyncId || undefined)
    },
  })

  const cleanup = useCallback(() => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
    }
    setActiveSyncId(null)
    
    // Add a small delay to ensure backend has processed the completion
    setTimeout(() => {
      refetchDashboard()
      queryClient.invalidateQueries({ queryKey: ['dashboard-unified'] })
    }, 2000)
  }, [eventSource, refetchDashboard, queryClient])

  // Cleanup on unmount or sync completion
  useEffect(() => {
    if (progressData?.status === 'completed' || progressData?.status === 'failed') {
      if (progressData.status === 'completed') {
        addSyncLog('success', `Sync completed - ${progressData.active_patients_stored} patients stored`, activeSyncId || undefined)
      } else {
        const errorDetails = progressData.errors && progressData.errors.length > 0 
          ? ` - ${progressData.errors.join(', ')}` 
          : ''
        addSyncLog('error', `Sync failed${errorDetails}`, activeSyncId || undefined)
      }
      cleanup()
    }
  }, [progressData?.status, progressData?.active_patients_stored, progressData?.errors, addSyncLog, cleanup, activeSyncId])

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [eventSource])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'idle': return 'bg-gray-500'
      default: return 'bg-blue-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <XCircle className="h-4 w-4" />
      case 'idle': return <Clock className="h-4 w-4" />
      default: return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  // Check service configuration on component mount (silently for Railway testing)
  useEffect(() => {
    if (!orgId) return;
    
    const checkServiceConfig = async () => {
      try {
        const authenticatedAPI = new RoutiqAPI(orgId)
        const config = await authenticatedAPI.getServiceConfig(orgId)
        setServiceConfig(config)
        
        // If Cliniko is configured, test the connection
        if (config.available_integrations?.includes('cliniko')) {
          setIsTestingConnection(true)
          const test = await authenticatedAPI.testClinikoConnection(orgId)
          setConnectionTest(test)
          setIsTestingConnection(false)
        }
      } catch (error) {
        // Service config failures are expected during Railway backend testing
      }
    }

    checkServiceConfig()
  }, [orgId])

  // Debug logging when data changes
  useEffect(() => {
    if (summary) {
      console.log('✅ Dashboard data updated:', summary);
    }
    if (dashboardError) {
      console.log('❌ Dashboard endpoint error:', dashboardError);
    }
  }, [summary, dashboardError]);

  if (!orgId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Organization not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sync Dashboard</h2>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">Real-time patient data synchronization</p>
            {dataUpdatedAt && (
              <Badge variant="outline" className="text-xs">
                Data updated: {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchDashboard()
              refetchHistory()
              refetchStatus()
              refetchPatients()
              queryClient.invalidateQueries({ queryKey: ['sync-dashboard'] })
              queryClient.invalidateQueries({ queryKey: ['sync-history'] })
              queryClient.invalidateQueries({ queryKey: ['patients-summary'] })
              queryClient.invalidateQueries({ queryKey: ['cliniko-status'] })
              queryClient.invalidateQueries({ queryKey: ['sync-logs'] })
              addSyncLog('info', 'Manual refresh triggered')
            }}
            disabled={isDashboardLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={forceRefresh}
            disabled={isDashboardLoading}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Force Refresh
          </Button>
          {activeSyncId && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  if (!orgId || !activeSyncId) return
                  const authenticatedAPI = new RoutiqAPI(orgId)
                  const status = await authenticatedAPI.getSyncProgress(activeSyncId)
                  addSyncLog('info', `Debug - Status: ${status.status}, Progress: ${status.progress_percentage}%, Errors: ${status.errors?.length || 0}`, activeSyncId)
                  if (status.errors && status.errors.length > 0) {
                    status.errors.forEach((error: string) => addSyncLog('error', `Error detail: ${error}`, activeSyncId))
                  }
                } catch (error: unknown) {
                  addSyncLog('error', `Debug failed: ${error}`, activeSyncId)
                }
              }}
            >
              Debug Status
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                if (!orgId) return
                const authenticatedAPI = new RoutiqAPI(orgId)
                const data = await authenticatedAPI.getServiceConfig(orgId)
                addSyncLog('info', `Services configured: ${JSON.stringify(data.services)}`)
              } catch (error) {
                addSyncLog('error', `Service check error: ${error}`)
              }
            }}
          >
            Check Services
          </Button>
          {activeSyncId ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelSyncMutation.mutate(activeSyncId)}
              disabled={cancelSyncMutation.isPending}
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel Sync
            </Button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-blue-900">Backend Team&apos;s Recommended Sync:</span>
                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">ALL Patients</Badge>
              </div>
              <div className="text-xs text-blue-700 mb-3">
                ✅ Syncs ALL patients (not just active) from Cliniko<br/>
                ✅ Real-time progress monitoring every 2 seconds<br/>
                ✅ Enhanced error handling and logging
              </div>
              <Button
                onClick={() => orgId && startSyncMutation.mutate({ organizationId: orgId })}
                disabled={startSyncMutation.isPending || activeSyncId !== null}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {startSyncMutation.isPending || activeSyncId ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting Sync...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start ALL Patients Sync
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Integration Status</span>
            <Badge variant={clinikoConnected ? "default" : "destructive"}>
              {clinikoConnected ? "Connected" : "Not configured"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${clinikoConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="font-medium">Cliniko Practice Management</p>
                  <p className="text-sm text-muted-foreground">
                    {clinikoConnected ? 'API configured and working' : 'Configuration required'}
                  </p>
                </div>
              </div>
              {clinikoConnected && (
                <div className="text-right">
                  <p className="text-sm font-medium">{clinikoStatus?.total_patients || 0} Total Patients</p>
                  <p className="text-sm text-muted-foreground">{clinikoStatus?.active_patients || 0} Active Patients</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{effectivePatientStats.total_patients}</p>
                {effectivePatientStats.last_sync_time && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDistanceToNow(new Date(effectivePatientStats.last_sync_time), { addSuffix: true })}
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
                <p className="text-2xl font-bold">{effectivePatientStats.active_patients}</p>
                {effectivePatientStats.total_patients > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((effectivePatientStats.active_patients / effectivePatientStats.total_patients) * 100)}% of total
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
                <p className="text-sm font-medium text-muted-foreground">With Upcoming</p>
                <p className="text-2xl font-bold">{effectivePatientStats.patients_with_upcoming}</p>
                {effectivePatientStats.active_patients > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((effectivePatientStats.patients_with_upcoming / effectivePatientStats.active_patients) * 100)}% of active
                  </p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">With Recent</p>
                <p className="text-2xl font-bold">{effectivePatientStats.patients_with_recent}</p>
                {effectivePatientStats.active_patients > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((effectivePatientStats.patients_with_recent / effectivePatientStats.active_patients) * 100)}% of active
                  </p>
                )}
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Sync Status */}
      {dashboardData?.current_sync && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Sync Progress</span>
              <Badge variant="secondary" className="text-xs">
                {dashboardData.current_sync.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {dashboardData.current_sync.current_step}
                  </span>
                  <span className="font-mono text-lg">{dashboardData.current_sync.progress_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData.current_sync.progress_percentage}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-muted-foreground">👥 Patients Found</div>
                  <div className="text-2xl font-bold text-blue-600">{dashboardData.current_sync.patients_found || 0}</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-muted-foreground">📅 Appointments</div>
                  <div className="text-2xl font-bold text-green-600">{dashboardData.current_sync.appointments_found || 0}</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-muted-foreground">✅ Active Identified</div>
                  <div className="text-2xl font-bold text-orange-600">{dashboardData.current_sync.active_patients_identified || 0}</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-muted-foreground">💾 Stored</div>
                  <div className="text-2xl font-bold text-purple-600">{dashboardData.current_sync.active_patients_stored || 0}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      {historyData && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{historyData.total_syncs}</div>
                <div className="text-sm text-muted-foreground">Total Syncs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{historyData.successful_syncs}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {historyData.total_syncs > 0 ? Math.round((historyData.successful_syncs / historyData.total_syncs) * 100) : 0}% success rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{historyData.failed_syncs}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {historyData.average_sync_duration_seconds 
                    ? Math.round(historyData.average_sync_duration_seconds / 60) 
                    : 0}m
                </div>
                <div className="text-sm text-muted-foreground">Avg Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {historyData.last_sync_at 
                    ? formatDistanceToNow(new Date(historyData.last_sync_at), { addSuffix: true }).replace(' ago', '')
                    : 'Never'
                  }
                </div>
                <div className="text-sm text-muted-foreground">Last Sync</div>
              </div>
            </div>

            {historyData.recent_syncs && historyData.recent_syncs.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Recent Sync History</h4>
                <div className="space-y-2">
                  {historyData.recent_syncs.slice(0, 5).map((sync, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(sync.status)}
                        <div>
                          <div className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(sync.started_at), { addSuffix: true })}
                          </div>
                          {sync.duration_seconds && (
                            <div className="text-xs text-muted-foreground">
                              Duration: {Math.round(sync.duration_seconds / 60)}m {sync.duration_seconds % 60}s
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={sync.status === 'completed' ? 'default' : sync.status === 'failed' ? 'destructive' : 'secondary'}>
                          {sync.status}
                        </Badge>
                        {sync.patients_processed && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {sync.patients_processed} patients
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Real-time Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Live Activity Log</span>
            <Badge variant="outline" className="text-xs">
              {activeSyncId ? 'Monitoring Active' : 'Idle'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sync activities yet. Start a sync to see real-time progress.
              </p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={`text-xs p-2 rounded border-l-2 ${
                    log.level === 'error' ? 'border-red-500 bg-red-50' :
                    log.level === 'success' ? 'border-green-500 bg-green-50' :
                    log.level === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{log.message}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 