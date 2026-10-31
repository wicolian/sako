"use client";

import { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        !vertical ? "flex-row" : "flex-col",
        className
      )}
      onMouseEnter={pauseOnHover ? (e) => {
        const animatedElements = e.currentTarget.querySelectorAll('[class*="animate-marquee"]');
        animatedElements.forEach((el) => {
          (el as HTMLElement).style.animationPlayState = 'paused';
        });
      } : undefined}
      onMouseLeave={pauseOnHover ? (e) => {
        const animatedElements = e.currentTarget.querySelectorAll('[class*="animate-marquee"]');
        animatedElements.forEach((el) => {
          (el as HTMLElement).style.animationPlayState = 'running';
        });
      } : undefined}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex shrink-0 justify-around [gap:var(--gap)]",
              !vertical ? "animate-marquee flex-row" : "animate-marquee-vertical flex-col",
              reverse && "[animation-direction:reverse]",
            )}
          >
            {children}
          </div>
        ))}
    </div>
  );
}

