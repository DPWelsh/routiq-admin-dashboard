import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Users, 
  Calendar, 
  Database, 
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2
} from 'lucide-react';

// Types
interface SyncStatus {
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
  started_at?: string;
  completed_at?: string;
  errors: string[];
  last_updated: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface SyncDashboardProps {
  organizationId: string;
  apiBaseUrl?: string;
}

const SyncDashboard: React.FC<SyncDashboardProps> = ({ 
  organizationId, 
  apiBaseUrl = 'http://localhost:8000/api/v1' 
}) => {
  // State
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      message: 'Dashboard initialized',
      type: 'info'
    }
  ]);
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Add log entry
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message,
      type
    };
    
    setLogs(prev => [newLog, ...prev.slice(0, 9)]); // Keep only last 10 logs
  }, []);

  // Start sync
  const startSync = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/sync/start/${organizationId}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.sync_id) {
        setCurrentSyncId(data.sync_id);
        addLog('Sync started successfully', 'success');
        setIsPolling(true);
      } else {
        addLog('Failed to start sync', 'error');
      }
    } catch (error) {
      addLog(`Error starting sync: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel sync
  const cancelSync = async () => {
    if (!currentSyncId) return;
    
    try {
      await fetch(`${apiBaseUrl}/sync/cancel/${currentSyncId}`, {
        method: 'DELETE'
      });
      
      addLog('Sync cancelled', 'success');
      setIsPolling(false);
      setCurrentSyncId(null);
    } catch (error) {
      addLog(`Error cancelling sync: ${error}`, 'error');
    }
  };

  // Update sync status
  const updateSyncStatus = useCallback(async () => {
    if (!currentSyncId) return;
    
    try {
      const response = await fetch(`${apiBaseUrl}/sync/status/${currentSyncId}`);
      const data = await response.json();
      
      setSyncStatus(data);
      
      // Add log for step changes
      if (data.current_step && (!syncStatus || data.current_step !== syncStatus.current_step)) {
        addLog(data.current_step);
      }
      
      // Stop polling if sync is complete
      if (data.status === 'completed' || data.status === 'failed') {
        setIsPolling(false);
        setCurrentSyncId(null);
        
        if (data.status === 'completed') {
          addLog('Sync completed successfully!', 'success');
        } else {
          addLog(`Sync failed: ${data.errors?.join(', ') || 'Unknown error'}`, 'error');
        }
      }
    } catch (error) {
      addLog(`Error updating status: ${error}`, 'error');
    }
  }, [currentSyncId, syncStatus, apiBaseUrl, addLog]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/sync/dashboard/${organizationId}`);
      const data = await response.json();
      
      if (data.current_sync) {
        setCurrentSyncId(data.current_sync.sync_id);
        setSyncStatus(data.current_sync);
        setIsPolling(true);
      } else if (data.patient_stats) {
        // Set static stats if no active sync
        setSyncStatus(prev => ({
          ...prev,
          organization_id: organizationId,
          sync_id: '',
          status: 'idle',
          progress_percentage: 0,
          current_step: 'Ready to sync',
          total_steps: 8,
          current_step_number: 0,
          patients_found: data.patient_stats.total_patients || 0,
          appointments_found: 0,
          active_patients_identified: data.patient_stats.active_patients || 0,
          active_patients_stored: data.patient_stats.active_patients || 0,
          errors: [],
          last_updated: new Date().toISOString()
        } as SyncStatus));
      }
    } catch (error) {
      addLog(`Error loading dashboard: ${error}`, 'error');
    }
  }, [organizationId, apiBaseUrl, addLog]);

  // Polling effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPolling && currentSyncId) {
      interval = setInterval(updateSyncStatus, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPolling, currentSyncId, updateSyncStatus]);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Status badge styling
  const getStatusBadgeClass = (status: string) => {
    const baseClass = "px-3 py-1 rounded-full text-sm font-medium";
    switch (status) {
      case 'idle': return `${baseClass} bg-gray-100 text-gray-700`;
      case 'starting': return `${baseClass} bg-yellow-100 text-yellow-700`;
      case 'fetching_patients':
      case 'fetching_appointments': return `${baseClass} bg-blue-100 text-blue-700`;
      case 'analyzing': return `${baseClass} bg-purple-100 text-purple-700`;
      case 'storing': return `${baseClass} bg-green-100 text-green-700`;
      case 'completed': return `${baseClass} bg-green-100 text-green-700`;
      case 'failed': return `${baseClass} bg-red-100 text-red-700`;
      default: return `${baseClass} bg-gray-100 text-gray-700`;
    }
  };

  // Progress bar color
  const getProgressColor = (status: string) => {
    if (status === 'failed') return 'bg-red-500';
    if (status === 'completed') return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
        <h1 className="text-3xl font-bold mb-2">🔄 Sync Dashboard</h1>
        <p className="text-blue-100">Real-time Cliniko data synchronization</p>
      </div>

      <div className="p-6">
        {/* Controls */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={startSync}
            disabled={isLoading || isPolling}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isLoading ? 'Starting...' : 'Start Sync'}
          </button>

          <button
            onClick={cancelSync}
            disabled={!isPolling}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Square className="w-4 h-4" />
            Cancel Sync
          </button>

          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Status Section */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Current Sync Status</h3>
            <span className={getStatusBadgeClass(syncStatus?.status || 'idle')}>
              {syncStatus?.status?.replace('_', ' ').toUpperCase() || 'IDLE'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(syncStatus?.status || 'idle')}`}
                style={{ width: `${syncStatus?.progress_percentage || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>{syncStatus?.current_step || 'Ready to sync'}</span>
              <span>{syncStatus?.progress_percentage || 0}%</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-8 h-8 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {syncStatus?.patients_found || 0}
              </div>
              <div className="text-sm text-gray-600">Patients Found</div>
            </div>

            <div className="bg-white p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center mb-2">
                <Calendar className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {syncStatus?.appointments_found || 0}
              </div>
              <div className="text-sm text-gray-600">Appointments Found</div>
            </div>

            <div className="bg-white p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="w-8 h-8 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {syncStatus?.active_patients_identified || 0}
              </div>
              <div className="text-sm text-gray-600">Active Patients</div>
            </div>

            <div className="bg-white p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center mb-2">
                <Database className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {syncStatus?.active_patients_stored || 0}
              </div>
              <div className="text-sm text-gray-600">Patients Stored</div>
            </div>
          </div>
        </div>

        {/* Live Logs */}
        <div className="bg-white rounded-lg border">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">Live Sync Logs</h3>
            <button
              onClick={() => setLogs([{ id: '1', timestamp: new Date().toISOString(), message: 'Logs cleared', type: 'info' }])}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Logs
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className={`p-3 border-b last:border-b-0 ${
                log.type === 'error' ? 'bg-red-50' : 
                log.type === 'success' ? 'bg-green-50' : 
                'bg-white'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {log.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : log.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={`text-sm ${
                      log.type === 'error' ? 'text-red-700' :
                      log.type === 'success' ? 'text-green-700' :
                      'text-gray-700'
                    }`}>
                      {log.message}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncDashboard; 