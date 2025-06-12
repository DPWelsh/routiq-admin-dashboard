"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedGradientTextProps {
  children: ReactNode;
  className?: string;
}

export default function AnimatedGradientText({
  children,
  className,
}: AnimatedGradientTextProps) {
  return (
    <div
      className={cn(
        "group relative mx-auto flex max-w-fit flex-row items-center justify-center rounded-2xl bg-routiq-cloud/40 px-6 py-2 text-sm font-medium shadow-[inset_0_-8px_10px_rgba(123,162,224,0.1)] backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[inset_0_-5px_10px_rgba(123,162,224,0.2)] dark:bg-routiq-core/40",
        className,
      )}
    >
      <div
        className={`absolute inset-0 block h-full w-full animate-gradient bg-gradient-to-r from-routiq-energy/50 via-routiq-prompt/50 to-routiq-blackberry/50 bg-[length:var(--bg-size)_100%] p-[1px] ![mask-composite:subtract] [border-radius:inherit] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]`}
      />

      <span className="relative z-10 text-routiq-core dark:text-routiq-cloud font-medium">
        {children}
      </span>
    </div>
  );
} 