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
  Loader2
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
  
  // Create authenticated API instance for this organization
  const authenticatedAPI = useMemo(() => {
    return orgId ? new RoutiqAPI(orgId) : api
  }, [orgId])

  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([])
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig | null>(null)
  const [connectionTest, setConnectionTest] = useState<ClinikoConnectionTest | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [syncMode, setSyncMode] = useState<'full' | 'incremental' | 'quick'>('full')

  // Query for dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard, dataUpdatedAt } = useQuery({
    queryKey: ['sync-dashboard', orgId],
    queryFn: async () => {
      if (!orgId) return null
      return await authenticatedAPI.getNewSyncDashboard(orgId)
    },
    enabled: !!orgId,
    refetchInterval: activeSyncId ? 2000 : 10000,
    staleTime: 5000,
  })

  // Query for sync history
  const { data: historyData, refetch: refetchHistory, dataUpdatedAt: historyUpdatedAt } = useQuery({
    queryKey: ['sync-history', orgId],
    queryFn: async () => {
      if (!orgId) return null
      return await authenticatedAPI.getSyncHistory(orgId, 5)
    },
    enabled: !!orgId,
    staleTime: 5000,
    refetchInterval: 10000,
  })

  // Query for current sync progress
  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: ['sync-progress', activeSyncId],
    queryFn: () => activeSyncId ? authenticatedAPI.getSyncProgress(activeSyncId) : null,
    enabled: !!activeSyncId,
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
    queryFn: () => orgId ? authenticatedAPI.getSyncLogs(orgId, 1) : null,
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
        if (metadata.current_step && metadata.current_step !== progressData?.current_step) {
          addSyncLog('info', `📋 ${metadata.current_step}`, activeSyncId)
        }
        
        if (metadata.patients_processed && metadata.patients_found) {
          const percentage = Math.round((metadata.patients_processed / metadata.patients_found) * 100)
          addSyncLog('info', `💾 Storing patients: ${metadata.patients_processed}/${metadata.patients_found} (${percentage}%)`, activeSyncId)
        }
        
        if (metadata.patients_found && !progressData?.patients_found) {
          addSyncLog('info', `👥 Found ${metadata.patients_found} patients to process`, activeSyncId)
        }
      } catch (error) {
        // Metadata parsing failed, continue with basic progress
      }
    }
  }, [syncLogsData, activeSyncId, progressData?.current_step, progressData?.patients_found, addSyncLog])

  // Enhanced refresh function
  const forceRefresh = useCallback(() => {
    addSyncLog('info', 'Force refreshing sync data...')
    
    queryClient.removeQueries({ queryKey: ['sync-dashboard'] })
    queryClient.removeQueries({ queryKey: ['sync-history'] })
    
    Promise.all([refetchDashboard(), refetchHistory()])
      .then(() => {
        addSyncLog('success', 'Sync data refresh completed')
      })
      .catch((error) => {
        addSyncLog('error', `Sync data refresh failed: ${error}`)
      })
  }, [queryClient, refetchDashboard, refetchHistory, addSyncLog])

  // Clear stale activeSyncId when backend shows no current sync
  useEffect(() => {
    if (dashboardData && !dashboardData.current_sync && activeSyncId) {
      addSyncLog('info', 'Clearing stale sync state', activeSyncId)
      setActiveSyncId(null)
    }
  }, [dashboardData, activeSyncId, addSyncLog])

  // Backend team's recommended sync approach - ALL patients sync
  const startSyncMutation = useMutation({
    mutationFn: ({ organizationId }: { organizationId: string }) => {
      addSyncLog('info', 'Starting ALL patients sync (backend team recommendation)...')
      return authenticatedAPI.startAllPatientsSync(organizationId)
    },
    onSuccess: (data) => {
      addSyncLog('success', `✅ ${data.message}`)
      addSyncLog('info', '🔄 Real-time monitoring started (polling every 2 seconds)')
      setActiveSyncId('monitoring') // Use monitoring state instead of actual sync_id
      
      // Start the backend team's recommended monitoring pattern
      startSyncMonitoring()
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addSyncLog('error', `❌ Failed to start sync: ${errorMessage}`)
    },
  })

  // Backend team's monitoring pattern implementation
  const startSyncMonitoring = async () => {
    if (!orgId) return
    
    try {
      const result = await authenticatedAPI.monitorSyncProgress(orgId, 300000) // 5 minutes timeout
      
      if (result.status === 'completed') {
        addSyncLog('success', `✅ Sync completed! ${result.recordsSuccess}/${result.recordsProcessed} patients synced (${result.successRate.toFixed(1)}% success rate)`)
        if (result.metadata.patients_found) {
          addSyncLog('info', `📊 Total patients processed: ${result.metadata.patients_found}`)
        }
      } else if (result.status === 'failed') {
        addSyncLog('error', `❌ Sync failed after processing ${result.recordsProcessed} patients`)
        if (result.metadata.errors) {
          result.metadata.errors.forEach(error => addSyncLog('error', `Error: ${error}`))
        }
      } else if (result.status === 'timeout') {
        addSyncLog('warning', '⏰ Sync monitoring timeout - sync may still be running')
      }
      
      cleanup()
      
    } catch (error) {
      addSyncLog('error', `❌ Monitoring failed: ${error}`)
      cleanup()
    }
  }

  // Mutation to cancel sync
  const cancelSyncMutation = useMutation({
    mutationFn: (syncId: string) => authenticatedAPI.cancelSync(syncId),
    onSuccess: () => {
      addSyncLog('warning', 'Sync cancelled', activeSyncId || undefined)
      cleanup()
    },
    onError: (error) => {
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
      queryClient.invalidateQueries({ queryKey: ['sync-history'] })
      queryClient.invalidateQueries({ queryKey: ['sync-dashboard'] })
    }, 2000)
  }, [eventSource, refetchDashboard, refetchHistory, queryClient])

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

  // For direct backend testing, use sync_available from dashboard data instead of service config
  const clinikoConfigured = dashboardData?.sync_available || false
  const clinikoConnected = dashboardData?.sync_available || false

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
              queryClient.invalidateQueries({ queryKey: ['sync-history'] })
              queryClient.invalidateQueries({ queryKey: ['sync-dashboard'] })
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
                  const status = await authenticatedAPI.getSyncProgress(activeSyncId)
                  addSyncLog('info', `Debug - Status: ${status.status}, Progress: ${status.progress_percentage}%, Errors: ${status.errors?.length || 0}`, activeSyncId)
                  if (status.errors && status.errors.length > 0) {
                    status.errors.forEach(error => addSyncLog('error', `Error detail: ${error}`, activeSyncId))
                  }
                } catch (error) {
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
            <>
              <div className="flex flex-col gap-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                                         <span className="text-sm font-medium text-blue-900">Backend Team&apos;s Recommended Sync:</span>
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">ALL Patients</Badge>
                  </div>
                  <div className="text-xs text-blue-700">
                    ✅ Syncs ALL patients from Cliniko (not just active ones)<br/>
                    ✅ Real-time progress monitoring every 2 seconds<br/>
                    ✅ Enhanced error handling and 100% success rate target
                  </div>
                </div>
              </div>
              <Button
                onClick={() => orgId && startSyncMutation.mutate({ organizationId: orgId })}
                disabled={startSyncMutation.isPending || !dashboardData?.sync_available}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {startSyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                🔄 Start ALL Patients Sync
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Service Configuration Status */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Integration Status</h2>
        
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Cliniko Practice Management</h3>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              clinikoConfigured ? 
                (clinikoConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800') : 
                'bg-red-100 text-red-800'
            }`}>
              {clinikoConfigured ? 
                (clinikoConnected ? '✅ Connected' : '⚠️ Configured but not connected') : 
                '❌ Not configured'
              }
            </div>
          </div>
          
          {clinikoConfigured && connectionTest && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {connectionTest.total_patients_available && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Patients:</span>
                  <span className="font-semibold">{connectionTest.total_patients_available.toLocaleString()}</span>
                </div>
              )}
              {connectionTest.practitioners_count && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Practitioners:</span>
                  <span className="font-semibold">{connectionTest.practitioners_count}</span>
                </div>
              )}
              {connectionTest.api_url && (
                <div className="flex justify-between col-span-2">
                  <span className="text-gray-600">API URL:</span>
                  <span className="font-semibold text-xs">{connectionTest.api_url}</span>
                </div>
              )}
            </div>
          )}
          
          {!clinikoConfigured && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-blue-900 mb-2">Cliniko Integration Setup Required</h4>
              <p className="text-blue-800 text-sm mb-3">
                Your organization needs Cliniko API credentials configured to sync patient data.
              </p>
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-2">Required steps:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Contact your administrator to set up Cliniko API access</li>
                  <li>Configure API credentials in the backend system</li>
                  <li>Verify connection to your Cliniko practice</li>
                </ul>
              </div>
            </div>
          )}
          
          {clinikoConfigured && !clinikoConnected && connectionTest?.error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Connection Issue</h4>
              <p className="text-yellow-800 text-sm">
                Cliniko is configured but connection failed: {connectionTest.error}
              </p>
            </div>
          )}
          
          {isTestingConnection && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Testing Cliniko connection...
            </div>
          )}
        </div>
      </div>

      {/* Only show sync controls if Cliniko is properly configured */}
      {clinikoConfigured && clinikoConnected ? (
        <>
          {/* Enhanced Real-Time Sync Progress (Backend Team Implementation) */}
          {progressData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Live Sync Progress
                  <Badge variant="secondary" className={getStatusColor(progressData.status || '')}>
                    {getStatusIcon(progressData.status)}
                    {progressData.status}
                  </Badge>
                  {progressData.estimated_completion && (
                    <Badge variant="outline" className="text-xs">
                      ETA: {formatDistanceToNow(new Date(progressData.estimated_completion))}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enhanced Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="animate-pulse">🔄</span>
                      {progressData.current_step}
                    </span>
                    <span className="font-mono text-lg">{progressData.progress_percentage}%</span>
                  </div>
                  <Progress value={progressData.progress_percentage || 0} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Step {progressData.current_step_number || 1} of {progressData.total_steps || 1}</span>
                    <span>
                      {progressData.started_at && `Started ${formatDistanceToNow(new Date(progressData.started_at), { addSuffix: true })}`}
                    </span>
                  </div>
                </div>
                
                {/* Real-Time Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-muted-foreground">👥 Patients Found</div>
                    <div className="text-2xl font-bold text-blue-600">{progressData.patients_found || 0}</div>
                    {progressData.patients_found > 0 && (
                      <div className="text-xs text-blue-500">From Cliniko API</div>
                    )}
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-muted-foreground">📅 Appointments</div>
                    <div className="text-2xl font-bold text-green-600">{progressData.appointments_found || 0}</div>
                    {progressData.appointments_found > 0 && (
                      <div className="text-xs text-green-500">Recent & Upcoming</div>
                    )}
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-muted-foreground">✅ Active Identified</div>
                    <div className="text-2xl font-bold text-orange-600">{progressData.active_patients_identified || 0}</div>
                    {progressData.patients_found > 0 && progressData.active_patients_identified > 0 && (
                      <div className="text-xs text-orange-500">
                        {Math.round((progressData.active_patients_identified / progressData.patients_found) * 100)}% of total
                      </div>
                    )}
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-muted-foreground">💾 Stored</div>
                    <div className="text-2xl font-bold text-purple-600">{progressData.active_patients_stored || 0}</div>
                    {progressData.active_patients_identified > 0 && progressData.active_patients_stored > 0 && (
                      <div className="text-xs text-purple-500">
                        {Math.round((progressData.active_patients_stored / progressData.active_patients_identified) * 100)}% complete
                      </div>
                    )}
                  </div>
                </div>

                {/* Processing Rate Indicator */}
                {progressData.active_patients_stored > 0 && progressData.started_at && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Processing Rate</span>
                      <span className="font-mono">
                        {(() => {
                          const elapsed = (Date.now() - new Date(progressData.started_at).getTime()) / 1000
                          const rate = Math.round(progressData.active_patients_stored / Math.max(elapsed, 1))
                          return `${rate} patients/sec`
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {progressData.errors && progressData.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <strong>Sync Errors ({progressData.errors.length})</strong>
                        {progressData.errors.map((error, index) => (
                          <div key={index} className="text-sm font-mono">{error}</div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stale Sync Warning */}
          {dashboardData?.current_sync && !activeSyncId && !progressData && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <strong>Stale Sync State Detected</strong>
                  <p>The backend reports a sync in progress, but no active monitoring was found. This may be leftover state from a previous sync.</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      addSyncLog('info', 'Clearing stale backend sync state...')
                      // Force refresh to clear any stale state
                      queryClient.clear()
                      refetchDashboard()
                      refetchHistory()
                    }}
                  >
                    Clear Stale State
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}



          {/* Configuration Warning */}
          {logs.some(log => log.message.includes('Cliniko sync not enabled')) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <strong>Cliniko Integration Not Configured</strong>
                  <p>Your organization needs Cliniko API credentials to sync patient data. Contact your administrator to:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Set up Cliniko API access</li>
                    <li>Configure API credentials in the backend</li>
                    <li>Enable sync permissions for your organization</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Organization ID: <code className="bg-muted px-1 rounded">{orgId}</code>
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Total Patients</div>
                    <div className="text-2xl font-bold">{dashboardData?.patient_stats.total_patients || 0}</div>
                    {dashboardData?.patient_stats.last_sync_time && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Last updated: {formatDistanceToNow(new Date(dashboardData.patient_stats.last_sync_time), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Active Patients</div>
                    <div className="text-2xl font-bold">{dashboardData?.patient_stats.active_patients || 0}</div>
                    {dashboardData?.patient_stats?.total_patients && dashboardData.patient_stats.total_patients > 0 && dashboardData.patient_stats.active_patients !== undefined && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((dashboardData.patient_stats.active_patients / dashboardData.patient_stats.total_patients) * 100)}% of total
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">With Upcoming</div>
                    <div className="text-2xl font-bold">{dashboardData?.patient_stats.patients_with_upcoming || 0}</div>
                    {dashboardData?.patient_stats?.active_patients && dashboardData.patient_stats.active_patients > 0 && dashboardData.patient_stats.patients_with_upcoming !== undefined && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((dashboardData.patient_stats.patients_with_upcoming / dashboardData.patient_stats.active_patients) * 100)}% of active
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">With Recent</div>
                    <div className="text-2xl font-bold">{dashboardData?.patient_stats.patients_with_recent || 0}</div>
                    {dashboardData?.patient_stats?.active_patients && dashboardData.patient_stats.active_patients > 0 && dashboardData.patient_stats.patients_with_recent !== undefined && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((dashboardData.patient_stats.patients_with_recent / dashboardData.patient_stats.active_patients) * 100)}% of active
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sync Performance Metrics */}
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
                    <div className="text-xs text-muted-foreground mt-1">
                      {historyData.total_syncs > 0 ? Math.round((historyData.failed_syncs / historyData.total_syncs) * 100) : 0}% failure rate
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {historyData.average_sync_duration_seconds 
                        ? Math.round(historyData.average_sync_duration_seconds / 60) 
                        : 0}m
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Duration</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {historyData.average_sync_duration_seconds 
                        ? `${historyData.average_sync_duration_seconds}s`
                        : 'N/A'
                      }
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {historyData.last_sync_at 
                        ? formatDistanceToNow(new Date(historyData.last_sync_at), { addSuffix: true }).replace(' ago', '')
                        : 'Never'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Last Sync</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {historyData.last_sync_at 
                        ? new Date(historyData.last_sync_at).toLocaleDateString()
                        : 'No sync yet'
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sync History */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Sync History</CardTitle>
              </CardHeader>
              <CardContent>
                {historyData?.recent_syncs && historyData.recent_syncs.length > 0 ? (
                  <div className="space-y-3">
                    {historyData.recent_syncs.map((sync, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(sync.status)}
                          <div>
                            <div className="font-medium text-sm">{sync.sync_id}</div>
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
                          {sync.errors && sync.errors.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              {sync.errors.length} error{sync.errors.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No sync history available</p>
                )}
              </CardContent>
            </Card>

            {/* Live Logs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Activity Log</CardTitle>
                  {logs.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogs([])}
                    >
                      Clear Logs
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <Badge 
                          variant={log.level === 'error' ? 'destructive' : log.level === 'warning' ? 'secondary' : log.level === 'success' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {log.level}
                        </Badge>
                        <div className="flex-1">
                          <div className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </div>
                          <div>{log.message}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground mb-2">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No activity yet
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Activity will appear here when sync operations are running
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Last Sync Info */}
          {dashboardData?.last_sync && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Last Successful Sync</CardTitle>
                  <div className="flex items-center gap-2">

                    <Badge variant="outline" className="text-xs">
                      Current time: {new Date().toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                    <div className="font-medium">
                      {formatDistanceToNow(new Date(dashboardData.last_sync.completed_at), { addSuffix: true })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(dashboardData.last_sync.completed_at).toLocaleDateString()} at{' '}
                      {new Date(dashboardData.last_sync.completed_at).toLocaleTimeString()}
                    </div>
                    <div className="text-xs font-mono bg-muted px-1 rounded mt-1">
                      UTC: {new Date(dashboardData.last_sync.completed_at).toISOString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Records Processed</div>
                    <div className="font-medium">{dashboardData.last_sync.records_success}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Successfully synchronized
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Rate: {Math.round(dashboardData.last_sync.records_success / 
                        Math.max(1, (new Date(dashboardData.last_sync.completed_at).getTime() - 
                         new Date(dashboardData.last_sync.started_at).getTime()) / 1000))} records/sec
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <Badge variant="default">{dashboardData.last_sync.status}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Started: {formatDistanceToNow(new Date(dashboardData.last_sync.started_at), { addSuffix: true })}
                    </div>
                    <div className="text-xs font-mono bg-muted px-1 rounded mt-1">
                      Started: {new Date(dashboardData.last_sync.started_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                    <div className="font-medium">
                      {Math.round(
                        (new Date(dashboardData.last_sync.completed_at).getTime() - 
                         new Date(dashboardData.last_sync.started_at).getTime()) / 1000 / 60
                      )}m
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.round(
                        (new Date(dashboardData.last_sync.completed_at).getTime() - 
                         new Date(dashboardData.last_sync.started_at).getTime()) / 1000
                      )} seconds total
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Age: {Math.round((Date.now() - new Date(dashboardData.last_sync.completed_at).getTime()) / 1000 / 60)} minutes old
                    </div>
                  </div>
                </div>
                
                {/* Sync Reliability Indicator */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Data Freshness</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const ageMinutes = Math.round((Date.now() - new Date(dashboardData.last_sync.completed_at).getTime()) / 1000 / 60)
                        if (ageMinutes < 10) {
                          return <Badge variant="default" className="text-xs">Very Fresh</Badge>
                        } else if (ageMinutes < 60) {
                          return <Badge variant="secondary" className="text-xs">Fresh</Badge>
                        } else if (ageMinutes < 360) {
                          return <Badge variant="outline" className="text-xs">Moderate</Badge>
                        } else {
                          return <Badge variant="destructive" className="text-xs">Stale</Badge>
                        }
                      })()}
                      <span className="text-xs text-muted-foreground">
                        {Math.round((Date.now() - new Date(dashboardData.last_sync.completed_at).getTime()) / 1000 / 60)} min ago
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <div className="text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sync Unavailable</h3>
          <p className="text-gray-600">
            Patient data synchronization requires Cliniko integration to be configured first.
          </p>
        </div>
      )}
    </div>
  )
} 