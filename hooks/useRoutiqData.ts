/**
 * React hooks for Routiq API integration
 * Uses TanStack Query for server state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RoutiqAPI, ORGANIZATIONS } from '@/lib/routiq-api';
import type { 
  SyncTriggerResponse, 
  SyncStatusResponse, 
  DatabaseSummaryResponse,
  ActivePatientsResponse,
  ActivePatientsSummaryResponse,
  SyncDashboardResponse
} from '@/lib/routiq-api';

// ========================================
// WORKING HOOKS (Available Now)
// ========================================

/**
 * Hook for sync operations - works in production now
 */
export function useActivePatientsSync(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const queryClient = useQueryClient();
  const api = new RoutiqAPI(organizationId);

  // Get sync status with polling
  const syncStatus = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.getSyncStatus(),
    refetchInterval: (query) => {
      // Poll every 2 seconds while syncing, every 30 seconds when idle
      return query.state.data?.sync_in_progress ? 2000 : 30000;
    },
    refetchIntervalInBackground: true,
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Trigger sync mutation
  const triggerSync = useMutation({
    mutationFn: () => api.triggerSync(organizationId),
    onSuccess: (data: SyncTriggerResponse) => {
      console.log('Sync triggered:', data);
      // Immediately start polling for status
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    onError: (error) => {
      console.error('Sync trigger failed:', error);
    }
  });

  return {
    // Status data
    syncStatus: syncStatus.data,
    isSyncing: syncStatus.data?.sync_in_progress || false,
    lastSync: syncStatus.data?.last_sync,
    isConnected: syncStatus.data?.clerk_api_connected || false,
    
    // Loading states
    isLoadingStatus: syncStatus.isLoading,
    isTriggering: triggerSync.isPending,
    
    // Actions
    triggerSync: () => triggerSync.mutate(),
    
    // Errors
    statusError: syncStatus.error,
    triggerError: triggerSync.error
  };
}

/**
 * Hook for database summary - works in production now
 */
export function useDatabaseSummary() {
  const api = new RoutiqAPI();
  
  return useQuery({
    queryKey: ['database-summary'],
    queryFn: () => api.getDatabaseSummary(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    retry: (failureCount, error) => {
      const errorMessage = error?.message || '';
      // Retry connection errors more aggressively
      if (errorMessage.includes('connection already closed')) return failureCount < 4;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff up to 10s
  });
}

/**
 * Hook for basic health check
 */
export function useAPIHealth() {
  const api = new RoutiqAPI();
  
  return useQuery({
    queryKey: ['api-health'],
    queryFn: () => api.getHealth(),
    staleTime: 10000, // 10 seconds
    retry: 3,
  });
}

/**
 * Hook to test what features are available
 */
export function useAvailableFeatures(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const api = new RoutiqAPI(organizationId);
  
  return useQuery({
    queryKey: ['available-features', organizationId],
    queryFn: () => api.getAvailableFeatures(organizationId),
    staleTime: 60000, // 1 minute
    retry: 1, // Don't retry too much since this is just checking availability
  });
}

// ========================================
// FUTURE HOOKS (When Backend Environment Ready)
// ========================================

/**
 * Hook for active patients list
 * Will work when backend environment variables are configured
 */
export function useActivePatients(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const api = new RoutiqAPI(organizationId);
  
  return useQuery({
    queryKey: ['active-patients', organizationId],
    queryFn: () => api.getActivePatients(organizationId),
    enabled: !!organizationId,
    staleTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 (endpoint not available yet)
      const errorMessage = error?.message || '';
      if (errorMessage.includes('404')) return false;
      // Retry connection errors up to 3 times
      if (errorMessage.includes('connection already closed')) return failureCount < 3;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });
}

/**
 * Hook for active patients summary
 * Will work when backend environment variables are configured
 */
export function useActivePatientsummary(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const api = new RoutiqAPI(organizationId);
  
  return useQuery({
    queryKey: ['active-patients-summary', organizationId],
    queryFn: () => api.getActivePatientsummary(organizationId),
    enabled: !!organizationId,
    staleTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 2;
    }
  });
}

/**
 * Hook for comprehensive sync dashboard
 * Will work when backend environment variables are configured
 */
export function useSyncDashboard(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const api = new RoutiqAPI(organizationId);
  
  return useQuery({
    queryKey: ['sync-dashboard', organizationId],
    queryFn: () => api.getSyncDashboard(organizationId),
    enabled: !!organizationId,
    staleTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 2;
    }
  });
}

/**
 * Hook for contacts with appointments
 * Will work when backend environment variables are configured
 */
export function useContactsWithAppointments(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const api = new RoutiqAPI(organizationId);
  
  return useQuery({
    queryKey: ['contacts-with-appointments', organizationId],
    queryFn: () => api.getContactsWithAppointments(organizationId),
    enabled: !!organizationId,
    staleTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 2;
    }
  });
}

/**
 * Hook for advanced sync with scheduler
 * Will work when backend environment variables are configured
 */
export function useScheduledSync(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const queryClient = useQueryClient();
  const api = new RoutiqAPI(organizationId);

  const scheduleSync = useMutation({
    mutationFn: () => api.scheduleSync(organizationId),
    onSuccess: (data: SyncTriggerResponse) => {
      console.log('Scheduled sync triggered:', data);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['active-patients', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['sync-dashboard', organizationId] });
    },
    onError: (error) => {
      console.error('Scheduled sync failed:', error);
    }
  });

  return {
    scheduleSync: () => scheduleSync.mutate(),
    isScheduling: scheduleSync.isPending,
    scheduleError: scheduleSync.error
  };
}

// ========================================
// UTILITY HOOKS
// ========================================

/**
 * Hook to get real-time sync progress with enhanced polling
 */
export function useSyncProgress(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const queryClient = useQueryClient();
  
  const { syncStatus, isSyncing, isLoadingStatus } = useActivePatientsSync(organizationId);
  
  // Enhanced sync progress with additional metadata
  return {
    // Current status
    isSyncing,
    isLoadingStatus,
    lastSyncTime: syncStatus?.last_sync ? new Date(syncStatus.last_sync) : null,
    databaseCounts: syncStatus?.database_counts,
    isConnected: syncStatus?.clerk_api_connected,
    
    // Progress indicator
    syncProgress: isSyncing ? 'syncing' : 'idle',
    
    // Utilities
    refresh: () => queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
    
    // Formatted timestamps
    lastSyncFormatted: syncStatus?.last_sync ? 
      new Date(syncStatus.last_sync).toLocaleString() : 
      'Never',
  };
}

/**
 * Hook to combine all working data sources
 */
export function useDashboardData(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const syncData = useActivePatientsSync(organizationId);
  const databaseData = useDatabaseSummary();
  const healthData = useAPIHealth();
  const featuresData = useAvailableFeatures(organizationId);
  
  return {
    // Sync information
    sync: {
      status: syncData.syncStatus,
      isSyncing: syncData.isSyncing,
      lastSync: syncData.lastSync,
      triggerSync: syncData.triggerSync,
      isTriggering: syncData.isTriggering
    },
    
    // Database statistics
    database: {
      summary: databaseData.data,
      isLoading: databaseData.isLoading,
      error: databaseData.error
    },
    
    // API health
    health: {
      status: healthData.data,
      isLoading: healthData.isLoading,
      error: healthData.error
    },
    
    // Available features
    features: {
      available: featuresData.data,
      isLoading: featuresData.isLoading,
      error: featuresData.error
    },
    
    // Overall loading state
    isLoading: syncData.isLoadingStatus || databaseData.isLoading || healthData.isLoading,
    
    // Any errors
    hasErrors: !!(syncData.statusError || databaseData.error || healthData.error)
  };
} 