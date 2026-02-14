/**
 * GitHub Trending Scraper
 * Fetches trending repositories from github.com/trending
 * 
 * GitHub Trending shows what developers are actively building and excited about.
 * Great signal for developer tools, frameworks, and open-source products.
 * Can filter by language and time range.
 */

const TrendPost = require('../../models/TrendPost');

const GH_TRENDING_URL = 'https://github.com/trending';
const GH_API_URL = 'https://api.github.com';
const DELAY_MS = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Fetch trending repos from GitHub trending page
 */
async function fetchTrendingRepos() {
  // Scrape multiple time ranges and languages for broader coverage
  const variants = [
    { range: 'daily', lang: '' },
    { range: 'weekly', lang: '' },
    { range: 'daily', lang: 'python' },
    { range: 'daily', lang: 'typescript' },
    { range: 'daily', lang: 'javascript' },
    { range: 'daily', lang: 'rust' },
    { range: 'daily', lang: 'go' },
  ];

  const allRepos = [];
  const seenIds = new Set();

  for (const { range, lang } of variants) {
    try {
      const langPath = lang ? `/${lang}` : '';
      const url = `${GH_TRENDING_URL}${langPath}?since=${range}`;
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!res.ok) {
        console.error(`[GitHub] HTTP ${res.status} for ${url}`);
        continue;
      }

      const html = await res.text();
      const repos = parseGitHubTrending(html, range);
      
      for (const repo of repos) {
        if (!seenIds.has(repo.sourceId)) {
          seenIds.add(repo.sourceId);
          allRepos.push(repo);
        }
      }

      console.log(`[GitHub] ${range}${lang ? ` (${lang})` : ''}: ${repos.length} repos`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[GitHub] Fetch error:`, err.message);
    }
  }

  return allRepos;
}

/**
 * Parse GitHub trending HTML
 * 
 * GitHub trending shows repos with:
 * - owner/name
 * - Description
 * - Language
 * - Stars count
 * - Stars today/this week
 * - Forks
 */
function parseGitHubTrending(html, timeRange) {
  const repos = [];

  // GitHub trending uses <article class="Box-row"> for each repo
  const articles = html.match(/<article[\s\S]*?<\/article>/g);
  if (!articles) return repos;

  for (const article of articles) {
    // Repo link: href="/owner/name" inside <h2>
    const linkMatch = article.match(/<h2[^>]*>[\s\S]*?href="\/([^"]+)"[\s\S]*?<\/h2>/);
    if (!linkMatch) continue;
    const fullName = linkMatch[1].trim();
    
    // Extract owner and name
    const [owner, name] = fullName.split('/');
    if (!owner || !name) continue;

    // Skip GitHub system pages
    if (['apps', 'sponsors', 'login', 'explore', 'topics'].includes(owner.toLowerCase())) continue;

    // Description: <p class="col-9 color-fg-muted ...">
    const descMatch = article.match(/<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    // Language: <span itemprop="programmingLanguage">
    const langMatch = article.match(/<span\s+itemprop="programmingLanguage">(.*?)<\/span>/);
    const language = langMatch ? langMatch[1].trim() : '';

    // Stars: <a href="/owner/name/stargazers" ...> number </a>
    const starsMatch = article.match(/href="\/[^"]*\/stargazers"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/);
    const stars = starsMatch ? parseInt(starsMatch[1].replace(/,/g, '').trim()) : 0;

    // Forks: <a href="/owner/name/forks" ...> number </a>
    const forksMatch = article.match(/href="\/[^"]*\/forks"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/);
    const forks = forksMatch ? parseInt(forksMatch[1].replace(/,/g, '').trim()) : 0;

    // Stars today/this week: "583 stars today" in trailing span
    const todayMatch = article.match(/([\d,]+)\s+stars?\s+(today|this week|this month)/i);
    const starsToday = todayMatch ? parseInt(todayMatch[1].replace(/,/g, '')) : 0;
    const trendPeriod = todayMatch ? todayMatch[2] : 'today';

    // Built by: extract contributor usernames from alt attributes
    const builtByMatches = [...article.matchAll(/alt="@([^"]+)"/g)];
    const builtBy = builtByMatches.map(m => m[1]).join(', ');

    repos.push({
      source: 'github',
      sourceId: `gh_${fullName.replace(/\//g, '_')}`,
      title: `${fullName} — ${description || 'Trending on GitHub'}`,
      content: [
        description || '',
        language ? `Language: ${language}` : '',
        `Stars: ${stars.toLocaleString()}`,
        forks ? `Forks: ${forks.toLocaleString()}` : '',
        starsToday ? `⭐ +${starsToday} stars ${trendPeriod}` : '',
        builtBy ? `Built by: ${builtBy}` : '',
        `Trending on GitHub (${timeRange})`,
      ].filter(Boolean).join('\n'),
      url: `https://github.com/${fullName}`,
      author: owner,
      upvotes: stars,
      comments: forks,
      sourceCreatedAt: new Date(),
      fetchedAt: new Date(),
      metadata: {
        source_type: 'open_source_project',
        language,
        stars,
        forks,
        starsToday,
        timeRange,
      }
    });
  }

  return repos;
}

/**
 * Fetch additional repo details via GitHub API (optional, needs token)
 */
async function enrichWithAPI(repos) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return repos;

  console.log(`[GitHub] Enriching ${repos.length} repos with API data...`);
  
  for (const repo of repos.slice(0, 30)) { // Limit to avoid rate limiting
    try {
      const fullName = repo.url.replace('https://github.com/', '');
      const res = await fetch(`${GH_API_URL}/repos/${fullName}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ShouldIBuildIt-TrendScraper',
        }
      });

      if (!res.ok) continue;
      const data = await res.json();

      // Update with richer data
      repo.content = [
        data.description || repo.content,
        data.language ? `Language: ${data.language}` : '',
        `Stars: ${data.stargazers_count?.toLocaleString()}`,
        `Forks: ${data.forks_count?.toLocaleString()}`,
        `Open Issues: ${data.open_issues_count}`,
        data.topics?.length ? `Topics: ${data.topics.join(', ')}` : '',
        data.license?.name ? `License: ${data.license.name}` : '',
        `Created: ${new Date(data.created_at).toISOString().split('T')[0]}`,
      ].filter(Boolean).join('\n');
      
      repo.upvotes = data.stargazers_count || repo.upvotes;
      repo.comments = data.forks_count || repo.comments;
      repo.metadata.topics = data.topics || [];
      repo.metadata.license = data.license?.spdx_id;
      repo.metadata.openIssues = data.open_issues_count;

      await sleep(200);
    } catch (err) {
      // Skip enrichment errors
    }
  }

  return repos;
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
      if (error.code !== 11000) console.error('[GitHub] Save error:', error.message);
      skipped++;
    }
  }
  
  return { saved, skipped };
}

/**
 * Main scrape function
 */
async function scrapeGitHubTrending() {
  console.log('[GitHub] Starting scrape...');
  
  let repos = await fetchTrendingRepos();
  
  // Optionally enrich with API data
  repos = await enrichWithAPI(repos);

  console.log(`[GitHub] Found ${repos.length} trending repos`);

  if (repos.length === 0) {
    return { saved: 0, skipped: 0, total: 0 };
  }

  const result = await savePosts(repos);
  console.log(`[GitHub] Saved ${result.saved}, skipped ${result.skipped} duplicates`);
  
  return { ...result, total: repos.length };
}

/**
 * Quick scrape — just daily trending (all languages)
 */
async function scrapeGitHubTrendingQuick() {
  console.log('[GitHub] Quick scrape...');
  
  try {
    const res = await fetch(GH_TRENDING_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    if (!res.ok) return { saved: 0, skipped: 0, total: 0 };

    const html = await res.text();
    const repos = parseGitHubTrending(html, 'daily');
    
    if (repos.length === 0) return { saved: 0, skipped: 0, total: 0 };
    const result = await savePosts(repos);
    return { ...result, total: repos.length };
  } catch (err) {
    console.error('[GitHub] Quick scrape error:', err.message);
    return { saved: 0, skipped: 0, total: 0 };
  }
}

module.exports = {
  scrapeGitHubTrending,
  scrapeGitHubTrendingQuick,
};
