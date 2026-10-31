"use client";

import { useRef } from "react";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { Check } from "lucide-react";

/**
 * Scene: Ready Scope (SVG Overhaul)
 * Represents checking off requirements before a task can start.
 * Uses a fully responsive SVG node list instead of heavy HTML DOM elements to prevent clipping.
 */

export function ReadyScopeScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(ref);
  const filledCount = useCycleState([0, 1, 2, 3], 1500, shouldAnimate);
  const allFilled = filledCount >= 3;

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={allFilled ? "success" : "default"}>
            <Check className="w-3 h-3" />
            {allFilled ? "Ready" : "Waiting"}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="absolute inset-0 flex items-center justify-center p-4">
        {/*
          100% width/height SVG viewBox ensures the graphic scales safely inside any
          grid cell dimensions without clipping at the bottom.
        */}
        <svg
          viewBox="0 0 200 160"
          className="w-full h-full max-w-[280px] drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Active glow filter */}
            <filter id="readyGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background structural nodes (always faint) */}
          <g className="text-gray-200">
            {/* Scope Box */}
            <rect x="20" y="20" width="160" height="30" rx="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
            {/* Assets Box */}
            <rect x="20" y="65" width="160" height="30" rx="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
            {/* Owner Box */}
            <rect x="20" y="110" width="160" height="30" rx="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          </g>

          {/* Item 1: Deliverable / Scope */}
          <g>
            {filledCount >= 1 && (
              <>
                <rect x="20" y="20" width="160" height="30" rx="4" fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeWidth="1.5" />
                <circle cx="35" cy="35" r="6" fill="#9AE83E" />
                <path d="M32 35.5L34 37.5L38 32.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {shouldAnimate && !prefersReducedMotion && (
                    <animate attributeName="stroke-dasharray" values="0 10; 10 0" dur="0.3s" fill="freeze" />
                  )}
                </path>
                <text x="50" y="34" fontSize="8" fill="#666" fontWeight="bold">DELIVERABLE</text>
                <text x="50" y="44" fontSize="8" fill="#1a1a1a" fontWeight="bold">Landing Page</text>
              </>
            )}
          </g>

          {/* Connection line 1 to 2 */}
          <line x1="35" y1="50" x2="35" y2="65" stroke="currentColor" strokeWidth="1" className={filledCount >= 2 ? "text-[#9AE83E]" : "text-gray-200"} strokeDasharray={filledCount >= 2 ? "none" : "2 2"} />

          {/* Item 2: Assets */}
          <g>
            {filledCount >= 2 && (
              <>
                <rect x="20" y="65" width="160" height="30" rx="4" fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeWidth="1.5" />
                <circle cx="35" cy="80" r="6" fill="#9AE83E" />
                <path d="M32 80.5L34 82.5L38 77.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {shouldAnimate && !prefersReducedMotion && (
                    <animate attributeName="stroke-dasharray" values="0 10; 10 0" dur="0.3s" fill="freeze" />
                  )}
                </path>
                <text x="50" y="79" fontSize="8" fill="#666" fontWeight="bold">ASSETS</text>
                <text x="50" y="89" fontSize="8" fill="#1a1a1a" fontWeight="bold">Figma Link + Copy</text>
              </>
            )}
          </g>

          {/* Connection line 2 to 3 */}
          <line x1="35" y1="95" x2="35" y2="110" stroke="currentColor" strokeWidth="1" className={filledCount >= 3 ? "text-[#9AE83E]" : "text-gray-200"} strokeDasharray={filledCount >= 3 ? "none" : "2 2"} />

          {/* Item 3: Owner */}
          <g>
            {filledCount >= 3 && (
              <>
                <rect x="20" y="110" width="160" height="30" rx="4" fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeWidth="1.5" />
                <circle cx="35" cy="125" r="6" fill="#9AE83E" />
                <path d="M32 125.5L34 127.5L38 122.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {shouldAnimate && !prefersReducedMotion && (
                    <animate attributeName="stroke-dasharray" values="0 10; 10 0" dur="0.3s" fill="freeze" />
                  )}
                </path>
                <text x="50" y="124" fontSize="8" fill="#666" fontWeight="bold">OWNER</text>
                <text x="50" y="134" fontSize="8" fill="#1a1a1a" fontWeight="bold">Mktg Lead</text>
              </>
            )}
          </g>

          {/* Ready Overlay Flash */}
          {allFilled && shouldAnimate && !prefersReducedMotion && (
            <rect x="20" y="20" width="160" height="120" rx="6" fill="#9AE83E" fillOpacity="0" pointerEvents="none">
              <animate attributeName="fill-opacity" values="0; 0.2; 0" dur="1s" repeatCount="1" />
            </rect>
          )}
        </svg>
      </div>
    </SceneContainer>
  );
}


