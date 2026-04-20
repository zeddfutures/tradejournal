// lib/generate-briefing.js
// Takes all the gathered raw data and asks Claude to synthesize a morning briefing.
// Returns structured JSON matching the dashboard's schema exactly.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4000;

export async function generateBriefing(rawData) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = buildPrompt(rawData);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }]
  });

  // Expect text content
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Extract JSON — model may include prose before/after
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude response missing JSON block');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed;
}

function buildPrompt(data) {
  const { calendar, news, prices, earnings, macro, correlations, today } = data;

  // Compact the raw data for token efficiency
  const macroLines = Object.entries(macro || {}).map(([k, v]) =>
    `  ${k}: ${v.value} (${v.direction === 'up' ? '+' : ''}${v.pctChange}% vs prev)`
  ).join('\n');

  const priceLines = Object.entries(prices?.current || {}).map(([k, v]) =>
    `  ${k}: ${v.price} (${v.direction === 'up' ? '+' : ''}${v.pctChange}%)`
  ).join('\n');

  const calendarLines = (calendar || []).slice(0, 10).map(e =>
    `  ${e.timeSGT} ${e.currency} ${e.title} [${e.impact}] forecast: ${e.forecast || 'n/a'}`
  ).join('\n');

  const newsLines = (news || []).slice(0, 20).map(n =>
    `  [${n.tags.join(',')}] ${n.source} (${n.hoursAgo}h): ${n.headline}\n    ${n.summary.slice(0, 200)}`
  ).join('\n');

  const earningsLines = (earnings || []).map(e =>
    `  ${e.ticker} (${e.name}) on ${e.date} ${e.hour} — EPS est ${e.epsEstimate || 'n/a'}, NQ weight ${e.nqWeight}%`
  ).join('\n');

  return `You are writing the daily fundamental market briefing for a professional trader who trades EURUSD, GBPUSD, NQ (Nasdaq futures), and ES (S&P 500 futures).

Today is ${today}. Write the briefing as it would be read at 7 AM Singapore time (SGT).

Your job is to synthesize the raw data below into a structured JSON output matching the schema exactly. Be direct. No hype. No disclaimers. Write like a senior macro analyst briefing a trading desk.

=== MACRO DATA ===
${macroLines || '  (data unavailable)'}

=== OVERNIGHT PRICE MOVES ===
${priceLines || '  (data unavailable)'}

=== ECONOMIC CALENDAR (next 3 days) ===
${calendarLines || '  (no major events)'}

=== MAG7 EARNINGS (this week) ===
${earningsLines || '  (none scheduled)'}

=== RECENT NEWS (last 18h, tagged by instrument relevance) ===
${newsLines || '  (no significant news)'}

=== OUTPUT SCHEMA ===
Return ONLY valid JSON matching this exact structure. No markdown, no code fences, just the JSON object:

{
  "generatedAt": "ISO timestamp",
  "riskTone": "on" | "off" | "neutral",
  "marketContext": {
    "narrative": "2-3 sentences synthesizing what's driving markets today. Direct, no hedging."
  },
  "instruments": {
    "EURUSD": {
      "bias": "bullish" | "bearish" | "neutral",
      "summary": "3-4 sentences. What's the setup today. Key levels. Main catalyst.",
      "longAlignment": "supported" | "conflict" | "against" | "mixed",
      "shortAlignment": "supported" | "conflict" | "against" | "mixed",
      "fullAnalysis": {
        "bias": "1-2 sentence paragraph",
        "drivers": "paragraph explaining 2-3 main drivers today",
        "levels": "resistance and support levels",
        "risks": "paragraph on what could invalidate this view",
        "alignment": "paragraph on long/short setup alignment"
      },
      "articles": [
        { "title": "headline from news above", "source": "source", "date": "X hours ago", "url": "url from news if available" }
      ]
    },
    "GBPUSD": { ...same shape... },
    "NQ": { ...same shape... },
    "ES": { ...same shape... }
  },
  "earnings": [
    {
      "ticker": "MSFT",
      "name": "Microsoft",
      "date": "Wed 22 Apr",
      "timeSGT": "AMC · 04:30 SGT",
      "epsEstimate": "$3.24",
      "beatRate": "86% (8Q)",
      "nqWeight": "6.2%",
      "avgMove": "±3.8%",
      "interpretation": "2-3 sentences. What the market is watching. Likely impact on NQ/ES."
    }
  ],
  "headlines": [
    {
      "text": "headline text",
      "source": "source name",
      "hoursAgo": 3,
      "impact": "high" | "med" | "low",
      "affects": "comma-separated affected instruments"
    }
  ]
}

Rules:
- Pick the 3-5 articles per instrument that are MOST relevant from the news list above. Use the actual headlines and sources provided.
- For earnings "beatRate" and "avgMove", use plausible estimates based on general knowledge if specific data isn't provided (e.g. MSFT beats 80-90%, moves 3-5% on earnings).
- Headlines list: pick top 5-7 most market-moving from the news above. Impact = high/med/low based on likely market reaction.
- Risk tone: "on" if equities bid + VIX down + growth tilt; "off" if flight to safety + VIX up; "neutral" if mixed.
- Bias alignment: "supported" if fundamentals back the direction, "conflict" if some tension, "against" if fighting the theme, "mixed" if genuinely unclear.
- Write summaries as if the reader already understands trading. Don't explain what VWAP or 200 SMA means.
- If data is missing for an instrument, write "Limited data today" and set alignment to "mixed".

Return ONLY the JSON. No preamble. No code fences. No explanation.`;
}
