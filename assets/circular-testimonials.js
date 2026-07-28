/* ============================================================
   Circular Testimonials — vanilla port of the GSAP "3D Circular
   Gallery" mechanic, adapted from images to spoken proof.

   A run of sector chips is seated around a large tilted ring that
   drifts on its own, can be grabbed and spun, and parallaxes its
   tilt toward the cursor. The centre of the ring holds a still,
   fully legible reader: hovering a chip loads that testimonial,
   and left alone the reader auto-advances through them.

   The rotation maths, entrance bloom and drag model are carried
   over from the reference unchanged; the per-card <img> preview is
   replaced by a text reader so nobody has to read off a spinning
   ring. GSAP (already on the page) is the only dependency.
   Targets [data-circular-testimonials].
   ============================================================ */
(function () {
  "use strict";
  if (!window.gsap) return;
  var gsap = window.gsap;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function num(el, attr, dflt) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? dflt : v;
  }

  function init(root) {
    var ring = root.querySelector(".et-ring");
    var reader = root.querySelector(".et-reader");
    if (!ring || !reader) return;

    // the authored cards are the POOL of real testimonials; we clone around the
    // ring so it looks densely stocked ("too many to count") while the reader
    // still cycles the genuine set
    var pool = Array.prototype.slice.call(ring.querySelectorAll(".et-card"));
    if (!pool.length) return;

    var isNarrow = window.matchMedia("(max-width:820px)").matches;
    var radius = num(root, "data-radius", isNarrow ? 250 : 480);
    var tilt = num(root, "data-tilt", isNarrow ? 60 : 52);
    var speed = num(root, "data-speed", 3.4);            // degrees / second
    var parallax = root.getAttribute("data-parallax") !== "false" && !isNarrow;
    var count = Math.round(num(root, isNarrow ? "data-count-narrow" : "data-count", isNarrow ? 18 : 34));
    count = Math.max(pool.length, count);

    // fill the ring to `count` by cloning the pool in order
    var items = [];
    for (var k = 0; k < count; k++) {
      var src = pool[k % pool.length];
      var el = (k < pool.length) ? src : src.cloneNode(true);
      if (k >= pool.length) ring.appendChild(el);
      items.push(el);
    }

    // reader elements
    var rMark = reader.querySelector(".et-r-mark");
    var rQuote = reader.querySelector(".et-r-quote");
    var rRole = reader.querySelector(".et-r-role");
    var rSector = reader.querySelector(".et-r-sector");
    var rDot = reader.querySelector(".et-r-dot");

    var angleInc = 360 / items.length;
    var baseAngles = items.map(function (_, i) { return i * angleInc - 90; });

    items.forEach(function (item, i) {
      gsap.set(item, {
        rotationY: 90,
        rotationZ: baseAngles[i],
        transformOrigin: "50% " + radius + "px"
      });
    });
    gsap.set(ring, { rotationX: tilt });

    var setZ = items.map(function (item) { return gsap.quickSetter(item, "rotationZ", "deg"); });

    // ── entrance: ring settles into tilt, chips bloom in. Opacity stays with
    // CSS (default 1) so a paused/backgrounded rAF can never leave it hidden. ──
    gsap.fromTo(ring, { rotationX: tilt + 16 }, { rotationX: tilt, duration: 1.4, ease: "power3.out" });
    // scale-only bloom (no opacity), so a stuck tween still leaves chips visible
    gsap.from(items, { scale: .5, duration: .7, ease: "back.out(1.6)",
      stagger: { amount: 1, from: "random" } });

    // ── the reader: content swaps INSTANTLY (never gated on a tween finishing),
    // the fade is decoration only so the words are always correct ──
    var activeIndex = -1;
    function paint(i) {
      if (i === activeIndex) return;
      activeIndex = i;
      var el = items[i];
      var accent = el.getAttribute("data-accent") || "#0E9C93";
      rQuote.textContent = el.getAttribute("data-quote") || "";
      rRole.textContent = el.getAttribute("data-role") || "";
      rSector.textContent = el.getAttribute("data-sector") || "";
      reader.style.setProperty("--c", accent);
      if (rMark) rMark.style.color = accent;
      if (rDot) rDot.style.background = accent;
      items.forEach(function (c) { c.classList.toggle("is-active", c === el); });
      gsap.fromTo(reader, { opacity: .3, y: 8 }, { opacity: 1, y: 0, duration: .42, ease: "power3.out", overwrite: true });
    }
    // initial paint, no pop
    (function seed() { paint(0); gsap.set(reader, { opacity: 1, y: 0 }); })();

    // FX.watch gives cached on-screen visibility (IntersectionObserver, no
    // per-frame measuring) so the ring idles when scrolled away
    var vis = (window.FX && FX.watch) ? FX.watch(root, {}) : { visible: function () { return true; } };

    // ── rotation: eased current chasing a target, nudged by auto-spin + drag ──
    var current = 0, target = 0, dragging = false, lastX = 0, hovering = false;

    function tick() {
      if (!vis.visible()) return;
      if (!reduce && !dragging && !hovering) target += (speed / 60) * gsap.ticker.deltaRatio();
      current += (target - current) * 0.05;
      for (var i = 0; i < setZ.length; i++) setZ[i](baseAngles[i] + current);
    }
    gsap.ticker.add(tick);

    // ── auto-advance the reader, paused while hovered or off-screen ──
    if (!reduce) setInterval(function () {
      if (hovering || !vis.visible()) return;
      paint((activeIndex + 1) % items.length);
    }, 4200);

    // ── chip interaction ──
    items.forEach(function (el, i) {
      el.addEventListener("pointerenter", function () { paint(i); });
      el.addEventListener("click", function () { paint(i); });
    });

    // ── drag to spin + cursor parallax ──
    root.addEventListener("pointerdown", function (e) {
      dragging = true; lastX = e.clientX;
      if (root.setPointerCapture) try { root.setPointerCapture(e.pointerId); } catch (x) {}
      root.classList.add("is-grabbing");
    });
    root.addEventListener("pointermove", function (e) {
      if (parallax) {
        var r = root.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(ring, { rotationX: tilt + py * 3, rotationY: px * 3,
          duration: 1.4, ease: "power2.out", overwrite: "auto" });
      }
      if (dragging) { target += (e.clientX - lastX) * 0.3; lastX = e.clientX; }
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (root.releasePointerCapture && e.pointerId != null) try { root.releasePointerCapture(e.pointerId); } catch (x) {}
      root.classList.remove("is-grabbing");
    }
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);

    // pause auto-advance while the cursor is anywhere over the ring stage
    root.addEventListener("pointerenter", function () { hovering = true; });
    root.addEventListener("pointerleave", function () { hovering = false; endDrag({}); });

    // re-seat on breakpoint flips (radius / tilt change)
    var wasNarrow = isNarrow;
    window.addEventListener("resize", function () {
      var n = window.matchMedia("(max-width:820px)").matches;
      if (n === wasNarrow) return;
      wasNarrow = n;
      var R = num(root, "data-radius", n ? 250 : 480);
      var T = num(root, "data-tilt", n ? 60 : 52);
      items.forEach(function (item, i) {
        gsap.set(item, { transformOrigin: "50% " + R + "px" });
      });
      gsap.set(ring, { rotationX: T });
      radius = R; tilt = T; parallax = root.getAttribute("data-parallax") !== "false" && !n;
    });
  }

  document.querySelectorAll("[data-circular-testimonials]").forEach(init);
})();
