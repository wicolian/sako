"use client";

/**
 * ROI Calculator and Growth Teams Scenes
 * 
 * Key fix: Deterministic initial state for SSR
 */

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import {
  Clock, TrendingUp, DollarSign, Shield,
  Layout, Megaphone, Mail, Video, FileText, Check,
  BarChart3, Layers
} from "lucide-react";

// ============================================
// ROI CALCULATOR SCENES
// ============================================

export function RoiTimeSavedScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const hours = useCycleState([4, 6, 8, 10, 12], 1000, shouldAnimate);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={shouldAnimate}>
            <Clock className="w-3 h-3" />
            Time saved
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <motion.div
          className="text-3xl font-bold text-[#1a1a1a]"
          key={hours}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {hours}
        </motion.div>
        <span className="text-[10px] text-gray-500">hrs saved / week</span>
      </div>
    </SceneContainer>
  );
}

export function RoiThroughputScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const multiplier = useCycleState([1.5, 2, 2.5, 3], 1200, shouldAnimate);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={shouldAnimate}>
            <TrendingUp className="w-3 h-3" />
            Velocity
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <motion.div
          className="text-3xl font-bold text-[#9AE83E]"
          key={multiplier}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {multiplier}x
        </motion.div>
        <span className="text-[10px] text-gray-500">more shipped</span>
      </div>
    </SceneContainer>
  );
}

export function RoiCostDeltaScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);
  const savings = useCycleState([30, 45, 60], 1500, shouldAnimate && !prefersReducedMotion);

  // Layout parameters for SVG
  const vbWidth = 240;
  const vbHeight = 160;

  // Bar 1 (Before)
  const b1x = 60;
  const bH = 100;
  const bY = vbHeight - 30 - bH; // 160 - 30 - 100 = 30

  // Bar 2 (Sako)
  const b2x = 140;

  // Calculate relative height from savings percentage
  const sakoH = bH * ((100 - savings) / 100);
  const sakoY = vbHeight - 30 - sakoH;

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={shouldAnimate}>
            <DollarSign className="w-3 h-3" />
            Savings
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="w-full h-full flex items-center justify-center p-2">
        <svg viewBox={`0 0 ${vbWidth} ${vbHeight}`} className="w-full h-full max-h-[140px] overflow-visible">
          <defs>
            <linearGradient id="bar-before" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e5e5e5" />
              <stop offset="100%" stopColor="#f5f5f5" />
            </linearGradient>
            <linearGradient id="bar-sako" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8BD835" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>
            <filter id="glow-sako" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Pattern for the grid to make it look data-viz native */}
            <pattern id="chart-grid" width="240" height="20" patternUnits="userSpaceOnUse">
              <line x1="0" y1="20" x2="240" y2="20" stroke="#f0f0f0" strokeWidth="1" strokeDasharray="2 4" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect x="0" y="10" width="240" height="120" fill="url(#chart-grid)" />

          {/* Connective Line highlighting the drop */}
          <motion.line
            x1={b1x + 40}
            y1={bY}
            x2={b2x}
            stroke="#1a1a1a"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            initial={{ y2: bY }}
            animate={{
              y2: shouldAnimate && !prefersReducedMotion ? sakoY : sakoY
            }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          {/* Before Bar */}
          <rect
            x={b1x}
            y={bY}
            width="40"
            height={bH}
            rx="4"
            fill="url(#bar-before)"
            stroke="#d4d4d8"
            strokeWidth="1.5"
          />
          <text
            x={b1x + 20}
            y={vbHeight - 12}
            textAnchor="middle"
            fontSize="10"
            fill="#a3a3a3"
            fontWeight="600"
            className="font-sans uppercase tracking-widest"
          >
            Before
          </text>
          {/* Label for Before cost basis */}
          <text x={b1x + 20} y={bY - 8} textAnchor="middle" fontSize="11" fill="#1a1a1a" fontWeight="700" className="font-mono">
            $100k
          </text>

          {/* Sako Bar - Animated */}
          <motion.rect
            x={b2x}
            width="40"
            rx="4"
            fill="url(#bar-sako)"
            stroke="#65a30d"
            strokeWidth="1.5"
            filter="url(#glow-sako)"
            initial={{ y: bY, height: bH }}
            animate={{
              y: shouldAnimate && !prefersReducedMotion ? sakoY : sakoY,
              height: shouldAnimate && !prefersReducedMotion ? sakoH : sakoH
            }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
          <text
            x={b2x + 20}
            y={vbHeight - 12}
            textAnchor="middle"
            fontSize="10"
            fill="#1a1a1a"
            fontWeight="700"
            className="font-sans uppercase tracking-widest"
          >
            Sako
          </text>

          {/* Sako Cost Dynamic Value */}
          <motion.text
            x={b2x + 20}
            animate={{ y: shouldAnimate && !prefersReducedMotion ? sakoY - 24 : sakoY - 24 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            textAnchor="middle"
            fontSize="11"
            fill="#1a1a1a"
            fontWeight="700"
            className="font-mono"
          >
            ${100 - savings}k
          </motion.text>

          {/* Floating Savings Badge */}
          <motion.g
            initial={{ y: bY }}
            animate={{ y: shouldAnimate && !prefersReducedMotion ? sakoY - 7 : sakoY - 7 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            <rect x={b2x - 12} y="0" width="64" height="16" rx="8" fill="#1a1a1a" />
            <text x={b2x + 20} y="11" textAnchor="middle" fontSize="9" fill="#9AE83E" fontWeight="bold" className="font-mono">
              -{savings}%
            </text>
          </motion.g>

        </svg>
      </div>
    </SceneContainer>
  );
}

export function RoiRiskRemovedScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const activeIndex = useCycleState([0, 1, 2], 1500, shouldAnimate);

  const risks = [
    { label: "No hiring lag", icon: Clock },
    { label: "No change orders", icon: FileText },
    { label: "SLA-backed", icon: Shield },
  ];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={shouldAnimate}>
            <Shield className="w-3 h-3" />
            Risk free
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center gap-1.5 px-3">
        {risks.map((risk, i) => {
          const Icon = risk.icon;
          return (
            <motion.div
              key={risk.label}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg",
                i <= activeIndex ? "bg-[#9AE83E]/20" : "bg-gray-100"
              )}
              animate={i === activeIndex ? { x: 4 } : { x: 0 }}
            >
              <Icon className={cn(
                "w-3 h-3",
                i <= activeIndex ? "text-[#9AE83E]" : "text-gray-400"
              )} />
              <span className={cn(
                "text-[9px] font-medium",
                i <= activeIndex ? "text-[#1a1a1a]" : "text-gray-500"
              )}>
                {risk.label}
              </span>
              {i <= activeIndex && (
                <Check className="w-3 h-3 text-[#9AE83E] ml-auto" />
              )}
            </motion.div>
          );
        })}
      </div>
    </SceneContainer>
  );
}

// ============================================
// GROWTH TEAMS SCENES
// ============================================

export function GrowthLPVariantsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const activeVariant = useCycleState<"A" | "B">(["A", "B"], 2000, shouldAnimate);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={shouldAnimate}>
            Variant {activeVariant}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-2">
        <motion.div
          className={cn(
            "w-14 h-18 rounded-lg border-2 p-1",
            activeVariant === "A" ? "border-[#9AE83E] bg-[#9AE83E]/10" : "border-gray-200"
          )}
          animate={{ scale: activeVariant === "A" ? 1.05 : 0.95 }}
        >
          <div className="text-[8px] font-bold text-center">A</div>
          <div className="h-2 bg-blue-400 rounded mt-1" />
        </motion.div>
        <motion.div
          className={cn(
            "w-14 h-18 rounded-lg border-2 p-1",
            activeVariant === "B" ? "border-[#9AE83E] bg-[#9AE83E]/10" : "border-gray-200"
          )}
          animate={{ scale: activeVariant === "B" ? 1.05 : 0.95 }}
        >
          <div className="text-[8px] font-bold text-center">B</div>
          <div className="h-2 bg-purple-400 rounded mt-1" />
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export function GrowthAdSuitesScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const activeFormat = useCycleState([0, 1, 2, 3], 1000, shouldAnimate);

  const formats = ["1:1", "4:5", "16:9", "9:16"];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={shouldAnimate}>
            <Megaphone className="w-3 h-3" />
            Multi-format
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1">
          {formats.map((format, i) => (
            <motion.div
              key={format}
              className={cn(
                "w-8 h-10 rounded-md flex items-center justify-center",
                i === activeFormat ? "bg-[#9AE83E]" : "bg-gray-100"
              )}
              animate={i === activeFormat ? { scale: 1.15 } : { scale: 1 }}
            >
              <span className={cn(
                "text-[6px] font-mono",
                i === activeFormat ? "text-[#1a1a1a]" : "text-gray-400"
              )}>
                {format}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

export function GrowthExperimentKitScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const checked = useCycleState([1, 2, 3], 1200, shouldAnimate);

  const items = [
    { label: "LP", icon: Layout },
    { label: "Ads", icon: Megaphone },
    { label: "Email", icon: Mail },
  ];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={checked === 3 ? "success" : "default"} animate={shouldAnimate}>
            {checked}/3 ready
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-2">
        {items.map((item, i) => {
          const Icon = item.icon;
          const isDone = i < checked;
          return (
            <motion.div
              key={item.label}
              className={cn(
                "w-10 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5",
                isDone ? "bg-[#9AE83E]" : "bg-gray-100"
              )}
              animate={i === checked - 1 ? { scale: [1, 1.1, 1] } : {}}
            >
              <Icon className={cn(
                "w-4 h-4",
                isDone ? "text-[#1a1a1a]" : "text-gray-400"
              )} />
              {isDone && <Check className="w-3 h-3 text-[#1a1a1a]" />}
            </motion.div>
          );
        })}
      </div>
    </SceneContainer>
  );
}

export function GrowthMotionCutdownsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const progress = useCycleState([20, 40, 60, 80, 100], 800, shouldAnimate);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={progress === 100 ? "success" : "default"} animate={shouldAnimate}>
            <Video className="w-3 h-3" />
            {progress}%
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <div className="w-28 h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#9AE83E]"
            animate={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[8px] text-gray-500">Rendering cutdowns</span>
      </div>
    </SceneContainer>
  );
}

export function GrowthSalesEnablementScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const insertedSlides = useCycleState([0, 1, 2, 3], 1200, shouldAnimate);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={insertedSlides === 3 ? "success" : "default"} animate={shouldAnimate}>
            <Layers className="w-3 h-3" />
            +{insertedSlides} slides
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-5 h-7 rounded-sm",
                i >= 3 && i < 3 + insertedSlides
                  ? "bg-[#9AE83E]"
                  : "bg-[#1a1a1a]"
              )}
              animate={i === 2 + insertedSlides ? { scale: [1, 1.1, 1] } : {}}
            />
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

export function GrowthLifecycleAssetsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(containerRef);
  const modules = useCycleState([2, 4, 5, 6], 1000, shouldAnimate);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={shouldAnimate}>
            <BarChart3 className="w-3 h-3" />
            {modules} modules
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center",
                i < modules ? "bg-[#1a1a1a]" : "bg-gray-100"
              )}
              animate={i === modules - 1 ? { scale: [1, 1.1, 1] } : {}}
            >
              {i < modules && <Check className="w-3 h-3 text-[#9AE83E]" />}
            </motion.div>
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

