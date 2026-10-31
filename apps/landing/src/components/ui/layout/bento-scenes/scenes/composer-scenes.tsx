"use client";

/**
 * Composer Page Scenes
 * All scenes for the Composer page - recipes and export options
 * 
 * Key fix: Deterministic initial state for SSR
 */

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import {
  Rocket, Sparkles, DollarSign, Code, Image, Layout,
  Globe, Check, Copy, Download, ArrowRight
} from "lucide-react";

// ============================================
// RECIPE SCENES
// ============================================

// ============================================
// RECIPE SCENES
// ============================================
import { useState, useEffect } from "react";
import { stepTransition } from "@/lib/motion-variants";

export function ComposerLaunchPageScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Single pass progression building the launch page
  const [phase, setPhase] = useState<"blank" | "building" | "done">("blank");

  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setPhase("done");
      return;
    }
    setPhase("blank");
    const t1 = setTimeout(() => setPhase("building"), 600);
    const t2 = setTimeout(() => setPhase("done"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={phase === "done" ? "success" : "default"} animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={phase}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(2px)" }}
                transition={stepTransition}
                className="absolute"
              >
                {phase === "done" ? "Generated" : "Launch page"}
              </motion.span>
              <span className="invisible px-1">Launch page</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-3">
        <AnimatePresence mode="popLayout">
          {phase === "blank" && (
            <motion.div
              key="blank"
              className="w-20 h-28 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center shrink-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={stepTransition}
            >
              <div className="w-8 h-1 bg-gray-200 rounded-sm" />
            </motion.div>
          )}
          {phase === "building" && (
            <motion.div
              key="building"
              className="w-20 h-28 rounded-lg bg-[#1a1a1a] flex flex-col items-center justify-center gap-2 shadow-sm shrink-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={stepTransition}
            >
              <Sparkles className="w-4 h-4 text-[#9AE83E]" />
              <div className="w-10 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gray-500"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.8, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
          {phase === "done" && (
            <motion.div
              key="done"
              className="w-24 h-32 rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm shrink-0"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1, ...stepTransition }}
            >
              <div className="h-8 bg-[#9AE83E]/20 flex items-center justify-center transition-colors duration-1000">
                <div className="w-10 h-2 bg-[#1a1a1a] rounded-sm" />
              </div>
              <div className="p-2 space-y-1.5 bg-white">
                <div className="h-1 bg-gray-200 rounded-sm w-full" />
                <div className="h-1 bg-gray-200 rounded-sm w-3/4" />
                <div className="h-4 bg-[#9AE83E] rounded-md w-1/2 mt-3" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SceneContainer>
  );
}

export function ComposerFeatureShipScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Calm single step
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setStep(2);
      return;
    }
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shouldAnimate, prefersReducedMotion]);

  const features = ["Drafting...", "Reviewing...", "Shipped"];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={step === 2 ? "success" : "default"} animate={false}>
            Feature ship
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center items-center gap-2">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={step}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-medium border shadow-sm flex items-center gap-2",
              step === 2 ? "bg-[#9AE83E] text-[#1a1a1a] border-[#8BD835]" : "bg-white text-gray-500 border-gray-200"
            )}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={stepTransition}
          >
            {features[step]}
            {step === 2 ? <Check className="w-3 h-3 text-[#1a1a1a]" strokeWidth={3} /> : <div className="w-2 h-2 rounded-full border border-gray-300" />}
          </motion.div>
        </AnimatePresence>
      </div>
    </SceneContainer>
  );
}

export function ComposerPLGPricingScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            Pricing tiers
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-3">
        {/* Tier 1 */}
        <motion.div
          className="w-14 h-20 rounded-lg flex flex-col items-center justify-center gap-2 border border-gray-200 bg-white shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...stepTransition }}
        >
          <span className="text-[9px] font-semibold text-gray-500 uppercase">Free</span>
          <div className="w-6 h-0.5 bg-gray-200 rounded-sm" />
        </motion.div>

        {/* Tier 2 (Highlighted) */}
        <motion.div
          className="w-16 h-24 rounded-lg flex flex-col items-center justify-center gap-2 border border-[#1a1a1a] bg-[#1a1a1a] shadow-md relative overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...stepTransition }}
        >
          {shouldAnimate && !prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 bg-white/5"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <span className="text-[10px] font-bold text-white uppercase relative z-10">Pro</span>
          <div className="w-8 h-0.5 bg-gray-600 rounded-sm relative z-10" />
          <div className="w-6 h-0.5 bg-[#9AE83E] rounded-sm relative z-10 mt-1" />
        </motion.div>

        {/* Tier 3 */}
        <motion.div
          className="w-14 h-20 rounded-lg flex flex-col items-center justify-center gap-2 border border-gray-200 bg-white shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ...stepTransition }}
        >
          <span className="text-[9px] font-semibold text-gray-800 uppercase">Team</span>
          <div className="w-6 h-0.5 bg-gray-200 rounded-sm" />
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export function ComposerFundraiseDeckScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Single pass slide generation
  const [slides, setSlides] = useState(0);
  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setSlides(10); return;
    }
    setSlides(0);
    const int = setInterval(() => {
      setSlides(p => {
        if (p >= 10) { clearInterval(int); return 10; }
        return p + 1;
      });
    }, 300);
    return () => clearInterval(int);
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={slides === 10 ? "success" : "default"} animate={false}>
            {slides}/10 slides
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1 flex-wrap justify-center max-w-[140px]">
          <AnimatePresence>
            {Array.from({ length: 10 }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  "w-6 h-8 rounded border transition-colors duration-1000",
                  i < slides ? "bg-[#1a1a1a] border-[#1a1a1a] shadow-sm" : "bg-gray-50 border-gray-200 border-dashed"
                )}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: 1,
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

export function ComposerAdBundleScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  const adSizes = ["1:1", "4:5", "16:9", "9:16", "1:1", "4:5"];

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={false}>
            <Check className="w-3 h-3" />
            6 sizes
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="grid grid-cols-3 gap-2">
          {adSizes.map((size, i) => (
            <motion.div
              key={`ad-${i}`}
              className={cn(
                "w-10 h-10 rounded-md flex items-center justify-center bg-white border border-gray-200 shadow-sm transition-colors duration-1000",
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * i, ...stepTransition }}
            >
              <span className={cn(
                "text-[8px] font-mono text-gray-500 font-medium"
              )}>
                {size}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

export function ComposerExperimentPageScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Slow crossfade variant A to B
  const showB = useCycleState([false, true], 4000, shouldAnimate && !prefersReducedMotion);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={showB ? "b" : "a"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="absolute"
              >
                Variant {showB ? "B" : "A"}
              </motion.span>
              <span className="invisible px-1">Variant B</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-4">
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={stepTransition}
        >
          <div className={cn(
            "w-20 h-28 rounded-lg border-2 shadow-sm transition-colors duration-1000 bg-white",
            !showB ? "border-[#9AE83E] ring-2 ring-[#9AE83E]/20" : "border-gray-200 opacity-50"
          )}>
            <div className="p-2 space-y-1.5">
              <div className={cn("text-[9px] font-bold text-center mb-2 transition-colors duration-1000", !showB ? "text-[#1a1a1a]" : "text-gray-400")}>A</div>
              <div className={cn("h-1.5 rounded-sm w-full transition-colors duration-1000", !showB ? "bg-blue-500" : "bg-gray-200")} />
              <div className="h-1 bg-gray-200 rounded-sm w-3/4" />
              <div className="h-1 bg-gray-200 rounded-sm w-1/2" />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...stepTransition }}
        >
          <div className={cn(
            "w-20 h-28 rounded-lg border-2 shadow-sm transition-colors duration-1000 bg-white",
            showB ? "border-[#9AE83E] ring-2 ring-[#9AE83E]/20" : "border-gray-200 opacity-50"
          )}>
            <div className="p-2 space-y-1.5">
              <div className={cn("text-[9px] font-bold text-center mb-2 transition-colors duration-1000", showB ? "text-[#1a1a1a]" : "text-gray-400")}>B</div>
              <div className={cn("h-1.5 rounded-sm w-full transition-colors duration-1000", showB ? "bg-purple-500" : "bg-gray-200")} />
              <div className="h-4 bg-gray-100 border border-gray-200 rounded-sm w-full outline outline-1 outline-offset-1 outline-transparent flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

// ============================================
// EXPORT SCENES
// ============================================

export function ComposerHTMLExportScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setCopied(true); return;
    }
    setCopied(false);
    const t = setTimeout(() => setCopied(true), 2500);
    return () => clearTimeout(t);
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={copied ? "success" : "default"} animate={false}>
            {copied ? <Check className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            {copied ? "Copied code" : "HTML / React"}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-4">
        <motion.div
          className="w-40 h-24 rounded-lg bg-[#1a1a1a] p-3 font-mono text-[9px] text-gray-400 overflow-hidden shadow-lg border border-gray-800"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={stepTransition}
        >
          <div className="text-blue-400 tracking-wider">&lt;div</div>
          <div className="pl-3 text-purple-400 mt-1 tracking-wider">className=<span className="text-emerald-400">"hero-section"</span>&gt;</div>
          <div className="pl-6 text-gray-500 mt-1 tracking-widest">...</div>
          <div className="text-blue-400 mt-1 tracking-wider">&lt;/div&gt;</div>

          {/* Scanline effect */}
          {shouldAnimate && !prefersReducedMotion && (
            <motion.div
              className="absolute inset-x-0 h-4 bg-blue-500/10 mix-blend-screen pointer-events-none blur-sm"
              initial={{ top: "-10%" }}
              animate={{ top: "110%" }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          )}
        </motion.div>

        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, ...stepTransition }}
        >
          <AnimatePresence mode="popLayout">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-10 h-10 rounded-full bg-[#9AE83E]/20 flex items-center justify-center"
              >
                <Check className="w-5 h-5 text-[#9AE83E]" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
              >
                <Copy className="w-4 h-4 text-gray-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export function ComposerImageExportScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success" animate={false}>
            <Check className="w-3 h-3" />
            Assets ready
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-6">
        <motion.div
          className="w-20 h-20 rounded-xl bg-white border border-gray-200 p-2 shadow-sm flex items-center justify-center relative overflow-hidden group"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={stepTransition}
        >
          <div className="absolute inset-0 bg-[url('/img/grid.svg')] opacity-5" />
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9AE83E] to-emerald-400 flex items-center justify-center shadow-inner">
            <Image className="w-5 h-5 text-white/90" />
          </div>
        </motion.div>

        <div className="flex flex-col gap-2">
          {[".PNG", ".WEBP", ".SVG"].map((ext, i) => (
            <motion.div
              key={ext}
              className="px-3 py-1.5 bg-[#1a1a1a] text-white text-[10px] font-mono tracking-widest rounded-md"
              initial={{ opacity: 0, x: -10 }}
              animate={shouldAnimate ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i, ...stepTransition }}
            >
              {ext}
            </motion.div>
          ))}
        </div>
      </div>
    </SceneContainer>
  );
}

export function ComposerCopyToFigmaScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  const [pasted, setPasted] = useState(false);
  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setPasted(true); return;
    }
    setPasted(false);
    const t = setTimeout(() => setPasted(true), 2500);
    return () => clearTimeout(t);
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={pasted ? "success" : "default"} animate={false}>
            <Layout className="w-3 h-3" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={pasted ? 'done' : 'sync'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="absolute"
              >
                {pasted ? "Synced" : "Syncing..."}
              </motion.span>
              <span className="invisible px-1">Syncing...</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex h-full items-center justify-center gap-4 pr-6">

        <motion.div
          className="w-20 h-24 rounded-lg bg-white border border-gray-200 p-1.5 shadow-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={stepTransition}
        >
          <div className="h-full bg-gray-50 border border-dashed border-gray-200 rounded text-[9px] text-gray-400 font-medium flex flex-col items-center justify-center gap-1.5">
            <Code className="w-4 h-4 text-gray-300" />
            Component
          </div>
        </motion.div>

        <div className="relative w-8 h-[2px] bg-gray-100 overflow-hidden shrink-0">
          {shouldAnimate && !prefersReducedMotion && !pasted && (
            <motion.div
              className="absolute inset-y-0 left-0 w-full bg-[#9AE83E]"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
          )}
          {pasted && <div className="absolute inset-0 bg-[#9AE83E]" />}
        </div>

        <motion.div
          className="w-20 h-24 rounded-lg bg-[#2c2c2c] border border-gray-700 p-1.5 shadow-xl relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, ...stepTransition }}
        >
          <div className="absolute top-0 right-0 p-1.5">
            <svg className="w-3 h-3 mix-blend-screen opacity-20" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5C0 52.7467 4.25329 57 9.5 57Z" fill="#0ACF83" />
              <path d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z" fill="#A259FF" />
              <path d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z" fill="#F24E1E" />
              <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" fill="#FF7262" />
              <path d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z" fill="#1ABCFE" />
            </svg>
          </div>
          <AnimatePresence>
            {pasted && (
              <motion.div
                className="h-full border border-dashed border-[#9AE83E]/50 bg-[#9AE83E]/10 rounded flex flex-col items-center justify-center gap-1.5 text-[#9AE83E]"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={stepTransition}
              >
                <Layout className="w-4 h-4" />
                <span className="text-[8px] font-medium tracking-wider">Synced</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export function ComposerPublishDomainScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);

  // Single fluid build up
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!shouldAnimate || prefersReducedMotion) {
      setStep(2); return;
    }
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 1500);
    const t2 = setTimeout(() => setStep(2), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shouldAnimate, prefersReducedMotion]);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={step === 2 ? "success" : "default"} animate={false}>
            <Globe className="w-3 h-3" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={step}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="absolute"
              >
                {step === 2 ? "Live" : "Deploying"}
              </motion.span>
              <span className="invisible px-1">Deploying</span>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center items-center gap-4">
        <motion.div
          className={cn(
            "px-4 py-2 text-[11px] font-mono rounded-lg border flex items-center gap-3 transition-colors duration-1000",
            step === 2 ? "bg-[#1a1a1a] border-[#1a1a1a] text-[#white] shadow-xl" : "bg-white border-gray-200 text-gray-500 shadow-sm"
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={stepTransition}
        >
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors duration-1000",
            step === 2 ? "bg-[#9AE83E] shadow-[0_0_8px_rgba(154,232,62,0.5)]" : "bg-gray-300"
          )} />
          {step === 0 && <span className="opacity-60 text-gray-500">Initializing...</span>}
          {step === 1 && <span className="opacity-80 text-[#1a1a1a]">page.sako.co/xyz</span>}
          {step === 2 && <span className="text-white font-bold tracking-wider">yourdomain.com</span>}
        </motion.div>

        <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-[#1a1a1a]"
            initial={{ width: "0%" }}
            animate={shouldAnimate ? { width: step === 0 ? "30%" : step === 1 ? "70%" : "100%" } : { width: "100%" }}
            transition={{ duration: 1, ease: "circOut" }}
          />
        </div>
      </div>
    </SceneContainer>
  );
}

