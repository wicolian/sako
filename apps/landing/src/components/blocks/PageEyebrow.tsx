"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { AnimatedGradientText } from "@/components/ui/animations/animated-gradient-text";
import { cn } from "@/lib/utils";

interface PageEyebrowProps {
  text: string;
  variant?: "default" | "minimal" | "pill";
  showIcon?: boolean;
  className?: string;
}

export function PageEyebrow({ 
  text, 
  variant = "default",
  showIcon = true,
  className 
}: PageEyebrowProps) {
  if (variant === "minimal") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn("mb-6", className)}
      >
        <AnimatedGradientText
          className="text-xs font-bold uppercase tracking-[0.2em]"
          speed={0.8}
        >
          {text}
        </AnimatedGradientText>
      </motion.div>
    );
  }

  if (variant === "pill") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn("mb-6 flex justify-center", className)}
      >
        <div className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-gray-200 bg-white/80 backdrop-blur-sm px-4 py-1.5 shadow-sm transition-all duration-300 hover:border-[#9AE83E]/50 hover:shadow-md">
          {/* Animated background shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9AE83E]/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <AnimatedGradientText
            className="relative text-[10px] font-bold uppercase tracking-[0.15em]"
            speed={0.8}
          >
            {text}
          </AnimatedGradientText>
          
          {showIcon && (
            <motion.span
              className="relative"
              animate={{ x: [0, 2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronRight className="h-3 w-3 text-[#9AE83E]" />
            </motion.span>
          )}
        </div>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn("mb-8 flex justify-center", className)}
    >
      <div className="group relative inline-flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/70 backdrop-blur-sm px-5 py-2 shadow-sm transition-all duration-300 hover:border-[#9AE83E]/40 hover:bg-white/90 hover:shadow-md">
        {/* Left accent dot */}
        <motion.div
          className="h-2 w-2 rounded-full bg-[#9AE83E]"
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <AnimatedGradientText
          className="text-xs font-bold uppercase tracking-[0.15em]"
          speed={0.8}
        >
          {text}
        </AnimatedGradientText>
        
        {showIcon && (
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-[#9AE83E] transition-colors" />
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

