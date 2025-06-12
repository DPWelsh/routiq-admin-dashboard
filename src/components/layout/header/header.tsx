"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LogOut, User, ChevronDown } from "lucide-react"
import Image from "next/image"
import { HamburgerMenu } from "@/components/layout/mobile/hamburger-menu"
import { useMobileNavigationContext } from "@/components/providers/mobile-navigation-provider"

export function DashboardHeader() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const pathname = usePathname()
  const { isOpen, isMobile, toggle } = useMobileNavigationContext()

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/sign-in' })
    } catch (error) {
      console.error('Error signing out:', error)
      // Fallback: redirect manually
      router.push('/sign-in')
    }
  }

  const handleProfileClick = () => {
    router.push('/dashboard/settings')
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
  }

  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Dashboard Overview'
      case '/dashboard/conversations':
      case '/dashboard/conversations/phone':
        return 'Phone Conversations'
      case '/dashboard/patients':
        return 'Patients'
      case '/dashboard/performance':
        return 'Performance Analytics'
      case '/dashboard/timing':
        return 'Timing Analysis'
      case '/dashboard/sentiment':
        return 'Sentiment Analysis'
      case '/dashboard/users':
        return 'User Management'
      case '/dashboard/settings':
        return 'Settings'
      default:
        // Handle dynamic routes like /dashboard/conversations/phone?phone=...
        if (pathname.startsWith('/dashboard/conversations/phone')) {
          return 'Phone Conversations'
        }
        return 'Dashboard'
    }
  }

  const getPageDescription = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Healthcare analytics and patient engagement insights'
      case '/dashboard/conversations':
      case '/dashboard/conversations/phone':
        return 'Real-time phone conversations and AI bot analysis'
      case '/dashboard/patients':
        return 'Patient management, churn analysis, and rebooking insights'
      case '/dashboard/performance':
        return 'Performance metrics and operational analytics'
      case '/dashboard/timing':
        return 'Response time analysis and efficiency metrics'
      case '/dashboard/sentiment':
        return 'Customer sentiment analysis and satisfaction tracking'
      case '/dashboard/users':
        return 'User roles, permissions, and account management'
      case '/dashboard/settings':
        return 'Application settings and configuration'
      default:
        // Handle dynamic routes like /dashboard/conversations/phone?phone=...
        if (pathname.startsWith('/dashboard/conversations/phone')) {
          return 'Real-time phone conversations and AI bot analysis'
        }
        return 'Professional healthcare analytics platform'
    }
  }

  return (
    <header className="bg-routiq-energy border-b border-routiq-core/20">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section - Logo and Page Info */}
          <div className="flex items-center space-x-6">
            {/* Mobile Menu Button */}
            {isMobile && (
              <HamburgerMenu 
                isOpen={isOpen} 
                onClick={toggle}
                className="mr-2"
              />
            )}

            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Image
                  src="/logos/routiq-logomark-core.svg"
                  alt="Routiq"
                  width={40}
                  height={40}
                  className="w-10 h-10"
                />
              </div>
              <div className="hidden sm:block">
                <Image
                  src="/logos/routiq-logo-core.svg"
                  alt="Routiq"
                  width={120}
                  height={32}
                  className="h-8 w-auto"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px h-8 bg-routiq-core/20"></div>

            {/* Page Info */}
            <div className="hidden lg:block">
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-xl font-semibold text-routiq-core tracking-tight">
                    {getPageTitle()}
                  </h1>
                  <p className="text-sm text-routiq-core/70 leading-tight">
                    {getPageDescription()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Actions and User */}
          <div className="flex items-center space-x-4">
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 px-3 rounded-xl hover:bg-routiq-core/10 transition-colors duration-150">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8 ring-2 ring-routiq-core/20">
                      {user?.imageUrl && (
                        <AvatarImage src={user.imageUrl} alt={user?.fullName || "User"} />
                      )}
                      <AvatarFallback className="bg-routiq-cloud text-white text-sm font-medium">
                        {user?.fullName ? getInitials(user.fullName) : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-routiq-core leading-tight">
                        {user?.fullName || user?.firstName}
                      </p>
                      <p className="text-xs text-routiq-core/60 leading-tight">
                        Healthcare Admin
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-routiq-core/50" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-white border-routiq-energy" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-4">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        {user?.imageUrl && (
                          <AvatarImage src={user.imageUrl} alt={user?.fullName || "User"} />
                        )}
                        <AvatarFallback className="bg-routiq-cloud text-white">
                          {user?.fullName ? getInitials(user.fullName) : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-routiq-core leading-tight">
                          {user?.fullName}
                        </p>
                        <p className="text-xs text-routiq-core/60 leading-tight">
                          {user?.primaryEmailAddress?.emailAddress}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="w-fit text-xs bg-routiq-cloud/10 text-routiq-cloud border-routiq-cloud/20">
                      Healthcare Professional
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-routiq-core/20" />
                <DropdownMenuItem 
                  onClick={handleProfileClick}
                  className="hover:bg-routiq-core/10 focus:bg-routiq-core/10"
                >
                  <User className="mr-3 h-4 w-4 text-routiq-core" />
                  <span className="text-routiq-core">Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-routiq-core/20" />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="hover:bg-red-50 focus:bg-red-50 text-red-600 hover:text-red-600"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
} 