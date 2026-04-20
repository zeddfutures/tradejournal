// lib/calculate-correlations.js
// Calculates pairwise 20-day Pearson correlations on daily percentage returns.
// Input: history = { EURUSD: [p1, p2, ...], GBPUSD: [...], NQ: [...], ES: [...], DXY: [...] }
//   where each array is 25 most recent daily closes (newest first).

export function calculateCorrelations(history) {
  const instruments = Object.keys(history);
  const matrix = {};

  // Compute daily returns per instrument
  const returns = {};
  for (const inst of instruments) {
    const prices = history[inst];
    if (!prices || prices.length < 21) {
      returns[inst] = null;
      continue;
    }
    // Newest first, so return[0] = (prices[0] - prices[1]) / prices[1]
    const r = [];
    for (let i = 0; i < Math.min(20, prices.length - 1); i++) {
      r.push((prices[i] - prices[i + 1]) / prices[i + 1]);
    }
    returns[inst] = r;
  }

  // Pairwise correlations
  for (const a of instruments) {
    matrix[a] = {};
    for (const b of instruments) {
      if (a === b) {
        matrix[a][b] = 1.0;
        continue;
      }
      const corr = pearson(returns[a], returns[b]);
      matrix[a][b] = corr === null ? null : Number(corr.toFixed(2));
    }
  }

  return matrix;
}

function pearson(x, y) {
  if (!x || !y || x.length !== y.length || x.length === 0) return null;
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? null : num / den;
}
