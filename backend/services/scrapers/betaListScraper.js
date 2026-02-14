/**
 * BetaList Scraper
 * Fetches early-stage startup listings from betalist.com
 * 
 * BetaList is a curated directory of startups in beta/early stage.
 * Every listing is a real startup looking for early users — pure signal.
 * Organized by date with daily listings.
 */

const TrendPost = require('../../models/TrendPost');

const BETALIST_BASE = 'https://betalist.com';
const DELAY_MS = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Fetch and parse BetaList homepage (shows recent startups by date)
 */
async function fetchBetaListStartups() {
  const urls = [
    BETALIST_BASE,
    `${BETALIST_BASE}/topics/saas`,
    `${BETALIST_BASE}/topics/ai-tools`,
  ];

  const allStartups = [];
  const seenIds = new Set();

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      if (!res.ok) {
        console.error(`[BetaList] HTTP ${res.status} for ${url}`);
        continue;
      }

      const html = await res.text();
      const startups = parseBetaListHTML(html);
      
      for (const s of startups) {
        if (!seenIds.has(s.sourceId)) {
          seenIds.add(s.sourceId);
          allStartups.push(s);
        }
      }

      console.log(`[BetaList] Parsed ${startups.length} startups from ${url}`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[BetaList] Fetch error:`, err.message);
    }
  }

  return allStartups;
}

/**
 * Parse BetaList HTML to extract startup listings
 * 
 * BetaList uses a class "startup-row" for each listing:
 * - <a href="/startups/SLUG"> — the startup link
 * - <span class="... font-medium ...">Name</span> — startup name
 * - <span class="text-gray-500 ...">Description</span> — tagline
 * - Grouped by date headers (e.g. "February 6th")
 */
function parseBetaListHTML(html) {
  const startups = [];
  const seenSlugs = new Set();

  // Split by startup-row class to get individual blocks
  // Each startup row contains href="/startups/slug", name span, description span
  const rowPattern = /startup-row[\s\S]*?href="\/startups\/([^"]+)"[\s\S]*?<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>\s*<span[^>]*class="[^"]*text-gray-(?:500|400)[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/g;
  let match;

  while ((match = rowPattern.exec(html)) !== null) {
    const slug = match[1].trim();
    const name = match[2].replace(/<[^>]*>/g, '').trim();
    const tagline = match[3].replace(/<[^>]*>/g, '').trim();

    if (!slug || !name || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    // Skip non-startup links
    if (['sign_in', 'submit', 'newsletter', 'search'].includes(slug)) continue;

    startups.push({
      source: 'betalist',
      sourceId: `bl_${slug}`,
      title: tagline ? `${name} — ${tagline}` : name,
      content: [
        tagline || `${name} - early stage startup`,
        'Source: BetaList (early-stage startup directory)',
      ].filter(Boolean).join('\n'),
      url: `${BETALIST_BASE}/startups/${slug}`,
      author: 'unknown',
      upvotes: 0,
      comments: 0,
      sourceCreatedAt: new Date(),
      fetchedAt: new Date(),
      metadata: {
        source_type: 'beta_startup',
        topic: '',
        slug,
      }
    });
  }

  return startups;
}

/**
 * Scrape BetaList topic pages for specific categories
 */
async function fetchBetaListByTopic() {
  const topics = [
    'saas', 'developer-tools', 'ai-tools', 'web-tools',
    'project-management', 'analytics', 'b2b', 'collaboration',
    'marketing', 'fintech', 'health-fitness',
  ];

  const allStartups = [];
  const seenIds = new Set();

  for (const topic of topics) {
    try {
      const res = await fetch(`${BETALIST_BASE}/topics/${topic}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!res.ok) continue;

      const html = await res.text();
      const startups = parseBetaListHTML(html);
      
      for (const s of startups) {
        if (!seenIds.has(s.sourceId)) {
          seenIds.add(s.sourceId);
          s.metadata.topic = topic;
          allStartups.push(s);
        }
      }

      console.log(`[BetaList] Topic ${topic}: ${startups.length} startups`);
      await sleep(DELAY_MS);
    } catch (err) {
      // Skip failed topics
    }
  }

  return allStartups;
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
      if (error.code !== 11000) console.error('[BetaList] Save error:', error.message);
      skipped++;
    }
  }
  
  return { saved, skipped };
}

/**
 * Main scrape function
 */
async function scrapeBetaList() {
  console.log('[BetaList] Starting scrape...');
  
  const [homepage, byTopic] = await Promise.all([
    fetchBetaListStartups(),
    fetchBetaListByTopic(),
  ]);

  const allStartups = [...homepage];
  const seenIds = new Set(allStartups.map(s => s.sourceId));
  
  for (const s of byTopic) {
    if (!seenIds.has(s.sourceId)) {
      seenIds.add(s.sourceId);
      allStartups.push(s);
    }
  }

  console.log(`[BetaList] Found ${allStartups.length} total startups`);

  if (allStartups.length === 0) {
    return { saved: 0, skipped: 0, total: 0 };
  }

  const result = await savePosts(allStartups);
  console.log(`[BetaList] Saved ${result.saved}, skipped ${result.skipped} duplicates`);
  
  return { ...result, total: allStartups.length };
}

/**
 * Quick scrape — just homepage
 */
async function scrapeBetaListQuick() {
  console.log('[BetaList] Quick scrape...');
  const startups = await fetchBetaListStartups();
  if (startups.length === 0) return { saved: 0, skipped: 0, total: 0 };
  const result = await savePosts(startups);
  return { ...result, total: startups.length };
}

module.exports = {
  scrapeBetaList,
  scrapeBetaListQuick,
};
