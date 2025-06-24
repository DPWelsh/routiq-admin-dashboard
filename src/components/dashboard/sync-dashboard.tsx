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

  // Query for dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['sync-dashboard', orgId],
    queryFn: () => orgId ? api.getNewSyncDashboard(orgId) : null,
    enabled: !!orgId,
    refetchInterval: activeSyncId ? 2000 : 30000, // More frequent updates during sync
  })

  // Query for sync history
  const { data: historyData } = useQuery({
    queryKey: ['sync-history', orgId],
    queryFn: () => orgId ? api.getSyncHistory(orgId, 5) : null,
    enabled: !!orgId,
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
      addLog('error', `Failed to start sync: ${error}`)
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
    refetchDashboard()
    queryClient.invalidateQueries({ queryKey: ['sync-history'] })
  }, [eventSource, refetchDashboard, queryClient])

  // Cleanup on unmount or sync completion
  useEffect(() => {
    if (progressData?.status === 'completed' || progressData?.status === 'failed') {
      addLog(progressData.status === 'completed' ? 'success' : 'error', 
        `Sync ${progressData.status}${progressData.status === 'completed' ? ` - ${progressData.active_patients_stored} patients stored` : ''}`)
      cleanup()
    }
  }, [progressData?.status, progressData?.active_patients_stored, addLog, cleanup])

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
            onClick={() => refetchDashboard()}
            disabled={isDashboardLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
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

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-sm text-muted-foreground">Total Patients</div>
                <div className="text-2xl font-bold">{dashboardData?.patient_stats.total_patients || 0}</div>
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                        <div className="font-medium">{sync.sync_id}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(sync.started_at), { addSuffix: true })}
                        </div>
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
            ) : (
              <p className="text-muted-foreground">No sync history available</p>
            )}
          </CardContent>
        </Card>

        {/* Live Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Live Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <Badge 
                      variant={log.level === 'error' ? 'destructive' : log.level === 'warning' ? 'secondary' : 'outline'}
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
                <p className="text-muted-foreground">No activity yet</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Completed</div>
                <div className="font-medium">
                  {formatDistanceToNow(new Date(dashboardData.last_sync.completed_at), { addSuffix: true })}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Records Processed</div>
                <div className="font-medium">{dashboardData.last_sync.records_success}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge variant="default">{dashboardData.last_sync.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 