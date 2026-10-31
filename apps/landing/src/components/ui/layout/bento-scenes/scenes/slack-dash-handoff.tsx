"use client";

import { useRef } from "react";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { MessageSquare } from "lucide-react";

/**
 * Scene: Slack Dash Handoff (SVG Overhaul)
 * Visualizes a notification ping moving from Slack to the Sako Dashboard.
 * Uses a fully responsive SVG isometric graph instead of heavy HTML/CSS rectangles.
 */

export function SlackDashHandoffScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(ref);
  const stage = useCycleState([0, 1, 2, 3], 1500, shouldAnimate);
  // 0: idle, 1: slack ping, 2: transit, 3: dashboard received

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success">
            <MessageSquare className="w-3 h-3" />
            Synced
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="absolute inset-0 flex items-center justify-center p-4">
        <svg
          viewBox="0 0 240 140"
          className="w-full h-full max-w-[320px] drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Glow filters for active states */}
            <filter id="slackGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="dashGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* BACKGROUND CONNECTION LINE */}
          <path d="M 70 70 L 170 70" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="4 4" />

          {/* Animated Transit Pulse (Stage 2) */}
          <g>
            {(stage === 1 || stage === 2) && shouldAnimate && !prefersReducedMotion && (
              <circle cx="70" cy="70" r="4" fill="#9AE83E" filter="url(#dashGlow)">
                <animate attributeName="cx" values="70; 170" dur="1.5s" fill="freeze" keyTimes="0; 1" repeatCount="1" />
                <animate attributeName="opacity" values="0; 1; 1; 0" dur="1.5s" fill="freeze" keyTimes="0; 0.2; 0.8; 1" repeatCount="1" />
              </circle>
            )}
          </g>

          {/* LEFT NODE: SLACK */}
          <g transform="translate(15, 30)">
            {/* Main Window */}
            <rect x="0" y="0" width="55" height="80" rx="6" fill="#4A154B" stroke="#5B1F5C" strokeWidth="1" />

            {/* Header */}
            <rect x="0" y="0" width="55" height="15" rx="6" fill="#3B0F3C" />
            <circle cx="10" cy="7.5" r="2.5" fill="#4ade80" />
            <text x="18" y="10" fontSize="6" fill="#fff" fillOpacity="0.8" fontWeight="bold">#design</text>

            {/* Skeleton Messages */}
            <circle cx="10" cy="25" r="3" fill="#9ca3af" />
            <rect x="18" y="23" width="30" height="2" rx="1" fill="#fff" fillOpacity="0.3" />
            <rect x="18" y="27" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.1" />

            {/* Ping Notification (Stages 1,2,3) */}
            <g opacity={stage >= 1 ? 1 : 0} style={{ transition: "opacity 0.3s ease-out" }}>
              <rect x="4" y="35" width="47" height="16" rx="4" fill="#9AE83E" fillOpacity="0.2" />
              <circle cx="12" cy="43" r="3" fill="#9AE83E" filter={stage === 1 ? "url(#slackGlow)" : "none"} />
              <rect x="18" y="39" width="28" height="2" rx="1" fill="#9AE83E" />
              <text x="18" y="48" fontSize="5" fill="#fff" fillOpacity="0.8">Task ready!</text>
            </g>

            {/* Platform Label */}
            <text x="27.5" y="92" fontSize="8" fill="#9ca3af" fontWeight="bold" textAnchor="middle" letterSpacing="1">SLACK</text>
          </g>

          {/* RIGHT NODE: SAKO DASHBOARD */}
          <g transform="translate(145, 30)">
            {/* Main Window */}
            <rect x="0" y="0" width="80" height="80" rx="6" fill="#fff" stroke="#e5e7eb" strokeWidth="1" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.05))" />

            {/* Browser Header */}
            <rect x="0" y="0" width="80" height="12" rx="6" fill="#f3f4f6" />
            <circle cx="8" cy="6" r="2" fill="#d1d5db" />
            <circle cx="14" cy="6" r="2" fill="#d1d5db" />
            <circle cx="20" cy="6" r="2" fill="#d1d5db" />

            {/* Dashboard Content Container */}
            <rect x="6" y="18" width="68" height="16" rx="3" fill="#f9fafb" stroke="#f3f4f6" strokeWidth="1" />
            <text x="40" y="28" fontSize="6" fill="#9ca3af" textAnchor="middle">Prior tasks...</text>

            {/* New Task Syncing (Stages 3) */}
            <g opacity={stage >= 3 ? 1 : 0} style={{ transition: "opacity 0.5s ease-out" }}>
              <rect x="6" y="38" width="68" height="32" rx="4" fill="#9AE83E" fillOpacity="0.1" stroke="#9AE83E" strokeWidth="1.5" filter="url(#dashGlow)" />

              <rect x="12" y="44" width="12" height="12" rx="2" fill="#9AE83E" />
              <text x="18" y="52" fontSize="6" fill="#fff" fontWeight="bold" textAnchor="middle">LP</text>

              <rect x="28" y="45" width="30" height="3" rx="1.5" fill="#4b5563" />
              <rect x="28" y="51" width="20" height="2" rx="1" fill="#9ca3af" />

              <text x="12" y="65" fontSize="6" fill="#8BD835" fontWeight="bold">Ready</text>
            </g>

            {/* Waiting State (Stages 0,1,2) */}
            <g opacity={stage < 3 ? 1 : 0} style={{ transition: "opacity 0.2s ease-out" }}>
              <rect x="6" y="38" width="68" height="32" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2" />
              <text x="40" y="56" fontSize="6" fill="#9ca3af" textAnchor="middle">Waiting for ping...</text>
            </g>

            {/* Platform Label */}
            <text x="40" y="92" fontSize="8" fill="#9ca3af" fontWeight="bold" textAnchor="middle" letterSpacing="1">DASHBOARD</text>
          </g>

        </svg>
      </div>
    </SceneContainer>
  );
}


