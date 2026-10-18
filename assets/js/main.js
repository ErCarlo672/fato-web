/* FATO · main.js — JavaScript clásico (sin módulos). Cada init va aislado en safe(). */
(function () {
  'use strict';

  var D = window.FATO_DATA || null;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn('[FATO] ' + name + ' falló:', e); } }

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var CAT = { precision: 'Precisión', plato: 'Plato', recorridos: 'Recorridos', historicas: 'AA. Históricas', alta: 'Alta Precisión', fclass: 'F-Class' };
  var SCOPE = { andalucia: 'Autonómico', nacional: 'Nacional', internacional: 'Internacional' };

  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseD(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var KEEP = { ISSF: 1, IPSC: 1, WSPS: 1, FISU: 1, RFEDETO: 1, FATO: 1, JJPP: 1, RRTT: 1, PRS: 1, WCH: 1 };
  var WORDS = { ANDALUCIA: 'Andalucía', ANDALUZA: 'Andaluza', OLIMPICAS: 'Olímpicas', OLIMPICO: 'Olímpico', TECNIFICACION: 'Tecnificación', 'TECNIFICACIÓN': 'Tecnificación', FCLASS: 'F-Class', PISTOLA: 'Pistola', CAMPEONATO: 'Campeonato' };
  function pretty(t) {
    return t.replace(/[A-ZÁÉÍÓÚÑ]{4,}/g, function (w) { return KEEP[w] ? w : (WORDS[w] || (w.charAt(0) + w.slice(1).toLowerCase())); })
      .replace(/(?<=\S)\s+(DE|DEL|LA|LAS|LOS|EL|Y|EN|CON|AL|POR|PARA)(?=\s)/g, function (m, w) { return ' ' + w.toLowerCase(); })
      .replace(/\s+/g, ' ').trim();
  }

  function rangeLabel(e) {
    var s = parseD(e.s), en = parseD(e.e);
    if (e.s === e.e) return s.getDate() + ' ' + MON[s.getMonth()];
    if (s.getMonth() === en.getMonth()) return s.getDate() + '–' + en.getDate() + ' ' + MON[s.getMonth()];
    return s.getDate() + ' ' + MON[s.getMonth()] + ' – ' + en.getDate() + ' ' + MON[en.getMonth()];
  }

  /* ---------- Toast ---------- */
  var toastT;
  function toast(msg) {
    var t = $('.toast'); if (!t) return;
    $('span', t).textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }
  function copyText(txt, msg) {
    var done = function () { toast(msg || 'Copiado al portapapeles'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    else { fallbackCopy(txt); done(); }
  }
  function fallbackCopy(txt) { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

  /* ---------- ICS / Google Calendar ---------- */
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function fold(line) { var out = [], i = 0; while (line.length - i > 73) { out.push((i ? ' ' : '') + line.slice(i, i + 73)); i += 73; } out.push((i ? ' ' : '') + line.slice(i)); return out.join('\r\n'); }
  function buildICS(events) {
    var now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FATO//Calendario de competiciones//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:FATO · Competiciones', 'X-WR-TIMEZONE:Europe/Madrid'];
    events.forEach(function (e, i) {
      var title = pretty(e.t) + (e.x ? ' (CANCELADA)' : '');
      L.push('BEGIN:VEVENT', 'UID:fato-' + e.s + '-' + i + '-' + norm(e.loc).replace(/[^a-z0-9]/g, '') + '@fato.es', 'DTSTAMP:' + now,
        'DTSTART;VALUE=DATE:' + ymd(parseD(e.s)), 'DTEND;VALUE=DATE:' + ymd(addDays(parseD(e.e), 1)),
        fold('SUMMARY:' + icsEsc(title)), fold('LOCATION:' + icsEsc(e.loc)),
        fold('DESCRIPTION:' + icsEsc(e.cat.map(function (c) { return CAT[c]; }).join(' · ') + ' — ' + SCOPE[e.scope] + '. Fuente: Programa RFEDETO-FATO 2026. Confirma horarios con el organizador.')),
        'URL:https://fato.es/calendario.html', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }
  function download(name, text) {
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function gcal(e) {
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(pretty(e.t)) +
      '&dates=' + ymd(parseD(e.s)) + '/' + ymd(addDays(parseD(e.e), 1)) + '&location=' + encodeURIComponent(e.loc) +
      '&details=' + encodeURIComponent('Calendario RFEDETO-FATO 2026 · fato.es');
  }

  /* ---------- Event card ---------- */
  var T0 = today();
  function eventCard(e, idx) {
    var s = parseD(e.s), en = parseD(e.e);
    var past = en < T0, live = s <= T0 && en >= T0;
    var multi = e.s !== e.e;
    var cls = 'event-card' + (past ? ' is-past' : '') + (e.x ? ' is-cancelled' : '');
    var tags = e.cat.map(function (c) { return '<span class="tag" data-c="' + c + '" style="box-shadow:inset 3px 0 0 var(--c)">' + CAT[c] + '</span>'; }).join('') +
      '<span class="tag tag--' + e.scope + '">' + SCOPE[e.scope] + '</span>' + (e.x ? '<span class="tag tag--x">Cancelada</span>' : '');
    return '<article class="' + cls + '" data-scope="' + e.scope + '">' +
      '<div class="event-date"><b>' + String(s.getDate()).padStart(2, '0') + '</b><span>' + MON[s.getMonth()] + '</span>' + (multi ? '<small>→ ' + en.getDate() + ' ' + MON[en.getMonth()] + '</small>' : '') + '</div>' +
      '<div class="event-body">' + (live && !e.x ? '<span class="event-live">En curso</span>' : '') + '<h3>' + esc(pretty(e.t)) + '</h3>' +
      '<p class="event-loc"><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(e.loc) + '</p>' +
      '<div class="event-tags">' + tags + '</div>' +
      (past ? '' : '<div class="event-actions"><button class="icon-btn" type="button" data-ics="' + idx + '"><svg aria-hidden="true"><use href="#i-cal-plus"/></svg>.ics</button>' +
      '<a class="icon-btn" href="' + gcal(e) + '" target="_blank" rel="noopener">Google Calendar</a></div>') +
      '</div></article>';
  }
  function bindIcs(root) {
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ics]'); if (!b || !D) return;
      var e = D.events[+b.getAttribute('data-ics')];
      download('fato-' + e.s + '.ics', buildICS([e])); toast('Evento descargado para tu calendario');
    });
  }

  /* ---------- Nav ---------- */
  function initNav() {
    var h = $('.site-header'); if (!h) return;
    var last = 0, ticking = false;
    function onScroll() {
      var y = window.scrollY;
      h.classList.toggle('is-solid', y > 40);
      h.classList.toggle('is-hidden', y > 400 && y > last && !document.body.classList.contains('menu-open'));
      last = y; ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    onScroll();

    var btn = $('.menu-toggle'), menu = $('#mobile-menu');
    if (!btn || !menu) return;
    function setOpen(o) {
      document.body.classList.toggle('menu-open', o);
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      btn.setAttribute('aria-label', o ? 'Cerrar menú' : 'Abrir menú');
      if (o) h.classList.add('is-solid'); else onScroll();
    }
    btn.addEventListener('click', function () { setOpen(!document.body.classList.contains('menu-open')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setOpen(false); btn.focus(); } });
  }

  /* ---------- Reveal + draw ---------- */
  function initReveal() {
    $$('.draw circle, .draw path.draw-path').forEach(function (c) { try { c.style.setProperty('--len', Math.ceil(c.getTotalLength()) + 1); } catch (e) {} });
    var els = $$('.reveal, .draw, [data-prov-bars]');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.01, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () { els.forEach(function (el) { el.classList.add('is-in'); }); }, 6000);
  }

  /* ---------- Counters ---------- */
  function initCounters() {
    if (D) {
      var nAnd = D.events.filter(function (e) { return e.scope === 'andalucia'; }).length;
      $$('[data-stat="events"]').forEach(function (b) { b.setAttribute('data-count', D.events.length); b.textContent = D.events.length; });
      $$('[data-stat="andalucia"]').forEach(function (b) { b.setAttribute('data-count', nAnd); b.textContent = nAnd; });
    }
    var els = $$('[data-count]'); if (!els.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return; io.unobserve(en.target);
        var el = en.target, to = +el.getAttribute('data-count'), t0 = performance.now(), dur = 1400;
        (function step(t) { var p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 0.01 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Hero reticle ---------- */
  function initReticle() {
    var hero = $('[data-hero]'), r = $('.reticle'); if (!hero || !r) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    var rx = $('[data-rx]', r), ry = $('[data-ry]', r);
    var tx = 0, ty = 0, x = 0, y = 0, active = false, raf = null;
    function loop() {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      r.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      var b = hero.getBoundingClientRect();
      var dx = (x - b.width / 2) / 10, dy = (b.height / 2 - y) / 10;
      rx.textContent = 'X ' + (dx >= 0 ? '+' : '−') + Math.abs(dx).toFixed(1).padStart(5, '0');
      ry.textContent = 'Y ' + (dy >= 0 ? '+' : '−') + Math.abs(dy).toFixed(1).padStart(5, '0');
      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(loop); else raf = null;
    }
    hero.addEventListener('pointermove', function (e) {
      var b = hero.getBoundingClientRect(); tx = e.clientX - b.left; ty = e.clientY - b.top;
      var overUi = e.target.closest('a, button');
      r.classList.toggle('is-on', !overUi);
      if (!active) { x = tx; y = ty; active = true; }
      if (!raf) raf = requestAnimationFrame(loop);
    });
    hero.addEventListener('pointerleave', function () { r.classList.remove('is-on'); active = false; });
    hero.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var b = hero.getBoundingClientRect(), s = document.createElement('span');
      s.className = 'hero-shot'; s.style.left = (e.clientX - b.left) + 'px'; s.style.top = (e.clientY - b.top) + 'px';
      hero.appendChild(s); setTimeout(function () { s.remove(); }, 1300);
    });
  }

  /* ---------- Upcoming (home) ---------- */
  function upcoming(scope, n) {
    return D.events.map(function (e, i) { return { e: e, i: i }; }).filter(function (o) {
      return parseD(o.e.e) >= T0 && !o.e.x && (!scope || o.e.scope === scope);
    }).slice(0, n);
  }
  function initTicker() {
    var tr = $('[data-ticker]'); if (!tr || !D) return;
    var list = upcoming(null, 12); if (!list.length) return;
    var html = list.map(function (o) { return '<a href="calendario.html"><time>' + esc(rangeLabel(o.e).toUpperCase()) + '</time>' + esc(o.e.loc) + ' · ' + esc(pretty(o.e.t)) + '</a>'; }).join('');
    tr.innerHTML = '<div class="ticker-group">' + html + '</div><div class="ticker-group" aria-hidden="true">' + html + '</div>';
    $$('.ticker-group[aria-hidden] a', tr).forEach(function (a) { a.tabIndex = -1; });
  }
  function initUpcoming() {
    var g = $('[data-upcoming]'); if (!g || !D) return;
    var scope = null;
    function render() {
      var list = upcoming(scope, 6);
      if (!list.length) list = D.events.map(function (e, i) { return { e: e, i: i }; }).filter(function (o) { return !scope || o.e.scope === scope; }).slice(-6);
      g.innerHTML = list.map(function (o) { return eventCard(o.e, o.i); }).join('');
    }
    $$('[data-upc-scope]').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-upc-scope]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        scope = b.getAttribute('data-upc-scope') === 'all' ? null : b.getAttribute('data-upc-scope');
        render();
      });
    });
    bindIcs(g); render();
  }

  /* ---------- Calendar page ---------- */
  function initCalendar() {
    var listEl = $('[data-cal-list]'); if (!listEl || !D) return;
    var monthEl = $('[data-cal-month]'), countEl = $('[data-cal-count]');
    var qEl = $('[data-f="q"]'), provEl = $('[data-f="prov"]'), scopeEl = $('[data-f="scope"]'), upEl = $('[data-f="upcoming"]');
    var st = { q: '', prov: '', scope: '', cats: [], up: true, view: 'list', month: null };

    var P = new URLSearchParams(location.search);
    st.q = P.get('q') || ''; st.prov = P.get('prov') || ''; st.scope = P.get('scope') || '';
    st.cats = (P.get('cat') || '').split(',').filter(function (c) { return CAT[c]; });
    st.up = P.get('todas') !== '1'; st.view = P.get('vista') === 'mes' ? 'month' : 'list';
    qEl.value = st.q; provEl.value = st.prov; scopeEl.value = st.scope; upEl.checked = st.up;

    var idx = D.events.map(function (e, i) {
      return { e: e, i: i, hay: norm([e.t, e.loc, e.prov, SCOPE[e.scope]].concat(e.cat.map(function (c) { return CAT[c]; })).join(' ')) };
    });

    function filtered() {
      var terms = norm(st.q).split(/\s+/).filter(Boolean);
      return idx.filter(function (o) {
        var e = o.e;
        if (st.up && parseD(e.e) < T0) return false;
        if (st.scope && e.scope !== st.scope) return false;
        if (st.prov === 'andalucia' && !e.prov) return false;
        if (st.prov && st.prov !== 'andalucia' && e.prov !== st.prov) return false;
        if (st.cats.length && !e.cat.some(function (c) { return st.cats.indexOf(c) > -1; })) return false;
        for (var k = 0; k < terms.length; k++) if (o.hay.indexOf(terms[k]) === -1) return false;
        return true;
      });
    }
    function syncUrl() {
      var p = new URLSearchParams();
      if (st.q) p.set('q', st.q); if (st.prov) p.set('prov', st.prov); if (st.scope) p.set('scope', st.scope);
      if (st.cats.length) p.set('cat', st.cats.join(',')); if (!st.up) p.set('todas', '1'); if (st.view === 'month') p.set('vista', 'mes');
      var qs = p.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }
    function renderList(rows) {
      if (!rows.length) {
        listEl.innerHTML = '<div class="empty"><svg aria-hidden="true"><use href="#p-precision"/></svg><p><b>Sin resultados.</b><br>Prueba con otra palabra, quita algún filtro o desactiva «Solo próximas».</p></div>';
        return;
      }
      var groups = {}, order = [];
      rows.forEach(function (o) { var k = o.e.s.slice(0, 7); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(o); });
      listEl.innerHTML = order.map(function (k) {
        var m = +k.slice(5, 7) - 1;
        return '<section class="month-block"><div class="month-title"><h2>' + cap(MONTHS[m]) + '</h2><span>' + k.slice(0, 4) + ' · ' + groups[k].length + (groups[k].length === 1 ? ' competición' : ' competiciones') + '</span></div>' +
          '<div class="events-grid">' + groups[k].map(function (o) { return eventCard(o.e, o.i); }).join('') + '</div></section>';
      }).join('');
    }
    function renderMonth(rows) {
      var grid = $('[data-month-grid]'), title = $('[data-month-title]'), panel = $('[data-day-panel]');
      var m = st.month, first = new Date(m.getFullYear(), m.getMonth(), 1);
      title.textContent = cap(MONTHS[m.getMonth()]) + ' ' + m.getFullYear();
      var start = addDays(first, -((first.getDay() + 6) % 7));
      var html = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<div class="cal-dow" role="columnheader">' + d + '</div>'; }).join('');
      for (var i = 0; i < 42; i++) {
        var day = addDays(start, i), key = iso(day);
        if (i >= 35 && day.getMonth() !== m.getMonth()) break;
        var evs = rows.filter(function (o) { return o.e.s <= key && o.e.e >= key; });
        var out = day.getMonth() !== m.getMonth();
        html += '<button type="button" class="cal-day' + (out ? ' is-out' : '') + (+day === +T0 ? ' is-today' : '') + '" data-day="' + key + '" aria-label="' + day.getDate() + ' de ' + MONTHS[day.getMonth()] + ': ' + evs.length + ' competiciones">' +
          '<span class="dn">' + day.getDate() + '</span>' +
          evs.slice(0, 3).map(function (o) { return '<span class="cal-ev' + (o.e.scope === 'andalucia' ? ' is-and' : '') + '" data-c="' + o.e.cat[0] + '">' + esc(o.e.loc.split(' (')[0]) + '</span>'; }).join('') +
          (evs.length > 3 ? '<span class="cal-more">+' + (evs.length - 3) + ' más</span>' : '') + '</button>';
      }
      grid.innerHTML = html;
      panel.innerHTML = '';
      $$('.cal-day', grid).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.cal-day', grid).forEach(function (x) { x.removeAttribute('aria-selected'); }); b.setAttribute('aria-selected', 'true');
          var key = b.getAttribute('data-day'), d = parseD(key);
          var evs = rows.filter(function (o) { return o.e.s <= key && o.e.e >= key; });
          panel.innerHTML = '<div class="month-title"><h2 style="font-size:1.6rem">' + d.getDate() + ' de ' + MONTHS[d.getMonth()] + '</h2><span>' + evs.length + (evs.length === 1 ? ' competición' : ' competiciones') + '</span></div>' +
            (evs.length ? '<div class="events-grid">' + evs.map(function (o) { return eventCard(o.e, o.i); }).join('') + '</div>' : '<p class="empty">No hay competiciones este día con los filtros actuales.</p>');
          if (window.innerWidth < 900) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
    function render() {
      var rows = filtered();
      countEl.innerHTML = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'competición' : 'competiciones') + (st.up ? ' próximas' : ' en 2026');
      $$('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === st.view ? 'true' : 'false'); });
      $$('[data-cat]').forEach(function (b) { b.setAttribute('aria-pressed', st.cats.indexOf(b.getAttribute('data-cat')) > -1 ? 'true' : 'false'); });
      listEl.hidden = st.view !== 'list'; monthEl.hidden = st.view !== 'month';
      if (st.view === 'list') renderList(rows);
      else {
        if (!st.month) {
          var nxt = rows.filter(function (o) { return parseD(o.e.e) >= T0; })[0] || rows[0];
          var base = nxt ? parseD(nxt.e.s) : T0; st.month = new Date(base.getFullYear(), base.getMonth(), 1);
        }
        renderMonth(rows);
      }
      syncUrl();
    }

    var qT; qEl.addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { st.q = qEl.value.trim(); render(); }, 160); });
    provEl.addEventListener('change', function () { st.prov = provEl.value; render(); });
    scopeEl.addEventListener('change', function () { st.scope = scopeEl.value; render(); });
    upEl.addEventListener('change', function () { st.up = upEl.checked; render(); });
    $$('[data-cat]').forEach(function (b) { b.addEventListener('click', function () {
      var c = b.getAttribute('data-cat'), k = st.cats.indexOf(c); if (k > -1) st.cats.splice(k, 1); else st.cats.push(c); render();
    }); });
    $$('[data-view]').forEach(function (b) { b.addEventListener('click', function () { st.view = b.getAttribute('data-view'); render(); }); });
    $('[data-month-prev]').addEventListener('click', function () { st.month = new Date(st.month.getFullYear(), st.month.getMonth() - 1, 1); render(); });
    $('[data-month-next]').addEventListener('click', function () { st.month = new Date(st.month.getFullYear(), st.month.getMonth() + 1, 1); render(); });
    $('[data-month-today]').addEventListener('click', function () { st.month = new Date(T0.getFullYear(), T0.getMonth(), 1); render(); });
    $('[data-reset]').addEventListener('click', function () {
      st.q = ''; st.prov = ''; st.scope = ''; st.cats = []; st.up = true;
      qEl.value = ''; provEl.value = ''; scopeEl.value = ''; upEl.checked = true; render();
    });
    var ex = $('[data-export-ics]');
    if (ex) ex.addEventListener('click', function () {
      var rows = filtered(); if (!rows.length) { toast('No hay competiciones que exportar'); return; }
      download('fato-calendario-2026.ics', buildICS(rows.map(function (o) { return o.e; })));
      toast(rows.length + ' competiciones exportadas');
    });
    bindIcs(listEl); bindIcs(monthEl);
    render();
  }

  /* ---------- Spec counts ---------- */
  function initSpecCounts() {
    var els = $$('[data-spec-count]'); if (!els.length || !D) return;
    els.forEach(function (el) {
      var c = el.getAttribute('data-spec-count');
      var all = D.events.filter(function (e) { return e.cat.indexOf(c) > -1; });
      var and = all.filter(function (e) { return e.scope === 'andalucia'; }).length;
      el.textContent = all.length + ' en calendario' + (and ? ' · ' + and + ' en Andalucía' : '');
    });
  }

  /* ---------- Clubs ---------- */
  function initClubs() {
    var list = $('[data-club-list]'); if (!list || !D) return;
    var qEl = $('[data-club-q]'), countEl = $('[data-club-count]');
    var P = new URLSearchParams(location.search);
    var st = { q: P.get('q') || '', prov: P.get('prov') || '' };
    qEl.value = st.q;
    var idx = D.clubs.map(function (c) { return { c: c, hay: norm([c.n, c.a, c.p, c.em.join(' ')].join(' ')) }; });
    function hl(text, terms) {
      var t = esc(text); if (!terms.length) return t;
      var n = norm(text), marks = [];
      terms.forEach(function (term) { var i = n.indexOf(term); while (i > -1) { marks.push([i, i + term.length]); i = n.indexOf(term, i + term.length); } });
      if (!marks.length) return t;
      marks.sort(function (a, b) { return a[0] - b[0]; });
      var out = '', pos = 0;
      marks.forEach(function (m) { if (m[0] < pos) return; out += esc(text.slice(pos, m[0])) + '<mark>' + esc(text.slice(m[0], m[1])) + '</mark>'; pos = m[1]; });
      return out + esc(text.slice(pos));
    }
    function render() {
      var terms = norm(st.q).split(/\s+/).filter(Boolean);
      var rows = idx.filter(function (o) {
        if (st.prov && o.c.p !== st.prov) return false;
        for (var k = 0; k < terms.length; k++) if (o.hay.indexOf(terms[k]) === -1) return false;
        return true;
      });
      $$('[data-prov]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-prov') === st.prov ? 'true' : 'false'); });
      countEl.innerHTML = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'club' : 'clubes') + (st.prov ? ' en ' + esc(st.prov) : ' en Andalucía');
      if (!rows.length) { list.innerHTML = '<div class="empty" style="grid-column:1/-1"><svg aria-hidden="true"><use href="#p-precision"/></svg><p><b>No encontramos clubes con esa búsqueda.</b><br>Prueba con la localidad o contacta con tu delegación.</p></div>'; return; }
      list.innerHTML = rows.map(function (o) {
        var c = o.c, maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.n + ' ' + (c.a || c.p) + ' ' + c.p);
        return '<article class="club"><span class="c-prov">' + esc(c.p) + '</span><h3>' + hl(c.n, terms) + '</h3>' +
          (c.a ? '<p class="c-addr"><svg aria-hidden="true"><use href="#i-pin"/></svg><span>' + hl(c.a, terms) + '</span></p>' : '') +
          '<div class="c-actions">' +
          c.ph.slice(0, 2).map(function (p) { return '<a class="icon-btn" href="tel:+34' + p.replace(/\s/g, '') + '"><svg aria-hidden="true"><use href="#i-phone"/></svg>' + esc(p) + '</a>'; }).join('') +
          c.em.slice(0, 1).map(function (m) { return '<a class="icon-btn" href="mailto:' + esc(m) + '"><svg aria-hidden="true"><use href="#i-mail"/></svg>Email</a><button class="icon-btn" type="button" data-copy="' + esc(m) + '" aria-label="Copiar ' + esc(m) + '"><svg aria-hidden="true"><use href="#i-copy"/></svg></button>'; }).join('') +
          (c.w ? '<a class="icon-btn" href="https://' + esc(c.w) + '" target="_blank" rel="noopener">Web</a>' : '') +
          '<a class="icon-btn" href="' + maps + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-map"/></svg>Mapa</a>' +
          '</div></article>';
      }).join('');
      var p = new URLSearchParams(); if (st.q) p.set('q', st.q); if (st.prov) p.set('prov', st.prov);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : ''));
    }
    var t; qEl.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { st.q = qEl.value.trim(); render(); }, 140); });
    $$('[data-prov]').forEach(function (b) { b.addEventListener('click', function () { st.prov = b.getAttribute('data-prov'); render(); }); });
    render();
  }

  /* ---------- Tabs (generic, accesible) ---------- */
  function initTabs() {
    $$('[role="tablist"]').forEach(function (tl) {
      var tabs = $$('[role="tab"]', tl);
      var vertical = tl.getAttribute('aria-orientation') === 'vertical';
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
          var p = document.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on;
        });
        if (focus) tab.focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          var nextKey = vertical ? 'ArrowDown' : 'ArrowRight', prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
          if (e.key === nextKey) { e.preventDefault(); select(tabs[(i + 1) % tabs.length], true); }
          if (e.key === prevKey) { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length], true); }
          if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
          if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
        });
      });
      tl._select = select; tl._tabs = tabs;
    });
    $$('[data-step-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        var tl = $('[data-protocol] [role="tablist"]'); if (!tl || !tl._tabs) return;
        var cur = tl._tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
        var nx = tl._tabs[Math.min(cur + 1, tl._tabs.length - 1)]; tl._select(nx, true);
        if (window.innerWidth < 900) nx.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  /* ---------- Copy buttons ---------- */
  function initCopy() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]'); if (!b) return;
      copyText(b.getAttribute('data-copy'), 'Copiado: ' + b.getAttribute('data-copy'));
    });
  }

  /* ---------- News filter ---------- */
  function initNews() {
    var list = $('[data-news-list]'); if (!list) return;
    $$('[data-news]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-news');
        $$('[data-news]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        $$('.news-card', list).forEach(function (c) { c.hidden = !!t && c.getAttribute('data-type') !== t; c.classList.add('is-in'); });
      });
    });
  }

  /* ---------- Contact form ---------- */
  function initContact() {
    var f = $('[data-contact]'); if (!f) return;
    var status = $('[data-form-status]');
    function setErr(input, msg) {
      var field = input.closest('.field') || input.closest('.check');
      if (field) field.classList.toggle('has-error', !!msg);
      var err = field && $('.err', field); if (err) err.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function validate(input) {
      var v = (input.value || '').trim(), msg = '';
      if (input.type === 'checkbox') { if (input.required && !input.checked) msg = 'Debes aceptar la política de privacidad.'; }
      else if (input.required && !v) msg = 'Este campo es obligatorio.';
      else if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Introduce un correo válido.';
      else if (input.type === 'tel' && v && !/^[+\d][\d\s-]{8,}$/.test(v)) msg = 'Introduce un teléfono válido.';
      else if (input.minLength > 0 && v.length < input.minLength) msg = 'Cuéntanos un poco más (mínimo ' + input.minLength + ' caracteres).';
      setErr(input, msg); return !msg;
    }
    $$('input, select, textarea', f).forEach(function (i) { i.addEventListener('blur', function () { if (i.type !== 'checkbox') validate(i); }); i.addEventListener('change', function () { if (i.getAttribute('aria-invalid') === 'true') validate(i); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, firstBad = null;
      $$('input, select, textarea', f).forEach(function (i) { if (!validate(i)) { ok = false; firstBad = firstBad || i; } });
      if (!ok) { status.className = 'form-status is-err'; status.textContent = 'Revisa los campos marcados.'; firstBad.focus(); return; }
      var d = new FormData(f), opt = f.querySelector('#c-prov').selectedOptions[0], cc = opt ? opt.getAttribute('data-mail') : '';
      var subject = '[Web FATO] ' + d.get('motivo') + ' — ' + d.get('nombre');
      var body = ['Nombre: ' + d.get('nombre'), 'Email: ' + d.get('email'), 'Teléfono: ' + (d.get('telefono') || '—'), 'Provincia: ' + d.get('provincia'), 'Motivo: ' + d.get('motivo'), '', d.get('mensaje'), '', '—', 'Acepta política de privacidad: sí', 'Acepta comunicaciones: ' + (d.get('publicidad') ? 'sí' : 'no')].join('\n');
      var href = 'mailto:info@fato.es?' + (cc ? 'cc=' + encodeURIComponent(cc) + '&' : '') + 'subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      window.location.href = href;
      status.className = 'form-status is-ok';
      status.textContent = 'Hemos preparado tu mensaje en tu aplicación de correo. Si no se ha abierto, escríbenos directamente a info@fato.es.';
    });
  }

  function initOpenNow() {
    var el = $('[data-open-now]'); if (!el) return;
    var n = new Date(), dow = n.getDay(), h = n.getHours() + n.getMinutes() / 60, m = n.getMonth() + 1, d = n.getDate();
    var summer = (m > 6 || (m === 6 && d >= 15)) && (m < 9 || (m === 9 && d <= 15));
    var open = false;
    if (dow >= 1 && dow <= 5) {
      if (summer || dow === 5) open = h >= 8 && h < 15;
      else open = (h >= 9 && h < 14) || (h >= 16 && h < 19);
    }
    el.classList.toggle('is-open', open);
    el.textContent = open ? 'Abierto ahora' : 'Cerrado ahora';
  }

  function initToTop() {
    var b = $('.to-top'); if (!b) return;
    window.addEventListener('scroll', function () { b.classList.toggle('is-on', window.scrollY > 900); }, { passive: true });
    b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* Re-ajusta el salto a #ancla cuando ya han cargado fuentes e imágenes */
  function initHash() {
    if (!location.hash || location.hash.length < 2) return;
    var go = function () {
      var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (!t) return;
      var html = document.documentElement, prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto'; t.scrollIntoView({ block: 'start' }); html.style.scrollBehavior = prev;
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  }

  function initYear() { $$('[data-year]').forEach(function (y) { y.textContent = new Date().getFullYear(); }); }

  /* Utilidades compartidas con delegacion.js */
  window.FATO = { esc: esc, norm: norm, pretty: pretty, cap: cap, toast: toast, copyText: copyText, download: download,
    icsEsc: icsEsc, fold: fold, parseD: parseD, iso: iso, ymd: ymd, addDays: addDays, today: today,
    CAT: CAT, MON: MON, MONTHS: MONTHS, SCOPE: SCOPE };

  function boot() {
    safe(initNav, 'nav');
    safe(initCounters, 'counters');
    safe(initReveal, 'reveal');
    safe(initReticle, 'reticle');
    safe(initTicker, 'ticker');
    safe(initUpcoming, 'upcoming');
    safe(initCalendar, 'calendar');
    safe(initSpecCounts, 'specCounts');
    safe(initClubs, 'clubs');
    safe(initTabs, 'tabs');
    safe(initCopy, 'copy');
    safe(initNews, 'news');
    safe(initContact, 'contact');
    safe(initOpenNow, 'openNow');
    safe(initToTop, 'toTop');
    safe(initYear, 'year');
    safe(initHash, 'hash');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
