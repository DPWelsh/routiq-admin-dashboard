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
import { api, RoutiqAPI } from '@/lib/routiq-api'
import { formatDistanceToNow } from 'date-fns'
import { type ServiceConfig, type ClinikoConnectionTest } from '@/lib/routiq-api'

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

  // Create stable API functions - using authenticated Railway backend endpoints
  const getSyncDashboard = useCallback(async () => {
    if (!orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getNewSyncDashboard(orgId)
  }, [orgId])

  const getSyncHistory = useCallback(async () => {
    if (!orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getSyncHistory(orgId, 10)
  }, [orgId])

  const getClinikoStatus = useCallback(async () => {
    if (!orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getClinikoStatus(orgId)
  }, [orgId])

  const getActivePatientsummary = useCallback(async () => {
    if (!orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getActivePatientsummary(orgId)
  }, [orgId])

  const getSyncProgress = useCallback(async () => {
    if (!activeSyncId || !orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getSyncProgress(activeSyncId)
  }, [activeSyncId, orgId])

  const getSyncLogs = useCallback(async () => {
    if (!orgId) return null
    const authenticatedAPI = new RoutiqAPI(orgId)
    return await authenticatedAPI.getSyncLogs(orgId, 1)
  }, [orgId])

  // Query for sync dashboard data (Railway backend authenticated endpoint)
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard, dataUpdatedAt } = useQuery({
    queryKey: ['sync-dashboard', orgId],
    queryFn: getSyncDashboard,
    enabled: !!orgId,
    refetchInterval: activeSyncId ? 5000 : 30000, // Reduced frequency to avoid rate limits
    staleTime: 10000,
    retry: (failureCount, error) => {
      // Don't retry on 404 or 429 (rate limit)
      if (error?.message?.includes('404') || error?.message?.includes('429')) return false;
      return failureCount < 2;
    }
  })

  // Query for sync history (Railway backend authenticated endpoint)
  const { data: historyData, refetch: refetchHistory, dataUpdatedAt: historyUpdatedAt } = useQuery({
    queryKey: ['sync-history', orgId],
    queryFn: getSyncHistory,
    enabled: !!orgId,
    staleTime: 30000,
    refetchInterval: 60000, // Reduced frequency - history doesn't change often
    retry: (failureCount, error) => {
      if (error?.message?.includes('404') || error?.message?.includes('429')) return false;
      return failureCount < 2;
    }
  })

  // Query for Cliniko status (supplementary data)
  const { data: clinikoStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['cliniko-status', orgId],
    queryFn: getClinikoStatus,
    enabled: !!orgId,
    refetchInterval: 60000, // Reduced frequency
    staleTime: 30000,
    retry: (failureCount, error) => {
      if (error?.message?.includes('404') || error?.message?.includes('429')) return false;
      return failureCount < 2;
    }
  })

  // Query for active patients summary (supplementary data)
  const { data: patientsSummary, refetch: refetchPatients } = useQuery({
    queryKey: ['patients-summary', orgId],
    queryFn: getActivePatientsummary,
    enabled: !!orgId,
    staleTime: 30000,
    refetchInterval: 60000, // Reduced frequency
    retry: (failureCount, error) => {
      if (error?.message?.includes('404') || error?.message?.includes('429')) return false;
      return failureCount < 2;
    }
  })

  // Query for current sync progress
  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: ['sync-progress', activeSyncId, orgId],
    queryFn: getSyncProgress,
    enabled: !!activeSyncId && !!orgId,
    refetchInterval: activeSyncId ? 2000 : false, // Backend team recommends 2-3 seconds
  })

  // Dedicated sync logger - only logs sync-related events
  const addSyncLog = useCallback((level: string, message: string, syncId?: string) => {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message: syncId ? `[${syncId}] ${message}` : message
    }
    
    // Console logging for sync events only
    const emoji = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`${emoji} [SYNC] ${timestamp} - ${logEntry.message}`)
    
    setLogs(prev => [logEntry, ...prev.slice(0, 49)])
  }, [])

  // Enhanced sync-logs monitoring (backend team recommendation)
  const { data: syncLogsData } = useQuery({
    queryKey: ['sync-logs', orgId, activeSyncId],
    queryFn: getSyncLogs,
    enabled: !!activeSyncId && !!orgId,
    refetchInterval: activeSyncId ? 2000 : false,
  })

  // Process sync logs for enhanced activity feed
  useEffect(() => {
    if (!syncLogsData?.logs?.[0] || !activeSyncId) return
    
    const latestLog = syncLogsData.logs[0]
    if (latestLog.status === 'running' && latestLog.metadata) {
      try {
        const metadata = typeof latestLog.metadata === 'string' 
          ? JSON.parse(latestLog.metadata) 
          : latestLog.metadata || {}
        
        // Enhanced activity logging with metadata
        if (metadata.current_step) {
          addSyncLog('info', `📋 ${metadata.current_step}`, activeSyncId)
        }
        
        if (metadata.patients_processed && metadata.patients_found) {
          const percentage = Math.round((metadata.patients_processed / metadata.patients_found) * 100)
          addSyncLog('info', `💾 Storing patients: ${metadata.patients_processed}/${metadata.patients_found} (${percentage}%)`, activeSyncId)
        }
        
        if (metadata.patients_found) {
          addSyncLog('info', `👥 Found ${metadata.patients_found} patients to process`, activeSyncId)
        }
      } catch (error) {
        // Metadata parsing failed, continue with basic progress
      }
    }
  }, [syncLogsData, activeSyncId, addSyncLog])

  // Enhanced refresh function
  const forceRefresh = useCallback(() => {
    addSyncLog('info', 'Force refreshing sync data...')
    
    queryClient.removeQueries({ queryKey: ['sync-dashboard'] })
    queryClient.removeQueries({ queryKey: ['sync-history'] })
    queryClient.removeQueries({ queryKey: ['cliniko-status'] })
    queryClient.removeQueries({ queryKey: ['patients-summary'] })
    queryClient.removeQueries({ queryKey: ['sync-logs'] })
    
    Promise.all([refetchDashboard(), refetchHistory(), refetchStatus(), refetchPatients()])
      .then(() => {
        addSyncLog('success', 'Sync data refresh completed')
      })
      .catch((error) => {
        addSyncLog('error', `Sync data refresh failed: ${error}`)
      })
  }, [queryClient, refetchDashboard, refetchHistory, refetchStatus, refetchPatients, addSyncLog])

  // Clear stale activeSyncId when backend shows no current sync
  useEffect(() => {
    if (dashboardData && !dashboardData.current_sync && activeSyncId) {
      addSyncLog('info', 'Clearing stale sync state', activeSyncId)
      setActiveSyncId(null)
    }
  }, [dashboardData, activeSyncId, addSyncLog])

  // Also clear when sync logs show completion
  useEffect(() => {
    if (activeSyncId && syncLogsData?.logs?.[0]?.status === 'completed') {
      addSyncLog('info', 'Sync completed successfully', activeSyncId)
      setActiveSyncId(null)
    }
  }, [syncLogsData, activeSyncId, addSyncLog])

  // Backend team's recommended sync approach - ALL patients sync
  const startSyncMutation = useMutation({
    mutationFn: async ({ organizationId }: { organizationId: string }) => {
      addSyncLog('info', 'Starting ALL patients sync (backend team recommendation)...')
      const authenticatedAPI = new RoutiqAPI(organizationId)
      return await authenticatedAPI.startAllPatientsSync(organizationId)
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      addSyncLog('success', `✅ ${data.message}`)
      addSyncLog('info', '🔄 Real-time monitoring started (polling every 2 seconds)')
      setActiveSyncId('monitoring') // Use monitoring state instead of actual sync_id
      
      // Start the backend team's recommended monitoring pattern
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
      refetchHistory()
      refetchStatus()
      refetchPatients()
      queryClient.invalidateQueries({ queryKey: ['sync-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['sync-history'] })
      queryClient.invalidateQueries({ queryKey: ['patients-summary'] })
      queryClient.invalidateQueries({ queryKey: ['cliniko-status'] })
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] })
    }, 2000)
  }, [eventSource, refetchDashboard, refetchHistory, refetchStatus, refetchPatients, queryClient])

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

  // Check sync availability from dashboard data (Railway backend) with fallbacks
  const syncAvailable = dashboardData?.sync_available || false
  const clinikoConfigured = syncAvailable || (clinikoStatus?.total_patients !== undefined)
  const clinikoConnected = syncAvailable || (clinikoStatus?.active_patients !== undefined)
  
  // Use fallback data when some endpoints are not available
  const effectivePatientStats = dashboardData?.patient_stats || {
    total_patients: clinikoStatus?.total_patients || 0,
    active_patients: clinikoStatus?.active_patients || 0,
    patients_with_upcoming: 0, // Not available in basic status
    patients_with_recent: 0,
    last_sync_time: clinikoStatus?.last_sync_time || null
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
                const response = await fetch('/api/debug/organization-services')
                const data = await response.json()
                if (response.ok) {
                  addSyncLog('info', `Services configured: ${JSON.stringify(data.services)}`)
                } else {
                  addSyncLog('error', `Service check failed: ${data.error}`)
                }
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