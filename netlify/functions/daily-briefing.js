// netlify/functions/daily-briefing.js
// Scheduled Netlify Function — runs daily at 07:00 SGT (23:00 UTC).
// Orchestrates all fetchers, calls Claude, writes briefing.json to Netlify Blobs.
//
// Schedule is defined in netlify.toml, not here.

import { schedule } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { fetchCalendar } from '../../lib/fetch-calendar.js';
import { fetchNews } from '../../lib/fetch-news.js';
import { fetchPrices } from '../../lib/fetch-prices.js';
import { fetchEarnings } from '../../lib/fetch-earnings.js';
import { fetchMacro } from '../../lib/fetch-macro.js';
import { calculateCorrelations } from '../../lib/calculate-correlations.js';
import { generateBriefing } from '../../lib/generate-briefing.js';

const handler = async (event) => {
  const startedAt = new Date();
  console.log(`[briefing] start ${startedAt.toISOString()}`);

  try {
    // Pull all raw data in parallel where possible
    const [calendar, news, earnings, macro] = await Promise.all([
      fetchCalendar(),
      fetchNews(process.env.FINNHUB_KEY),
      fetchEarnings(process.env.FINNHUB_KEY),
      fetchMacro(process.env.FRED_KEY),
    ]);

    // Prices fetched sequentially (AlphaVantage rate limits)
    const prices = await fetchPrices(process.env.ALPHAVANTAGE_KEY);
    const correlations = calculateCorrelations(prices.history || {});

    const today = startedAt.toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Asia/Singapore'
    });

    console.log(`[briefing] raw data: ${calendar.length} events, ${news.length} news, ${earnings.length} earnings, ${Object.keys(macro).length} macro, ${Object.keys(prices.current || {}).length} prices`);

    // Call Claude to synthesize
    const briefing = await generateBriefing({
      calendar, news, prices, earnings, macro, correlations, today
    });

    // Attach raw overnight moves + correlations + macro so the dashboard
    // has the hard numbers without depending on Claude to repeat them
    briefing.overnight = prices.current;
    briefing.macro = macro;
    briefing.correlations = correlations;
    briefing.meta = {
      generatedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      dataQuality: {
        calendar: calendar.length,
        news: news.length,
        earnings: earnings.length,
        prices: Object.keys(prices.current || {}).length,
        macro: Object.keys(macro).length
      }
    };

    // Store in Netlify Blobs — served via the separate /data/briefing.json endpoint
    const store = getStore('briefings');
    await store.setJSON('latest.json', briefing);

    // Also keep a dated history for backtesting later
    const dateKey = startedAt.toISOString().slice(0, 10);
    await store.setJSON(`history/${dateKey}.json`, briefing);

    console.log(`[briefing] success — ${Date.now() - startedAt.getTime()}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, duration: Date.now() - startedAt.getTime() })
    };
  } catch (err) {
    console.error('[briefing] FAILED:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

export default schedule('0 23 * * *', handler);
