"use client";

import { useRef, useState, useEffect } from "react";
import { useBentoMotionGate } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { Layers } from "lucide-react";

/**
 * Scene: Slots Queue (SVG Overhaul)
 * Visualizes tasks waiting in a queue and entering limited active slots.
 * Replaced tight HTML/CSS grid with a fluid SVG node network to prevent clipping.
 */

export function SlotsQueueScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(ref);

  // 0-3: Queue indexing
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setStep(0);
      return;
    }
    const interval = setInterval(() => {
      setStep((s) => (s >= 3 ? 0 : s + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            <Layers className="w-3 h-3" />
            2 limit
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="absolute inset-0 flex items-center justify-center p-2">
        <svg
          viewBox="0 0 240 120"
          className="w-full h-full max-w-[320px] drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Active glow filter */}
            <filter id="slotGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <linearGradient id="pipeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e5e7eb" />
              <stop offset="50%" stopColor="#9AE83E" />
              <stop offset="100%" stopColor="#e5e7eb" />
            </linearGradient>
          </defs>

          {/* BACKGROUND STRUCTURE */}
          {/* Header Text */}
          <text x="35" y="15" fontSize="8" fill="#9ca3af" fontWeight="bold" textAnchor="middle" letterSpacing="1">QUEUE</text>
          <text x="120" y="15" fontSize="8" fill="#1a1a1a" fontWeight="bold" textAnchor="middle" letterSpacing="1">ACTIVE</text>
          <text x="205" y="15" fontSize="8" fill="#8BD835" fontWeight="bold" textAnchor="middle" letterSpacing="1">DONE</text>

          {/* Pipes Connecting Columns */}
          {/* Top Pipe */}
          <path d="M 60 40 L 90 40 L 90 40" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />
          <path d="M 150 40 L 180 40" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />

          {/* Bottom Pipe */}
          <path d="M 60 80 L 90 80" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />
          <path d="M 150 80 L 180 80" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />

          {/* Animated Flow Lines (Only when animating) */}
          {shouldAnimate && !prefersReducedMotion && (
            <g stroke="url(#pipeGradient)" strokeWidth="2" strokeLinecap="round" strokeDasharray="30 100">
              <path d="M 60 40 L 90 40" opacity={step === 1 || step === 3 ? 1 : 0}>
                <animate attributeName="stroke-dashoffset" from="130" to="-30" dur="1.5s" repeatCount="indefinite" />
              </path>
              <path d="M 60 80 L 90 80" opacity={step === 2 || step === 0 ? 1 : 0}>
                <animate attributeName="stroke-dashoffset" from="130" to="-30" dur="1.5s" repeatCount="indefinite" />
              </path>
              <path d="M 150 40 L 180 40" opacity={step === 0 || step === 2 ? 1 : 0}>
                <animate attributeName="stroke-dashoffset" from="130" to="-30" dur="1.5s" repeatCount="indefinite" />
              </path>
              <path d="M 150 80 L 180 80" opacity={step === 1 || step === 3 ? 1 : 0}>
                <animate attributeName="stroke-dashoffset" from="130" to="-30" dur="1.5s" repeatCount="indefinite" />
              </path>
            </g>
          )}

          {/* QUEUE COLUMN */}
          <g>
            {/* Queue Slot 1 */}
            <rect x="10" y="25" width="50" height="30" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1" />
            <text x="35" y="43" fontSize="10" fill="#4b5563" fontWeight="bold" textAnchor="middle">LP</text>

            {/* Queue Slot 2 */}
            <rect x="10" y="65" width="50" height="30" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1" />
            <text x="35" y="83" fontSize="10" fill="#4b5563" fontWeight="bold" textAnchor="middle">AD</text>
          </g>

          {/* ACTIVE COLUMN */}
          <g>
            {/* Active Slot Top */}
            <rect x="90" y="20" width="60" height="40" rx="6" fill={step === 0 || step === 2 ? "none" : "#fff"} stroke={step === 0 || step === 2 ? "#d1d5db" : "#9AE83E"} strokeWidth={step === 0 || step === 2 ? "1" : "2"} strokeDasharray={step === 0 || step === 2 ? "4 4" : "none"} filter={step !== 0 && step !== 2 ? "url(#slotGlow)" : "none"} />
            {step !== 0 && step !== 2 && (
              <>
                <text x="120" y="44" fontSize="11" fill="#1a1a1a" fontWeight="bold" textAnchor="middle">DK</text>
                {shouldAnimate && !prefersReducedMotion && (
                  <rect x="92" y="56" width="56" height="2" rx="1" fill="#9AE83E" opacity="0.5">
                    <animate attributeName="width" from="0" to="56" dur="2s" fill="freeze" />
                  </rect>
                )}
              </>
            )}
            {/* Empty state text */}
            {(step === 0 || step === 2) && (
              <text x="120" y="43" fontSize="8" fill="#9ca3af" textAnchor="middle">Empty</text>
            )}

            {/* Active Slot Bottom */}
            <rect x="90" y="70" width="60" height="40" rx="6" fill={step === 1 || step === 3 ? "none" : "#fff"} stroke={step === 1 || step === 3 ? "#d1d5db" : "#9AE83E"} strokeWidth={step === 1 || step === 3 ? "1" : "2"} strokeDasharray={step === 1 || step === 3 ? "4 4" : "none"} filter={step !== 1 && step !== 3 ? "url(#slotGlow)" : "none"} />
            {step !== 1 && step !== 3 && (
              <>
                <text x="120" y="94" fontSize="11" fill="#1a1a1a" fontWeight="bold" textAnchor="middle">VD</text>
                {shouldAnimate && !prefersReducedMotion && (
                  <rect x="92" y="106" width="56" height="2" rx="1" fill="#9AE83E" opacity="0.5">
                    <animate attributeName="width" from="0" to="56" dur="2s" fill="freeze" />
                  </rect>
                )}
              </>
            )}
            {/* Empty state text */}
            {(step === 1 || step === 3) && (
              <text x="120" y="93" fontSize="8" fill="#9ca3af" textAnchor="middle">Empty</text>
            )}
          </g>

          {/* DONE COLUMN */}
          <g>
            {/* Done Slot 1 */}
            <rect x="190" y="27" width="30" height="26" rx="4" fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeOpacity="0.3" strokeWidth="1" />
            <path d="M 200 40 L 203 43 L 210 35" stroke="#8BD835" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Done Slot 2 */}
            <rect x="190" y="67" width="30" height="26" rx="4" fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeOpacity="0.3" strokeWidth="1" />
            <path d="M 200 80 L 203 83 L 210 75" stroke="#8BD835" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Checkmark draw entry animation */}
            {shouldAnimate && !prefersReducedMotion && step === 0 && (
              <path d="M 200 40 L 203 43 L 210 35" stroke="#8BD835" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="20" strokeDashoffset="20">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.4s" fill="freeze" />
              </path>
            )}
            {shouldAnimate && !prefersReducedMotion && step === 1 && (
              <path d="M 200 80 L 203 83 L 210 75" stroke="#8BD835" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="20" strokeDashoffset="20">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.4s" fill="freeze" />
              </path>
            )}
          </g>

        </svg>
      </div>
    </SceneContainer>
  );
}

