/**
 * Server-component wrapper for Timeline only.
 *
 * Timeline uses useState/useEffect for carousel state and cannot be a server component.
 * This wrapper is defined here so it's compiled as a server module, letting the RSC
 * runtime call it directly (preserving the `steps` array) before hitting the
 * "use client" boundary of TimelineClient.
 *
 * All other block components (Hero, FeatureGrid, PricingCards, FAQAccordion,
 * MetricCards, CTASection, ComparisonTable) have had "use client" removed and
 * are now proper server components — no wrapper needed.
 */

import { Timeline as TimelineClient } from "./Timeline";

export function Timeline(props: React.ComponentProps<typeof TimelineClient>) {
  return <TimelineClient {...props} />;
}
