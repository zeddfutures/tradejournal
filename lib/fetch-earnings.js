// lib/fetch-earnings.js
// Fetches upcoming earnings for MAG7 + VIX/context data from Finnhub.
// Free tier calendar endpoint available.

const BASE = 'https://finnhub.io/api/v1';

const MAG7 = [
  { ticker: 'MSFT',  name: 'Microsoft',  nqWeight: 6.2 },
  { ticker: 'GOOGL', name: 'Alphabet',   nqWeight: 4.1 },
  { ticker: 'AAPL',  name: 'Apple',      nqWeight: 8.5 },
  { ticker: 'AMZN',  name: 'Amazon',     nqWeight: 5.3 },
  { ticker: 'NVDA',  name: 'NVIDIA',     nqWeight: 7.8 },
  { ticker: 'META',  name: 'Meta',       nqWeight: 3.8 },
  { ticker: 'TSLA',  name: 'Tesla',      nqWeight: 2.8 },
];

export async function fetchEarnings(apiKey) {
  if (!apiKey) return [];

  // Date window: today to +7 days
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const to = weekAhead.toISOString().slice(0, 10);

  const results = [];

  try {
    const url = `${BASE}/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[earnings] HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const calendar = json.earningsCalendar || [];

    for (const mag of MAG7) {
      const entry = calendar.find(e => e.symbol === mag.ticker);
      if (!entry) continue;

      results.push({
        ticker: mag.ticker,
        name: mag.name,
        nqWeight: mag.nqWeight,
        date: entry.date,
        hour: entry.hour || 'amc',   // "bmo" before market open, "amc" after market close
        epsEstimate: entry.epsEstimate,
        epsActual: entry.epsActual,
        revenueEstimate: entry.revenueEstimate,
        revenueActual: entry.revenueActual
      });
    }
  } catch (err) {
    console.error('[earnings] error:', err.message);
  }

  // Sort by date ascending
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
