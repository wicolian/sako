import Link from "next/link";
import { notFound } from "next/navigation";
import { client } from "@/sanity/client";
import { NavBar, FooterWithEnd } from "@/components/landing";
import { NewsletterForm } from "@/components/blocks/NewsletterForm";
import { BlogContent } from "@/components/blog/BlogContent";
import { TableOfContents, MobileTOC } from "@/components/blog/TableOfContents";
import { SidebarStack } from "@/components/blog/SidebarStack";
import { MobileBottomBar } from "@/components/blog/MobileBottomBar";
import { RecommendedPosts } from "@/components/blog/RecommendedPosts";
import { AuthorCard } from "@/components/blog/AuthorCard";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { extractHeadings, readTime, formatDate } from "@/lib/blog-helpers";
import type { PTBlock } from "@/lib/blog-helpers";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import type { Metadata } from "next";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id, title, slug, publishedAt, image, body, category, excerpt, metaDescription, keywords
}`;
const RELATED_QUERY = `*[_type == "post" && slug.current != $slug && category == $category && defined(slug.current)] | order(publishedAt desc)[0...3]{title, slug, category, excerpt, image}`;
const FALLBACK_QUERY = `*[_type == "post" && slug.current != $slug && defined(slug.current)] | order(publishedAt desc)[0...3]{title, slug, category, excerpt, image}`;
export const revalidate = 3600;

const options = { next: { revalidate: 3600 } };

const { projectId, dataset } = client.config();
const urlFor = (source: SanityImageSource) =>
  projectId && dataset
    ? imageUrlBuilder({ projectId, dataset }).image(source)
    : null;

const BASE_URL = "https://trysako.com";

/* ── Metadata ── */
export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await client.fetch(POST_QUERY, { slug }, options);
  if (!post) return { title: "Post Not Found | Sako" };

  const canonicalUrl = `${BASE_URL}/blog/${post.slug.current}`;
  const description =
    post.metaDescription ||
    post.excerpt ||
    "Read the latest insights from Sako.";

  return {
    title: `${post.title} | Sako`,
    description,
    keywords: post.keywords,
    authors: [{ name: "Your Founder" }],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: post.title,
      description,
      url: canonicalUrl,
      siteName: "Sako",
      type: "article",
      publishedTime: post.publishedAt,
      authors: ["Your Founder"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

/* ── Static Params ── */
export async function generateStaticParams() {
  try {
    const posts = (await client.fetch(
      `*[_type == "post" && defined(slug.current)]{ slug }`,
      {},
      { next: { revalidate: 60 } }
    )) as Array<{ slug: { current: string } }>;
    return posts.map((p) => ({ slug: p.slug.current }));
  } catch {
    return [];
  }
}

/* ── Page ── */
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await client.fetch(POST_QUERY, { slug }, options);
  if (!post) notFound();

  const postImageUrl = post.image
    ? urlFor(post.image)?.width(1400).height(700).fit("crop").url()
    : null;

  let relatedPosts: any[] = await client.fetch(
    RELATED_QUERY,
    { slug, category: post.category ?? "" },
    options
  );
  if (!relatedPosts?.length)
    relatedPosts = await client.fetch(FALLBACK_QUERY, { slug }, options);

  const builder = projectId && dataset ? imageUrlBuilder({ projectId, dataset }) : null;
  const relatedPostsWithImages = relatedPosts.map((rp) => ({
    ...rp,
    imageUrl: rp.image && builder ? builder.image(rp.image)?.width(400).height(250).fit("crop").url() : undefined
  }));

  const tocItems = extractHeadings(post.body ?? []);
  const mins = readTime(post.body ?? []);
  const canonicalUrl = `${BASE_URL}/blog/${post.slug.current}`;
  const description = post.metaDescription || post.excerpt || 'Read the latest insights from Sako.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    author: { '@type': 'Person', name: 'Your Founder' },
    publisher: { '@type': 'Organization', name: 'Sako', url: BASE_URL },
    datePublished: post.publishedAt,
    keywords: (post.keywords ?? []).join(', '),
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />

      <main className="bg-white min-h-screen">
        {/* ── DARK HERO HEADER ── */}
        <header className="bg-[#0A0A0A] pt-32 sm:pt-40 pb-20 px-6 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-[#9AE83E]/5 blur-3xl rounded-full" />

          <div className="mx-auto max-w-4xl text-center relative z-10">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-gray-400 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white transition-all mb-8"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Journal
            </Link>

            <h1 className="mt-2 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.15] mb-8">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400 font-medium">
              <span className="text-[#9AE83E]">
                {post.category || "Article"}
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <time>{formatDate(post.publishedAt)}</time>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span>{mins} min read</span>
            </div>
          </div>
        </header>

        {/* ── OPTIONAL HERO IMAGE ── */}
        {postImageUrl && (
          <div className="mx-auto max-w-6xl px-6 -mt-10 relative z-20">
            <img
              src={postImageUrl}
              alt={post.title}
              className="w-full max-h-[500px] object-cover rounded-2xl shadow-2xl ring-1 ring-gray-900/10"
            />
          </div>
        )}

        {/* ── 3-COLUMN CONTENT AREA ── */}
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-24">
          {/* Mobile TOC */}
          <MobileTOC items={tocItems} />

          {/* Desktop Grid: TOC | Content | Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_260px] xl:grid-cols-[240px_minmax(0,1fr)_280px] gap-8 lg:gap-10 xl:gap-12">
            {/* LEFT — ToC (desktop only) */}
            <aside className="hidden lg:block">
              <div className="sticky top-32 max-h-[calc(100vh-10rem)] overflow-y-auto pr-4">
                <TableOfContents items={tocItems} />
              </div>
            </aside>

            {/* CENTER — Article */}
            <article className="min-w-0">
              {/* Mobile author + share — desktop shows these in the right sidebar */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100 lg:hidden">
                <AuthorCard />
                <ShareButtons url={canonicalUrl} title={post.title} />
              </div>

              <div className="blog-content mx-auto" style={{ maxWidth: "72ch" }}>
                {post.excerpt && (
                  <p className="text-xl sm:text-2xl leading-relaxed text-gray-500 mb-12 font-medium">
                    {post.excerpt}
                  </p>
                )}
                <BlogContent content={post.body} />
              </div>

              {/* Separator */}
              <div className="my-16 flex items-center justify-center gap-4">
                <div className="w-12 h-px bg-gray-200" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#9AE83E]" />
                <div className="w-12 h-px bg-gray-200" />
              </div>

              {/* Bottom CTA inline */}
              <div className="mt-16 bg-[#0A0A0A] rounded-3xl p-10 sm:p-14 text-center shadow-xl border border-gray-900 group max-w-3xl mx-auto">
                <p className="inline-flex items-center gap-2 rounded-full bg-[#9AE83E]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#9AE83E] ring-1 ring-inset ring-[#9AE83E]/20 mb-6">
                  Ready to ship?
                </p>
                <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                  Design that earns its keep.
                </h2>
                <p className="text-gray-400 text-base mb-10 max-w-md mx-auto leading-relaxed">
                  Convert-ready GTM assets in 48h. Month-to-month, 14-day
                  money-back guarantee.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="https://app.trysako.com"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#9AE83E] text-black rounded-full font-bold text-sm tracking-wide hover:bg-[#8ad932] transition-colors w-full sm:w-auto"
                  >
                    Start Shipping
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/book-a-call"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border border-white/20 text-white rounded-full font-medium text-sm tracking-wide hover:bg-white/10 transition-colors w-full sm:w-auto"
                  >
                    Book a fit check
                  </Link>
                </div>
              </div>

              {/* Newsletter */}
              <div className="mt-8 bg-gray-50 rounded-3xl border border-gray-100 p-10 sm:p-14 shadow-sm max-w-3xl mx-auto">
                <div className="max-w-md mx-auto text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#9AE83E] mb-3">
                    Newsletter
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Stay sharp on design ops
                  </h3>
                  <p className="text-gray-500 text-base mb-8 leading-relaxed">
                    Practical tips on shipping GTM creative faster. No spam,
                    unsubscribe anytime.
                  </p>
                  <NewsletterForm
                    variant="standalone"
                    heading=""
                    description=""
                    ctaLabel="Subscribe →"
                  />
                </div>
              </div>
            </article>

            {/* RIGHT — Sidebar (desktop only) */}
            <aside className="hidden lg:block">
              <div className="sticky top-32 max-h-[calc(100vh-10rem)] overflow-y-auto">
                <SidebarStack
                  shareUrl={canonicalUrl}
                  shareTitle={post.title}
                />
              </div>
            </aside>
          </div>
        </div>

        {/* Recommended Posts */}
        <div className="border-t border-gray-100 bg-gray-50 py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <RecommendedPosts posts={relatedPostsWithImages ?? []} />
          </div>
        </div>
      </main>

      {/* Mobile bottom CTA bar */}
      <MobileBottomBar shareUrl={canonicalUrl} shareTitle={post.title} />

      <FooterWithEnd />
    </>
  );
}
