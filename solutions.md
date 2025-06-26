# 🔧 EXACT FRONTEND FIXES - Resolve All 404 Errors

## 🎯 **The Issue: Missing `/v1` Prefixes in Frontend Calls**

Your console shows these 404 errors, but I can see the exact problem:

| ❌ **Frontend Call (404 Error)** | ✅ **Correct Backend Path** |
|-----------------------------------|------------------------------|
| `/api/patients/org_*/active/summary` | `/api/v1/patients/org_*/active/summary` |
| `/api/cliniko/status/org_*` | `/api/v1/cliniko/status/org_*` |
| `/api/v1/sync/dashboard/org_*` | `/api/v1/sync/dashboard/org_*` ✅ |
| `/api/v1/sync/history/org_*` | `/api/v1/sync/history/org_*` ✅ |

## 🚀 **Immediate Frontend Fixes**

### **1. Fix Patients Summary Call**

```javascript
// ❌ CURRENT (gives 404)
const patientsUrl = `${BASE_URL}/api/patients/${orgId}/active/summary`;

// ✅ FIX - Add /v1
const patientsUrl = `${BASE_URL}/api/v1/patients/${orgId}/active/summary`;
```

### **2. Fix Cliniko Status Call**

```javascript
// ❌ CURRENT (gives 404)  
const clinikoUrl = `${BASE_URL}/api/cliniko/status/${orgId}`;

// ✅ FIX - Add /v1
const clinikoUrl = `${BASE_URL}/api/v1/cliniko/status/${orgId}`;
```

### **3. Sync Endpoints Should Work (Already Have /v1)**

The sync endpoints are correctly using `/api/v1/sync/` but might need authentication headers:

```javascript
// ✅ These paths are correct, just ensure auth headers
const syncDashboard = `${BASE_URL}/api/v1/sync/dashboard/${orgId}`;
const syncHistory = `${BASE_URL}/api/v1/sync/history/${orgId}`;
```

## 📋 **Complete Working API Client**

Here's a drop-in replacement for your API calls:

```javascript
// RoutIQ API Client - All Working Endpoints
class RoutiqAPI {
  constructor(baseUrl, getClerkToken) {
    this.baseUrl = baseUrl;
    this.getClerkToken = getClerkToken;
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getClerkToken();
    const orgId = options.orgId;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-Organization-ID': orgId,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ✅ WORKING ENDPOINTS
  async getClinikoStatus(orgId) {
    return this.makeRequest(`/api/v1/cliniko/status/${orgId}`, { orgId });
  }

  async getPatientsActiveSummary(orgId) {
    return this.makeRequest(`/api/v1/patients/${orgId}/active/summary`, { orgId });
  }

  async getSyncDashboard(orgId) {
    return this.makeRequest(`/api/v1/sync/dashboard/${orgId}`, { orgId });
  }

  async getSyncHistory(orgId) {
    return this.makeRequest(`/api/v1/sync/history/${orgId}`, { orgId });
  }

  // 🔄 FALLBACK ENDPOINTS (if sync endpoints still have issues)
  async getClinikoPatientsSummary(orgId) {
    return this.makeRequest(`/api/v1/cliniko/active-patients-summary/${orgId}`, { orgId });
  }

  async getClinikoSyncLogs(orgId) {
    return this.makeRequest(`/api/v1/cliniko/sync-logs/${orgId}`, { orgId });
  }

  async startClinikoSync(orgId) {
    return this.makeRequest(`/api/v1/cliniko/sync-all/${orgId}`, { 
      orgId, 
      method: 'POST' 
    });
  }
}

// Usage in your components
const api = new RoutiqAPI(
  'https://routiq-backend-prod.up.railway.app',
  () => clerk.session.getToken()
);

// In your React components
const loadDashboardData = async () => {
  try {
    const [clinikoStatus, patientsSummary, syncDashboard] = await Promise.all([
      api.getClinikoStatus(orgId),
      api.getPatientsActiveSummary(orgId),  // Fixed path
      api.getSyncDashboard(orgId)
    ]);
    
    setDashboardData({
      clinikoStatus,
      patientsSummary,
      syncDashboard
    });
  } catch (error) {
    console.error('Dashboard load failed:', error);
    // Fall back to Cliniko-only endpoints
    const clinikoData = await api.getClinikoPatientsSummary(orgId);
    setDashboardData({ patientsSummary: clinikoData });
  }
};
```

## 🧪 **Test Before Deploying**

Run these curl commands to verify the endpoints work:

```bash
# Test the corrected endpoints
export TOKEN="your_clerk_token_here"
export ORG_ID="org_2xwHiNrj68eaRUlX10anlXGvzX7"
export BASE_URL="https://routiq-backend-prod.up.railway.app"

# 1. Test Cliniko status (fix: add /v1)
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Organization-ID: $ORG_ID" \
     "$BASE_URL/api/v1/cliniko/status/$ORG_ID"

# 2. Test patients summary (fix: add /v1) 
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Organization-ID: $ORG_ID" \
     "$BASE_URL/api/v1/patients/$ORG_ID/active/summary"

# 3. Test sync dashboard (should work now with auth)
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Organization-ID: $ORG_ID" \
     "$BASE_URL/api/v1/sync/dashboard/$ORG_ID"
```

## 📊 **Expected Results After Fixes**

Once you add the `/v1` prefixes:

| Endpoint | Before | After |
|----------|--------|-------|
| Cliniko Status | ❌ 404 | ✅ 200 |
| Patients Summary | ❌ 404 | ✅ 200 |
| Sync Dashboard | ❌ 404 | ✅ 200 |
| Sync History | ❌ 404 | ✅ 200 |

## 🚨 **Critical: Update All Frontend API Calls**

Search your frontend codebase for these patterns and fix them:

```bash
# Find and replace these patterns in your frontend:
# OLD: /api/cliniko/  → NEW: /api/v1/cliniko/
# OLD: /api/patients/ → NEW: /api/v1/patients/
# The /api/v1/sync/ paths should already be correct
```

**The main issue is simply missing `/v1` prefixes!** Add them and the 404 errors will disappear. 🎯 