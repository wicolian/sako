"use client";

import Link from "next/link";
import { patterns } from "@/lib/design-tokens";
import { BentoCard, BentoGrid, BentoContentType } from "@/components/ui/layout/bento-grid";
import {
  Timer, CreditCard, Layers, Rocket, Presentation, Camera,
  Share, FileText, RefreshCw, Zap, Shield, Users, Clock, Check, CheckCircle,
  MessageSquare, BarChart3, Settings, Star, ArrowRight, Sparkles,
  Building, User, Image, Layout, Globe, Video, Code, Target, Paperclip,
  Repeat, Percent, DollarSign, Pause, History, Eye, ImageIcon, Mail,
  Share2, Lightbulb, Palette, TrendingUp,
  // Marketing Teams icons
  Megaphone, AtSign, Film, MessageCircle,
  // Growth Teams icons  
  FlaskConical, Puzzle, BookOpen, Clapperboard, Send, PartyPopper,
  // Founders icons
  Flame, PiggyBank, Handshake, Newspaper, PlayCircle, Paintbrush,
  // Startups icons
  Briefcase, ClipboardList, MonitorPlay, Wrench,
  // SaaS icons
  SlidersHorizontal, Split, ScreenShare, MailOpen, Grid3X3,
  // Scale-ups icons
  Beaker, Inbox
} from "lucide-react";

// Parse {serif} markers in title for Playfair Display
function parseTitleWithSerif(title: string) {
  const parts = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(title)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: title.slice(lastIndex, match.index), serif: false });
    }
    parts.push({ text: match[1], serif: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < title.length) {
    parts.push({ text: title.slice(lastIndex), serif: false });
  }

  return parts.length > 0 ? parts : [{ text: title, serif: false }];
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Timer, CreditCard, Layers, Rocket, Presentation, Camera,
  Share, FileText, RefreshCw, Zap, Shield, Users, Clock, Check, CheckCircle,
  MessageSquare, BarChart3, Settings, Star, ArrowRight, Sparkles,
  Building, User, Image, Layout, Globe, Video, Code, Target, Paperclip,
  Repeat, Percent, DollarSign, Pause, History, Eye, ImageIcon, Mail,
  Share2, Lightbulb, Palette, TrendingUp,
  // Marketing Teams
  Megaphone, AtSign, Film, MessageCircle,
  // Growth Teams
  FlaskConical, Puzzle, BookOpen, Clapperboard, Send, PartyPopper,
  // Founders
  Flame, PiggyBank, Handshake, Newspaper, PlayCircle, Paintbrush,
  // Startups
  Briefcase, ClipboardList, MonitorPlay, Wrench,
  // SaaS
  SlidersHorizontal, Split, ScreenShare, MailOpen, Grid3X3,
  // Scale-ups
  Beaker, Inbox,
  // Lowercase/camelCase aliases for MDX compatibility
  checkCircle: CheckCircle,
  palette: Palette,
  users: Users,
  layers: Layers,
  inbox: Inbox,
  shield: Shield,
  clock: Clock,
  zap: Zap,
  target: Target
};

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  link?: { label: string; href: string };
  animation?: 'pulse' | 'glow' | 'wave' | 'none';
  bentoContent?: BentoContentType;
  wide?: boolean;
}

interface FeatureGridProps {
  columns?: 2 | 3 | 4 | 6;
  items: FeatureItem[];
  variant?: 'cards' | 'simple' | 'icons-only' | 'bento';
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

function CTALink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith('http')) {
    return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

export function FeatureGrid({
  columns = 3,
  items = [],
  variant = 'cards',
  title,
  subtitle,
  compact = false,
}: FeatureGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  if (variant === 'bento') {
    const titleParts = title ? parseTitleWithSerif(title) : null;
    return (
      <section className={patterns.section}>
        <div className={patterns.container}>
          {(title || subtitle) && (
            <div className="text-center mb-16">
              {title && <h2 className={`${patterns.heading2} mb-4`}>
                {titleParts?.map((part, i) =>
                  part.serif ? (
                    <span key={i} className="font-serif italic font-normal text-brand-serif-accent">{part.text}</span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </h2>}
              {subtitle && <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>{subtitle}</p>}
            </div>
          )}
          <BentoGrid>
            {items.map((item, index) => {
              // First, fourth, and fifth items span 2 columns on larger screens
              const isLarge = index === 0 || index === 3 || index === 4;
              return (
                <BentoCard
                  key={index}
                  name={item.title}
                  description={item.description}
                  iconName={item.icon}
                  href={item.link?.href || "#"}
                  cta={item.link?.label || ""}
                  animation={item.animation || 'none'}
                  bentoContent={item.bentoContent}
                  className={isLarge ? "md:col-span-2" : ""}
                />
              );
            })}
          </BentoGrid>
        </div>
      </section>
    );
  }
  
  if (variant === 'icons-only') {
    return (
      <section className={patterns.sectionTight}>
        <div className={patterns.container}>
          {(title || subtitle) && (
            <div className="text-center mb-12">
              {title && <h2 className="text-2xl sm:text-3xl font-medium text-black tracking-tight mb-4">{title}</h2>}
              {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
            </div>
          )}
          <div className={`grid ${gridCols[columns]} gap-8`}>
            {items.map((item, index) => {
              const Icon = iconMap[item.icon] || Zap;
              return (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#9AE83E]/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-5 h-5 text-[#9AE83E]" />
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
  
  if (variant === 'simple') {
    const titleParts = title ? parseTitleWithSerif(title) : null;
    const isComposerSection = title?.toLowerCase().includes('composer');
    return (
      <section className={patterns.section}>
        <div className={patterns.container}>
          {(title || subtitle) && (
            <div className="text-center mb-16">
              {title && <h2 className={`${patterns.heading2} mb-4 inline-flex items-center justify-center gap-3 flex-wrap`}>
                <span>
                  {titleParts?.map((part, i) =>
                    part.serif ? (
                      <span key={i} className="font-serif italic font-normal text-brand-serif-accent">{part.text}</span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </span>
                  {isComposerSection && (
                   <span className="text-xs font-medium text-[#1a1a1a] bg-[#9AE83E] px-2 py-0.5 rounded inline-block align-middle ml-2">
                      SOON
                    </span>
                )}
              </h2>}
              {subtitle && !isComposerSection && <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>{subtitle}</p>}
              {subtitle && isComposerSection && (
                <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>{subtitle}</p>
              )}
            </div>
          )}
          <div className={`grid ${gridCols[columns]} gap-8`}>
            {items.map((item, index) => {
              const Icon = iconMap[item.icon] || Zap;
              return (
                <div key={index} className="flex gap-5 p-6 rounded-2xl bg-gray-50/50 hover:bg-white hover:shadow-md transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[#9AE83E]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#1a1a1a]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                    {item.link && (
                      <CTALink href={item.link.href} className="text-xs font-semibold text-[#1a1a1a] hover:text-[#9AE83E] transition-colors mt-3 inline-flex items-center gap-1 group/link">
                        {item.link.label}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover/link:translate-x-0.5 transition-transform">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </CTALink>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
  
  // Default: cards variant
  const titleParts = title ? parseTitleWithSerif(title) : null;
  return (
    <section className={compact ? 'py-12 px-6' : patterns.section}>
      <div className={patterns.container}>
        {(title || subtitle) && (
          <div className="text-center mb-16">
            {title && <h2 className={`${patterns.heading2} mb-4`}>
              {titleParts?.map((part, i) =>
                part.serif ? (
                  <span key={i} className="font-serif italic font-normal text-brand-serif-accent">{part.text}</span>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )}
            </h2>}
            {subtitle && <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>{subtitle}</p>}
          </div>
        )}
        <div className={`grid ${gridCols[columns]} gap-6`}>
          {items.map((item, index) => {
            const Icon = iconMap[item.icon] || Zap;
            return (
              <div
                key={index}
                className={`bg-white rounded-2xl p-8 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${item.wide ? 'col-span-1 sm:col-span-2 lg:col-span-2' : ''}`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] text-white flex items-center justify-center mb-6 group-hover:bg-[#9AE83E] group-hover:text-black transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-3">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                {item.link && (
                  <CTALink 
                    href={item.link.href} 
                    className="text-xs font-bold pb-0.5 hover:text-[#9AE83E] transition-colors mt-4 inline-flex items-center gap-1 group/link"
                  >
                    {item.link.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover/link:translate-x-0.5 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </CTALink>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
