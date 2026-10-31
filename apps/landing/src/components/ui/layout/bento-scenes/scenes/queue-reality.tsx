"use client";

/**
 * Queue Reality Scene
 * Shows unlimited queue vs limited active slots - visual demonstration
 *
 * Update (2026 Premium): Calm operations, scalable SVG nodes replacing fragile grid tracking.
 */

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { stepTransition } from "@/lib/motion-variants";
import { cn } from "@/lib/utils";

const ACTIVE_SLOTS = 3;

export function QueueRealityScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Cycle through how many items are in active vs queue
  const activeCount = useCycleState([2, 3, 3, 1], 5000, shouldAnimate && !prefersReducedMotion);

  // SVG Paths connecting Queue (x=160, y=100) to Slots (x=240)
  // Slots: y = 50, 100, 150
  const paths = [
    "M 160 100 C 200 100, 200 50, 240 50",
    "M 160 100 C 200 100, 200 100, 240 100",
    "M 160 100 C 200 100, 200 150, 240 150",
  ];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            <div className="relative w-16 h-4 flex items-center justify-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={activeCount}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={stepTransition}
                  className="absolute"
                >
                  {activeCount}/{ACTIVE_SLOTS} active
                </motion.span>
              </AnimatePresence>
            </div>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="w-full h-full p-2 flex items-center justify-center">
        <svg viewBox="0 0 400 200" className="w-full h-full overflow-visible">
          <defs>
            <filter id="glow-queue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="pipe-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e5e5e5" />
              <stop offset="100%" stopColor="#e5e5e5" />
            </linearGradient>
          </defs>

          {/* BACKGROUND QUEUE AREA */}
          {/* Dashed background container for queue */}
          <rect x="20" y="30" width="140" height="140" rx="8" fill="#fcfcfc" stroke="#e5e5e5" strokeWidth="2" strokeDasharray="4" />
          <text x="36" y="54" fontSize="10" fill="#a3a3a3" fontWeight="600" letterSpacing="0.1em" className="font-sans uppercase">
            Unlimited Pipeline
          </text>

          {/* Draw abstract nodes in the queue based on a grid */}
          {Array.from({ length: 15 }).map((_, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            // Leave a few empty visually to make it feel alive
            const isFilled = i !== 4 && i !== 11 && i !== 13;
            return (
              <rect
                key={i}
                x={36 + col * 36}
                y={68 + row * 20}
                width="28"
                height="12"
                rx="3"
                fill={isFilled ? "#1a1a1a" : "#f5f5f5"}
                opacity={isFilled ? 0.8 : 1}
              />
            );
          })}

          {/* Glowing Queue Out-Port */}
          <circle cx="160" cy="100" r="4" fill="#1a1a1a" />
          <circle cx="160" cy="100" r="8" fill="none" stroke="#e5e5e5" strokeWidth="2" />

          {/* CONNECTION PIPES */}
          {paths.map((d, i) => {
            const isActive = i < activeCount;
            return (
              <g key={`pipe-${i}`}>
                {/* Base pipe */}
                <path d={d} fill="none" stroke="#e5e5e5" strokeWidth="2" strokeLinecap="round" />

                {/* Active flowing pipe */}
                <motion.path
                  d={d}
                  fill="none"
                  stroke="#9AE83E" // Premium green
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="6 8"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: isActive ? 1 : 0,
                    strokeDashoffset: (shouldAnimate && isActive) ? [0, -14] : 0
                  }}
                  transition={{
                    opacity: stepTransition,
                    strokeDashoffset: { repeat: Infinity, duration: 1, ease: "linear" }
                  }}
                  filter="url(#glow-queue)"
                />
              </g>
            );
          })}

          {/* ACTIVE SLOTS */}
          <text x="240" y="24" fontSize="10" fill="#a3a3a3" fontWeight="600" letterSpacing="0.1em" className="font-sans uppercase">
            Strict Capacity
          </text>

          {paths.map((_, i) => {
            const isActive = i < activeCount;
            const yOffset = 50 + (i * 50); // 50, 100, 150
            return (
              <g key={`slot-${i}`}>
                {/* Slot Connection Port */}
                <motion.circle
                  cx="240"
                  cy={yOffset}
                  r="4"
                  initial={{ fill: "#e5e5e5" }}
                  animate={{ fill: isActive ? "#9AE83E" : "#e5e5e5" }}
                  transition={stepTransition}
                />

                {/* Slot Card */}
                <motion.rect
                  x="250"
                  y={yOffset - 18}
                  width="130"
                  height="36"
                  rx="6"
                  fill="#ffffff"
                  strokeWidth="2"
                  initial={{ stroke: "#e5e5e5" }}
                  animate={{
                    stroke: isActive ? "#1a1a1a" : "#e5e5e5",
                    fill: isActive ? "#1a1a1a" : "#ffffff"
                  }}
                  transition={stepTransition}
                />

                {/* Internal UI of the card to make it look like a task */}
                <motion.rect
                  x="262"
                  y={yOffset - 6}
                  width="20"
                  height="12"
                  rx="3"
                  initial={{ fill: "#f5f5f5" }}
                  animate={{ fill: isActive ? "#333333" : "#f5f5f5" }}
                  transition={stepTransition}
                />
                <motion.rect
                  x="294"
                  y={yOffset - 3}
                  width="50"
                  height="6"
                  rx="3"
                  initial={{ fill: "#e5e5e5" }}
                  animate={{ fill: isActive ? "#4d4d4d" : "#e5e5e5" }}
                  transition={stepTransition}
                />

                {/* Processing bar (Only visible when active, pulses) */}
                <AnimatePresence>
                  {isActive && (
                    <motion.rect
                      x="294"
                      y={yOffset - 3}
                      height="6"
                      rx="3"
                      fill="#9AE83E"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{
                        opacity: 1,
                        width: [10, 40, 10]
                      }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{
                        opacity: stepTransition,
                        width: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                      }}
                    />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isActive && (
                    <motion.text
                      x="364"
                      y={yOffset + 2}
                      fontSize="8"
                      fill="#9AE83E"
                      fontWeight="bold"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="font-mono"
                    >
                      WIP
                    </motion.text>
                  )}
                </AnimatePresence>
              </g>
            );
          })}
        </svg>
      </div>
    </SceneContainer>
  );
}

export default QueueRealityScene;

