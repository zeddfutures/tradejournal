// lib/fetch-prices.js
// Fetches current prices and 25 days of daily closes for correlation.
// AlphaVantage is rate limited (25 calls/day free tier) — we share across instruments.
//
// Strategy:
//   - Current spot + overnight change: AlphaVantage FX daily for EURUSD/GBPUSD,
//     AlphaVantage global quote for NQ/ES proxies, WTI via FX/commodities.
//   - 20-day rolling returns for correlation: stored 25 daily closes per instrument.
//
// AlphaVantage symbol notes:
//   FX:         uses FX_DAILY with from_symbol/to_symbol
//   Futures:    AlphaVantage doesn't cover futures directly. Use proxies:
//               NQ -> QQQ (Invesco Nasdaq-100 ETF)
//               ES -> SPY (SPDR S&P 500 ETF)
//   DXY:        use DX-Y.NYB via FX? Not supported. Use UUP ETF as proxy.
//   10Y:        FRED is better — handled in fetch-macro.js
//   WTI:        AlphaVantage has WTI endpoint (commodities).

const AV = 'https://www.alphavantage.co/query';

// We fetch using ETF proxies where futures aren't available.
const INSTRUMENTS = [
  { id: 'EURUSD', type: 'fx',    from: 'EUR', to: 'USD' },
  { id: 'GBPUSD', type: 'fx',    from: 'GBP', to: 'USD' },
  { id: 'NQ',     type: 'stock', symbol: 'QQQ' },  // proxy
  { id: 'ES',     type: 'stock', symbol: 'SPY' },  // proxy
  { id: 'DXY',    type: 'stock', symbol: 'UUP' },  // proxy
];

export async function fetchPrices(apiKey) {
  if (!apiKey) {
    console.warn('[prices] ALPHAVANTAGE_KEY missing');
    return { current: {}, history: {} };
  }

  const current = {};
  const history = {};

  for (const inst of INSTRUMENTS) {
    try {
      const data = await fetchDaily(inst, apiKey);
      if (!data) continue;

      // Latest two closes — overnight change
      const dates = Object.keys(data).sort().reverse();
      if (dates.length < 2) continue;

      const latest = parseFloat(data[dates[0]]['4. close']);
      const prev   = parseFloat(data[dates[1]]['4. close']);
      const pctChange = ((latest - prev) / prev) * 100;

      current[inst.id] = {
        price: latest,
        prevClose: prev,
        pctChange: Number(pctChange.toFixed(3)),
        direction: pctChange >= 0 ? 'up' : 'down'
      };

      // Last 25 closes for correlation
      history[inst.id] = dates.slice(0, 25).map(d => parseFloat(data[d]['4. close']));

      // Rate limit — 5 calls/minute free tier, sleep 13s between calls
      await sleep(13000);
    } catch (err) {
      console.error(`[prices] ${inst.id} error:`, err.message);
    }
  }

  return { current, history };
}

async function fetchDaily(inst, apiKey) {
  let url;
  if (inst.type === 'fx') {
    url = `${AV}?function=FX_DAILY&from_symbol=${inst.from}&to_symbol=${inst.to}&outputsize=compact&apikey=${apiKey}`;
  } else {
    url = `${AV}?function=TIME_SERIES_DAILY&symbol=${inst.symbol}&outputsize=compact&apikey=${apiKey}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
  const json = await res.json();

  // Rate-limit messages from AV come back as JSON too
  if (json.Note || json.Information) {
    throw new Error(`AV throttled: ${json.Note || json.Information}`);
  }

  const series = json['Time Series FX (Daily)'] || json['Time Series (Daily)'];
  if (!series) {
    console.warn(`[prices] no series for ${inst.id}:`, Object.keys(json));
    return null;
  }
  return series;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
