import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { patterns } from "@/lib/design-tokens";
import { PointerHighlight } from "@/components/ui/visuals/pointer-highlight";
import { AnimatedGradientText } from "@/components/ui/animations/animated-gradient-text";
import { ShimmerButton } from "@/components/ui/buttons/shimmer-button";
import { HeroScene } from "./HeroScene";
import type { HeroSceneId } from "./hero-scenes";

interface HeroProps {
  variant?: 'centered' | 'split' | 'minimal';
  badge?: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  tertiaryLink?: { label: string; href: string };
  trustText?: string;
  image?: string;
  scene?: HeroSceneId;
}

// Parse {italic} markers in title
function parseTitle(title: string) {
  const parts = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  let lastIndex = 0;
  
  while ((match = regex.exec(title)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: title.slice(lastIndex, match.index), italic: false });
    }
    parts.push({ text: match[1], italic: true });
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < title.length) {
    parts.push({ text: title.slice(lastIndex), italic: false });
  }
  
  return parts.length > 0 ? parts : [{ text: title, italic: false }];
}

function CTALink({ href, className, children, style }: { href: string; className: string; children: React.ReactNode; style?: React.CSSProperties }) {
  if (href.startsWith('http')) {
    return <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  if (href.startsWith('#')) {
    return <a href={href} className={className} style={style}>{children}</a>;
  }
  return <Link href={href} className={className} style={style}>{children}</Link>;
}

export function Hero({
  variant = 'centered',
  badge,
  eyebrow,
  title = '',
  subtitle = '',
  primaryCta,
  secondaryCta,
  tertiaryLink,
  trustText,
  scene,
}: HeroProps) {
  const titleParts = parseTitle(title);
  
  if (variant === 'minimal') {
    return (
      <section className={patterns.sectionTight}>
        <div className={patterns.container}>
          <h1 className={`${patterns.heading3} mb-4`}>
            {titleParts.map((part, i) =>
              part.italic ? (
                <PointerHighlight key={i}  pointerClassName="text-[#9AE83E]">
                  <span className={patterns.serifItalic}>{part.text}</span>
                </PointerHighlight>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </h1>
          <p className={`${patterns.subtitle} max-w-2xl mb-8`}>{subtitle}</p>
          <div className="flex flex-wrap gap-4">
            {primaryCta && (
            <CTALink href={primaryCta.href} className="">
              <ShimmerButton
                shimmerColor="#9AE83E"
                shimmerSize="0.05em"
                shimmerDuration="3s"
                background="rgba(26, 26, 26, 1)"
                className="group text-white text-sm font-semibold flex items-center gap-2 px-8 py-3.5 shadow-xl shadow-[#9AE83E]/20"
              >
                {primaryCta.label}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="group-hover:translate-x-1 transition-transform"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </ShimmerButton>
            </CTALink>
            )}
            {secondaryCta && (
              <CTALink
                href={secondaryCta.href}
                className="px-8 py-3.5 bg-white border border-gray-200 text-sm font-medium rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                {secondaryCta.label}
              </CTALink>
            )}
          </div>
        </div>
      </section>
    );
  }
  
  if (variant === 'split') {
    return (
      <section className="min-h-[80vh] flex flex-col justify-center py-24 px-6">
        <div className={patterns.containerWide}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="md:max-w-[600px]">
              {/* Eyebrow */}
              {eyebrow && (
                <div className="mb-6 animate-fade-in">
                  <div className="inline-flex items-center gap-2.5 rounded-full border border-gray-200/80 bg-white/70 backdrop-blur-sm px-4 py-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#9AE83E] animate-pulse" />
                    <AnimatedGradientText className="text-[10px] font-bold uppercase tracking-[0.15em]">
                      {eyebrow}
                    </AnimatedGradientText>
                    <ChevronRight className="h-3 w-3 text-gray-400" />
                  </div>
                </div>
              )}
              {/* Legacy badge support */}
              {!eyebrow && badge && (
                <span className={`${patterns.eyebrow} mb-6`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]"></span>
                  {badge}
                </span>
              )}
              <h1 className="text-4xl sm:text-5xl font-semibold text-black tracking-tight leading-[1.1] mb-6">
                {titleParts.map((part, i) =>
                  part.italic ? (
                    <PointerHighlight key={i}  pointerClassName="text-[#9AE83E]">
                      <span className={`${patterns.serifItalic}`}>{part.text}</span>
                    </PointerHighlight>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </h1>
              <p className={`${patterns.subtitle} mb-8 max-w-lg`}>{subtitle}</p>
              <div className="flex flex-wrap gap-4">
                {primaryCta && (
                <CTALink
                  href={primaryCta.href}
                  className="group px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 hover:scale-105 transition-all shadow-xl shadow-[#9AE83E]/10 flex items-center gap-2"
                >
                  {primaryCta.label}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="group-hover:translate-x-1 transition-transform"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </CTALink>
                )}
                {secondaryCta && (
                  <CTALink
                    href={secondaryCta.href}
                    className="px-8 py-3.5 bg-white border border-gray-200 text-sm font-medium rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    {secondaryCta.label}
                  </CTALink>
                )}
              </div>
              {trustText && (
                <p className="mt-6 text-xs text-gray-400">{trustText}</p>
              )}
            </div>
            <div className="relative bg-[#0A0A0A] rounded-3xl border border-[#222] h-[400px] md:h-[500px] w-full overflow-hidden shadow-2xl">
              {scene ? (
                <HeroScene sceneId={scene} />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] opacity-30 rounded-3xl"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                    Visual placeholder
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  // Default: centered variant
  return (
    <section className="min-h-screen flex flex-col items-center justify-center py-24 px-6">
      <div className={`${patterns.container} text-center`}>
        {/* Eyebrow */}
        {eyebrow && (
          <div className="mb-6 animate-fade-in">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-gray-200/80 bg-white/70 backdrop-blur-sm px-4 py-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9AE83E] animate-pulse" />
              <AnimatedGradientText className="text-[10px] font-bold uppercase tracking-[0.15em]">
                {eyebrow}
              </AnimatedGradientText>
              <ChevronRight className="h-3 w-3 text-gray-400" />
            </div>
          </div>
        )}
        {/* Legacy badge support */}
        {!eyebrow && badge && (
          <span className={`${patterns.eyebrow} mb-6 animate-fade-in`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]"></span>
            {badge}
          </span>
        )}
        <h1 className={`${patterns.heading1} mb-8 animate-fade-in`} style={{ animationDelay: '0.1s' }}>
          {titleParts.map((part, i) =>
            part.italic ? (
              <PointerHighlight key={i}  pointerClassName="text-[#9AE83E]">
                <span className={`${patterns.serifItalic}`}>{part.text}</span>
              </PointerHighlight>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {subtitle}
        </p>
        <div className="flex flex-wrap justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {primaryCta && (
            <CTALink href={primaryCta.href} className="">
              <ShimmerButton
                shimmerColor="#9AE83E"
                shimmerSize="0.05em"
                shimmerDuration="3s"
                background="rgba(26, 26, 26, 1)"
                className="group text-white text-sm font-semibold flex items-center gap-2 px-8 py-3.5 shadow-xl shadow-[#9AE83E]/20"
              >
                {primaryCta.label}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="group-hover:translate-x-1 transition-transform"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </ShimmerButton>
            </CTALink>
          )}
          {secondaryCta && (
            <CTALink
              href={secondaryCta.href}
              className="px-8 py-3.5 bg-white border border-gray-200 text-sm font-medium rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              {secondaryCta.label}
            </CTALink>
          )}
        </div>
        {tertiaryLink && (
          <CTALink
            href={tertiaryLink.href}
            className="inline-flex items-center gap-2 mt-6 text-sm text-gray-500 hover:text-black transition-colors animate-fade-in"
            style={{ animationDelay: '0.4s' } as React.CSSProperties}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {tertiaryLink.label}
          </CTALink>
        )}
        {trustText && (
          <p className="mt-8 text-xs text-gray-400 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            {trustText}
          </p>
        )}
      </div>
    </section>
  );
}

