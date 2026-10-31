import { MetadataRoute } from 'next';
import { getPublishedPages } from '@/lib/mdx';
import { client } from '@/sanity/client';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://trysako.com';

  // Get all published MDX pages
  const pages = await getPublishedPages();

  // Get all published blog posts from Sanity
  const blogPosts = await client.fetch(
    `*[_type == "post" && published == true]{
      slug,
      publishedAt
    }`,
    {},
    { next: { revalidate: 60 } }
  );

  // Separate homepage from other pages
  const homepage = pages.find((page) => {
    const slug = page.frontmatter.slug || page.slug;
    return slug === '' || slug === '/';
  });

  const otherPages = pages.filter((page) => {
    const slug = page.frontmatter.slug || page.slug;
    return slug !== '' && slug !== '/';
  });

  // Homepage entry (from MDX if available, otherwise static)
  const homepageEntry = homepage ? {
    url: baseUrl,
    lastModified: homepage.frontmatter.updatedAt || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 1,
  } : {
    url: baseUrl,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 1,
  };

  const mdxPages = otherPages.map((page) => ({
    url: `${baseUrl}/${page.frontmatter.slug || page.slug}`,
    lastModified: page.frontmatter.updatedAt || new Date().toISOString(),
    changeFrequency: page.frontmatter.template === 'legal' ? 'monthly' as const : 'weekly' as const,
    priority: page.frontmatter.priority !== undefined
      ? 1 - (page.frontmatter.priority * 0.1)
      : 0.8,
  }));

  // Blog posts from Sanity
  const sanityBlogPages = blogPosts.map((post: any) => ({
    url: `${baseUrl}/blog/${post.slug.current}`,
    lastModified: post.publishedAt || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [homepageEntry, ...mdxPages, ...sanityBlogPages];
}


