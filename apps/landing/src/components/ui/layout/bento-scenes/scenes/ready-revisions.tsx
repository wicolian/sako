"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundDots, OverlayContainer, StatusChip } from "../scene-layers";
import { Check, RefreshCw, GitBranch, ArrowRight } from "lucide-react";

/**
 * Scene: Ready Revisions
 * Shows revision timeline compressing into "matches brief", with "new direction" branching
 */

const revisions = ["v1", "v2", "v3", "v4"];

export function ReadyRevisionsScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const stage = useCycleState([0, 1, 2, 3, 4], 1200, shouldAnimate);
  // 0-3: revisions progressing, 4: matches brief or new direction

  const currentRevision = Math.min(stage, 3);
  const isComplete = stage >= 4;

  return (
    <SceneContainer
      background={<SceneBackgroundDots />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={isComplete ? "success" : "default"}>
            <RefreshCw className="w-3 h-3" />
            {isComplete ? "Matches brief" : "Revising..."}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-2 py-1">
        {/* Revision timeline */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1">
            {revisions.map((rev, i) => {
              const isPast = i < currentRevision;
              const isCurrent = i === currentRevision;
              const isFuture = i > currentRevision;
              
              return (
                <div key={rev} className="flex items-center">
                  <motion.div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-medium border-2 ${
                      isPast 
                        ? "bg-gray-100 border-gray-200 text-gray-400 line-through" 
                        : isCurrent 
                          ? "bg-[#9AE83E]/20 border-[#9AE83E] text-[#1a1a1a]"
                          : "bg-gray-50 border-gray-200 text-gray-300"
                    }`}
                    animate={isCurrent && shouldAnimate ? { 
                      scale: [1, 1.05, 1],
                    } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    {rev}
                  </motion.div>
                  
                  {i < revisions.length - 1 && (
                    <motion.div 
                      className={`w-3 h-0.5 mx-0.5 ${
                        isPast ? "bg-gray-300" : "bg-gray-200"
                      }`}
                      animate={isCurrent ? { opacity: [0.5, 1, 0.5] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
              );
            })}
            
            {/* Final state */}
            <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
            
            <AnimatePresence mode="wait">
              {isComplete ? (
                <motion.div
                  key="complete"
                  className="w-10 h-8 rounded-lg bg-[#9AE83E] flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="pending"
                  className="w-10 h-8 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="text-[8px] text-gray-400">?</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Branch indicator for new direction */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100">
            <RefreshCw className="w-3 h-3 text-gray-500" />
            <span className="text-[8px] text-gray-500">Unlimited until brief</span>
          </div>
          
          <div className="text-[8px] text-gray-400">|</div>
          
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-50 border border-amber-200">
            <GitBranch className="w-3 h-3 text-amber-500" />
            <span className="text-[8px] text-amber-600">New direction = new task</span>
          </div>
        </div>

        {/* Status bar */}
        <motion.div
          className={`flex items-center justify-center gap-2 p-2 rounded-lg ${
            isComplete 
              ? "bg-[#9AE83E] text-white" 
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {isComplete ? (
            <>
              <Check className="w-3 h-3" />
              <span className="text-[10px] font-semibold">Brief matched. Ship it.</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px] font-medium">Revision {currentRevision + 1} in progress</span>
            </>
          )}
        </motion.div>
      </div>
    </SceneContainer>
  );
}

