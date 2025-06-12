"use client"

import dynamic from 'next/dynamic'

// Dynamically import DashboardHeader with no SSR
const DashboardHeader = dynamic(
  () => import('./header').then((mod) => ({ default: mod.DashboardHeader })),
  { 
    ssr: false,
    loading: () => (
      <header className="bg-routiq-energy border-b border-routiq-core/20 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-routiq-core">Routiq Hub Analytics</h1>
            <p className="text-sm text-routiq-core/70">Loading healthcare dashboard...</p>
          </div>
          <div className="h-8 w-8 bg-routiq-energy rounded-full animate-pulse"></div>
        </div>
      </header>
    )
  }
)

export { DashboardHeader } 