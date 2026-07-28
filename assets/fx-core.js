/* ============================================================
   FX core — one scheduler and one visibility source for every canvas effect.

   Why this exists: each effect used to run its own requestAnimationFrame loop
   and call getBoundingClientRect() inside it to decide whether it was on
   screen. getBoundingClientRect forces a synchronous layout flush, so with
   four or five effects live that was ~300 forced layouts a second, all of it
   competing with Lenis for the same frame. That is what made the site feel
   cheap and slow rather than any single effect being expensive.

   Now: ONE rAF loop drives everything, and visibility/size come from
   IntersectionObserver + ResizeObserver, which are asynchronous and never
   force layout. Effects read cached booleans and numbers instead of measuring.
   ============================================================ */
(function () {
  "use strict";

  var jobs = [];
  var running = false;
  var raf = null;

  function tick(ts) {
    raf = null;
    /* nothing on screen: stop the loop entirely rather than spin */
    var live = 0;
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      if (j.dead) continue;
      live++;
      try { j.fn(ts); } catch (e) { j.dead = true; }
    }
    if (live > 0 && !document.hidden) raf = requestAnimationFrame(tick);
    else running = false;
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null; running = false;
    } else start();
  });

  var FX = {
    /* register a per-frame callback on the shared loop */
    add: function (fn) {
      var job = { fn: fn, dead: false };
      jobs.push(job);
      start();
      return function () { job.dead = true; };
    },

    /* cached visibility + size for an element, no layout reads per frame.
       opts.gate: optional function returning false to force "not visible"
       (used for the consultation dialog, which is laid out but hidden). */
    watch: function (el, opts) {
      opts = opts || {};
      var st = { on: true, w: 0, h: 0, changed: false };

      if ('IntersectionObserver' in window) {
        st.on = false;
        new IntersectionObserver(function (entries) {
          st.on = entries[0].isIntersecting && entries[0].intersectionRatio > 0;
          if (st.on) start();
        }, { threshold: 0, rootMargin: '80px' }).observe(el);
      }

      function setSize(w, h) {
        w = Math.max(0, Math.round(w)); h = Math.max(0, Math.round(h));
        if (w !== st.w || h !== st.h) { st.w = w; st.h = h; st.changed = true; start(); }
      }
      if ('ResizeObserver' in window) {
        new ResizeObserver(function (entries) {
          var r = entries[0].contentRect;
          setSize(r.width, r.height);
        }).observe(el);
      } else {
        window.addEventListener('resize', function () {
          var r = el.getBoundingClientRect(); setSize(r.width, r.height);
        });
      }
      /* one measurement at setup is fine; it is the per-frame ones that hurt */
      var r0 = el.getBoundingClientRect();
      st.w = Math.round(r0.width); st.h = Math.round(r0.height); st.changed = true;

      st.visible = function () {
        if (document.hidden) return false;
        if (!st.on || st.w <= 0 || st.h <= 0) return false;
        if (opts.gate && !opts.gate()) return false;
        return true;
      };
      /* read-and-clear, so a resize triggers exactly one repaint */
      st.consumeResize = function () {
        if (!st.changed) return false;
        st.changed = false;
        return true;
      };
      return st;
    },

    /* pointer position cached from a single passive listener, shared by all
       effects, so they are not each installing their own handler */
    pointer: { x: 0, y: 0, has: false },

    coarse: !(window.matchMedia && window.matchMedia('(pointer:fine)').matches),
    reduce: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches)
  };

  window.addEventListener('pointermove', function (e) {
    FX.pointer.x = e.clientX; FX.pointer.y = e.clientY; FX.pointer.has = true;
  }, { passive: true });

  window.FX = FX;
})();
