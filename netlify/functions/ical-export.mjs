import { findProperty } from './lib/availability.mjs';
import { getBookings } from './lib/store.mjs';
import { buildIcal } from './lib/ical.mjs';

// GET /calendar/<slug>.ics?k=<CALENDAR_KEY>
// Paste this URL into Airbnb > Calendar > Availability > Connect calendars > Import calendar.
export default async (req) => {
  const url = new URL(req.url);
  const slug = decodeURIComponent(url.pathname.split('/').pop() || '').replace(/\.ics$/i, '');
  const prop = findProperty(slug);
  if (!prop) return new Response('Not found', { status: 404 });

  const key = process.env.CALENDAR_KEY;
  if (key && url.searchParams.get('k') !== key) return new Response('Forbidden', { status: 403 });

  const body = buildIcal({ name: prop.name, bookings: await getBookings(slug) });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
};

export const config = { path: '/calendar/*' };
