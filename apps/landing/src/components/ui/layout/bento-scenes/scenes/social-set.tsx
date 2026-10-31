"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { Calendar, Check, Image } from "lucide-react";

/**
 * Scene: Social Set
 * Shows stacked posts that slide into a schedule lane
 */

const posts = [
  { id: 1, day: "Mon", color: "bg-blue-100 border-blue-300", icon: "🚀" },
  { id: 2, day: "Wed", color: "bg-purple-100 border-purple-300", icon: "💡" },
  { id: 3, day: "Fri", color: "bg-[#9AE83E]/20 border-[#9AE83E]", icon: "🎯" },
];

export function SocialSetScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const scheduledCount = useCycleState([0, 1, 2, 3], 1200, shouldAnimate);
  const expandedIndex = useCycleState([0, 1, 2, -1], 1500, shouldAnimate);

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={scheduledCount === 3 ? "success" : "default"}>
            <Calendar className="w-3 h-3" />
            {scheduledCount}/3 scheduled
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-1">
        {/* Schedule lane header */}
        <div className="flex gap-1 justify-center">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, i) => (
            <div
              key={day}
              className={`w-8 h-5 rounded text-[8px] font-medium flex items-center justify-center ${
                posts.some((p, pi) => p.day === day && pi < scheduledCount)
                  ? "bg-[#9AE83E]/20 text-[#1a1a1a]"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Posts container */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {posts.map((post, i) => {
            const isScheduled = i < scheduledCount;
            const isExpanded = i === expandedIndex;
            
            return (
              <motion.div
                key={post.id}
                className={`relative rounded-lg border-2 overflow-hidden ${post.color} ${
                  isScheduled ? "shadow-md" : "opacity-50"
                }`}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  y: isScheduled ? 0 : 10,
                  scale: isExpanded ? 1.1 : 1,
                  width: isExpanded ? 80 : 56,
                  height: isExpanded ? 80 : 56,
                }}
                transition={{ 
                  duration: 0.4, 
                  type: "spring", 
                  stiffness: 300 
                }}
              >
                {/* Post content */}
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                  {/* Image placeholder */}
                  <div className="w-full flex-1 bg-white/50 rounded flex items-center justify-center">
                    <span className="text-lg">{post.icon}</span>
                  </div>
                  
                  {/* Caption placeholder */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className="w-full space-y-0.5"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="w-full h-1 bg-gray-300/50 rounded" />
                        <div className="w-3/4 h-1 bg-gray-300/30 rounded" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Day badge */}
                <motion.div
                  className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-black/60 rounded text-[6px] text-white font-medium"
                  animate={{ opacity: isScheduled ? 1 : 0.3 }}
                >
                  {post.day}
                </motion.div>

                {/* Scheduled checkmark */}
                <AnimatePresence>
                  {isScheduled && (
                    <motion.div
                      className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#9AE83E] flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Caption indicator */}
        <div className="flex justify-center gap-2 text-[8px] text-gray-500">
          <span className="flex items-center gap-1">
            <Image className="w-3 h-3" />
            Visual
          </span>
          <span>+</span>
          <span>Caption</span>
        </div>
      </div>
    </SceneContainer>
  );
}

