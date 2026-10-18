/* FATO · delegacion.js — páginas de delegación y portada de delegaciones.
   Datos: assets/data/deleg-<provincia>.js (copia local) + refresco en directo desde la API de fato.es. */
(function () {
  'use strict';

  /* Cambia API a '' si el sistema de eventos de WordPress deja de existir. */
  var API = 'https://fato.es/wp-json/tribe/events/v1/events';
  var F = window.FATO; if (!F) return;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function safe(fn, n) { try { fn(); } catch (e) { if (window.console) console.warn('[FATO] ' + n, e); } }
  var esc = F.esc, norm = F.norm, CAT = F.CAT;
  var DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var DOWL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var TYPE = { oficial: 'Oficial', tirada: 'Tirada de club', entrenamiento: 'Entrenamiento controlado', curso: 'Curso' };
  var CATMAP = { precision: 'precision', 'aire comprimido': 'precision', plato: 'plato', rrtt: 'recorridos', 'armas historicas': 'historicas', 'alta precision': 'alta', fclass: 'fclass' };
  var NOW = new Date(), T0 = F.today();

  function city(c) {
    return String(c || '').toLowerCase().replace(/(^|[\s\-(])([a-záéíóúñ])/g, function (m, a, l) { return a + l.toUpperCase(); })
      .replace(/(?<=\S)\s(De|Del|La|Las|Los|El|Y)(?=\s)/g, function (m, w) { return ' ' + w.toLowerCase(); });
  }
  function pd(s) { var d = s.split('T'), p = d[0].split('-'), t = (d[1] || '00:00').split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +t[0], +t[1]); }
  function hm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function stamp(d, withTime) { return F.ymd(d) + (withTime ? 'T' + hm(d).replace(':', '') + '00' : ''); }

  /* ---------- Saneado de descripciones de la API (lista blanca) ---------- */
  function sanitize(raw) {
    var doc = new DOMParser().parseFromString('<div>' + (raw || '') + '</div>', 'text/html');
    var keep = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, UL: 1, OL: 1, LI: 1, A: 1 }, results = [];
    function walk(node) {
      var out = '';
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        var inner = walk(n), tag = n.tagName;
        if (tag === 'A') {
          var href = n.getAttribute('href') || '';
          if (!/^(https?:|mailto:|tel:)/i.test(href)) { out += inner; return; }
          var txt = n.textContent.trim();
          if (/\.pdf($|\?)/i.test(href) || /resultado|clasificaci/i.test(txt)) results.push([txt || 'Resultados', href]);
          out += '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + inner + '</a>';
        } else if (keep[tag]) { var t = tag === 'B' ? 'strong' : tag.toLowerCase(); out += tag === 'BR' ? '<br>' : '<' + t + '>' + inner + '</' + t + '>'; }
        else out += inner;
      });
      return out;
    }
    var html = walk(doc.body.firstChild).replace(/ /g, ' ').replace(/<p>\s*<\/p>/g, '').replace(/\s+/g, ' ').trim();
    return { html: html, results: results };
  }

  /* ---------- Normalización ---------- */
  function fromLocal(L) {
    return L.events.map(function (e) {
      return { key: 'f' + e.id, id: e.id, t: e.t, s: pd(e.s), e: pd(e.e), ad: e.ad, cat: e.cat, ty: e.ty,
        venue: e.v != null ? L.venues[e.v] : null, o: e.o, u: e.u, d: e.d != null ? L.descs[e.d] : '', r: e.r || [], src: 'fato' };
    });
  }
  function fromApi(e) {
    var names = (e.categories || []).map(function (c) { return c.name; }), sn = names.map(norm);
    var cat = []; sn.forEach(function (n) { if (CATMAP[n] && cat.indexOf(CATMAP[n]) < 0) cat.push(CATMAP[n]); });
    var div = document.createElement('div'); div.innerHTML = e.title; var t = div.textContent.trim();
    var T = t.toUpperCase(), ty = 'tirada';
    if (sn.indexOf('entrenamiento controlado') > -1 || T.indexOf('ENTRENAMIENTO CONTROLADO') > -1) ty = 'entrenamiento';
    else if (sn.some(function (n) { return n.indexOf('curso') === 0; }) || T.indexOf('CURSO') === 0) ty = 'curso';
    else if (sn.indexOf('sede') > -1 || /\bCTO\b|CAMPEONATO|COPA|LIGA|TECNIFICACI/.test(T)) ty = 'oficial';
    var v = e.venue && e.venue.venue ? e.venue : null, sz = sanitize(e.description);
    var org = (e.organizer && e.organizer[0] && e.organizer[0].organizer) || '';
    var od = document.createElement('div'); od.innerHTML = org;
    var vd = document.createElement('div'); if (v) vd.innerHTML = v.venue;
    return { key: 'f' + e.id, id: e.id, t: t, s: pd(e.start_date.replace(' ', 'T')), e: pd(e.end_date.replace(' ', 'T')), ad: !!e.all_day,
      cat: cat, ty: ty, venue: v ? { n: vd.textContent, a: v.address || '', c: (v.city || ''), ph: v.phone || '' } : null,
      o: od.textContent, u: e.url, d: sz.html, r: sz.results, src: 'fato' };
  }
  function fromCalendar(provName, fatoEvents) {
    var D = window.FATO_DATA; if (!D) return [];
    return D.events.map(function (e, i) { return [e, i]; }).filter(function (p) { return p[0].prov === provName; }).filter(function (p) {
      var e = p[0];
      if (e.scope !== 'andalucia') return true;
      return !fatoEvents.some(function (f) { return f.ty === 'oficial' && F.iso(f.s) === e.s; });
    }).map(function (p) {
      var e = p[0];
      return { key: 'r' + p[1], t: e.t + (e.x ? ' (cancelada)' : ''), s: F.parseD(e.s), e: new Date(F.parseD(e.e).getTime() + 86399000), ad: true,
        cat: e.cat, ty: 'oficial', venue: { n: e.loc, a: '', c: '', ph: '' }, o: e.scope === 'andalucia' ? 'FATO' : 'RFEDETO', u: 'calendario.html',
        d: '<p>Prueba del Programa General de Competiciones RFEDETO-FATO (' + F.SCOPE[e.scope].toLowerCase() + '). Consulta inscripción y horarios con la organización.</p>', r: [], src: 'rfedeto' };
    });
  }

  /* ---------- ICS / Google ---------- */
  function ics(list) {
    var now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FATO//Delegaciones//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    list.forEach(function (e) {
      var loc = e.venue ? [e.venue.n, e.venue.a, e.venue.c].filter(Boolean).join(', ') : '';
      L.push('BEGIN:VEVENT', 'UID:fato-' + e.key + '@fato.es', 'DTSTAMP:' + now,
        e.ad ? 'DTSTART;VALUE=DATE:' + stamp(e.s) : 'DTSTART:' + stamp(e.s, true),
        e.ad ? 'DTEND;VALUE=DATE:' + stamp(F.addDays(dayStart(e.e), 1)) : 'DTEND:' + stamp(e.e, true),
        F.fold('SUMMARY:' + F.icsEsc(F.pretty(e.t))), F.fold('LOCATION:' + F.icsEsc(loc)),
        F.fold('DESCRIPTION:' + F.icsEsc((e.o ? 'Organiza: ' + e.o + '. ' : '') + 'Más información: ' + (e.u.indexOf('http') === 0 ? e.u : 'https://fato.es/' + e.u))),
        'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  function gcal(e) {
    var dates = e.ad ? stamp(e.s) + '/' + stamp(F.addDays(dayStart(e.e), 1)) : stamp(e.s, true) + '/' + stamp(e.e, true);
    var loc = e.venue ? [e.venue.n, e.venue.c].filter(Boolean).join(', ') : '';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(F.pretty(e.t)) + '&dates=' + dates + '&ctz=Europe/Madrid&location=' + encodeURIComponent(loc);
  }
  function mapUrl(v) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([v.n, v.a, v.c].filter(Boolean).join(', ')); }

  /* ---------- Render de un evento ---------- */
  function item(e) {
    var past = e.e < NOW, sameDay = F.iso(e.s) === F.iso(e.e);
    var when = e.ad ? (sameDay ? 'Todo el día' : e.s.getDate() + ' ' + F.MON[e.s.getMonth()] + ' – ' + e.e.getDate() + ' ' + F.MON[e.e.getMonth()])
      : (sameDay ? hm(e.s) + '–' + hm(e.e) : hm(e.s) + ' · hasta ' + e.e.getDate() + ' ' + F.MON[e.e.getMonth()]);
    var tags = '<span class="tag tag--type-' + e.ty + '">' + TYPE[e.ty] + '</span>' +
      e.cat.map(function (c) { return '<span class="tag" data-c="' + c + '" style="box-shadow:inset 3px 0 0 var(--c)">' + CAT[c] + '</span>'; }).join('') +
      (e.r.length ? '<span class="tag tag--res">Resultados</span>' : '') + (e.src === 'rfedeto' ? '<span class="tag">Calendario oficial</span>' : '');
    var v = e.venue;
    var acts = e.r.map(function (r) { return '<a class="btn btn--green btn--sm" href="' + esc(r[1]) + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-file"/></svg>' + esc(r[0].length > 40 ? 'Resultados' : r[0]) + '</a>'; }).join('') +
      (past ? '' : '<button class="btn btn--sm" type="button" data-ics-key="' + e.key + '"><svg aria-hidden="true"><use href="#i-cal-plus"/></svg>Añadir (.ics)</button><a class="btn btn--ghost btn--sm" href="' + gcal(e) + '" target="_blank" rel="noopener">Google Calendar</a>') +
      (v && v.n && e.src === 'fato' ? '<a class="btn btn--ghost btn--sm" href="' + mapUrl(v) + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-map"/></svg>Cómo llegar</a>' : '') +
      '<a class="btn btn--ghost btn--sm" href="' + esc(e.u) + '"' + (e.src === 'fato' ? ' target="_blank" rel="noopener"' : '') + '>' + (e.src === 'fato' ? 'Ficha en fato.es <svg aria-hidden="true"><use href="#i-arrow-ur"/></svg>' : 'Ver en el calendario') + '</a>';
    return '<details class="dev' + (past ? ' is-past' : '') + '" data-c="' + (e.cat[0] || 'precision') + '">' +
      '<summary><div class="dev-date"><b>' + String(e.s.getDate()).padStart(2, '0') + '</b><span>' + F.MON[e.s.getMonth()] + '</span><small>' + DOW[e.s.getDay()] + '</small></div>' +
      '<div class="dev-main"><h3>' + esc(F.pretty(e.t)) + '</h3><p class="dev-meta"><span><svg aria-hidden="true"><use href="#i-clock"/></svg>' + when + '</span>' +
      (v && v.n ? '<span><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(F.pretty(v.n)) + (v.c ? ' · ' + esc(city(v.c)) : '') + '</span>' : '') + '</p>' +
      '<div class="event-tags">' + tags + '</div></div><svg class="dev-chev" aria-hidden="true"><use href="#i-chev"/></svg></summary>' +
      '<div class="dev-body"><div class="dev-desc">' + (e.d || '<p>Consulta la inscripción y el reglamento en la ficha de la competición.</p>') + '</div>' +
      '<dl class="dev-info">' + (e.o ? '<div><dt>Organiza</dt><dd>' + esc(F.pretty(e.o)) + '</dd></div>' : '') +
      (v && v.n ? '<div><dt>Recinto</dt><dd>' + esc(F.pretty(v.n)) + (v.a ? '<br>' + esc(v.a) : '') + (v.c ? ', ' + esc(city(v.c)) : '') + '</dd></div>' : '') +
      (v && v.ph ? '<div><dt>Teléfono</dt><dd><a href="tel:+34' + esc(v.ph.replace(/\D/g, '')) + '">' + esc(v.ph) + '</a></dd></div>' : '') + '</dl>' +
      '<div class="dev-actions">' + acts + '</div></div></details>';
  }

  /* ---------- Página de delegación ---------- */
  function initDelegPage() {
    var root = $('[data-deleg]'), L = window.FATO_DELEG; if (!root || !L) return;
    var slug = root.getAttribute('data-deleg'), name = L.name;
    var events = fromLocal(L), live = false;
    function all() { return events.concat(fromCalendar(name, events)).sort(function (a, b) { return a.s - b.s || a.t.localeCompare(b.t); }); }
    var list = all();
    var st = { q: '', when: 'up', ty: '', cats: [], res: false, limit: 40 };
    var listEl = $('[data-dlist]'), countEl = $('[data-dcount]'), moreEl = $('[data-dmore]');

    function filtered() {
      var terms = norm(st.q).split(/\s+/).filter(Boolean);
      return list.filter(function (e) {
        if (st.when === 'up' && e.e < NOW) return false;
        if (st.when === 'past' && e.e >= NOW) return false;
        if (st.ty && e.ty !== st.ty) return false;
        if (st.cats.length && !e.cat.some(function (c) { return st.cats.indexOf(c) > -1; })) return false;
        if (st.res && !e.r.length) return false;
        if (terms.length) {
          var hay = e._h || (e._h = norm([e.t, e.o, e.venue && e.venue.n, e.venue && e.venue.c, TYPE[e.ty]].concat(e.cat.map(function (c) { return CAT[c]; })).join(' ')));
          for (var k = 0; k < terms.length; k++) if (hay.indexOf(terms[k]) === -1) return false;
        }
        return true;
      });
    }
    function render() {
      var rows = filtered();
      if (st.when === 'past') rows = rows.slice().reverse();
      countEl.innerHTML = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'competición' : 'competiciones') + ({ up: ' próximas', past: ' celebradas', all: ' esta temporada' })[st.when];
      $$('[data-when]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-when') === st.when ? 'true' : 'false'); });
      $$('[data-dcat]').forEach(function (b) { b.setAttribute('aria-pressed', st.cats.indexOf(b.getAttribute('data-dcat')) > -1 ? 'true' : 'false'); });
      if (!rows.length) {
        listEl.innerHTML = '<div class="empty"><svg aria-hidden="true"><use href="#p-precision"/></svg><p><b>' + (st.when === 'up' && !st.q && !st.ty && !st.cats.length ? 'La delegación no tiene competiciones próximas publicadas.' : 'Sin resultados con estos filtros.') +
          '</b><br>Prueba con «Celebradas», revisa el <a href="calendario.html?prov=' + encodeURIComponent(name) + '&todas=1">calendario general</a> o contacta con la delegación.</p></div>';
        moreEl.hidden = true; return;
      }
      var shown = rows.slice(0, st.limit), groups = [], cur = null;
      shown.forEach(function (e) { var k = e.s.getFullYear() + '-' + e.s.getMonth(); if (!cur || cur.k !== k) { cur = { k: k, d: e.s, items: [] }; groups.push(cur); } cur.items.push(e); });
      listEl.innerHTML = groups.map(function (g) {
        return '<section class="month-block"><div class="month-title"><h2>' + F.cap(F.MONTHS[g.d.getMonth()]) + '</h2><span>' + g.d.getFullYear() + '</span></div><div class="dev-list">' + g.items.map(item).join('') + '</div></section>';
      }).join('');
      moreEl.hidden = rows.length <= st.limit;
      moreEl.textContent = 'Mostrar más (' + (rows.length - st.limit) + ' restantes)';
    }
    function stats() {
      var D = window.FATO_DATA, up = list.filter(function (e) { return e.e >= NOW; }).length;
      var clubs = D ? D.clubs.filter(function (c) { return c.p === name; }).length : 0;
      var res = list.filter(function (e) { return e.r.length; }).length;
      var set = function (k, v) { var el = $('[data-dstat="' + k + '"]'); if (el) el.textContent = v; };
      set('upcoming', up); set('total', list.length); set('clubs', clubs); set('results', res);
    }
    function next() {
      var box = $('[data-next]'), e = list.filter(function (x) { return x.e >= NOW && !/cancelada/i.test(x.t); })[0];
      if (!e) { box.innerHTML = '<p class="eyebrow">Próxima competición en ' + esc(name) + '</p><p class="next-empty">No hay competiciones próximas publicadas por la delegación. Consulta las <button class="linklike" type="button" data-goto-past>competiciones celebradas</button> o el <a href="calendario.html">calendario general</a>.</p>';
        var g = $('[data-goto-past]', box); if (g) g.addEventListener('click', function () { st.when = 'past'; render(); $('#agenda').scrollIntoView({ behavior: 'smooth' }); });
        return; }
      var v = e.venue;
      box.innerHTML = '<div class="next-l"><p class="eyebrow">Próxima competición en ' + esc(name) + '</p><h2 class="h-l">' + esc(F.pretty(e.t)) + '</h2>' +
        '<p class="next-when">' + F.cap(DOWL[e.s.getDay()]) + ', ' + e.s.getDate() + ' de ' + F.MONTHS[e.s.getMonth()] + (e.ad ? '' : ' · ' + hm(e.s) + ' h') + (v && v.n ? '<br><span>' + esc(F.pretty(v.n)) + (v.c ? ' · ' + esc(city(v.c)) : '') + '</span>' : '') + '</p>' +
        '<div class="next-actions"><button class="btn btn--signal" type="button" data-ics-key="' + e.key + '"><svg aria-hidden="true"><use href="#i-cal-plus"/></svg> Añadir a mi calendario</button>' +
        '<a class="btn btn--ghost" href="' + esc(e.u) + '"' + (e.src === 'fato' ? ' target="_blank" rel="noopener"' : '') + '>Inscripción y detalles</a></div></div>' +
        '<div class="countdown" aria-label="Cuenta atrás"><div><b data-cd="d">0</b><span>días</span></div><div><b data-cd="h">0</b><span>horas</span></div><div><b data-cd="m">0</b><span>min</span></div></div>';
      function tick() {
        var ms = Math.max(0, e.s - new Date()), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
        var set = function (k, val) { var el = $('[data-cd="' + k + '"]', box); if (el) el.textContent = val; };
        set('d', d); set('h', h); set('m', m);
      }
      tick(); clearInterval(next._t); next._t = setInterval(tick, 30000);
    }
    function venues() {
      var box = $('[data-venues]'); if (!box) return;
      var vs = (L.venues || []).slice().sort(function (a, b) { return b.k - a.k; });
      if (!vs.length) { box.innerHTML = '<p class="empty" style="grid-column:1/-1">Esta delegación aún no tiene recintos asociados a competiciones publicadas.</p>'; return; }
      box.innerHTML = vs.map(function (v) {
        return '<article class="venue"><span class="v-count"><b>' + v.k + '</b> competiciones</span><h3>' + esc(F.pretty(v.n)) + '</h3>' +
          '<p class="c-addr"><svg aria-hidden="true"><use href="#i-pin"/></svg><span>' + esc([v.a, city(v.c)].filter(Boolean).join(' · ')) + '</span></p>' +
          '<div class="c-actions">' + (v.ph ? '<a class="icon-btn" href="tel:+34' + esc(v.ph.replace(/\D/g, '')) + '"><svg aria-hidden="true"><use href="#i-phone"/></svg>' + esc(v.ph) + '</a>' : '') +
          '<a class="icon-btn" href="' + mapUrl(v) + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-map"/></svg>Mapa</a>' +
          '<button class="icon-btn" type="button" data-venue-q="' + esc(v.n) + '"><svg aria-hidden="true"><use href="#i-cal"/></svg>Ver su agenda</button></div></article>';
      }).join('');
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-venue-q]'); if (!b) return;
        st.q = b.getAttribute('data-venue-q'); $('[data-dq]').value = st.q; st.when = 'all'; st.limit = 40; render();
        $('#agenda').scrollIntoView({ behavior: 'smooth' });
      });
    }
    function clubs() {
      var box = $('[data-dclubs]'), D = window.FATO_DATA; if (!box || !D) return;
      var cs = D.clubs.filter(function (c) { return c.p === name; });
      if (!cs.length) { box.innerHTML = '<p class="empty" style="grid-column:1/-1">No hay clubes registrados en el directorio para esta provincia.</p>'; return; }
      box.innerHTML = cs.map(function (c) {
        var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.n + ' ' + (c.a || c.p));
        return '<article class="club"><span class="c-prov">' + esc(c.p) + '</span><h3>' + esc(c.n) + '</h3>' +
          (c.a ? '<p class="c-addr"><svg aria-hidden="true"><use href="#i-pin"/></svg><span>' + esc(c.a) + '</span></p>' : '') +
          '<div class="c-actions">' + c.ph.slice(0, 1).map(function (p) { return '<a class="icon-btn" href="tel:+34' + p.replace(/\s/g, '') + '"><svg aria-hidden="true"><use href="#i-phone"/></svg>' + esc(p) + '</a>'; }).join('') +
          c.em.slice(0, 1).map(function (m) { return '<a class="icon-btn" href="mailto:' + esc(m) + '"><svg aria-hidden="true"><use href="#i-mail"/></svg>Email</a>'; }).join('') +
          '<a class="icon-btn" href="' + maps + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-map"/></svg>Mapa</a></div></article>';
      }).join('');
    }
    function liveState(ok) {
      var el = $('[data-live]'); if (!el) return;
      var u = L.updated ? pd(L.updated) : null;
      el.className = 'live-pill' + (ok ? ' is-live' : '');
      el.textContent = ok ? 'En directo · fato.es' : 'Datos a ' + (u ? u.getDate() + ' ' + F.MON[u.getMonth()] + ' ' + u.getFullYear() : 'última actualización');
      el.title = ok ? 'Próximas competiciones consultadas ahora mismo en fato.es' : 'Copia local del calendario de la delegación';
    }
    function refreshLive() {
      if (!API || !window.fetch || !window.AbortController) { liveState(false); return; }
      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 8000);
      var url = API + '?per_page=50&categories=' + slug + '&start_date=' + F.iso(T0);
      fetch(url, { signal: ctl.signal, credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
        clearTimeout(timer);
        var fresh = (data.events || []).map(fromApi);
        var ids = {}; fresh.forEach(function (x) { ids[x.key] = 1; });
        events = events.filter(function (x) { return x.e < T0 && !ids[x.key]; }).concat(fresh);
        list = all(); live = true; liveState(true); stats(); next(); render();
      }).catch(function () { clearTimeout(timer); liveState(false); });
    }

    var qT, qEl = $('[data-dq]');
    qEl.addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { st.q = qEl.value.trim(); st.limit = 40; render(); }, 160); });
    $$('[data-when]').forEach(function (b) { b.addEventListener('click', function () { st.when = b.getAttribute('data-when'); st.limit = 40; render(); }); });
    $('[data-dtype]').addEventListener('change', function (ev) { st.ty = ev.target.value; st.limit = 40; render(); });
    $$('[data-dcat]').forEach(function (b) { b.addEventListener('click', function () { var c = b.getAttribute('data-dcat'), k = st.cats.indexOf(c); if (k > -1) st.cats.splice(k, 1); else st.cats.push(c); st.limit = 40; render(); }); });
    $('[data-dres]').addEventListener('change', function (ev) { st.res = ev.target.checked; if (st.res && st.when === 'up') st.when = 'past'; st.limit = 40; render(); });
    $('[data-dreset]').addEventListener('click', function () { st = { q: '', when: 'up', ty: '', cats: [], res: false, limit: 40 }; qEl.value = ''; $('[data-dtype]').value = ''; $('[data-dres]').checked = false; render(); });
    moreEl.addEventListener('click', function () { st.limit += 40; render(); });
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ics-key]'); if (!b) return;
      var e = list.filter(function (x) { return x.key === b.getAttribute('data-ics-key'); })[0]; if (!e) return;
      F.download('fato-' + slug + '-' + F.iso(e.s) + '.ics', ics([e])); F.toast('Competición descargada para tu calendario');
    });
    $('[data-dexport]').addEventListener('click', function () {
      var rows = filtered().filter(function (e) { return e.e >= NOW; });
      if (!rows.length) { F.toast('No hay competiciones próximas que exportar'); return; }
      F.download('fato-' + slug + '-proximas.ics', ics(rows)); F.toast(rows.length + ' competiciones exportadas');
    });

    stats(); next(); venues(); clubs(); render(); liveState(false); refreshLive();
  }

  /* ---------- Portada de delegaciones ---------- */
  function initBoard() {
    var board = $('[data-deleg-board]'), S = window.FATO_DELEG_SUM; if (!board) return;
    var D = window.FATO_DATA, names = { almeria: 'Almería', cadiz: 'Cádiz', cordoba: 'Córdoba', granada: 'Granada', huelva: 'Huelva', jaen: 'Jaén', malaga: 'Málaga', sevilla: 'Sevilla' };
    var max = 1;
    Object.keys(names).forEach(function (p) {
      var row = $('[data-p="' + p + '"]', board), s = S && S.prov[p], name = names[p];
      var clubs = D ? D.clubs.filter(function (c) { return c.p === name; }).length : 0;
      var cal = D ? D.events.filter(function (e) { return e.prov === name && F.parseD(e.e) >= T0; }) : [];
      var up = (s ? s.upcoming : 0) + cal.length;
      $('[data-m]', row).textContent = clubs + (clubs === 1 ? ' club' : ' clubes') + ' · ' + up + ' próximas';
      var nx = s && s.next ? { t: s.next.t, d: pd(s.next.s) } : null;
      if (cal[0] && (!nx || F.parseD(cal[0].s) < nx.d)) nx = { t: cal[0].t, d: F.parseD(cal[0].s) };
      $('[data-n]', row).textContent = nx ? 'Próxima: ' + nx.d.getDate() + ' ' + F.MON[nx.d.getMonth()] + ' · ' + F.pretty(nx.t) : 'Sin competiciones próximas publicadas';
      if (s) max = Math.max(max, s.total);
    });
    var bars = $('[data-deleg-bars]');
    if (bars && S) {
      bars.innerHTML = Object.keys(names).sort(function (a, b) { return S.prov[b].total - S.prov[a].total; }).map(function (p) {
        return '<a class="pbar" href="delegacion-' + p + '.html"><span>' + names[p] + '</span><i style="--w:' + Math.max(2, Math.round(S.prov[p].total / max * 100)) + '%"></i><b>' + S.prov[p].total + '</b></a>';
      }).join('');
    }
  }

  safe(initDelegPage, 'delegación');
  safe(initBoard, 'tablero');
})();
