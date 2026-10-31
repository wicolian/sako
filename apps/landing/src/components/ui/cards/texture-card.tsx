"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface TextureCardProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showNoise?: boolean;
  noiseOpacity?: number;
}

export function TextureCard({
  children,
  className,
  containerClassName,
  gradientFrom = "from-neutral-100",
  gradientTo = "to-neutral-50",
  showNoise = true,
  noiseOpacity = 0.03,
}: TextureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        containerClassName
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br",
          gradientFrom,
          gradientTo
        )}
      />
      
      {/* Noise texture overlay */}
      {showNoise && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: noiseOpacity,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      )}
      
      {/* Border gradient */}
      <div className="absolute inset-0 rounded-2xl border border-black/5" />
      
      {/* Inner shadow for depth */}
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]" />
      
      {/* Content */}
      <div className={cn("relative z-10", className)}>
        {children}
      </div>
    </motion.div>
  );
}

// Lime-themed variant specifically for Sako
export function TextureCardLime({
  children,
  className,
  containerClassName,
}: Omit<TextureCardProps, 'gradientFrom' | 'gradientTo'>) {
  return (
    <TextureCard
      containerClassName={containerClassName}
      className={className}
      gradientFrom="from-[#9AE83E]/10"
      gradientTo="to-white"
      noiseOpacity={0.02}
    >
      {children}
    </TextureCard>
  );
}

