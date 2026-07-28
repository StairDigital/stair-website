/* ============================================================
   Industry deck: a 3D fanned card stack that turns on its own.
   Deliberately unlike the About page (no marquee, no pinned scrub):
   cards orbit in perspective, auto-advancing, and hand the reader to
   the Industries page. Pauses when hovered, focused, off-screen or hidden.
   ============================================================ */
(function () {
  "use strict";
  var deck = document.getElementById('tiDeck');
  if (!deck) return;
  var stage = deck.querySelector('.ti-stage');
  var cards = Array.prototype.slice.call(deck.querySelectorAll('.ti-card'));
  var dotsWrap = document.getElementById('tiDots');
  if (!cards.length) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var n = cards.length;
  var active = 0;
  var hovering = false;
  var timer = null;
  var DWELL = 4200;

  /* dots */
  var dots = cards.map(function (c, i) {
    var b = document.createElement('button');
    b.className = 'ti-dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', (c.querySelector('h3') || {}).textContent || ('Industry ' + (i + 1)));
    b.addEventListener('click', function () { go(i, true); });
    dotsWrap && dotsWrap.appendChild(b);
    return b;
  });

  /* shortest signed distance around the ring, so the deck never unwinds the long way */
  function delta(i) {
    var d = i - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  function layout() {
    for (var i = 0; i < n; i++) {
      var d = delta(i), a = Math.abs(d);
      var x = d * 46;                       /* % of card width */
      var z = -a * 190;                     /* px pushed back   */
      var ry = -d * 21;                     /* deg turned away  */
      var sc = Math.max(0.62, 1 - a * 0.11);
      var op = a > 2.5 ? 0 : Math.max(0, 1 - a * 0.33);
      var c = cards[i];
      c.style.transform = 'translate(-50%,-50%) translateX(' + x + '%) translateZ(' + z + 'px) rotateY(' + ry + 'deg) scale(' + sc.toFixed(3) + ')';
      c.style.opacity = op.toFixed(3);
      c.style.zIndex = String(100 - Math.round(a * 10));
      c.style.pointerEvents = a > 2.5 ? 'none' : 'auto';
      c.classList.toggle('is-active', d === 0);
      c.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      if (dots[i]) {
        dots[i].classList.toggle('on', d === 0);
        dots[i].setAttribute('aria-selected', d === 0 ? 'true' : 'false');
      }
    }
  }

  function go(i, user) {
    active = ((i % n) + n) % n;
    layout();
    if (user) restart();
  }
  function step(dir) { go(active + dir, true); }

  function visible() {
    if (document.hidden || hovering) return false;
    var r = deck.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  function tick() { if (visible()) go(active + 1); }
  function restart() {
    if (reduce) return;
    if (timer) clearInterval(timer);
    timer = setInterval(tick, DWELL);
  }

  /* clicking a side card brings it forward; the front card follows the link */
  cards.forEach(function (c, i) {
    c.addEventListener('click', function () {
      if (delta(i) !== 0) go(i, true);
      else window.location.href = 'industries.html';
    });
  });

  deck.querySelectorAll('.ti-nav').forEach(function (b) {
    b.addEventListener('click', function () { step(parseInt(b.getAttribute('data-dir'), 10) || 1); });
  });

  deck.addEventListener('pointerenter', function () { hovering = true; });
  deck.addEventListener('pointerleave', function () { hovering = false; });
  deck.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  });

  /* drag / swipe */
  var dragX = null;
  stage.addEventListener('pointerdown', function (e) { dragX = e.clientX; });
  window.addEventListener('pointerup', function (e) {
    if (dragX === null) return;
    var dx = e.clientX - dragX; dragX = null;
    if (Math.abs(dx) > 55) step(dx < 0 ? 1 : -1);
  });

  /* ---- the Explore orb rides an eased cursor while it is over the deck ---- */
  var orb = document.getElementById('tiOrb');
  if (orb && window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
    var host = deck.parentElement || deck;         /* .to-ind, the positioning context */
    var tx = 0, ty = 0, ox = 0, oy = 0, seeded = false, orbRaf = null;
    function onOrbMove(e) {
      var r = host.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) { orb.classList.remove('on'); return; }
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!seeded) { ox = tx; oy = ty; seeded = true; }
      orb.classList.add('on');
      if (!orbRaf) orbRaf = requestAnimationFrame(orbTick);
    }
    function orbTick() {
      orbRaf = null;
      ox += (tx - ox) * 0.16;
      oy += (ty - oy) * 0.16;
      orb.style.left = ox.toFixed(1) + 'px';
      orb.style.top = oy.toFixed(1) + 'px';
      if (Math.abs(tx - ox) > 0.4 || Math.abs(ty - oy) > 0.4) orbRaf = requestAnimationFrame(orbTick);
    }
    window.addEventListener('pointermove', onOrbMove, { passive: true });
    host.addEventListener('pointerleave', function () { orb.classList.remove('on'); seeded = false; });
  }

  layout();
  restart();
})();
