# Frontend Admin Panel - Live Sync Implementation Guide

This guide covers how to implement **real-time patient sync** functionality in your admin dashboard, with progress tracking and live updates.

## 🚀 **Quick Start**

The sync system now supports **ALL patients sync** (not just active ones) with real-time progress monitoring.

### Basic Sync Flow
```typescript
// 1. Start sync
const response = await fetch(`/api/v1/cliniko/sync-all/${orgId}`, { method: 'POST' })

// 2. Monitor progress
const syncId = await pollSyncProgress(orgId)

// 3. Get final results
const status = await fetch(`/api/v1/cliniko/status/${orgId}`)
```

## 📡 **API Endpoints**

### Sync Management

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|-----------|
| `/api/v1/cliniko/sync-all/{orgId}` | POST | Start **ALL patients sync** | `{ success: true, message: "Sync started" }` |
| `/api/v1/cliniko/sync/{orgId}` | POST | ⚠️ **Deprecated**: Now redirects to sync-all | Same as above |
| `/api/v1/cliniko/test-connection/{orgId}` | GET | Test Cliniko API connection | Connection status + patient count |

### Monitoring & Status

| Endpoint | Method | Purpose | Real-time? |
|----------|--------|---------|------------|
| `/api/v1/cliniko/sync-logs/{orgId}?limit=1` | GET | **Real-time sync progress** | ✅ Poll every 2-3s |
| `/api/v1/cliniko/status/{orgId}` | GET | Final patient counts | ❌ Only after completion |
| `/api/v1/cliniko/active-patients/{orgId}` | GET | List synced patients | ❌ Post-sync verification |

## 🔄 **Real-Time Progress Monitoring**

### 1. Start Sync and Monitor

```typescript
async function startSyncWithProgress(orgId: string) {
  // Start sync
  const startResponse = await fetch(`/api/v1/cliniko/sync-all/${orgId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (!startResponse.ok) {
    throw new Error(`Failed to start sync: ${startResponse.status}`)
  }
  
  const result = await startResponse.json()
  console.log('✅ Sync started:', result.message)
  
  // Monitor progress
  return await monitorSyncProgress(orgId)
}
```

### 2. Progress Polling Implementation

```typescript
interface SyncProgress {
  status: 'completed' | 'failed' | 'running'
  type: 'full_patients' | 'active_patients'  
  recordsProcessed: number
  recordsSuccess: number
  successRate: number
  startedAt: string
  completedAt?: string
  metadata: {
    patients_found?: number
    patients_stored?: number
    sync_type?: string
    errors?: string[]
  }
}

async function monitorSyncProgress(orgId: string): Promise<SyncProgress> {
  const maxWaitTime = 300000 // 5 minutes
  const pollInterval = 2000   // 2 seconds
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(`/api/v1/cliniko/sync-logs/${orgId}?limit=1`)
      const data = await response.json()
      
      if (data.logs?.length > 0) {
        const latestLog = data.logs[0]
        const progress: SyncProgress = {
          status: latestLog.status,
          type: latestLog.operation_type,
          recordsProcessed: latestLog.records_processed || 0,
          recordsSuccess: latestLog.records_success || 0,
          successRate: latestLog.records_processed > 0 
            ? (latestLog.records_success / latestLog.records_processed) * 100 
            : 0,
          startedAt: latestLog.started_at,
          completedAt: latestLog.completed_at,
          metadata: typeof latestLog.metadata === 'string' 
            ? JSON.parse(latestLog.metadata) 
            : latestLog.metadata || {}
        }
        
        // Update UI with progress
        updateSyncUI(progress)
        
        // Check if completed
        if (progress.status === 'completed') {
          console.log('✅ Sync completed successfully!')
          return progress
        } else if (progress.status === 'failed') {
          console.error('❌ Sync failed:', progress.metadata.errors)
          throw new Error(`Sync failed: ${progress.metadata.errors?.join(', ')}`)
        }
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      
    } catch (error) {
      console.error('Error polling sync progress:', error)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
  
  throw new Error('Sync monitoring timeout after 5 minutes')
}
```

### 3. UI Progress Updates

```typescript
function updateSyncUI(progress: SyncProgress) {
  const progressPercent = progress.recordsProcessed > 0 
    ? (progress.recordsSuccess / progress.recordsProcessed) * 100 
    : 0
  
  // Update progress bar
  document.querySelector('.progress-bar')!.style.width = `${progressPercent}%`
  
  // Update status text
  document.querySelector('.sync-status')!.textContent = 
    `Processing ${progress.recordsSuccess}/${progress.recordsProcessed} patients (${progressPercent.toFixed(1)}%)`
  
  // Update step indicator
  const stepText = getStepText(progress)
  document.querySelector('.current-step')!.textContent = stepText
  
  // Update activity log
  addActivityLogEntry(`${new Date().toLocaleTimeString()}: ${stepText}`)
}

function getStepText(progress: SyncProgress): string {
  const { metadata } = progress
  
  if (progress.status === 'completed') {
    return `✅ Sync completed! ${progress.recordsSuccess} patients updated`
  }
  
  if (metadata.patients_found && metadata.patients_stored !== undefined) {
    return `💾 Storing patients in database (${metadata.patients_stored}/${metadata.patients_found})`
  }
  
  if (metadata.patients_found) {
    return `📊 Processing ${metadata.patients_found} patients from Cliniko`
  }
  
  return '🔄 Syncing in progress...'
}
```

## 🎨 **UI Components**

### Sync Button States

```tsx
interface SyncButtonProps {
  orgId: string
  onSyncComplete?: (result: SyncProgress) => void
}

function SyncButton({ orgId, onSyncComplete }: SyncButtonProps) {
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'completed' | 'failed'>('idle')
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  
  const handleSync = async () => {
    setSyncState('syncing')
    setProgress(null)
    
    try {
      const result = await startSyncWithProgress(orgId)
      setSyncState('completed')
      setProgress(result)
      onSyncComplete?.(result)
    } catch (error) {
      setSyncState('failed')
      console.error('Sync failed:', error)
    }
  }
  
  return (
    <div className="sync-control">
      {syncState === 'idle' && (
        <button onClick={handleSync} className="btn-primary">
          🔄 Start Full Sync
        </button>
      )}
      
      {syncState === 'syncing' && (
        <div className="sync-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress?.successRate || 0}%` }}
            />
          </div>
          <div className="sync-status">
            {getStepText(progress)}
          </div>
          <div className="sync-stats">
            {progress?.recordsSuccess || 0}/{progress?.recordsProcessed || 0} patients
          </div>
        </div>
      )}
      
      {syncState === 'completed' && (
        <div className="sync-success">
          ✅ Sync completed! {progress?.recordsSuccess} patients updated
          <button onClick={() => setSyncState('idle')} className="btn-secondary">
            Sync Again
          </button>
        </div>
      )}
      
      {syncState === 'failed' && (
        <div className="sync-error">
          ❌ Sync failed
          <button onClick={() => setSyncState('idle')} className="btn-secondary">
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
```

### Live Activity Log

```tsx
function LiveActivityLog({ orgId }: { orgId: string }) {
  const [activities, setActivities] = useState<string[]>([])
  
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/cliniko/sync-logs/${orgId}?limit=5`)
        const data = await response.json()
        
        const newActivities = data.logs.map((log: any) => 
          `${new Date(log.started_at).toLocaleTimeString()}: ${getActivityMessage(log)}`
        )
        
        setActivities(newActivities)
      } catch (error) {
        console.error('Error fetching activity:', error)
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [orgId])
  
  return (
    <div className="activity-log">
      <h3>Live Activity Log</h3>
      <div className="activity-entries">
        {activities.map((activity, i) => (
          <div key={i} className="activity-entry">
            {activity}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 📊 **Expected Sync Performance**

### Typical Sync Times
- **Small Practice** (< 100 patients): 5-15 seconds
- **Medium Practice** (100-500 patients): 15-45 seconds  
- **Large Practice** (500+ patients): 45-120 seconds

### Progress Milestones
1. **Connection** (0-5%): Validate Cliniko credentials
2. **API Fetch** (5-30%): Download patient data from Cliniko
3. **Processing** (30-50%): Transform data for database
4. **Database Storage** (50-100%): Upsert patients with progress logging

### Success Criteria
- ✅ **100% success rate** for patient storage
- ✅ **Full patients sync** (not just active ones)
- ✅ **Real-time progress** updates every 2-3 seconds
- ✅ **Database integrity** maintained with conflict resolution

## 🔧 **Troubleshooting**

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Sync appears to hang | No progress polling | Implement real-time monitoring |
| Only 34/648 patients sync | Using old active-only endpoint | Use `/sync-all/` endpoint |
| Database constraint errors | Missing unique constraint | Run migration (see below) |
| Timeout after 30s | Insufficient wait time | Increase to 5+ minutes |

### Required Database Migration

Ensure this constraint exists:
```sql
-- Required for proper sync conflict resolution
ALTER TABLE patients 
ADD CONSTRAINT patients_org_cliniko_patient_unique 
UNIQUE (organization_id, cliniko_patient_id);
```

### API Testing

```bash
# Test connection
curl -X GET "https://your-api.com/api/v1/cliniko/test-connection/{orgId}"

# Start sync
curl -X POST "https://your-api.com/api/v1/cliniko/sync-all/{orgId}"

# Monitor progress
curl -X GET "https://your-api.com/api/v1/cliniko/sync-logs/{orgId}?limit=1"
```

## 🎯 **Implementation Checklist**

### Frontend Requirements
- [ ] Replace static sync button with progress-enabled component
- [ ] Implement real-time polling (every 2-3 seconds)
- [ ] Add progress bar with percentage
- [ ] Show current step/status text
- [ ] Display patient count progress (X/Y patients)
- [ ] Add activity log with timestamps
- [ ] Handle sync errors gracefully
- [ ] Update dashboard counters in real-time

### Backend Verification
- [ ] `/sync-all/` endpoint returns ALL patients (not just active)
- [ ] Database constraint `patients_org_cliniko_patient_unique` exists
- [ ] Sync logs include detailed metadata
- [ ] Progress logging every 50 patients or 10%
- [ ] 100% success rate for patient storage

### Testing
- [ ] Test with large patient dataset (500+ patients)
- [ ] Verify progress updates appear every 2-3 seconds
- [ ] Confirm final patient count matches Cliniko total
- [ ] Test error handling and retry functionality
- [ ] Validate UI remains responsive during sync

## 📚 **Related Documentation**

- [API Reference](./API_REFERENCE.md) - Complete endpoint documentation
- [Database Schema](./DATABASE_SCHEMA.md) - Patients table structure
- [Error Handling](./ERROR_HANDLING.md) - Sync failure scenarios
- [Performance Guide](./PERFORMANCE.md) - Optimization recommendations 