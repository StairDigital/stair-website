(function(){
  "use strict";
  var section = document.getElementById('capabilities');
  if(!section) return;
  var list = section.querySelector('.caps-list');
  var items = Array.prototype.slice.call(section.querySelectorAll('.cap-item'));
  if(!items.length) return;

  var fx = document.getElementById('capFx');
  var fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
  var current = null, closeTimer = null;

  /* Move the one shared ColorBends canvas into whichever panel is open and
     retint it to that capability's accent. One GL context for the whole page. */
  function mountFx(item){
    if(!fx) return;
    var slot = item.querySelector('.cap-fx-slot');
    if(!slot || fx.parentElement === slot) return;
    slot.appendChild(fx);
    var cols = (item.getAttribute('data-fx')||'').split(',')
      .map(function(s){return s.trim();}).filter(Boolean);
    if(window.ColorBends){
      if(cols.length) window.ColorBends.setColors(cols);
      window.ColorBends.pause(false);
      window.ColorBends.resize();
    }
  }

  function setOpen(item, open){
    item.classList.toggle('open', open);
    var btn = item.querySelector('.cap-summary');
    if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open) mountFx(item);
  }

  function open(item){
    if(closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
    if(current === item) return;
    if(current) setOpen(current, false);
    current = item;
    setOpen(item, true);
  }

  function closeAll(){
    if(current) setOpen(current, false);
    current = null;
    /* nothing open: park the field so it stops drawing */
    if(window.ColorBends) window.ColorBends.pause(true);
  }

  items.forEach(function(item){
    var btn = item.querySelector('.cap-summary');

    /* pointer drives it: hovering a row opens it, leaving the list closes it */
    if(fine){
      item.addEventListener('pointerenter', function(){ open(item); });
    }

    /* click and keyboard focus still work, for touch and for accessibility */
    if(btn){
      btn.addEventListener('click', function(){
        if(current === item) closeAll(); else open(item);
      });
      btn.addEventListener('focus', function(){ open(item); });
    }
  });

  if(fine && list){
    list.addEventListener('pointerleave', function(){
      /* small grace period so travelling between rows never flickers shut */
      if(closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(closeAll, 140);
    });
    list.addEventListener('pointerenter', function(){
      if(closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
    });
  }

  /* nothing is open on load: the section only reveals on intent */
  if(window.ColorBends) window.ColorBends.pause(true);
})();
