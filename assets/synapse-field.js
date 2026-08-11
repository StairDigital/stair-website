/* ============================================================
   Synapse field — the background for the Enterprise Brain page.

   Written for this page rather than ported, because none of the site's
   existing fields say "memory". A lattice of nodes holds still while
   signals travel the edges between them: the picture is recall, not decoration.

   Built to the same rules as the other fields here:
   - one shared FX.add tick, never its own rAF loop
   - FX.watch for visibility and size, so nothing measures per frame
   - DPR capped at 1.5, edges computed once per layout rather than per frame
   - prefers-reduced-motion draws a single still frame and stops

   Cost control: every edge is a separate line, but they are batched into
   three alpha buckets and stroked as three paths, so a 90-node lattice is
   3 stroke calls a frame rather than ~260.

   Targets [data-synapse].
   ============================================================ */
(function () {
  "use strict";

  function hex(c) {
    var h = String(c || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    return isNaN(n) ? [14, 156, 147] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  var rgba = function (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  function build(host) {
    var cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(cv);
    var ctx = cv.getContext('2d', { alpha: true });
    if (!ctx) return;

    var COL_LINE = hex(host.getAttribute('data-line') || '#0E9C93');
    var COL_NODE = hex(host.getAttribute('data-node') || '#0B857D');
    var COL_HOT = hex(host.getAttribute('data-hot') || '#F0854B');
    var DENSITY = +(host.getAttribute('data-density') || 1);
    var SPEED = +(host.getAttribute('data-speed') || 1);

    var st = FX.watch(host);
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var nodes = [], edges = [], signals = [], W = 0, H = 0;

    /* Jittered grid rather than pure random: random placement clumps, and a
       clumped lattice reads as noise instead of as a structure. */
    function layout(w, h) {
      W = w; H = h;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var target = Math.min(150, Math.max(26, Math.round(w * h / 15500 * DENSITY)));
      var cols = Math.max(3, Math.round(Math.sqrt(target * w / Math.max(h, 1))));
      var rows = Math.max(3, Math.ceil(target / cols));
      var cw = w / cols, ch = h / rows;

      nodes = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          nodes.push({
            hx: (c + 0.5) * cw + (Math.random() - 0.5) * cw * 0.72,
            hy: (r + 0.5) * ch + (Math.random() - 0.5) * ch * 0.72,
            x: 0, y: 0,
            ph: Math.random() * Math.PI * 2,          /* drift phase */
            sp: 0.22 + Math.random() * 0.3,           /* drift rate */
            am: 3 + Math.random() * 6,                /* drift amplitude */
            r: 1.1 + Math.random() * 1.9,
            lit: 0                                    /* decays after a signal lands */
          });
        }
      }

      /* Edges once per layout. O(n^2) on ~120 nodes is a few thousand
         comparisons at resize, which is free; doing it per frame would not be. */
      var reach = Math.max(cw, ch) * 1.5;
      edges = [];
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].hx - nodes[j].hx, dy = nodes[i].hy - nodes[j].hy;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < reach) edges.push({ a: i, b: j, w: 1 - d / reach });
        }
      }
      signals = [];
    }

    /* A signal walks one edge, then hands off to a connected edge, so the
       motion looks like a thought crossing the lattice rather than blinking. */
    function spawn() {
      if (!edges.length) return;
      var e = edges[(Math.random() * edges.length) | 0];
      signals.push({
        e: e, t: 0,
        sp: (0.24 + Math.random() * 0.3) * SPEED,
        from: Math.random() < 0.5 ? e.a : e.b,
        hot: Math.random() < 0.13,
        hops: 2 + ((Math.random() * 3) | 0)
      });
    }

    function step(sig, dt) {
      sig.t += sig.sp * dt;
      if (sig.t < 1) return true;
      var landed = sig.from === sig.e.a ? sig.e.b : sig.e.a;
      nodes[landed].lit = 1;
      if (--sig.hops <= 0) return false;
      /* pick a different edge leaving the node we just reached */
      var opts = [];
      for (var i = 0; i < edges.length && opts.length < 6; i++) {
        if (edges[i] !== sig.e && (edges[i].a === landed || edges[i].b === landed)) opts.push(edges[i]);
      }
      if (!opts.length) return false;
      sig.e = opts[(Math.random() * opts.length) | 0];
      sig.from = landed; sig.t = 0;
      return true;
    }

    var last = 0, still = false;
    function frame(ts) {
      if (!st.visible()) { last = 0; return; }
      if (st.consumeResize()) { layout(st.w, st.h); still = false; }
      if (!nodes.length) return;
      if (still) return;

      var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;
      var t = ts / 1000;

      /* positions */
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (FX.reduce) { n.x = n.hx; n.y = n.hy; continue; }
        n.x = n.hx + Math.cos(t * n.sp + n.ph) * n.am;
        n.y = n.hy + Math.sin(t * n.sp * 0.82 + n.ph * 1.7) * n.am * 0.8;
        if (n.lit > 0) n.lit = Math.max(0, n.lit - dt * 1.5);
      }

      ctx.clearRect(0, 0, W, H);

      /* three alpha buckets, three strokes */
      var B = [[0.05, []], [0.1, []], [0.17, []]];
      for (var k = 0; k < edges.length; k++) {
        var e = edges[k];
        B[e.w > 0.62 ? 2 : e.w > 0.32 ? 1 : 0][1].push(e);
      }
      ctx.lineWidth = 1;
      for (var b = 0; b < 3; b++) {
        var list = B[b][1];
        if (!list.length) continue;
        ctx.strokeStyle = rgba(COL_LINE, B[b][0]);
        ctx.beginPath();
        for (var m = 0; m < list.length; m++) {
          ctx.moveTo(nodes[list[m].a].x, nodes[list[m].a].y);
          ctx.lineTo(nodes[list[m].b].x, nodes[list[m].b].y);
        }
        ctx.stroke();
      }

      /* signals */
      if (!FX.reduce) {
        if (signals.length < Math.min(9, 3 + (edges.length / 90 | 0)) && Math.random() < 0.09) spawn();
        for (var s = signals.length - 1; s >= 0; s--) {
          var sg = signals[s];
          if (!step(sg, dt)) { signals.splice(s, 1); continue; }
          var a = nodes[sg.from], z = nodes[sg.from === sg.e.a ? sg.e.b : sg.e.a];
          var px = a.x + (z.x - a.x) * sg.t, py = a.y + (z.y - a.y) * sg.t;
          var col = sg.hot ? COL_HOT : COL_LINE;
          /* short comet tail back along the edge it is travelling */
          var g = ctx.createLinearGradient(a.x, a.y, px, py);
          g.addColorStop(0, rgba(col, 0));
          g.addColorStop(1, rgba(col, 0.5));
          ctx.strokeStyle = g; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(px, py); ctx.stroke();
          ctx.fillStyle = rgba(col, 0.85);
          ctx.beginPath(); ctx.arc(px, py, sg.hot ? 2.6 : 2, 0, 6.2832); ctx.fill();
        }
      }

      /* nodes last, so they sit above their own edges */
      for (var q = 0; q < nodes.length; q++) {
        var nd = nodes[q];
        ctx.fillStyle = rgba(COL_NODE, 0.2 + nd.lit * 0.65);
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, nd.r + nd.lit * 1.6, 0, 6.2832);
        ctx.fill();
      }

      /* reduced motion: one frame is the whole animation */
      if (FX.reduce) still = true;
    }

    FX.add(frame);
  }

  function init() {
    if (!window.FX) return;
    document.querySelectorAll('[data-synapse]').forEach(build);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
