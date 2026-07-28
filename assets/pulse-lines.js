/* ============================================================
   Pulse Lines — vanilla port of the Originkit WaveBg component.
   Same construction: a run of evenly spaced lines, each drawn twice
   (a static base stroke plus a dashed stroke that pulses), with the
   dash offset animated on a per-line delay so the pulse ripples out
   from the centre. Palette interpolation and the delay/numLines
   maths are carried over unchanged.

   React's useId becomes a counter, and useState dimensions become a
   ResizeObserver, since there is no render cycle to hook into.
   Targets [data-pulselines].
   ============================================================ */
(function () {
  "use strict";
  var seq = 0;
  var NS = 'http://www.w3.org/2000/svg';

  function parseColor(input) {
    if (!input) return { r: 255, g: 255, b: 255 };
    var s = String(input).trim();
    if (s.charAt(0) === '#') {
      var h = s.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h.slice(0, 6), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    var m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var p = m[1].split(',').map(parseFloat);
      return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0 };
    }
    return { r: 255, g: 255, b: 255 };
  }

  function paletteAt(colors, p) {
    if (!colors.length) return 'rgb(255,255,255)';
    if (colors.length === 1) return colors[0];
    var scaled = Math.max(0, Math.min(1, p)) * (colors.length - 1);
    var i = Math.floor(scaled), f = scaled - i;
    var a = parseColor(colors[i]);
    var b = parseColor(colors[Math.min(i + 1, colors.length - 1)]);
    return 'rgb(' + Math.round(a.r + (b.r - a.r) * f) + ',' +
                    Math.round(a.g + (b.g - a.g) * f) + ',' +
                    Math.round(a.b + (b.b - a.b) * f) + ')';
  }

  function num(el, attr, dflt) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? dflt : v;
  }

  function init(host) {
    var id = 'wave-bg-' + (++seq);

    var shape      = host.getAttribute('data-shape') || 'line';
    var cornerR    = num(host, 'data-cornerradius', 0);
    var horizontal = (host.getAttribute('data-type') || 'vertical') === 'horizontal';
    var speed      = num(host, 'data-speed', 99);
    var lineWidth  = num(host, 'data-linewidth', 2);
    var gap        = num(host, 'data-gap', 30);
    var scale      = num(host, 'data-scale', 2.5);
    var bg         = host.getAttribute('data-bg') || '#000000';
    var lineColor  = host.getAttribute('data-linecolor') || '#222222';

    var maxRadius = lineWidth / 2;
    var r = shape === 'square' ? Math.max(0, Math.min(cornerR, maxRadius)) : 0;
    var strokeLinecap = (shape === 'circle' || (shape === 'square' && r > 0)) ? 'round' : 'butt';
    var dashWidth = shape === 'line' ? 10 * scale
                  : shape === 'circle' ? 0.01
                  : Math.max(0.01, lineWidth - 2 * r);

    var count = Math.max(1, Math.min(5, num(host, 'data-palette', 1)));
    var palette = [];
    for (var i = 1; i <= count; i++) {
      var c = host.getAttribute('data-color' + i);
      if (c && c.trim()) palette.push(c.trim());
    }
    if (!palette.length) palette = ['#FFFFFF'];

    host.style.backgroundColor = bg;
    host.style.overflow = 'hidden';
    /* only establish a containing block if the sheet has not already done so:
       writing position inline here would override an absolute host */
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    var style = document.createElement('style');
    style.textContent =
      '.' + id + '-l{' +
      '--dash-width:' + dashWidth + ';' +
      '--gap-width:' + (100 * scale) + ';' +
      'stroke-linecap:' + strokeLinecap + ';' +
      'stroke-dasharray:var(--dash-width) var(--gap-width);' +
      'stroke-dashoffset:var(--dash-width);' +
      'will-change:stroke,stroke-dashoffset;' +
      'animation:' + id + '-pulse 2s cubic-bezier(0.65,0,0.35,1) infinite alternate-reverse;' +
      'animation-delay:var(--delay);}' +
      '@keyframes ' + id + '-pulse{' +
      '0%{stroke-dashoffset:var(--dash-width);}' +
      '50%{stroke:var(--pulse);}' +
      '100%{stroke-dashoffset:calc(var(--gap-width) * -8px + 40px);}}';
    host.appendChild(style);

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
    host.appendChild(svg);

    var lastW = -1, lastH = -1;
    function build(width, height) {
      if (width <= 0 || height <= 0) return;      /* do not cache a zero size */
      if (width === lastW && height === lastH) return;
      lastW = width; lastH = height;

      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var span = horizontal ? height : width;
      var raw = Math.ceil(span / (gap + lineWidth));
      var numLines = Math.max(1, raw) + (raw % 2 === 1 ? 1 : 0);

      var frag = document.createDocumentFragment();
      for (var i = 0; i < numLines; i++) {
        var pos = numLines > 1 ? (i / (numLines - 1)) * span : 0;
        var delayFactor = 1 - Math.abs((i - numLines / 2) / numLines);
        var t = numLines > 1 ? i / (numLines - 1) : 0;
        var dash = paletteAt(palette, t);
        var pulse = paletteAt(palette, (t + 0.5) % 1);

        var g = document.createElementNS(NS, 'g');
        g.style.setProperty('--delay', ((delayFactor * speed) / 50) + 's');
        g.style.setProperty('--pulse', pulse);

        function line(stroke, cls) {
          var l = document.createElementNS(NS, 'line');
          if (horizontal) {
            l.setAttribute('x1', 0); l.setAttribute('y1', pos);
            l.setAttribute('x2', width); l.setAttribute('y2', pos);
          } else {
            l.setAttribute('x1', pos); l.setAttribute('y1', 0);
            l.setAttribute('x2', pos); l.setAttribute('y2', height);
          }
          l.setAttribute('stroke', stroke);
          l.setAttribute('stroke-width', lineWidth);
          if (cls) l.setAttribute('class', cls);
          return l;
        }
        g.appendChild(line(lineColor, null));
        g.appendChild(line(dash, id + '-l'));
        frag.appendChild(g);
      }
      svg.appendChild(frag);
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(function (entries) {
        var cr = entries[0].contentRect;
        build(Math.round(cr.width), Math.round(cr.height));
      }).observe(host);
    } else {
      window.addEventListener('resize', function () {
        build(host.offsetWidth, host.offsetHeight);
      });
    }
    build(host.offsetWidth, host.offsetHeight);
  }

  document.querySelectorAll('[data-pulselines]').forEach(init);
})();
