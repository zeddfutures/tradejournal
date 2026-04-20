// lib/fetch-news.js
// Fetches recent market news from Finnhub.
// Free tier: 60 calls/minute. We make ~3 calls total.
// Returns a deduplicated, relevance-scored list for Claude to analyze.

const BASE = 'https://finnhub.io/api/v1';

// Categories to pull. 'forex' for FX narrative, 'general' for macro/geopolitics.
const CATEGORIES = ['forex', 'general'];

// Keyword relevance scoring — tags each headline with affected instruments.
const TAGS = {
  EURUSD: /\b(euro|EUR|eurozone|ECB|Lagarde|bund|german|france|italy)\b/i,
  GBPUSD: /\b(pound|sterling|GBP|BOE|Bailey|UK|british|gilt|cable)\b/i,
  USD: /\b(dollar|USD|DXY|Fed|Powell|FOMC|treasury|yield)\b/i,
  NQ: /\b(nasdaq|NQ|tech|MSFT|GOOGL|NVDA|META|AAPL|AMZN|TSLA|AI|semiconductor)\b/i,
  ES: /\b(S&P|SPX|ES|equities|stock market|earnings|index)\b/i,
  OIL: /\b(oil|WTI|crude|OPEC|barrel|energy)\b/i,
  GEO: /\b(iran|israel|russia|ukraine|china|hormuz|ceasefire|war|conflict|sanctions)\b/i
};

export async function fetchNews(apiKey) {
  if (!apiKey) {
    console.warn('[news] FINNHUB_KEY missing');
    return [];
  }

  const allItems = [];
  for (const cat of CATEGORIES) {
    try {
      const url = `${BASE}/news?category=${cat}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[news] ${cat} HTTP ${res.status}`);
        continue;
      }
      const items = await res.json();
      if (Array.isArray(items)) allItems.push(...items);
    } catch (err) {
      console.error(`[news] ${cat} error:`, err.message);
    }
  }

  // Dedupe by headline
  const seen = new Set();
  const unique = allItems.filter(i => {
    const key = (i.headline || '').slice(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filter to last 18h, tag, score
  const cutoff = Date.now() / 1000 - (18 * 3600);
  const scored = unique
    .filter(i => i.datetime && i.datetime > cutoff)
    .map(i => {
      const headline = i.headline || '';
      const summary = i.summary || '';
      const text = headline + ' ' + summary;
      const tags = [];
      for (const [tag, re] of Object.entries(TAGS)) {
        if (re.test(text)) tags.push(tag);
      }
      return {
        headline,
        summary: summary.slice(0, 300),
        source: i.source || 'Unknown',
        url: i.url || '#',
        datetime: i.datetime,
        hoursAgo: Math.round((Date.now() / 1000 - i.datetime) / 3600),
        tags,
        relevance: tags.length
      };
    })
    .filter(i => i.relevance > 0) // must tag at least one instrument
    .sort((a, b) => b.relevance - a.relevance || b.datetime - a.datetime)
    .slice(0, 25); // cap to 25 best for token budget

  return scored;
}
