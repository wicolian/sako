"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedGradientTextProps {
  children?: ReactNode;
  className?: string;
  speed?: number;
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
}: AnimatedGradientTextProps) {
  return (
    <span
      style={
        {
          "--bg-size": `${speed * 300}%`,
        } as React.CSSProperties
      }
      className={cn(
        // Base green color with lighter shimmer cycling through
        "animate-gradient inline bg-gradient-to-r from-[#9AE83E] via-[#81c039] to-[#b7d09a] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}
