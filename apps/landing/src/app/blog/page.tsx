import { Suspense } from "react";
import { client } from "@/sanity/client";
import { NavBar, FooterWithEnd } from "@/components/landing";
import { BlogListClient } from "@/components/blog/BlogListClient";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sako Journal | Design Ops, Revenue, GTM for B2B SaaS",
  description:
    "Practical insights on design ops, ROI-driven design, and GTM execution for B2B SaaS teams.",
  keywords: ["design ops blog", "SaaS design insights", "GTM design", "design ROI B2B"],
  openGraph: {
    title: "Sako Journal | Design Ops, Revenue, GTM for B2B SaaS",
    description: "Practical insights on design ops, ROI-driven design, and GTM execution.",
    url: "https://trysako.com/blog",
    siteName: "Sako",
    type: "website",
  },
  alternates: { canonical: "https://trysako.com/blog" },
};

const POSTS_QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
  _id, title, slug, publishedAt, category, excerpt, image
}`;

export default async function BlogPage() {
  const posts = await client.fetch(POSTS_QUERY, {}, { next: { revalidate: 60 } }) as Array<{
    _id: string;
    title: string;
    slug: { current: string };
    publishedAt: string;
    category?: string;
    excerpt?: string;
    image?: any;
  }>;

  const { projectId, dataset } = client.config();
  const builder = projectId && dataset ? require("@sanity/image-url").default({ projectId, dataset }) : null;
  const urlFor = (source: any) => builder?.image(source);

  const postsWithImages = posts.map(post => ({
    ...post,
    imageUrl: post.image && builder ? urlFor(post.image)?.width(800).height(450).fit("crop").url() : undefined
  }));

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-white">
        <Suspense fallback={null}>
          <BlogListClient posts={postsWithImages} />
        </Suspense>
      </main>
      <FooterWithEnd />
    </>
  );
}
