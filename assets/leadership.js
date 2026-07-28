/* ============================================================
   Leadership — two portraits; clicking one opens a profile window.
   Detail copy lives in the HTML (inside .ld-source) rather than in
   this file, so it stays readable without JS and is one place to edit.
   Also swaps in a real headshot the moment the file exists.
   ============================================================ */
(function () {
  "use strict";

  /* ---- use the real headshot as soon as it is dropped in ---- */
  function applyShot(slot) {
    var src = slot.getAttribute('data-shot');
    if (!src) return;
    var probe = new Image();
    probe.onload = function () {
      slot.style.backgroundImage = 'url("' + src + '")';
      slot.classList.add('has-shot');
    };
    probe.src = src;   /* no onerror needed: the monogram is the default */
  }
  document.querySelectorAll('.ld-shot[data-shot]').forEach(applyShot);

  /* ---- the profile window ---- */
  var modal = document.getElementById('ldModal');
  if (!modal) return;
  var body  = document.getElementById('ldModalBody');
  var shot  = document.getElementById('ldModalShot');
  var mono  = document.getElementById('ldModalMono');
  var card  = modal.querySelector('.ld-modal-card');
  var lastFocus = null;

  function open(key) {
    var src = document.getElementById('detail-' + key);
    if (!src) return;

    body.innerHTML = src.innerHTML;
    card.style.setProperty('--c', src.getAttribute('data-accent') || '#0E9C93');
    mono.textContent = src.getAttribute('data-mono') || '';

    /* mirror the portrait into the dialog header */
    shot.classList.remove('has-shot');
    shot.style.backgroundImage = '';
    shot.setAttribute('data-shot', src.getAttribute('data-shot') || '');
    applyShot(shot);

    lastFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    /* Lenis owns the wheel globally, so hand it back while the dialog is up */
    if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
    var x = modal.querySelector('.ld-modal-x');
    if (x) x.focus();
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (window.__lenis && window.__lenis.start) window.__lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('.ld-card[data-person]').forEach(function (btn) {
    btn.addEventListener('click', function () { open(btn.getAttribute('data-person')); });
  });
  modal.querySelectorAll('[data-lclose]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
})();
