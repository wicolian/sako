"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { Clock } from "lucide-react";
import { stepTransition } from "@/lib/motion-variants";

/**
 * Scene: SLA Timer (Phase 4 Overhaul)
 * Update (2026 Premium): A completely self-contained SVG dashboard dial replacing the DOM stack.
 */

const states = ["Queued", "Ready", "In Progress", "Review", "Shipped"];

export function SlaTimerScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(ref);

  // Slower, calmer loop (4s per step)
  const currentStateIndex = useCycleState([0, 1, 2, 3, 4], 4000, shouldAnimate && !prefersReducedMotion);

  // Timer active representation
  const timerActive = currentStateIndex >= 1 && currentStateIndex < 4;

  // Math for the horseshoe arc: Radius 100, Center 150,150. Sweeps from -135deg to +135deg.
  const arcPath = "M 79.289 220.71 A 100 100 0 1 1 220.71 220.71";
  const arcLength = 471.24; // 270 degrees of circumference

  const nodes = [
    { index: 0, label: "QUEUED", nx: 79.29, ny: 220.71, tx: 65, ty: 235, align: "end" },
    { index: 1, label: "READY", nx: 57.62, ny: 111.74, tx: 45, ty: 105, align: "end" },
    { index: 2, label: "IN PROGRESS", nx: 150, ny: 50, tx: 150, ty: 25, align: "middle" },
    { index: 3, label: "REVIEW", nx: 242.38, ny: 111.74, tx: 255, ty: 105, align: "start" },
    { index: 4, label: "SHIPPED", nx: 220.71, ny: 220.71, tx: 235, ty: 235, align: "start" },
  ] as const;

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={timerActive ? "timer" : "default"} animate={false}>
            <Clock className="w-3 h-3" />
            <div className="relative w-[50px] h-4 flex items-center justify-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={timerActive ? 'active' : 'inactive'}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={stepTransition}
                  className="absolute"
                >
                  {timerActive ? "47:59:42" : "00:00:00"}
                </motion.span>
              </AnimatePresence>
            </div>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex items-center justify-center p-2">

        {/* SVG DASHBOARD DIAL */}
        <svg viewBox="0 0 300 300" className="w-full h-full max-h-[220px] overflow-visible">
          <defs>
            <filter id="neon-glow-timer" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <linearGradient id="neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8BD835" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>
          </defs>

          {/* INNER DECORATIVE RINGS */}
          <circle cx="150" cy="150" r="125" fill="none" stroke="#f5f5f5" strokeWidth="1" />

          <motion.circle
            cx="150" cy="150" r="115"
            fill="none"
            stroke="#e5e5e5"
            strokeWidth="1.5"
            strokeDasharray="4 8"
            initial={{ rotate: 0 }}
            animate={shouldAnimate && !prefersReducedMotion ? { rotate: 360 } : {}}
            transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
            style={{ transformOrigin: "150px 150px" }}
          />

          {/* BACKGROUND HORSESHOE TRACK */}
          <path
            d={arcPath}
            fill="none"
            stroke="#f5f5f5"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d={arcPath}
            fill="none"
            stroke="#eaeaea"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* ACTIVE GLOWING PROGRESS ARC */}
          <motion.path
            d={arcPath}
            fill="none"
            stroke="url(#neon-grad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            // Animate dashoffset from full length (hidden) down to relative progress
            initial={{ strokeDashoffset: arcLength }}
            animate={{
              strokeDashoffset: shouldAnimate && !prefersReducedMotion
                ? arcLength * (1 - (currentStateIndex / 4))
                : arcLength * (1 - (currentStateIndex / 4))
            }}
            transition={{ duration: 3.8, ease: "easeInOut" }}
            filter="url(#neon-glow-timer)"
          />

          <motion.path
            d={arcPath}
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            initial={{ strokeDashoffset: arcLength }}
            animate={{
              strokeDashoffset: shouldAnimate && !prefersReducedMotion
                ? arcLength * (1 - (currentStateIndex / 4))
                : arcLength * (1 - (currentStateIndex / 4))
            }}
            transition={{ duration: 3.8, ease: "easeInOut" }}
          />

          {/* STATE NODES */}
          {nodes.map(node => {
            const isPast = currentStateIndex >= node.index;
            const isCurrent = currentStateIndex === node.index;

            return (
              <g key={node.label}>
                {/* Node Label */}
                <motion.text
                  x={node.tx}
                  y={node.ty}
                  textAnchor={node.align}
                  fontSize="11"
                  fontWeight="700"
                  fill={isPast ? "#1a1a1a" : "#a3a3a3"}
                  animate={{ scale: isCurrent ? 1.05 : 1 }}
                  className="font-sans uppercase tracking-[0.15em]"
                >
                  {node.label}
                </motion.text>

                {/* Pulse ring for current state */}
                {isCurrent && (
                  <motion.circle
                    cx={node.nx} cy={node.ny} r="14"
                    fill="none" stroke="#9AE83E" strokeWidth="2"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  />
                )}

                {/* Node Dot Base */}
                <motion.circle
                  cx={node.nx} cy={node.ny}
                  r="7"
                  initial={{ fill: "#ffffff", stroke: "#e5e5e5", strokeWidth: 3 }}
                  animate={{
                    fill: isPast ? (node.index === 4 ? "#1a1a1a" : "#9AE83E") : "#ffffff",
                    stroke: isPast ? "#1a1a1a" : "#e5e5e5",
                    strokeWidth: isPast ? 4 : 3
                  }}
                  transition={stepTransition}
                />
              </g>
            );
          })}

          {/* CENTER DIGITAL READOUT */}
          <g transform="translate(150, 160)">
            <AnimatePresence mode="wait" initial={false}>
              <motion.text
                key={timerActive ? "on" : "off"}
                x="0"
                y="0"
                textAnchor="middle"
                fontSize="38"
                className="font-mono"
                fill="#1a1a1a"
                fontWeight="800"
                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={stepTransition}
                letterSpacing="-0.02em"
              >
                {timerActive ? "47:59:42" : (currentStateIndex === 4 ? "COMPLETE" : "00:00:00")}
              </motion.text>
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              <motion.text
                key={`desc-${currentStateIndex}`}
                x="0"
                y="22"
                textAnchor="middle"
                fontSize="10"
                fill="#888888"
                fontWeight="600"
                className="font-sans uppercase tracking-[0.2em]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {states[currentStateIndex]}
              </motion.text>
            </AnimatePresence>
          </g>

        </svg>
      </div>
    </SceneContainer>
  );
}

export default SlaTimerScene;

