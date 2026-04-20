// lib/fetch-macro.js
// Fetches DXY, US 10Y yield, VIX, WTI from FRED.
// FRED is free, unlimited, reliable — better than AlphaVantage for macro.
// Returns latest + previous observation for each.

const BASE = 'https://api.stlouisfed.org/fred/series/observations';

const SERIES = {
  DXY:  'DTWEXBGS',    // Trade weighted dollar index (daily, broad)
  US10Y:'DGS10',       // 10Y constant maturity yield
  VIX:  'VIXCLS',      // VIX close
  WTI:  'DCOILWTICO'   // WTI spot
};

export async function fetchMacro(apiKey) {
  if (!apiKey) {
    console.warn('[macro] FRED_KEY missing');
    return {};
  }

  const result = {};

  for (const [key, seriesId] of Object.entries(SERIES)) {
    try {
      // Get last 10 observations, pick most recent two non-missing
      const url = `${BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[macro] ${key} HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const obs = (json.observations || []).filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)));
      if (obs.length < 2) continue;

      const latest = parseFloat(obs[0].value);
      const prev   = parseFloat(obs[1].value);
      const change = latest - prev;
      const pctChange = (change / prev) * 100;

      result[key] = {
        value: latest,
        prev: prev,
        absChange: Number(change.toFixed(3)),
        pctChange: Number(pctChange.toFixed(3)),
        direction: change >= 0 ? 'up' : 'down',
        date: obs[0].date
      };
    } catch (err) {
      console.error(`[macro] ${key} error:`, err.message);
    }
  }

  return result;
}
