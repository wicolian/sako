"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

interface CoverProps {
  children: React.ReactNode;
  className?: string;
}

export function Cover({ children, className }: CoverProps) {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [beamPositions] = useState<number[]>(() =>
    Array.from({ length: 8 }, () => Math.random() * 100)
  );

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 500, damping: 50 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 50 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    // Use requestAnimationFrame to avoid forced reflows during mouse moves
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseX.set(x);
      mouseY.set(y);
    });
  };

  return (
    <motion.span
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative inline-block cursor-pointer group",
        className
      )}
    >
      {/* Background gradient effect */}
      <AnimatePresence>
        {isHovered && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 -z-10 rounded-lg overflow-hidden"
          >
            {/* Animated beams */}
            {beamPositions.map((pos, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: -100 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  y: [0, 100, 200],
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.1,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ left: `${pos}%` }}
                className="absolute top-0 w-px h-20 bg-gradient-to-b from-transparent via-[#9AE83E] to-transparent"
              />
            ))}
            {/* Glow effect */}
            <motion.span
              style={{
                x: springX,
                y: springY,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[#9AE83E]/30 rounded-full blur-2xl"
            />
          </motion.span>
        )}
      </AnimatePresence>
      
      {/* Border effect */}
      <motion.span
        animate={{
          boxShadow: isHovered 
            ? "0 0 20px rgba(154, 232, 62, 0.4), inset 0 0 20px rgba(154, 232, 62, 0.1)"
            : "none",
        }}
        className="absolute inset-0 rounded-lg border border-transparent group-hover:border-[#9AE83E]/50 transition-colors duration-300"
      />
      
      {/* Content */}
      <motion.span
        animate={{
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative z-10 inline-block px-2 py-1"
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

