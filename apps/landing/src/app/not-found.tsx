"use client";

import Link from "next/link";
import { motion } from "motion/react";
import Image from "next/image";
import { Particles } from "@/components/ui/visuals/particles";
import { SparklesText } from "@/components/ui/visuals/sparkles-text";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Particles background - subtle lime particles */}
      <Particles
        className="absolute inset-0 z-0"
        quantity={50}
        color="#9AE83E"
        size={0.5}
        staticity={30}
        ease={80}
      />
      
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#9AE83E]/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#9AE83E]/3 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Animated grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:60px_60px] opacity-30 z-0" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <Image
            src="/sako.svg"
            alt="Sako"
            width={80}
            height={80}
            className="drop-shadow-[0_0_30px_rgba(154,232,62,0.3)]"
          />
        </motion.div>

        {/* 404 Text with Sparkles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-4"
        >
          <SparklesText 
            className="text-[120px] sm:text-[180px] font-bold tracking-tighter text-white leading-none select-none"
            sparklesCount={12}
            colors={{ first: "#9AE83E", second: "#FFFFFF" }}
          >
            404
          </SparklesText>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            Page not found
          </h2>
          <p className="text-neutral-500 max-w-md">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 items-center"
        >
          <Link
            href="/"
            className="group relative px-8 py-3.5 bg-[#9AE83E] text-black text-sm font-semibold rounded-full hover:bg-[#8BD835] transition-all shadow-lg shadow-[#9AE83E]/20 flex items-center gap-2 overflow-hidden"
          >
            {/* Shimmer effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative">Back to Home</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="relative group-hover:translate-x-0.5 transition-transform"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="https://cal.com/your-handle/intro-call"
            className="px-8 py-3.5 text-neutral-400 text-sm font-medium hover:text-white transition-colors flex items-center gap-2"
          >
            Contact Support
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </Link>
        </motion.div>
      </motion.div>

      {/* Bottom brand accent */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#9AE83E] to-transparent origin-center"
      />
    </div>
  );
}

