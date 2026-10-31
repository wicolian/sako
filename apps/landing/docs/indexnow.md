# IndexNow Integration

IndexNow is implemented to notify search engines (Bing, DuckDuckGo, Yandex, etc.) about new or updated content in real-time.

## How It Works

- **API Key**: `74c6f0a232914e46aeba9a5255a41eac`
- **Key Location**: Served via `https://trysako.com/api/indexnow/key`
- **API Endpoint**: `POST https://trysako.com/api/indexnow`

## Usage

### Manual Submission

**New blog post workflow:** After publishing in Sanity, run:

```bash
node scripts/submit-to-indexnow.js my-blog-post-slug
# Or with full URL:
node scripts/submit-to-indexnow.js "https://trysako.com/blog/my-blog-post"
```

**New MDX page workflow:** For new static pages (e.g. compare pages), submit the full URL:

```bash
node scripts/submit-to-indexnow.js "https://trysako.com/compare/manypixels"
node scripts/submit-to-indexnow.js "https://trysako.com/compare/flocksy"
```

**All commands:**

```bash
# Submit a single blog post by slug
node scripts/submit-to-indexnow.js my-blog-post-slug

# Submit a full URL
node scripts/submit-to-indexnow.js "https://trysako.com/blog/my-blog-post"

# Submit multiple posts
node scripts/submit-to-indexnow.js post-1 post-2 post-3

# Submit the sitemap
node scripts/submit-to-indexnow.js --sitemap

# Submit all URLs from sitemap (bulk re-submission after major content updates)
node scripts/submit-to-indexnow.js --all-pages
```

### ✅ Initial Submission Completed

**All blog posts and key pages have been submitted to IndexNow:**

**Blog Posts Submitted:**
- `the-design-bottleneck-tax-how-b2b-saas-teams-quietly-bleed-revenue-waiting-for-creative`
- `motion-design-in-b2b-saas-gtm-the-unfair-advantage-you-re-probably-underusing`
- `scaling-design-ops-without-hiring-the-sane-middle-path-between-freelancers-and-a-bloated-org`

**Key Pages Submitted:**
- Homepage (`https://trysako.com`)
- Pricing page (`https://trysako.com/pricing`)
- About page (`https://trysako.com/about`)
- Services page (`https://trysako.com/services`)
- Blog index (`https://trysako.com/blog`)
- Sitemap (`https://trysako.com/sitemap.xml`)

**Status:** ✅ All submissions successful (HTTP 200 responses)

### API Usage

```javascript
import { submitBlogPost, submitToIndexNow } from '@/lib/indexnow';

// Submit a single blog post
await submitBlogPost('my-blog-slug');

// Submit multiple URLs
await submitToIndexNow([
  'https://trysako.com/blog/post-1',
  'https://trysako.com/blog/post-2'
]);
```

### API Response

Success response:
```json
{
  "success": true,
  "message": "Submitted 1 URLs to IndexNow",
  "submitted": ["https://trysako.com/blog/test-post"]
}
```

## Verification

1. **Check key endpoint**: Visit `https://trysako.com/api/indexnow/key`
2. **Test API**: `GET https://trysako.com/api/indexnow`
3. **Bing Webmaster Tools**: Check submissions in your dashboard

## Search Engines Covered

- ✅ **Bing** (primary)
- ✅ **DuckDuckGo**
- ✅ **Yandex**
- ✅ **Other IndexNow partners**

Google doesn't support IndexNow but crawls your sitemap effectively.