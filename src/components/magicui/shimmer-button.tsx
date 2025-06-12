"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "energy" | "prompt";
}

const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#7ba2e0",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "12px",
      background,
      variant = "primary",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "primary":
          return {
            background: background || "rgb(26, 28, 18)",
            textColor: "text-routiq-cloud",
            borderColor: "border-routiq-core/20"
          };
        case "secondary":
          return {
            background: background || "rgb(237, 237, 235)",
            textColor: "text-routiq-core",
            borderColor: "border-routiq-core/10"
          };
        case "energy":
          return {
            background: background || "rgb(125, 49, 45)",
            textColor: "text-white",
            borderColor: "border-routiq-energy/20"
          };
        case "prompt":
          return {
            background: background || "rgb(123, 162, 224)",
            textColor: "text-white",
            borderColor: "border-routiq-prompt/20"
          };
        default:
          return {
            background: background || "rgb(26, 28, 18)",
            textColor: "text-routiq-cloud",
            borderColor: "border-routiq-core/20"
          };
      }
    };

    const variantStyles = getVariantStyles();

    return (
      <button
        style={
          {
            "--shimmer-color": shimmerColor,
            "--shimmer-size": shimmerSize,
            "--shimmer-duration": shimmerDuration,
            "--border-radius": borderRadius,
            "--background": variantStyles.background,
          } as React.CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap px-6 py-3 font-medium [background:var(--background)] [border-radius:var(--border-radius)]",
          "transform-gpu transition-all duration-300 ease-in-out active:scale-95 hover:scale-105",
          "border-2",
          variantStyles.textColor,
          variantStyles.borderColor,
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* spark container */}
        <div className="-z-30 blur-[2px]">
          <div className="absolute inset-0 overflow-visible [container-type:size]">
            {/* spark */}
            <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
              {/* spark before */}
              <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--shimmer-size)*0.5)),transparent_0,var(--shimmer-color)_var(--shimmer-size),transparent_calc(var(--shimmer-size)*1.5))] [translate:0_0]" />
            </div>
          </div>
        </div>
        
        <span className="relative z-10 font-medium tracking-wide">
          {children}
        </span>

        {/* Highlight */}
        <div className="absolute -z-20 [background:var(--background)] [border-radius:var(--border-radius)] [inset:var(--shimmer-size)]" />
        {/* backdrop */}
        <div className="absolute -z-10 [background:var(--background)] [border-radius:var(--border-radius)] [inset:calc(var(--shimmer-size)/2)]" />
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";

export { ShimmerButton }; 