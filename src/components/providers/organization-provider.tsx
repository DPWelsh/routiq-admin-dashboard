'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useOrganizationContext, UseOrganizationContextResult } from '@/hooks/useOrganizationContext'

// Create the context
const OrganizationContext = createContext<UseOrganizationContextResult | undefined>(undefined)

interface OrganizationProviderProps {
  children: ReactNode
}

/**
 * Organization Context Provider
 * Provides organization context to all child components
 * Should be wrapped around the app or dashboard layout
 */
export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const organizationContextValue = useOrganizationContext()

  return (
    <OrganizationContext.Provider value={organizationContextValue}>
      {children}
    </OrganizationContext.Provider>
  )
}

/**
 * Hook to use organization context from the provider
 * Must be used within an OrganizationProvider
 */
export function useOrganizationContextProvider(): UseOrganizationContextResult {
  const context = useContext(OrganizationContext)
  
  if (context === undefined) {
    throw new Error('useOrganizationContextProvider must be used within an OrganizationProvider')
  }
  
  return context
}

/**
 * Higher-order component to wrap components with organization context
 */
export function withOrganizationProvider<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <OrganizationProvider>
      <Component {...props} />
    </OrganizationProvider>
  )
  
  WrappedComponent.displayName = `withOrganizationProvider(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Component to display organization info (useful for debugging)
 */
export function OrganizationInfo() {
  const { organizationContext, isLoading, error } = useOrganizationContextProvider()

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading organization...</div>
  }

  if (error) {
    return <div className="text-sm text-red-500">Error: {error}</div>
  }

  if (!organizationContext) {
    return <div className="text-sm text-gray-500">No organization context</div>
  }

  return (
    <div className="text-sm text-gray-700">
      <div><strong>Organization:</strong> {organizationContext.organizationName}</div>
      <div><strong>Role:</strong> {organizationContext.userRole}</div>
      <div><strong>Status:</strong> {organizationContext.userStatus}</div>
    </div>
  )
}

// Export the context for advanced usage
export { OrganizationContext } 