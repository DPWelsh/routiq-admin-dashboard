"use client"

import { useState } from 'react'
import { useDashboardData, useActivePatients } from '../../hooks/useRoutiqData'
import { ORGANIZATIONS } from '../../lib/routiq-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, CheckCircle, XCircle, Clock, Users, Database, TrendingUp, AlertCircle, Info, Building2, UserCheck, Stethoscope, Calendar, ChevronDown } from 'lucide-react'

interface SyncDashboardProps {
  defaultOrganizationId?: string
}

// Organization display names
const ORGANIZATION_NAMES = {
  [ORGANIZATIONS.SURF_REHAB]: 'SurfRehab',
  [ORGANIZATIONS.TEST_ORG]: 'Test Organization'
} as const

// Get all available organizations
const AVAILABLE_ORGANIZATIONS = Object.entries(ORGANIZATIONS).map(([key, id]) => ({
  id,
  name: ORGANIZATION_NAMES[id as keyof typeof ORGANIZATION_NAMES] || key,
  key
}))

export function SyncDashboard({ defaultOrganizationId = ORGANIZATIONS.SURF_REHAB }: SyncDashboardProps) {
  const [selectedOrgId, setSelectedOrgId] = useState(defaultOrganizationId)
  
  const dashboardData = useDashboardData(selectedOrgId)
  const activePatients = useActivePatients(selectedOrgId)
  
  const {
    clerkSync,
    clinikoSync,
    sync,
    database,
    health,
    features,
    isLoading,
    hasErrors
  } = dashboardData

  // Get current organization name
  const currentOrganizationName = ORGANIZATION_NAMES[selectedOrgId as keyof typeof ORGANIZATION_NAMES] || 'Unknown Organization'

  // Helper function to format last sync time with actual timestamp
  const formatLastSyncTimestamp = (lastSyncDate?: string) => {
    if (lastSyncDate) {
      const lastSync = new Date(lastSyncDate)
      
      // Convert to GMT+8:00 and format as readable timestamp
      return lastSync.toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    }
    return "Never"
  }

  // Helper function for relative time (keeping for backward compatibility if needed)
  const formatLastSync = (lastSyncDate?: string) => {
    if (lastSyncDate) {
      const lastSync = new Date(lastSyncDate)
      const now = new Date()
      
      // Convert to GMT+8:00 (Singapore/Perth timezone)
      const gmt8Offset = 8 * 60; // 8 hours in minutes
      const utc = lastSync.getTime() + (lastSync.getTimezoneOffset() * 60000);
      const gmt8Time = new Date(utc + (gmt8Offset * 60000));
      
      const diffMs = now.getTime() - lastSync.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      
      if (diffMins < 1) return "Just now"
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
      return `${Math.floor(diffMins / 1440)}d ago`
    }
    return "Never"
  }

  // Helper function to get API status details
  const getApiStatusDetails = () => {
    const isHealthy = health.status?.status === 'healthy'
    return {
      status: isHealthy ? 'Online' : 'Offline',
      icon: isHealthy ? CheckCircle : XCircle,
      color: isHealthy ? 'text-green-600' : 'text-red-600',
      description: isHealthy ? 'All systems operational' : 'API connectivity issues'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const apiStatus = getApiStatusDetails()
  
  // Clerk organization data
  const clerkUsers = clerkSync.status?.database_counts?.users || 0
  const clerkOrganizations = clerkSync.status?.database_counts?.organizations || 1
  const isClerkConnected = clerkSync.isConnected
  
  // Cliniko data
  const totalContacts = clinikoSync.totalContacts || 0
  const activePatientsCount = activePatients.data?.total_count || clinikoSync.activePatients
  const upcomingAppointments = activePatients.data?.patients?.filter(p => p.upcoming_appointment_count > 0)?.length || clinikoSync.upcomingAppointments
  const recentAppointments = activePatients.data?.patients?.filter(p => p.recent_appointment_count > 0)?.length || 0

  return (
    <div className="space-y-8">
      {/* Header with Organization Selector */}
      <div className="flex justify-between items-start">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Routiq Backend Health Hub</h1>
            <p className="text-gray-600 mt-1">
              Clerk organization management and Cliniko integration monitoring
            </p>
          </div>
          
          {/* Organization Selector */}
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Organization:</span>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-52 h-10 border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Select organization" className="text-gray-900" />
              </SelectTrigger>
              <SelectContent className="border border-gray-200 shadow-lg bg-white p-1">
                {AVAILABLE_ORGANIZATIONS.map((org) => (
                  <SelectItem 
                    key={org.id} 
                    value={org.id}
                    className="hover:bg-blue-50 hover:text-blue-900 focus:bg-blue-50 focus:text-blue-900 cursor-pointer py-3 pr-3 pl-8 rounded-md"
                  >
                    <span className="font-medium">{org.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="ml-2 px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 border border-gray-200">
              {selectedOrgId.slice(-8)}
            </Badge>
          </div>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        {/* API Status Card */}
        <Card className="relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <apiStatus.icon className={`h-4 w-4 mr-2 ${apiStatus.color.replace('text-', 'text-')}`} />
              API Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${apiStatus.color}`}>
              {apiStatus.status}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {apiStatus.description}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clerk Organization Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Clerk Organization</h2>
            <Badge variant={isClerkConnected ? "default" : "destructive"} className="ml-2">
              {isClerkConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          {/* Clerk Sync Button */}
          <Button
            onClick={clerkSync.triggerSync}
            disabled={clerkSync.isTriggering || clerkSync.isSyncing}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2 hover:bg-blue-100 hover:text-blue-700 border-blue-200"
          >
            <RefreshCw className={`h-4 w-4 ${clerkSync.isTriggering ? 'animate-spin' : ''}`} />
            <span>{clerkSync.isTriggering ? 'Syncing...' : 'Sync Users'}</span>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Organization Count */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-blue-500" />
                Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {clerkOrganizations.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Active organizations
              </p>
            </CardContent>
          </Card>

          {/* Users Count */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <UserCheck className="h-4 w-4 mr-2 text-green-500" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {clerkUsers.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total registered users
              </p>
            </CardContent>
          </Card>

          {/* Clerk Sync Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Database className="h-4 w-4 mr-2 text-purple-500" />
                Clerk Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${clerkSync.isSyncing || clerkSync.isTriggering ? 'text-blue-600' : 'text-green-600'}`}>
                {clerkSync.isSyncing || clerkSync.isTriggering ? 'Syncing' : 'Ready'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {clerkSync.isTriggering ? 'Clerk sync started...' : clerkSync.lastSync ? 
                  `Clerk synced ${formatLastSyncTimestamp(clerkSync.lastSync)} (${formatLastSync(clerkSync.lastSync)})` : 
                  'Never synced'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cliniko Integration Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-900">Cliniko Integration</h2>
            <Badge variant={activePatientsCount > 0 ? "default" : "secondary"} className="ml-2">
              {activePatientsCount > 0 ? "Active" : "No Data"}
            </Badge>
            <span className="text-sm text-gray-500">for {currentOrganizationName}</span>
          </div>
          
          {/* Cliniko Sync Button */}
          <Button
            onClick={clinikoSync.triggerSync}
            disabled={clinikoSync.isTriggering || clinikoSync.isSyncing}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2 hover:bg-emerald-100 hover:text-emerald-700 border-emerald-200"
          >
            <RefreshCw className={`h-4 w-4 ${clinikoSync.isTriggering ? 'animate-spin' : ''}`} />
            <span>{clinikoSync.isTriggering ? 'Syncing...' : 'Sync Patients'}</span>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Contacts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2 text-blue-500" />
                Total Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalContacts.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Synced from Cliniko
              </p>
            </CardContent>
          </Card>

          {/* Active Patients */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-emerald-500" />
                Active Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {activePatientsCount.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                With recent appointments
              </p>
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-orange-500" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {upcomingAppointments.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Future appointments
              </p>
            </CardContent>
          </Card>

          {/* Cliniko Sync Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                Cliniko Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${clinikoSync.isSyncing || clinikoSync.isTriggering ? 'text-blue-600' : 'text-green-600'}`}>
                {clinikoSync.isSyncing || clinikoSync.isTriggering ? 'Syncing' : 'Ready'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {clinikoSync.isTriggering ? 'Cliniko sync started...' : clinikoSync.lastSync ? 
                  `Patients synced ${formatLastSyncTimestamp(clinikoSync.lastSync)} (${formatLastSync(clinikoSync.lastSync)})` : 
                  'Never synced'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Error Banner */}
      {hasErrors && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <h3 className="font-medium text-red-800">Sync Issues Detected</h3>
                <p className="text-sm text-red-600 mt-1">
                  Some data synchronization issues were encountered. Please try triggering a manual sync or contact support if issues persist.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 