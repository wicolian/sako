"use client";

/**
 * Brand Consistency System Scene
 * Shows tokens/components/voice being applied consistently
 * 
 * Key fix: Deterministic initial state for SSR
 */

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import { Check, Palette, Component, MessageSquare } from "lucide-react";

const BRAND_ITEMS = [
  { uid: "tokens", label: "Tokens", icon: Palette, description: "Colors, spacing, type" },
  { uid: "components", label: "Components", icon: Component, description: "Buttons, cards, forms" },
  { uid: "voice", label: "Voice", icon: MessageSquare, description: "Tone, copy style" },
];

export function BrandConsistencySystemScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);
  
  // Animate which item is being checked
  const activeIndex = useCycleState([0, 1, 2, 2], 1200, shouldAnimate && !prefersReducedMotion);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={shouldAnimate}>
            <Check className="w-3 h-3" />
            Aligned
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center gap-2 px-2">
        {BRAND_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const isActive = i <= activeIndex;
          
          return (
            <motion.div
              key={item.uid}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg border transition-colors",
                isActive 
                  ? "bg-[#9AE83E]/10 border-[#9AE83E]" 
                  : "bg-white border-gray-100"
              )}
              initial={shouldAnimate ? { opacity: 0, x: -10 } : undefined}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
            >
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center",
                isActive ? "bg-[#9AE83E]" : "bg-gray-100"
              )}>
                <Icon className={cn("w-4 h-4", isActive ? "text-[#1a1a1a]" : "text-gray-400")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-[#1a1a1a]">{item.label}</div>
                <div className="text-[8px] text-gray-500">{item.description}</div>
              </div>
              <motion.div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  isActive ? "bg-[#1a1a1a]" : "bg-gray-100"
                )}
                animate={shouldAnimate && isActive ? { scale: [1, 1.2, 1] } : undefined}
                transition={{ duration: 0.3 }}
              >
                {isActive && <Check className="w-3 h-3 text-white" />}
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </SceneContainer>
  );
}

export default BrandConsistencySystemScene;

