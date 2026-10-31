import { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import dynamic from "next/dynamic";
import { getPageBySlug } from "@/lib/mdx";
import { getSchemaForTemplate, organizationSchema } from "@/lib/schemas";
import { getMDXComponents } from "@/lib/mdx-components";
import {
  NavBar,
  FooterWithEnd,
  Hero,
} from "@/components/landing";
import * as Blocks from "@/components/blocks";
import { GridBackground } from "@/components/ui/backgrounds/grid-background";
import { LLMCopyButton } from "@/components/ui/buttons/llm-copy-button";

// Dynamic imports for below-the-fold components to reduce initial bundle size
const SlackToShipped = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.SlackToShipped })), {
  loading: () => <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const WhySako = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.WhySako })), {
  loading: () => <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const HowItWorks = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.HowItWorks })), {
  loading: () => <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const Comparison = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.Comparison })), {
  loading: () => <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const SakoOS = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.SakoOS })), {
  loading: () => <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const Pricing = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.Pricing })), {
  loading: () => <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const FAQ = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.FAQ })), {
  loading: () => <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse bg-gray-200 h-64 w-full rounded-lg"></div></div>
});

const FinalCTA = dynamic(() => import("@/components/landing").then(mod => ({ default: mod.FinalCTA })), {
  loading: () => <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><div className="animate-pulse bg-gray-800 h-64 w-full rounded-lg"></div></div>
});

// MDX components including all blocks and landing components
const mdxComponents = {
  ...getMDXComponents({}),
  ...Blocks,
  Hero,
  // Dynamic components will be loaded as needed
  SlackToShipped,
  WhySako,
  HowItWorks,
  Comparison,
  SakoOS,
  Pricing,
  FAQ,
  FinalCTA,
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("");

  const baseUrl = "https://trysako.com";
  const defaultTitle = "Sako | Design Ops for B2B SaaS";
  const defaultDescription =
    "Sako plugs a dedicated design & motion pod into your Slack. You drop briefs in, we ship production-ready pages, decks, and motion assets in a strict 48-hour cycle.";

  if (!page || !page.frontmatter?.seo) {
    return {
      title: defaultTitle,
      description: defaultDescription,
    };
  }

  const { seo } = page.frontmatter;

  return {
    title: seo.metaTitle || defaultTitle,
    description: seo.metaDescription || defaultDescription,
    keywords: seo.keywords,
    openGraph: {
      title: seo.metaTitle || defaultTitle,
      description: seo.metaDescription || defaultDescription,
      url: baseUrl,
      siteName: "Sako",
      images: [
        {
          url:
            seo.ogImage === "auto"
              ? `${baseUrl}/api/og?title=${encodeURIComponent(page.frontmatter.title)}`
              : seo.ogImage || `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.metaTitle || defaultTitle,
      description: seo.metaDescription || defaultDescription,
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}

export default async function Home() {
  const page = await getPageBySlug("");

  if (!page) {
    // Fallback if MDX page not found
    return null;
  }

  const { frontmatter, content } = page;
  const schema = getSchemaForTemplate(frontmatter.template, {
    seo: frontmatter.seo,
    slug: "",
    updatedAt: frontmatter.updatedAt,
  });

  return (
    <>
      {/* Grid Background */}
      <div className="fixed inset-0 -z-40 pointer-events-none">
        <GridBackground
          gridSize="10:10"
          colors={{
            background: "bg-neutral-100",
            borderColor: "border-gray-200/80",
            borderSize: "1px",
            borderStyle: "solid",
          }}
          beams={{
            count: 8,
          }}
        />
      </div>

      {/* Gradient Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#9AE83E]/10 rounded-full blur-[100px] -z-40 pointer-events-none mix-blend-multiply"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px] -z-40 pointer-events-none mix-blend-multiply"></div>

      {/* Organization Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      {/* Page Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema),
        }}
      />

      <NavBar />

      <main>
        <MDXRemote
          source={content}
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
            },
            blockJS: false,
          }}
        />

        {/* LLM Copy Button - hidden on mobile due to clipboard API issues */}
        <div className="hidden md:flex justify-center mt-20 mb-8">
          <LLMCopyButton slug="" />
        </div>
      </main>

      <FooterWithEnd />
    </>
  );
}


