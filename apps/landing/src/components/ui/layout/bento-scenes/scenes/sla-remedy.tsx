"use client";

/**
 * SLA Remedy Scene
 * Refactored for 2026 Premium: Shows the workflow when a task is late.
 * Calm, single-pass build up without frantic 2000ms loop rotations.
 */

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import { AlertTriangle, Receipt, ArrowRight } from "lucide-react";
import { stepTransition } from "@/lib/motion-variants";

export function SlaRemedyScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Single pass calm timeline reveal
  const [timelineDone, setTimelineDone] = useState(false);

  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setTimelineDone(true);
      return;
    }

    setTimelineDone(false);
    const t = setTimeout(() => {
      setTimelineDone(true);
    }, 3500);

    return () => clearTimeout(t);
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip
            variant={timelineDone ? "success" : "default"}
            animate={false}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={timelineDone ? 'done' : 'building'}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(2px)" }}
                transition={stepTransition}
                className="absolute"
              >
                {timelineDone ? "Credit Applied" : "Processing"}
              </motion.span>
              <span className="invisible px-2">Credit Applied</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center items-center gap-6 px-4">

        <div className="flex items-center gap-4 w-full">
          <motion.div
            className="w-14 h-14 rounded-lg bg-amber-50 border border-amber-100 flex flex-col items-center justify-center gap-1 shadow-sm shrink-0"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={stepTransition}
          >
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </motion.div>

          <div className="flex-1 relative h-[1px] bg-gray-200">
            {shouldAnimate && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-y-0 left-0 bg-[#1a1a1a]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.5, ease: "circOut" }}
              />
            )}
          </div>

          <motion.div
            className="w-14 h-14 rounded-lg bg-[#9AE83E]/10 border border-[#9AE83E]/20 flex flex-col items-center justify-center gap-1 shadow-sm shrink-0 relative overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...stepTransition }}
          >
            <Receipt className="w-5 h-5 text-[#9AE83E] relative z-10" />

            {/* Build up flash */}
            {shouldAnimate && timelineDone && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 bg-[#9AE83E]"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            )}
          </motion.div>
        </div>

        <motion.div
          className="w-full flex justify-between items-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, ...stepTransition }}
        >
          <div className="space-y-1">
            <p className="font-semibold text-xs text-[#1a1a1a]">Task missed SLA</p>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">-2 days</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="font-semibold text-xs text-[#1a1a1a]">Credit Issued</p>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[10px] text-gray-400">next bill</span>
              <span className="text-[9px] font-mono bg-[#1a1a1a] text-white px-1.5 py-0.5 rounded-sm">
                -$83
              </span>
            </div>
          </div>
        </motion.div>

      </div>
    </SceneContainer>
  );
}

export default SlaRemedyScene;

