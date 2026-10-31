"use client";

import { useRef } from "react";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { Check } from "lucide-react";

/**
 * Scene: Ad Creative Set (SVG Overhaul)
 * Shows a render pipeline generating different aspect ratios (1:1, 9:16, etc).
 * Uses a fully responsive SVG graph instead of CSS grid to prevent clipped content.
 */

const adSizes = [
  { w: 40, h: 40, label: "1:1", cx: 60, cy: 50 },
  { w: 60, h: 32, label: "1.91:1", cx: 120, cy: 50 },
  { w: 30, h: 54, label: "9:16", cx: 180, cy: 50 },
  { w: 32, h: 40, label: "4:5", cx: 80, cy: 110 },
  { w: 64, h: 36, label: "16:9", cx: 160, cy: 110 },
];

export function AdCreativeSetScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(ref);
  const activeSize = useCycleState([0, 1, 2, 3, 4], 2000, shouldAnimate);

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="bottom-right">
          <StatusChip variant="success">
            <Check className="w-3 h-3" />
            5 formats
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="absolute inset-0 flex items-center justify-center p-4">
        <svg
          viewBox="0 0 240 160"
          className="w-full h-full max-w-[320px] drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Active glow filter */}
            <filter id="renderGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Pattern for the "canvas" background */}
            <pattern id="canvasDobs" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.5" fill="#d1d5db" />
            </pattern>
          </defs>

          {/* Connection Lines (Pipeline) */}
          <path d="M 60 50 L 120 50 L 180 50" stroke="#f3f4f6" strokeWidth="1" />
          <path d="M 120 50 L 120 110" stroke="#f3f4f6" strokeWidth="1" />
          <path d="M 80 110 L 160 110" stroke="#f3f4f6" strokeWidth="1" />

          {/* Render Nodes */}
          {adSizes.map((size, index) => {
            const isActive = index === activeSize;

            return (
              <g key={index} transform={`translate(${size.cx - size.w / 2}, ${size.cy - size.h / 2})`}>
                {/* Canvas Background */}
                <rect x="0" y="0" width={size.w} height={size.h} fill="url(#canvasDobs)" stroke="#e5e7eb" strokeWidth="1" rx="2" />

                {/* Active Render Overlay */}
                <g style={{ transition: "opacity 0.4s ease-out" }} opacity={isActive ? 1 : 0}>
                  <rect x="0" y="0" width={size.w} height={size.h} fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeWidth="1.5" rx="2" filter="url(#renderGlow)" />

                  {/* Drawing animation */}
                  {shouldAnimate && !prefersReducedMotion && isActive && (
                    <rect x="2" y="2" width={size.w - 4} height={size.h - 4} fill="none" stroke="#8BD835" strokeWidth="1" strokeDasharray={`${size.w * 2 + size.h * 2}`} strokeDashoffset={`${size.w * 2 + size.h * 2}`}>
                      <animate attributeName="stroke-dashoffset" from={`${size.w * 2 + size.h * 2}`} to="0" dur="1.5s" fill="freeze" />
                    </rect>
                  )}
                  {/* Internal composition blocks */}
                  {isActive && (
                    <>
                      <rect x="4" y="4" width={size.w - 8} height={(size.h - 8) * 0.6} rx="1" fill="#9AE83E" fillOpacity="0.3" />
                      <rect x="4" y={(size.h - 8) * 0.6 + 6} width={(size.w - 8) * 0.7} height="4" rx="1" fill="#9AE83E" fillOpacity="0.5" />
                      <rect x="4" y={(size.h - 8) * 0.6 + 12} width={(size.w - 8) * 0.4} height="2" rx="1" fill="#9AE83E" fillOpacity="0.2" />
                    </>
                  )}
                </g>

                {/* Aspect Ratio Label */}
                <rect x={size.w / 2 - 12} y={size.h + 4} width="24" height="10" rx="2" fill={isActive ? "#1a1a1a" : "#f3f4f6"} style={{ transition: "fill 0.4s ease-out" }} />
                <text x={size.w / 2} y={size.h + 11} fontSize="5" fill={isActive ? "#fff" : "#9ca3af"} fontWeight="bold" textAnchor="middle" style={{ transition: "fill 0.4s ease-out" }}>{size.label}</text>
              </g>
            );
          })}

          {/* Central Export HUD */}
          <g transform="translate(120, 80)">
            <rect x="-35" y="-12" width="70" height="24" rx="12" fill="#1a1a1a" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))" />
            {/* Spinner */}
            <g transform="translate(-20, 0)">
              <circle cx="0" cy="0" r="5" fill="none" stroke="#333" strokeWidth="1.5" />
              {shouldAnimate && !prefersReducedMotion && (
                <path d="M 0 -5 A 5 5 0 0 1 5 0" fill="none" stroke="#9AE83E" strokeWidth="1.5" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="1s" repeatCount="indefinite" />
                </path>
              )}
            </g>
            <text x="-5" y="3" fontSize="7" fill="#fff" fontWeight="bold">Exporting...</text>
          </g>

        </svg>
      </div>
    </SceneContainer>
  );
}


