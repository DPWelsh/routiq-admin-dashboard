# Frontend Implementation Guide
## Routiq Backend Integration - Working APIs & Code Examples

**Backend API Base URL**: `https://routiq-backend-prod.up.railway.app`  
**Organization ID**: `org_2xwHiNrj68eaRUlX10anlXGvzX7`  
**Status**: ✅ All APIs tested and working (December 24, 2024)

---

## 🚀 **Quick Start - Working API Calls**

### **1. Check Service Configuration**
```typescript
// ✅ WORKING - Check if Cliniko is configured for organization
const checkServiceConfig = async (orgId: string) => {
  try {
    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/admin/organization-services/${orgId}`
    );
    const data = await response.json();
    
    if (data.active_services > 0) {
      console.log('✅ Services configured:', data.available_integrations);
      return data;
    } else {
      console.log('❌ No services configured');
      return null;
    }
  } catch (error) {
    console.error('Service config check failed:', error);
    return null;
  }
};

// Usage
const config = await checkServiceConfig('org_2xwHiNrj68eaRUlX10anlXGvzX7');
```

### **2. Get Cliniko Status**
```typescript
// ✅ WORKING - Get current sync status and patient counts
const getClinikoStatus = async (orgId: string) => {
  try {
    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/cliniko/status/${orgId}`
    );
    const data = await response.json();
    
    return {
      connected: data.status === 'connected',
      totalPatients: data.total_patients,
      activePatients: data.active_patients,
      syncPercentage: data.sync_percentage,
      lastSync: data.last_sync_time
    };
  } catch (error) {
    console.error('Cliniko status check failed:', error);
    return null;
  }
};

// Usage
const status = await getClinikoStatus('org_2xwHiNrj68eaRUlX10anlXGvzX7');
console.log(`${status.totalPatients} patients, ${status.syncPercentage}% synced`);
```

### **3. Test API Connection**
```typescript
// ✅ WORKING - Test if Cliniko API is accessible
const testConnection = async (orgId: string) => {
  try {
    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/cliniko/test-connection/${orgId}`
    );
    const data = await response.json();
    
    if (data.success) {
      return {
        connected: true,
        availablePatients: data.total_patients_available,
        practitioners: data.practitioners_count,
        apiUrl: data.api_url
      };
    }
    return { connected: false, error: data.message };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};
```

---

## 🎯 **React Components - Ready to Use**

### **Service Status Dashboard Component**
```tsx
import React, { useState, useEffect } from 'react';

interface ServiceStatus {
  cliniko: {
    configured: boolean;
    connected: boolean;
    totalPatients: number;
    activePatients: number;
    syncPercentage: number;
    lastSync: string | null;
  };
}

const ServiceStatusDashboard: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        
        // Check service configuration
        const configResponse = await fetch(
          `https://routiq-backend-prod.up.railway.app/api/v1/admin/organization-services/${organizationId}`
        );
        const configData = await configResponse.json();
        
        const clinikoConfigured = configData.available_integrations?.includes('cliniko') || false;
        
        if (clinikoConfigured) {
          // Get Cliniko status
          const statusResponse = await fetch(
            `https://routiq-backend-prod.up.railway.app/api/v1/cliniko/status/${organizationId}`
          );
          const statusData = await statusResponse.json();
          
          setStatus({
            cliniko: {
              configured: true,
              connected: statusData.status === 'connected',
              totalPatients: statusData.total_patients || 0,
              activePatients: statusData.active_patients || 0,
              syncPercentage: statusData.sync_percentage || 0,
              lastSync: statusData.last_sync_time
            }
          });
        } else {
          setStatus({
            cliniko: {
              configured: false,
              connected: false,
              totalPatients: 0,
              activePatients: 0,
              syncPercentage: 0,
              lastSync: null
            }
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  if (loading) return <div className="loading">Loading service status...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!status) return <div className="error">No status data available</div>;

  return (
    <div className="service-status-dashboard">
      <h2>Integration Status</h2>
      
      <div className="service-card">
        <div className="service-header">
          <h3>Cliniko Practice Management</h3>
          <div className={`status-badge ${status.cliniko.connected ? 'connected' : 'disconnected'}`}>
            {status.cliniko.configured ? 
              (status.cliniko.connected ? '✅ Connected' : '⚠️ Configured but not connected') : 
              '❌ Not configured'
            }
          </div>
        </div>
        
        {status.cliniko.configured && (
          <div className="service-stats">
            <div className="stat">
              <span className="label">Total Patients:</span>
              <span className="value">{status.cliniko.totalPatients.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Active Patients:</span>
              <span className="value">{status.cliniko.activePatients.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Sync Progress:</span>
              <span className="value">{status.cliniko.syncPercentage.toFixed(1)}%</span>
            </div>
            {status.cliniko.lastSync && (
              <div className="stat">
                <span className="label">Last Sync:</span>
                <span className="value">{new Date(status.cliniko.lastSync).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceStatusDashboard;
```

### **Sync Progress Component**
```tsx
import React, { useState, useEffect } from 'react';

interface SyncProgressProps {
  organizationId: string;
  onSyncComplete?: (result: any) => void;
}

const SyncProgressTracker: React.FC<SyncProgressProps> = ({ organizationId, onSyncComplete }) => {
  const [syncId, setSyncId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('idle');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  const startSync = async () => {
    try {
      setIsRunning(true);
      const response = await fetch(
        `https://routiq-backend-prod.up.railway.app/api/v1/sync/start/${organizationId}`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.sync_id) {
        setSyncId(data.sync_id);
        pollSyncStatus(data.sync_id);
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
      setIsRunning(false);
    }
  };

  const pollSyncStatus = async (id: string) => {
    try {
      const response = await fetch(
        `https://routiq-backend-prod.up.railway.app/api/v1/sync/status/${id}`
      );
      const data = await response.json();
      
      setProgress(data.progress_percentage || 0);
      setStatus(data.status || 'unknown');
      setCurrentStep(data.current_step || '');
      
      if (data.status === 'completed') {
        setIsRunning(false);
        onSyncComplete?.(data);
      } else if (data.status === 'failed') {
        setIsRunning(false);
        console.error('Sync failed:', data.errors);
      } else if (data.status !== 'idle') {
        // Continue polling
        setTimeout(() => pollSyncStatus(id), 2000);
      }
    } catch (error) {
      console.error('Failed to get sync status:', error);
      setIsRunning(false);
    }
  };

  return (
    <div className="sync-progress-tracker">
      <div className="sync-controls">
        <button 
          onClick={startSync} 
          disabled={isRunning}
          className={`sync-button ${isRunning ? 'running' : 'ready'}`}
        >
          {isRunning ? 'Syncing...' : 'Start Sync'}
        </button>
      </div>
      
      {isRunning && (
        <div className="sync-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="sync-details">
            <div className="status">Status: {status}</div>
            <div className="step">Step: {currentStep}</div>
            <div className="percentage">{progress}% Complete</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncProgressTracker;
```

---

## 🔧 **Error Handling & Best Practices**

### **1. Robust Error Handling**
```typescript
class RoutiqAPIClient {
  private baseURL = 'https://routiq-backend-prod.up.railway.app/api/v1';
  
  async request(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Routiq backend');
      }
      throw error;
    }
  }
  
  // Service methods
  async getServiceConfig(orgId: string) {
    return this.request(`/admin/organization-services/${orgId}`);
  }
  
  async getClinikoStatus(orgId: string) {
    return this.request(`/cliniko/status/${orgId}`);
  }
  
  async testClinikoConnection(orgId: string) {
    return this.request(`/cliniko/test-connection/${orgId}`);
  }
  
  async startSync(orgId: string) {
    return this.request(`/sync/start/${orgId}`, { method: 'POST' });
  }
  
  async getSyncStatus(syncId: string) {
    return this.request(`/sync/status/${syncId}`);
  }
}

// Usage
const api = new RoutiqAPIClient();
```

### **2. Loading States & User Feedback**
```tsx
const useServiceStatus = (organizationId: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const api = new RoutiqAPIClient();
      const [config, status] = await Promise.all([
        api.getServiceConfig(organizationId),
        api.getClinikoStatus(organizationId).catch(() => null)
      ]);
      
      setData({ config, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    refresh();
  }, [organizationId]);
  
  return { data, loading, error, refresh };
};
```

### **3. Real-time Updates**
```typescript
// WebSocket-style polling for real-time sync updates
const useSyncProgress = (syncId: string | null) => {
  const [progress, setProgress] = useState(null);
  
  useEffect(() => {
    if (!syncId) return;
    
    const pollProgress = async () => {
      try {
        const api = new RoutiqAPIClient();
        const status = await api.getSyncStatus(syncId);
        setProgress(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          return; // Stop polling
        }
        
        setTimeout(pollProgress, 2000); // Poll every 2 seconds
      } catch (error) {
        console.error('Polling failed:', error);
      }
    };
    
    pollProgress();
  }, [syncId]);
  
  return progress;
};
```

---

## 📊 **Data Models & TypeScript Interfaces**

```typescript
// API Response Types
interface ServiceConfig {
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
}

interface ClinikoStatus {
  organization_id: string;
  last_sync_time: string | null;
  total_patients: number;
  active_patients: number;
  synced_patients: number;
  sync_percentage: number;
  status: 'connected' | 'disconnected' | 'error';
}

interface SyncProgress {
  organization_id: string;
  sync_id: string;
  status: 'idle' | 'starting' | 'fetching_patients' | 'fetching_appointments' | 'analyzing' | 'storing' | 'completed' | 'failed';
  progress_percentage: number;
  current_step: string;
  total_steps: number;
  patients_found: number;
  appointments_found: number;
  active_patients_identified: number;
  active_patients_stored: number;
  started_at: string | null;
  completed_at: string | null;
  errors: string[];
}
```

---

## 🎨 **CSS Styles for Components**

```css
/* Service Status Dashboard */
.service-status-dashboard {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.service-card {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
}

.status-badge.connected {
  background: #d4edda;
  color: #155724;
}

.status-badge.disconnected {
  background: #f8d7da;
  color: #721c24;
}

.service-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.stat .label {
  color: #666;
  font-weight: 500;
}

.stat .value {
  color: #333;
  font-weight: 600;
}

/* Sync Progress */
.sync-progress-tracker {
  padding: 20px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: white;
}

.sync-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.sync-button:hover:not(:disabled) {
  background: #0056b3;
}

.sync-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.sync-button.running {
  background: #28a745;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  margin: 16px 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.sync-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  font-size: 14px;
  color: #666;
}

/* Loading and Error States */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.error {
  padding: 16px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin: 16px 0;
}
```

---

## 🚀 **Implementation Checklist**

### **Phase 1: Basic Integration (30 minutes)**
- [ ] Install the API client code
- [ ] Test service configuration endpoint
- [ ] Display basic Cliniko status
- [ ] Add error handling

### **Phase 2: Enhanced UI (1-2 hours)**
- [ ] Implement ServiceStatusDashboard component
- [ ] Add loading states and error boundaries
- [ ] Style the components with provided CSS
- [ ] Test with real organization ID

### **Phase 3: Sync Functionality (1-2 hours)**
- [ ] Implement SyncProgressTracker component
- [ ] Add real-time progress polling
- [ ] Handle sync completion/failure states
- [ ] Add user feedback and notifications

### **Phase 4: Production Ready (30 minutes)**
- [ ] Add proper TypeScript interfaces
- [ ] Implement comprehensive error handling
- [ ] Add retry logic for failed requests
- [ ] Test edge cases and error scenarios

---

## 📞 **Support & Troubleshooting**

### **Common Issues & Solutions**

1. **CORS Errors**: 
   - Backend already configured for CORS
   - Ensure you're using the correct domain

2. **Network Timeouts**:
   - Add timeout handling to fetch requests
   - Implement retry logic for transient failures

3. **Stale Data**:
   - Use the refresh functions provided
   - Implement auto-refresh for real-time data

### **API Testing Commands**
```bash
# Test service config
curl "https://routiq-backend-prod.up.railway.app/api/v1/admin/organization-services/org_2xwHiNrj68eaRUlX10anlXGvzX7"

# Test Cliniko status  
curl "https://routiq-backend-prod.up.railway.app/api/v1/cliniko/status/org_2xwHiNrj68eaRUlX10anlXGvzX7"

# Test connection
curl "https://routiq-backend-prod.up.railway.app/api/v1/cliniko/test-connection/org_2xwHiNrj68eaRUlX10anlXGvzX7"
```

---

**✅ All APIs tested and working as of December 24, 2024**  
**🔗 Backend**: https://routiq-backend-prod.up.railway.app  
**📊 Status**: Production ready for frontend integration 