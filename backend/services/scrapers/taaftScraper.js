/**
 * There's An AI For That (TAAFT) Scraper
 * Fetches newly launched AI tools from theresanaiforthat.com
 * 
 * TAAFT is the #1 AI tool directory (45,000+ tools).
 * Every listing is a real AI product with category, pricing, saves count.
 * Pure signal — every entry is a software product, zero noise.
 * 
 * Scrapes the "Just Released" section which shows tools from the last 7 days.
 */

const TrendPost = require('../../models/TrendPost');

const TAAFT_BASE = 'https://theresanaiforthat.com';
const DELAY_MS = 1500; // Be respectful

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Fetch and parse TAAFT's "Just Released" page
 */
async function fetchNewAITools() {
  const urls = [
    `${TAAFT_BASE}/just-released/`,
    `${TAAFT_BASE}/`,  // Homepage also shows recent tools
  ];

  const allTools = [];
  const seenIds = new Set();

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!res.ok) {
        console.error(`[TAAFT] HTTP ${res.status} for ${url}`);
        continue;
      }

      const html = await res.text();
      const tools = parseTAAFTPage(html);
      
      for (const tool of tools) {
        if (!seenIds.has(tool.sourceId)) {
          seenIds.add(tool.sourceId);
          allTools.push(tool);
        }
      }

      console.log(`[TAAFT] Parsed ${tools.length} tools from ${url}`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[TAAFT] Fetch error:`, err.message);
    }
  }

  return allTools;
}

/**
 * Parse TAAFT HTML to extract tool listings
 * 
 * TAAFT renders tools as <li> items inside <ul class="tasks">
 * Each <li> has data attributes: data-id, data-name, data-task, data-url
 * Contains: <a class="ai_link"> name, <div class="short_desc"> tagline,
 * <a class="task_label"> category
 */
function parseTAAFTPage(html) {
  const tools = [];
  const seenSlugs = new Set();

  // Each tool is an <li> with data-id, data-name, data-task attributes
  const itemPattern = /<li[^>]*data-id="(\d+)"[^>]*data-name="([^"]*)"[^>]*data-task="([^"]*)"[^>]*(?:data-url="([^"]*)")?[^>]*>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = itemPattern.exec(html)) !== null) {
    const dataId = match[1];
    const name = match[2].trim();
    const task = match[3].trim();
    const externalUrl = match[4] || '';
    const liContent = match[5];

    if (!name || seenSlugs.has(dataId)) continue;
    seenSlugs.add(dataId);

    // Extract slug from the internal link: href="/ai/SLUG/"
    const slugMatch = liContent.match(/href="\/ai\/([^"\/]+)\/?"/);
    const slug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/\s+/g, '-');

    // Extract tagline from <div class="short_desc">
    const descMatch = liContent.match(/<div[^>]*class="short_desc"[^>]*>([\s\S]*?)<\/div>/);
    const tagline = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    // Extract category emoji + label from <a class="task_label">
    const taskLabelMatch = liContent.match(/<a[^>]*class="task_label"[^>]*(?:data-before="([^"]*)")?[^>]*>([^<]*)<\/a>/);
    const categoryEmoji = taskLabelMatch ? taskLabelMatch[1] || '' : '';
    const categoryName = taskLabelMatch ? taskLabelMatch[2].trim() : task;

    tools.push({
      source: 'taaft',
      sourceId: `taaft_${dataId}`,
      title: `${name} — ${tagline || categoryName}`.replace(/\s+/g, ' ').trim(),
      content: [
        tagline || '',
        categoryName ? `Category: ${categoryEmoji} ${categoryName}`.trim() : '',
        externalUrl ? `Website: ${externalUrl.split('?')[0]}` : '',
        'Source: theresanaiforthat.com (AI tool directory)',
      ].filter(Boolean).join('\n'),
      url: `${TAAFT_BASE}/ai/${slug}/`,
      author: 'unknown',
      upvotes: 0,
      comments: 0,
      sourceCreatedAt: new Date(),
      fetchedAt: new Date(),
      metadata: {
        source_type: 'ai_tool_launch',
        category: categoryName,
        slug,
        externalUrl: externalUrl ? externalUrl.split('?')[0] : '',
      }
    });
  }

  return tools;
}

/**
 * Scrape TAAFT's trending/most-saved tools
 */
async function fetchTrendingAITools() {
  const trendingUrls = [
    `${TAAFT_BASE}/most-saved/`,
    `${TAAFT_BASE}/leaderboard/`,
  ];

  const allTools = [];
  const seenIds = new Set();

  for (const url of trendingUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!res.ok) continue;

      const html = await res.text();
      const tools = parseTAAFTPage(html);
      
      for (const tool of tools) {
        if (!seenIds.has(tool.sourceId)) {
          seenIds.add(tool.sourceId);
          // Mark trending tools
          tool.metadata.trending = true;
          allTools.push(tool);
        }
      }

      console.log(`[TAAFT] Parsed ${tools.length} trending tools from ${url}`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[TAAFT] Trending fetch error:`, err.message);
    }
  }

  return allTools;
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
      if (error.code !== 11000) console.error('[TAAFT] Save error:', error.message);
      skipped++;
    }
  }
  
  return { saved, skipped };
}

/**
 * Main scrape function
 */
async function scrapeTAAFT() {
  console.log('[TAAFT] Starting scrape...');
  
  const [newTools, trendingTools] = await Promise.all([
    fetchNewAITools(),
    fetchTrendingAITools(),
  ]);

  const allTools = [...newTools];
  const seenIds = new Set(allTools.map(t => t.sourceId));
  
  for (const t of trendingTools) {
    if (!seenIds.has(t.sourceId)) {
      seenIds.add(t.sourceId);
      allTools.push(t);
    }
  }

  console.log(`[TAAFT] Found ${allTools.length} total tools (${newTools.length} new, ${trendingTools.length} trending)`);

  if (allTools.length === 0) {
    return { saved: 0, skipped: 0, total: 0 };
  }

  const result = await savePosts(allTools);
  console.log(`[TAAFT] Saved ${result.saved}, skipped ${result.skipped} duplicates`);
  
  return { ...result, total: allTools.length };
}

/**
 * Quick scrape — just the homepage
 */
async function scrapeTAAFTQuick() {
  console.log('[TAAFT] Quick scrape...');
  const tools = await fetchNewAITools();
  if (tools.length === 0) return { saved: 0, skipped: 0, total: 0 };
  const result = await savePosts(tools);
  return { ...result, total: tools.length };
}

module.exports = {
  scrapeTAAFT,
  scrapeTAAFTQuick,
  fetchNewAITools,
  fetchTrendingAITools,
};
