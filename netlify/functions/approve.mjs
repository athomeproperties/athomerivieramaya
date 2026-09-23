import { findProperty, getBlockedNights, rangeIsFree } from './lib/availability.mjs';
import { getBookings, saveBookings } from './lib/store.mjs';
import { sign, verify } from './lib/token.mjs';

// GET  /api/approve?t=TOKEN  -> confirmation page (nothing changes; safe if an email scanner opens the link)
// POST /api/approve          -> t=TOKEN, blocks (or releases) the dates
export default async (req) => {
  const url = new URL(req.url);
  let token = url.searchParams.get('t');
  if (req.method === 'POST') {
    try { token = (await req.formData()).get('t') || token; } catch { /* keep query token */ }
  }
  let data;
  try { data = verify(token); } catch (e) { return page('Setup problem', `<p>${esc(e.message)}</p>`, 500); }
  if (!data || !findProperty(data.slug)) return page('Link not valid', '<p>This link is invalid or has expired.</p>', 400);

  const prop = findProperty(data.slug);
  const what = `${esc(prop.name)}<br><b>${esc(data.start)} &rarr; ${esc(data.end)}</b>${data.name ? '<br>Guest: ' + esc(data.name) : ''}`;

  if (req.method !== 'POST') {
    const verb = data.a === 'release' ? 'Release these dates' : 'Block these dates';
    return page(verb, `<p>${what}</p>
      <form method="POST" action="/api/approve"><input type="hidden" name="t" value="${esc(token)}">
      <button type="submit">${verb}</button></form>`);
  }

  const list = await getBookings(data.slug);

  if (data.a === 'release') {
    await saveBookings(data.slug, list.filter((b) => b.id !== data.id));
    return page('Dates released', `<p>${what}</p><p>These dates are open again on the website. If you already blocked them in Airbnb, remove that block there too.</p>`);
  }

  if (list.some((b) => b.id === data.id)) {
    return page('Already blocked', `<p>${what}</p><p>These dates were already blocked. Nothing changed.</p>`);
  }

  const { blocked } = await getBlockedNights(data.slug);
  if (!rangeIsFree(blocked, data.start, data.end)) {
    return page('Dates no longer free', `<p>${what}</p><p>Some of these nights are already taken (an Airbnb booking or another direct booking). Nothing was blocked.</p>`, 409);
  }

  list.push({ id: data.id, start: data.start, end: data.end, name: data.name || '', createdAt: new Date().toISOString() });
  await saveBookings(data.slug, list);

  const undo = sign({ a: 'release', id: data.id, slug: data.slug, start: data.start, end: data.end, name: data.name });
  return page('Dates blocked', `<p>${what}</p>
    <p>The website calendar now shows these nights as unavailable, and your Airbnb import feed includes them. Airbnb picks the change up on its next refresh (usually within a few hours).</p>
    <p style="font-size:13px"><a href="/api/approve?t=${encodeURIComponent(undo)}">Made a mistake? Release these dates</a></p>`);
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, body, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex"><title>${esc(title)}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;background:#F8F6F2;color:#1C2B35;margin:0;padding:40px 20px}
  .c{max-width:480px;margin:0 auto;background:#fff;padding:32px;border-top:3px solid #B89A5A}h1{font-size:1.4rem;margin:0 0 16px}
  button{background:#1C2B35;color:#fff;border:0;padding:12px 22px;font-size:15px;cursor:pointer}a{color:#1C2B35}</style></head>
  <body><div class="c"><h1>${esc(title)}</h1>${body}</div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export const config = { path: '/api/approve' };
