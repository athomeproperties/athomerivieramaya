import properties from '../../../properties.json' with { type: 'json' };
import { parseIcal } from './ical.mjs';
import { nightsBetween } from './dates.mjs';
import { getBookings } from './store.mjs';

export const PROPERTIES = properties.properties;
export const findProperty = (slug) => PROPERTIES.find((p) => p.slug === slug);

function icalUrlFor(slug) {
  try {
    const map = JSON.parse(process.env.ICAL_URLS || '{}');
    const url = map[slug];
    return url ? String(url).replace(/^webcal:/i, 'https:') : null;
  } catch {
    return null;
  }
}

// Returns { blocked: Set<'YYYY-MM-DD'> (occupied nights), icalOk: boolean, hasFeed: boolean }
export async function getBlockedNights(slug) {
  const blocked = new Set();
  let icalOk = true;
  const url = icalUrlFor(slug);
  const hasFeed = !!url;

  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AtHomeRivieraMaya-Calendar/1.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Not an iCal feed');
      for (const ev of parseIcal(text)) for (const n of nightsBetween(ev.start, ev.end)) blocked.add(n);
    } catch (err) {
      console.error('iCal fetch failed for', slug, err && err.message);
      icalOk = false;
    }
  }

  for (const b of await getBookings(slug)) for (const n of nightsBetween(b.start, b.end)) blocked.add(n);
  return { blocked, icalOk, hasFeed };
}

export function rangeIsFree(blocked, start, end) {
  return nightsBetween(start, end).every((n) => !blocked.has(n));
}
