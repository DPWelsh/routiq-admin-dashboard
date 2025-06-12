"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export default function LoadingSpinner({ 
  size = "md", 
  className,
  text = "Loading..."
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        {/* Outer ring */}
        <div className={cn(
          "rounded-full border-2 border-routiq-cloud animate-routiq-spin",
          sizeClasses[size]
        )} />
        
        {/* Inner spinning element */}
        <div className={cn(
          "absolute inset-0 rounded-full border-2 border-transparent border-t-routiq-prompt animate-routiq-spin",
          sizeClasses[size]
        )} 
        style={{ animationDuration: "0.8s" }} />
        
        {/* Center dot */}
        <div className={cn(
          "absolute inset-0 m-auto rounded-full bg-routiq-prompt animate-routiq-pulse",
          size === "sm" ? "h-1 w-1" : size === "md" ? "h-2 w-2" : "h-3 w-3"
        )} />
      </div>
      
      {text && (
        <p className="text-sm text-routiq-blackberry/70 font-medium animate-routiq-fade-in">
          {text}
        </p>
      )}
    </div>
  );
} 