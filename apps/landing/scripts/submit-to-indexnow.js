#!/usr/bin/env node

/**
 * Script to manually submit URLs to IndexNow
 * Usage: node scripts/submit-to-indexnow.js "https://trysako.com/blog/my-post"
 * Or: node scripts/submit-to-indexnow.js blog-slug (for blog posts)
 */

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';

async function submitToIndexNow(urls) {
  try {
    console.log(`Submitting ${urls.length} URLs to IndexNow...`);
    console.log('Key:', INDEXNOW_KEY);
    console.log('Key location:', `https://trysako.com/${INDEXNOW_KEY}.txt`);
    console.log('URLs:', urls);

    const payload = {
      host: 'trysako.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://trysako.com/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'IndexNow/1.0',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Raw response:', responseText || '(empty response)');

    let result = null;
    if (responseText.trim()) {
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.log('Response is not JSON (this is normal for IndexNow)');
      }
    }

    if (response.ok) {
      console.log('✅ Success! URLs submitted to IndexNow:');
      urls.forEach(url => console.log(`   - ${url}`));
      console.log('🎯 IndexNow submission completed successfully!');
    } else {
      console.error('❌ Error submitting to IndexNow:', result || responseText);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

async function fetchSitemapUrls() {
  const sitemapUrl = 'https://trysako.com/sitemap.xml';
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }
  const xml = await response.text();
  const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  const urls = [...urlMatches].map(m => m[1]);
  return urls;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/submit-to-indexnow.js "https://trysako.com/blog/my-post"');
    console.log('  node scripts/submit-to-indexnow.js blog-slug-1 blog-slug-2');
    console.log('  node scripts/submit-to-indexnow.js --sitemap  # Submit sitemap');
    console.log('  node scripts/submit-to-indexnow.js --all-pages  # Submit all URLs from sitemap');
    process.exit(1);
  }

  let urls = [];

  if (args[0] === '--sitemap') {
    urls = ['https://trysako.com/sitemap.xml'];
  } else if (args[0] === '--all-pages') {
    console.log('Fetching sitemap...');
    urls = await fetchSitemapUrls();
    console.log(`Found ${urls.length} URLs in sitemap`);
    if (urls.length === 0) {
      console.error('No URLs found in sitemap');
      process.exit(1);
    }
  } else {
    urls = args.map(arg => {
      if (arg.startsWith('http')) {
        return arg;
      } else {
        return `https://trysako.com/blog/${arg}`;
      }
    });
  }

  submitToIndexNow(urls);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}