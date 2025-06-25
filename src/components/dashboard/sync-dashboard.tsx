"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { api } from '@/lib/routiq-api'
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

  // Query for dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['sync-dashboard', orgId],
    queryFn: () => orgId ? api.getNewSyncDashboard(orgId) : null,
    enabled: !!orgId,
    refetchInterval: activeSyncId ? 2000 : 30000, // More frequent updates during sync
  })

  // Query for sync history
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['sync-history', orgId],
    queryFn: () => orgId ? api.getSyncHistory(orgId, 5) : null,
    enabled: !!orgId,
    staleTime: 5000, // Consider data stale after 5 seconds
  })

  // Query for current sync progress
  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: ['sync-progress', activeSyncId],
    queryFn: () => activeSyncId ? api.getSyncProgress(activeSyncId) : null,
    enabled: !!activeSyncId,
    refetchInterval: activeSyncId ? 1000 : false, // Real-time updates during sync
  })

  // Mutation to start sync
  const startSyncMutation = useMutation({
    mutationFn: (organizationId: string) => api.startSyncWithProgress(organizationId),
    onSuccess: (data) => {
      setActiveSyncId(data.sync_id)
      addLog('info', `Sync started with ID: ${data.sync_id}`)
      
      // Set up polling instead of Server-Sent Events for now
      // const eventSource = api.createSyncEventSource(data.sync_id)
      // eventSource.onmessage = (event) => {
      //   const data = JSON.parse(event.data)
      //   addLog('info', `Progress update: ${data.current_step} (${data.progress_percentage}%)`)
      //   refetchProgress()
      // }
      // eventSource.onerror = () => {
      //   addLog('error', 'Lost connection to sync stream')
      // }
      // setEventSource(eventSource)
      addLog('info', 'Real-time polling started')
    },
    onError: (error) => {
      console.error('Sync start error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      addLog('error', `Failed to start sync: ${errorMessage}`)
    },
  })

  // Mutation to cancel sync
  const cancelSyncMutation = useMutation({
    mutationFn: (syncId: string) => api.cancelSync(syncId),
    onSuccess: () => {
      addLog('warning', 'Sync cancelled')
      cleanup()
    },
    onError: (error) => {
      addLog('error', `Failed to cancel sync: ${error}`)
    },
  })

  const addLog = useCallback((level: string, message: string) => {
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      level,
      message
    }, ...prev.slice(0, 49)]) // Keep last 50 logs
  }, [])

  const cleanup = useCallback(() => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
    }
    setActiveSyncId(null)
    
    // Add a small delay to ensure backend has processed the completion
    setTimeout(() => {
      console.log('Refreshing dashboard and history after sync completion...')
      refetchDashboard()
      refetchHistory()
      queryClient.invalidateQueries({ queryKey: ['sync-history'] })
      queryClient.invalidateQueries({ queryKey: ['sync-dashboard'] })
    }, 2000) // 2 second delay
  }, [eventSource, refetchDashboard, refetchHistory, queryClient])

  // Cleanup on unmount or sync completion
  useEffect(() => {
    if (progressData?.status === 'completed' || progressData?.status === 'failed') {
      if (progressData.status === 'completed') {
        addLog('success', `Sync completed - ${progressData.active_patients_stored} patients stored`)
      } else {
        const errorDetails = progressData.errors && progressData.errors.length > 0 
          ? ` - ${progressData.errors.join(', ')}` 
          : ''
        addLog('error', `Sync failed${errorDetails}`)
      }
      cleanup()
    }
  }, [progressData?.status, progressData?.active_patients_stored, progressData?.errors, addLog, cleanup])

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

  // Check service configuration on component mount
  useEffect(() => {
    if (!orgId) return;
    
    const checkServiceConfig = async () => {
      try {
        const config = await api.getServiceConfig(orgId)
        console.log('Service config received:', config)
        setServiceConfig(config)
        
        // If Cliniko is configured, test the connection
        if (config.available_integrations?.includes('cliniko')) {
          console.log('Cliniko is configured, testing connection...')
          setIsTestingConnection(true)
          const test = await api.testClinikoConnection(orgId)
          console.log('Connection test result:', test)
          setConnectionTest(test)
          setIsTestingConnection(false)
        } else {
          console.log('Cliniko not found in available_integrations:', config.available_integrations)
        }
      } catch (error) {
        console.error('Failed to check service configuration:', error)
      }
    }

    checkServiceConfig()
  }, [orgId])

  const clinikoConfigured = serviceConfig?.available_integrations?.includes('cliniko') || false
  const clinikoConnected = connectionTest?.connected || false

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
          <p className="text-muted-foreground">Real-time patient data synchronization</p>
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
              addLog('info', 'Manual refresh triggered')
            }}
            disabled={isDashboardLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {activeSyncId && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const status = await api.getSyncProgress(activeSyncId)
                  addLog('info', `Debug - Status: ${status.status}, Progress: ${status.progress_percentage}%, Errors: ${status.errors?.length || 0}`)
                  if (status.errors && status.errors.length > 0) {
                    status.errors.forEach(error => addLog('error', `Error detail: ${error}`))
                  }
                } catch (error) {
                  addLog('error', `Debug failed: ${error}`)
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
                  addLog('info', `Services configured: ${JSON.stringify(data.services)}`)
                } else {
                  addLog('error', `Service check failed: ${data.error}`)
                }
              } catch (error) {
                addLog('error', `Service check error: ${error}`)
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
            <Button
              onClick={() => orgId && startSyncMutation.mutate(orgId)}
              disabled={startSyncMutation.isPending || !dashboardData?.sync_available}
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Sync
            </Button>
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
          {/* Current Sync Progress */}
          {(dashboardData?.current_sync || progressData) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Current Sync Progress
                  <Badge variant="secondary" className={getStatusColor(progressData?.status || dashboardData?.current_sync?.status || '')}>
                    {progressData?.status || dashboardData?.current_sync?.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{progressData?.current_step || dashboardData?.current_sync?.current_step}</span>
                    <span>{progressData?.progress_percentage || dashboardData?.current_sync?.progress_percentage}%</span>
                  </div>
                  <Progress value={progressData?.progress_percentage || dashboardData?.current_sync?.progress_percentage || 0} />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Patients Found</div>
                    <div className="font-semibold">{progressData?.patients_found || dashboardData?.current_sync?.patients_found || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Appointments Found</div>
                    <div className="font-semibold">{progressData?.appointments_found || dashboardData?.current_sync?.appointments_found || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Active Identified</div>
                    <div className="font-semibold">{progressData?.active_patients_identified || dashboardData?.current_sync?.active_patients_identified || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Patients Stored</div>
                    <div className="font-semibold">{progressData?.active_patients_stored || dashboardData?.current_sync?.active_patients_stored || 0}</div>
                  </div>
                </div>

                {progressData?.errors && progressData.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {progressData.errors.map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
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
                <CardTitle>Last Successful Sync</CardTitle>
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
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Records Processed</div>
                    <div className="font-medium">{dashboardData.last_sync.records_success}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Successfully synchronized
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <Badge variant="default">{dashboardData.last_sync.status}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Started: {formatDistanceToNow(new Date(dashboardData.last_sync.started_at), { addSuffix: true })}
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