"use client";

/**
 * Team Pages Scenes
 * Scenes for founders, marketing-teams, growth-teams, and slack pages
 * 
 * Key fix: Deterministic initial state for SSR
 */

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import {
  Rocket, Presentation, FileText, Download, Video, Paintbrush,
  Layout, Image, Mail, Megaphone, Check, Play, ArrowRight,
  MessageSquare, Users, Shield, Eye, Send, CheckCircle
} from "lucide-react";

// ============================================
// FOUNDERS PAGE SCENES
// ============================================
import { useState, useEffect } from "react";
import { stepTransition } from "@/lib/motion-variants";

export function FoundersLaunchPagesScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // 0 = Blueprint Drawing, 1 = Wireframe Build, 2 = Published & Glowing
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setStep(2); // Jump to complete if reduced motion
      return;
    }

    setStep(0);
    // Draw lines over 1.2s, transition to wireframe, then published
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 2400);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shouldAnimate, prefersReducedMotion]);

  const drawTransition = (d = 0) => ({ duration: 0.8, ease: "easeOut" as const, delay: d });

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={step === 2 ? "success" : "default"} animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={step === 2 ? 'done' : 'building'}
                initial={{ opacity: 0, filter: "blur(2px)", y: 2 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                exit={{ opacity: 0, filter: "blur(2px)", y: -2 }}
                transition={stepTransition}
                className="absolute text-center w-full left-0 right-0"
              >
                {step === 2 ? "Published" : (step === 1 ? "Wireframing" : "Blueprint")}
              </motion.span>
              {/* Invisible spacer to maintain width */}
              <span className="invisible break-words whitespace-nowrap">Wireframing</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center p-2">
        <svg viewBox="0 0 240 160" className="w-full h-full max-h-[140px] overflow-visible">
          <defs>
            <filter id="browser-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.06" />
            </filter>
          </defs>

          {/* Main Browser Window */}
          <motion.g
            animate={step === 2 ? { y: -4 } : { y: 0 }}
            transition={stepTransition}
          >
            <motion.rect
              x="40" y="20" width="160" height="120" rx="8"
              fill={step >= 1 ? "#ffffff" : "transparent"}
              stroke={step >= 1 ? "#e5e5e5" : "#1a1a1a"}
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={drawTransition()}
              filter={step === 2 ? "url(#browser-shadow)" : "none"}
            />

            {/* Browser Header Bar */}
            <motion.path
              d="M 40 40 L 200 40"
              stroke={step >= 1 ? "#e5e5e5" : "#1a1a1a"}
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={drawTransition(0.2)}
            />
            <motion.circle cx="48" cy="30" r="2.5" fill={step >= 1 ? "#e5e5e5" : "transparent"} stroke="#1a1a1a" strokeWidth="1" initial={{ strokeOpacity: 1 }} animate={{ strokeOpacity: step >= 1 ? 0 : 1 }} transition={stepTransition} />
            <motion.circle cx="56" cy="30" r="2.5" fill={step >= 1 ? "#e5e5e5" : "transparent"} stroke="#1a1a1a" strokeWidth="1" initial={{ strokeOpacity: 1 }} animate={{ strokeOpacity: step >= 1 ? 0 : 1 }} transition={stepTransition} />
            <motion.circle cx="64" cy="30" r="2.5" fill={step >= 1 ? "#e5e5e5" : "transparent"} stroke="#1a1a1a" strokeWidth="1" initial={{ strokeOpacity: 1 }} animate={{ strokeOpacity: step >= 1 ? 0 : 1 }} transition={stepTransition} />

            {/* Published Header Green Overlay */}
            <motion.rect
              x="41" y="21" width="158" height="18" rx="7"
              fill="#9AE83E"
              initial={{ opacity: 0 }}
              animate={{ opacity: step === 2 ? 1 : 0 }}
              transition={stepTransition}
            />

            {/* Inner UI: Headline */}
            <motion.rect x="52" y="54" width="60" height="7" rx="3.5"
              fill={step === 2 ? "#1a1a1a" : (step === 1 ? "#f5f5f5" : "transparent")}
              stroke="#1a1a1a" strokeWidth="1"
              initial={{ pathLength: 0, strokeOpacity: 1 }}
              animate={{ pathLength: 1, strokeOpacity: step === 0 ? 1 : 0 }}
              transition={drawTransition(0.3)}
            />
            {/* Inner UI: Subheadline */}
            <motion.rect x="52" y="66" width="40" height="6" rx="3"
              fill={step === 2 ? "#a3a3a3" : (step === 1 ? "#f5f5f5" : "transparent")}
              stroke="#1a1a1a" strokeWidth="1"
              initial={{ pathLength: 0, strokeOpacity: 1 }}
              animate={{ pathLength: 1, strokeOpacity: step === 0 ? 1 : 0 }}
              transition={drawTransition(0.4)}
            />

            {/* Inner UI: CTA Button */}
            <motion.rect x="52" y="78" width="32" height="10" rx="3"
              fill={step === 2 ? "#9AE83E" : (step === 1 ? "#e5e5e5" : "transparent")}
              stroke="#1a1a1a" strokeWidth="1"
              initial={{ pathLength: 0, strokeOpacity: 1 }}
              animate={{ pathLength: 1, strokeOpacity: step === 0 ? 1 : 0 }}
              transition={drawTransition(0.5)}
            />

            {/* Inner UI: Hero Image Placeholder */}
            <motion.rect x="136" y="54" width="44" height="44" rx="4"
              fill={step === 2 ? "#fcfcfc" : (step === 1 ? "#fafafa" : "transparent")}
              stroke={step >= 1 ? "#e5e5e5" : "#1a1a1a"} strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={drawTransition(0.6)}
            />

            {/* Published Image Graphic Accent */}
            <motion.path
              d="M 148 86 L 158 76 L 168 86"
              fill="none"
              stroke="#a3a3a3"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: step === 2 ? 1 : 0, y: step === 2 ? 0 : 4 }}
              transition={stepTransition}
            />
            <motion.circle
              cx="150" cy="66" r="3"
              fill="#a3a3a3"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: step === 2 ? 1 : 0, scale: step === 2 ? 1 : 0 }}
              transition={{ delay: 0.1, ...stepTransition }}
            />

            {/* Bottom UI Grids */}
            <motion.rect x="52" y="110" width="128" height="24" rx="4"
              fill={step >= 1 ? "#fafafa" : "transparent"}
              stroke={step >= 1 ? "none" : "#1a1a1a"} strokeWidth="1"
              initial={{ pathLength: 0, strokeOpacity: 1 }}
              animate={{ pathLength: 1, strokeOpacity: step === 0 ? 1 : 0 }}
              transition={drawTransition(0.7)}
            />
            <motion.rect x="58" y="116" width="30" height="12" rx="2"
              fill={step === 2 ? "#f0f0f0" : "transparent"}
              initial={{ opacity: 0 }}
              animate={{ opacity: step === 2 ? 1 : 0 }}
              transition={drawTransition(0.8)}
            />
            <motion.rect x="101" y="116" width="30" height="12" rx="2"
              fill={step === 2 ? "#f0f0f0" : "transparent"}
              initial={{ opacity: 0 }}
              animate={{ opacity: step === 2 ? 1 : 0 }}
              transition={drawTransition(0.9)}
            />
          </motion.g>
        </svg>
      </div>
    </SceneContainer>
  );
}

export function FoundersInvestorDeckScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Single pass progression
  const [polishedSlides, setPolishedSlides] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setPolishedSlides(10);
      return;
    }

    setPolishedSlides(0);
    const interval = setInterval(() => {
      setPolishedSlides(p => {
        if (p >= 10) { clearInterval(interval); return 10; }
        return p + 1;
      });
    }, 400); // Gradual build up

    return () => clearInterval(interval);
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={polishedSlides === 10 ? "success" : "default"} animate={false}>
            <Presentation className="w-3 h-3" />
            <div className="w-10 text-center">
              {polishedSlides}/10
            </div>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1 flex-wrap justify-center max-w-[120px]">
          <AnimatePresence>
            {Array.from({ length: 10 }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  "w-5 h-7 rounded-sm transition-colors duration-1000 shadow-sm",
                  i < polishedSlides ? "bg-[#1a1a1a]" : "bg-gray-100"
                )}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { delay: i * 0.05, ...stepTransition }
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </SceneContainer>
  );
}

export function FoundersSalesCollateralScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={"default"} animate={false}>
            <FileText className="w-3 h-3" />
            Generating
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-3">
        <div className="w-16 h-20 rounded-lg bg-white border border-gray-200 flex flex-col items-center justify-center gap-1 shadow-sm">
          <FileText className="w-5 h-5 text-gray-400" />
          <span className="text-[7px] text-gray-500">pitch_deck.pdf</span>
        </div>

        {/* Continuous progress bar replacing jittery steps */}
        <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#9AE83E]"
            initial={{ width: "0%" }}
            animate={shouldAnimate && !prefersReducedMotion ? { width: "100%" } : { width: "100%" }}
            transition={{ duration: 4, ease: "circOut" }}
          />
        </div>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={shouldAnimate && !prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ delay: 3.8, ...stepTransition }}
        >
          <Download className="w-4 h-4 text-[#8BD835]" />
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export function FoundersLaunchPostsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            4 scheduled
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center bg-[#1a1a1a] shadow-sm",
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={shouldAnimate && !prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.2, ...stepTransition }}
            >
              <Check className="w-4 h-4 text-[#9AE83E]" strokeWidth={3} />
            </motion.div>
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

export function FoundersMotionCutdownsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={"default"} animate={false}>
            <Video className="w-3 h-3" />
            Exporting
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <div className="w-32 h-3 bg-gray-100 border border-gray-200 rounded-full overflow-hidden p-0.5 shadow-inner">
          {/* Calm, continuous fill replacing jumpy numbers */}
          <motion.div
            className="h-full bg-[#1a1a1a] rounded-full"
            initial={{ width: "5%" }}
            animate={shouldAnimate && !prefersReducedMotion ? { width: "100%" } : { width: "100%" }}
            transition={{ duration: 5, ease: "circOut" }}
          />
        </div>
        <span className="text-[9px] font-medium tracking-widest uppercase text-gray-500">Cutdowns</span>
      </div>
    </SceneContainer>
  );
}

export function FoundersWebsiteRefreshScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);
  const showAfter = useCycleState([false, true], 3000, shouldAnimate && !prefersReducedMotion);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={showAfter ? "success" : "default"} animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={showAfter ? 'after' : 'before'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="absolute"
              >
                {showAfter ? "After" : "Before"}
              </motion.span>
              <span className="invisible px-1">Before</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-3">
        <motion.div
          className={cn(
            "w-16 h-20 rounded-lg border shadow-sm overflow-hidden transition-all duration-1000",
            !showAfter ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-50 opacity-50"
          )}
        >
          <div className="h-6 bg-gray-100" />
          <div className="p-1.5 space-y-1">
            <div className="h-0.5 bg-gray-300 rounded" />
            <div className="h-0.5 bg-gray-300 rounded w-3/4" />
          </div>
        </motion.div>

        <ArrowRight className="w-3 h-3 text-gray-400" />

        <motion.div
          className={cn(
            "w-16 h-20 rounded-lg border shadow-sm overflow-hidden transition-all duration-1000",
            showAfter ? "border-[#9AE83E] bg-white ring-2 ring-[#9AE83E]/20" : "border-gray-200 bg-gray-50 opacity-50"
          )}
        >
          <div className="h-6 bg-[#9AE83E]/20 relative">
            <motion.div
              className="absolute inset-x-0 bottom-0 h-0.5 bg-[#9AE83E]"
              initial={{ opacity: 0 }}
              animate={{ opacity: showAfter ? 1 : 0 }}
              transition={{ duration: 1 }}
            />
          </div>
          <div className="p-1.5 space-y-1">
            <div className="h-1 bg-[#1a1a1a] rounded w-1/2" />
            <div className="h-0.5 bg-gray-200 rounded w-3/4" />
            <div className="h-0.5 bg-gray-200 rounded w-full" />
          </div>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

// ============================================
// MARKETING TEAMS PAGE SCENES
// ============================================

export function MarketingLandingPagesScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);
  const showAfter = useCycleState([false, true], 3000, shouldAnimate && !prefersReducedMotion);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={showAfter ? "success" : "default"} animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={showAfter ? 'after' : 'before'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="absolute"
              >
                {showAfter ? "After" : "Before"}
              </motion.span>
              <span className="invisible px-1">Before</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={showAfter ? "after" : "before"}
            className={cn(
              "w-24 h-28 rounded-lg border overflow-hidden shadow-sm",
              showAfter ? "border-[#8BD835] bg-white ring-2 ring-[#9AE83E]/20" : "border-gray-300 bg-gray-50"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <div className={cn(
              "h-8 flex items-center justify-center relative",
              showAfter ? "bg-[#9AE83E]/20" : "bg-gray-200"
            )}>
              {showAfter && (
                <motion.div
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[#9AE83E]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                />
              )}
              <div className={cn(
                "w-12 h-2 rounded-sm",
                showAfter ? "bg-[#1a1a1a]" : "bg-gray-400"
              )} />
            </div>
            <div className="p-3 space-y-2 relative z-10 bg-white h-full">
              <div className={cn("h-1.5 rounded-sm", showAfter ? "bg-[#1a1a1a]" : "bg-gray-300")} />
              <div className="h-1.5 bg-gray-200 rounded-sm w-3/4" />
              {showAfter && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="h-1.5 bg-gray-200 rounded-sm w-1/2 mt-2"
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </SceneContainer>
  );
}

export function MarketingCampaignKitScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  const items = [
    { label: "LP", icon: Layout },
    { label: "Ads", icon: Megaphone },
    { label: "Email", icon: Mail },
    { label: "Social", icon: Image },
  ];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            Campaign kit
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="grid grid-cols-2 gap-2">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                className={cn(
                  "w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-1 bg-white border border-gray-100 shadow-sm",
                )}
                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                animate={shouldAnimate && !prefersReducedMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.15, ...stepTransition }}
              >
                <Icon className={cn(
                  "w-4 h-4",
                  "text-[#1a1a1a]"
                )} />
                <span className={cn(
                  "text-[7px] font-medium uppercase tracking-wider",
                  "text-gray-500"
                )}>
                  {item.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}

export function MarketingMotionVideoScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={"default"} animate={false}>
            <Video className="w-3 h-3" />
            Rendering
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <div className="w-24 h-14 bg-[#1a1a1a] rounded-lg flex items-center justify-center shadow-lg relative overflow-hidden group">
          <motion.div
            className="absolute inset-0 bg-[#9AE83E]/5"
            animate={shouldAnimate && !prefersReducedMotion ? { opacity: [0, 1, 0] } : {}}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <Play className="w-5 h-5 text-white z-10" />
        </div>

        {/* Continuous progress sweep */}
        <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-[#9AE83E]"
            initial={{ width: "10%" }}
            animate={shouldAnimate && !prefersReducedMotion ? { width: "100%" } : { width: "100%" }}
            transition={{ duration: 6, ease: "circOut" }}
          />
        </div>
        <span className="text-[8px] tracking-widest uppercase font-medium text-gray-400">Exporting</span>
      </div>
    </SceneContainer>
  );
}

export function MarketingLifecycleEmailScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={"default"} animate={false}>
            <Mail className="w-3 h-3" />
            4 blocks
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="w-24 bg-white border border-gray-200 shadow-sm rounded-lg p-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "h-4 rounded-sm mb-1.5 last:mb-0 bg-[#1a1a1a]",
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={shouldAnimate && !prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
              transition={{ delay: i * 0.2, ...stepTransition }}
            />
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

export function MarketingAdVariantsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            6 variants
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-8 h-8 rounded-md bg-white border border-gray-200 shadow-sm",
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={shouldAnimate && !prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, ...stepTransition }}
            />
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

// ============================================
// SLACK PAGE SCENES
// ============================================

export function SlackFounderApprovalsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Slower, calmer cycle moving linearly through states, lingering on Done
  const step = useCycleState<"ping" | "open" | "approve">(
    ["ping", "open", "approve", "approve", "approve"],
    1800,
    shouldAnimate && !prefersReducedMotion
  );

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={step === "approve" ? "success" : "default"} animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={step}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="absolute"
              >
                {step === "approve" ? "Approved" : "Slack"}
              </motion.span>
              <span className="invisible px-1">Approved</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-3">
        <motion.div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center shadow-sm transition-colors duration-700",
            step === "ping" ? "bg-[#4A154B] ring-2 ring-[#4A154B]/20 ring-offset-2" : "bg-white border border-gray-200"
          )}
        >
          <MessageSquare className={cn(
            "w-5 h-5 transition-colors duration-700",
            step === "ping" ? "text-white" : "text-gray-400"
          )} />
        </motion.div>

        {/* Progress Arrow */}
        <div className="relative w-6 h-[1px] bg-gray-200 overflow-hidden shrink-0 mx-1">
          {shouldAnimate && !prefersReducedMotion && step === "open" && (
            <motion.div
              className="absolute inset-y-0 left-0 w-full bg-[#1a1a1a]"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          )}
        </div>

        <motion.div
          className={cn(
            "w-20 h-12 rounded-lg flex items-center justify-center shadow-sm transition-colors duration-700 border",
            step === "approve" ? "bg-[#1a1a1a] border-[#1a1a1a]" : "bg-white border-gray-200"
          )}
        >
          <AnimatePresence mode="popLayout">
            {step === "approve" ? (
              <motion.div
                key="check"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={stepTransition}
              >
                <Check className="w-5 h-5 text-[#9AE83E]" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="layout"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={stepTransition}
              >
                <Layout className={cn(
                  "w-5 h-5",
                  step === "open" ? "text-[#1a1a1a]" : "text-gray-300"
                )} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export function SlackMarketingFlowScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  const roles = [
    { label: "Submit", icon: Send, color: "text-blue-600", dot: "bg-blue-600" },
    { label: "Review", icon: CheckCircle, color: "text-purple-600", dot: "bg-purple-600" },
    { label: "View", icon: Eye, color: "text-gray-600", dot: "bg-gray-600" },
  ];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            <Users className="w-3 h-3" />
            Roles
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-2">
        {roles.map((role, i) => {
          const Icon = role.icon;
          return (
            <motion.div
              key={role.label}
              className={cn(
                "w-16 h-20 rounded-lg flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 shadow-sm relative overflow-hidden",
              )}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={shouldAnimate && !prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.2, ...stepTransition }}
            >
              <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-gray-100">
                <motion.div
                  className={`w-full h-full rounded-full ${role.dot}`}
                  initial={{ scale: 0 }}
                  animate={shouldAnimate ? { scale: 1 } : { scale: 1 }}
                  transition={{ delay: 0.5 + (i * 0.2), ...stepTransition }}
                />
              </div>
              <Icon className={cn(
                "w-5 h-5",
                role.color
              )} />
              <span className={cn(
                "text-[9px] font-semibold uppercase tracking-wider",
                "text-gray-800"
              )}>
                {role.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </SceneContainer>
  );
}

export function SlackEnterpriseHygieneScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  const items = [
    { label: "Private mode", icon: Shield },
    { label: "Role access", icon: Users },
    { label: "Audit logs", icon: FileText },
  ];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={false}>
            <Shield className="w-3 h-3" />
            Secure
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col gap-1.5 w-full max-w-[140px]">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm w-full",
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={shouldAnimate && !prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15, ...stepTransition }}
              >
                <div className="w-5 h-5 rounded-md bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                  <Icon className={cn("w-3 h-3 text-[#1a1a1a]")} />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold text-gray-700 uppercase tracking-widest mt-0.5",
                )}>
                  {item.label}
                </span>

                <Check className="w-3 h-3 text-[#9AE83E] ml-auto" strokeWidth={3} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}

export function SlackNoSlackTeamsScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            Platform native
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-4">
        <motion.div
          className="relative flex items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={stepTransition}
        >
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300",
            )}
          >
            <MessageSquare className={cn(
              "w-6 h-6 text-gray-300"
            )} />

            <div className="absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full border border-gray-200 flex items-center justify-center shadow-sm">
              <div className="w-3 h-0.5 bg-red-400 rotate-45 absolute" />
              <div className="w-3 h-0.5 bg-red-400 -rotate-45 absolute" />
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-gray-300" />

          <div
            className={cn(
              "w-20 h-14 rounded-xl flex items-center justify-center bg-[#1a1a1a] shadow-lg relative overflow-hidden",
            )}
          >
            <motion.div
              className="absolute inset-0 bg-[#9AE83E]/5"
              animate={shouldAnimate && !prefersReducedMotion ? { opacity: [0, 1, 0] } : {}}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <Layout className={cn(
              "w-6 h-6 text-[#9AE83E] relative z-10"
            )} />
          </div>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

