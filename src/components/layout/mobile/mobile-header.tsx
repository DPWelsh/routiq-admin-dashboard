"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { HamburgerMenu } from "./hamburger-menu"
import { Button } from "@/components/ui/button"
import { User, ChevronDown } from "lucide-react"

/**
 * Mobile Header Props
 */
interface MobileHeaderProps {
  /** Whether the mobile navigation is open */
  isNavOpen: boolean
  /** Toggle function for mobile navigation */
  onNavToggle: () => void
  /** Optional page title to display */
  pageTitle?: string
  /** User information for profile section */
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
  /** Additional CSS classes */
  className?: string
}

/**
 * Mobile Header Component
 * 
 * ⚠️  CRITICAL: Mobile-only header (< 768px) - Desktop unchanged
 * 
 * Features:
 * - Hamburger menu button integration
 * - Logo mark only (routiq-logomark-core.svg)
 * - Condensed user profile with touch targets
 * - Optional page title display
 * - Brand colors and spacing consistent
 * - Proper responsive typography
 * - Touch-friendly interactions (44px minimum)
 * 
 * @param props - MobileHeaderProps
 * @returns JSX.Element
 * 
 * @example
 * ```tsx
 * const { isOpen, toggle } = useMobileNavigation()
 * 
 * <MobileHeader 
 *   isNavOpen={isOpen}
 *   onNavToggle={toggle}
 *   pageTitle="Dashboard"
 *   user={{ name: "John Doe", email: "john@example.com" }}
 * />
 * ```
 */
export function MobileHeader({
  isNavOpen,
  onNavToggle,
  pageTitle,
  user,
  className
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left section: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger menu button */}
          <HamburgerMenu
            isOpen={isNavOpen}
            onClick={onNavToggle}
            className="shrink-0"
          />

          {/* Logo mark only for mobile */}
          <div className="flex items-center">
            <Image
              src="/routiq-logomark-core.svg"
              alt="RoutIQ"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
          </div>

          {/* Page title (if provided) */}
          {pageTitle && (
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground truncate">
                {pageTitle}
              </h1>
            </div>
          )}
        </div>

        {/* Right section: User profile */}
        <div className="flex items-center">
          <MobileUserMenu user={user} />
        </div>
      </div>

      {/* Page title on mobile (below header for space) */}
      {pageTitle && (
        <div className="block sm:hidden border-t border-border bg-muted/50 px-4 py-2">
          <h1 className="text-sm font-medium text-foreground truncate">
            {pageTitle}
          </h1>
        </div>
      )}
    </header>
  )
}

/**
 * Mobile User Menu Component
 * 
 * Condensed user profile for mobile header with touch-friendly interactions.
 */
interface MobileUserMenuProps {
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
}

function MobileUserMenu({ user }: MobileUserMenuProps) {
  if (!user) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 p-2" // 44px touch target
      >
        <User className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        "h-11 px-3 py-2", // 44px height, touch-friendly padding
        "flex items-center gap-2",
        "hover:bg-routiq-cloud/10 focus-visible:ring-2 focus-visible:ring-routiq-core"
      )}
    >
      {/* User avatar or fallback */}
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-routiq-core text-routiq-cloud text-xs font-medium">
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.name || "User"}
            width={24}
            height={24}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <span>
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </span>
        )}
      </div>

      {/* User name (truncated) */}
      <span className="hidden xs:block text-sm font-medium truncate max-w-20">
        {user.name || 'User'}
      </span>

      {/* Dropdown indicator */}
      <ChevronDown className="h-3 w-3 opacity-60" />
    </Button>
  )
}

/**
 * Mobile Header Wrapper
 * 
 * Convenience component that integrates with useMobileNavigation hook.
 * Use this for quick integration without managing state manually.
 */
interface MobileHeaderWrapperProps {
  pageTitle?: string
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
  className?: string
}

export function MobileHeaderWrapper({
  pageTitle,
  user,
  className
}: MobileHeaderWrapperProps) {
  // This would normally use useMobileNavigation() hook
  // For now, showing the structure - parent component should pass state
  return (
    <div className={cn("md:hidden", className)}>
      <p className="p-4 text-sm text-muted-foreground">
        MobileHeader - Use with useMobileNavigation() hook for state management
      </p>
    </div>
  )
} 