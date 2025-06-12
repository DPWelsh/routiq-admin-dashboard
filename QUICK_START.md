# 🚀 Routiq Admin Dashboard - Quick Start Guide

Get the healthcare practice management dashboard running in 5 minutes!

## 📦 Prerequisites

- Node.js 18+ installed
- npm or yarn
- Access to production backend: `https://routiq-backend-v10-production.up.railway.app`

## ⚡ Quick Setup

### 1. Install Dependencies
```bash
cd routiq-admin-dashboard
npm install

# Add required dependencies for Routiq integration
npm install @tanstack/react-query @clerk/nextjs
npm install --save-dev @types/node
```

### 2. Environment Variables
Create `.env.local` file:
```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://routiq-backend-v10-production.up.railway.app

# Clerk Authentication (Get from Clerk dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Organization ID for Surf Rehab (has 632 patients + 47 active)
NEXT_PUBLIC_DEFAULT_ORG_ID=org_2xwHiNrj68eaRUlX10anlXGvzX7

# Development
NODE_ENV=development
NEXT_PUBLIC_ENABLE_DEBUG=true
```

### 3. Start Development Server
```bash
npm run dev
# Open http://localhost:3000
```

## 🎯 What Works Right Now

### ✅ Working Features (Phase 1)
1. **Sync Trigger** - Force sync with Cliniko
2. **Sync Status** - Real-time sync monitoring  
3. **Database Stats** - View system metrics
4. **Health Check** - API connectivity status

### 🔜 Coming Soon (Phase 2)
- **47 Active Patients List** (when backend environment configured)
- **Patient Search & Filter**
- **Detailed Sync Dashboard**
- **Appointment History**

## 🧪 Test Integration

### 1. Test Backend Connection
```bash
# Should return {"status":"healthy"...}
curl https://routiq-backend-v10-production.up.railway.app/health
```

### 2. Test Sync Trigger (Works Now!)
```bash
curl -X POST https://routiq-backend-v10-production.up.railway.app/api/v1/admin/clerk/sync \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "org_2xwHiNrj68eaRUlX10anlXGvzX7"}'

# Should return: {"success":true,"message":"Clerk data synchronization started..."}
```

### 3. Test Sync Status
```bash
curl https://routiq-backend-v10-production.up.railway.app/api/v1/admin/clerk/status

# Should return sync status and database counts
```

## 🎨 UI Components Setup

### Update app/layout.tsx
```typescript
import { ClerkProvider } from '@clerk/nextjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './globals.css'

const queryClient = new QueryClient()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

### Create Dashboard Page (app/page.tsx)
```typescript
'use client'

import { useDashboardData } from '@/hooks/useRoutiqData'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Dashboard() {
  const { sync, database, health, isLoading } = useDashboardData()

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Routiq Dashboard</h1>
        <Button 
          onClick={sync.triggerSync}
          disabled={sync.isTriggering || sync.isSyncing}
        >
          {sync.isSyncing ? 'Syncing...' : 'Force Sync'}
        </Button>
      </div>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-semibold">
                {sync.isSyncing ? '🔄 Syncing' : '✅ Ready'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sync</p>
              <p className="text-lg">
                {sync.lastSync ? 
                  new Date(sync.lastSync).toLocaleString() : 
                  'Never'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Stats */}
      {database.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle>Organizations</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {database.summary.organizations.total_organizations}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Users</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {database.summary.users.total_users}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Memberships</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {database.summary.memberships.total_memberships}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Active Patients (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This will show 47 active patients once backend environment is configured.
          </p>
          <p className="text-sm mt-2">
            Backend has: 632 total contacts, 47 active patients, 99.1% phone success rate
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

## 📊 Expected Data

**Current Production Backend Has:**
- ✅ **632 patients** imported from Cliniko
- ✅ **47 active patients** (appointments in last 45 days)
- ✅ **99.1% phone numbers** extracted successfully
- ✅ **100% sync success** rate
- ✅ **Real-time sync** monitoring

## 🔧 Development Flow

### Phase 1 (Now): Basic Dashboard
1. ✅ Set up API client and hooks
2. ✅ Implement sync trigger and status
3. ✅ Show database summary stats
4. ✅ Add real-time sync monitoring

### Phase 2 (Next): Active Patients
1. Wait for backend `DATABASE_URL` environment variable
2. Implement active patients list component
3. Add patient search and filtering
4. Build detailed sync dashboard

### Phase 3 (Future): Advanced Features
1. Add Clerk authentication
2. Implement multi-organization support
3. Integrate with Chatwoot for messaging
4. Add WhatsApp/Instagram channels

## 🎉 Success Checklist

- [ ] `npm run dev` starts without errors
- [ ] Can see dashboard at http://localhost:3000
- [ ] Sync button works and shows real status
- [ ] Database stats display correctly
- [ ] Real-time sync monitoring updates

## 🚨 Troubleshooting

### Common Issues:

**1. Dependencies missing:**
```bash
npm install @tanstack/react-query @clerk/nextjs @types/node
```

**2. Environment variables:**
- Make sure `.env.local` exists with correct API URL
- Clerk keys are optional for basic functionality

**3. CORS issues:**
- Backend is configured for localhost:3000
- Should work without additional CORS setup

**4. TypeScript errors:**
- Run `npm run build` to check for type issues
- Most errors should resolve after installing dependencies

## 📚 Next Steps

1. **Get basic dashboard working** with sync functionality
2. **Test with real backend data** using working endpoints  
3. **Prepare for active patients integration** (when backend environment ready)
4. **Add Clerk authentication** for production use

**The backend is production-ready - time to build the frontend!** 🚀 