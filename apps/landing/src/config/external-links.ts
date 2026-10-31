// External links configuration for MDX files
// These are used in MDX content where inline objects can't access env vars directly

export const externalLinks = {
  app: process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trysako.com',
  booking: process.env.NEXT_PUBLIC_BOOKING_URL ?? 'https://cal.com/your-handle/intro-call',
} as const;

// React components that return CTA configurations for MDX
export function StartShippingCTA() {
  return {
    label: "Start Shipping",
    href: externalLinks.app
  };
}

export function BookCallCTA() {
  return {
    label: "Book a fit check",
    href: "/book-a-call"
  };
}
