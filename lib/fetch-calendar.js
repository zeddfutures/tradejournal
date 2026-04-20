// lib/fetch-calendar.js
// Fetches economic calendar from ForexFactory XML feed.
// Free, no API key required.
// Returns high/medium impact events filtered for USD/EUR/GBP over next ~3 days.

import { XMLParser } from 'fast-xml-parser';

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

const RELEVANT_CURRENCIES = ['USD', 'EUR', 'GBP'];
const KEEP_IMPACTS = ['High', 'Medium'];

export async function fetchCalendar() {
  try {
    const res = await fetch(FF_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 ZeddFutures Briefing' }
    });
    if (!res.ok) throw new Error(`ForexFactory HTTP ${res.status}`);

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true });
    const parsed = parser.parse(xml);

    const events = parsed?.weeklyevents?.event || [];
    const rawEvents = Array.isArray(events) ? events : [events];

    // Next 3 days only
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 3);

    const filtered = rawEvents
      .filter(e => RELEVANT_CURRENCIES.includes(e.country))
      .filter(e => KEEP_IMPACTS.includes(e.impact))
      .map(e => {
        // ForexFactory dates are "MM-DD-YYYY", times "HH:MMam/pm" Eastern
        const dateTime = parseFFDateTime(e.date, e.time);
        return {
          title: e.title,
          currency: e.country,
          impact: e.impact,
          forecast: e.forecast || null,
          previous: e.previous || null,
          timeUTC: dateTime ? dateTime.toISOString() : null,
          timeSGT: dateTime ? formatSGT(dateTime) : 'TBD'
        };
      })
      .filter(e => {
        if (!e.timeUTC) return true; // keep TBD
        const d = new Date(e.timeUTC);
        return d >= now && d <= horizon;
      })
      .slice(0, 15); // cap for token budget

    return filtered;
  } catch (err) {
    console.error('[calendar] fetch failed:', err.message);
    return [];
  }
}

function parseFFDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr || timeStr === 'All Day' || timeStr === 'Tentative') return null;
  try {
    // dateStr: "MM-DD-YYYY", timeStr: "2:30pm"
    const [mm, dd, yyyy] = dateStr.split('-').map(Number);
    const match = timeStr.match(/(\d+):(\d+)(am|pm)/i);
    if (!match) return null;
    let [_, h, m, ap] = match;
    h = parseInt(h); m = parseInt(m);
    if (ap.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (ap.toLowerCase() === 'am' && h === 12) h = 0;
    // ForexFactory times are US Eastern. Convert ET → UTC (+5 winter, +4 summer).
    // Use a rough heuristic: DST Mar-Nov roughly → UTC offset 4, else 5.
    const inDST = (mm > 3 && mm < 11) || (mm === 3 && dd > 8) || (mm === 11 && dd < 2);
    const offsetHours = inDST ? 4 : 5;
    return new Date(Date.UTC(yyyy, mm - 1, dd, h + offsetHours, m));
  } catch {
    return null;
  }
}

function formatSGT(date) {
  // SGT = UTC+8
  const sgt = new Date(date.getTime() + 8 * 3600 * 1000);
  const day = sgt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const hh = String(sgt.getUTCHours()).padStart(2, '0');
  const mm = String(sgt.getUTCMinutes()).padStart(2, '0');
  return `${day} ${hh}:${mm}`;
}
