"use client";

/**
 * Motion Included Pipeline Scene
 * Shows design -> motion -> export pipeline with progress
 * Refactored for 2026 Premium: Single, calm progression through the pipeline.
 */

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import { Palette, Film, Download, Check } from "lucide-react";
import { stepTransition } from "@/lib/motion-variants";

// Pipeline stages
type Stage = "design" | "motion" | "export" | "done";
const STAGES: Stage[] = ["design", "motion", "export", "done"];

export function MotionIncludedPipelineScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Single pass calm pipeline reveal
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setStageIndex(3);
      return;
    }
    setStageIndex(0);
    const t1 = setTimeout(() => setStageIndex(1), 1000);
    const t2 = setTimeout(() => setStageIndex(2), 2000);
    const t3 = setTimeout(() => setStageIndex(3), 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [shouldAnimate, prefersReducedMotion]);

  const currentStage = STAGES[stageIndex];

  const stageConfig = {
    design: { icon: Palette, label: "Design", color: "bg-blue-500", activeBorder: "border-blue-400" },
    motion: { icon: Film, label: "Motion", color: "bg-purple-500", activeBorder: "border-purple-400" },
    export: { icon: Download, label: "Export", color: "bg-amber-500", activeBorder: "border-amber-400" },
    done: { icon: Check, label: "Ready", color: "bg-[#9AE83E]", activeBorder: "border-[#8BD835]" },
  };

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={currentStage === "done" ? "success" : "default"} animate={false}>
            Motion included
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center px-4 gap-4">
        {/* Pipeline visualization */}
        <div className="flex items-center justify-between w-full relative">
          {/* Background track line */}
          <div className="absolute left-4 right-4 h-0.5 bg-gray-100 top-1/2 -mt-[1px] z-0" />

          {/* Active sweep line */}
          {shouldAnimate && !prefersReducedMotion && (
            <div className="absolute left-4 right-4 h-0.5 top-1/2 -mt-[1px] z-0 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gray-400"
                initial={{ width: "0%" }}
                animate={{ width: stageIndex === 0 ? "0%" : stageIndex === 1 ? "50%" : "100%" }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
            </div>
          )}
          {currentStage === "done" && <div className="absolute left-4 right-4 h-0.5 bg-gray-400 top-1/2 -mt-[1px] z-0" />}

          {STAGES.map((stage, i) => {
            const config = stageConfig[stage];
            const Icon = config.icon;
            const isActive = i <= stageIndex;
            const isCurrent = stage === currentStage;
            const isDoneStage = stage === "done";

            return (
              <div key={stage} className="relative z-10 flex flex-col items-center">
                <motion.div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-colors duration-700",
                    isActive && !isDoneStage ? config.color : isActive && isDoneStage ? "bg-[#9AE83E]" : "bg-white border-gray-200",
                    isCurrent && !isDoneStage && "ring-4 ring-offset-1 ring-gray-100",
                    isActive ? config.activeBorder : "border-gray-200"
                  )}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={shouldAnimate ? { opacity: 1, scale: isCurrent ? 1.05 : 1 } : { opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, ...stepTransition }}
                >
                  <Icon className={cn("w-4 h-4 transition-colors duration-700", isActive && !isDoneStage ? "text-white" : isActive && isDoneStage ? "text-[#1a1a1a]" : "text-gray-300")} strokeWidth={isActive && isDoneStage ? 3 : 2} />
                </motion.div>

                {/* Stage label below icon */}
                <motion.div
                  className={cn(
                    "absolute -bottom-5 text-[9px] font-medium whitespace-nowrap transition-colors duration-700",
                    isCurrent ? "text-[#1a1a1a]" : isActive ? "text-gray-500" : "text-gray-300 opacity-50"
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: (i * 0.1) + 0.2 }}
                >
                  {config.label}
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Format outputs */}
        <div className="h-6 mt-4 flex justify-center items-center">
          <AnimatePresence mode="wait">
            {currentStage === "done" && (
              <motion.div
                key="formats"
                className="flex justify-center gap-2"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={stepTransition}
              >
                {[".MP4", ".GIF", ".LOTTIE"].map((format, i) => (
                  <motion.div
                    key={format}
                    className="px-2 py-1 rounded-md bg-[#1a1a1a] text-[8px] tracking-widest font-mono text-white"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, ...stepTransition }}
                  >
                    {format}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SceneContainer>
  );
}

export default MotionIncludedPipelineScene;

