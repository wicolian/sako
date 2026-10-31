// =============================================================================
// LANDING PAGE CONFIGURATION
// =============================================================================
// All marketing copy, pricing, FAQ, and navigation content in one place.
// Edit values here to update the landing page instantly.
// =============================================================================
// ICP: B2B SaaS (500k-10M ARR), Founders, VP Marketing, Head of Growth
// Tone: ROI, revenue, conversion, sales impact, pipeline, direct outcomes
// Core message: bad design costs sales. Better assets = more pipeline from same spend.
// Avoid: beautiful, aesthetic, creative, vibes, magic, inspiration
// =============================================================================

import { appendUTMParams, getUTMCampaignParams } from "@/lib/utils";

// -----------------------------------------------------------------------------
// UTM TRACKING CONFIGURATION
// -----------------------------------------------------------------------------

export const utmConfig = {
  default: {
    source: 'trysakolandingpage',
    medium: 'website',
    campaign: 'launch'
  },
  campaigns: {
    hero: getUTMCampaignParams('launch', 'hero_primary_cta'),
    pricing: getUTMCampaignParams('pricing'),
    enterprise: getUTMCampaignParams('enterprise'),
    comparison: getUTMCampaignParams('comparison'),
    final_cta: getUTMCampaignParams('launch', 'final_cta'),
    nav: getUTMCampaignParams('navigation'),
    footer: getUTMCampaignParams('footer')
  }
} as const;

// Helper function to apply UTM params to links
export function applyUTMLinks(links: Record<string, string>, campaign: keyof typeof utmConfig.campaigns) {
  const utmParams = utmConfig.campaigns[campaign];
  const result: Record<string, string> = {};

  for (const [key, url] of Object.entries(links)) {
    result[key] = appendUTMParams(url, utmParams);
  }

  return result;
}

// -----------------------------------------------------------------------------
// EXTERNAL LINKS (from environment variables)
// -----------------------------------------------------------------------------

export const externalLinks = {
  app: process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trysako.com',
  booking: process.env.NEXT_PUBLIC_BOOKING_URL ?? 'https://cal.com/your-handle/intro-call',
  linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL ?? 'https://linkedin.com/company/trysako',
  discord: process.env.NEXT_PUBLIC_DISCORD_URL ?? 'https://discord.gg/trysako',
  email: `mailto:${process.env.NEXT_PUBLIC_EMAIL ?? 'hello@trysako.com'}`,
  eventsBase: process.env.NEXT_PUBLIC_EVENTS_BASE_URL ?? 'https://trysako.com/events',
} as const;

// -----------------------------------------------------------------------------
// NAVIGATION
// -----------------------------------------------------------------------------

export const navLinks = [
  { label: "Product", href: "/product" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/compare" },
] as const;

export const navCta = {
  label: "Start Shipping",
  href: appendUTMParams(externalLinks.app, utmConfig.campaigns.nav),
  secondaryLabel: "Book a fit check",
  secondaryHref: "/book-a-call",
} as const;

// -----------------------------------------------------------------------------
// HERO SECTION
// -----------------------------------------------------------------------------

export const heroCopy = {
  eyebrow: "GTM design for B2B SaaS teams",
  title: {
    line1: "Your marketing team's",

    line2Start: "always-on ",

    line2Italic: "design team.",
  },
  subtitle:
    "Convert-ready landing pages, decks, and campaign assets — shipped in 48h without adding headcount.",
  primaryCta: {
    label: "Start Shipping",
    href: appendUTMParams(externalLinks.app, utmConfig.campaigns.hero),
  },
  secondaryCta: {
    label: "Watch how it works",
    href: "#how",
  },
  tertiaryCta: {
    label: "Book a fit check",
    href: "/book-a-call",
  },
  trustText: "Used by Pre-Seed to Series B B2B SaaS teams who want design that converts, not just ships",
} as const;

// -----------------------------------------------------------------------------
// THE PROBLEM SECTION (replaces Slack to Shipped)
// -----------------------------------------------------------------------------

export const slackToShippedCopy = {
  eyebrow: "The Problem",
  title: {
    start: "Your team has great ideas.",
    italic: "The assets don't match.",
  },
  paragraphs: [
    {
      text: "You know what to build: sharper landing pages, fresher deck layouts, ad creative that stands out. What's missing is the design capacity to ship it at the pace your pipeline demands.",
      bold: ["design capacity to ship it at the pace your pipeline demands"],
    },
    {
      text: "Agencies take weeks. Freelancers are unpredictable. Your in-house designer is split across product, sales, and marketing. The result: campaigns go live on assets that were good enough, not great.",
      bold: ["good enough, not great"],
    },
    {
      text: "Sako is design ops for your GTM motion — one queue, visible timers, conversion-ready deliverables. Not just shipped. Shipped to perform.",
      bold: ["Shipped to perform"],
    },
    {
      text: "Better design makes every dollar of marketing spend work harder. We make better design fast.",
      bold: ["Better design makes every dollar of marketing spend work harder."],
    },
  ],
  cta: {
    label: "See How It Works",
    href: "#pricing",
  },
} as const;

// -----------------------------------------------------------------------------
// IS SAKO FOR YOU SECTION
// -----------------------------------------------------------------------------

export const isSakoForYouCopy = {
  title: {
    start: "Built for ",
    italic: "B2B SaaS",
    end: " teams between 500k and 10M ARR",
  },
  subtitle: "We ship GTM design that converts — not everything.",
  forYou: {
    title: "This is for you if…",
    items: [
      "Your marketing assets underperform and you know it.",
      "You spend on paid ads but your landing pages tank the conversion rate.",
      "Your in-house designer is shared across product, sales, and marketing.",
      "You want predictable output, not freelancer roulette.",
    ],
  },
  notForYou: {
    title: "This is not for you if…",
    items: [
      "You want logos, brand identity, or \"big rebrand\" work.",
      "You're pre-product and still figuring out the story.",
      "You need a full marketing strategy team — we're design ops. We ship assets, audits, and UX changes; we don't do quarterly planning.",
      "You need daily meetings to feel progress.",
    ],
  },
  cta: {
    label: "See If We're a Fit",
    href: "#pricing",
  },
} as const;

// -----------------------------------------------------------------------------
// HOW SAKO WORKS (PIPELINE) SECTION
// -----------------------------------------------------------------------------

export const howSakoRunsCopy = {
  eyebrow: "How it runs",
  title: {
    start: "One ",
    italic1: "queue",
    middle: ". Limited ",
    italic2: "slots",
    end: ". Timers you can trust.",
  },
  steps: [
    {
      number: "01",
      title: "Submit Brief",
      description: "Submit in the dashboard. Slack can notify, but the dashboard holds scope, files, and approvals.",
    },
    {
      number: "02",
      title: "First Draft",
      description: "A fast first pass to lock direction early before we spend real time.",
      badge: "Minutes",
    },
    {
      number: "03",
      title: "Pod Active",
      description: "Timer starts when the brief is Ready. Standard GTM tasks land in 24–48h. Bigger items get an ETA up front.",
      badge: "48h SLA",
    },
    {
      number: "04",
      title: "Review",
      description: "Async review in the dashboard. Revisions are included. We iterate until you approve.",
    },
    {
      number: "05",
      title: "Ship",
      description: "Delivered, versioned, and easy to find later. No chasing threads.",
    },
  ],
} as const;

// -----------------------------------------------------------------------------
// DELIVERY ENGINE SECTION
// -----------------------------------------------------------------------------

export const sakoOSCopy = {
  eyebrow: "Sako OS",
  title: {
    start: "A system that keeps ",
    italic: "SLAs",
    end: " honest.",
  },
  subtitle:
    "Capacity is defined. Timers are visible. Delivery stays predictable.",
  features: [
    {
      title: "Capacity is defined.",
      description:
        "We cap active work-in-progress on purpose. That's how SLAs stay real.",
      type: "sla",
    },
    {
      title: "SLAs you can see.",
      description:
        "Eligible tasks are time-stamped and tracked through states. Close calls escalate internally. No surprises.",
      type: "pod",
    },
    {
      title: "Composer is coming.",
      description:
        "Brand-aware drafts for GTM pages and assets. Pod takes it to production.",
      link: "MEET COMPOSER →",
      linkHref: "/composer",
      type: "composer",
    },
    {
      title: "Slack optional. Dashboard required.",
      description:
        "Slack is for pings. The dashboard is the source of truth: briefs, files, versions, approvals.",
      type: "motion",
    },
    {
      title: "Pause and bank.",
      description:
        "Pause between billing cycles. Unused days roll forward. You don't lose time you paid for.",
      type: "vault",
    },
  ],
} as const;

// -----------------------------------------------------------------------------
// COMPOSER SECTION
// -----------------------------------------------------------------------------

export const composerCopy = {
  eyebrow: "Coming Q1 2026",
  title: {
    start: "Next, we're building Sako Composer.",
    italic: "AI drafts, human finished.",
  },
  description: {
    intro: "Composer is the AI design engine that powers Sako.",
    listIntro: "Type a brief once and Composer will:",
    list: [
      "Draft full landing pages in your brand system.",
      "Spin up slide flows for sales and fundraising.",
      "Generate social, ads, and launch visuals in one go.",
    ],
    outro:
      "You pick what looks closest to right, and your Sako pod takes it from 60% to 100%, adds motion where needed, and ships.",
  },
  cta1: {
    label: "Join Waitlist",
    href: appendUTMParams(externalLinks.app, getUTMCampaignParams('composer')),
  },
  cta2: {
    label: "Learn More",
    href: "/composer",
  },
} as const;

// -----------------------------------------------------------------------------
// COMPARISON SECTION
// -----------------------------------------------------------------------------

export const comparisonCopy = {
  title: {
    italic: "How Sako is not",
    end: " just another design subscription",
  },
  subtitle: "Most options miss one thing: design that actually converts. Sako is productized in process, conversion-focused in output.",
  buttons: {
    primary: { label: "Start Shipping", href: appendUTMParams(externalLinks.app, utmConfig.campaigns.comparison) },
    secondary: { label: "Book a fit check", href: "/book-a-call" },
  },
} as const;

export const comparisonLabels = [
  "Time to first asset",
  "Conversion focus",
  "Consistency",
  "Motion included",
  "Scope clarity",
  "Visibility & SLAs",
  "Cost per month",
  "Risk",
] as const;

export const comparisonData = {
  sako: {
    name: "Sako",
    items: [
      { text: "24–48h on eligible requests", check: true },
      { text: "GTM-only, conversion-tested patterns", check: true },
      { text: "Fixed pod, learns your brand", check: true },
      { text: "Included in pod capacity", check: true },
      { text: "GTM focused only", check: true },
      { text: "Dashboard timers + clear states", check: true },
      { text: "$2,500-8,500", check: true },
      { text: "14-day money-back guarantee", check: true },
    ],
  },
  inhouse: {
    name: "In-House",
    items: [
      { text: "Depends on backlog", check: false },
      { text: "Variable — overloaded designer", check: false },
      { text: "One person (single point of failure)", check: false },
      { text: "Usually an extra role", check: false },
      { text: "Everything (overloaded)", check: false },
      { text: "Slack updates", check: true },
      { text: "$15,000+ (salary + overhead)", check: false },
      { text: "Hiring risk + ramp time", check: false },
    ],
  },
  freelancers: {
    name: "Freelancers",
    items: [
      { text: "Variable", check: false },
      { text: "No conversion focus", check: false },
      { text: "No consistency", check: false },
      { text: "Hit or miss", check: false },
      { text: "Ad hoc", check: false },
      { text: "DMs + email", check: false },
      { text: "$3,000-10,000 scattered", check: false },
      { text: "Flaky + inconsistent", check: false },
    ],
  },
  agencies: {
    name: "Agencies",
    items: [
      { text: "Project timelines", check: false },
      { text: "Variable quality", check: false },
      { text: "Rotating account team", check: false },
      { text: "Often scoped separately", check: false },
      { text: "All design work", check: true },
      { text: "Status calls + decks", check: false },
      { text: "$8,000-25,000 retainer", check: false },
      { text: "Retainers + process overhead", check: false },
    ],
  },
} as const;

// -----------------------------------------------------------------------------
// PRICING SECTION
// -----------------------------------------------------------------------------

export const pricingCopy = {
  title: {
    italic: "Predictable",
    end: " pricing. Real throughput.",
  },
  subtitle:
    "One in-house designer plus motion is a six-figure headcount decision. Sako starts at $2,500/mo and ships convert-ready assets from week one.",
  offer: {
    label: "Cost anchor:",
    text: " Most teams replace 1 scattered freelancer stack with one pod.",
    linkText: "Calculate your ROI",
    linkHref: "/roi-calculator",
  },
  footer:
    "All plans include a 14-day money-back guarantee. If we don't ship like we said, you get your money back.",
} as const;

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
  badge?: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "core",
    name: "Core",
    price: "$2,500",
    period: "/mo",
    description: "For founders and small teams shipping essential GTM assets.",
    features: [
      "1 active slot (designer + motion + ops)",
      "Unlimited GTM requests",
      "Motion design included standard",
      "48h standard tasks once Ready",
      "Dashboard + Slack notifications",
      "Unlimited revisions",
    ],
    cta: "Start with Core",
    ctaHref: appendUTMParams(externalLinks.app, utmConfig.campaigns.pricing),
    highlighted: false,
  },
  {
    id: "ops-base",
    name: "Ops Base",
    price: "$4,500",
    period: "/mo",
    description: "For teams running multiple GTM workstreams at once.",
    features: [
      "Everything in Core",
      "2 active slots (double output)",
      "Priority queue (your work cuts the line)",
      "Bank & pause unused days",
      "Monthly strategy call with pod lead",
      "Fast-track delivery available",
    ],
    cta: "Start with Ops Base",
    ctaHref: appendUTMParams(externalLinks.app, utmConfig.campaigns.pricing),
    highlighted: true,
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For Series B+ teams that need 3+ pipelines and custom terms.",
    features: [
      "Everything in Ops Base",
      "3+ parallel pipelines",
      "GTM strategy included (not just execution)",
      "Dedicated account manager",
      "Custom SLAs (24h available)",
      "Procurement support (PO, net-30/60)",
    ],
    cta: "Book a fit check",
    ctaHref: "/book-a-call",
    highlighted: false,
  },
];

// -----------------------------------------------------------------------------
// FAQ SECTION
// -----------------------------------------------------------------------------

export const faqCopy = {
  title: {
    start: "Frequently ",
    italic: "asked",
    end: " questions",
  },
} as const;

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const faqItems: FAQItem[] = [
  {
    id: "faq-what-is-pod",
    question: "What is a Sako pod?",
    answer:
      "A small fixed team (lead designer, motion designer, creative ops manager) aligned to your company for GTM work. Same team every time. Not rotating freelancers. They learn your brand and narrative in the first week.",
  },
  {
    id: "faq-different-from-others",
    question: "Is this really different from other design subscriptions?",
    answer:
      "Yes. Most design subscriptions are 'you plus whoever is available.' Sako is a dedicated pod focused only on GTM work (launches, experiments, sales enablement). Not all design work. Plus, motion is included standard, not $1k extra.",
  },
  {
    id: "faq-48h-sla",
    question: "How fast is 48h, really?",
    answer:
      "24-48 hours for simple GTM assets (ads, social, small updates). 2-4 days for medium work (landing page variants, deck updates). Complex work is scoped individually. SLAs are enforced by software, not promises. If we need longer, we say so upfront.",
  },
  {
    id: "faq-what-is-ready",
    question: "What does 'Ready' mean for the 48h clock?",
    answer:
      "A task is Ready when: the deliverable is clear, specs and assets are provided (or 'use existing' is confirmed), one decision owner is assigned, and feedback comes through the dashboard. The 48h clock starts the moment a task hits Ready status. If a brief is incomplete, we flag it immediately rather than start the clock.",
  },
  {
    id: "faq-miss-sla",
    question: "What happens if you miss the 48-hour SLA?",
    answer:
      "If we miss the 48-hour SLA on an eligible request, it gets priority until delivered plus a service credit. Eligibility starts when the brief is ready.",
  },
  {
    id: "faq-understand-brand",
    question: "Will you understand our brand?",
    answer:
      "We start with a sharp onboarding where we build your 'Brand Ops Pack'. Your colors, voice, example assets you love and hate, GTM narrative, and key guidelines. The pod designs everything from that baseline and refines as we go.",
  },
  {
    id: "faq-inhouse-design",
    question: "What if we already have in-house design?",
    answer:
      "Perfect. Let your in-house team focus on product UI and deep brand work. Sako becomes your GTM pressure valve. Launches, campaigns, experiments, sales enablement. Your in-house designer is no longer overloaded.",
  },
  {
    id: "faq-pause-cancel",
    question: "Can we pause or cancel anytime?",
    answer:
      "Yes. Pause between billing cycles and your unused days bank. Cancel anytime with no long-term contract. We treat Sako as the utility it is. You use it when you need it.",
  },
  {
    id: "faq-motion-included",
    question: "Is motion really included?",
    answer:
      "Yes. Motion design typically costs $1,000+ per project or $10k+ monthly as an add-on. Sako includes motion in every plan. If your GTM needs animation, it comes out of your pod's capacity. No upsell.",
  },
  {
    id: "faq-design-work-covered",
    question: "What kinds of design work do you cover?",
    answer:
      "GTM work: landing pages, variants, sales decks, ads, email designs, motion assets, product explainers, launch collateral. We do not do custom illustrations, brand identity redesigns, or product UI/UX. We focus.",
  },
  {
    id: "faq-revisions",
    question: "How much revision is included?",
    answer:
      "Unlimited. We keep iterating until you approve. We're not keeping score or charging per revision. Once you say 'ship it,' it's done.",
  },
  {
    id: "faq-not-working",
    question: "What if this doesn't work?",
    answer:
      "You'll feel the difference when the backlog stops growing and launches stop slipping. If we're missing SLAs or output isn't matching expectations, we either fix it or you don't pay further.",
  },
  {
    id: "faq-timezone",
    question: "Do you work with my time zone?",
    answer:
      "We work async with overlapping hours. If you need specific coverage, we'll align on it during onboarding.",
  },
];

// -----------------------------------------------------------------------------
// FINAL CTA SECTION
// -----------------------------------------------------------------------------

export const finalCtaCopy = {
  title: {
    start: "Stop leaving revenue",
    italic: "on the table.",
  },
  subtitle:
    "Sako ships design that converts. 14-day money-back guarantee. If we don't deliver, you pay nothing more.",
  trustText: "Month-to-month • Pause anytime • Bank unused days • Motion included",
  cta: {
    label: "Start Shipping",
    href: appendUTMParams(externalLinks.app, utmConfig.campaigns.final_cta),
  },
  secondaryCta: {
    label: "Book a fit check",
    href: "/book-a-call",
  },
} as const;

// -----------------------------------------------------------------------------
// FOOTER
// -----------------------------------------------------------------------------

interface FooterLink {
  label: string;
  href: string;
  comingSoon?: boolean;
}

export const footerCopy = {
  brandName: "SAKO",
  description:
    "Design that converts. Pages, decks, ads, motion — shipped fast.",
  companyInfo: {
    legalName: "Creative Ops, Inc.",
    entityType: "Delaware C Corporation",
    location: "Newark, DE, USA",
  },
  copyright: `© ${new Date().getFullYear()} Creative Ops, Inc. · All rights reserved`,
  newsletter: {
    heading: 'Design ops updates',
    description: 'Practical tips on shipping GTM faster. No spam.',
    ctaLabel: 'Subscribe',
    socialProof: 'Join 500+ teams',
  },
} as const;

export const footerLinks = {
  product: [
    { label: "Product", href: "/product" },
    { label: "How it Works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Compare", href: "/compare" },
    { label: "Composer", href: "/composer", comingSoon: true },
    { label: "Slack Integration", href: "/slack" },
  ] as FooterLink[],
  solutions: [
    { label: "Startups", href: "/use-cases/startups" },
    { label: "Scale-ups", href: "/use-cases/scale-ups" },
    { label: "SaaS", href: "/use-cases/saas" },
    { label: "Founders", href: "/for/founders" },
    { label: "Marketing Teams", href: "/for/marketing-teams" },
    { label: "Growth Teams", href: "/for/growth-teams" },
    { label: "Blog", href: "/blog" },
    { label: "ROI Calculator", href: "/roi-calculator" },
    // { label: "Events", href: "/events" }, // Commented out as requested
  ] as FooterLink[],
  company: [
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Enterprise", href: "/enterprise" },
    { label: "Contact", href: "/contact" },
    { label: "Book a Fit Check", href: "/book-a-call" },
  ] as FooterLink[],
  legal: [
    { label: "Terms of Service", href: "/legal/terms" },
    { label: "Privacy Policy", href: "/legal/privacy" },
    { label: "SLA", href: "/legal/sla" },
    { label: "Refund Policy", href: "/legal/refund-policy" },
    { label: "Cookie Policy", href: "/legal/cookies" },
    { label: "GDPR", href: "/legal/gdpr" },
    { label: "Security", href: "/security" },
  ] as FooterLink[],
};

export const socialLinks = [
  { label: "LinkedIn", href: appendUTMParams(externalLinks.linkedin, utmConfig.campaigns.footer), icon: "linkedin" },
  { label: "Email", href: externalLinks.email, icon: "email" },
  { label: "Discord", href: appendUTMParams(externalLinks.discord, utmConfig.campaigns.footer), icon: "discord" },
] as const;

// -----------------------------------------------------------------------------
// BLOG
// -----------------------------------------------------------------------------

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category: string;
  readingTime: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-bad-design-costs-b2b-saas-revenue",
    title: "How Bad Design Costs B2B SaaS Companies Revenue",
    excerpt:
      "Every weak landing page, unpolished deck, and forgettable ad creative is a pipeline leak. Here's how to calculate the real cost.",
    publishedAt: "2026-03-01",
    category: "ROI & Revenue",
    readingTime: "6 min read",
  },
  {
    slug: "design-subscription-vs-agency",
    title: "Design Subscription vs. Agency: Which Converts More Pipeline?",
    excerpt:
      "Agencies charge $15k/project. Subscriptions charge $2.5k/month. We break down which model actually moves your conversion metrics.",
    publishedAt: "2026-02-22",
    category: "Comparison",
    readingTime: "5 min read",
  },
  {
    slug: "motion-design-b2b-gtm",
    title: "Why Motion Design is Non-Negotiable for B2B GTM in 2026",
    excerpt:
      "Static marketing loses attention before the message lands. Here's why every B2B landing page needs motion — and what it actually converts.",
    publishedAt: "2026-02-15",
    category: "Motion",
    readingTime: "6 min read",
  },
  {
    slug: "scaling-design-without-hiring",
    title: "Scaling Design Without Hiring: A Founder's ROI Guide",
    excerpt:
      "You need more design output but can't justify a full-time hire. Here's how to get convert-ready assets without adding headcount.",
    publishedAt: "2026-02-08",
    category: "Design Ops",
    readingTime: "7 min read",
  },
  {
    slug: "why-design-ops-matters",
    title: "Why Design Ops Turns Creative Chaos Into Revenue",
    excerpt:
      "As your SaaS grows, design becomes a bottleneck that costs deals. Here's how Design Ops transforms that chaos into a predictable revenue engine.",
    publishedAt: "2026-02-01",
    category: "Design Ops",
    readingTime: "5 min read",
  },
];

// -----------------------------------------------------------------------------
// EVENTS
// -----------------------------------------------------------------------------

export interface Event {
  id: string;
  name: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  status: "upcoming" | "past";
}

export const events: Event[] = [
  {
    id: "design-ops-webinar-jan",
    name: "Design Ops for SaaS: Live Q&A",
    date: "2025-01-15",
    time: "2:00 PM EST",
    location: "Virtual (Zoom)",
    description:
      "Join our founding team for a live walkthrough of how we ship design in 48 hours. Bring your questions. We'll answer everything.",
    ctaLabel: "Register Now",
    ctaHref: appendUTMParams(`${externalLinks.eventsBase}/design-ops-webinar`, getUTMCampaignParams('events')),
    status: "past",
  },

];
