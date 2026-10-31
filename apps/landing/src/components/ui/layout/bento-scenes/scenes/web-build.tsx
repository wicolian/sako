"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundDots, OverlayContainer, StatusChip, WindowFrame } from "../scene-layers";
import { ArrowRight, Check, Globe } from "lucide-react";

/**
 * Scene: Web Build
 * Shows Figma -> build steps -> published URL pipeline
 */

const buildSteps = [
  { id: "layout", label: "Layout", icon: "◻" },
  { id: "responsive", label: "Responsive", icon: "📱" },
  { id: "publish", label: "Publish", icon: "🚀" },
];

export function WebBuildScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const completedStep = useCycleState([0, 1, 2, 3], 1200, shouldAnimate);
  const isPublished = completedStep >= 3;

  return (
    <SceneContainer
      background={<SceneBackgroundDots />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={isPublished ? "success" : "default"}>
            <Globe className="w-3 h-3" />
            {isPublished ? "Live" : "Building..."}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-1">
        {/* Pipeline */}
        <div className="flex items-center justify-center gap-1">
          {/* Figma */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
                <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
                <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
                <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
                <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
              </svg>
            </div>
            <span className="text-[7px] text-gray-500">Figma</span>
          </div>

          {/* Arrow */}
          <motion.div
            animate={shouldAnimate ? { x: [0, 3, 0] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ArrowRight className="w-3 h-3 text-gray-400" />
          </motion.div>

          {/* Build steps */}
          <div className="flex gap-1">
            {buildSteps.map((step, i) => {
              const isComplete = i < completedStep;
              const isCurrent = i === completedStep;
              
              return (
                <motion.div
                  key={step.id}
                  className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    isComplete 
                      ? "bg-[#9AE83E]/20 border-2 border-[#9AE83E]" 
                      : isCurrent
                        ? "bg-blue-100 border-2 border-blue-400"
                        : "bg-gray-100 border-2 border-gray-200"
                  }`}
                  animate={isCurrent && shouldAnimate ? { 
                    scale: [1, 1.05, 1],
                  } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4 text-[#9AE83E]" />
                  ) : (
                    <span className="text-sm">{step.icon}</span>
                  )}
                  <span className="text-[6px] text-gray-500">{step.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Arrow */}
          <motion.div
            animate={shouldAnimate && isPublished ? { x: [0, 3, 0] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ArrowRight className="w-3 h-3 text-gray-400" />
          </motion.div>

          {/* Published */}
          <motion.div
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isPublished 
                ? "bg-[#9AE83E] text-white" 
                : "bg-gray-100 text-gray-400"
            }`}
            animate={isPublished && shouldAnimate ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: isPublished ? 3 : 0 }}
          >
            <Globe className="w-4 h-4" />
          </motion.div>
        </div>

        {/* Browser preview */}
        <WindowFrame variant="browser" className="flex-1">
          <div className="w-full h-full bg-white p-2">
            <motion.div
              className="w-full h-full rounded border border-gray-200 flex flex-col items-center justify-center gap-1"
              animate={{ 
                opacity: completedStep > 0 ? 1 : 0.3,
                scale: completedStep > 0 ? 1 : 0.95,
              }}
              transition={{ duration: 0.3 }}
            >
              {/* Mini page skeleton */}
              <div className="w-12 h-1.5 bg-gray-200 rounded" />
              <div className="w-8 h-1 bg-gray-100 rounded" />
              <div className="w-6 h-2 bg-[#9AE83E]/30 rounded mt-1" />
            </motion.div>
          </div>
        </WindowFrame>

        {/* URL bar */}
        <motion.div
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
            isPublished 
              ? "bg-[#9AE83E]/20 border border-[#9AE83E]" 
              : "bg-gray-100 border border-gray-200"
          }`}
          animate={isPublished && shouldAnimate ? { 
            boxShadow: ["0 0 0 0 rgba(154, 232, 62, 0)", "0 0 0 4px rgba(154, 232, 62, 0.3)", "0 0 0 0 rgba(154, 232, 62, 0)"],
          } : {}}
          transition={{ duration: 1, repeat: isPublished ? Infinity : 0 }}
        >
          <Globe className={`w-3 h-3 ${isPublished ? "text-[#9AE83E]" : "text-gray-400"}`} />
          <span className={`text-[9px] font-mono ${isPublished ? "text-[#1a1a1a]" : "text-gray-400"}`}>
            {isPublished ? "yoursite.webflow.io" : "building..."}
          </span>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

