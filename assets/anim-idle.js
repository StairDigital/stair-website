/* ============================================================
   Stop animating things nobody is looking at.

   The site's animations were honest about what they animate - almost all of
   them are transform/opacity - but they all shared one flaw: they ran forever.
   A hero gradient at the top of the page kept drifting while you read the
   footer, the scroll cue kept bobbing six screens away, and the morphing
   blobs on Engagements re-tessellated seven SVG paths every frame for as long
   as the tab was open. None of that is visible, all of it costs a frame.

   Measured on a completely still page before this existed: Leadership spent
   234ms of every 4 seconds in style recalculation, Proposal another 88ms in
   layout on top. Switching every animation off dropped both by about 92%,
   which is what identified this as the cause rather than any single effect.

   Two kinds of animation need two different handles:

     CSS      animation-play-state:paused freezes it where it stands and
              resumes from the same place, so nothing jumps.
     SMIL     <animate> inside SVG ignores animation-play-state entirely.
              It has its own clock, paused through the <svg> element's
              pauseAnimations()/unpauseAnimations().

   Both are gated on IntersectionObserver with a generous margin, so an
   animation is already moving by the time it scrolls into view and the
   visitor never catches it starting. Everything also stops while the tab is
   in the background.

   Deliberately generic: it finds its own targets by reading computed style,
   so a new animation added later is covered without touching this file.
   ============================================================ */
(function () {
  "use strict";

  if (!('IntersectionObserver' in window)) return;   /* leave as-is, never worse */

  /* Far enough ahead that resuming is never visible. Marquees and slow
     gradient drifts look identical whether they ran off-screen or not. */
  var MARGIN = '40% 0px';

  var css = [];     /* {el, io, near} */
  var smil = [];    /* {svg, io, near} */

  /* One set per pass, NOT one shared between them. The CSS pass walks every
     element, which includes every <svg>; with a single shared set it marked
     them all as seen and the SMIL pass then skipped every one, so the
     morphing blobs on Engagements kept animating off screen. An element has
     to be eligible for both gates independently. */
  var seenCss = (typeof WeakSet === 'function') ? new WeakSet() : null;
  var seenSmil = (typeof WeakSet === 'function') ? new WeakSet() : null;

  function once(set, el) {
    if (!set) return false;
    if (set.has(el)) return true;
    set.add(el);
    return false;
  }

  function watch(el, on, off) {
    var rec = { near: true };
    rec.io = new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis === rec.near) return;
      rec.near = vis;
      if (document.hidden) return;        /* the tab handler owns it right now */
      vis ? on() : off();
    }, { rootMargin: MARGIN });
    rec.io.observe(el);
    return rec;
  }

  /* ---- CSS animations that never end ---- */
  function considerCss(el) {
    if (once(seenCss, el)) return;
    var cs = getComputedStyle(el);
    if (!cs || cs.animationName === 'none' || !cs.animationName) return;
    if ((cs.animationIterationCount || '').indexOf('infinite') === -1) return;

    /* Leave anything with no box alone. A zero-area element costs nothing
       to animate, and the ones that are zero-area at load are usually UI
       waiting to be shown - the blueprint page's loading spinner, for one.
       Gating those risks pausing a spinner at the moment it is needed. */
    var box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;

    var rec = watch(el, resume(el), pause(el));
    rec.el = el;
    css.push(rec);
  }

  function collectCss(root) {
    var all = (root || document).querySelectorAll('*');
    for (var i = 0; i < all.length; i++) considerCss(all[i]);
  }

  function pause(el) {
    return function () { el.style.animationPlayState = 'paused'; };
  }
  function resume(el) {
    return function () { el.style.animationPlayState = ''; };
  }

  /* ---- SMIL (<animate> and friends) ---- */
  function considerSmil(svg) {
    if (once(seenSmil, svg)) return;
    if (!svg.querySelector('animate,animateTransform,animateMotion,set')) return;
    if (typeof svg.pauseAnimations !== 'function') return;

    var rec = watch(svg, smilOn(svg), smilOff(svg));
    rec.svg = svg;
    smil.push(rec);
  }

  function collectSmil(root) {
    var svgs = (root || document).querySelectorAll('svg');
    for (var i = 0; i < svgs.length; i++) considerSmil(svgs[i]);
  }

  /* A node handed over by the MutationObserver is itself a candidate; the
     querySelectorAll sweeps above only ever see descendants. */
  function collectOne(node) {
    considerCss(node);
    if (node.tagName && node.tagName.toLowerCase() === 'svg') considerSmil(node);
  }

  function smilOff(svg) {
    return function () { try { svg.pauseAnimations(); } catch (e) {} };
  }
  function smilOn(svg) {
    return function () { try { svg.unpauseAnimations(); } catch (e) {} };
  }

  /* ---- a hidden tab animates nothing at all ---- */
  document.addEventListener('visibilitychange', function () {
    var hidden = document.hidden;
    css.forEach(function (r) {
      if (hidden) r.el.style.animationPlayState = 'paused';
      else if (r.near) r.el.style.animationPlayState = '';
    });
    smil.forEach(function (r) {
      try { hidden ? r.svg.pauseAnimations() : (r.near && r.svg.unpauseAnimations()); } catch (e) {}
    });
  });

  function scan(root) { collectCss(root); collectSmil(root); }

  function idle(fn, ms) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: ms });
    else setTimeout(fn, 1);
  }

  /* One full pass, then watch for new nodes.

     Reading computed style for every element forces a style resolve for the
     whole document, so this waits for an idle moment rather than competing
     with first paint. It originally repeated that full sweep at 2.5s and 6s
     to catch things script builds later - the carousel ring, the article
     reader - and that was a bad trade: three whole-document sweeps measured
     as a 100% increase in idle cost on the Leadership page, which is exactly
     the kind of cost this file exists to remove.

     A MutationObserver does the same job for a fraction of the work, because
     it only ever looks at the subtrees that were actually added. */
  idle(function () {
    scan(document);

    if (typeof MutationObserver !== 'function') return;
    var queued = [];
    var timer = null;

    function drain() {
      timer = null;
      var batch = queued;
      queued = [];
      for (var i = 0; i < batch.length; i++) {
        var node = batch[i];
        if (!node.isConnected) continue;
        scan(node);              /* descendants */
        collectOne(node);        /* and the node itself */
      }
    }

    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) queued.push(added[j]);
        }
      }
      /* coalesce: a script building thirty carousel cells fires thirty times */
      if (queued.length && !timer) timer = setTimeout(drain, 400);
    }).observe(document.body, { childList: true, subtree: true });
  }, 1200);
})();
