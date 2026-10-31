"use client";

import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { MouseEvent, ReactNode, useRef } from "react";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  radius?: number;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(154, 232, 62, 0.15)", // Lime green spotlight
  radius = 300,
}: SpotlightCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-radius);
  const mouseY = useMotionValue(-radius);

  const springX = useSpring(mouseX, { stiffness: 500, damping: 100 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 100 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  function handleMouseLeave() {
    mouseX.set(-radius);
    mouseY.set(-radius);
  }

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white border border-gray-200",
        className
      )}
    >
      {/* Spotlight effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at var(--mouse-x) var(--mouse-y), ${spotlightColor}, transparent 80%)`,
          // @ts-expect-error CSS custom properties
          "--mouse-x": springX,
          "--mouse-y": springY,
        }}
      />
      
      {/* Alternative: using CSS mask */}
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 rounded-2xl"
        style={{
          background: `radial-gradient(${radius}px circle, ${spotlightColor}, transparent 80%)`,
          x: springX,
          y: springY,
          translateX: `-${radius / 2}px`,
          translateY: `-${radius / 2}px`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

