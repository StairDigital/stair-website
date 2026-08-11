/* ============================================================
   Perf probe — finds WHERE the site janks, not just that it does.

   Dev only: does nothing unless the URL carries ?perf=1
   (so it never costs anything on the real site).

   What it measures, and why each one matters here:
     1. Frame INTERVALS while scrolling. This is the honest number: it includes
        style, layout, paint and compositing, not just our JS.
     2. Per-effect JS cost. It wraps every callback registered on FX.add and
        attributes the time to the file that registered it (read off the stack
        at registration), so "wave-grid.js: 8ms/frame" is a real answer rather
        than a guess.
     3. Which SECTION was under the viewport centre on each dropped frame, so
        jank maps to a place you can scroll back to.
     4. Long tasks (>50ms) via PerformanceObserver — these are the freezes that
        make scrolling feel stuck.
     5. Canvas load: how many canvases are live and how many pixels they push,
        which on this site is usually the real cost.

   Usage:  http://localhost:8760/research.html?perf=1
           scroll the whole page slowly, then press  P  to print the report
           (or run __perf.report() / __perf.copy() in the console).
   ============================================================ */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  if (params.get('perf') !== '1') return;

  var DROPPED = 32;      /* >32ms means we missed a 60fps frame */
  var SEVERE = 50;       /* >50ms reads as a visible hitch */

  /* ---------- 1. attribute per-effect cost by wrapping FX.add ---------- */
  var effects = {};      /* name -> {frames, total, max} */

  function callerFile() {
    var stack = (new Error()).stack || '';
    var hits = stack.match(/assets\/([a-z0-9-]+)\.js/gi) || [];
    for (var i = 0; i < hits.length; i++) {
      var f = hits[i].replace('assets/', '');
      if (f !== 'perf-probe.js' && f !== 'fx-core.js') return f;
    }
    return 'unknown';
  }

  function wrapFX() {
    if (!window.FX || !window.FX.add || window.FX.__probed) return false;
    var originalAdd = window.FX.add;
    window.FX.add = function (fn) {
      var name = callerFile();
      var bucket = effects[name] || (effects[name] = { frames: 0, total: 0, max: 0 });
      return originalAdd.call(window.FX, function (ts) {
        var t0 = performance.now();
        fn(ts);
        var dt = performance.now() - t0;
        bucket.frames++;
        bucket.total += dt;
        if (dt > bucket.max) bucket.max = dt;
        frameJs += dt;
      });
    };
    window.FX.__probed = true;
    return true;
  }
  /* fx-core.js is loaded before us, but effects register after — patch now,
     and retry on DOMContentLoaded in case script order ever changes */
  if (!wrapFX()) document.addEventListener('DOMContentLoaded', wrapFX);

  /* ---------- 2. section map, resolved lazily ---------- */
  var sections = [];
  function mapSections() {
    sections = Array.prototype.map.call(
      document.querySelectorAll('section, header.nav, footer'),
      function (el) {
        var label = el.id ? '#' + el.id
                  : (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : el.tagName.toLowerCase());
        return { el: el, label: label };
      });
  }
  function sectionAtCentre() {
    var mid = window.scrollY + innerHeight / 2;
    for (var i = 0; i < sections.length; i++) {
      var el = sections[i].el;
      var top = el.offsetTop, bottom = top + el.offsetHeight;
      if (mid >= top && mid < bottom) return sections[i].label;
    }
    return '(between sections)';
  }

  /* ---------- 3. frame sampling ---------- */
  var frames = [];               /* every interval, ms */
  var frameJs = 0;               /* JS ms attributed this frame */
  var perSection = {};           /* label -> {frames, dropped, total, max} */
  var last = 0, started = 0, scrolling = false, scrollTimer = null;

  addEventListener('scroll', function () {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { scrolling = false; }, 140);
  }, { passive: true });

  function sample(ts) {
    requestAnimationFrame(sample);
    if (!started) { started = ts; last = ts; frameJs = 0; return; }
    var dt = ts - last;
    last = ts;
    if (dt <= 0 || dt > 2000) { frameJs = 0; return; }   /* tab was away */

    frames.push(dt);
    var label = scrolling ? sectionAtCentre() : null;
    if (label) {
      var s = perSection[label] || (perSection[label] = { frames: 0, dropped: 0, total: 0, max: 0 });
      s.frames++; s.total += dt;
      if (dt > s.max) s.max = dt;
      if (dt > DROPPED) s.dropped++;
    }
    frameJs = 0;
  }

  /* ---------- 4. long tasks ---------- */
  var longTasks = [];
  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          longTasks.push({ ms: Math.round(e.duration), where: sectionAtCentre() });
        });
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) { /* not supported */ }
  }

  /* ---------- 5. canvas load ---------- */
  function canvasLoad() {
    var out = [], totalPx = 0;
    Array.prototype.forEach.call(document.querySelectorAll('canvas'), function (c) {
      var r = c.getBoundingClientRect();
      var onScreen = r.bottom > 0 && r.top < innerHeight && r.width > 0;
      var px = c.width * c.height;
      totalPx += onScreen ? px : 0;
      var host = c.parentElement;
      var owner = host && (host.id || (host.className && String(host.className).trim().split(/\s+/)[0])) || 'body';
      out.push({ owner: owner, buffer: c.width + 'x' + c.height, mpx: +(px / 1e6).toFixed(2), onScreen: onScreen });
    });
    return { list: out, liveMpx: +(totalPx / 1e6).toFixed(2) };
  }

  /* ---------- helpers ---------- */
  function pct(arr, p) {
    if (!arr.length) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    return a[Math.min(a.length - 1, Math.floor(a.length * p))];
  }
  function r1(n) { return Math.round(n * 10) / 10; }

  /* HUD removed: it drew a small fps box over the page. The report still
     works — press P, or call __perf.report() in the console. */

  /* ---------- report ---------- */
  function report() {
    var all = frames;
    if (!all.length) return 'perf: no frames captured yet — scroll the page first.';
    var dropped = all.filter(function (f) { return f > DROPPED; });
    var severe = all.filter(function (f) { return f > SEVERE; });
    var avg = all.reduce(function (a, b) { return a + b; }, 0) / all.length;

    var L = [];
    L.push('=== STAIR perf report — ' + location.pathname + ' ===');
    L.push('device: ' + (navigator.hardwareConcurrency || '?') + ' cores, DPR ' + window.devicePixelRatio +
           ', viewport ' + innerWidth + 'x' + innerHeight +
           ', reduced-motion ' + (window.FX && window.FX.reduce ? 'ON' : 'off'));
    L.push('captured: ' + all.length + ' frames over ' + r1((last - started) / 1000) + 's');
    L.push('');
    L.push('FRAMES   avg ' + r1(avg) + 'ms (' + Math.round(1000 / avg) + ' fps)' +
           '   p95 ' + r1(pct(all, .95)) + 'ms   worst ' + r1(Math.max.apply(null, all)) + 'ms');
    L.push('         dropped >' + DROPPED + 'ms: ' + dropped.length +
           ' (' + r1(dropped.length / all.length * 100) + '%)   hitches >' + SEVERE + 'ms: ' + severe.length);
    L.push('');

    L.push('WORST SECTIONS (while scrolling, by dropped frames)');
    var secs = Object.keys(perSection).map(function (k) {
      var s = perSection[k];
      return { label: k, dropped: s.dropped, avg: s.total / s.frames, max: s.max, frames: s.frames };
    }).sort(function (a, b) { return b.dropped - a.dropped; });
    if (!secs.length) L.push('  (none — did you scroll?)');
    secs.slice(0, 8).forEach(function (s, i) {
      L.push('  ' + (i + 1) + '. ' + s.label + '  dropped ' + s.dropped + '/' + s.frames +
             '   avg ' + r1(s.avg) + 'ms   worst ' + r1(s.max) + 'ms');
    });
    L.push('');

    L.push('EFFECT JS COST (avg per frame / worst single frame)');
    var eff = Object.keys(effects).map(function (k) {
      var e = effects[k];
      return { name: k, avg: e.total / e.frames, max: e.max, frames: e.frames };
    }).sort(function (a, b) { return b.avg - a.avg; });
    if (!eff.length) L.push('  (no FX.add effects registered on this page)');
    eff.forEach(function (e) {
      if (!e.frames) {
        /* registered but never ticked — its IntersectionObserver gate kept it
           asleep the whole run, which is the behaviour we want */
        L.push('  ' + e.name + '  idle (never rendered — gated off-screen)');
      } else {
        L.push('  ' + e.name + '  ' + r1(e.avg) + 'ms / ' + r1(e.max) + 'ms   (' + e.frames + ' frames)');
      }
    });
    L.push('  note: three.js (wave-grid), GSAP and Lenis run outside FX.add,');
    L.push('        so their cost shows up in FRAMES but not in this list.');
    L.push('');

    if (longTasks.length) {
      L.push('LONG TASKS >50ms (main-thread freezes)');
      longTasks.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 10).forEach(function (t) {
        L.push('  ' + t.ms + 'ms  at ' + t.where);
      });
      L.push('');
    }

    var cv = canvasLoad();
    L.push('CANVAS LOAD   ' + cv.list.length + ' canvases, ' + cv.liveMpx + ' Mpx sitting in the viewport');
    cv.list.forEach(function (c) {
      L.push('  ' + (c.onScreen ? '[in-view] ' : '[off-view]') + ' ' + c.owner + '  ' + c.buffer + '  ' + c.mpx + ' Mpx');
    });
    L.push('  note: in-view is geometry only, not proof it is painting — a closed');
    L.push('        menu/dialog canvas still counts here but is gated off.');

    return L.join('\n');
  }

  function copy() {
    var text = report();
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    return text;
  }

  window.__perf = {
    report: function () { var t = report(); console.log(t); return t; },
    copy: copy,
    reset: function () { frames = []; perSection = {}; longTasks = []; effects = {}; started = 0; return 'reset'; },
    raw: function () { return { frames: frames, perSection: perSection, effects: effects, longTasks: longTasks }; }
  };

  addEventListener('keydown', function (e) {
    if (e.key === 'p' || e.key === 'P') {
      console.log(report());
      copy();
      console.log('%c^ copied to clipboard — paste it to Claude', 'color:#0E9C93;font-weight:bold');
    }
  });

  function boot() {
    mapSections();
    requestAnimationFrame(sample);
    addEventListener('resize', mapSections);
    /* section offsets move as images/fonts land */
    setTimeout(mapSections, 1500);
    setTimeout(mapSections, 4000);
    console.log('%cperf probe active — scroll the page, then press P', 'color:#0E9C93;font-weight:bold');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
