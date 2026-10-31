"use client";

import { ReactNode, useEffect, useState } from "react"
import {
  ArrowRight, Calendar, Download, Star, ChevronLeft, ChevronRight, Check,
  Timer, CreditCard, Layers, Rocket, Presentation, Camera,
  Share, FileText, RefreshCw, Zap, Shield, Users, Clock, CheckCircle,
  MessageSquare, BarChart3, Settings, Sparkles,
  Building, User, Image, Layout, Globe, Video, Code, Target, Paperclip,
  Repeat, Percent, DollarSign, Pause, History, Eye, ImageIcon, Mail,
  Share2, Lightbulb, Palette, TrendingUp, Megaphone, AtSign, Film,
  MessageCircle, Bell, Link as LinkIcon,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { BorderBeam } from "@/components/ui/visuals/border-beam"
import { BentoSceneRenderer, type SceneId } from "@/components/ui/layout/bento-scenes"

interface BentoGridProps {
  children: ReactNode
  className?: string
}

// Content types for rich animations
// NEW: Scene-based animations (v2 - full-height, 3-layer compositions)
type BentoContentType = 
  // V2 Scene-based animations (recommended)
  | { type: 'scene'; id: SceneId; props?: Record<string, unknown> }
  // Legacy animation types (kept for backwards compatibility)
  | { type: 'typing'; text: string }
  | { type: 'countdown'; hours?: number }
  | { type: 'progress'; label?: string }
  | { type: 'notification'; count?: number }
  | { type: 'launch' }
  | { type: 'grid-preview'; count?: number }
  | { type: 'slack-message'; text?: string }
  | { type: 'stack'; items?: number }
  | { type: 'checkmarks'; items?: string[] }
  | { type: 'timer-badge'; value: string }
  | { type: 'metric'; value: string; label?: string }
  | { type: 'terminal'; command?: string }
  // Legacy animation types continued
  | { type: 'calendar'; date?: string; month?: string }
  | { type: 'browser-build' }
  | { type: 'slides'; count?: number }
  | { type: 'scope-checklist' }
  | { type: 'sparkline'; trend?: 'up' | 'down' | 'flat' }
  | { type: 'before-after' }
  | { type: 'figma-frame'; layers?: number }
  | { type: 'code-snippet'; code?: string }
  | { type: 'carousel'; items?: number }
  | { type: 'toggle'; label?: string }
  | { type: 'orbit'; icons?: string[] }
  | { type: 'chat'; messages?: string[] }
  | { type: 'brand-colors'; colors?: string[] }
  | { type: 'download'; filename?: string; format?: string }
  | { type: 'rating'; value?: number }
  // Legacy contextual animation types
  | { type: 'design-tools' }
  | { type: 'email-templates'; count?: number }
  | { type: 'ad-sizes'; sizes?: string[] }
  | { type: 'deck-slides'; count?: number }
  | { type: 'responsive-preview' }

interface BentoCardProps {
  name: string
  className?: string
  background?: ReactNode
  Icon?: React.ElementType
  iconName?: string
  description: string
  href: string
  cta: string
  animation?: 'pulse' | 'glow' | 'wave' | 'none'
  bentoContent?: BentoContentType
}

const _iconMapBento: Record<string, React.ElementType> = {
  Timer, CreditCard, Layers, Rocket, Presentation, Camera,
  Share, FileText, RefreshCw, Zap, Shield, Users, Clock, Check, CheckCircle,
  MessageSquare, BarChart3, Settings, Star, Sparkles,
  Building, User, Image, Layout, Globe, Video, Code, Target, Paperclip,
  Repeat, Percent, DollarSign, Pause, History, Eye, ImageIcon, Mail,
  Share2, Lightbulb, Palette, TrendingUp, Megaphone, AtSign, Film,
  MessageCircle, Bell, Link: LinkIcon,
  // lowercase aliases
  timer: Timer, layers: Layers, shield: Shield, users: Users, clock: Clock,
  zap: Zap, target: Target, bell: Bell, link: LinkIcon, messageSquare: MessageSquare,
  fileText: FileText, history: History, repeat: Repeat, percent: Percent,
  globe: Globe, video: Video, code: Code, image: Image, layout: Layout,
  presentation: Presentation, sparkles: Sparkles, checkCircle: CheckCircle,
  palette: Palette, user: User, paperclip: Paperclip,
};

// Shared transition for micro-animations
const microTransition = {
  ease: "easeInOut" as const,
  duration: 0.4,
}

const BentoGrid = ({ children, className }: BentoGridProps) => {
  return (
    <div
      className={cn(
        // Increased row height from 22rem to 24rem to prevent bottom clipping
        "grid w-full auto-rows-[24rem] grid-cols-1 md:grid-cols-3 gap-4",
        className
      )}
    >
      {children}
    </div>
  )
}

// Typing animation component
function TypingContent({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
        setTimeout(() => {
          setDisplayText("");
          i = 0;
        }, 2000);
      }
    }, 80);

    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => {
      clearInterval(typingInterval);
      clearInterval(cursorInterval);
    };
  }, [text]);

  return (
    <motion.div 
      className="w-full bg-white rounded-xl border border-gray-200 mt-6 shadow-sm p-4 flex flex-col gap-2"
      whileHover={{ scale: 1.02, y: -2 }}
      transition={microTransition}
    >
      <div className="flex items-center gap-2 mb-1 border-b border-gray-100 pb-2">
        <motion.div 
          className="w-2 h-2 rounded-full bg-red-400"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="w-2 h-2 rounded-full bg-yellow-400"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
        <motion.div 
          className="w-2 h-2 rounded-full bg-green-400"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </div>
      <div className="font-mono text-[10px] text-gray-400">New Task:</div>
      <div className="font-mono text-xs text-black relative h-5 overflow-hidden">
        <span>{displayText}</span>
        <span className={cn("inline-block w-0.5 h-4 bg-[#1a1a1a] ml-0.5 align-middle", showCursor ? "opacity-100" : "opacity-0")} />
      </div>
    </motion.div>
  )
}

// Countdown timer component
function CountdownContent({ hours = 48 }: { hours?: number }) {
  const [timeLeft, setTimeLeft] = useState(hours * 3600);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : hours * 3600));
    }, 1000);
    return () => clearInterval(interval);
  }, [hours]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return { h: h.toString().padStart(2, "0"), m: m.toString().padStart(2, "0"), s: s.toString().padStart(2, "0") };
  };

  const time = formatTime(timeLeft);

  return (
    <motion.div 
      className="mt-6 flex items-center gap-3 self-start bg-gray-50 border border-gray-100 rounded-full px-4 py-2"
      whileHover={{ scale: 1.05, borderColor: "#9AE83E" }}
      transition={microTransition}
    >
      <motion.svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-[#9AE83E]"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </motion.svg>
      <div className="flex items-center gap-0.5 text-sm font-mono font-medium text-black tabular-nums tracking-wide">
        <motion.span key={`hours-${time.h}`} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={microTransition}>{time.h}</motion.span>
        <span className="animate-pulse">:</span>
        <motion.span key={`minutes-${time.m}`} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={microTransition}>{time.m}</motion.span>
        <span className="animate-pulse">:</span>
        <motion.span key={`seconds-${time.s}`} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={microTransition}>{time.s}</motion.span>
      </div>
    </motion.div>
  )
}

// Progress bar with scan animation
function ProgressContent({ label = "Processing" }: { label?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 100 ? 0 : prev + 1));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="mt-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={microTransition}
    >
      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wider">
        <span>{label}</span>
        <motion.span 
          className="text-[#9AE83E]"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {progress}%
        </motion.span>
      </div>
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden relative">
        <motion.div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#9AE83E] to-[#7BC62D] rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
        <motion.div 
          className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent"
          animate={{ x: ["-100%", "400%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="h-8 bg-gray-100 rounded"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// Notification badge component
function NotificationContent({ count = 3 }: { count?: number }) {
  return (
    <motion.div 
      className="mt-6 flex items-end justify-center gap-2 h-14 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      <motion.div 
        className="w-10 h-8 bg-gray-50 border border-gray-100 rounded"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div 
        className="w-14 h-10 bg-white border-2 border-[#9AE83E] shadow-md rounded relative z-10 flex items-center justify-center"
        whileHover={{ y: -4, scale: 1.05 }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-6 h-1 bg-gray-100 rounded-full"></div>
        <motion.div 
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {count}
        </motion.div>
      </motion.div>
      <motion.div 
        className="w-10 h-8 bg-gray-100 border border-gray-200 rounded"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
    </motion.div>
  )
}

// Launch button component
function LaunchContent() {
  return (
    <motion.div 
      className="mt-6 self-end relative"
      whileHover={{ y: -8 }}
      transition={microTransition}
    >
      <motion.div 
        className="absolute inset-0 bg-[#9AE83E]/40 rounded-full"
        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="w-12 h-12 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center relative z-10 shadow-lg"
        whileHover={{ backgroundColor: "#9AE83E", color: "#1a1a1a" }}
        transition={microTransition}
      >
        <motion.svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </motion.svg>
      </motion.div>
    </motion.div>
  )
}

// Grid preview component
function GridPreviewContent({ count = 6 }: { count?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % count);
    }, 1500);
    return () => clearInterval(interval);
  }, [count]);

  return (
    <motion.div 
      className="mt-6 grid grid-cols-3 gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "aspect-square rounded-lg border",
            i === activeIndex ? "bg-[#9AE83E]/20 border-[#9AE83E]" : "bg-gray-50 border-gray-100"
          )}
          animate={{ 
            scale: i === activeIndex ? 1.05 : 1,
            borderColor: i === activeIndex ? "#9AE83E" : "#f3f4f6"
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          whileHover={{ scale: 1.1 }}
        >
          {i === activeIndex && (
            <motion.div 
              className="w-full h-full flex items-center justify-center"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={microTransition}
            >
              <div className="w-2 h-2 bg-[#9AE83E] rounded-full" />
            </motion.div>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

// Slack message component
function SlackMessageContent({ text = "New brief submitted" }: { text?: string }) {
  return (
    <motion.div 
      className="mt-6 bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
      transition={microTransition}
    >
      <div className="flex items-start gap-2">
        <motion.div 
          className="w-6 h-6 rounded bg-[#9AE83E] flex items-center justify-center flex-shrink-0"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-[10px] font-bold text-black">S</span>
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-black">Sako</span>
            <span className="text-[10px] text-gray-400">just now</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{text}</p>
        </div>
        <motion.div 
          className="w-2 h-2 bg-[#9AE83E] rounded-full"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  )
}

// Stacking cards component
function StackContent({ items = 3 }: { items?: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <motion.div 
      className="mt-6 relative h-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {[...Array(items)].map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute left-0 right-0 h-12 bg-white border rounded-lg shadow-sm cursor-pointer",
            i === 0 ? "border-[#9AE83E]" : "border-gray-200"
          )}
          style={{ zIndex: items - i }}
          initial={{ y: i * 8, x: i * 4, opacity: 1 - i * 0.2 }}
          animate={{ 
            y: hoveredIndex === i ? i * 8 - 4 : i * 8,
            x: i * 4,
            opacity: 1 - i * 0.2,
            scale: hoveredIndex === i ? 1.02 : 1
          }}
          whileHover={{ y: i * 8 - 4, scale: 1.02 }}
          transition={microTransition}
          onHoverStart={() => setHoveredIndex(i)}
          onHoverEnd={() => setHoveredIndex(null)}
        >
          {i === 0 && (
            <div className="flex items-center gap-2 h-full px-3">
              <motion.div 
                className="w-8 h-1.5 bg-gray-200 rounded-full"
                animate={{ width: ["32px", "40px", "32px"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="w-12 h-1.5 bg-gray-100 rounded-full" />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

// Checkmarks list component
function CheckmarksContent({ items = ["Done", "Done", "Done"] }: { items?: string[] }) {
  return (
    <motion.div 
      className="mt-6 space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {items.slice(0, 3).map((item, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...microTransition, delay: i * 0.15 }}
          whileHover={{ x: 4 }}
        >
          <motion.div 
            className="w-4 h-4 rounded-full bg-[#9AE83E] flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...microTransition, delay: i * 0.15 + 0.1 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </motion.div>
          <span className="text-xs text-gray-600">{item}</span>
        </motion.div>
      ))}
    </motion.div>
  )
}

// Timer badge component
function TimerBadgeContent({ value }: { value: string }) {
  return (
    <motion.div 
      className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-full"
      whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
      transition={microTransition}
    >
      <motion.svg 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#9AE83E" 
        strokeWidth="2"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </motion.svg>
      <motion.span 
        className="text-sm font-mono font-semibold"
        animate={{ opacity: [1, 0.7, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {value}
      </motion.span>
    </motion.div>
  )
}

// Metric display component
function MetricContent({ value, label }: { value: string; label?: string }) {
  return (
    <motion.div 
      className="mt-6 text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={microTransition}
    >
      <motion.div 
        className="text-3xl font-bold text-[#1a1a1a] tabular-nums"
        whileHover={{ color: "#9AE83E", scale: 1.05 }}
        transition={microTransition}
      >
        {value}
      </motion.div>
      {label && (
        <motion.div 
          className="text-xs text-gray-500 mt-1"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...microTransition, delay: 0.1 }}
        >
          {label}
        </motion.div>
      )}
    </motion.div>
  )
}

// Terminal component
function TerminalContent({ command = "npm run ship" }: { command?: string }) {
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setShowCursor(prev => !prev), 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="mt-6 bg-[#1a1a1a] rounded-lg p-3 font-mono text-xs"
      whileHover={{ scale: 1.02 }}
      transition={microTransition}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <motion.div 
          className="w-2 h-2 rounded-full bg-red-400"
          whileHover={{ scale: 1.3 }}
        />
        <motion.div 
          className="w-2 h-2 rounded-full bg-yellow-400"
          whileHover={{ scale: 1.3 }}
        />
        <motion.div 
          className="w-2 h-2 rounded-full bg-green-400"
          whileHover={{ scale: 1.3 }}
        />
      </div>
      <div className="text-gray-400">
        <span className="text-[#9AE83E]">$</span> {command}
        <span className={cn("inline-block w-2 h-3 bg-gray-400 ml-0.5 align-middle", showCursor ? "opacity-100" : "opacity-0")} />
      </div>
    </motion.div>
  )
}

// NEW: Browser build simulation for Webflow/Framer
function BrowserBuildContent() {
  return (
    <motion.div 
      className="mt-6 w-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={microTransition}
    >
      {/* Browser chrome */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded h-5 ml-2" />
      </div>
      {/* Content area */}
      <div className="p-3 space-y-3 relative">
        <motion.div 
          className="h-24 bg-gray-50 rounded border border-dashed border-gray-200 flex items-center justify-center"
          animate={{ borderColor: ["#e5e7eb", "#9AE83E", "#e5e7eb"] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <motion.div 
            className="text-xs text-gray-400 font-mono"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Building...
          </motion.div>
        </motion.div>
        {/* Flying elements */}
        <motion.div 
          className="absolute top-8 left-8 w-8 h-8 bg-blue-100 rounded opacity-0"
          animate={{ x: [0, 40], y: [0, 20], opacity: [0, 1, 0], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        <motion.div 
          className="absolute top-12 right-8 w-12 h-4 bg-purple-100 rounded opacity-0"
          animate={{ x: [0, -30], y: [0, 10], opacity: [0, 1, 0], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
        />
      </div>
    </motion.div>
  )
}

// NEW: Slides visualizer (10 slides)
function SlidesContent({ count = 10 }: { count?: number }) {
  return (
    <motion.div 
      className="mt-6 grid grid-cols-5 gap-1.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "aspect-[4/3] rounded border bg-white shadow-sm flex flex-col gap-0.5 p-0.5",
            i === 0 ? "border-[#9AE83E] ring-1 ring-[#9AE83E]/20" : "border-gray-200"
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          whileHover={{ scale: 1.5, zIndex: 10, y: -10 }}
        >
          <div className="h-1/3 bg-gray-100 rounded-[1px]" />
          <div className="h-full bg-gray-50 rounded-[1px]" />
        </motion.div>
      ))}
    </motion.div>
  )
}

// NEW: Scope checklist visualizer
function ScopeContent() {
  const items = ["Scope defined", "Format set", "Sizes listed"];
  return (
    <motion.div 
      className="mt-6 space-y-2 bg-gray-50/50 rounded-lg p-3 border border-gray-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2"
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.2 }}
        >
          <motion.div 
            className="w-4 h-4 rounded-full bg-[#9AE83E] flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.2 + 0.1, type: "spring" }}
          >
            <Check className="w-2.5 h-2.5 text-black" />
          </motion.div>
          <span className="text-xs text-gray-600">{item}</span>
        </motion.div>
      ))}
    </motion.div>
  )
}

// NEW: Calendar component
function CalendarContent({ date = "15", month = "JAN" }: { date?: string; month?: string }) {
  return (
    <motion.div 
      className="mt-6 flex items-center gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={microTransition}
    >
      <motion.div 
        className="w-14 h-14 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
        whileHover={{ scale: 1.05, borderColor: "#9AE83E" }}
        transition={microTransition}
      >
        <div className="h-4 bg-[#9AE83E] flex items-center justify-center">
          <span className="text-[8px] font-bold text-black uppercase">{month}</span>
        </div>
        <motion.div 
          className="flex-1 flex items-center justify-center py-1.5"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-xl font-bold text-[#1a1a1a]">{date}</span>
        </motion.div>
      </motion.div>
      <div className="flex flex-col gap-1">
        {[1, 2, 3].map((_, i) => (
          <motion.div 
            key={i}
            className={cn("h-1.5 rounded-full", i === 0 ? "w-16 bg-[#9AE83E]" : "bg-gray-200", i === 1 ? "w-12" : "w-8")}
            initial={{ width: 0 }}
            animate={{ width: i === 0 ? 64 : i === 1 ? 48 : 32 }}
            transition={{ ...microTransition, delay: i * 0.1 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// NEW: Sparkline chart component
function SparklineContent({ trend = "up" }: { trend?: 'up' | 'down' | 'flat' }) {
  const paths = {
    up: "M 0 20 Q 10 18, 20 15 T 40 10 T 60 5 T 80 3",
    down: "M 0 5 Q 10 8, 20 12 T 40 16 T 60 18 T 80 20",
    flat: "M 0 12 Q 10 10, 20 14 T 40 11 T 60 13 T 80 12"
  };

  return (
    <motion.div 
      className="mt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      <div className="flex items-end justify-between mb-2">
        <motion.span 
          className={cn("text-2xl font-bold", trend === "up" ? "text-[#9AE83E]" : trend === "down" ? "text-red-500" : "text-gray-600")}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {trend === "up" ? "+24%" : trend === "down" ? "-12%" : "0%"}
        </motion.span>
        <span className="text-[10px] text-gray-400 uppercase">This week</span>
      </div>
      <motion.svg 
        viewBox="0 0 80 24" 
        className="w-full h-12"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
      >
        <motion.path
          d={paths[trend]}
          fill="none"
          stroke={trend === "up" ? "#9AE83E" : trend === "down" ? "#ef4444" : "#9ca3af"}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        <motion.circle 
          cx="80" 
          cy={trend === "up" ? "3" : trend === "down" ? "20" : "12"} 
          r="3" 
          fill={trend === "up" ? "#9AE83E" : trend === "down" ? "#ef4444" : "#9ca3af"}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.svg>
    </motion.div>
  )
}

// NEW: Before/After comparison slider
function BeforeAfterContent() {
  const [position, setPosition] = useState(50);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(prev => prev === 30 ? 70 : 30);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="mt-6 relative h-20 bg-gray-100 rounded-lg overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {/* Before side */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
        <span className="text-[10px] font-mono text-gray-500 uppercase">Before</span>
      </div>
      {/* After side */}
      <motion.div 
        className="absolute inset-y-0 left-0 bg-[#9AE83E]/20 flex items-center justify-center overflow-hidden"
        animate={{ width: `${position}%` }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <span className="text-[10px] font-mono text-[#1a1a1a] uppercase whitespace-nowrap">After</span>
      </motion.div>
      {/* Slider handle */}
      <motion.div 
        className="absolute inset-y-0 w-1 bg-[#9AE83E] shadow-lg"
        animate={{ left: `${position}%` }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#9AE83E] rounded-full flex items-center justify-center">
          <ChevronLeft className="w-2 h-2 text-gray-400" />
          <ChevronRight className="w-2 h-2 text-gray-400" />
        </div>
      </motion.div>
    </motion.div>
  )
}

// NEW: Figma frame preview
function FigmaFrameContent({ layers = 3 }: { layers?: number }) {
  return (
    <motion.div 
      className="mt-6 bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
      whileHover={{ borderColor: "#9AE83E" }}
      transition={microTransition}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
        <div className="w-3 h-3 rounded bg-purple-500" />
        <span className="text-[10px] font-medium text-gray-600">Frame 1</span>
      </div>
      <div className="space-y-1.5">
        {[...Array(layers)].map((_, i) => (
          <motion.div 
            key={i}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...microTransition, delay: i * 0.1 }}
            whileHover={{ x: 4, backgroundColor: "rgba(154, 232, 62, 0.1)" }}
          >
            <div className={cn("w-2 h-2 rounded-sm", i === 0 ? "bg-[#9AE83E]" : i === 1 ? "bg-blue-400" : "bg-orange-400")} />
            <div className="h-1.5 flex-1 bg-gray-100 rounded" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// NEW: Code snippet component
function CodeSnippetContent({ code = "const ship = () => 🚀" }: { code?: string }) {
  return (
    <motion.div 
      className="mt-6 bg-[#1a1a1a] rounded-lg p-3 font-mono text-[10px] overflow-hidden"
      whileHover={{ scale: 1.02 }}
      transition={microTransition}
    >
      <div className="flex items-center gap-1 mb-2 text-gray-500">
        <span className="text-blue-400">const</span>
        <span className="text-[#9AE83E]">sako</span>
        <span className="text-white">=</span>
        <span className="text-orange-400">{`{`}</span>
      </div>
      <motion.div 
        className="pl-3 text-gray-300"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        speed: <span className="text-[#9AE83E]">&quot;48h&quot;</span>,
      </motion.div>
      <div className="pl-3 text-gray-300">
        quality: <span className="text-[#9AE83E]">&quot;premium&quot;</span>
      </div>
      <div className="text-orange-400">{`}`}</div>
    </motion.div>
  )
}

// NEW: Carousel component
function CarouselContent({ items = 4 }: { items?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % items);
    }, 2000);
    return () => clearInterval(interval);
  }, [items]);

  return (
    <motion.div 
      className="mt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      <div className="flex gap-2 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {[...Array(3)].map((_, i) => {
            const index = (activeIndex + i) % items;
            return (
              <motion.div
                key={`${activeIndex}-${i}`}
                className={cn(
                  "w-16 h-12 rounded-lg border flex-shrink-0 flex items-center justify-center",
                  i === 0 ? "bg-[#9AE83E]/20 border-[#9AE83E]" : "bg-gray-50 border-gray-200"
                )}
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: i === 0 ? 1 : 0.6, x: 0, scale: i === 0 ? 1 : 0.9 }}
                exit={{ opacity: 0, x: -50, scale: 0.8 }}
                transition={microTransition}
              >
                <span className="text-xs font-mono text-gray-500">{index + 1}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-1 mt-2">
        {[...Array(items)].map((_, i) => (
          <motion.div
            key={i}
            className={cn("w-1.5 h-1.5 rounded-full", i === activeIndex ? "bg-[#9AE83E]" : "bg-gray-300")}
            animate={{ scale: i === activeIndex ? 1.2 : 1 }}
            transition={microTransition}
          />
        ))}
      </div>
    </motion.div>
  )
}

// NEW: Toggle switch component
function ToggleContent({ label = "Feature" }: { label?: string }) {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setIsOn(prev => !prev), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="mt-6 flex items-center justify-between"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      <span className="text-sm text-gray-600">{label}</span>
      <motion.div 
        className={cn("w-12 h-6 rounded-full p-1 cursor-pointer", isOn ? "bg-[#9AE83E]" : "bg-gray-300")}
        role="switch"
        aria-checked={isOn}
        aria-label={`${label} toggle`}
        tabIndex={0}
        animate={{ backgroundColor: isOn ? "#9AE83E" : "#d1d5db" }}
        transition={microTransition}
        onClick={() => setIsOn(!isOn)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOn(!isOn);
          }
        }}
      >
        <motion.div 
          className="w-4 h-4 bg-white rounded-full shadow"
          animate={{ x: isOn ? 24 : 0 }}
          transition={microTransition}
        />
      </motion.div>
    </motion.div>
  )
}

// NEW: Orbit animation component
function OrbitContent() {
  return (
    <motion.div 
      className="mt-6 relative h-20 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {/* Center hub */}
      <motion.div 
        className="w-8 h-8 bg-[#1a1a1a] rounded-full flex items-center justify-center z-10"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-[10px] font-bold text-white">S</span>
      </motion.div>
      {/* Orbit path */}
      <div className="absolute w-16 h-16 border border-dashed border-gray-200 rounded-full" />
      {/* Orbiting icons */}
      {[0, 120, 240].map((deg, i) => (
        <motion.div
          key={i}
          className="absolute w-4 h-4 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center"
          animate={{ 
            rotate: 360,
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear", delay: i * 0.5 }}
          style={{ 
            transformOrigin: "32px 32px",
            left: "calc(50% - 8px)",
            top: "calc(50% - 40px)"
          }}
        >
          <div className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-[#9AE83E]" : i === 1 ? "bg-blue-400" : "bg-purple-400")} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// NEW: Chat bubbles component
function ChatContent({ messages = ["Hey!", "New brief ready", "Shipped ✓"] }: { messages?: string[] }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount(prev => (prev >= messages.length ? 0 : prev + 1));
    }, 1500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <motion.div 
      className="mt-6 space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {messages.slice(0, visibleCount).map((msg, i) => (
        <motion.div
          key={i}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs max-w-[80%]",
            i % 2 === 0 ? "bg-gray-100 text-gray-600 mr-auto" : "bg-[#9AE83E] text-black ml-auto"
          )}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={microTransition}
        >
          {msg}
        </motion.div>
      ))}
    </motion.div>
  )
}

// NEW: Brand colors component
function BrandColorsContent({ colors = ["#9AE83E", "#1a1a1a", "#3b82f6", "#f59e0b"] }: { colors?: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % colors.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [colors.length]);

  return (
    <motion.div 
      className="mt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      <div className="flex gap-2 justify-center">
        {colors.slice(0, 4).map((color, i) => (
          <motion.div
            key={i}
            className="w-8 h-8 rounded-lg shadow-sm border border-white/20"
            style={{ backgroundColor: color }}
            animate={{ 
              scale: i === activeIndex ? 1.2 : 1,
              y: i === activeIndex ? -4 : 0
            }}
            whileHover={{ scale: 1.15, y: -2 }}
            transition={microTransition}
          />
        ))}
      </div>
      <motion.div 
        className="text-center mt-2 text-[10px] font-mono text-gray-500"
        key={activeIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={microTransition}
      >
        {colors[activeIndex]}
      </motion.div>
    </motion.div>
  )
}

// NEW: Download file component
function DownloadContent({ filename = "design_v2", format = "fig" }: { filename?: string; format?: string }) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setIsComplete(true);
          setTimeout(() => {
            setProgress(0);
            setIsComplete(false);
          }, 2000);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="mt-6 bg-white border border-gray-200 rounded-lg p-3"
      whileHover={{ borderColor: "#9AE83E" }}
      transition={microTransition}
    >
      <div className="flex items-center gap-3">
        <motion.div 
          className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isComplete ? "bg-[#9AE83E]" : "bg-gray-100")}
          animate={{ scale: isComplete ? [1, 1.1, 1] : 1 }}
          transition={microTransition}
        >
          <Download className={cn("w-5 h-5", isComplete ? "text-black" : "text-gray-500")} />
        </motion.div>
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-800 truncate">{filename}.{format}</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[#9AE83E] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{isComplete ? "Done!" : `${progress}%`}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// NEW: Rating stars component
function RatingContent({ value = 5 }: { value?: number }) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  return (
    <motion.div 
      className="mt-6 flex items-center justify-center gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.div
          key={star}
          onHoverStart={() => setHoveredStar(star)}
          onHoverEnd={() => setHoveredStar(null)}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...microTransition, delay: star * 0.1 }}
        >
          <motion.div
            animate={{ 
              scale: hoveredStar && star <= hoveredStar ? 1.2 : 1,
              rotate: star <= value ? [0, 10, -10, 0] : 0
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Star 
              className={cn(
                "w-5 h-5",
                star <= (hoveredStar || value) ? "text-[#9AE83E] fill-[#9AE83E]" : "text-gray-300"
              )}
            />
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  )
}

// NEW: Design tools (Figma → Webflow/Framer) animation
function DesignToolsContent() {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="mt-6 flex items-center justify-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {/* Figma */}
      <motion.div 
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border transition-all",
          step >= 0 ? "bg-[#1a1a1a] border-[#9AE83E]" : "bg-gray-100 border-gray-200"
        )}
        animate={{ scale: step === 0 ? 1.1 : 1, y: step === 0 ? -2 : 0 }}
        transition={microTransition}
      >
        <svg width="20" height="20" viewBox="0 0 38 57" fill="none">
          <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
          <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
          <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
          <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
          <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
        </svg>
      </motion.div>
      
      {/* Arrow */}
      <motion.div 
        className="flex flex-col items-center"
        animate={{ opacity: step >= 1 ? 1 : 0.3 }}
        transition={microTransition}
      >
        <motion.svg 
          width="24" height="12" viewBox="0 0 24 12" 
          className="text-[#9AE83E]"
          animate={{ x: step === 1 ? [0, 4, 0] : 0 }}
          transition={{ duration: 0.8, repeat: step === 1 ? Infinity : 0 }}
        >
          <path d="M0 6H20M20 6L14 1M20 6L14 11" stroke="currentColor" strokeWidth="2" fill="none"/>
        </motion.svg>
        <span className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider">Build</span>
      </motion.div>
      
      {/* Webflow/Framer icons */}
      <motion.div 
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border transition-all",
          step >= 2 ? "bg-[#1a1a1a] border-[#9AE83E]" : "bg-gray-100 border-gray-200"
        )}
        animate={{ scale: step === 2 ? 1.1 : 1, y: step === 2 ? -2 : 0 }}
        transition={microTransition}
      >
        {step === 2 ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#4353FF" strokeWidth="2" fill="none"/>
              <path d="M2 17L12 22L22 17" stroke="#4353FF" strokeWidth="2" fill="none"/>
              <path d="M2 12L12 17L22 12" stroke="#4353FF" strokeWidth="2" fill="none"/>
            </svg>
          </motion.div>
        ) : (
          <div className="w-5 h-5 bg-gray-300 rounded" />
        )}
      </motion.div>
    </motion.div>
  )
}

// NEW: Email templates grid
function EmailTemplatesContent({ count = 4 }: { count?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % count);
    }, 1800);
    return () => clearInterval(interval);
  }, [count]);

  return (
    <motion.div 
      className="mt-6 grid grid-cols-2 gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "aspect-[4/5] rounded-lg border bg-white shadow-sm overflow-hidden flex flex-col",
            i === activeIndex ? "border-[#9AE83E] ring-1 ring-[#9AE83E]/30" : "border-gray-200"
          )}
          animate={{ 
            scale: i === activeIndex ? 1.05 : 1,
            y: i === activeIndex ? -2 : 0
          }}
          transition={microTransition}
        >
          {/* Email header */}
          <div className="h-4 bg-gray-100 flex items-center gap-1 px-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          </div>
          {/* Email body */}
          <div className="flex-1 p-1.5 space-y-1">
            <div className="h-3 bg-[#9AE83E]/30 rounded-sm" />
            <div className="h-1 bg-gray-100 rounded-sm w-3/4" />
            <div className="h-1 bg-gray-100 rounded-sm w-1/2" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}

// NEW: Ad sizes visualization
function AdSizesContent({ sizes = ["1080×1080", "1200×628", "1080×1920"] }: { sizes?: string[] }) {
  const [activeSize, setActiveSize] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSize(prev => (prev + 1) % sizes.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [sizes.length]);

  const aspectRatios = [
    { w: 1, h: 1, label: "Square" },
    { w: 1.91, h: 1, label: "Landscape" },
    { w: 9, h: 16, label: "Story" }
  ];

  return (
    <motion.div 
      className="mt-6 flex items-end justify-center gap-3 h-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {aspectRatios.map((ratio, i) => {
        const height = i === 2 ? 64 : i === 0 ? 40 : 28;
        const width = i === 2 ? 36 : i === 0 ? 40 : 54;
        return (
          <motion.div
            key={i}
            className={cn(
              "rounded-lg border flex items-center justify-center",
              i === activeSize ? "bg-[#9AE83E]/20 border-[#9AE83E]" : "bg-gray-50 border-gray-200"
            )}
            style={{ width, height }}
            animate={{ 
              scale: i === activeSize ? 1.1 : 1,
              y: i === activeSize ? -4 : 0
            }}
            transition={microTransition}
          >
            <span className="text-[8px] font-mono text-gray-500">{i + 1}</span>
          </motion.div>
        );
      })}
    </motion.div>
  )
}

// NEW: Deck slides visualization (better than metric)
function DeckSlidesContent({ count = 10 }: { count?: number }) {
  const [activeSlide, setActiveSlide] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % count);
    }, 800);
    return () => clearInterval(interval);
  }, [count]);

  return (
    <motion.div 
      className="mt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      {/* Preview area */}
      <motion.div 
        className="aspect-[16/10] bg-white border border-gray-200 rounded-lg shadow-sm mb-3 p-2 flex flex-col"
        animate={{ borderColor: ["#e5e7eb", "#9AE83E", "#e5e7eb"] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="h-3 bg-[#9AE83E]/40 rounded-sm mb-2" />
        <div className="flex-1 flex gap-2">
          <div className="w-1/2 bg-gray-100 rounded-sm" />
          <div className="w-1/2 space-y-1">
            <div className="h-1.5 bg-gray-100 rounded-sm" />
            <div className="h-1.5 bg-gray-100 rounded-sm w-3/4" />
            <div className="h-1.5 bg-gray-100 rounded-sm w-1/2" />
          </div>
        </div>
      </motion.div>
      
      {/* Slide thumbnails */}
      <div className="flex gap-1 justify-center">
        {[...Array(Math.min(count, 8))].map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "w-4 h-3 rounded-sm border",
              i === activeSlide ? "bg-[#9AE83E] border-[#9AE83E]" : "bg-gray-100 border-gray-200"
            )}
            animate={{ scale: i === activeSlide ? 1.2 : 1 }}
            transition={microTransition}
          />
        ))}
        {count > 8 && (
          <span className="text-[8px] text-gray-400 ml-1">+{count - 8}</span>
        )}
      </div>
    </motion.div>
  )
}

// NEW: Responsive preview (desktop → tablet → mobile)
function ResponsivePreviewContent() {
  const [device, setDevice] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDevice(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const devices = [
    { width: 80, height: 50, label: "Desktop", icon: "🖥️" },
    { width: 60, height: 45, label: "Tablet", icon: "📱" },
    { width: 35, height: 55, label: "Mobile", icon: "📱" }
  ];

  return (
    <motion.div 
      className="mt-6 flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={microTransition}
    >
      <div className="flex items-end justify-center gap-3 h-16">
        {devices.map((d, i) => (
          <motion.div
            key={i}
            className={cn(
              "rounded-lg border-2 bg-white shadow-sm flex items-center justify-center",
              i === device ? "border-[#9AE83E]" : "border-gray-200"
            )}
            style={{ width: d.width, height: d.height }}
            animate={{ 
              scale: i === device ? 1.1 : 0.9,
              opacity: i === device ? 1 : 0.4,
              y: i === device ? -4 : 0
            }}
            transition={microTransition}
          >
            {i === device && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs"
              >
                ✓
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
      <motion.span 
        className="text-[10px] text-gray-500 mt-2"
        key={device}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {devices[device].label}
      </motion.span>
    </motion.div>
  )
}

// Render bento content based on type
function renderBentoContent(content: BentoContentType) {
  switch (content.type) {
    // V2 Scene-based animations (recommended - full-height, 3-layer compositions)
    case 'scene':
      return <BentoSceneRenderer id={content.id} props={content.props} />;
    
    // Legacy animation types (kept for backwards compatibility)
    case 'typing':
      return <TypingContent text={content.text} />;
    case 'countdown':
      return <CountdownContent hours={content.hours} />;
    case 'progress':
      return <ProgressContent label={content.label} />;
    case 'notification':
      return <NotificationContent count={content.count} />;
    case 'launch':
      return <LaunchContent />;
    case 'grid-preview':
      return <GridPreviewContent count={content.count} />;
    case 'slack-message':
      return <SlackMessageContent text={content.text} />;
    case 'stack':
      return <StackContent items={content.items} />;
    case 'checkmarks':
      return <CheckmarksContent items={content.items} />;
    case 'timer-badge':
      return <TimerBadgeContent value={content.value} />;
    case 'metric':
      return <MetricContent value={content.value} label={content.label} />;
    case 'terminal':
      return <TerminalContent command={content.command} />;
    case 'browser-build':
      return <BrowserBuildContent />;
    case 'slides':
      return <SlidesContent count={content.count} />;
    case 'scope-checklist':
      return <ScopeContent />;
    // New animation types
    case 'calendar':
      return <CalendarContent date={content.date} month={content.month} />;
    case 'sparkline':
      return <SparklineContent trend={content.trend} />;
    case 'before-after':
      return <BeforeAfterContent />;
    case 'figma-frame':
      return <FigmaFrameContent layers={content.layers} />;
    case 'code-snippet':
      return <CodeSnippetContent code={content.code} />;
    case 'carousel':
      return <CarouselContent items={content.items} />;
    case 'toggle':
      return <ToggleContent label={content.label} />;
    case 'orbit':
      return <OrbitContent />;
    case 'chat':
      return <ChatContent messages={content.messages} />;
    case 'brand-colors':
      return <BrandColorsContent colors={content.colors} />;
    case 'download':
      return <DownloadContent filename={content.filename} format={content.format} />;
    case 'rating':
      return <RatingContent value={content.value} />;
    // New contextual types
    case 'design-tools':
      return <DesignToolsContent />;
    case 'email-templates':
      return <EmailTemplatesContent count={content.count} />;
    case 'ad-sizes':
      return <AdSizesContent sizes={content.sizes} />;
    case 'deck-slides':
      return <DeckSlidesContent count={content.count} />;
    case 'responsive-preview':
      return <ResponsivePreviewContent />;
    default:
      return null;
  }
}

const BentoCard = ({
  name,
  className,
  background,
  Icon: IconProp,
  iconName,
  description,
  href,
  cta,
  animation = 'none',
  bentoContent,
}: BentoCardProps) => {
  const Icon = IconProp ?? (iconName ? (_iconMapBento[iconName] ?? Zap) : Zap);
  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    className={cn(
      "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-2xl",
      // Light styles with brand colors
      "bg-white border border-gray-100",
      "[box-shadow:0_0_0_1px_rgba(0,0,0,.02),0_2px_4px_rgba(0,0,0,.04),0_8px_24px_rgba(0,0,0,.06)]",
      "hover:shadow-xl hover:shadow-[#9AE83E]/10 transition-all duration-300",
      className
    )}
    whileHover={{ y: -4 }}
  >
    {/* Subtle border beam on hover - only visible on hover for performance */}
    <BorderBeam 
      size={80}
      duration={8}
      colorFrom="#9AE83E"
      colorTo="#6DB827"
      borderWidth={1}
      className="opacity-0 group-hover:opacity-100 transition-opacity duration-500"
    />
    
    {/* Animated background */}
    <div className="absolute inset-0 overflow-hidden">
      {background}
      {/* Default gradient animation if no background */}
      {!background && (
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-[#9AE83E]/5 via-transparent to-blue-50/30"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      )}
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:20px_20px] opacity-[0.15] [mask-image:linear-gradient(to_bottom,black_30%,transparent_100%)]" />
    </div>

    {/* Content */}
    <div className="relative p-6 flex flex-col h-full z-10">
      <motion.div 
        className="pointer-events-none flex transform-gpu flex-col gap-2"
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <motion.div 
          className="w-12 h-12 rounded-xl bg-[#1a1a1a] text-white flex items-center justify-center"
          whileHover={{ backgroundColor: "#9AE83E", color: "#1a1a1a", scale: 1.05, rotate: 5 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Icon className="h-5 w-5" />
        </motion.div>
        <h3 className="text-lg font-semibold text-black mt-3">
          {name}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      </motion.div>

      {/* Rich animation content - with safe area for bottom elements */}
      {bentoContent && (
        <div className={cn(
          "flex-1 flex flex-col min-h-0 mt-3",
          // Scene-based animations fill the card, legacy animations stay at bottom
          bentoContent.type === 'scene' ? "justify-stretch overflow-visible" : "justify-end"
        )}>
          {renderBentoContent(bentoContent)}
        </div>
      )}

      {/* CTA - visible on mobile, hidden on hover for desktop */}
      {cta && !bentoContent && (
        <motion.div 
          className="pointer-events-none flex w-full transform-gpu flex-row items-center pt-4 mt-auto"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut", delay: 0.2 }}
        >
          <Link
            href={href}
            className="pointer-events-auto inline-flex items-center gap-1.5 text-sm font-semibold text-black hover:text-[#9AE83E] transition-colors"
          >
            {cta}
            <motion.span
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ArrowRight className="h-4 w-4" />
            </motion.span>
          </Link>
        </motion.div>
      )}
    </div>

    {/* Hover overlay */}
    <motion.div 
      className="pointer-events-none absolute inset-0"
      initial={{ backgroundColor: "rgba(154, 232, 62, 0)" }}
      whileHover={{ backgroundColor: "rgba(154, 232, 62, 0.02)" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    />
  </motion.div>
  );
}

export { BentoCard, BentoGrid }
export type { BentoContentType }
