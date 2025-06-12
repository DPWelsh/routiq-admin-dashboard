"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, useAuth } from "@clerk/nextjs"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BarChart3, 
  MessageSquare, 
  UserCheck,
  Settings,
  ChevronRight,
  HelpCircle
} from "lucide-react"

interface DashboardStats {
  conversations: {
    total: number
    label: string
  }
  activePatients: {
    total: number
    label: string
  }
  messages: {
    total: number
  }
  lastUpdated: string
}

const navigation = [
  { 
    name: "Overview", 
    href: "/dashboard", 
    icon: BarChart3, 
    roles: ["ADMIN", "USER"],
    description: "Dashboard analytics",
    badge: null
  },
  { 
    name: "Conversations", 
    href: "/dashboard/conversations/phone", 
    icon: MessageSquare, 
    roles: ["ADMIN", "USER"],
    description: "Phone chat interface",
    badge: "dynamic:conversations"
  },
  { 
    name: "Patients", 
    href: "/dashboard/patients", 
    icon: UserCheck, 
    roles: ["ADMIN", "USER"],
    description: "Patient management",
    badge: "dynamic:activePatients"
  },
  { 
    name: "Settings", 
    href: "/dashboard/settings", 
    icon: Settings, 
    roles: ["ADMIN", "USER"],
    description: "System configuration",
    badge: null
  }
]

export function DashboardNav() {
  const pathname = usePathname()
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch dashboard stats on component mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', {
          headers: {
            'Content-Type': 'application/json'
          }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setStats(data.data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Helper function to get dynamic badge value
  const getBadgeValue = (badgeConfig: string | null): string | null => {
    if (!badgeConfig || !badgeConfig.startsWith('dynamic:') || !stats) {
      return badgeConfig
    }

    const key = badgeConfig.replace('dynamic:', '') as keyof DashboardStats
    const statData = stats[key]
    
    if (statData && typeof statData === 'object' && 'label' in statData) {
      return statData.label
    }
    
    return null
  }

  // Handle help & support click
  const handleHelpClick = () => {
    // You can customize this to open a help modal, external link, or help page
    window.open('https://help.routiq.com', '_blank')
  }

  if (!isLoaded) return null

  const userRole = (user?.publicMetadata?.role as string) || "USER"

  return (
    <nav className="h-full w-64 bg-white border-r border-routiq-prompt/20 flex flex-col">
      {/* Main Navigation Section */}
      <div className="flex-1 overflow-hidden">
        <div className="px-3 py-3">
          <p className="text-xs font-semibold text-routiq-core/60 uppercase tracking-wider mb-2">
            MAIN NAVIGATION
          </p>
        </div>

        <div className="px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
          {navigation
            .filter(item => item.roles.includes(userRole))
            .map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
              
              const badgeValue = getBadgeValue(item.badge)

              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-routiq-cloud/10 text-routiq-cloud border-l-2 border-routiq-cloud"
                        : "text-routiq-core hover:bg-routiq-core/10 hover:text-routiq-core"
                    )}
                  >
                    <item.icon className={cn(
                      "flex-shrink-0 h-4 w-4",
                      isActive ? "text-routiq-cloud" : "text-routiq-core/70"
                    )} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{item.name}</span>
                        <div className="flex items-center gap-2">
                          {badgeValue && (
                            <Badge 
                              variant={badgeValue === "New" ? "default" : "secondary"}
                              className={cn(
                                "text-xs h-5 px-2",
                                badgeValue === "New" 
                                  ? "bg-routiq-cloud text-white" 
                                  : loading 
                                    ? "animate-pulse bg-routiq-energy" 
                                    : "bg-routiq-energy text-routiq-core"
                              )}
                            >
                              {loading ? "..." : badgeValue}
                            </Badge>
                          )}
                          {isActive && (
                            <ChevronRight className="h-4 w-4 text-routiq-cloud" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-routiq-core/60 mt-0.5 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
        </div>
      </div>

      {/* Help & Support */}
      <div className="border-t border-routiq-prompt/20 p-3">
        <Button
          variant="ghost"
          onClick={handleHelpClick}
          className="w-full justify-start gap-3 text-routiq-core hover:bg-routiq-core/10 hover:text-routiq-core py-2.5 px-3 rounded-lg transition-colors duration-150"
        >
          <HelpCircle className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">Help & Support</span>
            <p className="text-xs text-routiq-core/60 mt-0.5">
              Get help and documentation
            </p>
          </div>
        </Button>
      </div>
    </nav>
  )
} 