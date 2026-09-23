import { randomUUID } from 'node:crypto';
import { findProperty, getBlockedNights, rangeIsFree } from './lib/availability.mjs';
import { isISODate, nightsBetween, todayCancun } from './lib/dates.mjs';
import { sign } from './lib/token.mjs';
import { store } from './lib/store.mjs';

// POST /api/request-booking  (JSON)
// Saves the request, then emails it to the owner with a one-click "block these dates" link.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const raw = await req.text();
  if (raw.length > 10000) return json({ error: 'Request too large' }, 413);
  let b;
  try { b = JSON.parse(raw); } catch { return json({ error: 'Invalid request' }, 400); }

  // Bot traps: hidden field must be empty, and a human takes more than 3s to fill the form.
  if (b.website) return json({ ok: true }); // pretend success, do nothing
  if (typeof b.t === 'number' && b.t < 3000) return json({ ok: true });

  const prop = findProperty(clean(b.slug, 80));
  if (!prop) return json({ error: 'Unknown property' }, 400);

  const name = clean(b.name, 100);
  const email = clean(b.email, 200);
  const phone = clean(b.phone, 30);
  const guests = Number.parseInt(b.guests, 10);
  const message = clean(b.message, 1500);
  const lang = b.lang === 'es' ? 'es' : 'en';
  const { start, end } = b;

  const errors = [];
  if (name.length < 2) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('email');
  if (!/^\+\d{1,4} ?\d{6,14}$/.test(phone.replace(/[\s().-]+/g, ' ').trim())) errors.push('phone');
  if (!(guests >= 1 && guests <= 20)) errors.push('guests');
  if (!isISODate(start) || !isISODate(end) || end <= start) errors.push('dates');
  else {
    if (start < todayCancun()) errors.push('dates');
    if (nightsBetween(start, end, 400).length > 90) errors.push('dates');
  }
  if (errors.length) return json({ error: 'Invalid fields', fields: [...new Set(errors)] }, 400);
  if (start < todayCancun()) return json({ error: 'Invalid fields', fields: ['dates'] }, 400);

  // Reject dates that are already taken (Airbnb + approved direct bookings).
  const { blocked } = await getBlockedNights(prop.slug);
  if (!rangeIsFree(blocked, start, end)) return json({ error: 'unavailable' }, 409);

  const id = randomUUID();
  const record = { id, slug: prop.slug, property: prop.name, name, email, phone, guests, start, end, message, lang, createdAt: new Date().toISOString() };
  try { await store('requests').setJSON(id, record); } catch (e) { console.error('Could not save request', e); }

  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  const approveUrl = `${site}/api/approve?t=${encodeURIComponent(sign({ a: 'approve', id, slug: prop.slug, start, end, name }))}`;
  const waDigits = phone.replace(/\D/g, '');
  const nights = nightsBetween(start, end).length;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1C2B35">
    <h2 style="margin:0 0 4px">New booking request</h2>
    <p style="margin:0 0 18px;color:#6B6B6B">${esc(prop.name)}</p>
    <table style="border-collapse:collapse;width:100%;font-size:15px">
      <tr><td style="padding:6px 0;color:#6B6B6B;width:120px">Dates</td><td><b>${esc(start)} &rarr; ${esc(end)}</b> (${nights} night${nights === 1 ? '' : 's'})</td></tr>
      <tr><td style="padding:6px 0;color:#6B6B6B">Guests</td><td>${guests}</td></tr>
      <tr><td style="padding:6px 0;color:#6B6B6B">Name</td><td>${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#6B6B6B">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
      <tr><td style="padding:6px 0;color:#6B6B6B">Phone</td><td>${esc(phone)} &nbsp;<a href="https://wa.me/${waDigits}">WhatsApp</a></td></tr>
      <tr><td style="padding:6px 0;color:#6B6B6B;vertical-align:top">Message</td><td>${message ? esc(message).replace(/\n/g, '<br>') : '<i>(none)</i>'}</td></tr>
      <tr><td style="padding:6px 0;color:#6B6B6B">Language</td><td>${lang === 'es' ? 'Spanish' : 'English'}</td></tr>
    </table>
    <p style="margin:26px 0 8px">When you have agreed the booking with the guest, block the dates so Airbnb stops selling them:</p>
    <p><a href="${approveUrl}" style="background:#1C2B35;color:#fff;padding:12px 22px;text-decoration:none;display:inline-block">Block these dates</a></p>
    <p style="color:#6B6B6B;font-size:13px">Reply to this email to answer the guest directly. Airbnb picks up blocked dates the next time it refreshes your calendar (usually within a few hours).</p>
  </div>`;

  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error('RESEND_API_KEY missing'); return json({ error: 'email_not_configured' }, 502); }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'At Home Riviera Maya <onboarding@resend.dev>',
        to: [process.env.NOTIFY_EMAIL || 'athomerivieramaya@gmail.com'],
        reply_to: email,
        subject: `Booking request: ${prop.name}, ${start} to ${end}`,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('Resend ' + res.status + ' ' + (await res.text()));
  } catch (e) {
    console.error('Email failed', e && e.message);
    return json({ error: 'email_failed' }, 502);
  }

  return json({ ok: true });
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const config = { path: '/api/request-booking' };
