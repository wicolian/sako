"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  IconLayout,
  IconPresentation,
  IconAd,
  IconBrandFigma,
  IconBrandWebflow,
  IconBrandFramer,
  IconVideo,
  IconMovie,
  IconBolt,
  IconSparkles,
  IconPalette,
  IconDeviceLaptop,
  IconPlayerPlay,
  IconRefresh,
  IconTemplate,
  IconFolderOpen,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
  IconRocket,
} from "@tabler/icons-react";
import Link from "next/link";
import { externalLinks } from "@/config/landing";

// ============================================================================
// HERO SECTION
// ============================================================================
export function ServicesHero() {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)] opacity-40" />
      
      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600 mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#9AE83E] animate-pulse" />
          Services
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-black tracking-tight leading-[1.1] mb-6">
          What we <span className="font-serif italic font-normal">do</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-4">
          We help in-house teams ship more marketing creative without the chaos.
        </p>
        
        <p className="text-base text-gray-500 max-w-2xl mx-auto">
          Design, web builds, and motion that stays on-brand, moves fast, and doesn't turn into a month of meetings.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// BENTO CARD COMPONENT
// ============================================================================
interface BentoCardProps {
  title: string;
  items?: string[];
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: "default" | "dark" | "lime" | "outlined";
  visual?: React.ReactNode;
}

function BentoCard({ 
  title, 
  items, 
  description, 
  icon, 
  className,
  variant = "default",
  visual
}: BentoCardProps) {
  const baseStyles = "rounded-2xl p-6 transition-all duration-300 group overflow-hidden relative";
  
  const variants = {
    default: "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg",
    dark: "bg-[#1a1a1a] text-white border border-[#1a1a1a]",
    lime: "bg-[#9AE83E] text-black border border-[#9AE83E]",
    outlined: "bg-transparent border-2 border-dashed border-gray-300 hover:border-gray-400",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)}>
      {visual && (
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          {visual}
        </div>
      )}
      <div className="relative z-10">
        {icon && (
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
            variant === "dark" ? "bg-white/10" : variant === "lime" ? "bg-black/10" : "bg-gray-100"
          )}>
            {icon}
          </div>
        )}
        <h3 className={cn(
          "font-semibold text-lg mb-3",
          variant === "dark" ? "text-white" : variant === "lime" ? "text-black" : "text-black"
        )}>
          {title}
        </h3>
        {description && (
          <p className={cn(
            "text-sm leading-relaxed",
            variant === "dark" ? "text-gray-400" : variant === "lime" ? "text-black/70" : "text-gray-600"
          )}>
            {description}
          </p>
        )}
        {items && (
          <ul className="space-y-2 mt-3">
            {items.map((item, i) => (
              <li 
                key={i} 
                className={cn(
                  "text-sm flex items-start gap-2",
                  variant === "dark" ? "text-gray-400" : variant === "lime" ? "text-black/70" : "text-gray-600"
                )}
              >
                <span className={cn(
                  "w-1 h-1 rounded-full mt-2 shrink-0",
                  variant === "dark" ? "bg-[#9AE83E]" : variant === "lime" ? "bg-black" : "bg-[#9AE83E]"
                )} />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION HEADER
// ============================================================================
interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  className?: string;
}

function SectionHeader({ eyebrow, title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-12", className)}>
      <div className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">
        {eyebrow}
      </div>
      <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-tight mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-gray-600 max-w-2xl">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================================================
// CORE DESIGN SECTION
// ============================================================================
export function CoreDesignBento() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionHeader 
          eyebrow="Core Design"
          title="Marketing design that ships"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Marketing Design - Large */}
          <BentoCard
            className="lg:col-span-2 lg:row-span-2"
            title="Marketing design"
            icon={<IconLayout className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Landing pages, pricing pages, web sections",
              "Hero concepts, campaign layouts, signup flow screens",
              "Webinar and event pages, launch pages, feature pages",
              "Comparison pages, release graphics, product update visuals"
            ]}
            visual={
              <div className="absolute right-0 bottom-0 w-64 h-64">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <rect x="20" y="20" width="160" height="100" rx="8" fill="currentColor" opacity="0.1" />
                  <rect x="30" y="30" width="60" height="8" rx="2" fill="currentColor" opacity="0.2" />
                  <rect x="30" y="50" width="100" height="4" rx="2" fill="currentColor" opacity="0.1" />
                  <rect x="30" y="60" width="80" height="4" rx="2" fill="currentColor" opacity="0.1" />
                  <rect x="30" y="80" width="40" height="20" rx="4" fill="currentColor" opacity="0.15" />
                </svg>
              </div>
            }
          />
          
          {/* Pitch + Sales Decks */}
          <BentoCard
            title="Pitch + sales decks"
            icon={<IconPresentation className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Sales decks, investor decks, one-pagers",
              "Case studies, proposal decks, enablement slides",
              "Deck templates your team can reuse"
            ]}
          />
          
          {/* Ads + Social */}
          <BentoCard
            title="Ads + social design"
            icon={<IconAd className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Paid ad creative, organic posts, carousels",
              "Banners, thumbnails, display ads",
              "Variant sets for testing and channel fit"
            ]}
          />
          
          {/* Product Marketing */}
          <BentoCard
            title="Product marketing design"
            icon={<IconRocket className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Feature and solution pages",
              "Launch kits and rollout assets",
              "Competitive comparison visuals"
            ]}
          />
          
          {/* Brand on Rails - Dark */}
          <BentoCard
            className="lg:col-span-2"
            variant="dark"
            title="Brand on rails"
            icon={<IconPalette className="w-5 h-5 text-[#9AE83E]" />}
            description="We apply your existing brand across everything. We don't invent a new identity unless you ask for it."
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// WEB BUILD SECTION
// ============================================================================
export function WebBuildBento() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionHeader 
          eyebrow="Web Build"
          title="Figma to live"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Main platforms */}
          <BentoCard
            className="lg:col-span-2"
            title="Platform builds"
            icon={<IconBrandFigma className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Figma to Webflow",
              "Figma to Framer",
              "Approved Figma designs to Webflow/Framer",
            ]}
            visual={
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-20">
                <IconBrandWebflow className="w-12 h-12" />
                <IconBrandFramer className="w-12 h-12" />
              </div>
            }
          />
          
          {/* Iterations */}
          <BentoCard
            variant="lime"
            title="Landing iterations"
            icon={<IconRefresh className="w-5 h-5 text-black" />}
            description="A/B variants, new sections, performance-focused tweaks"
          />
          
          {/* Implementation */}
          <BentoCard
            title="Implementation help"
            icon={<IconDeviceLaptop className="w-5 h-5 text-[#9AE83E]" />}
            description="Exports, responsive checks, spacing polish, component reuse"
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MOTION + VIDEO SECTION
// ============================================================================
export function MotionVideoBento() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionHeader 
          eyebrow="Motion + Video"
          title="Movement that converts"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Video Editing - Large */}
          <BentoCard
            className="lg:row-span-2"
            variant="dark"
            title="Video editing"
            icon={<IconVideo className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Cutdowns, pacing, captions/subtitles",
              "Transitions, music, b-roll assembly",
              "Social-ready versions across formats"
            ]}
            visual={
              <div className="absolute bottom-0 right-0 w-32 h-32">
                <IconPlayerPlay className="w-full h-full opacity-5" />
              </div>
            }
          />
          
          {/* Short-form */}
          <BentoCard
            title="Short-form content"
            icon={<IconMovie className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Reels/Shorts, ad creatives, product snippets",
              "Hook variants, resizes, caption styles"
            ]}
          />
          
          {/* Motion for Marketing */}
          <BentoCard
            title="Motion for marketing"
            icon={<IconSparkles className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Logo stings, simple kinetic type",
              "UI callouts, social motion assets"
            ]}
          />
          
          {/* Deliverables */}
          <BentoCard
            className="lg:col-span-2"
            variant="outlined"
            title="Deliverables"
            icon={<IconFolderOpen className="w-5 h-5 text-gray-500" />}
            items={[
              "MP4, WebM",
              "GIF exports when needed",
              "Lottie only if explicitly supported"
            ]}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// ONGOING SUPPORT SECTION
// ============================================================================
export function OngoingSupportBento() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionHeader 
          eyebrow="Ongoing Support"
          title="Keep the machine running"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fast Iterations */}
          <BentoCard
            title="Fast iterations"
            icon={<IconBolt className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Make it cleaner",
              "Match the brand",
              "Try 3 variants",
              "Resize for channels"
            ]}
          />
          
          {/* Template Systems */}
          <BentoCard
            variant="lime"
            title="Template systems"
            icon={<IconTemplate className="w-5 h-5 text-black" />}
            items={[
              "Social templates (Figma)",
              "Slide templates (Figma)",
              "Ad template sets for repeat campaigns"
            ]}
          />
          
          {/* Creative Housekeeping */}
          <BentoCard
            title="Creative housekeeping"
            icon={<IconFolderOpen className="w-5 h-5 text-[#9AE83E]" />}
            items={[
              "Organized Figma files",
              "Consistent naming + versioning",
              "Handoff-ready files and clean exports"
            ]}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SCOPE BOUNDARIES SECTION
// ============================================================================
export function ScopeBoundaries() {
  const hardNo = [
    { 
      title: "3D / VFX / heavy animation",
      items: [
        "3D modeling, rendering, CGI",
        "VFX-heavy compositing",
        "Character animation, frame-by-frame, complex rigs",
        "Full animated explainers end-to-end unless explicitly scoped"
      ]
    },
    {
      title: "Print and publication-heavy work",
      items: [
        "Magazine or book layout workflows",
        "Packaging systems, dielines, vendor coordination",
        "InDesign-first, long document production"
      ]
    },
    {
      title: "Highly regulated specialist docs",
      items: [
        "Medical/legal/insurance compliance layouts",
        "Typesetting-heavy compliance formatting"
      ]
    },
    {
      title: "Product and engineering work",
      items: [
        "Full product UX ownership (research, testing, IA)",
        "App development (backend/frontend), QA automation",
        "Anything that's basically product engineering"
      ]
    }
  ];

  const sometimes = [
    "Brand identity from scratch (logo, naming, full guidelines)",
    "Design systems (components, tokens, governance)",
    "Complex illustration styles",
    "Long-form video (10 to 30 min edits, multi-cam)",
    "Advanced motion (heavy After Effects, many scenes)",
    "Print collateral (limited, clearly scoped)"
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Hard No Section */}
        <div className="mb-16">
          <SectionHeader 
            eyebrow="Scope"
            title="What we don't do"
            subtitle="This is how we avoid scope creep and keep shipping."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hardNo.map((category, i) => (
              <div 
                key={i}
                className="bg-white border border-gray-200 rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="absolute top-4 right-4">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                    <IconX className="w-4 h-4 text-red-500" />
                  </div>
                </div>
                <h3 className="font-semibold text-black mb-4 pr-12">{category.title}</h3>
                <ul className="space-y-2">
                  {category.items.map((item, j) => (
                    <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-red-400 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Sometimes Section */}
        <div className="border border-amber-200 rounded-3xl p-8 bg-white">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <IconAlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-black text-lg mb-1">Sometimes (ask first)</h3>
              <p className="text-sm text-gray-600">We can do these when scoped cleanly.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sometimes.map((item, i) => (
              <div 
                key={i}
                className="flex items-start gap-2 bg-white/80 rounded-xl px-4 py-3 text-sm text-gray-700"
              >
                <IconAlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// WEB SCOPE BRIEF SECTION
// ============================================================================
export function WebScopeBrief() {
  const included = [
    "Marketing pages (landing, pricing, features, comparison, about, contact, book-a-call)",
    "Responsive build (desktop/tablet/mobile)",
    "Basic SEO fields (title, meta, OG)",
    "Forms and embeds (Calendly, HubSpot, Typeform, etc.)",
    "Basic interactions (hover, scroll, reveal)",
    "Publish support (staging to live) plus one quick post-publish fix pass"
  ];

  const notIncluded = [
    "Full site migrations (redirect maps, SEO preservation, moving 50+ pages)",
    "Membership/login, gated content, auth flows",
    "Heavy custom code features (calculators, complex scripts, dynamic logic)",
    "Advanced CMS architecture (complex relationships, multi-site setups)",
    "Multi-language/localization systems",
    "Anything that turns into product engineering"
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionHeader 
          eyebrow="Web Build Scope"
          title="What web build means"
          subtitle="Every request must be one of: Page build, Section build, or Component build. If it's bigger, we split it."
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Included */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#9AE83E]/20 flex items-center justify-center">
                <IconCheck className="w-5 h-5 text-[#6B9E2E]" />
              </div>
              <h3 className="font-semibold text-black text-lg">Included</h3>
            </div>
            <ul className="space-y-3">
              {included.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <IconCheck className="w-4 h-4 text-[#9AE83E] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Not Included */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <IconX className="w-5 h-5 text-gray-500" />
              </div>
              <h3 className="font-semibold text-black text-lg">Not included</h3>
            </div>
            <ul className="space-y-3">
              {notIncluded.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <IconX className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Guardrails */}
        <div className="mt-6 bg-[#1a1a1a] text-white rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-4">The guardrails</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <p>
              <span className="text-white font-medium">If it needs custom code, migrations, advanced CMS, multi-language, membership/login, heavy interactions:</span> we split it, extend ETA upfront, or scope it separately.
            </p>
            <p>
              <span className="text-white font-medium">Done means:</span> matches approved layout, responsive works, links/forms work, SEO fields set. Anything else is a new task.
            </p>
            <p>
              <span className="text-white font-medium">New direction equals a new task.</span> A tweak is only a tweak if it doesn't change layout/structure/goal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FASTEST WIN SECTION
// ============================================================================
export function FastestWin() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#9AE83E] rounded-3xl p-8 md:p-12 relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.1)_25%,rgba(0,0,0,0.1)_50%,transparent_50%,transparent_75%,rgba(0,0,0,0.1)_75%)] bg-[size:20px_20px]" />
          </div>
          
          <div className="relative z-10">
            <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-4">
              Week 1 Promise
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-black mb-6">
              Fastest win in week 1
            </h2>
            
            <p className="text-black/80 mb-8">
              What you're promising to marketing teams: Predictable weekly shipping for launches, ads, webinars, and sales enablement. Brand-consistent output. Controlled revisions.
            </p>
            
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6">
              <h3 className="font-semibold text-black mb-4">Ship a campaign kit:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-[#9AE83E] flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  1 landing page refresh (hero, proof, CTA)
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-[#9AE83E] flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  6 to 10 ad/social variants
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-[#9AE83E] flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  2 short motion cutdowns (15 to 30s) with captions
                </li>
              </ul>
              <p className="mt-4 text-sm text-gray-600 pt-4">
                <span className="font-medium">Plus:</span> templates so week 2 is faster.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA SECTION
// ============================================================================
export function ServicesCTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-tight mb-6">
          Ready to <span className="font-serif italic font-normal">ship</span> more?
        </h2>
        <p className="text-gray-600 text-lg max-w-xl mx-auto mb-10">
          Start with one task. See how the system works. Then scale from there.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={externalLinks.app}
            className="group px-8 py-4 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all flex items-center gap-2 shadow-xl shadow-[#9AE83E]/10"
          >
            Start Shipping
            <IconArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/book-a-call"
            className="px-8 py-4 bg-white border border-gray-200 text-sm font-medium rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            Book a call
          </Link>
        </div>
        
        <p className="text-xs text-gray-500 mt-8">
          14-day money-back guarantee • Pause anytime • No long-term contracts
        </p>
      </div>
    </section>
  );
}

