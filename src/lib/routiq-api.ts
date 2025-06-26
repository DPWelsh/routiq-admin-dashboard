/**
 * Routiq API Client
 * Integrates with Cliniko Active Patients Backend
 */

// Use Railway backend directly as requested by backend team
// This avoids the local API proxy pattern and calls the backend directly
const API_BASE = 'https://routiq-backend-prod.up.railway.app';

// Debug logging to see what's happening
if (typeof window !== 'undefined') {
  console.log('🔧 [API CONFIG] Using direct Railway backend calls');
  console.log('🔧 [API CONFIG] API_BASE:', API_BASE);
  console.log('🔧 [API CONFIG] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  console.log('🔧 [API CONFIG] Window location:', window.location.href);
}

// Organization constants
export const ORGANIZATIONS = {
  SURF_REHAB: 'org_2xwHiNrj68eaRUlX10anlXGvzX7',
  TEST_ORG: 'org_2xwHiNrj68eaRUlX10anlXGvzX8'
} as const;

// Response types
export interface SyncTriggerResponse {
  success: boolean;
  message: string;
  sync_id?: string;
  organization_id: string;
}

export interface SyncStatusResponse {
  clerk_api_connected: boolean;
  database_counts: {
    users: number;
    organizations: number;
    organization_members: number;
  };
  last_sync: string;
  sync_in_progress: boolean;
}

export interface DatabaseSummaryResponse {
  users: {
    total_users: number;
    users_last_7_days: number;
    users_with_login: number;
  };
  organizations: {
    total_organizations: number;
    orgs_last_7_days: number;
    active_organizations: number;
  };
  memberships: {
    total_memberships: number;
    active_memberships: number;
    orgs_with_members: number;
    users_with_orgs: number;
  };
  role_distribution: Array<{
    role: string;
    count: number;
  }>;
}

export interface ActivePatient {
  id: number;
  contact_id: string;
  contact_name?: string;
  contact_phone?: string;
  recent_appointment_count: number;
  upcoming_appointment_count: number;
  total_appointment_count: number;
  last_appointment_date?: string;
  recent_appointments?: unknown[];
  upcoming_appointments?: unknown[];
  created_at: string;
  updated_at: string;
}

export interface ActivePatientsResponse {
  organization_id: string;
  active_patients: ActivePatient[];
  total_count: number;
  timestamp: string;
}

export interface ActivePatientsSummaryResponse {
  organization_id: string;
  total_active_patients: number;
  patients_with_recent_appointments: number;
  patients_with_upcoming_appointments: number;
  last_sync_date?: string;
  avg_recent_appointments: number;
  avg_total_appointments: number;
  timestamp: string;
}

export interface SyncDashboardResponse {
  organization_id: string;
  dashboard_generated_at: string;
  contact_metrics: {
    total_contacts: number;
    cliniko_linked: number;
    unlinked: number;
    link_percentage: number;
  };
  active_patient_metrics: {
    total_active: number;
    avg_recent_appointments: number;
    avg_total_appointments: number;
    most_recent_appointment?: string;
    last_sync?: string;
  };
  service_status: {
    cliniko_configured: boolean;
    sync_enabled: boolean;
    is_active: boolean;
    last_service_sync?: string;
  };
  health_indicators: {
    has_contacts: boolean;
    has_active_patients: boolean;
    recent_sync: boolean;
    high_link_rate: boolean;
  };
}

// New Sync Dashboard Interfaces
export interface NewSyncTriggerResponse {
  message: string;
  sync_id: string;
  organization_id: string;
  status: string;
}

export interface SyncProgressResponse {
  organization_id: string;
  sync_id: string;
  status: 'idle' | 'starting' | 'fetching_patients' | 'fetching_appointments' | 'analyzing' | 'storing' | 'completed' | 'failed';
  progress_percentage: number;
  current_step: string;
  total_steps: number;
  current_step_number: number;
  patients_found: number;
  appointments_found: number;
  active_patients_identified: number;
  active_patients_stored: number;
  started_at: string | null;
  completed_at: string | null;
  estimated_completion?: string | null;
  errors: string[];
  last_updated: string;
}

export interface SyncDashboardDataResponse {
  organization_id: string;
  current_sync?: {
    sync_id: string;
    status: string;
    progress_percentage: number;
    current_step: string;
    patients_found: number;
    appointments_found: number;
    active_patients_identified: number;
    active_patients_stored: number;
  };
  patient_stats: {
    total_patients: number;
    active_patients: number;
    patients_with_upcoming: number;
    patients_with_recent: number;
    last_sync_time: string | null;
  };
  last_sync?: {
    status: string;
    started_at: string;
    completed_at: string;
    records_success: number;
  };
  sync_available: boolean;
}

export interface SyncHistoryResponse {
  organization_id: string;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  average_sync_duration_seconds: number | null;
  recent_syncs: Array<{
    sync_id: string;
    status: string;
    started_at: string;
    completed_at?: string;
    duration_seconds?: number;
    patients_processed?: number;
    errors?: string[];
  }>;
}

// Add service configuration interfaces
export interface ServiceConfig {
  organization_id: string;
  services: Array<{
    id: string;
    service_name: string;
    is_active: boolean;
    sync_enabled: boolean;
    last_sync_at: string | null;
    service_config: {
      region?: string;
      api_url?: string;
      features?: string[];
      description?: string;
    };
  }>;
  total_services: number;
  active_services: number;
  available_integrations?: string[];
}

export interface ClinikoConnectionTest {
  success: boolean;
  connected: boolean;
  total_patients_available?: number;
  practitioners_count?: number;
  api_url?: string;
  message?: string;
  error?: string;
}

export class RoutiqAPI {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(organizationId?: string) {
    this.baseUrl = API_BASE;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(organizationId && { 'x-organization-id': organizationId })
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: { 
            ...this.defaultHeaders, 
            ...options.headers,
            // Add CORS headers for direct backend calls
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id'
          },
          mode: 'cors', // Enable CORS for cross-origin requests
          ...options
        });

        if (!response.ok) {
          const errorText = await response.text();
          
          // Check if this is a connection error that might be retryable
          if (response.status === 500 && errorText.includes('connection already closed') && attempt < retries) {
            console.warn(`Database connection error on attempt ${attempt + 1}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
            continue;
          }
          
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        return response.json();
      } catch (error) {
        // If it's a network error and we have retries left, try again
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (attempt < retries && (error instanceof TypeError || errorMessage.includes('fetch'))) {
          console.warn(`Network error on attempt ${attempt + 1}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  // ========================================
  // WORKING ENDPOINTS (Available Now)
  // ========================================

  /**
   * Trigger Clerk sync for users/organizations
   * This endpoint works in production right now
   */
  async triggerClerkSync(organizationId: string): Promise<SyncTriggerResponse> {
    return this.request('/api/v1/clerk/sync', {
      method: 'POST',
      body: JSON.stringify({ organization_id: organizationId })
    });
  }

  /**
   * Trigger Cliniko sync for organization (legacy method name for backward compatibility)
   * This endpoint works in production right now
   */
  async triggerSync(organizationId: string): Promise<SyncTriggerResponse> {
    return this.triggerClerkSync(organizationId);
  }

  /**
   * Trigger Cliniko patient sync for organization
   * Available when backend environment is configured
   */
  async triggerClinikoSync(organizationId: string): Promise<SyncTriggerResponse> {
    return this.request(`/api/v1/cliniko/sync/${organizationId}`, {
      method: 'POST'
    });
  }

  /**
   * Get current sync status
   * Uses Next.js API proxy to avoid CORS issues
   */
  async getSyncStatus(): Promise<SyncStatusResponse> {
    return this.request('/api/clerk/status');
  }

  /**
   * Get Cliniko sync status for organization
   * Uses Next.js API proxy to avoid CORS issues
   */
  async getClinikoStatus(organizationId: string): Promise<{
    organization_id: string;
    last_sync_time?: string;
    total_contacts: number;
    active_patients: number;
    upcoming_appointments: number;
    message: string;
  }> {
    return this.request(`/api/cliniko/status/${organizationId}`);
  }

  /**
   * Get database summary with user/org counts
   * This endpoint works in production right now
   */
  async getDatabaseSummary(): Promise<DatabaseSummaryResponse> {
    return this.request('/api/v1/clerk/database-summary');
  }

  /**
   * Basic health check
   * Uses local health endpoint
   */
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request('/api/health');
  }

  // ========================================
  // FUTURE ENDPOINTS (Need Environment Variables)
  // ========================================

  /**
   * Get active patients list for organization
   * Uses Next.js API proxy to avoid CORS issues
   */
  async getActivePatients(organizationId: string, params?: {
    page?: number;
    page_size?: number;
    search_name?: string;
    min_recent_appointments?: number;
    has_upcoming?: boolean;
  }): Promise<{
    organization_id: string;
    patients: ActivePatient[];
    total_count: number;
    timestamp: string;
  }> {
    let url = `/api/patients/${organizationId}/active`;
    
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append('page', params.page.toString());
      if (params.page_size) searchParams.append('page_size', params.page_size.toString());
      if (params.search_name) searchParams.append('search_name', params.search_name);
      if (params.min_recent_appointments) searchParams.append('min_recent_appointments', params.min_recent_appointments.toString());
      if (params.has_upcoming !== undefined) searchParams.append('has_upcoming', params.has_upcoming.toString());
      if (searchParams.toString()) url += `?${searchParams.toString()}`;
    }
    
    const response = await this.request(url);
    return response as {
      organization_id: string;
      patients: ActivePatient[];
      total_count: number;
      timestamp: string;
    };
  }

  /**
   * Get active patients summary for organization
   * Uses Next.js API proxy to avoid CORS issues
   */
  async getActivePatientsummary(organizationId: string): Promise<{
    organization_id: string;
    total_active_patients: number;
    patients_with_recent_appointments: number;
    patients_with_upcoming_appointments: number;
    last_sync_date: string | null;
    timestamp: string;
  }> {
    const response = await this.request(`/api/patients/${organizationId}/active/summary`);
    return response as {
      organization_id: string;
      total_active_patients: number;
      patients_with_recent_appointments: number;
      patients_with_upcoming_appointments: number;
      last_sync_date: string | null;
      timestamp: string;
    };
  }

  /**
   * Get comprehensive sync dashboard
   * Available when backend environment is configured
   */
  async getSyncDashboard(organizationId: string): Promise<SyncDashboardResponse> {
    return this.request(`/api/v1/cliniko/sync/dashboard/${organizationId}`);
  }

  /**
   * Get contacts with appointments
   * Available when backend environment is configured
   */
  async getContactsWithAppointments(organizationId: string): Promise<unknown> {
    return this.request(`/api/v1/cliniko/contacts/${organizationId}/with-appointments`);
  }

  /**
   * Force sync through scheduler (with duplicate prevention)
   * Available when backend environment is configured
   */
  async scheduleSync(organizationId: string): Promise<SyncTriggerResponse> {
    return this.request(`/api/v1/cliniko/sync/schedule/${organizationId}`, {
      method: 'POST'
    });
  }

  // ========================================
  // NEW SYNC DASHBOARD ENDPOINTS (Available Now)
  // ========================================

  /**
   * Start sync with real-time progress tracking
   * NEW: Uses the enhanced sync system with 8-step progress via Railway backend
   * @param organizationId - The organization to sync
   * @param syncMode - The sync mode: 'full' (default), 'incremental', or 'quick'
   */
  async startSyncWithProgress(organizationId: string, syncMode: 'full' | 'incremental' | 'quick' = 'full'): Promise<NewSyncTriggerResponse> {
    return this.request(`/api/v1/sync/start/${organizationId}?sync_mode=${syncMode}`, {
      method: 'POST'
    });
  }

  /**
   * Get real-time sync status and progress
   * NEW: Detailed progress with step-by-step tracking via Railway backend
   */
  async getSyncProgress(syncId: string): Promise<SyncProgressResponse> {
    return this.request(`/api/v1/sync/status/${syncId}`);
  }

  /**
   * Get comprehensive sync dashboard data
   * NEW: Complete dashboard view with current sync, stats, and history via Railway backend
   */
  async getNewSyncDashboard(organizationId: string): Promise<SyncDashboardDataResponse> {
    return this.request(`/api/v1/sync/dashboard/${organizationId}`);
  }

  /**
   * Get sync history for organization
   * NEW: Historical sync data with success rates and performance metrics via Railway backend
   */
  async getSyncHistory(organizationId: string, limit: number = 10): Promise<SyncHistoryResponse> {
    return this.request(`/api/v1/sync/history/${organizationId}?limit=${limit}`);
  }

  /**
   * Cancel a running sync operation
   * NEW: Ability to cancel long-running syncs (Railway backend)
   */
  async cancelSync(syncId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/v1/sync/cancel/${syncId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all currently active sync operations
   * NEW: System-wide view of active syncs (Railway backend)
   */
  async getActiveSyncs(): Promise<{ active_syncs: SyncProgressResponse[] }> {
    return this.request(`/api/v1/sync/active`);
  }

  /**
   * Create EventSource for real-time sync updates
   * NEW: Server-Sent Events for live progress updates (Railway backend)
   */
  createSyncEventSource(syncId: string): EventSource {
    return new EventSource(`${API_BASE}/api/v1/sync/stream/${syncId}`);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Test if advanced endpoints are available
   */
  async testAdvancedEndpoints(organizationId: string): Promise<boolean> {
    try {
      await this.getActivePatientsummary(organizationId);
      return true;
    } catch (_error) {
      console.log('Advanced endpoints not yet available:', _error);
      return false;
    }
  }

  /**
   * Test if new sync dashboard endpoints are available
   */
  async testNewSyncEndpoints(organizationId: string): Promise<boolean> {
    try {
      await this.getNewSyncDashboard(organizationId);
      return true;
    } catch (_error) {
      console.log('New sync dashboard not yet available:', _error);
      return false;
    }
  }

  /**
   * Get available features based on what endpoints work
   */
  async getAvailableFeatures(organizationId: string): Promise<{
    basic_sync: boolean;
    active_patients: boolean;
    dashboard: boolean;
    new_sync_dashboard: boolean;
  }> {
    const features = {
      basic_sync: false,
      active_patients: false,
      dashboard: false,
      new_sync_dashboard: false
    };

    try {
      await this.getSyncStatus();
      features.basic_sync = true;
    } catch (_error) {
      console.log('Basic sync not available');
    }

    try {
      await this.getActivePatientsummary(organizationId);
      features.active_patients = true;
      features.dashboard = true;
    } catch (_error) {
      console.log('Advanced features not yet available');
    }

    try {
      await this.getNewSyncDashboard(organizationId);
      features.new_sync_dashboard = true;
    } catch (_error) {
      console.log('New sync dashboard not yet available');
    }

    return features;
  }

  /**
   * Check organization service configuration
   */
  async getServiceConfig(organizationId: string): Promise<ServiceConfig> {
    // The API route uses the current Clerk organization context, so organizationId is not needed in the URL
    return this.request(`/api/debug/organization-services`);
  }

  /**
   * Test Cliniko connection for organization
   */
  async testClinikoConnection(organizationId: string): Promise<ClinikoConnectionTest> {
    try {
      const data = await this.request(`/api/cliniko/test-connection/${organizationId}`);
      const response = data as {
        success?: boolean;
        total_patients_available?: number;
        practitioners_count?: number;
        api_url?: string;
        message?: string;
        error?: string;
      };
      
      if (response.success) {
        return {
          success: true,
          connected: true,
          total_patients_available: response.total_patients_available,
          practitioners_count: response.practitioners_count,
          api_url: response.api_url
        };
      }
      
      return { 
        success: false, 
        connected: false, 
        error: response.message || response.error || 'Connection test failed' 
      };
    } catch (error) {
      return {
        success: false, 
        connected: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }
}

// Default API instance for Surf Rehab
export const api = new RoutiqAPI(ORGANIZATIONS.SURF_REHAB);

// Utility function to create organization-specific API instance
export const createOrgAPI = (organizationId: string) => new RoutiqAPI(organizationId); 