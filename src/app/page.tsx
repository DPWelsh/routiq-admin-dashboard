"use client"

import { SyncDashboard } from '@/components/dashboard/sync-dashboard'
import { AuthStatus } from '@/components/auth/auth-status'

export default function HomePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <AuthStatus />
      <SyncDashboard />
    </div>
  )
}
