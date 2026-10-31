"use client";

import { motion } from "framer-motion";

// Shared animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const drift = {
  animate: {
    x: [0, 3, -2, 0],
    y: [0, -3, 2, 0],
    rotate: [0, 0.3, -0.2, 0]
  },
  transition: { duration: 8, repeat: Infinity }
};

// Sonar pulse component
const SonarDot = ({ className = "" }: { className?: string }) => (
  <div className={`relative ${className}`}>
    <div className="w-2 h-2 rounded-full bg-[#9AE83E]" />
    <motion.div
      className="absolute inset-0 rounded-full bg-[#9AE83E]"
      animate={{
        scale: [1, 2.5, 1],
        opacity: [0.7, 0, 0.7],
      }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  </div>
);

// Status pill component
const StatusPill = ({ 
  status, 
  animate = false 
}: { 
  status: "queued" | "ready" | "active" | "review" | "shipped";
  animate?: boolean;
}) => {
  const styles = {
    queued: "bg-transparent border-[#333] text-[#999]",
    ready: "bg-transparent border-white/20 text-white/70",
    active: "bg-[#9AE83E] border-[#9AE83E] text-[#0A0A0A]",
    review: "bg-transparent border-[#9AE83E] text-[#9AE83E]",
    shipped: "bg-transparent border-[#9AE83E] text-[#9AE83E]",
  };

  if (animate) {
    return (
      <motion.div
        className="px-2 py-0.5 rounded text-[10px] font-medium border"
        animate={{
          backgroundColor: ["rgba(255, 255, 255, 0)", "#9AE83E", "#9AE83E", "rgba(255, 255, 255, 0)"],
          borderColor: ["#333", "#9AE83E", "#9AE83E", "#333"],
          color: ["#999", "#0A0A0A", "#0A0A0A", "#999"],
        }}
        transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.85, 1] }}
      >
        Ready
      </motion.div>
    );
  }

  return (
    <div className={`px-2 py-0.5 rounded text-[10px] font-medium border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
};

// Timer component with ticking animation
const Timer = ({ value = "47:59" }: { value?: string }) => (
  <div className="relative w-12 text-right">
    <motion.span
      className="text-xs font-mono text-white/70 absolute right-0"
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.25, 1] }}
    >
      {value}
    </motion.span>
    <motion.span
      className="text-xs font-mono text-white/70 absolute right-0"
      animate={{ opacity: [0, 0, 1, 1] }}
      transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.25, 1] }}
    >
      47:58
    </motion.span>
  </div>
);

// Progress bar component
const ProgressBar = ({ delay = 0 }: { delay?: number }) => (
  <div className="h-1 w-full bg-[#222] rounded-full overflow-hidden">
    <motion.div
      className="h-full bg-[#9AE83E]/80"
      animate={{ width: ["40%", "60%", "60%", "40%"] }}
      transition={{ duration: 6, repeat: Infinity, delay, times: [0, 0.4, 0.9, 1] }}
    />
  </div>
);

// ============================================
// SCENE 1: /product - Dashboard shipping machine
// ============================================
export function ProductScene() {
  return (
    <motion.div 
      className="w-full h-full flex flex-col font-sans select-none"
      {...drift}
    >
      {/* Dashboard Header */}
      <div className="h-10 border-b border-[#222] flex items-center justify-between px-4 bg-[#0F0F0F]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#333]" />
          <div className="w-20 h-2 bg-[#222] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <SonarDot />
          <span className="text-[10px] text-white/50 uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-14 border-r border-[#222] bg-[#0A0A0A] hidden sm:flex flex-col items-center py-4 gap-3">
          <div className="w-7 h-7 rounded bg-[#111] flex items-center justify-center text-white/40 text-xs">📥</div>
          <div className="w-7 h-7 rounded bg-[#222] text-[#9AE83E] flex items-center justify-center border border-[#9AE83E]/20 text-xs">📋</div>
          <div className="w-7 h-7 rounded bg-[#111] flex items-center justify-center text-white/40 text-xs">⏱</div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 relative">
          {/* Active Slots */}
          <div className="flex justify-end gap-2 mb-4">
            <div className="px-2 py-1 rounded bg-[#1A1A1A] border border-[#333] text-[9px] text-white/60 flex items-center gap-1">
              <SonarDot className="scale-75" /> Active
            </div>
            <div className="px-2 py-1 rounded bg-[#1A1A1A] border border-[#333] text-[9px] text-white/40">
              <span className="w-1.5 h-1.5 inline-block rounded-full bg-[#444] mr-1" /> Empty
            </div>
          </div>

          {/* Queue Rows */}
          <div className="space-y-2">
            {/* Row 1: Animating Ready -> Active */}
            <motion.div 
              className="h-11 w-full bg-[#111] rounded-lg border border-[#222] flex items-center px-3 justify-between"
              animate={{ y: [0, 0, -44, -44, 0] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.6, 0.95, 1] }}
            >
              <div className="flex items-center gap-2">
                <StatusPill status="ready" animate />
                <span className="text-[11px] text-white font-medium">Landing Page V2</span>
              </div>
              <Timer />
            </motion.div>

            {/* Row 2: Active with progress */}
            <motion.div 
              className="h-11 w-full bg-[#111] rounded-lg border border-[#222] flex items-center px-3 justify-between"
              animate={{ y: [0, 0, -44, -44, 0] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.6, 0.95, 1] }}
            >
              <div className="flex items-center gap-2">
                <StatusPill status="active" />
                <div className="flex flex-col gap-1 w-24">
                  <span className="text-[11px] text-white font-medium">Q3 Deck</span>
                  <ProgressBar />
                </div>
              </div>
              <span className="text-[10px] text-[#9AE83E]">In Progress</span>
            </motion.div>

            {/* Row 3: Review with shipped stamp */}
            <motion.div 
              className="h-11 w-full bg-[#111] rounded-lg border border-[#222] flex items-center px-3 justify-between relative"
              animate={{ y: [0, 0, -44, -44, 0] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.6, 0.95, 1] }}
            >
              <div className="flex items-center gap-2">
                <StatusPill status="review" />
                <span className="text-[11px] text-white font-medium">Social Motion</span>
              </div>
              {/* Shipped Stamp */}
              <motion.div
                className="absolute right-3 border-2 border-[#9AE83E] text-[#9AE83E] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded -rotate-6 bg-[#0A0A0A]"
                animate={{
                  opacity: [0, 0, 1, 1, 0],
                  scale: [0.8, 0.8, 1.1, 1, 0.8],
                }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.7, 0.8, 0.9, 1] }}
              >
                Shipped
              </motion.div>
            </motion.div>
          </div>

          {/* Version Strip */}
          <div className="absolute bottom-4 left-4 right-4 h-6 flex items-center gap-2">
            <div className="px-2 py-0.5 rounded bg-[#222] text-[9px] text-white/50">v1.2</div>
            <div className="px-2 py-0.5 rounded bg-[#222] text-[9px] text-white/50">v1.3</div>
            <motion.div
              className="px-2 py-0.5 rounded bg-[#222] text-[9px] text-[#9AE83E] border border-[#9AE83E]/20"
              animate={{
                opacity: [0, 0, 1, 1, 0],
                scale: [0.9, 0.9, 1, 1, 0.9],
                x: [-10, -10, 0, 0, -10],
              }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.75, 0.85, 0.95, 1] }}
            >
              v1.4
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// SCENE 2: /about - Slack chaos vs Sako order
// ============================================
export function AboutScene() {
  return (
    <div className="w-full h-full flex font-sans select-none">
      {/* Left: Chaos */}
      <div className="w-1/2 h-full bg-[#111] relative overflow-hidden border-r border-[#222]">
        {/* Unread Badge */}
        <motion.div
          className="absolute top-3 left-3 w-4 h-4 bg-red-500 rounded-full border-2 border-[#111] z-20"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Slack Bubbles */}
        <motion.div
          className="absolute top-8 left-4 bg-[#2C2D30] p-2.5 rounded-lg w-40 shadow-lg"
          animate={{ x: [0, 2, -1, 0], y: [0, -2, 3, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <div className="flex gap-2 mb-1">
            <div className="w-5 h-5 bg-red-500 rounded text-[8px] flex items-center justify-center text-white font-bold flex-shrink-0">JD</div>
            <span className="text-[8px] text-[#DDD] leading-tight">Is the landing page done yet?</span>
          </div>
        </motion.div>

        <motion.div
          className="absolute top-24 right-3 bg-[#2C2D30] p-2 rounded-lg w-36 shadow-lg"
          animate={{ x: [0, -1, 2, 0], y: [0, 3, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
        >
          <div className="flex items-center gap-1.5 text-[#DDD] text-[9px]">
            📄 homepage_FINAL_v3_REAL.fig
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-16 left-4 bg-[#2C2D30] p-2.5 rounded-lg w-40 shadow-lg border border-red-500/30"
          animate={{ x: [0, 2, -1, 0], y: [0, 1, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1 }}
        >
          <div className="text-[#DDD] text-[10px] font-medium">@here What&apos;s the latest?</div>
        </motion.div>
      </div>

      {/* Right: Order (Sako) */}
      <div className="w-1/2 h-full bg-[#0A0A0A] flex items-center justify-center p-4 relative">
        <motion.div
          className="w-full bg-[#111] border border-[#9AE83E]/30 rounded-xl p-3.5 shadow-2xl"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: [100, 100, 0, 0], opacity: [0, 0, 1, 1] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.7, 1] }}
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-white">Landing Page</span>
            <div className="px-2 py-0.5 bg-[#9AE83E] text-[#0A0A0A] text-[9px] font-bold rounded">Active</div>
          </div>
          <div className="space-y-1.5">
            <motion.div
              className="h-1.5 bg-[#222] rounded-full overflow-hidden"
              animate={{ width: "100%" }}
            >
              <motion.div
                className="h-full bg-[#9AE83E]"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 2, delay: 4, repeat: Infinity, repeatDelay: 4 }}
              />
            </motion.div>
            <div className="flex justify-between text-[9px] text-white/50">
              <span>Due Today</span>
              <span>100%</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#222] flex items-center gap-2">
            <div className="px-2 py-0.5 bg-[#222] rounded text-[9px] text-white">v3_final.fig</div>
            <motion.div
              className="ml-auto w-4 h-4 rounded-full bg-[#9AE83E] flex items-center justify-center text-[#0A0A0A] text-[9px]"
              animate={{ scale: [0, 0, 1, 1], opacity: [0, 0, 1, 1] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.85, 0.95, 1] }}
            >
              ✓
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 3: /pricing - Throughput lanes
// ============================================
export function PricingScene() {
  return (
    <div className="w-full h-full flex flex-col p-5 font-sans select-none">
      {/* Plan Headers */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 h-10 rounded border border-[#333] bg-[#111] opacity-50 flex items-center justify-center">
          <span className="text-[9px] text-white/50 font-bold">CORE</span>
        </div>
        <div className="flex-1 h-10 rounded border border-[#9AE83E] bg-[#111] flex flex-col items-center justify-center relative">
          <span className="text-[9px] text-[#9AE83E] font-bold">OPS BASE</span>
          <span className="text-[7px] text-[#9AE83E]/60">Most popular</span>
        </div>
        <div className="flex-1 h-10 rounded border border-[#333] bg-[#111] opacity-50 flex items-center justify-center">
          <span className="text-[9px] text-white/50 font-bold">ENTERPRISE</span>
        </div>
      </div>

      {/* Throughput Lanes */}
      <div className="flex-1 flex gap-3">
        {/* Queue */}
        <div className="w-1/3 border-r border-[#222] pr-3 flex flex-col gap-2">
          <span className="text-[9px] text-white/50 uppercase">Queue (∞)</span>
          <div className="h-12 bg-[#1A1A1A] border border-[#333] rounded p-2 text-[9px] text-white/50">LinkedIn Ad Pack</div>
          <motion.div
            className="h-12 bg-[#1A1A1A] border border-[#9AE83E]/50 rounded p-2 text-[9px] text-white relative"
            animate={{
              x: [0, 0, 120, 120, 0],
              opacity: [1, 1, 1, 0, 1],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.5, 0.51, 1] }}
          >
            Investor One-Pager
          </motion.div>
          <div className="h-12 bg-[#1A1A1A] border border-[#333] rounded p-2 text-[9px] text-white/50">Campaign Landing Page</div>
        </div>

        {/* Active Slots */}
        <div className="w-1/3 border-r border-[#222] pr-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[9px] text-[#9AE83E] uppercase">
            Active
            <motion.span
              className="bg-[#222] px-1.5 py-0.5 rounded text-[8px]"
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.4, 1] }}
            >
              2/3
            </motion.span>
            <motion.span
              className="bg-[#222] px-1.5 py-0.5 rounded text-[8px] absolute"
              animate={{ opacity: [0, 0, 1, 1] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.4, 1] }}
            >
              3/3
            </motion.span>
          </div>
          <div className="h-12 bg-[#111] border border-[#9AE83E] rounded p-2 text-[9px] text-white">Q4 Sales Deck</div>
          <div className="h-12 bg-[#111] border border-[#9AE83E] rounded p-2 text-[9px] text-white">Email Sequence</div>
          <motion.div
            className="h-12 border border-dashed border-[#333] rounded flex items-center justify-center text-[9px] text-[#333]"
            animate={{
              borderColor: ["#333", "#333", "#9AE83E", "#9AE83E", "#333"],
              borderStyle: ["dashed", "dashed", "solid", "solid", "dashed"],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.5, 0.9, 1] }}
          >
            +1 slot open
          </motion.div>
        </div>

        {/* Done */}
        <div className="w-1/3 flex flex-col gap-2">
          <span className="text-[9px] text-white/50 uppercase">Done</span>
          <motion.div
            className="h-12 bg-[#1A1A1A] border border-[#333] rounded p-2 text-[9px] text-white/50"
            animate={{
              opacity: [0.3, 0.3, 0.3, 1, 1, 0.3],
              borderColor: ["#333", "#333", "#333", "#9AE83E", "#9AE83E", "#333"],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.65, 0.7, 0.9, 1] }}
          >
            Social Ad Pack ✓
          </motion.div>
          <div className="h-12 bg-[#1A1A1A] border border-[#333] rounded p-2 text-[9px] text-white/30">Homepage V3 ✓</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 4: /roi-calculator - Calculator + comparison
// ============================================
export function ROIScene() {
  return (
    <div className="w-full h-full flex flex-col font-sans select-none bg-[#0A0A0A]">
      {/* Header Bar */}
      <div className="h-10 border-b border-[#222] flex items-center justify-between px-4 bg-[#0F0F0F]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#9AE83E]/20 flex items-center justify-center text-[10px]">📊</div>
          <span className="text-[11px] text-white font-medium">ROI Calculator</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded bg-[#1A1A1A] border border-[#333] text-[9px] text-white/60">Monthly</div>
          <div className="px-2 py-0.5 rounded bg-[#9AE83E] text-[9px] text-[#0A0A0A] font-medium">Annual</div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Inputs */}
        <div className="w-2/5 border-r border-[#222] p-4 space-y-4 bg-[#0F0F0F]">
          {/* Team Size Input */}
          <div>
            <div className="flex justify-between mb-1.5 text-[9px]">
              <span className="text-white/50">Team Size</span>
              <motion.span
                className="text-white font-medium"
                animate={{ opacity: [1, 0, 0, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.15, 0.85, 1] }}
              >
                5
              </motion.span>
              <motion.span
                className="text-white font-medium absolute"
                style={{ right: "auto" }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.8, 0.85] }}
              >
                8
              </motion.span>
            </div>
            <div className="h-1.5 w-full bg-[#222] rounded-full relative">
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#9AE83E] rounded-full shadow-[0_0_8px_rgba(154,232,62,0.5)]"
                animate={{ left: ["30%", "60%", "60%", "30%"] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.85, 1] }}
              />
            </div>
          </div>

          {/* Assets/Month Input */}
          <div>
            <div className="flex justify-between mb-1.5 text-[9px]">
              <span className="text-white/50">Assets/Month</span>
              <motion.span
                className="text-white font-medium"
                animate={{ opacity: [1, 0, 0, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.15, 0.85, 1] }}
              >
                20
              </motion.span>
              <motion.span
                className="text-white font-medium absolute"
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.8, 0.85] }}
              >
                35
              </motion.span>
            </div>
            <div className="h-1.5 w-full bg-[#222] rounded-full relative">
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#9AE83E] rounded-full shadow-[0_0_8px_rgba(154,232,62,0.5)]"
                animate={{ left: ["40%", "70%", "70%", "40%"] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.85, 1] }}
              />
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="pt-3 border-t border-[#222] space-y-2">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/40">Agency avg.</span>
              <motion.span className="text-white/60" animate={{ opacity: [0.6, 1, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity }}>
                $18,000/mo
              </motion.span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-white/40">In-house</span>
              <motion.span className="text-white/60" animate={{ opacity: [0.6, 1, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity, delay: 0.1 }}>
                $15,000/mo
              </motion.span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-[#9AE83E]">Sako</span>
              <span className="text-[#9AE83E] font-medium">$4,500/mo</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Chart & Results */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Bar Chart */}
          <div className="flex-1 flex items-end justify-center gap-4 pb-3">
            {/* Agency Bar */}
            <div className="flex flex-col items-center gap-1.5 w-14">
              <motion.div
                className="text-[10px] text-white/50 font-medium"
                animate={{ opacity: [0.5, 1, 1, 0.5] }}
                transition={{ duration: 6, repeat: Infinity }}
              >
                $216k
              </motion.div>
              <motion.div
                className="w-full bg-gradient-to-t from-[#333] to-[#444] rounded-t relative overflow-hidden"
                animate={{ height: [120, 160, 160, 120] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.85, 1] }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)]" />
              </motion.div>
              <span className="text-[8px] text-white/40 uppercase">Agency</span>
            </div>

            {/* In-house Bar */}
            <div className="flex flex-col items-center gap-1.5 w-14">
              <motion.div
                className="text-[10px] text-white/50 font-medium"
                animate={{ opacity: [0.5, 1, 1, 0.5] }}
                transition={{ duration: 6, repeat: Infinity, delay: 0.1 }}
              >
                $180k
              </motion.div>
              <motion.div
                className="w-full bg-gradient-to-t from-[#333] to-[#444] rounded-t relative overflow-hidden"
                animate={{ height: [100, 140, 140, 100] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.85, 1], delay: 0.05 }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)]" />
              </motion.div>
              <span className="text-[8px] text-white/40 uppercase">In-house</span>
            </div>

            {/* Freelancer Bar */}
            <div className="flex flex-col items-center gap-1.5 w-14">
              <motion.div
                className="text-[10px] text-white/50 font-medium"
                animate={{ opacity: [0.5, 1, 1, 0.5] }}
                transition={{ duration: 6, repeat: Infinity, delay: 0.15 }}
              >
                $96k
              </motion.div>
              <motion.div
                className="w-full bg-gradient-to-t from-[#333] to-[#444] rounded-t relative overflow-hidden"
                animate={{ height: [70, 95, 95, 70] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.85, 1], delay: 0.1 }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)]" />
              </motion.div>
              <span className="text-[8px] text-white/40 uppercase">Freelance</span>
            </div>

            {/* Sako Bar */}
            <div className="flex flex-col items-center gap-1.5 w-14">
              <span className="text-[10px] text-[#9AE83E] font-bold">$54k</span>
              <motion.div
                className="w-full rounded-t relative overflow-hidden"
                style={{ height: 55, background: "linear-gradient(to top, #6B8E23, #9AE83E)" }}
                animate={{
                  boxShadow: [
                    "0 0 15px rgba(154,232,62,0.2)",
                    "0 0 25px rgba(154,232,62,0.4)",
                    "0 0 15px rgba(154,232,62,0.2)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)]" />
              </motion.div>
              <span className="text-[8px] text-[#9AE83E] uppercase font-bold">Sako</span>
            </div>
          </div>

          {/* Axis line */}
          <div className="h-px bg-[#333] w-full mb-4" />

          {/* Results Banner */}
          <div className="bg-[#111] border border-[#9AE83E]/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SonarDot />
              <span className="text-[10px] text-white/60">Annual Savings</span>
            </div>
            <div className="relative">
              <motion.span
                className="text-2xl font-bold text-[#9AE83E] tracking-tight"
                animate={{ opacity: [1, 0, 0, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.25, 0.9, 1] }}
              >
                $126k
              </motion.span>
              <motion.span
                className="text-2xl font-bold text-[#9AE83E] tracking-tight absolute right-0"
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.85, 0.9] }}
              >
                $162k
              </motion.span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 5: /slack - Slack updates flow to Sako
// ============================================
export function SlackScene() {
  return (
    <div className="w-full h-full flex items-center justify-center p-5 gap-4 font-sans select-none">
      {/* Left: Slack notifications */}
      <div className="w-5/12 flex flex-col gap-2">
        <motion.div
          className="bg-[#2C2D30] p-2.5 rounded border border-[#444] shadow-lg"
          animate={{ opacity: [0, 1, 1, 1], y: [10, 0, 0, 0] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.1, 0.9, 1] }}
        >
          <div className="flex gap-2 mb-1">
            <div className="w-4 h-4 rounded bg-[#9AE83E] flex-shrink-0 text-[7px] flex items-center justify-center text-[#0A0A0A] font-bold">JD</div>
            <span className="text-[8px] text-white/70 leading-tight">Can we get the LinkedIn ad updated before Thursday?</span>
          </div>
        </motion.div>
        <motion.div
          className="bg-[#2C2D30] p-2.5 rounded border border-[#444] shadow-lg"
          animate={{ opacity: [0, 0, 1, 1, 1], y: [10, 10, 0, 0, 0] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.15, 0.25, 0.9, 1] }}
        >
          <div className="flex gap-2 mb-1">
            <div className="w-4 h-4 rounded bg-blue-400 flex-shrink-0 text-[7px] flex items-center justify-center text-white font-bold">AK</div>
            <span className="text-[8px] text-white/70 leading-tight">Also need the Q4 deck refreshed for the demo</span>
          </div>
        </motion.div>
      </div>

      {/* Center: Flow connector */}
      <div className="w-1/6 h-1 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-[#333] via-[#9AE83E] to-[#333]"
          animate={{ x: [-40, 40] }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ width: "150%" }}
        />
      </div>

      {/* Right: Sako card */}
      <div className="w-5/12 bg-[#111] border border-[#333] rounded-xl p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-white font-medium">LinkedIn Ad — Q4</span>
          <motion.div
            className="px-2 py-0.5 rounded text-[9px] font-medium"
            animate={{
              backgroundColor: ["#333", "#333", "#9AE83E", "#9AE83E"],
              color: ["#999", "#999", "#0A0A0A", "#0A0A0A"],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.6, 1] }}
          >
            Active
          </motion.div>
        </div>
        <div className="w-full bg-[#1A1A1A] rounded border border-[#222] p-2">
          <div className="flex justify-between text-[8px] text-white/50 mb-1.5">
            <span>SLA Timer</span>
            <motion.span
              className="text-[#9AE83E] font-mono"
              animate={{ opacity: [1, 1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              47:52
            </motion.span>
          </div>
          <ProgressBar />
        </div>
        <motion.div
          className="flex items-center gap-1.5"
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.7, 0.8, 1] }}
        >
          <div className="px-1.5 py-0.5 bg-[#222] rounded text-[8px] text-white/70">linkedin-ad-v2.fig</div>
          <div className="ml-auto w-3.5 h-3.5 rounded-full bg-[#9AE83E] flex items-center justify-center text-[7px] text-[#0A0A0A]">✓</div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 6: /for/founders - 9/10 product, GTM backlog
// ============================================
export function FoundersScene() {
  return (
    <div className="w-full h-full flex font-sans select-none bg-[#0A0A0A]">
      {/* Left Side - Product Quality */}
      <div className="w-2/5 border-r border-[#222] flex flex-col items-center justify-center p-4 bg-[#0F0F0F]">
        {/* Product Quality Gauge */}
        <div className="relative mb-3">
          <div className="w-24 h-12 relative">
            {/* Gauge Arc Background */}
            <svg className="w-24 h-12" viewBox="0 0 96 48">
              <path d="M 8 48 A 40 40 0 0 1 88 48" fill="none" stroke="#222" strokeWidth="6" strokeLinecap="round" />
              <path d="M 8 48 A 40 40 0 0 1 88 48" fill="none" stroke="#9AE83E" strokeWidth="6" strokeLinecap="round" strokeDasharray="126" strokeDashoffset="14" />
            </svg>
            {/* Needle */}
            <motion.div
              className="absolute bottom-0 left-1/2 w-0.5 h-9 bg-white origin-bottom"
              style={{ marginLeft: -1 }}
              animate={{ rotate: [-75, -80, -75] }}
              transition={{ duration: 3, repeat: Infinity,  }}
            />
            {/* Center dot */}
            <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#222] border-2 border-[#333]" />
          </div>
          <motion.div
            className="absolute -top-1 right-0 w-2 h-2 bg-[#9AE83E] rounded-full"
            animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-0.5">9/10</div>
          <div className="text-[9px] text-white/40 uppercase tracking-wider">Product Quality</div>
        </div>

        <div className="mt-4 w-full space-y-1.5">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[#111] rounded border border-[#222]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
            <span className="text-[9px] text-white/60">Product-market fit</span>
            <span className="text-[9px] text-[#9AE83E] ml-auto">✓</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[#111] rounded border border-[#222]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
            <span className="text-[9px] text-white/60">Core features done</span>
            <span className="text-[9px] text-[#9AE83E] ml-auto">✓</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[#111] rounded border border-[#222]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
            <span className="text-[9px] text-white/60">Users love it</span>
            <span className="text-[9px] text-[#9AE83E] ml-auto">✓</span>
          </div>
        </div>
      </div>

      {/* Right Side - GTM Backlog */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header with warning */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-white/60 uppercase tracking-wider">GTM Backlog</span>
          <motion.div
            className="flex items-center gap-1 px-2 py-0.5 bg-red-900/20 border border-red-900/40 rounded"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[8px] text-red-400">Blocked</span>
          </motion.div>
        </div>

        {/* Backlog Cards */}
        <div className="flex-1 space-y-2 relative">
          {/* Card 1 - Landing Page */}
          <div className="h-11 bg-[#111] border border-[#333] rounded-lg px-3 flex items-center gap-2">
            <span className="text-sm">🖥</span>
            <span className="text-[10px] text-white font-medium">Landing Page V2</span>
            <span className="text-[8px] text-red-400 ml-auto">+14d overdue</span>
          </div>

          {/* Card 2 - Ads */}
          <div className="h-11 bg-[#111] border border-[#333] rounded-lg px-3 flex items-center gap-2">
            <span className="text-sm">📣</span>
            <span className="text-[10px] text-white font-medium">Campaign Assets</span>
            <span className="text-[8px] text-orange-400 ml-auto">Waiting</span>
          </div>

          {/* Card 3 - Deck (animates out) */}
          <motion.div
            className="h-11 bg-[#111] border border-[#9AE83E]/50 rounded-lg px-3 flex items-center gap-2 relative"
            animate={{
              y: [0, 0, 60, 60, 0],
              scale: [1, 1, 0.9, 0.9, 1],
              opacity: [1, 1, 0, 0, 1],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.65, 0.95, 1] }}
          >
            <span className="text-sm">📊</span>
            <span className="text-[10px] text-white font-medium">Investor Deck</span>
            <motion.span
              className="text-[8px] text-[#9AE83E] ml-auto"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.3, 0.4, 0.5, 0.55] }}
            >
              → Sako
            </motion.span>
          </motion.div>

          {/* Card 4 - Motion */}
          <div className="h-11 bg-[#111] border border-[#333] rounded-lg px-3 flex items-center gap-2">
            <span className="text-sm">🎬</span>
            <span className="text-[10px] text-white font-medium">Product Motion</span>
            <span className="text-[8px] text-white/40 ml-auto">Queued</span>
          </div>

          {/* Funnel Arrow */}
          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-px h-4 bg-gradient-to-b from-transparent to-[#9AE83E]" />
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#9AE83E]" />
          </motion.div>
        </div>

        {/* Sako Queue Mini */}
        <motion.div
          className="mt-6 bg-[#111] border border-[#9AE83E] rounded-lg p-3 flex items-center justify-between"
          animate={{
            borderColor: ["rgba(154,232,62,0.3)", "rgba(154,232,62,1)", "rgba(154,232,62,1)", "rgba(154,232,62,0.3)"],
            boxShadow: ["0 0 0 rgba(154,232,62,0)", "0 0 15px rgba(154,232,62,0.2)", "0 0 15px rgba(154,232,62,0.2)", "0 0 0 rgba(154,232,62,0)"],
          }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.6, 0.9, 1] }}
        >
          <div className="flex items-center gap-2">
            <SonarDot />
            <span className="text-[10px] text-white">Sako Pod</span>
          </div>
          <motion.div
            className="px-2 py-0.5 bg-[#9AE83E] rounded text-[9px] text-[#0A0A0A] font-bold"
            animate={{
              opacity: [0, 0, 1, 1, 0],
              scale: [0.8, 0.8, 1, 1, 0.8],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.7, 0.8, 0.95, 1] }}
          >
            Shipped ✓
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 7: /how-it-works - Pipeline travel
// ============================================
export function HowItWorksScene() {
  return (
    <div className="w-full h-full flex items-center font-sans select-none relative">
      {/* Column labels */}
      <div className="absolute inset-0 grid grid-cols-5 divide-x divide-[#222]">
        <div className="pt-3 text-center text-[9px] text-white/40 uppercase">Submit</div>
        <div className="pt-3 text-center text-[9px] text-white/40 uppercase">Ready</div>
        <div className="pt-3 text-center text-[9px] text-white/40 uppercase">Work</div>
        <div className="pt-3 text-center text-[9px] text-white/40 uppercase">Review</div>
        <div className="pt-3 text-center text-[9px] text-white/40 uppercase">Done</div>
      </div>

      {/* Traveling Card */}
      <motion.div
        className="w-28 h-20 bg-[#111] border border-[#9AE83E] rounded-lg shadow-[0_0_15px_rgba(154,232,62,0.2)] flex flex-col p-2.5 z-10 ml-4"
        animate={{
          x: [0, 0, 80, 80, 160, 160, 240, 240, 320, 320, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          times: [0, 0.15, 0.2, 0.4, 0.45, 0.6, 0.65, 0.8, 0.85, 0.95, 1],
        }}
      >
        <span className="text-[10px] text-white font-medium mb-0.5">Q4 Sales Deck</span>
        <span className="text-[8px] text-white/40">12 slides · Motion incl.</span>
        <div className="mt-auto flex justify-between items-center">
          <div className="flex items-center gap-1">
            <span className="text-[7px] text-white/40">SLA</span>
            <Timer value="47:59" />
          </div>
          <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center text-[7px] text-white">JS</div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// SCENE 8: /for/marketing-teams - Calendar overload vs pipeline
// ============================================
export function MarketingScene() {
  return (
    <div className="w-full h-full grid grid-cols-2 font-sans select-none">
      {/* Calendar Side */}
      <div className="border-r border-[#222] p-4 relative bg-[#0F0F0F]">
        <div className="grid grid-cols-3 gap-1.5 opacity-30 mb-3">
          <div className="h-5 bg-[#222] rounded" />
          <div className="h-5 bg-[#222] rounded" />
          <div className="h-5 bg-[#222] rounded" />
        </div>
        <div className="space-y-1.5">
          <motion.div
            className="h-9 bg-red-900/20 border border-red-900/50 rounded flex items-center px-2 text-[9px] text-red-400"
            animate={{ y: [-15, 0, 0, 0], opacity: [0, 1, 1, 1] }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.9, 1] }}
          >
            ⚠ Campaign Goes Live
          </motion.div>
          <div className="h-9 bg-[#222] rounded flex items-center px-2 text-[9px] text-white/40">Partner Webinar Prep</div>
          <div className="h-9 bg-[#222] rounded flex items-center px-2 text-[9px] text-white/40">Board Deck Review</div>
        </div>
        <motion.div
          className="absolute bottom-4 right-4 w-4 h-4 bg-[#9AE83E] rounded-full flex items-center justify-center text-[#0A0A0A] text-[9px]"
          animate={{ scale: [0, 0, 1, 1], opacity: [0, 0, 1, 1] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.7, 0.8, 1] }}
        >
          ✓
        </motion.div>
      </div>

      {/* Sako Queue Side */}
      <div className="p-4 space-y-2 bg-[#0A0A0A]">
        <span className="text-[9px] text-[#9AE83E] uppercase">Processing</span>
        {/* Task 1 */}
        <div className="bg-[#1A1A1A] border border-[#333] rounded p-2.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-[9px] text-white font-medium">Launch Landing Page</span>
            <span className="text-[9px] text-white/50 font-mono">24h</span>
          </div>
          <ProgressBar />
        </div>
        {/* Task 2 */}
        <div className="bg-[#1A1A1A] border border-[#333] rounded p-2.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-[9px] text-white font-medium">Social Ad Pack (6 formats)</span>
            <span className="text-[9px] text-white/50 font-mono">46h</span>
          </div>
          <ProgressBar delay={0.5} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 9: /for/growth-teams - Ideas to Delivered
// ============================================
export function GrowthScene() {
  return (
    <div className="w-full h-full flex p-4 gap-3 font-sans select-none">
      {/* Kanban Columns */}
      <div className="flex-1 flex flex-col">
        <span className="text-[9px] text-white/40 uppercase mb-2">Ideas</span>
        <div className="flex-1 bg-[#111] rounded-lg border border-[#222] p-2 space-y-1.5">
          <div className="h-8 bg-[#1A1A1A] rounded border border-[#333] px-2 flex items-center text-[9px] text-white/50">Homepage CTA Test</div>
          <motion.div
            className="h-8 bg-[#1A1A1A] rounded border border-[#333] px-2 flex items-center text-[9px] text-white/50"
            animate={{ opacity: [0, 0, 1, 1], y: [-10, -10, 0, 0] }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.7, 0.85, 1] }}
          >
            Pricing Page Variant
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <span className="text-[9px] text-white/40 uppercase mb-2">Ready</span>
        <div className="flex-1 bg-[#111] rounded-lg border border-[#222] p-2 space-y-1.5">
          <motion.div
            className="h-8 bg-[#1A1A1A] rounded border border-[#9AE83E]/50 px-2 flex items-center text-[9px] text-white"
            animate={{
              x: [0, 0, 100, 100, 0],
              opacity: [1, 1, 0, 0, 1],
            }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.15, 0.25, 0.95, 1] }}
          >
            LinkedIn Creative Batch
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <span className="text-[9px] text-[#9AE83E] uppercase mb-2">Delivered</span>
        <div className="flex-1 bg-[#111] rounded-lg border border-[#9AE83E]/30 p-2 space-y-1.5">
          <motion.div
            className="h-8 bg-[#1A1A1A] rounded border border-[#9AE83E] px-2 flex items-center justify-between text-[9px] text-white"
            animate={{ opacity: [0, 0, 1, 1] }}
            transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.3, 1] }}
          >
            LinkedIn Creative Batch
            <motion.span
              className="text-[8px] text-[#9AE83E]"
              animate={{ opacity: [0, 0, 1, 1] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.45, 1] }}
            >
              2h ago
            </motion.span>
          </motion.div>
        </div>
      </div>

      {/* Mini Chart */}
      <motion.div
        className="absolute bottom-3 right-3 w-12 h-8 flex items-end gap-0.5"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 1] }}
      >
        <div className="w-2 h-3 bg-[#333] rounded-t" />
        <div className="w-2 h-4 bg-[#333] rounded-t" />
        <div className="w-2 h-6 bg-[#9AE83E] rounded-t" />
      </motion.div>
    </div>
  );
}

// ============================================
// SCENE 10: /use-cases/scale-ups - Two workstreams
// ============================================
export function ScaleUpsScene() {
  return (
    <div className="w-full h-full flex flex-col font-sans select-none bg-[#0A0A0A]">
      {/* Top Stats Bar */}
      <div className="h-12 border-b border-[#222] flex items-center justify-between px-4 bg-[#0F0F0F]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SonarDot />
            <span className="text-[10px] text-white font-medium">Multi-Stream Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1A1A1A] border border-[#333]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
            <span className="text-[9px] text-white/60">4 Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1A1A1A] border border-[#9AE83E]/30]">
            <span className="text-[9px] text-[#9AE83E]">12 Shipped</span>
          </div>
        </div>
      </div>

      {/* Main Content - Two Lanes */}
      <div className="flex-1 flex gap-3 p-4">
        {/* Marketing Lane */}
        <div className="flex-1 bg-[#0F0F0F] rounded-xl border border-[#222] flex flex-col overflow-hidden">
          {/* Lane Header */}
          <div className="h-10 border-b border-[#222] flex items-center justify-between px-3 bg-[#111]">
            <div className="flex items-center gap-2">
              <span className="text-lg">📣</span>
              <span className="text-[10px] text-white font-medium uppercase">Marketing</span>
            </div>
            <div className="flex items-center gap-1">
              <motion.div
                className="w-2 h-2 rounded-full bg-[#9AE83E]"
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-[#9AE83E]"
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              />
            </div>
          </div>

          {/* Queue Items */}
          <div className="flex-1 p-2.5 space-y-2">
            {/* Active Task */}
            <div className="h-14 bg-[#111] border border-[#9AE83E] rounded-lg p-2.5 relative">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[9px] text-white font-medium">Landing Page V3</span>
                <StatusPill status="active" />
              </div>
              <ProgressBar />
            </div>

            {/* Second Active */}
            <div className="h-14 bg-[#111] border border-[#9AE83E]/50 rounded-lg p-2.5">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[9px] text-white font-medium">Campaign Ads</span>
                <Timer value="23:45" />
              </div>
              <ProgressBar delay={0.5} />
            </div>

            {/* Shipped with animation */}
            <motion.div
              className="h-14 bg-[#111] border border-[#333] rounded-lg p-2.5 flex items-center justify-between"
              animate={{
                borderColor: ["#333", "#9AE83E", "#9AE83E", "#333"],
                opacity: [0.5, 1, 1, 0.5],
              }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.35, 0.85, 1] }}
            >
              <span className="text-[9px] text-white/60">Social Motion</span>
              <motion.span
                className="text-[9px] text-[#9AE83E]"
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 6, repeat: Infinity, times: [0.3, 0.4, 0.85, 0.9] }}
              >
                Shipped ✓
              </motion.span>
            </motion.div>
          </div>
        </div>

        {/* Sales Lane */}
        <div className="flex-1 bg-[#0F0F0F] rounded-xl border border-[#222] flex flex-col overflow-hidden">
          {/* Lane Header */}
          <div className="h-10 border-b border-[#222] flex items-center justify-between px-3 bg-[#111]">
            <div className="flex items-center gap-2">
              <span className="text-lg">💼</span>
              <span className="text-[10px] text-white font-medium uppercase">Sales</span>
            </div>
            <div className="flex items-center gap-1">
              <motion.div
                className="w-2 h-2 rounded-full bg-[#9AE83E]"
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-[#9AE83E]"
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              />
            </div>
          </div>

          {/* Queue Items */}
          <div className="flex-1 p-2.5 space-y-2">
            {/* Active Task */}
            <div className="h-14 bg-[#111] border border-[#9AE83E] rounded-lg p-2.5">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[9px] text-white font-medium">Q4 Deck Update</span>
                <StatusPill status="active" />
              </div>
              <ProgressBar delay={0.3} />
            </div>

            {/* Ready Task */}
            <motion.div
              className="h-14 bg-[#111] border rounded-lg p-2.5"
              animate={{
                borderColor: ["#333", "#9AE83E", "#9AE83E", "#333"],
              }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.7, 0.75] }}
            >
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[9px] text-white font-medium">Case Study PDF</span>
                <StatusPill status="ready" animate />
              </div>
              <div className="h-1 w-full bg-[#222] rounded-full" />
            </motion.div>

            {/* Queued */}
            <div className="h-14 bg-[#111] border border-[#333] rounded-lg p-2.5 opacity-60">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[9px] text-white/60">Sales One-Pager</span>
                <StatusPill status="queued" />
              </div>
              <div className="h-1 w-full bg-[#222] rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Balance Indicator */}
      <motion.div
        className="h-8 border-t border-[#222] flex items-center justify-center gap-2 bg-[#0F0F0F]"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <span className="text-[9px] text-white/40">Balanced load</span>
        <motion.div
          className="w-16 h-1 bg-[#222] rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full w-1/2 bg-[#9AE83E] rounded-full"
            animate={{ x: [-16, 16, -16] }}
            transition={{ duration: 6, repeat: Infinity,  }}
          />
        </motion.div>
        <span className="text-[9px] text-[#9AE83E]">2 lanes active</span>
      </motion.div>
    </div>
  );
}

// ============================================
// SCENE 11: /use-cases/startups - Small team, pro output
// ============================================
export function StartupsScene() {
  const outputItems = [
    { name: "Landing Page", icon: "🖥", type: "Web" },
    { name: "Pitch Deck", icon: "📊", type: "Deck" },
    { name: "Social Pack", icon: "📱", type: "Social" },
    { name: "Launch Video", icon: "🎬", type: "Motion" },
    { name: "Ad Creatives", icon: "📣", type: "Ads" },
    { name: "Email Banner", icon: "✉️", type: "Email" },
  ];

  return (
    <div className="w-full h-full flex font-sans select-none bg-[#0A0A0A]">
      {/* Left Panel - Team */}
      <div className="w-1/3 border-r border-[#222] flex flex-col bg-[#0F0F0F]">
        {/* Team Header */}
        <div className="h-10 border-b border-[#222] flex items-center px-3">
          <span className="text-[10px] text-white/60 uppercase tracking-wider">Your Team</span>
        </div>

        {/* Team Members */}
        <div className="p-3 space-y-2 flex-1">
          <div className="flex items-center gap-2 p-2 bg-[#111] rounded-lg border border-[#222]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[9px] text-white font-bold">JD</div>
            <div>
              <div className="text-[9px] text-white font-medium">Founder</div>
              <div className="text-[8px] text-white/40">CEO</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-[#111] rounded-lg border border-[#222]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-[9px] text-white font-bold">AK</div>
            <div>
              <div className="text-[9px] text-white font-medium">Co-founder</div>
              <div className="text-[8px] text-white/40">CTO</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-[#111] rounded-lg border border-[#222]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] text-white font-bold">ML</div>
            <div>
              <div className="text-[9px] text-white font-medium">First Hire</div>
              <div className="text-[8px] text-white/40">PM</div>
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="px-3 py-2 border-t border-[#222] flex items-center justify-center gap-2">
          <motion.div
            className="flex items-center gap-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
            <div className="w-3 h-px bg-[#9AE83E]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
            <div className="w-3 h-px bg-[#9AE83E]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
          </motion.div>
          <span className="text-[8px] text-[#9AE83E]">+ Sako Pod</span>
        </div>
      </div>

      {/* Right Panel - Output Wall */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-10 border-b border-[#222] flex items-center justify-between px-4 bg-[#0F0F0F]">
          <span className="text-[10px] text-white font-medium">Shipped Assets</span>
          <div className="flex items-center gap-1">
            <SonarDot className="scale-75" />
            <motion.span
              className="text-[9px] text-[#9AE83E]"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Live
            </motion.span>
          </div>
        </div>

        {/* Output Grid */}
        <div className="flex-1 p-3 grid grid-cols-3 gap-2">
          {outputItems.map((item, i) => (
            <motion.div
              key={i}
              className="bg-[#111] rounded-lg border border-[#222] p-2 flex flex-col relative overflow-hidden"
              animate={{
                opacity: [0, 0, 1, 1],
                y: [10, 10, 0, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                times: [0, i * 0.05, i * 0.05 + 0.1, 1],
              }}
            >
              {/* Preview placeholder */}
              <div className="h-10 bg-[#1A1A1A] rounded mb-1.5 flex items-center justify-center text-lg">
                {item.icon}
              </div>
              <div className="text-[8px] text-white font-medium truncate">{item.name}</div>
              <div className="text-[7px] text-white/40">{item.type}</div>
              
              {/* Shipped badge */}
              <motion.div
                className="absolute top-1 right-1 w-4 h-4 bg-[#9AE83E] rounded-full flex items-center justify-center text-[8px] text-[#0A0A0A]"
                animate={{
                  opacity: [0, 0, 1, 1],
                  scale: [0.5, 0.5, 1.1, 1],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  times: [0, 0.25 + i * 0.08, 0.35 + i * 0.08, 1],
                }}
              >
                ✓
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Queue Strip */}
        <div className="h-14 border-t border-[#222] px-3 py-2 bg-[#0F0F0F] flex items-center gap-2">
          <span className="text-[9px] text-white/40">Queue</span>
          <div className="flex-1 flex gap-1.5">
            <motion.div
              className="flex-1 h-6 bg-[#111] border border-[#9AE83E] rounded flex items-center px-2 text-[8px] text-white"
              animate={{ x: [-100, 0, 0, -100] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.1, 0.9, 1] }}
            >
              Blog Graphics
            </motion.div>
            <div className="flex-1 h-6 bg-[#111] border border-[#333] rounded flex items-center px-2 text-[8px] text-white/50">
              PR Kit
            </div>
            <div className="flex-1 h-6 bg-[#111] border border-[#333] rounded flex items-center px-2 text-[8px] text-white/50">
              Feature Page
            </div>
          </div>
          <motion.div
            className="h-1.5 w-16 bg-[#222] rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full w-1/3 bg-[#9AE83E]"
              animate={{ x: [0, 32, 0] }}
              transition={{ duration: 3, repeat: Infinity,  }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 12: /use-cases/saas - Product vs GTM velocity
// ============================================
export function SaaSScene() {
  return (
    <div className="w-full h-full flex flex-col font-sans select-none bg-[#0A0A0A]">
      {/* Header */}
      <div className="h-10 border-b border-[#222] flex items-center justify-between px-4 bg-[#0F0F0F]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white font-medium">Velocity Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <SonarDot />
          <span className="text-[9px] text-white/50">Real-time</span>
        </div>
      </div>

      {/* Main Content - Two Velocity Panels */}
      <div className="flex-1 flex gap-4 p-4">
        {/* Product Velocity Panel */}
        <div className="flex-1 bg-[#0F0F0F] rounded-xl border border-[#222] flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-white font-medium uppercase">Product</span>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[#1A1A1A] rounded border border-[#333]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[8px] text-green-400">Stable</span>
            </div>
          </div>

          {/* Gauge */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-28 h-14">
              <svg className="w-28 h-14" viewBox="0 0 112 56">
                <path d="M 8 56 A 48 48 0 0 1 104 56" fill="none" stroke="#222" strokeWidth="8" strokeLinecap="round" />
                <path d="M 8 56 A 48 48 0 0 1 104 56" fill="none" stroke="#444" strokeWidth="8" strokeLinecap="round" strokeDasharray="151" strokeDashoffset="30" />
              </svg>
              <div className="absolute bottom-0 left-1/2 w-0.5 h-10 bg-white origin-bottom rotate-[55deg]" style={{ marginLeft: -1 }} />
              <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#222] border-2 border-[#444]" />
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/40">Ship rate</span>
              <span className="text-white">85%</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-white/40">Velocity</span>
              <span className="text-white">Consistent</span>
            </div>
          </div>
        </div>

        {/* GTM Velocity Panel */}
        <div className="flex-1 bg-[#0F0F0F] rounded-xl border border-[#222] flex flex-col p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-white font-medium uppercase">GTM</span>
            <motion.div
              className="flex items-center gap-1 px-2 py-0.5 rounded border"
              animate={{
                backgroundColor: ["#1A1A1A", "#1A1A1A", "#9AE83E20", "#9AE83E20"],
                borderColor: ["#333", "#333", "#9AE83E", "#9AE83E"],
              }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 1] }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                animate={{ backgroundColor: ["#F59E0B", "#F59E0B", "#9AE83E", "#9AE83E"] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 1] }}
              />
              <motion.span
                className="text-[8px]"
                animate={{ color: ["#F59E0B", "#F59E0B", "#9AE83E", "#9AE83E"] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 1] }}
              >
                Stabilizing...
              </motion.span>
            </motion.div>
          </div>

          {/* Gauge with wobble */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-28 h-14">
              <svg className="w-28 h-14" viewBox="0 0 112 56">
                <path d="M 8 56 A 48 48 0 0 1 104 56" fill="none" stroke="#222" strokeWidth="8" strokeLinecap="round" />
                <motion.path
                  d="M 8 56 A 48 48 0 0 1 104 56"
                  fill="none"
                  stroke="#9AE83E"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="151"
                  animate={{ strokeDashoffset: [60, 40, 50, 45, 30, 30] }}
                  transition={{ duration: 6, repeat: Infinity, times: [0, 0.2, 0.3, 0.4, 0.55, 1] }}
                />
              </svg>
              <motion.div
                className="absolute bottom-0 left-1/2 w-0.5 h-10 bg-[#9AE83E] origin-bottom"
                style={{ marginLeft: -1 }}
                animate={{
                  rotate: [-35, 55, -15, 40, 45, 45],
                }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.15, 0.25, 0.4, 0.55, 1] }}
              />
              <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#111] border-2 border-[#9AE83E]" />
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/40">Ship rate</span>
              <motion.span
                animate={{ opacity: [1, 0, 0, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 0.6] }}
                className="text-orange-400"
              >
                Variable
              </motion.span>
              <motion.span
                className="text-[#9AE83E] absolute"
                style={{ right: 16 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.6, 1] }}
              >
                72% ↑
              </motion.span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-white/40">Velocity</span>
              <motion.span
                animate={{ opacity: [1, 0, 0, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 0.6] }}
                className="text-orange-400"
              >
                Unpredictable
              </motion.span>
              <motion.span
                className="text-[#9AE83E] absolute"
                style={{ right: 16 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.5, 0.6, 1] }}
              >
                Stable
              </motion.span>
            </div>
          </div>
        </div>
      </div>

      {/* Stabilizer Module */}
      <div className="px-4 pb-4">
        <motion.div
          className="bg-[#111] border rounded-xl p-4 flex items-center justify-between"
          animate={{
            borderColor: ["#333", "#333", "#9AE83E", "#9AE83E"],
            boxShadow: [
              "0 0 0 rgba(154,232,62,0)",
              "0 0 0 rgba(154,232,62,0)",
              "0 0 20px rgba(154,232,62,0.15)",
              "0 0 20px rgba(154,232,62,0.15)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 1] }}
        >
          <div className="flex items-center gap-3">
            <SonarDot />
            <div>
              <div className="text-[10px] text-white font-medium">Sako GTM Stabilizer</div>
              <motion.div
                className="text-[8px]"
                animate={{ color: ["rgba(255,255,255,0.4)", "rgba(255,255,255,0.4)", "#9AE83E", "#9AE83E"] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.55, 1] }}
              >
                Capacity locked • SLAs active • Queue managed
              </motion.div>
            </div>
          </div>

          {/* Mini Queue */}
          <div className="flex gap-1.5">
            <motion.div
              className="w-8 h-6 bg-[#1A1A1A] border border-[#9AE83E] rounded flex items-center justify-center"
              animate={{ opacity: [0.5, 0.5, 1, 1] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.4, 0.5, 1] }}
            >
              <motion.span
                className="text-[8px] text-[#9AE83E]"
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: 6, repeat: Infinity, times: [0, 0.75, 0.85, 1] }}
              >
                ✓
              </motion.span>
            </motion.div>
            <div className="w-8 h-6 bg-[#1A1A1A] border border-[#333] rounded" />
            <div className="w-8 h-6 bg-[#1A1A1A] border border-[#333] rounded opacity-50" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// SCENE 13: /compare - Pick your pain
// ============================================
export function CompareScene() {
  return (
    <div className="w-full h-full grid grid-cols-4 p-3 gap-2 font-sans select-none">
      {/* Agency */}
      <div className="flex flex-col items-start pt-3 px-2.5 border rounded border-[#333] bg-[#111] relative overflow-hidden">
        <motion.div
          className="text-lg mb-1"
          animate={{ x: [0, 2, -1, 0], y: [0, -1, 2, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          💼
        </motion.div>
        <span className="text-[9px] text-white/60 font-semibold mb-2">Agency</span>
        <div className="space-y-1 w-full">
          <div className="text-[7px] text-red-400/80">2–4 wk lead time</div>
          <div className="text-[7px] text-red-400/80">Retainer contracts</div>
          <div className="text-[7px] text-red-400/60">Scope creep risk</div>
        </div>
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-red-900/30"
          animate={{ height: ["30%", "50%", "50%", "30%"] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.4, 0.9, 1] }}
        />
      </div>

      {/* Freelancer */}
      <div className="flex flex-col items-start pt-3 px-2.5 border rounded border-[#333] bg-[#111] relative overflow-hidden">
        <motion.div
          className="text-lg mb-1"
          animate={{ x: [0, -1, 2, 0], y: [0, 2, -1, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0.2 }}
        >
          👤
        </motion.div>
        <span className="text-[9px] text-white/60 font-semibold mb-2">Freelancer</span>
        <div className="space-y-1 w-full">
          <div className="text-[7px] text-red-400/80">Availability gaps</div>
          <div className="text-[7px] text-red-400/80">No SLAs</div>
          <div className="text-[7px] text-red-400/60">Hard to scale</div>
        </div>
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-red-900/30"
          animate={{ height: ["25%", "45%", "45%", "25%"] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.4, 0.9, 1], delay: 0.2 }}
        />
      </div>

      {/* In-House */}
      <div className="flex flex-col items-start pt-3 px-2.5 border rounded border-[#333] bg-[#111] relative overflow-hidden">
        <motion.div
          className="text-lg mb-1"
          animate={{ x: [0, 1, -2, 0], y: [0, -2, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0.4 }}
        >
          👥
        </motion.div>
        <span className="text-[9px] text-white/60 font-semibold mb-2">In-House</span>
        <div className="space-y-1 w-full">
          <div className="text-[7px] text-red-400/80">$120k–$180k/yr</div>
          <div className="text-[7px] text-red-400/80">Hard to scale</div>
          <div className="text-[7px] text-red-400/60">Hiring risk</div>
        </div>
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-red-900/30"
          animate={{ height: ["35%", "55%", "55%", "35%"] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.4, 0.9, 1], delay: 0.4 }}
        />
      </div>

      {/* Sako */}
      <div className="flex flex-col items-start pt-3 px-2.5 border border-[#9AE83E] bg-[#111] shadow-[0_0_20px_rgba(154,232,62,0.1)] rounded relative overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 w-full h-1 bg-[#9AE83E]"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-lg mb-1">⚡</span>
        <span className="text-[9px] text-white font-bold mb-2">Sako</span>
        <div className="space-y-1 w-full">
          <div className="text-[7px] text-[#9AE83E]">48h delivery</div>
          <div className="text-[7px] text-[#9AE83E]">SLA-backed</div>
          <div className="text-[7px] text-[#9AE83E]">Pause anytime</div>
        </div>
        <div className="mt-auto w-full pb-2 space-y-1">
          <motion.div
            className="h-1 bg-[#9AE83E] rounded-full"
            animate={{ width: ["0%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
          />
          <motion.div
            className="h-1 bg-[#9AE83E] rounded-full"
            animate={{ width: ["0%", "66%"] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, delay: 0.2 }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXPORTS & SCENE MAP
// ============================================
export const heroScenes = {
  product: ProductScene,
  about: AboutScene,
  pricing: PricingScene,
  "roi-calculator": ROIScene,
  slack: SlackScene,
  "for/founders": FoundersScene,
  "how-it-works": HowItWorksScene,
  "for/marketing-teams": MarketingScene,
  "for/growth-teams": GrowthScene,
  "use-cases/scale-ups": ScaleUpsScene,
  "use-cases/startups": StartupsScene,
  "use-cases/saas": SaaSScene,
  compare: CompareScene,
} as const;

export type HeroSceneId = keyof typeof heroScenes;

