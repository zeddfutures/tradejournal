// netlify/functions/briefing.js
// On-demand endpoint: GET /.netlify/functions/briefing returns latest briefing JSON.
// Exposed to the dashboard at /api/briefing via redirect in netlify.toml.

import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  try {
    const store = getStore('briefings');
    const briefing = await store.get('latest.json', { type: 'json' });

    if (!briefing) {
      return new Response(JSON.stringify({
        error: 'No briefing generated yet. Wait for daily cron to run at 07:00 SGT.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(briefing), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    console.error('[briefing-api] error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
