"use client";

/**
 * Tasks Bounded 48h Scene
 * Update (2026 Premium): Calm continuous progress sweep, smooth entries, no ticking numbers.
 */

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { fadeSlideUp } from "@/lib/motion-variants";

const TASKS = [
  { uid: "t1", label: "Landing page", delayMs: 0 },
  { uid: "t2", label: "Ad set", delayMs: 400 },
  { uid: "t3", label: "Deck refresh", delayMs: 1200 },
];

export function TasksBounded48hScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="timer" animate={false}>
            <Clock className="w-3 h-3" />
            48h each
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center gap-2 px-2">
        {shouldAnimate && (
          <motion.div
            className="flex flex-col gap-2 relative z-10 w-full"
            variants={{
              show: { transition: { staggerChildren: 0.15 } }
            }}
            initial="hidden"
            animate="show"
          >
            {TASKS.map((task, i) => {
              return (
                <motion.div
                  key={task.uid}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
                  variants={fadeSlideUp}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-[#1a1a1a] truncate mb-1">
                      {task.label}
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden w-full relative">
                      {/* Premium single continuous sweep progressing to completion */}
                      <motion.div
                        className={cn(
                          "absolute top-0 left-0 bottom-0 bg-[#1a1a1a] rounded-full",
                        )}
                        initial={{ width: "15%" }}
                        animate={shouldAnimate && !prefersReducedMotion ? { width: ["15%", "100%"] } : { width: "15%" }}
                        transition={{
                          duration: 5,
                          delay: task.delayMs / 1000,
                          ease: "circOut" // Starts fast, settles calmly into completion
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono bg-gray-50 px-1.5 py-0.5 rounded shadow-sm border border-gray-100 min-w-10 justify-center">
                    {/* Static text, no nervous ticking */}
                    <span className={"font-medium text-gray-500"}>
                      SLAs
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </SceneContainer>
  );
}

export default TasksBounded48hScene;

