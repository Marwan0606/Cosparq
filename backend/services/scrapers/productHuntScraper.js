/**
 * Product Hunt Scraper
 * Fetches new product launches from Product Hunt
 * 
 * Two modes:
 * 1. GraphQL API (if PH_API_TOKEN is set) — structured data with upvotes, topics, descriptions
 * 2. HTML scraping fallback — parses the leaderboard page
 * 
 * Product Hunt is the #1 source for new startup/software launches.
 * Every post is a real product being launched — zero noise.
 */

const TrendPost = require('../../models/TrendPost');

const PH_GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';
const PH_LEADERBOARD_URL = 'https://www.producthunt.com/leaderboard/daily';
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── GraphQL API Mode ─────────────────────────────────────────────────────────

/**
 * Fetch posts via Product Hunt GraphQL API (requires developer token)
 */
async function fetchViaAPI(daysBack = 3) {
  const token = process.env.PH_API_TOKEN;
  if (!token) return null;

  console.log('[ProductHunt] Using GraphQL API...');
  const allPosts = [];

  for (let d = 0; d < daysBack; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const postedAfter = new Date(date);
    postedAfter.setHours(0, 0, 0, 0);
    const postedBefore = new Date(date);
    postedBefore.setHours(23, 59, 59, 999);

    const query = `
      query {
        posts(order: VOTES, postedAfter: "${postedAfter.toISOString()}", postedBefore: "${postedBefore.toISOString()}", first: 50) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              website
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
              makers {
                name
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch(PH_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        console.error(`[ProductHunt] API error: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const edges = data?.data?.posts?.edges || [];

      for (const { node } of edges) {
        const topics = (node.topics?.edges || []).map(e => e.node.name);
        const makers = (node.makers || []).map(m => m.name).join(', ');
        
        allPosts.push({
          source: 'producthunt',
          sourceId: `ph_${node.id}`,
          title: `${node.name} — ${node.tagline}`,
          content: [
            node.description || node.tagline,
            topics.length ? `Topics: ${topics.join(', ')}` : '',
            makers ? `Makers: ${makers}` : '',
            node.website ? `Website: ${node.website}` : ''
          ].filter(Boolean).join('\n'),
          url: node.url || `https://www.producthunt.com/posts/${node.name?.toLowerCase().replace(/\s+/g, '-')}`,
          author: makers || 'unknown',
          upvotes: node.votesCount || 0,
          comments: node.commentsCount || 0,
          sourceCreatedAt: new Date(node.createdAt),
          fetchedAt: new Date(),
          metadata: {
            source_type: 'product_launch',
            topics,
            website: node.website,
          }
        });
      }

      console.log(`[ProductHunt] API: ${edges.length} products from ${date.toISOString().split('T')[0]}`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[ProductHunt] API fetch error:`, err.message);
    }
  }

  return allPosts;
}


// ─── HTML Scraping Fallback ───────────────────────────────────────────────────

/**
 * Scrape Product Hunt leaderboard via HTML (no API key needed)
 */
async function fetchViaHTML(daysBack = 3) {
  console.log('[ProductHunt] Using HTML scraping fallback...');
  const allPosts = [];

  for (let d = 0; d < daysBack; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const url = `${PH_LEADERBOARD_URL}/${year}/${month}/${day}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!res.ok) {
        console.error(`[ProductHunt] HTML error for ${url}: ${res.status}`);
        continue;
      }

      const html = await res.text();

      // Parse products from the HTML using regex patterns
      // PH renders product cards with name, tagline, upvotes
      const products = parseProductHuntHTML(html, date);
      allPosts.push(...products);

      console.log(`[ProductHunt] HTML: ${products.length} products from ${year}-${month}-${day}`);
      await sleep(1000);
    } catch (err) {
      console.error(`[ProductHunt] HTML scrape error:`, err.message);
    }
  }

  return allPosts;
}

/**
 * Parse Product Hunt leaderboard HTML
 */
function parseProductHuntHTML(html, date) {
  const products = [];
  
  // Product Hunt renders JSON-LD or structured data we can extract
  // Also, product names and taglines appear in specific patterns
  
  // Method 1: Try to find JSON data in script tags
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const json = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data = JSON.parse(json);
        if (data['@type'] === 'Product' || data['@type'] === 'SoftwareApplication') {
          products.push({
            source: 'producthunt',
            sourceId: `ph_html_${data.name?.replace(/\s+/g, '_')}_${date.getTime()}`,
            title: data.name || '',
            content: data.description || '',
            url: data.url || '',
            author: 'unknown',
            upvotes: 0,
            comments: 0,
            sourceCreatedAt: date,
            fetchedAt: new Date(),
            metadata: { source_type: 'product_launch' }
          });
        }
      } catch (e) { /* skip invalid JSON */ }
    }
  }

  // Method 2: Regex-based extraction for product cards
  // PH uses structured markup. Look for product name + tagline patterns.
  const productPattern = /\[([^\]]+)\]\(https:\/\/www\.producthunt\.com\/products\/([^\)]+)\)/g;
  let match;
  const seen = new Set();
  
  while ((match = productPattern.exec(html)) !== null) {
    const name = match[1];
    const slug = match[2];
    
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Try to get tagline — it usually appears right after the product link
    const afterMatch = html.substring(match.index, match.index + 500);
    const taglineMatch = afterMatch.match(/\)([^[\n]{10,100}?)(?:\[|$)/);
    const tagline = taglineMatch ? taglineMatch[1].trim() : '';

    // Try to get upvotes — look for numbers near the product
    const votesMatch = afterMatch.match(/(\d+)\s*$/m);
    const upvotes = votesMatch ? parseInt(votesMatch[1]) : 0;

    products.push({
      source: 'producthunt',
      sourceId: `ph_${slug}_${date.getTime()}`,
      title: tagline ? `${name} — ${tagline}` : name,
      content: tagline || name,
      url: `https://www.producthunt.com/products/${slug}`,
      author: 'unknown',
      upvotes,
      comments: 0,
      sourceCreatedAt: date,
      fetchedAt: new Date(),
      metadata: { source_type: 'product_launch', slug }
    });
  }

  return products;
}


// ─── Save & Main Functions ────────────────────────────────────────────────────

async function savePosts(posts) {
  let saved = 0, skipped = 0;
  
  for (const post of posts) {
    try {
      const result = await TrendPost.findOneAndUpdate(
        { source: post.source, sourceId: post.sourceId },
        { $setOnInsert: post },
        { upsert: true, new: true, rawResult: true }
      );
      if (result.lastErrorObject?.updatedExisting === false) saved++;
      else skipped++;
    } catch (error) {
      if (error.code !== 11000) console.error('[ProductHunt] Save error:', error.message);
      skipped++;
    }
  }
  
  return { saved, skipped };
}

/**
 * Main scrape function — tries API first, falls back to HTML
 * Note: Product Hunt blocks server-side HTML requests with 403.
 * The HTML fallback is kept for reference but will likely fail.
 * For reliable scraping, set PH_API_TOKEN env var with a developer token
 * from https://www.producthunt.com/v2/oauth/applications
 */
async function scrapeProductHunt(daysBack = 7) {
  console.log('[ProductHunt] Starting scrape...');
  
  let posts = await fetchViaAPI(daysBack);
  
  if (!posts || posts.length === 0) {
    console.log('[ProductHunt] API not available (set PH_API_TOKEN). Trying HTML fallback...');
    posts = await fetchViaHTML(daysBack);
  }
  
  if (!posts || posts.length === 0) {
    console.log('[ProductHunt] No posts found. Get a free API token at https://www.producthunt.com/v2/oauth/applications');
    return { saved: 0, skipped: 0, total: 0 };
  }

  console.log(`[ProductHunt] Found ${posts.length} products`);
  const result = await savePosts(posts);
  console.log(`[ProductHunt] Saved ${result.saved}, skipped ${result.skipped} duplicates`);
  
  return { ...result, total: posts.length };
}

/**
 * Quick scrape — just today + yesterday
 */
async function scrapeProductHuntQuick() {
  return scrapeProductHunt(2);
}

module.exports = {
  scrapeProductHunt,
  scrapeProductHuntQuick,
  fetchViaAPI,
  fetchViaHTML,
};
