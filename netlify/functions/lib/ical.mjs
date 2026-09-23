import { addDays, compact } from './dates.mjs';

// Minimal iCalendar (RFC 5545) reader: enough for Airbnb / VRBO / Booking.com feeds.
// Returns [{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' (exclusive), summary }]
export function parseIcal(text) {
  const lines = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '') // unfold continuation lines
    .split('\n');

  const events = [];
  let cur = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.start) {
        if (!cur.end || cur.end <= cur.start) cur.end = addDays(cur.start, 1);
        if (cur.status !== 'CANCELLED') events.push({ start: cur.start, end: cur.end, summary: cur.summary || '' });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    const val = line.slice(idx + 1).trim();
    if (name === 'DTSTART') cur.start = icalDate(val);
    else if (name === 'DTEND') cur.end = icalDate(val);
    else if (name === 'SUMMARY') cur.summary = val;
    else if (name === 'STATUS') cur.status = val.toUpperCase();
  }
  return events;
}

function icalDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// Build a feed of direct bookings that Airbnb can import to block those dates.
export function buildIcal({ name, bookings, host = 'athomerivieramaya.com' }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//At Home Riviera Maya//Direct Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)} - direct bookings`,
  ];
  for (const b of bookings) {
    out.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(b.start)}`,
      `DTEND;VALUE=DATE:${compact(b.end)}`,
      'SUMMARY:Reserved (direct booking)',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n') + '\r\n';
}
