// Netlify Edge Function — server-side fills in property.html's title,
// meta description, and content for the specific rental in the URL
// (/stay/<slug>), before the page is sent out. Right now, property.html's
// own client-side JavaScript builds the entire page content by fetching
// /properties.json and writing into <main id="app">...</main> — so a
// crawler that doesn't run JavaScript sees an empty "Loading…" shell.
// This function intercepts the request, does that same lookup itself,
// and fills the shell in before it's served.
//
// Real visitors see no difference: the page's own JavaScript still runs
// afterward and rebuilds the same content (and swaps in the interactive
// booking calendar, which this function deliberately leaves out — that
// part doesn't matter for search/AI visibility and stays exactly as-is
// for real visitors).
//
// SETUP NEEDED (one-time, in the Netlify dashboard or netlify.toml):
//   1. Save this file at netlify/edge-functions/property-ssr.js
//   2. Add this to netlify.toml (alongside the existing [[redirects]] block):
//
//      [[edge_functions]]
//        path = "/stay/*"
//        function = "property-ssr"
//
//   The existing "/stay/* -> /property.html" redirect can stay as-is —
//   this edge function runs first and calls context.next() to get that
//   same redirected response, then rewrites it.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Properties store description/area/amenities as {en: "...", es: "..."}.
// The page defaults to English until the visitor's browser JS picks a
// language, so this server-side render always uses English too.
function L(o) {
  if (!o) return '';
  return o.en || o.es || '';
}

const T = {
  home: 'Home',
  rentals: 'Vacation rentals',
  bedrooms: 'Bedrooms',
  bedroomsOne: 'Bedroom',
  checkin: 'Check-in',
  checkout: 'Check-out',
  area: 'Area',
  about: 'About this rental',
  amenities: 'Amenities',
  map: 'View on Google Maps ↗',
  airbnb: 'Also on Airbnb ↗',
  bookTitle: 'Request to book',
  bookSub: "Pick your dates, send your request, and we'll get back to you within one business day with the rate and next steps.",
};

// Exported separately from the Netlify handler so it can be unit-tested
// with plain data in Node, without needing Netlify's Deno runtime.
export function renderSSR(html, p, origin) {
  const name = p.name || '';
  const title = `${name} — At Home Riviera Maya`;
  const areaText = L(p.area);
  const rawDesc = L(p.description) || `Vacation rental in ${areaText}, Riviera Maya, managed by At Home Riviera Maya.`;
  const metaDesc = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '...' : rawDesc;

  const photos = Array.isArray(p.photos) ? p.photos : [];
  const galleryHtml = photos.length
    ? `<div class="gallery-main"><img src="${esc(photos[0].src)}" alt="${esc(photos[0].alt || name)}"></div>` +
      (photos.length > 1
        ? `<div class="thumbs">${photos
            .map((x, k) => `<button type="button" class="thumb${k === 0 ? ' active' : ''}" data-i="${k}" aria-label="Photo ${k + 1}"><img src="${esc(x.src)}" alt="" loading="lazy"></button>`)
            .join('')}</div>`
        : '')
    : `<div class="gallery-main"><div class="gallery-empty">${esc(name)}</div></div>`;

  const beds = p.bedrooms ? `<div class="chip"><span>${esc(p.bedrooms === 1 ? T.bedroomsOne : T.bedrooms)}</span><b>${esc(p.bedrooms)}</b></div>` : '';
  const am = (p.amenities && (p.amenities.en || p.amenities.es)) || [];

  let links = '';
  if (p.mapUrl) links += `<a href="${esc(p.mapUrl)}" target="_blank" rel="noopener">${esc(T.map)}</a>`;
  if (p.airbnbUrl) links += `<a href="${esc(p.airbnbUrl)}" target="_blank" rel="noopener">${esc(T.airbnb)}</a>`;

  const appHtml =
    `<p class="crumbs"><a href="/">${esc(T.home)}</a> / <a href="/#stay">${esc(T.rentals)}</a> / ${esc(name)}</p>` +
    `<p class="eyebrow">${esc(areaText)}</p><h1>${esc(name)}</h1>` +
    `<div class="layout"><div>` +
    `<div id="gallery">${galleryHtml}</div>` +
    `<div class="chips">${beds}` +
    `<div class="chip"><span>${esc(T.checkin)}</span><b>${esc(p.checkIn || '')}</b></div>` +
    `<div class="chip"><span>${esc(T.checkout)}</span><b>${esc(p.checkOut || '')}</b></div>` +
    `<div class="chip"><span>${esc(T.area)}</span><b>${esc(areaText)}</b></div></div>` +
    `<h2 style="margin-top:0">${esc(T.about)}</h2><p class="about">${esc(rawDesc)}</p>` +
    (am.length ? `<h2>${esc(T.amenities)}</h2><ul class="amenities">${am.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '') +
    (links ? `<div class="links">${links}</div>` : '') +
    `</div>` +
    `<aside class="book" id="book"><h3>${esc(T.bookTitle)}</h3><p class="sub">${esc(T.bookSub)}</p>` +
    `<div id="cal"></div><div id="summary"></div><div id="formWrap"></div>` +
    `<div class="ok" id="ok"></div>` +
    `</aside></div>`;

  const canonicalUrl = `${origin}/stay/${encodeURIComponent(p.slug)}`;
  const jsonLdObj = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name,
    description: rawDesc,
    url: canonicalUrl,
  };
  if (photos.length) jsonLdObj.image = photos.slice(0, 6).map((x) => x.src);
  if (areaText) {
    jsonLdObj.address = { '@type': 'PostalAddress', addressLocality: areaText, addressRegion: 'Quintana Roo', addressCountry: 'MX' };
  }
  const jsonLd = JSON.stringify(jsonLdObj);

  let out = html;

  out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(metaDesc)}" />`);
  out = out.replace(
    '<main id="app">\n    <p style="color:var(--muted);padding:3rem 0">Loading…</p>\n  </main>',
    `<main id="app">${appHtml}</main>`
  );
  out = out.replace('</head>', `<link rel="canonical" href="${canonicalUrl}" /><script type="application/ld+json">${jsonLd}<\/script></head>`);

  return out;
}

export default async (request, context) => {
  const url = new URL(request.url);

  // Always get the normal page first. If anything below fails or the
  // slug isn't found, we return this untouched and the page works
  // exactly as it does today.
  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const slug = decodeURIComponent(url.pathname.replace(/^\/stay\//, '').replace(/\/+$/, ''));
  if (!slug) return response;

  try {
    const dataRes = await fetch(new URL('/properties.json', url));
    if (!dataRes.ok) return response;
    const data = await dataRes.json();
    const list = Array.isArray(data) ? data : data.properties || [];
    const p = list.find((x) => x && x.slug === slug);
    if (!p) return response;

    const html = await response.text();
    const rewritten = renderSSR(html, p, url.origin);

    return new Response(rewritten, {
      status: response.status,
      headers: response.headers,
    });
  } catch (e) {
    return response;
  }
};

export const config = { path: '/stay/*' };
