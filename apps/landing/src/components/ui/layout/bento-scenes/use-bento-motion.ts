"use client";

import { useEffect, useState, RefObject } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * Hook for gating bento animations based on:
 * 1. Whether the element is in view
 * 2. User's reduced motion preference
 * 
 * Usage:
 * const ref = useRef(null);
 * const { shouldAnimate, inView } = useBentoMotionGate(ref);
 */
export function useBentoMotionGate(ref: RefObject<HTMLElement | null>) {
  const prefersReducedMotion = useReducedMotion();
  const inView = useInView(ref, {
    amount: 0.25,
    once: false,
    // Start animation slightly before visible for smoother UX
  });

  return {
    inView,
    prefersReducedMotion: prefersReducedMotion ?? false,
    shouldAnimate: inView && !prefersReducedMotion,
  };
}

/**
 * Hook for cycling through states using framer-motion keyframes timing
 * instead of setInterval. Only cycles when in view.
 */
export function useCycleState<T>(
  states: T[],
  intervalMs: number,
  shouldAnimate: boolean
): T {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || states.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % states.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [shouldAnimate, states.length, intervalMs]);

  // Reset when animation stops
  useEffect(() => {
    if (!shouldAnimate) {
      setIndex(0);
    }
  }, [shouldAnimate]);

  return states[index];
}

/**
 * Hook for progress animation that only runs when in view
 */
export function useProgressAnimation(
  durationMs: number,
  shouldAnimate: boolean,
  loop: boolean = true
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!shouldAnimate) {
      setProgress(0);
      return;
    }

    const startTime = Date.now();
    let animationFrame: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = (elapsed / durationMs) * 100;
      
      if (loop) {
        setProgress(rawProgress % 100);
      } else {
        setProgress(Math.min(rawProgress, 100));
        if (rawProgress >= 100) return;
      }
      
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [shouldAnimate, durationMs, loop]);

  return progress;
}

