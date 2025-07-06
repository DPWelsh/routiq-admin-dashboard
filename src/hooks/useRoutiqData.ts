/**
 * React hooks for Routiq API integration
 * Uses TanStack Query for server state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RoutiqAPI, ORGANIZATIONS } from '../lib/routiq-api';
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
 * Hook for Clerk sync operations - works in production now
 */
export function useClerkSync(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const queryClient = useQueryClient();
  const api = new RoutiqAPI(organizationId);

  // Get Clerk sync status with polling
  const syncStatus = useQuery({
    queryKey: ['clerk-sync-status'],
    queryFn: () => api.getSyncStatus(),
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    refetchIntervalInBackground: true,
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Trigger Clerk sync mutation
  const triggerSync = useMutation({
    mutationFn: () => api.triggerClerkSync(organizationId),
    onSuccess: (data: SyncTriggerResponse) => {
      console.log('Clerk sync triggered:', data);
      // Immediately start polling for status and refresh data
      queryClient.invalidateQueries({ queryKey: ['clerk-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['database-summary'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['clerk-sync-status'] });
    },
    onError: (error) => {
      console.error('Clerk sync trigger failed:', error);
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
 * Hook for Cliniko sync operations - works when backend is configured
 */
export function useClinikoSync(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const queryClient = useQueryClient();
  const api = new RoutiqAPI(organizationId);

  // Get Cliniko sync status
  const clinikoStatus = useQuery({
    queryKey: ['cliniko-sync-status', organizationId],
    queryFn: () => api.getClinikoStatus(organizationId),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    retry: (failureCount, error) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 2;
    }
  });

  // Trigger Cliniko sync mutation
  const triggerSync = useMutation({
    mutationFn: ({ forceFull = false }: { forceFull?: boolean } = {}) => api.triggerClinikoSync(organizationId, forceFull),
    onSuccess: (data: SyncTriggerResponse) => {
      console.log('Cliniko sync triggered:', data);
      // Immediately refresh related data
      queryClient.invalidateQueries({ queryKey: ['cliniko-sync-status', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['active-patients', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['active-patients-summary', organizationId] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['cliniko-sync-status', organizationId] });
    },
    onError: (error) => {
      console.error('Cliniko sync trigger failed:', error);
    }
  });

  // Convenience methods for different sync types
  const startRegularSync = () => triggerSync.mutate({ forceFull: false });
  const startForceSync = () => triggerSync.mutate({ forceFull: true });

  return {
    clinikoStatus: clinikoStatus.data,
    isLoadingStatus: clinikoStatus.isLoading,
    isErrorStatus: clinikoStatus.isError,
    errorStatus: clinikoStatus.error,
    triggerSync: triggerSync.mutate,
    startRegularSync,
    startForceSync,
    isTriggering: triggerSync.isPending,
    triggerError: triggerSync.error,
    triggerSuccess: triggerSync.isSuccess,
  };
}

/**
 * Hook for sync operations - works in production now (LEGACY - use useClerkSync instead)
 */
export function useActivePatientsSync(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  // Delegate to Clerk sync for backward compatibility
  return useClerkSync(organizationId);
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
      if (error?.message?.includes('404')) return false;
      return failureCount < 2;
    }
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
 * Hook to combine all working data sources with separate sync controls
 */
export function useDashboardData(organizationId: string = ORGANIZATIONS.SURF_REHAB) {
  const clerkSyncData = useClerkSync(organizationId);
  const clinikoSyncData = useClinikoSync(organizationId);
  const databaseData = useDatabaseSummary();
  const healthData = useAPIHealth();
  const featuresData = useAvailableFeatures(organizationId);
  
  return {
    // Clerk sync information
    clerkSync: {
      status: clerkSyncData.syncStatus,
      isSyncing: clerkSyncData.isSyncing,
      lastSync: clerkSyncData.lastSync,
      triggerSync: clerkSyncData.triggerSync,
      isTriggering: clerkSyncData.isTriggering,
      isConnected: clerkSyncData.isConnected,
      error: clerkSyncData.statusError
    },
    
    // Cliniko sync information
    clinikoSync: {
      status: clinikoSyncData.clinikoStatus,
      isSyncing: clinikoSyncData.isLoadingStatus,
      isErrorStatus: clinikoSyncData.isErrorStatus,
      errorStatus: clinikoSyncData.errorStatus,
      triggerSync: clinikoSyncData.triggerSync,
      startRegularSync: clinikoSyncData.startRegularSync,
      startForceSync: clinikoSyncData.startForceSync,
      isTriggering: clinikoSyncData.isTriggering,
      triggerError: clinikoSyncData.triggerError,
      triggerSuccess: clinikoSyncData.triggerSuccess,
    },
    
    // Legacy sync (for backward compatibility)
    sync: {
      status: clerkSyncData.syncStatus,
      isSyncing: clerkSyncData.isSyncing,
      lastSync: clerkSyncData.lastSync,
      triggerSync: clerkSyncData.triggerSync,
      isTriggering: clerkSyncData.isTriggering
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
    isLoading: clerkSyncData.isLoadingStatus || clinikoSyncData.isLoadingStatus || databaseData.isLoading || healthData.isLoading,
    
    // Any errors
    hasErrors: !!(clerkSyncData.statusError || clinikoSyncData.errorStatus || databaseData.error || healthData.error)
  };
} 