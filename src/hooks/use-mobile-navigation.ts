import { useState, useEffect, useCallback } from 'react'

/**
 * Mobile Navigation State Interface
 * 
 * Manages mobile navigation drawer state and responsive breakpoint detection.
 * Used for hamburger menu and mobile navigation drawer functionality.
 */
export interface MobileNavigationState {
  /** Whether the mobile navigation drawer is currently open */
  isOpen: boolean
  /** Whether the current viewport is considered mobile (< 768px) */
  isMobile: boolean
  /** Toggle the navigation drawer open/closed */
  toggle: () => void
  /** Close the navigation drawer */
  close: () => void
  /** Open the navigation drawer */
  open: () => void
}

/**
 * Mobile Navigation Hook
 * 
 * ⚠️  CRITICAL: This hook manages mobile-only navigation state
 * 
 * - Detects mobile breakpoint (< 768px) following Tailwind's `md` breakpoint
 * - Manages drawer open/close state with proper cleanup
 * - Provides smooth interactions with <150ms response times
 * - Handles keyboard accessibility (Escape key closes drawer)
 * - Automatically closes drawer when switching to desktop view
 * 
 * @returns {MobileNavigationState} Navigation state and control functions
 * 
 * @example
 * ```tsx
 * const { isOpen, isMobile, toggle, close } = useMobileNavigation()
 * 
 * // Show hamburger only on mobile
 * {isMobile && <HamburgerButton onClick={toggle} />}
 * 
 * // Show drawer when open
 * <MobileNavDrawer isOpen={isOpen} onClose={close} />
 * ```
 */
export function useMobileNavigation(): MobileNavigationState {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile breakpoint (< 768px = Tailwind's md breakpoint)
  useEffect(() => {
    function checkIsMobile() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // Auto-close drawer when switching to desktop
      if (!mobile && isOpen) {
        setIsOpen(false)
      }
    }

    // Initial check
    checkIsMobile()

    // Listen for resize events
    window.addEventListener('resize', checkIsMobile)
    
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [isOpen])

  // Handle Escape key to close drawer
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Control functions with useCallback for performance
  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  return {
    isOpen,
    isMobile,
    toggle,
    close,
    open
  }
}

/**
 * Hook for detecting responsive breakpoints
 * 
 * Utility hook for detecting Tailwind CSS breakpoints in JavaScript.
 * Useful for conditional rendering based on screen size.
 * 
 * @param breakpoint - Tailwind breakpoint ('sm' | 'md' | 'lg' | 'xl' | '2xl')
 * @returns {boolean} True if viewport is below the breakpoint (mobile-first)
 * 
 * @example
 * ```tsx
 * const isMobile = useBreakpoint('md')  // true if < 768px
 * const isTablet = useBreakpoint('lg')  // true if < 1024px
 * ```
 */
export function useBreakpoint(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl'): boolean {
  const breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
  }

  const [isBelow, setIsBelow] = useState(false)

  useEffect(() => {
    function checkBreakpoint() {
      setIsBelow(window.innerWidth < breakpoints[breakpoint])
    }

    // Initial check
    checkBreakpoint()

    // Listen for resize
    window.addEventListener('resize', checkBreakpoint)
    
    return () => window.removeEventListener('resize', checkBreakpoint)
  }, [breakpoint, breakpoints])

  return isBelow
} 