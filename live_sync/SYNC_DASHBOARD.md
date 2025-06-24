# 🔄 Sync Dashboard & Visual Feedback System

The Routiq Backend now includes a comprehensive sync status and progress tracking system that provides real-time visual feedback for data synchronization operations.

## 🎯 Features

### ✅ **Real-Time Progress Tracking**
- Step-by-step progress indicators (8 total steps)
- Percentage completion with animated progress bars
- Live status updates every second during sync
- Detailed step descriptions ("Fetching patients...", "Analyzing data...", etc.)

### ✅ **Visual Status Indicators**
- Color-coded status badges for different sync states
- Progress bars with dynamic colors (blue = in progress, green = success, red = error)
- Live statistics showing patients found, appointments processed, etc.
- Real-time logs with timestamps and categorized messages

### ✅ **Interactive Controls**
- Start/Cancel sync operations
- Refresh status manually
- Clear logs functionality
- Automatic polling during active syncs

## 🚀 API Endpoints

### **Start Sync with Progress**
```http
POST /api/v1/sync/start/{organization_id}
```
**Response:**
```json
{
  "message": "Sync started",
  "sync_id": "sync_org_2xwHiNrj68eaRUlX10anlXGvzX7_20241222_143022",
  "organization_id": "org_2xwHiNrj68eaRUlX10anlXGvzX7",
  "status": "starting"
}
```

### **Get Sync Status**
```http
GET /api/v1/sync/status/{sync_id}
```
**Response:**
```json
{
  "organization_id": "org_2xwHiNrj68eaRUlX10anlXGvzX7",
  "sync_id": "sync_org_2xwHiNrj68eaRUlX10anlXGvzX7_20241222_143022",
  "status": "fetching_patients",
  "progress_percentage": 50,
  "current_step": "Found 641 patients",
  "total_steps": 8,
  "current_step_number": 4,
  "patients_found": 641,
  "appointments_found": 1247,
  "active_patients_identified": 89,
  "active_patients_stored": 89,
  "started_at": "2024-12-22T14:30:22.123Z",
  "completed_at": null,
  "errors": [],
  "last_updated": "2024-12-22T14:30:45.456Z"
}
```

### **Get Dashboard Data**
```http
GET /api/v1/sync/dashboard/{organization_id}
```
**Response:**
```json
{
  "organization_id": "org_2xwHiNrj68eaRUlX10anlXGvzX7",
  "current_sync": {
    "sync_id": "sync_org_2xwHiNrj68eaRUlX10anlXGvzX7_20241222_143022",
    "status": "analyzing",
    "progress_percentage": 75,
    "current_step": "Analyzing active patients...",
    "patients_found": 641,
    "appointments_found": 1247,
    "active_patients_identified": 89,
    "active_patients_stored": 0
  },
  "patient_stats": {
    "total_patients": 89,
    "active_patients": 89,
    "patients_with_upcoming": 23,
    "patients_with_recent": 66,
    "last_sync_time": "2024-12-22T14:25:15.789Z"
  },
  "last_sync": {
    "status": "completed",
    "started_at": "2024-12-22T14:25:00.000Z",
    "completed_at": "2024-12-22T14:25:15.789Z",
    "records_success": 89
  },
  "sync_available": true
}
```

### **Get Sync History**
```http
GET /api/v1/sync/history/{organization_id}?limit=10
```

### **Cancel Sync**
```http
DELETE /api/v1/sync/cancel/{sync_id}
```

### **Stream Real-Time Updates (Server-Sent Events)**
```http
GET /api/v1/sync/stream/{sync_id}
```

## 🎨 Frontend Integration

### **HTML/JavaScript Dashboard**
A complete HTML dashboard is available at `examples/sync_dashboard.html`:

```html
<!-- Simple integration -->
<script>
const ORGANIZATION_ID = 'org_2xwHiNrj68eaRUlX10anlXGvzX7';
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Start sync
async function startSync() {
  const response = await fetch(`${API_BASE_URL}/sync/start/${ORGANIZATION_ID}`, {
    method: 'POST'
  });
  const data = await response.json();
  console.log('Sync started:', data.sync_id);
}

// Poll for updates
setInterval(async () => {
  if (currentSyncId) {
    const response = await fetch(`${API_BASE_URL}/sync/status/${currentSyncId}`);
    const status = await response.json();
    updateUI(status);
  }
}, 1000);
</script>
```

### **React Component**
A React TypeScript component is available at `examples/SyncDashboard.tsx`:

```tsx
import SyncDashboard from './SyncDashboard';

function App() {
  return (
    <SyncDashboard 
      organizationId="org_2xwHiNrj68eaRUlX10anlXGvzX7"
      apiBaseUrl="http://localhost:8000/api/v1"
    />
  );
}
```

## 📊 Sync Progress Steps

The sync process includes 8 detailed steps with visual feedback:

1. **Initializing** (0-12%) - Setting up sync operation
2. **Checking Config** (12-25%) - Validating service configuration
3. **Checking Credentials** (25-37%) - Validating API credentials
4. **Fetching Patients** (37-50%) - Downloading patient data from Cliniko
5. **Fetching Appointments** (50-62%) - Downloading appointment data
6. **Loading Types** (62-75%) - Loading appointment type mappings
7. **Analyzing** (75-87%) - Identifying active patients
8. **Storing** (87-100%) - Saving data to database

## 🎯 Status Types

- **`idle`** - No sync in progress
- **`starting`** - Sync initialization
- **`fetching_patients`** - Downloading patient data
- **`fetching_appointments`** - Downloading appointment data
- **`analyzing`** - Processing and analyzing data
- **`storing`** - Saving results to database
- **`completed`** - Sync finished successfully
- **`failed`** - Sync encountered an error

## 🔧 Usage Examples

### **Basic Frontend Integration**
```javascript
// Start a sync and monitor progress
async function runSyncWithFeedback(organizationId) {
  try {
    // Start sync
    const startResponse = await fetch(`/api/v1/sync/start/${organizationId}`, {
      method: 'POST'
    });
    const { sync_id } = await startResponse.json();
    
    // Monitor progress
    const pollStatus = async () => {
      const statusResponse = await fetch(`/api/v1/sync/status/${sync_id}`);
      const status = await statusResponse.json();
      
      // Update UI
      updateProgressBar(status.progress_percentage);
      updateStatusText(status.current_step);
      updateStats(status);
      
      // Continue polling if not complete
      if (!['completed', 'failed'].includes(status.status)) {
        setTimeout(pollStatus, 1000);
      } else {
        handleSyncComplete(status);
      }
    };
    
    pollStatus();
    
  } catch (error) {
    console.error('Sync error:', error);
  }
}
```

### **Dashboard Integration**
```javascript
// Load dashboard data on page load
async function loadDashboard(organizationId) {
  const response = await fetch(`/api/v1/sync/dashboard/${organizationId}`);
  const data = await response.json();
  
  // Show current sync if in progress
  if (data.current_sync) {
    showActivSync(data.current_sync);
  }
  
  // Display patient statistics
  updatePatientStats(data.patient_stats);
  
  // Show last sync info
  if (data.last_sync) {
    showLastSyncInfo(data.last_sync);
  }
}
```

## 🚀 Benefits for Frontend Development

### **Real-Time User Feedback**
- Users see exactly what's happening during sync
- Progress bars and percentages provide clear expectations
- Live logs show detailed step-by-step progress

### **Professional UX**
- No more "spinning wheels" without context
- Clear status indicators and error messages
- Ability to cancel long-running operations

### **Easy Integration**
- RESTful API design works with any frontend framework
- Server-Sent Events for real-time updates
- Comprehensive data in single API calls

### **Dashboard Ready**
- Pre-built components for React and vanilla JavaScript
- Responsive design with modern UI patterns
- Customizable styling and branding

## 🔄 Data Flow

1. **Frontend** calls `/sync/start/{org_id}`
2. **Backend** starts sync in background, returns `sync_id`
3. **Frontend** polls `/sync/status/{sync_id}` every second
4. **Backend** updates progress through 8 detailed steps
5. **Frontend** shows real-time progress, stats, and logs
6. **Backend** completes sync and updates database
7. **Frontend** shows completion status and final results

This system ensures users always know what's happening with their data synchronization, making the experience transparent and professional! 🎉 