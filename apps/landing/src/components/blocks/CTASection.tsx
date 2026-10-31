import Link from "next/link";
import { patterns } from "@/lib/design-tokens";
import { ShimmerButton } from "@/components/ui/buttons/shimmer-button";
import { SparklesText } from "@/components/ui/visuals/sparkles-text";

interface CTASectionProps {
  variant?: 'standard' | 'final' | 'minimal';
  title: string;
  subtitle?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  trustText?: string;
}

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

interface CTALinkProps {
  href: string;
  className: string;
  children: React.ReactNode;
}

function CTALink({ href, className, children }: CTALinkProps) {
  if (href.startsWith('http')) {
    return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  if (href.startsWith('#')) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

export function CTASection({
  variant = 'standard',
  title = '',
  subtitle,
  primaryCta,
  secondaryCta,
  trustText,
}: CTASectionProps) {
  const titleParts = parseTitleWithSerif(title);
  
  if (variant === 'minimal') {
    return (
      <section className="py-16 px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className={`${patterns.heading2} mb-6`}>
            {titleParts.map((part, i) =>
              part.serif ? (
                <span key={i} className="font-serif italic font-normal">{part.text}</span>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </h2>
          <CTALink
            href={primaryCta?.href ?? '#'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all"
          >
            {primaryCta?.label}
          </CTALink>
        </div>
      </section>
    );
  }
  
  if (variant === 'final') {
    return (
      <section className="py-12 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bg-[#1a1a1a] text-white rounded-3xl py-20 px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-6">
            {titleParts.map((part, i) => 
              part.serif ? (
                <SparklesText
                  key={i}
                  colors={{ first: "#9AE83E", second: "#6DB827" }}
                  sparklesCount={6}
                  className="font-serif italic text-[#9AE83E] text-4xl sm:text-5xl inline"
                >
                  {part.text}
                </SparklesText>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </h2>
          {subtitle && (
            <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">{subtitle}</p>
          )}
          <div className="flex flex-wrap justify-center gap-4">
            <CTALink href={primaryCta?.href ?? '#'} className="">
              <ShimmerButton
                shimmerColor="#FFFFFF"
                shimmerSize="0.08em"
                shimmerDuration="2.5s"
                background="rgba(154, 232, 62, 1)"
                className="text-black text-sm font-bold flex items-center gap-2 px-8 py-4 shadow-xl shadow-[#9AE83E]/30"
              >
                {primaryCta?.label}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </ShimmerButton>
            </CTALink>
            {secondaryCta && (
              <CTALink
                href={secondaryCta.href}
                className="px-8 py-4 bg-transparent border border-white/20 text-white text-sm font-medium rounded-full hover:bg-white/5 transition-all"
              >
                {secondaryCta.label}
              </CTALink>
            )}
          </div>
          {trustText && (
            <p className="mt-8 text-xs text-gray-500">{trustText}</p>
          )}
          </div>
        </div>
      </section>
    );
  }
  
  // Default: standard variant
  return (
    <section className="py-12 px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bg-gray-50 border border-gray-200 rounded-3xl py-16 px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-4">
          {titleParts.map((part, i) => 
            part.serif ? (
              <span key={i} className="font-serif italic font-normal text-brand-serif-accent">{part.text}</span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </h2>
        {subtitle && (
          <p className="text-gray-500 max-w-xl mx-auto mb-8">{subtitle}</p>
        )}
        <div className="flex flex-wrap justify-center gap-4">
          <CTALink
            href={primaryCta?.href ?? '#'}
            className="group px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all flex items-center gap-2"
          >
            {primaryCta?.label}
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
      </div>
    </section>
  );
}

