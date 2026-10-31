import type { PageFrontmatter } from './mdx';

// Organization schema - used on all pages
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://trysako.com/#organization",
  "name": "Sako",
  "legalName": "Creative Ops, Inc.",
  "alternateName": "Creative Ops Inc",
  "url": "https://trysako.com",
  "logo": "https://trysako.com/sako.svg",
  "image": "https://trysako.com/sako.svg",
  "description": "Design operations platform for B2B SaaS companies. Ship production-ready landing pages, decks, and motion assets in 48 hours.",
  "foundingDate": "2024",
  "founders": [
    {
      "@type": "Person",
      "name": "Sako Team"
    }
  ],
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "contactType": "Sales",
      "email": "sales@trysako.com",
      "availableLanguage": "English"
    },
    {
      "@type": "ContactPoint",
      "contactType": "Support",
      "email": "support@trysako.com",
      "availableLanguage": "English"
    }
  ],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Plot No 47, 6th Street, Rajiv Nagar, Perungudi",
    "addressLocality": "Chennai",
    "addressRegion": "TN",
    "postalCode": "600096",
    "addressCountry": "IN"
  },
  "sameAs": [
    "https://x.com/SakoTeam",
    "https://linkedin.com/company/sakohq",
    "https://www.crunchbase.com/organization/sako-dfc3",
    "https://www.instagram.com/sakohq/",
    "https://creativeops.in"
  ],
  "knowsAbout": [
    "Design Operations",
    "B2B SaaS Design",
    "Motion Design",
    "Landing Page Design",
    "Product Design",
    "Creative Operations",
    "Design Systems"
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Sako Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Design Operations Platform",
          "description": "Dedicated design & motion pod for B2B SaaS companies"
        }
      }
    ]
  }
};

// Standard page schema (Product/SoftwareApplication)
export function standardPageSchema(page: { seo?: PageFrontmatter['seo']; slug: string }) {
  const defaultTitle = 'Sako | Design Ops for B2B SaaS';
  const defaultDescription = 'Design operations platform for B2B SaaS companies.';
  
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": page.seo?.metaTitle || defaultTitle,
    "description": page.seo?.metaDescription || defaultDescription,
    "url": `https://trysako.com/${page.slug}`,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "provider": {
      "@id": "https://trysako.com/#organization"
    }
  };
}

// FAQ page schema
export function faqPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

// Generate price valid until date (1 year from now, auto-refreshes on build)
function getPriceValidUntil(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Pricing page schema (dates auto-generated on each build)
export const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Sako Design Ops",
  "description": "Design ops subscription for B2B SaaS teams",
  "brand": { "@id": "https://trysako.com/#organization" },
  "offers": [
    {
      "@type": "Offer",
      "name": "Core",
      "price": "2500",
      "priceCurrency": "USD",
      "priceValidUntil": getPriceValidUntil(),
      "availability": "https://schema.org/InStock"
    },
    {
      "@type": "Offer",
      "name": "Ops Base",
      "price": "4500",
      "priceCurrency": "USD",
      "priceValidUntil": getPriceValidUntil(),
      "availability": "https://schema.org/InStock"
    },
    {
      "@type": "Offer",
      "name": "Enterprise",
      "price": "8500",
      "priceCurrency": "USD",
      "priceValidUntil": getPriceValidUntil(),
      "availability": "https://schema.org/InStock"
    }
  ]
};

// Legal page schema
export function legalPageSchema(page: { seo?: PageFrontmatter['seo']; slug: string; updatedAt?: string }) {
  const defaultTitle = 'Sako | Legal';
  const defaultDescription = 'Legal documentation for Sako.';
  
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": page.seo?.metaTitle || defaultTitle,
    "description": page.seo?.metaDescription || defaultDescription,
    "url": `https://trysako.com/${page.slug}`,
    "dateModified": page.updatedAt || new Date().toISOString(),
    "publisher": {
      "@id": "https://trysako.com/#organization"
    }
  };
}

// Get schema based on template type
export function getSchemaForTemplate(
  template: PageFrontmatter['template'],
  page: { seo?: PageFrontmatter['seo']; slug: string; updatedAt?: string },
  faqs?: { question: string; answer: string }[]
) {
  switch (template) {
    case 'standard':
      return standardPageSchema(page);
    case 'comparison':
    case 'audience':
      return faqs ? faqPageSchema(faqs) : standardPageSchema(page);
    case 'pricing':
      return pricingSchema;
    case 'legal':
      return legalPageSchema(page);
    case 'calculator':
    case 'contact':
    default:
      return standardPageSchema(page);
  }
}


