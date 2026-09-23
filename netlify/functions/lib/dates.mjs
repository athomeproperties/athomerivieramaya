// Date helpers. All dates are plain "YYYY-MM-DD" strings (no time zones involved),
// which compare correctly as strings.

const pad = (n) => String(n).padStart(2, '0');

export const isISODate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISO(s);
  return toISO(d) === s;
};

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

// Nights occupied by a stay: check-in day up to (not including) check-out day.
export function nightsBetween(start, end, cap = 800) {
  const out = [];
  for (let d = start; d < end && out.length < cap; d = addDays(d, 1)) out.push(d);
  return out;
}

export function todayCancun() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date());
}

export function compact(s) {
  return s.replace(/-/g, '');
}
