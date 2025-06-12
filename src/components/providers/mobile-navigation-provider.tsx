"use client"

import { createContext, useContext } from 'react'
import { useMobileNavigation, MobileNavigationState } from '@/hooks/use-mobile-navigation'

const MobileNavigationContext = createContext<MobileNavigationState | undefined>(undefined)

export function MobileNavigationProvider({ children }: { children: React.ReactNode }) {
  const navigationState = useMobileNavigation()

  return (
    <MobileNavigationContext.Provider value={navigationState}>
      {children}
    </MobileNavigationContext.Provider>
  )
}

export function useMobileNavigationContext() {
  const context = useContext(MobileNavigationContext)
  if (context === undefined) {
    throw new Error('useMobileNavigationContext must be used within a MobileNavigationProvider')
  }
  return context
} 