"use client";

import { sakoOSCopy } from "@/config/landing";
import { AnimatedGradientText } from "@/components/ui/animations/animated-gradient-text";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeSlideUp, smoothTransition, fadeSlideLeft } from "@/lib/motion-variants";

export function SakoOS() {
  const [isVisible, setIsVisible] = useState(false);
  const [bankedDays, setBankedDays] = useState(0);
  const [isPauseOn, setIsPauseOn] = useState(true);

  // Count up animation for banked days
  useEffect(() => {
    if (isVisible && bankedDays < 12) {
      const timer = setTimeout(() => {
        setBankedDays((prev) => Math.min(prev + 1, 12));
      }, 35); // ~400ms total for 12 steps
      return () => clearTimeout(timer);
    }
  }, [isVisible, bankedDays]);

  return (
    <section className="min-h-screen flex flex-col bg-gray-50 border-gray-300 border-b pt-12 pr-6 pb-12 pl-6 items-center justify-center">
      <div className="w-full max-w-[1200px] mr-auto ml-auto">
        <div className="text-center mb-16">
          <div className="mb-4 inline-block px-3 py-1 border border-gray-200 rounded-full bg-white">
            <AnimatedGradientText className="text-[10px] font-bold uppercase tracking-widest">
              {sakoOSCopy.eyebrow}
            </AnimatedGradientText>
          </div>
          <h2 className="md:text-4xl text-3xl font-medium text-black tracking-tight mb-4">
            {sakoOSCopy.title.start}
            <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
              {sakoOSCopy.title.italic}
            </span>
            {sakoOSCopy.title.end}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            {sakoOSCopy.subtitle}
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-4 auto-rows-min max-w-[1200px] w-full"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          onViewportEnter={() => setIsVisible(true)}
        >
          {/* Box 1: Billing */}
          <motion.div variants={fadeSlideUp} className="bg-white border border-gray-200 shadow-sm flex flex-col justify-between group transition-colors p-6 rounded-2xl">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#9AE83E]"></div>
                <div className="text-[10px] font-mono text-gray-400 uppercase">
                  Billing Logic
                </div>
              </div>
              {/* Rows slide in staggered (70ms each) */}
              <motion.div
                className="space-y-2 font-mono text-xs"
                variants={staggerContainer}
              >
                <motion.div variants={fadeSlideUp} className="flex justify-between p-2 bg-gray-50 rounded border border-gray-100">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-bold">Ops Base</span>
                </motion.div>
                <motion.div variants={fadeSlideUp} className="flex justify-between p-2 bg-gray-50 rounded border border-gray-100">
                  <span className="text-gray-500">Pipelines</span>
                  <span className="font-bold">2 Active</span>
                </motion.div>
                <motion.div variants={fadeSlideUp} className="flex justify-between p-2 bg-gray-50 rounded border border-gray-100">
                  <span className="text-gray-500">Credits</span>
                  <span className="font-bold text-[#0A0A0A]">18 Days</span>
                </motion.div>
              </motion.div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {sakoOSCopy.features[0].title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {sakoOSCopy.features[0].description}
              </p>
            </div>
          </motion.div>

          {/* Box 2: SLA Enforcer */}
          <motion.div variants={fadeSlideUp} className="bg-[#1a1a1a] text-white p-8 rounded-3xl border border-[#1a1a1a] shadow-xl md:col-span-2 flex flex-col md:flex-row gap-8 items-center overflow-hidden relative">
            {/* Visual - task rows appear staggered */}
            <motion.div
              className="flex-1 w-full space-y-3 relative z-10"
              variants={staggerContainer}
            >
              <motion.div variants={fadeSlideUp} className="bg-white/10 border border-white/10 rounded-lg p-3 flex justify-between items-center">
                <span className="text-xs font-medium">Landing_v2.fig</span>
                {/* Lime timer tag gently pulses every 2s */}
                <span className="text-xs font-mono text-[#9AE83E] bg-[#9AE83E]/10 px-2 py-0.5 rounded animate-lime-pulse">
                  14h 20m
                </span>
              </motion.div>
              <motion.div variants={fadeSlideUp} className="bg-white/5 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                <span className="text-xs font-medium">Social_Assets_Q3</span>
                {/* Amber tag slow opacity pulse (warn, not flashing) */}
                <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded animate-amber-pulse">
                  02h 05m
                </span>
              </motion.div>
            </motion.div>
            <div className="flex-1 relative z-10">
              <h3 className="font-semibold text-2xl mb-3">
                {sakoOSCopy.features[1].title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {sakoOSCopy.features[1].description}
              </p>
            </div>
            {/* Decor */}
            <div className="absolute right-0 top-0 w-64 h-64 bg-[#9AE83E]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
          </motion.div>

          {/* Box 3: Composer Workspace */}
          <motion.div variants={fadeSlideUp} className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm md:col-span-3 flex flex-col md:flex-row gap-8 group hover:border-[#9AE83E] transition-colors">
            <div className="flex-1">
              <div className="w-10 h-10 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center mb-4">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                </svg>
              </div>
              <h3 className="font-semibold text-2xl mb-3">
                {sakoOSCopy.features[2].title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                {sakoOSCopy.features[2].description}
              </p>
              <a
                href={sakoOSCopy.features[2].linkHref}
                className="text-xs font-bold border-b border-[#1a1a1a] pb-0.5 hover:text-[#9AE83E] hover:border-[#9AE83E] transition-colors"
              >
                {sakoOSCopy.features[2].link}
              </a>
            </div>
            {/* Visual Mockup */}
            <div className="flex-[1.5] bg-gray-50 border border-gray-100 rounded-xl p-4 flex gap-4 overflow-hidden">
              <div className="w-1/3 bg-white border border-gray-200 shadow-sm rounded-lg p-2">
                <div className="h-2 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-20 bg-gray-100 rounded mb-2"></div>
                <div className="h-2 bg-gray-100 rounded w-full mb-1"></div>
                <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                <div className="mt-2 text-[8px] text-gray-400 text-center">
                  Landing v1
                </div>
              </div>
              {/* Selected card with nudge animation on visible */}
              <motion.div
                variants={{
                  hidden: { scale: 1 },
                  show: { scale: 1.05, transition: smoothTransition }
                }}
                className="w-1/3 bg-white ring-2 ring-[#9AE83E] shadow-md rounded-lg p-2"
              >
                <div className="h-2 bg-[#1a1a1a] rounded w-1/2 mb-2"></div>
                <div className="h-20 bg-gray-200 rounded mb-2 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-[#9AE83E]"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                <div className="mt-2 text-[8px] font-bold text-center">
                  Landing v2 (Selected)
                </div>
              </motion.div>
              <div className="w-1/3 bg-white border border-gray-200 shadow-sm rounded-lg p-2 opacity-50">
                <div className="h-2 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-20 bg-gray-100 rounded mb-2"></div>
                <div className="h-2 bg-gray-100 rounded w-full mb-1"></div>
                <div className="mt-2 text-[8px] text-gray-400 text-center">
                  Ad Set
                </div>
              </div>
            </div>
          </motion.div>

          {/* Box 4: Slack Native */}
          <motion.div variants={fadeSlideUp} className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm md:col-span-2 flex flex-col justify-between group transition-colors">
            {/* Slack message slides in from left 12px - Premium black design */}
            <motion.div
              variants={fadeSlideLeft}
              className="bg-[#0A0A0A] rounded-xl p-4 mb-6 shadow-lg border border-white/10 transform group-hover:translate-y-[-4px] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#9AE83E] rounded flex items-center justify-center text-xs font-bold text-black">
                  SK
                </div>
                <div className="text-white">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm">Sako Bot</span>
                    <span className="text-[10px] text-gray-500">APP 10:42 AM</span>
                  </div>
                  <p className="text-sm mt-1 text-gray-300">
                    Feature_Landing_v2.fig is ready for review.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-1 bg-white/10 rounded border border-white/10 text-xs hover:bg-white/20 transition-colors">
                      View in Dashboard
                    </button>
                    {/* Approve button: brighten 6-8%, lift 1px on hover */}
                    <button className="px-3 py-1 bg-[#9AE83E] text-black rounded text-xs font-medium hover:brightness-110 hover:-translate-y-px transition-all">
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {sakoOSCopy.features[3].title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {sakoOSCopy.features[3].description}
              </p>
            </div>
          </motion.div>

          {/* Box 5: The Vault / Pause + bank */}
          <motion.div variants={fadeSlideUp} className="bg-gray-100 p-8 rounded-3xl border border-gray-200 shadow-inner flex flex-col justify-between">
            <div className="flex justify-between items-center mb-8">
              <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Pause
              </div>
              {/* Toggle with easing slide (220ms) */}
              <button
                onClick={() => setIsPauseOn(!isPauseOn)}
                className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-[220ms] ease-out ${isPauseOn ? 'bg-green-500' : 'bg-gray-300'}`}
                type="button"
                role="switch"
                aria-checked={isPauseOn}
                aria-label="Pause toggle"
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-[220ms] ease-out ${isPauseOn ? 'right-1' : 'left-1'}`}
                ></div>
              </button>
            </div>
            <div className="mb-4">
              {/* Count up from 0 to 12 over ~400ms on enter */}
              <div className="text-4xl font-bold text-black tabular-nums">{bankedDays}</div>
              <div className="text-xs text-gray-500">Unused days banked</div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {sakoOSCopy.features[4].title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {sakoOSCopy.features[4].description}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
