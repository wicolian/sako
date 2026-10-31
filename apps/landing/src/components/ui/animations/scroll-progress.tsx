"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ScrollProgressProps {
  className?: string;
}

export function ScrollProgress({ className }: ScrollProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;

    const update = () => {
      const el = barRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const progress = scrollHeight === clientHeight
        ? 0
        : scrollTop / (scrollHeight - clientHeight);
      el.style.transform = `scaleX(${progress})`;
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={barRef}
      className={cn(
        "fixed inset-x-0 top-0 z-[100] h-[3px] origin-left bg-gradient-to-r from-[#9AE83E] via-[#9AE83E] to-[#9AE83E]",
        className
      )}
      style={{ transform: "scaleX(0)" }}
    />
  );
}

