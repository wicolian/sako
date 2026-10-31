"use client";

import { slackToShippedCopy } from "@/config/landing";
import { AnimatedGradientText } from "@/components/ui/animations/animated-gradient-text";
import Link from "next/link";
import { motion } from "framer-motion";
import { staggerContainer, fadeSlideUp, smoothTransition } from "@/lib/motion-variants";

export function SlackToShipped() {
  return (
    <section className="border-y min-h-screen flex bg-white border-gray-200 pt-24 pr-6 pb-24 pl-6 items-center justify-center">
      <div className="mx-auto max-w-[1200px] w-full">
        <div className="grid lg:grid-cols-2 gap-16 gap-x-16 gap-y-16 items-center">
          {/* Text Content */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10%" }}
          >
            <motion.div variants={fadeSlideUp} className="mb-4 inline-block">
              <AnimatedGradientText className="text-xs font-bold uppercase tracking-widest">
                {slackToShippedCopy.eyebrow}
              </AnimatedGradientText>
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-6"
            >
              {slackToShippedCopy.title.start}
              <br />
              <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
                {slackToShippedCopy.title.italic}
              </span>
            </motion.h2>
            <motion.div
              variants={fadeSlideUp}
              className="sm:text-base leading-relaxed text-sm text-gray-600 space-y-6"
            >
              {slackToShippedCopy.paragraphs.map((para, index) => {
                const boldArray = 'bold' in para ? (para as { bold: readonly string[] }).bold : null;
                return (
                  <p key={index}>
                    {boldArray ? (
                      <>
                        {para.text.split(new RegExp(`(${boldArray.join("|")})`)).map((part, i) =>
                          boldArray.includes(part) ? (
                            <span key={i} className="font-serif italic text-black">{part}</span>
                          ) : (
                            part
                          )
                        )}
                      </>
                    ) : (
                      para.text
                    )}
                  </p>
                );
              })}
            </motion.div>

            {/* CTA */}
            <motion.div
              variants={fadeSlideUp}
              className="mt-8 flex flex-wrap gap-4"
            >
              <Link
                href={slackToShippedCopy.cta.href}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-tight rounded-full hover:bg-gray-800 transition-all shadow-lg shadow-[#1a1a1a]/10"
              >
                {slackToShippedCopy.cta.label}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </Link>
            </motion.div>
          </motion.div>

          {/* Visual Representation */}
          <div className="relative bg-gray-50 rounded-2xl border border-gray-100 p-8 shadow-inner overflow-hidden min-h-[400px] flex flex-col justify-between">
            {/* Decorative Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>

            {/* Cards Floating */}
            <motion.div
              className="relative z-10 flex flex-col gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-10%" }}
            >
              {/* Card 1: Input */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: smoothTransition }
                }}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex items-center gap-3 w-[80%] self-start"
              >
                <div className="w-8 h-8 bg-[#1a1a1a] rounded-full flex items-center justify-center text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="h-2 w-16 bg-gray-200 rounded mb-1.5"></div>
                  <div className="h-1.5 w-full bg-gray-100 rounded"></div>
                </div>
              </motion.div>

              {/* Card 2: AI Processing */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: smoothTransition }
                }}
                className="bg-[#9AE83E]/10 rounded-lg p-4 shadow-sm border border-[#9AE83E]/30 flex items-center gap-3 w-[80%] self-center"
              >
                <div className="w-8 h-8 bg-[#9AE83E] rounded-full flex items-center justify-center text-black animate-spin-slow">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-mono text-[#0A0A0A]/70 mb-1">
                    Composer generating...
                  </div>
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1/3 bg-[#9AE83E] rounded-full"></div>
                    <div className="h-1.5 w-1/4 bg-[#9AE83E]/50 rounded-full"></div>
                  </div>
                </div>
              </motion.div>

              {/* Card 3: Human Finish */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: smoothTransition }
                }}
                className="bg-white rounded-lg p-4 shadow-lg border border-gray-200 flex items-center gap-3 w-[85%] self-end"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                    <div className="w-full h-full bg-gray-300" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-900">
                      Landing_Page_v1.fig
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono">
                      47:12
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[95%]"></div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
