import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Enhanced Card with mobile-responsive variants
const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground shadow",
  {
    variants: {
      // Mobile-responsive padding variants
      padding: {
        default: "", // Use existing component padding
        mobile: "p-4 md:p-6", // Mobile-friendly responsive padding
        compact: "p-3 md:p-4", // Compact for dense layouts
        spacious: "p-6 md:p-8", // Extra space when needed
      },
      // Touch interaction variants
      interaction: {
        none: "",
        touch: "touch-manipulation cursor-pointer hover:bg-accent/5 transition-colors active:scale-[0.98]",
        button: "touch-manipulation cursor-pointer hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-ring transition-all active:scale-[0.98]",
      }
    },
    defaultVariants: {
      padding: "default",
      interaction: "none",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, interaction, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ padding, interaction, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

// Enhanced CardHeader with mobile-responsive spacing
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Mobile-responsive spacing */
    mobileCompact?: boolean
  }
>(({ className, mobileCompact = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5",
      mobileCompact 
        ? "p-4 md:p-6" // Compact mobile, normal desktop
        : "p-6", // Standard padding
      className
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Mobile-responsive typography */
    mobileSize?: "sm" | "base" | "lg"
  }
>(({ className, mobileSize = "base", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "font-semibold leading-none tracking-tight",
      // Mobile-responsive text sizing
      mobileSize === "sm" && "text-sm md:text-base",
      mobileSize === "base" && "text-base md:text-lg", 
      mobileSize === "lg" && "text-lg md:text-xl",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

// Enhanced CardContent with mobile-responsive padding
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Mobile-responsive padding */
    mobileCompact?: boolean
  }
>(({ className, mobileCompact = false, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "pt-0",
      mobileCompact 
        ? "p-4 md:p-6" // Compact mobile, normal desktop
        : "p-6", // Standard padding
      className
    )} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

// Enhanced CardFooter with mobile-responsive layout
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Stack buttons on mobile */
    mobileStack?: boolean
    /** Mobile-responsive padding */
    mobileCompact?: boolean
  }
>(({ className, mobileStack = false, mobileCompact = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center pt-0",
      // Mobile-responsive layout
      mobileStack 
        ? "flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2"
        : "flex-row space-x-2",
      // Mobile-responsive padding  
      mobileCompact 
        ? "p-4 md:p-6"
        : "p-6",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// New: Mobile-optimized TouchCard component
export interface TouchCardProps extends CardProps {
  /** Content of the card */
  children: React.ReactNode
  /** Click handler for touch interactions */
  onClick?: () => void
  /** Whether card is in selected/active state */
  isSelected?: boolean
}

const TouchCard = React.forwardRef<HTMLDivElement, TouchCardProps>(
  ({ className, children, onClick, isSelected = false, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        "transition-all duration-150",
        // Touch interaction styles
        onClick && [
          "cursor-pointer touch-manipulation",
          "hover:shadow-md hover:border-routiq-core/20",
          "active:scale-[0.98] active:shadow-sm",
          "focus-visible:ring-2 focus-visible:ring-routiq-core focus-visible:outline-none"
        ],
        // Selected state
        isSelected && [
          "border-routiq-core shadow-md",
          "bg-routiq-core/5"
        ],
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {children}
    </Card>
  )
)
TouchCard.displayName = "TouchCard"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  TouchCard,
  cardVariants 
}
