// Timeline needs a server wrapper (it uses carousel state with useState/framer-motion)
export { Timeline } from './ServerWrappers';

// All other core blocks are proper server components (no "use client")
export { Hero } from './Hero';
export { FeatureGrid } from './FeatureGrid';
export { ComparisonTable } from './ComparisonTable';
export { FAQAccordion } from './FAQAccordion';
export { CTASection } from './CTASection';
export { PageEyebrow } from './PageEyebrow';
export { PricingCards } from './PricingCards';
export { MetricCards } from './MetricCards';

// Extended blocks
export { PainPoints } from './PainPoints';
export { TestimonialCard } from './TestimonialCard';
export { CalendlyEmbed } from './CalendlyEmbed';
export { CalEmbed } from './CalEmbed';
export { CalculatorWidget } from './CalculatorWidget';
export { LegalContent } from './LegalContent';
export { NewsletterForm } from './NewsletterForm';
export { DemoRequestForm } from './DemoRequestForm';
export { NewsletterPreferencesForm } from './NewsletterPreferencesForm';
export { SectionDivider } from './SectionDivider';
export { FoundersSection } from './FoundersSection';
export { CompareMore } from './CompareMore';

// Services page components
export { 
  ServicesHero,
  CoreDesignBento,
  WebBuildBento,
  MotionVideoBento,
  OngoingSupportBento,
  ScopeBoundaries,
  WebScopeBrief,
  FastestWin,
  ServicesCTA,
} from './ServicesBento';
