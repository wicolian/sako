"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useProgressAnimation } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundDots, OverlayContainer, StatusChip } from "../scene-layers";
import { Play, Check } from "lucide-react";

/**
 * Scene: Video Cutdown
 * Shows timeline + 3 aspect outputs (1:1, 16:9, 9:16) with playhead scrubbing
 */

const formats = [
  { ratio: "16:9", width: 48, height: 27 },
  { ratio: "1:1", width: 36, height: 36 },
  { ratio: "9:16", width: 24, height: 42 },
];

export function VideoCutdownScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const playheadProgress = useProgressAnimation(3000, shouldAnimate);

  return (
    <SceneContainer
      background={<SceneBackgroundDots />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success">
            <Check className="w-3 h-3" />
            3 formats
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-1">
        {/* Format outputs */}
        <div className="flex-1 flex items-center justify-center gap-3">
          {formats.map((format, i) => (
            <motion.div
              key={format.ratio}
              className="relative rounded border-2 border-gray-200 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center overflow-hidden"
              style={{ width: format.width, height: format.height }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              whileHover={{ borderColor: "#9AE83E", scale: 1.05 }}
            >
              {/* Play button */}
              <motion.div
                className="w-5 h-5 rounded-full bg-[#1a1a1a]/80 flex items-center justify-center"
                animate={shouldAnimate ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
              </motion.div>
              
              {/* Progress overlay */}
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-[#9AE83E]"
                style={{ width: `${playheadProgress}%` }}
              />
              
              {/* Ratio label */}
              <span className="absolute bottom-1 right-1 text-[7px] font-mono text-gray-400">
                {format.ratio}
              </span>

              {/* Caption indicator */}
              <motion.div
                className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 rounded text-[6px] text-white"
                animate={shouldAnimate ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                CC
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Timeline */}
        <div className="h-12 bg-[#1a1a1a] rounded-lg p-2 flex flex-col gap-1">
          {/* Waveform */}
          <div className="flex-1 flex items-center gap-px">
            {Array.from({ length: 40 }).map((_, i) => {
              // Round to avoid hydration mismatch from floating-point precision
              const height = Math.round(Math.sin(i * 0.5) * 30 + 50);
              const isPast = (i / 40) * 100 < playheadProgress;
              return (
                <motion.div
                  key={i}
                  className={`flex-1 rounded-full ${isPast ? "bg-[#9AE83E]" : "bg-gray-600"}`}
                  style={{ height: `${height}%` }}
                  animate={shouldAnimate && isPast ? { scaleY: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                />
              );
            })}
          </div>

          {/* Timeline bar with playhead */}
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            {/* Progress */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-[#9AE83E]"
              style={{ width: `${playheadProgress}%` }}
            />
            {/* Playhead */}
            <motion.div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
              style={{ left: `${playheadProgress}%` }}
            />
          </div>

          {/* Time markers */}
          <div className="flex justify-between text-[7px] font-mono text-gray-500">
            <span>0:00</span>
            <span>0:30</span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

