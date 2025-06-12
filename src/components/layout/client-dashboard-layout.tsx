"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { DashboardNav } from "@/components/layout/navigation/nav-wrapper"
import { DashboardHeader } from "@/components/layout/header/header-wrapper"
import { LoadingSpinner } from "@/components/magicui"
import { MobileNavigationProvider } from "@/components/providers/mobile-navigation-provider"

interface ClientDashboardLayoutProps {
  children: React.ReactNode
}

export function ClientDashboardLayout({ children }: ClientDashboardLayoutProps) {
  const [hasMounted, setHasMounted] = useState(false)
  const pathname = usePathname()
  
  // Check if this is a full-height page (like phone conversations)
  const isFullHeightPage = pathname?.includes('/conversations/phone')
  
  useEffect(() => {
    setHasMounted(true)
  }, [])
  
  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 w-20 h-20 border-4 border-gray-200 border-t-routiq-energy rounded-full animate-routiq-spin"></div>
          
          {/* Inner pulsing ring */}
          <div className="absolute inset-2 w-16 h-16 border-2 border-routiq-cloud/30 rounded-full animate-routiq-pulse"></div>
          
          {/* Routiq Logo */}
          <div className="w-20 h-20 flex items-center justify-center animate-routiq-fade-in">
            <Image
              src="/logos/routiq-logomark-core.svg"
              alt="Routiq"
              width={40}
              height={40}
              className="w-10 h-10"
            />
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <MobileNavigationProvider>
      <div className="min-h-screen bg-white">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50">
          <DashboardHeader />
        </div>
        
        {/* Main Content Area with top margin for fixed header */}
        <div className="flex pt-[73px] min-h-screen">
          {/* Fixed Sidebar - Hidden on mobile */}
          <div className="fixed left-0 top-[73px] bottom-0 z-40 hidden md:block">
            <DashboardNav />
          </div>
          
          {/* Main Content with left margin for fixed sidebar on desktop */}
          {isFullHeightPage ? (
            <main className="flex-1 md:ml-64 overflow-hidden bg-white">
              {children}
            </main>
          ) : (
            <main className="flex-1 md:ml-64 overflow-auto h-full">
              {children}
            </main>
          )}
        </div>
      </div>
    </MobileNavigationProvider>
  )
} 