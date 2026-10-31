"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode, forwardRef } from "react";

/**
 * Shared background layer components for bento scenes.
 * These create depth and fill the whitespace.
 */

// Ambient grid background with subtle animation
export function SceneBackgroundGrid({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Base grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:16px_16px] opacity-30" />
      {/* Radial fade at edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,white_70%)]" />
    </div>
  );
}

// Dot pattern background
export function SceneBackgroundDots({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, #1a1a1a 1px, transparent 1px)`,
          backgroundSize: '12px 12px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/80" />
    </div>
  );
}

// Radial glow background (lime accent)
export function SceneBackgroundGlow({ 
  className,
  color = "#9AE83E" 
}: { 
  className?: string;
  color?: string;
}) {
  return (
    <motion.div 
      className={cn("absolute inset-0 overflow-hidden", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] opacity-10"
        style={{
          background: `radial-gradient(circle at center, ${color} 0%, transparent 50%)`,
        }}
      />
    </motion.div>
  );
}

// Browser/window frame wrapper
export function WindowFrame({ 
  children,
  className,
  variant = "browser"
}: { 
  children: ReactNode;
  className?: string;
  variant?: "browser" | "mac" | "figma";
}) {
  return (
    <div className={cn(
      "flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm",
      className
    )}>
      {/* Window chrome */}
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-2 border-b border-gray-100",
        variant === "figma" ? "bg-[#2c2c2c]" : "bg-gray-50"
      )}>
        <div className={cn(
          "w-2.5 h-2.5 rounded-full",
          variant === "figma" ? "bg-[#ff5f57]" : "bg-red-400"
        )} />
        <div className={cn(
          "w-2.5 h-2.5 rounded-full",
          variant === "figma" ? "bg-[#febc2e]" : "bg-yellow-400"
        )} />
        <div className={cn(
          "w-2.5 h-2.5 rounded-full",
          variant === "figma" ? "bg-[#28c840]" : "bg-green-400"
        )} />
        {variant === "browser" && (
          <div className="flex-1 ml-2 h-5 bg-white rounded border border-gray-200" />
        )}
        {variant === "figma" && (
          <span className="ml-2 text-[10px] text-gray-400 font-medium">Figma</span>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 relative">
        {children}
      </div>
    </div>
  );
}

// Status overlay chip
export function StatusChip({ 
  children,
  variant = "default",
  className,
  animate = true
}: { 
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "timer";
  className?: string;
  animate?: boolean;
}) {
  const variants = {
    default: "bg-gray-100 text-gray-600 border-gray-200",
    success: "bg-[#9AE83E]/20 text-[#1a1a1a] border-[#9AE83E]",
    warning: "bg-amber-100 text-amber-700 border-amber-300",
    timer: "bg-[#1a1a1a] text-white border-[#1a1a1a]",
  };

  return (
    <motion.div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border",
        variants[variant],
        className
      )}
      initial={animate ? { opacity: 0, scale: 0.9 } : undefined}
      animate={animate ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

// Overlay container for status chips (positioned at corners)
export function OverlayContainer({ 
  children,
  position = "top-right",
  className
}: { 
  children: ReactNode;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  className?: string;
}) {
  const positions = {
    "top-right": "top-0.5 right-2",
    "top-left": "top-0.5 left-2",
    "bottom-right": "bottom-2 right-2",
    "bottom-left": "bottom-2 left-2",
  };

  return (
    <div className={cn(
      "absolute z-10 flex flex-wrap gap-1",
      positions[position],
      className
    )}>
      {children}
    </div>
  );
}

// Skeleton placeholder for mockup content
export function SkeletonLine({ 
  width = "100%",
  height = "8px",
  className 
}: { 
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div 
      className={cn("bg-gray-200 rounded", className)}
      style={{ width, height }}
    />
  );
}

// Full scene container with 3 layers
// Includes safe area padding to prevent bottom clipping
// Uses forwardRef to support ref prop for in-view detection
interface SceneContainerProps {
  children: ReactNode;
  background?: ReactNode;
  overlay?: ReactNode;
  className?: string;
}

export const SceneContainer = forwardRef<HTMLDivElement, SceneContainerProps>(
  function SceneContainer({ children, background, overlay, className }, ref) {
    return (
      <div ref={ref} className={cn("relative w-full h-full min-h-[180px]", className)}>
        {/* Layer 1: Background */}
        {background}
        
        {/* Layer 2: Main content - safe area padding prevents clipping */}
        <div className="relative z-[1] w-full h-full p-4 pb-6">
          {children}
        </div>
        
        {/* Layer 3: Overlay - positioned within safe bounds */}
        {overlay && (
          <div className="absolute inset-0 z-[2] pointer-events-none p-2">
            {overlay}
          </div>
        )}
      </div>
    );
  }
);

