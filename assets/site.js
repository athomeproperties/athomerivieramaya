/* At Home Riviera Maya — shared script for the home page and the owners page.
   Handles: nav, EN/ES toggle, the availability search + cards, the availability chart, and the owner contact form. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var lang = 'en';
  try { if (localStorage.getItem('lang') === 'es') lang = 'es'; } catch (e) {}

  var T = {
    en: {
      beds1: '1 bedroom', bedsN: '{n} bedrooms', sleeps: 'Sleeps {n}',
      open: 'Open for your dates', booked: 'Booked for these dates', ask: 'Ask us about these dates',
      minN: 'Minimum {n} nights', fits: 'Fits up to {n} guests',
      viewBook: 'View and book', viewHome: 'View home',
      all: 'All areas', playa: 'Playa del Carmen', akumal: 'Akumal', puerto: 'Puerto Aventuras',
      result: '{a} of {b} homes open {from} to {to}', resultAsk: ' (plus {n} to confirm with us)',
      clear: 'Clear dates', noneOpen: 'No homes are open for those dates. Try nearby dates, or message us on WhatsApp and we will look for options.',
      errDates: 'Choose both a check-in and a check-out date.', errOrder: 'Check-out must be after check-in.', errPast: 'Check-in cannot be in the past.',
      searchHint: 'Pick your dates to see which homes are open.',
      free: 'Open', book: 'Booked', unk: 'Calendar not synced yet',
      chartNote: 'Updated from our Airbnb calendars and direct bookings each time you load this page.',
      sending: 'Sending…', sent: 'Sent', errSend: 'Could not send. Please email us directly.',
      nights: 'nights'
    },
    es: {
      beds1: '1 recámara', bedsN: '{n} recámaras', sleeps: 'Hasta {n} huéspedes',
      open: 'Disponible en tus fechas', booked: 'Ocupada en estas fechas', ask: 'Consúltanos estas fechas',
      minN: 'Mínimo {n} noches', fits: 'Hasta {n} huéspedes',
      viewBook: 'Ver y reservar', viewHome: 'Ver propiedad',
      all: 'Todas las zonas', playa: 'Playa del Carmen', akumal: 'Akumal', puerto: 'Puerto Aventuras',
      result: '{a} de {b} propiedades disponibles del {from} al {to}', resultAsk: ' (y {n} por confirmar con nosotros)',
      clear: 'Borrar fechas', noneOpen: 'No hay propiedades disponibles en esas fechas. Prueba con fechas cercanas o escríbenos por WhatsApp y buscamos opciones.',
      errDates: 'Elige la fecha de llegada y la de salida.', errOrder: 'La salida debe ser después de la llegada.', errPast: 'La llegada no puede ser en el pasado.',
      searchHint: 'Elige tus fechas para ver qué propiedades están disponibles.',
      free: 'Disponible', book: 'Ocupada', unk: 'Calendario aún sin sincronizar',
      chartNote: 'Se actualiza con nuestros calendarios de Airbnb y las reservas directas cada vez que cargas esta página.',
      sending: 'Enviando…', sent: 'Enviado', errSend: 'No se pudo enviar. Escríbenos directamente por correo.',
      nights: 'noches'
    }
  };
  var t = function (k, v) {
    var s = (T[lang] && T[lang][k]) || T.en[k] || k;
    if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  };

  /* ---------- date helpers (UTC strings, same approach as the property page) ---------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  var parse = function (s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); };
  var addDays = function (s, n) { var d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  var diffDays = function (a, b) { return Math.round((parse(b) - parse(a)) / 864e5); };
  var now = new Date();
  var TODAY = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var fmt = function (s) { return parse(s).toLocaleDateString(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var L = function (o) { return (o && (o[lang] || o.en)) || ''; };

  /* ---------- state ---------- */
  var props = [];
  var avail = {};            // slug -> { blocked:Set, ok:boolean }
  var S = { ci: '', co: '', guests: 2, area: 'all' };
  var DAYS = 120;

  var areaKey = function (p) {
    var a = (p.area && p.area.en || '').toLowerCase();
    if (a.indexOf('puerto aventuras') > -1) return 'puerto';
    if (a.indexOf('akumal') > -1) return 'akumal';
    return 'playa';
  };

  /* Status of one home for the current search */
  function statusOf(p) {
    if (!S.ci || !S.co) return { k: 'idle' };
    var nights = diffDays(S.ci, S.co);
    if (p.minNights && nights < p.minNights) return { k: 'min', n: p.minNights };
    if (p.maxGuests && S.guests > p.maxGuests) return { k: 'fits', n: p.maxGuests };
    var a = avail[p.slug];
    if (!a || !a.ok) return { k: 'ask' };
    for (var d = S.ci; d < S.co; d = addDays(d, 1)) if (a.blocked.has(d)) return { k: 'booked' };
    return { k: 'open' };
  }

  /* ---------- cards (home page) ---------- */
  function renderCards() {
    var grid = $('#homesGrid');
    if (!grid || !props.length) return;
    var list = props.filter(function (p) { return S.area === 'all' || areaKey(p) === S.area; })
      .map(function (p) { return { p: p, st: statusOf(p) }; });
    var rank = { open: 0, ask: 1, idle: 1, min: 2, fits: 2, booked: 3 };
    list.sort(function (a, b) { return rank[a.st.k] - rank[b.st.k]; });

    var qs = S.ci && S.co ? '?checkin=' + S.ci + '&checkout=' + S.co + '&guests=' + S.guests : '';
    grid.innerHTML = list.map(function (x) {
      var p = x.p, st = x.st, ph = p.photos && p.photos[0];
      var pill = '';
      if (st.k === 'open') pill = '<span class="pill open">' + t('open') + '</span>';
      else if (st.k === 'booked') pill = '<span class="pill no">' + t('booked') + '</span>';
      else if (st.k === 'ask') pill = '<span class="pill">' + t('ask') + '</span>';
      else if (st.k === 'min') pill = '<span class="pill no">' + t('minN', { n: st.n }) + '</span>';
      else if (st.k === 'fits') pill = '<span class="pill no">' + t('fits', { n: st.n }) + '</span>';
      var beds = p.bedrooms ? (p.bedrooms === 1 ? t('beds1') : t('bedsN', { n: p.bedrooms })) : '';
      var sleeps = p.maxGuests ? t('sleeps', { n: p.maxGuests }) : '';
      var meta = [beds, sleeps].filter(Boolean).join(' · ');
      var dim = (st.k === 'booked' || st.k === 'min' || st.k === 'fits') ? ' dim' : '';
      return '<a class="home' + dim + '" href="/stay/' + esc(p.slug) + qs + '">' +
        '<div class="ph">' + (ph ? '<img src="' + esc(ph.src) + '" alt="' + esc(ph.alt || p.name) + '" loading="lazy" width="800" height="600">' : '') + pill + '</div>' +
        '<p class="area">' + esc(L(p.area)) + '</p><h3>' + esc(p.name) + '</h3>' +
        (meta ? '<p class="meta">' + esc(meta) + '</p>' : '') +
        '<span class="go">' + t(S.ci ? 'viewBook' : 'viewHome') + '</span></a>';
    }).join('');

    // summary line
    var line = $('#resultLine');
    if (line) {
      if (S.ci && S.co) {
        var open = list.filter(function (x) { return x.st.k === 'open'; }).length;
        var ask = list.filter(function (x) { return x.st.k === 'ask'; }).length;
        var msg = open || ask ? t('result', { a: open, b: list.length, from: fmt(S.ci), to: fmt(S.co) }) + (ask ? t('resultAsk', { n: ask }) : '') : t('noneOpen');
        line.innerHTML = esc(msg) + ' <button type="button" id="clearDates">' + t('clear') + '</button>';
        var cb = $('#clearDates'); if (cb) cb.addEventListener('click', clearSearch);
      } else {
        line.textContent = t('searchHint');
      }
    }
  }

  function renderChips() {
    var box = $('#areaChips');
    if (!box) return;
    box.innerHTML = ['all', 'playa', 'akumal', 'puerto'].map(function (k) {
      return '<button type="button" class="chip" data-k="' + k + '" aria-pressed="' + (S.area === k) + '">' + t(k) + '</button>';
    }).join('');
    $$('.chip', box).forEach(function (b) { b.addEventListener('click', function () { S.area = b.dataset.k; renderChips(); renderCards(); }); });
  }

  /* ---------- availability chart ---------- */
  function renderChart() {
    var box = $('#chart');
    if (!box || !props.length) return;
    var start = TODAY, i, months = '';
    for (i = 0; i < DAYS; i++) {
      var d = addDays(start, i), dd = parse(d);
      if (i === 0 || dd.getUTCDate() === 1) {
        months += '<span style="left:' + (i / DAYS * 100).toFixed(2) + '%">' + dd.toLocaleDateString(lang, { month: 'short', timeZone: 'UTC' }) + '</span>';
      }
    }
    var rows = props.map(function (p) {
      var a = avail[p.slug], cells = '';
      for (i = 0; i < DAYS; i++) {
        var day = addDays(start, i), cls = '';
        if (!a || !a.ok) cls = 'u';
        else if (a.blocked.has(day)) cls = 'b';
        if (parse(day).getUTCDate() === 1) cls += ' m';
        cells += '<i' + (cls ? ' class="' + cls.trim() + '"' : '') + '></i>';
      }
      return '<div class="crow"><a href="/stay/' + esc(p.slug) + '">' + esc(p.name) + '</a><div class="bar" style="--days:' + DAYS + '">' + cells + '</div></div>';
    }).join('');

    var pick = '';
    if (S.ci && S.co && S.ci < addDays(start, DAYS)) {
      var x = Math.max(0, diffDays(start, S.ci)), end = Math.min(DAYS, diffDays(start, S.co));
      if (end > x) pick = '<div class="pick" style="--x:' + (x / DAYS).toFixed(4) + ';--w:' + ((end - x) / DAYS).toFixed(4) + '"></div>';
    }
    box.innerHTML = '<div class="chart-months">' + months + '</div><div class="chart-rows">' + rows + pick + '</div>' +
      '<div class="legend"><span><i></i>' + t('free') + '</span><span><i class="b"></i>' + t('book') + '</span><span><i class="u"></i>' + t('unk') + '</span></div>' +
      '<p class="chart-note">' + t('chartNote') + '</p>';
  }

  /* ---------- search form ---------- */
  function setupSearch() {
    var form = $('#searchForm');
    if (!form) return;
    var ci = $('#ci'), co = $('#co'), gs = $('#guests'), note = $('#searchNote');
    ci.min = TODAY; co.min = addDays(TODAY, 1);
    ci.addEventListener('change', function () {
      if (ci.value) {
        co.min = addDays(ci.value, 1);
        if (!co.value || co.value <= ci.value) co.value = addDays(ci.value, 7);
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      note.className = 'search-note';
      var err = '';
      if (!ci.value || !co.value) err = t('errDates');
      else if (co.value <= ci.value) err = t('errOrder');
      else if (ci.value < TODAY) err = t('errPast');
      if (err) { note.textContent = err; note.className = 'search-note err'; return; }
      note.textContent = '';
      S.ci = ci.value; S.co = co.value; S.guests = +gs.value || 2;
      try { history.replaceState(null, '', '?checkin=' + S.ci + '&checkout=' + S.co + '&guests=' + S.guests + '#homes'); } catch (x) {}
      renderCards(); renderChart();
      var target = $('#homes'); if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    // restore from URL
    var q = new URLSearchParams(location.search), a = q.get('checkin'), b = q.get('checkout');
    if (a && b && /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b) && b > a && a >= TODAY) {
      ci.value = a; co.value = b; co.min = addDays(a, 1);
      S.ci = a; S.co = b;
      var g = parseInt(q.get('guests'), 10); if (g > 0 && g <= 20) { S.guests = g; gs.value = String(g); }
    }
  }
  function clearSearch() {
    S.ci = S.co = '';
    var ci = $('#ci'), co = $('#co'); if (ci) ci.value = ''; if (co) co.value = '';
    try { history.replaceState(null, '', location.pathname + '#homes'); } catch (x) {}
    renderCards(); renderChart();
  }

  /* ---------- data ---------- */
  function load() {
    if (!$('#homesGrid') && !$('#chart')) return;
    fetch('/properties.json').then(function (r) { return r.json(); }).then(function (d) {
      props = d.properties || [];
      renderChips(); renderCards(); renderChart();
      return Promise.all(props.map(function (p) {
        return fetch('/api/availability?slug=' + encodeURIComponent(p.slug))
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(function (j) { avail[p.slug] = { blocked: new Set(j.blocked || []), ok: j.icalOk !== false && j.hasFeed !== false }; })
          .catch(function () { avail[p.slug] = { blocked: new Set(), ok: false }; });
      }));
    }).then(function () { renderCards(); renderChart(); }).catch(function () {});
  }

  /* ---------- language ---------- */
  function setLang(l) {
    lang = l === 'es' ? 'es' : 'en';
    document.documentElement.lang = lang;
    $$('[data-en]').forEach(function (el) { var v = el.getAttribute('data-' + lang); if (v != null) el.innerHTML = v; });
    $$('[data-ph-en]').forEach(function (el) { el.placeholder = el.getAttribute('data-ph-' + lang); });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.l === lang)); });
    var wa = $('#wa');
    if (wa) wa.href = 'https://wa.me/529842136512?text=' + encodeURIComponent(wa.getAttribute('data-msg-' + lang) || '');
    try { localStorage.setItem('lang', lang); } catch (e) {}
    renderChips(); renderCards(); renderChart();
    var s = $('#searchNote'); if (s && !s.textContent) s.textContent = '';
  }

  /* ---------- owner form ---------- */
  function setupOwnerForm() {
    var form = $('#ownerForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', form), ok = $('#formOk');
      var label = btn.innerHTML;
      btn.disabled = true; btn.textContent = t('sending');
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) })
        .then(function (r) {
          if (r.status !== 200) throw new Error();
          form.reset(); ok.style.display = 'block'; btn.textContent = t('sent');
        })
        .catch(function () { btn.disabled = false; btn.innerHTML = label; ok.style.display = 'none'; alert(t('errSend')); });
    });
  }

  /* ---------- nav ---------- */
  var nav = $('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var burger = $('.burger');
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(open));
    });
    $$('.nav-links a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }); });
  }
  $$('.lang button').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.l); }); });

  setupSearch();
  setupOwnerForm();
  setLang(lang);
  load();
})();
