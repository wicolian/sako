const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '74c6f0a232914e46aeba9a5255a41eac';

export interface IndexNowResponse {
  success: boolean;
  message?: string;
  submitted?: string[];
  error?: string;
  details?: string;
}

/**
 * Submit URLs to IndexNow for immediate indexing
 * @param urls Array of URLs to submit
 * @returns Promise<IndexNowResponse>
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResponse> {
  try {
    const response = await fetch('https://trysako.com/api/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urlList: urls,
      }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      ...data,
    };
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return {
      success: false,
      error: 'Failed to submit URLs to IndexNow',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Submit a single blog post URL to IndexNow
 * @param slug Blog post slug
 * @returns Promise<IndexNowResponse>
 */
export async function submitBlogPost(slug: string): Promise<IndexNowResponse> {
  const url = `https://trysako.com/blog/${slug}`;
  return submitToIndexNow([url]);
}

/**
 * Submit multiple blog post URLs to IndexNow
 * @param slugs Array of blog post slugs
 * @returns Promise<IndexNowResponse>
 */
export async function submitBlogPosts(slugs: string[]): Promise<IndexNowResponse> {
  const urls = slugs.map(slug => `https://trysako.com/blog/${slug}`);
  return submitToIndexNow(urls);
}

/**
 * Submit the main sitemap URL to IndexNow
 * @returns Promise<IndexNowResponse>
 */
export async function submitSitemap(): Promise<IndexNowResponse> {
  return submitToIndexNow(['https://trysako.com/sitemap.xml']);
}