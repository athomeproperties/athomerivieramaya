import { findProperty, getBlockedNights } from './lib/availability.mjs';

// GET /api/availability?slug=opal-304
// -> { blocked: ['2026-10-01', ...], icalOk: true, hasFeed: true }
export default async (req) => {
  const slug = new URL(req.url).searchParams.get('slug') || '';
  if (!findProperty(slug)) return json({ error: 'Unknown property' }, 404);

  const { blocked, icalOk, hasFeed } = await getBlockedNights(slug);
  return json({ blocked: [...blocked].sort(), icalOk, hasFeed }, 200, {
    // Browsers always revalidate; Netlify's CDN may reuse the answer for 60s so a busy page doesn't re-fetch Airbnb each time.
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': 'public, s-maxage=60',
  });
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export const config = { path: '/api/availability' };
