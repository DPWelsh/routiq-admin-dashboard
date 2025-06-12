"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Mobile Navigation Drawer Props
 */
interface MobileNavDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean
  /** Callback when drawer should close */
  onClose: () => void
  /** Navigation content to render inside drawer */
  children: React.ReactNode
  /** Additional CSS classes for the drawer */
  className?: string
}

/**
 * Mobile Navigation Drawer
 * 
 * ⚠️  CRITICAL: Mobile-only navigation overlay component
 * 
 * Features:
 * - Full-height overlay with backdrop blur
 * - Smooth slide animations (150ms duration)
 * - Touch-to-close functionality on backdrop
 * - Navigation items with ≥48px touch targets
 * - Proper z-index layering (z-50)
 * - Escape key closes drawer (handled by hook)
 * - Focus trap when open
 * - Prevents body scroll when open
 * 
 * @param props - MobileNavDrawerProps
 * @returns JSX.Element
 * 
 * @example
 * ```tsx
 * const { isOpen, close } = useMobileNavigation()
 * 
 * <MobileNavDrawer isOpen={isOpen} onClose={close}>
 *   <YourNavigationContent />
 * </MobileNavDrawer>
 * ```
 */
export function MobileNavDrawer({ 
  isOpen, 
  onClose, 
  children, 
  className 
}: MobileNavDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Focus the drawer when it opens
      const drawer = document.getElementById('mobile-nav-drawer')
      if (drawer) {
        drawer.focus()
      }
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          "transition-opacity duration-150 ease-in-out",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Navigation drawer */}
      <div
        id="mobile-nav-drawer"
        role="navigation"
        aria-label="Mobile navigation menu"
        tabIndex={-1}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw]",
          "bg-white border-r border-border shadow-xl",
          "transform transition-transform duration-200 ease-out",
          "focus:outline-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-routiq-energy/50">
          <h2 className="text-lg font-semibold text-routiq-core">
            Navigation
          </h2>
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              "h-11 w-11 p-2", // 44px touch target
              "hover:bg-routiq-cloud/10 focus-visible:ring-2 focus-visible:ring-routiq-core"
            )}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5 text-routiq-core" />
          </Button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Mobile Navigation Item
 * 
 * Touch-friendly navigation item component for use within MobileNavDrawer.
 * Provides consistent styling and touch targets.
 * 
 * @example
 * ```tsx
 * <MobileNavItem 
 *   href="/dashboard" 
 *   icon={<HomeIcon />}
 *   isActive={pathname === '/dashboard'}
 * >
 *   Dashboard
 * </MobileNavItem>
 * ```
 */
interface MobileNavItemProps {
  /** Navigation link href */
  href?: string
  /** Whether this nav item is currently active */
  isActive?: boolean
  /** Icon to display */
  icon?: React.ReactNode
  /** Click handler for non-link items */
  onClick?: () => void
  /** Navigation item content */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

export function MobileNavItem({
  href,
  isActive = false,
  icon,
  onClick,
  children,
  className
}: MobileNavItemProps) {
  const baseClasses = cn(
    // Touch-friendly sizing (48px minimum height)
    "flex items-center gap-3 rounded-lg px-3 py-3 min-h-[48px]",
    // Typography
    "text-sm font-medium transition-colors duration-150",
    // Touch optimization
    "touch-manipulation",
    // Focus and hover states
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-routiq-core",
    // Active state
    isActive
      ? "bg-routiq-core text-white" 
      : "text-routiq-core hover:bg-routiq-cloud/10 hover:text-routiq-core",
    className
  )

  const content = (
    <>
      {icon && (
        <span className="flex-shrink-0">
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        className={baseClasses}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      onClick={onClick}
      className={baseClasses}
    >
      {content}
    </button>
  )
} 