"use client";

/**
 * Pause and Bank Scene
 * Shows pause toggle and banked days meter
 * 
 * Key fix: Deterministic initial state for SSR
 */

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import { Pause, Play, Wallet } from "lucide-react";

type PauseState = "active" | "pausing" | "paused" | "resuming";
const PAUSE_STATES: PauseState[] = ["active", "pausing", "paused", "resuming"];

export function PauseAndBankScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);
  
  const pauseState = useCycleState<PauseState>(PAUSE_STATES, 2000, shouldAnimate && !prefersReducedMotion);
  
  const isPaused = pauseState === "paused";
  const bankedDays = pauseState === "active" ? 0 : pauseState === "pausing" ? 3 : pauseState === "paused" ? 8 : 5;

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={isPaused ? "warning" : "success"} animate={shouldAnimate}>
            {isPaused ? "Paused" : "Active"}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center items-center gap-4 px-2">
        {/* Toggle switch */}
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-[10px] font-medium",
            !isPaused ? "text-[#1a1a1a]" : "text-gray-400"
          )}>
            Active
          </span>
          
          <motion.button
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors",
              isPaused ? "bg-gray-300" : "bg-[#1a1a1a]"
            )}
          >
            <motion.div
              className={cn(
                "absolute top-1 w-5 h-5 rounded-full flex items-center justify-center",
                isPaused ? "bg-white" : "bg-[#9AE83E]"
              )}
              animate={{ left: isPaused ? "4px" : "calc(100% - 24px)" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {isPaused ? (
                <Pause className="w-3 h-3 text-gray-500" />
              ) : (
                <Play className="w-3 h-3 text-[#1a1a1a]" />
              )}
            </motion.div>
          </motion.button>
          
          <span className={cn(
            "text-[10px] font-medium",
            isPaused ? "text-[#1a1a1a]" : "text-gray-400"
          )}>
            Paused
          </span>
        </div>

        {/* Banked days meter */}
        <div className="w-full max-w-[200px]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-gray-400" />
              <span className="text-[9px] text-gray-500">Banked days</span>
            </div>
            <motion.span 
              className="text-[10px] font-mono font-medium text-[#1a1a1a]"
              key={bankedDays}
              initial={shouldAnimate ? { scale: 1.2 } : undefined}
              animate={{ scale: 1 }}
            >
              {bankedDays}
            </motion.span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#9AE83E] rounded-full"
              animate={{ width: `${(bankedDays / 30) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[7px] text-gray-400">
            <span>0</span>
            <span>30 days max</span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

export default PauseAndBankScene;

