"use client";

import { howSakoRunsCopy } from "@/config/landing";
import { useEffect, useState } from "react";
import { AnimatedGradientText } from "@/components/ui/animations/animated-gradient-text";
import { motion } from "framer-motion";
import { staggerContainer, fadeSlideUp } from "@/lib/motion-variants";

export function HowItWorks() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isShipHovered, setIsShipHovered] = useState(false);

  useEffect(() => {
    setTimeLeft(172800); // 48 hours in seconds
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 172800));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section
      className="min-h-screen flex bg-white border-gray-300 border-b pt-24 pr-6 pb-24 pl-6 items-center justify-center"
      id="how"
    >
      <div className="w-full max-w-[1200px] mr-auto ml-auto">
        <div className="text-center mb-16">
          <div className="mb-4 inline-block px-3 py-1 border border-gray-200 rounded-full bg-white">
            <AnimatedGradientText className="text-[10px] font-bold uppercase tracking-widest">
              {howSakoRunsCopy.eyebrow}
            </AnimatedGradientText>
          </div>
          <h2 className="text-3xl font-medium mt-2">
            {howSakoRunsCopy.title.start}
            <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
              {howSakoRunsCopy.title.italic1}
            </span>
            {howSakoRunsCopy.title.middle}
            <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
              {howSakoRunsCopy.title.italic2}
            </span>
            {howSakoRunsCopy.title.end}
          </h2>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
        >
          {/* Step 1: Input */}
          <motion.div
            variants={fadeSlideUp}
            className="group relative p-8 bg-gray-50 border border-gray-100 rounded-3xl hover:border-gray-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="text-xs font-mono font-medium text-gray-400 mb-4">
                {howSakoRunsCopy.steps[0].number}
              </div>
              <h3 className="font-semibold text-2xl tracking-tight text-black mb-3">
                {howSakoRunsCopy.steps[0].title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {howSakoRunsCopy.steps[0].description}
              </p>
            </div>
            <div className="w-full bg-white rounded-xl border border-gray-200 mt-8 shadow-sm relative p-0 flex flex-col items-center justify-center group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden min-h-[140px]">
              <svg width="100%" height="100%" viewBox="0 0 300 140" className="absolute inset-0">
                <defs>
                  <linearGradient id="briefGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9a10f0" stopOpacity="0" />
                    <stop offset="50%" stopColor="#9AE83E" stopOpacity="1" />
                    <stop offset="100%" stopColor="#9AE83E" stopOpacity="0" />
                  </linearGradient>
                  <filter id="blurNeon" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Grid Background */}
                <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#smallGrid)" />

                {/* Animated Data Nodes */}
                {[...Array(5)].map((_, i) => (
                  <g key={`data-${i}`}>
                    <circle r="2" fill="#9AE83E" filter="url(#blurNeon)">
                      <animateMotion
                        dur={`${2 + i % 2}s`}
                        repeatCount="indefinite"
                        path={`M ${-20 + (i * 20)} 70 Q 150 ${20 + (i * 30)} 320 70`}
                        begin={`${i * 0.4}s`}
                      />
                      <animate attributeName="opacity" values="0;1;0" dur={`${2 + i % 2}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
                    </circle>
                  </g>
                ))}

                {/* Central Processor Node */}
                <g transform="translate(150, 70)">
                  <circle cx="0" cy="0" r="28" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                  <circle cx="0" cy="0" r="20" fill="#fff" stroke="#9AE83E" strokeWidth="2" strokeDasharray="4 4">
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="0" cy="0" r="14" fill="#1a1a1a" filter="url(#blurNeon)">
                    <animate attributeName="r" values="12;15;12" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <path d="M -4 -3 L 6 0 L -4 3 Z" fill="#9AE83E" />
                </g>

                {/* Input Lines connecting to center */}
                <path d="M 30 70 L 122 70" stroke="url(#briefGlow)" strokeWidth="1.5" strokeDasharray="4 4" strokeDashoffset="0">
                  <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                </path>

                {/* Text Scrambler Effect */}
                <text x="150" y="24" fontFamily="monospace" fontSize="8" fill="#a3a3a3" textAnchor="middle" letterSpacing="2">
                  <tspan>BUILDING_BRIEF.MD</tspan>
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
                </text>
              </svg>
            </div>
          </motion.div>

          {/* Step 2: First Draft */}
          <motion.div
            variants={fadeSlideUp}
            className="group relative p-8 bg-[#0A0A0A] text-white border border-white/5 rounded-3xl shadow-2xl flex flex-col justify-between md:col-span-2 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            {/* Noise/Glow Texture */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')",
              }}
            ></div>
            {/* Glow blob transparent base, CSS hover overrides */}
            <div
              className="absolute top-0 right-0 w-64 h-64 bg-[#9AE83E]/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-[#9AE83E]/20 transition-colors duration-700 opacity-60 mix-blend-screen"
            ></div>

            <div className="flex justify-between items-start relative z-10">
              <div>
                <div className="text-xs font-mono font-medium text-[#9AE83E] mb-2">
                  {howSakoRunsCopy.steps[1].number}
                </div>
                <h3 className="font-semibold text-2xl tracking-tight">
                  {howSakoRunsCopy.steps[1].title}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/5 text-xs font-mono text-gray-300 backdrop-blur-md">
                {howSakoRunsCopy.steps[1].badge}
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed max-w-lg mt-4 relative z-10">
              {howSakoRunsCopy.steps[1].description}
            </p>
            <div className="relative z-10 mt-8">
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wider">
                <span>Generating layouts</span>
                <span className="text-[#9AE83E] animate-processing-pulse">
                  Processing...
                </span>
              </div>
              {/* Scan line loops every 1.4s */}
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-[#9AE83E] to-transparent opacity-80 animate-scan-slow"></div>
              </div>
              {/* Advanced Generative Layout SVG */}
              <div className="mt-4 w-full h-32 rounded-lg border border-white/10 bg-black/40 overflow-hidden relative">
                <svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-0">
                  <defs>
                    <linearGradient id="blueprintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#9AE83E" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#9AE83E" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="scanFill" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                      <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                    <clipPath id="screenClip">
                      <rect x="20" y="20" width="360" height="80" rx="4" />
                    </clipPath>
                  </defs>

                  {/* Blueprint Grid */}
                  <pattern id="archGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <rect width="20" height="20" fill="none" />
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#archGrid)" />

                  {/* Masked Screen Area */}
                  <g clipPath="url(#screenClip)">
                    <rect x="20" y="20" width="360" height="80" fill="url(#blueprintGrad)" />

                    {/* Header Nav Outline */}
                    <rect x="30" y="30" width="340" height="12" rx="2" fill="none" stroke="#9AE83E" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="360" strokeDashoffset="360">
                      <animate attributeName="stroke-dashoffset" values="360;0" dur="2s" fill="freeze" />
                    </rect>
                    <rect x="35" y="34" width="40" height="4" rx="1" fill="#ffffff" opacity="0">
                      <animate attributeName="opacity" values="0;0.5" dur="0.5s" begin="1.5s" fill="freeze" />
                    </rect>

                    {/* Hero Block Outline */}
                    <rect x="30" y="50" width="200" height="40" rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="500" strokeDashoffset="500">
                      <animate attributeName="stroke-dashoffset" values="500;0" dur="2.5s" begin="0.5s" fill="freeze" />
                    </rect>
                    <rect x="30" y="50" width="200" height="40" rx="4" fill="#ffffff" opacity="0">
                      <animate attributeName="opacity" values="0;0.05" dur="1s" begin="3s" fill="freeze" />
                    </rect>

                    {/* Sider Blocks */}
                    <rect x="240" y="50" width="130" height="18" rx="2" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="300" strokeDashoffset="300">
                      <animate attributeName="stroke-dashoffset" values="300;0" dur="1.5s" begin="1s" fill="freeze" />
                    </rect>
                    <rect x="240" y="72" width="130" height="18" rx="2" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="300" strokeDashoffset="300">
                      <animate attributeName="stroke-dashoffset" values="300;0" dur="1.5s" begin="1.2s" fill="freeze" />
                    </rect>

                    {/* Scanning Laser */}
                    <rect x="20" y="20" width="360" height="80" fill="url(#scanFill)">
                      <animateTransform attributeName="transform" type="translate" from="-360 0" to="360 0" dur="3s" repeatCount="indefinite" />
                    </rect>
                  </g>
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Step 3: Active */}
          <motion.div
            variants={fadeSlideUp}
            className="group relative p-8 bg-white border border-gray-200 rounded-3xl hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="text-xs font-mono font-medium text-gray-400 mb-4">
                {howSakoRunsCopy.steps[2].number}
              </div>
              <h3 className="font-semibold text-2xl tracking-tight text-black mb-3">
                {howSakoRunsCopy.steps[2].title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {howSakoRunsCopy.steps[2].description}
              </p>
            </div>
            <div className="mt-6 self-start relative w-48 h-48 group-hover:scale-105 transition-transform duration-500">
              <svg width="100%" height="100%" viewBox="0 0 200 200" className="absolute inset-0">
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9AE83E" stopOpacity="1" />
                    <stop offset="50%" stopColor="#9AE83E" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#9a10f0" stopOpacity="0.8" />
                  </linearGradient>
                  <filter id="neonRing" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background Track */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle cx="100" cy="100" r="64" fill="none" stroke="#f8fafc" strokeWidth="1" strokeDasharray="4 4" />

                {/* Animated Gradient Ring */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="502" strokeDashoffset="100" filter="url(#neonRing)">
                  <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="8s" repeatCount="indefinite" />
                </circle>

                {/* Secondary Data Ring */}
                <circle cx="100" cy="100" r="64" fill="none" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" strokeDasharray="402" strokeDashoffset="300">
                  <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="12s" repeatCount="indefinite" />
                  <animate attributeName="stroke-dashoffset" values="300;100;300" dur="6s" repeatCount="indefinite" />
                </circle>

                {/* Center Core */}
                <circle cx="100" cy="100" r="48" fill="#ffffff" stroke="#f1f5f9" strokeWidth="1" />
                <circle cx="100" cy="100" r="42" fill="#fafafa" />

                {/* Active Indicator Pulse */}
                <circle cx="100" cy="80" r="4" fill="#9AE83E">
                  <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>

              {/* HTML Overlay for actual state timer */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="mt-4 text-center">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-1">Time Lft</span>
                  <span className="text-xl font-mono font-medium text-black tabular-nums tracking-tight">
                    {timeLeft !== null ? formatTime(timeLeft) : "48:00:00"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Step 4: Review */}
          <motion.div
            variants={fadeSlideUp}
            className="group relative p-8 bg-white border border-gray-200 rounded-3xl hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="text-xs font-mono font-medium text-gray-400 mb-4">
                {howSakoRunsCopy.steps[3].number}
              </div>
              <h3 className="font-semibold text-2xl tracking-tight text-black mb-3">
                {howSakoRunsCopy.steps[3].title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {howSakoRunsCopy.steps[3].description}
              </p>
            </div>
            <div className="mt-6 flex flex-col items-center justify-end h-16 relative w-full group-hover:scale-[1.03] transition-transform duration-500">
              {/* Intricate SVG Communication Network */}
              <svg width="100%" height="100%" viewBox="0 0 200 64" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 z-0">
                <defs>
                  <linearGradient id="reviewGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#9AE83E" stopOpacity="0" />
                    <stop offset="100%" stopColor="#9AE83E" stopOpacity="0.4" />
                  </linearGradient>
                  <filter id="reviewNeon" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Floating Datapoints */}
                <g fill="#e5e5e5">
                  <circle cx="40" cy="40" r="1.5">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-10; 0,0" dur="4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.2;1;0.2" dur="4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="160" cy="20" r="2">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-15; 0,0" dur="5s" repeatCount="indefinite" begin="1s" />
                    <animate attributeName="opacity" values="0.1;0.8;0.1" dur="5s" repeatCount="indefinite" begin="1s" />
                  </circle>
                </g>

                {/* Central Glow Field */}
                <path d="M 50 64 L 70 20 L 130 20 L 150 64 Z" fill="url(#reviewGrad)" />
                <path d="M 70 20 L 130 20" stroke="#9AE83E" strokeWidth="2" filter="url(#reviewNeon)">
                  <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
                </path>

                {/* Async Lines */}
                <path d="M 20 64 Q 60 30 100 64" fill="none" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4">
                  <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 180 64 Q 140 30 100 64" fill="none" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4">
                  <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                </path>
              </svg>

              {/* UI Overlay */}
              <div className="flex items-end justify-center gap-2 relative z-10 w-full px-4">
                <div className="h-8 flex-1 bg-white/80 backdrop-blur-sm border border-gray-100 rounded opacity-60 transform scale-90 group-hover:-translate-x-1 transition-transform duration-300"></div>
                <div className="h-10 w-16 bg-white border-2 border-[#9AE83E] shadow-lg rounded relative transform group-hover:-translate-y-2 transition-transform duration-300 flex items-center justify-center">
                  <div className="w-8 h-1.5 bg-gray-100 rounded-full"></div>
                  {/* Glowing Ping */}
                  <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-400 rounded-full border-2 border-white shadow-[0_0_10px_rgba(248,113,113,0.8)] animate-ping-pulse"></div>
                </div>
                <div className="h-8 flex-1 bg-white/80 backdrop-blur-sm border border-gray-200 rounded opacity-80 transform scale-90 group-hover:translate-x-1 transition-transform duration-300"></div>
              </div>
            </div>
          </motion.div>

          {/* Step 5: Ship */}
          <motion.div
            variants={fadeSlideUp}
            className="group relative p-8 bg-white text-black border border-gray-200 rounded-3xl flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl hover:border-[#9AE83E] transition-all duration-300 overflow-hidden cursor-pointer"
            onMouseEnter={() => setIsShipHovered(true)}
            onMouseLeave={() => setIsShipHovered(false)}
          >
            <div>
              <div className="text-xs font-mono font-medium text-gray-400 mb-4">
                {howSakoRunsCopy.steps[4].number}
              </div>
              <h3 className="font-semibold text-2xl tracking-tight mb-3">
                {howSakoRunsCopy.steps[4].title}
              </h3>
              <p className="text-sm text-black/70 leading-relaxed">
                {howSakoRunsCopy.steps[4].description}
              </p>
            </div>
            <div className="mt-4 self-end relative group-hover:-translate-y-2 transition-transform duration-500 w-16 h-16">
              <svg width="100%" height="100%" viewBox="0 0 64 64" className="absolute inset-0 drop-shadow-lg">
                {/* Decorative Outer Spin Rings */}
                <circle cx="32" cy="32" r="30" fill="none" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 8">
                  <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="20s" repeatCount="indefinite" />
                </circle>
                <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20 40">
                  <animateTransform attributeName="transform" type="rotate" from="360 32 32" to="0 32 32" dur="15s" repeatCount="indefinite" />
                </circle>
                <circle cx="32" cy="32" r="22" fill="#1a1a1a" />

                {/* The Checkmark Path */}
                <polyline points="42 24 28 38 22 32" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  className={isShipHovered ? 'animate-checkmark-draw' : ''}
                  style={{ strokeDasharray: isShipHovered ? 40 : 'none', strokeDashoffset: isShipHovered ? 0 : 'none' }}
                />
              </svg>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
