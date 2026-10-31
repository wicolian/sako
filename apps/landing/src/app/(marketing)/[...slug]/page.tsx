import { notFound } from "next/navigation";
import { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getPageBySlug, generateAllStaticParams } from "@/lib/mdx";
import { getSchemaForTemplate, organizationSchema } from "@/lib/schemas";
import { getMDXComponents } from "@/lib/mdx-components";
import { NavBar, FooterWithEnd } from "@/components/landing";
import * as Blocks from "@/components/blocks";
import { GridBackground } from "@/components/ui/backgrounds/grid-background";
import { LLMCopyButton } from "@/components/ui/buttons/llm-copy-button";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

// MDX components including all blocks
const mdxComponents = {
  ...getMDXComponents({}),
  ...Blocks,
};

export async function generateStaticParams() {
  return generateAllStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug?.join("/") || "";
  const page = await getPageBySlug(slugPath);

  const baseUrl = "https://trysako.com";
  const defaultTitle = "Sako | Design Ops for B2B SaaS";
  const defaultDescription =
    "Sako plugs a dedicated design & motion pod into your Slack. Ship production-ready pages, decks, and motion assets in a strict 48-hour cycle.";

  if (!page || !page.frontmatter?.seo) {
    return {
      title: page?.frontmatter?.title || defaultTitle,
      description: defaultDescription,
    };
  }

  const { seo } = page.frontmatter;

  return {
    title: seo.metaTitle || page.frontmatter.title || defaultTitle,
    description: seo.metaDescription || defaultDescription,
    keywords: seo.keywords,
    openGraph: {
      title: seo.metaTitle || page.frontmatter.title || defaultTitle,
      description: seo.metaDescription || defaultDescription,
      url: `${baseUrl}/${slugPath}`,
      siteName: "Sako",
      images: [
        {
          url:
            seo.ogImage === "auto"
              ? `${baseUrl}/api/og?title=${encodeURIComponent(page.frontmatter.title)}`
              : seo.ogImage || `${baseUrl}/og-default.png`,
          width: 1200,
          height: 630,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.metaTitle || page.frontmatter.title || defaultTitle,
      description: seo.metaDescription || defaultDescription,
    },
    alternates: {
      canonical: `${baseUrl}/${slugPath}`,
    },
  };
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;
  const slugPath = slug?.join("/") || "";
  const page = await getPageBySlug(slugPath);

  if (!page) {
    notFound();
  }

  const { frontmatter, content } = page;
  const schema = getSchemaForTemplate(frontmatter.template, {
    seo: frontmatter.seo,
    slug: slugPath,
    updatedAt: frontmatter.updatedAt,
  });

  // Template-specific wrapper classes
  // Note: Hero sections have their own container constraints, so we don't constrain them
  const getTemplateClasses = () => {
    switch (frontmatter.template) {
      case "legal":
        return "max-w-[800px] mx-auto px-6 py-16";
      default:
        // Allow full-width for hero sections, other blocks have their own containers
        return "";
    }
  };

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

      <main className={`pt-20 ${getTemplateClasses()}`}>
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
          <LLMCopyButton slug={slugPath} />
        </div>
      </main>

      <FooterWithEnd />
    </>
  );
}


