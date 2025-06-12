"use client"

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'
import LoadingSpinner from '@/components/magicui/loading-spinner'

const AuthProvider = dynamic(
  () => import('./clerk-provider').then(mod => ({ default: mod.AuthProvider })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-routiq-cloud/20 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-routiq-blackberry/60">Initializing Routiq Hub...</p>
        </div>
      </div>
    )
  }
)

interface DynamicClerkProps {
  children: ReactNode
}

export function DynamicClerk({ children }: DynamicClerkProps) {
  return <AuthProvider>{children}</AuthProvider>
} 