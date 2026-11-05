/* ============================================================
   Fluid Morph — seven overlapping colour fields drifting behind the
   testimonials.

   This used to animate the `d` attribute of seven full-section paths with
   SMIL. It needs no rAF loop, which is why it looked cheap, but morphing a
   path means the browser re-tessellates and repaints that geometry on every
   single frame — seven times over, across the whole band, forever. Measured
   on Engagements: pausing just these blobs took the page from 407ms to 171ms
   of main-thread work per four seconds, a 58% cut, making this the single
   most expensive thing on the site.

   Now each field is its own <svg> host carrying one static path, and the
   host drifts with a CSS transform. That matters because a transform on an
   <svg> element — a real box in the page's layout — is composited, while a
   transform on a <path> or <g> inside one is not: the same mistake was
   costing the Blueprint page 171ms of layout a frame.

   The look is kept: same paths, same colours, same stacking order, each
   layer still moving on its own slow cycle so the field breathes. What is
   gone is the per-frame geometry work.

   Targets [data-fluidmorph]; colours come from data-c1..c7 / data-bg.
   ============================================================ */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  // [from, to] path pairs, carried over verbatim from the reference
  var PATHS = [
    ["M -84.52,-81.13 C -94.62,-73.4 -88.88,-59.55 -90.33,-48.91 -89.29,27.31 -89.61,103.5 -88.33,179.8 -85.99,416.1 -81.32,888.9 -81.32,888.9 -81.32,888.9 974.5,888.7 1587,891.9 1518,719.9 1487,644 1429,533 1388,437.7 1447,259.7 1400,187 1362,132 1270,90.53 1207,39.93 1161,2.932 1071,-74.45 1071,-74.45 1071,-74.45 914.5,-77.77 848.2,-80.17 537.6,-80.84 227,-81.38 -83.6,-81.6 -83.91,-81.44 -84.21,-81.29 -84.52,-81.13 Z",
     "M -84.52,-81.13 C -94.62,-73.4 -88.88,-59.55 -90.33,-48.91 -89.29,27.31 -89.61,103.5 -88.33,179.8 -85.99,416.1 -81.32,888.9 -81.32,888.9 -81.32,888.9 974.5,888.7 1587,891.9 1576,704.7 1517,625.7 1459,514.7 1418,419.4 1430,288.5 1382,187 1349,116.3 1296,54.47 1240,0.3429 1205,-33.51 1120,-83.59 1120,-83.59 1120,-83.59 914.5,-77.77 848.2,-80.17 537.6,-80.84 227,-81.38 -83.6,-81.6 -83.91,-81.44 -84.21,-81.29 -84.52,-81.13 Z"],
    ["M 665.2,-83.08 C 413.7,-81.89 162.2,-82.43 -89.29,-81.61 -90.35,164.3 -85.06,410.2 -84.09,656.1 -83.37,733.7 -82.64,811.3 -81.92,888.9 442.4,889.8 966.7,890.7 1491,891.6 1253,747.5 1417,429.4 1286,245.4 1227,163.2 1107,142.1 1043,64.54 1009,24.41 973,-76.01 973,-76.01 973,-76.01 706.6,-83.67 665.2,-83.08 Z",
     "M 665.2,-83.08 C 413.7,-81.89 162.2,-82.43 -89.29,-81.61 -90.35,164.3 -85.06,410.2 -84.09,656.1 -83.37,733.7 -82.64,811.3 -81.92,888.9 442.4,889.8 966.7,890.7 1491,891.6 1253,747.5 1349,460.4 1243,260.6 1199,176.6 1145,96.92 1083,24.95 1050,-12.63 973,-76.01 973,-76.01 973,-76.01 706.6,-83.67 665.2,-83.08 Z"],
    ["M -85.01,-74.02 C -92.39,-66.64 -85.37,-55.79 -87.81,-46.91 -86.65,265.1 -84.66,577.2 -83.18,889.2 317.2,888.3 717.5,885.8 1118,890.4 1152,890.6 1187,890.9 1221,890 1219,768.3 1224,643.6 1187,526 1153,417 1091,319.3 1029,224.1 998.8,178.5 968.8,132.6 936.6,88.23 891.7,27.39 772.2,-78.96 772.2,-78.96 772.2,-78.96 222.1,-81.07 -85.01,-74.02 Z",
     "M -85.01,-74.02 C -92.39,-66.64 -85.37,-55.79 -87.81,-46.91 -86.65,265.1 -84.66,577.2 -83.18,889.2 317.2,888.3 717.5,885.8 1118,890.4 1152,890.6 1187,890.9 1221,890 1219,768.3 1175,659.3 1150,544.3 1128,438.4 1143,312.6 1081,227.1 1004,121.1 925.8,114.8 851.3,54.73 762,-17.34 772.2,-78.96 772.2,-78.96 772.2,-78.96 222.1,-81.07 -85.01,-74.02 Z"],
    ["M -92.42,-79.11 C -89.97,243.8 -87.52,566.7 -85.07,889.6 201.8,889.9 488.7,889.9 775.5,895.6 880.4,896.9 985.2,894 1090,892.5 1064,773.3 1037,651.6 976.1,544.8 946.7,495.8 914.6,448.3 882,401.3 820.9,314.4 742.3,252 666.4,177.4 583.2,98.01 496.5,12.18 386.7,-23.38 328.4,-45.64 232.6,-81.38 232.6,-81.38 232.6,-81.38 9.82,-84.94 -92.42,-79.11 Z",
     "M -92.42,-79.11 C -89.97,243.8 -87.52,566.7 -85.07,889.6 201.8,889.9 488.7,889.9 775.5,895.6 880.4,896.9 1063,889.5 1063,889.5 1063,889.5 1081,768.2 997.4,608.7 958.5,534.8 969.9,436.8 918.5,370.8 848.4,280.8 717,260.3 629.9,186.5 552.6,121.2 491.5,38.73 426.3,-38.61 412.9,-54.44 387.9,-87.47 387.9,-87.47 387.9,-87.47 9.82,-84.94 -92.42,-79.11 Z"],
    ["M -88.6,95.54 C -90.38,166.1 -88.23,236.7 -88.68,307.4 L -86.19,890 C 229.7,890.2 939.8,892.4 939.8,892.4 855.2,767 831,639.4 721.4,519.4 634.7,424.5 526.4,360.9 428.8,281.8 332.7,204 251.6,102.3 140.1,48.9 70.75,15.73 -24.82,24.2 -85.28,0.03 Z",
     "M -88.6,95.54 C -90.38,166.1 -88.23,236.7 -88.68,307.4 L -86.19,890 C 229.7,890.2 939.8,892.4 939.8,892.4 906.9,734.7 779.3,676 721.4,519.4 676.8,398.8 566.5,307.1 458.9,236.6 355.2,168.7 220.3,165.7 107.8,113.5 40.05,82.12 -24.82,24.2 -85.28,0.03 Z"],
    ["M -95.69,252.3 -87.65,890.4 698.1,892 C 698.1,892 599.1,687.7 518.9,610.6 348,446.2 131.4,466.5 -95.69,252.3 Z",
     "M -95.69,252.3 -87.65,890.4 698.1,892 C 698.1,892 569.8,587.1 448.9,482.7 299.7,353.9 131.4,466.5 -95.69,252.3 Z"],
    ["M -85.59,444.4 -85.59,890.6 489,895.6 C 489,895.6 436.8,745.3 382.5,690.8 258.1,565.8 57.98,629.2 -85.59,444.4 Z",
     "M -85.59,444.4 -85.59,890.6 546.9,895.6 C 546.9,895.6 517.4,695.4 339.9,593.4 187.7,505.9 57.98,629.2 -85.59,444.4 Z"]
  ];

  // deep teal boardroom palette (readable behind the glass reader + white text)
  var DEFAULTS = ["#0E9C93", "#0B857D", "#12A79D", "#0c6b64", "#F0854B", "#0a534d", "#083f3a"];

  function init(host) {
    var bg = host.getAttribute("data-bg") || "#0a1614";
    // colours: accept either a comma list in data-colors, or data-c1..c7
    var colors = [];
    var list = host.getAttribute("data-colors");
    if (list) {
      list.split(",").forEach(function (c) { if (c.trim()) colors.push(c.trim()); });
    }
    for (var i = 1; i <= 7; i++) colors.push(host.getAttribute("data-c" + i) || DEFAULTS[i - 1]);
    var base = parseFloat(host.getAttribute("data-dur") || host.getAttribute("data-duration")) || 9;

    host.style.backgroundColor = bg;
    host.style.overflow = "hidden";

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    /* One <svg> per layer. Overlapping them reproduces exactly what the
       single stacked <svg> drew, but gives each field a box of its own that
       the compositor can move without the main thread being involved.
       Slightly oversized and offset so a drifting layer can never pull its
       own edge into view. */
    /* All seven layers by default. Cutting to four measured 30% cheaper, but
       the last three carry the amber accent and the two darkest wedges that
       ground the corners - without them the field reads brighter and flatter
       than the design it was signed off as. The knob is here (data-layers)
       if that trade is ever worth taking; the big win on this page came from
       the testimonial ring, not from here.

       will-change is deliberately absent: it measured as no help at all (1%),
       and promoting seven band-sized layers costs memory for nothing. */
    var layers = parseInt(host.getAttribute("data-layers"), 10) || PATHS.length;

    PATHS.slice(0, Math.max(1, Math.min(layers, PATHS.length))).forEach(function (pair, i) {
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 1440 800");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText =
        "position:absolute;left:-6%;top:-6%;width:112%;height:112%;display:block";

      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", pair[0]);
      p.setAttribute("fill", colors[i % colors.length]);
      svg.appendChild(p);

      if (!reduce) {
        /* Durations stay out of step with one another so the layers never
           line up and the field keeps looking organic rather than pulsing. */
        var dur = (base * 2.4 + i * 3.7).toFixed(2) + "s";
        svg.style.animation = "fmDrift" + (i % 3) + " " + dur +
          " ease-in-out infinite alternate";
        svg.style.animationDelay = (-i * 2.3).toFixed(2) + "s";
      }
      host.appendChild(svg);
    });
  }

  /* Injected once rather than shipped in a stylesheet, so the effect stays
     self-contained: delete this file and nothing is left behind. */
  function styles() {
    if (document.getElementById("fm-keys")) return;
    var s = document.createElement("style");
    s.id = "fm-keys";
    s.textContent =
      "@keyframes fmDrift0{from{transform:translate3d(-1.5%,0.8%,0) scale(1.02)}" +
      "to{transform:translate3d(1.8%,-1.2%,0) scale(1.05)}}" +
      "@keyframes fmDrift1{from{transform:translate3d(1.6%,-1%,0) scale(1.04)}" +
      "to{transform:translate3d(-1.4%,1.3%,0) scale(1.01)}}" +
      "@keyframes fmDrift2{from{transform:translate3d(-1%,-1.4%,0) scale(1.03)}" +
      "to{transform:translate3d(1.2%,1.1%,0) scale(1.06)}}";
    document.head.appendChild(s);
  }

  styles();
  document.querySelectorAll("[data-fluidmorph]").forEach(init);
})();
