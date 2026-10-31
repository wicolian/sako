"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { FileText, Check, ArrowRight } from "lucide-react";
import { stepTransition } from "@/lib/motion-variants";

/**
 * Scene: Deck Refresh
 * Update (2026 Premium): Calm, intentional slide updates, smooth crossfades, no erratic wipes.
 */

const slides = [
  { id: 1, label: "Title", before: "bg-gray-100 border-gray-200", after: "bg-[#1a1a1a] border-[#1a1a1a] text-white" },
  { id: 2, label: "Problem", before: "bg-gray-100 border-gray-200", after: "bg-blue-50 border-blue-200 text-blue-900" },
  { id: 3, label: "Solution", before: "bg-gray-100 border-gray-200", after: "bg-[#9AE83E] border-[#8BD835] text-[#1a1a1a]" },
  { id: 4, label: "Metrics", before: "bg-gray-100 border-gray-200", after: "bg-purple-50 border-purple-200 text-purple-900" },
  { id: 5, label: "Ask", before: "bg-gray-100 border-gray-200", after: "bg-amber-50 border-amber-200 text-amber-900" },
];

export function DeckRefreshScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(ref);

  // Calmer, slower progression (2.5 seconds per state instead of frantic <1s updates)
  const refreshedCount = useCycleState([0, 1, 2, 3, 4, 5], 2500, shouldAnimate && !prefersReducedMotion);

  // The active slide being viewed matches the one currently being refreshed or the last one if done
  const activeSlide = Math.min(refreshedCount, 4);

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={refreshedCount === 5 ? "success" : "default"} animate={false}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={refreshedCount === 5 ? 'done' : 'progress'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={stepTransition}
                className="flex items-center gap-1"
              >
                {refreshedCount === 5 ? (
                  <>
                    <Check className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3 text-gray-400" />
                    {refreshedCount}/5
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex gap-3 items-center justify-center px-2">

        {/* Thumbnails column */}
        <div className="flex flex-col gap-1.5 opacity-90">
          {slides.map((slide, i) => {
            const isRefreshed = i < refreshedCount;
            const isActive = i === activeSlide;

            return (
              <motion.div
                key={slide.id}
                className={`w-12 h-6 rounded-sm border flex items-center justify-center relative overflow-hidden transition-colors duration-700`}
                animate={{
                  opacity: isActive ? 1 : 0.6,
                  scale: isActive && shouldAnimate && !prefersReducedMotion ? 1.05 : 1
                }}
                transition={stepTransition}
              >
                {/* Crossfade state */}
                <div className={`absolute inset-0 transition-colors duration-700 ${isRefreshed ? slide.after : slide.before}`} />

                {/* Slide number */}
                <span className={`relative z-10 text-[8px] font-mono mix-blend-difference font-semibold ${isRefreshed ? 'text-white' : 'text-gray-400'}`}>
                  {slide.id}
                </span>

                {/* Active Indicator Line */}
                {isActive && (
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#1a1a1a]"
                    layoutId="active-slide-indicator"
                    transition={stepTransition}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Calm Flow Arrow */}
        <div className="relative w-6 h-[1px] bg-gray-200 overflow-hidden shrink-0 mx-1">
          {shouldAnimate && !prefersReducedMotion && (
            <motion.div
              className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-gray-400 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>

        {/* Big preview */}
        <div className="flex-1 max-w-[120px] h-full flex flex-col items-center justify-center relative">
          <div className={`w-full aspect-[16/9] rounded-lg border shadow-sm overflow-hidden relative transition-colors duration-1000 ${activeSlide < refreshedCount
              ? slides[activeSlide].after
              : slides[activeSlide].before
            }`}>

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`${activeSlide}-${activeSlide < refreshedCount ? 'after' : 'before'}`}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={stepTransition}
              >
                {/* Content skeleton matching the vibe */}
                <div className={`w-3/4 h-2.5 rounded-sm ${activeSlide < refreshedCount && activeSlide === 0 ? 'bg-white/90' : 'bg-current opacity-30'}`} />
                <div className={`w-full h-1.5 rounded-sm ${activeSlide < refreshedCount && activeSlide === 0 ? 'bg-white/60' : 'bg-current opacity-20'}`} />
                <div className={`w-5/6 h-1.5 rounded-sm ${activeSlide < refreshedCount && activeSlide === 0 ? 'bg-white/60' : 'bg-current opacity-20'}`} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-3 h-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={activeSlide}
                className="text-[9px] font-medium tracking-wider uppercase text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {slides[activeSlide].label}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

export default DeckRefreshScene;

