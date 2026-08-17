# STAIR Digital — website

The public site for STAIR Digital. Plain HTML, CSS and vanilla JavaScript: no
build step, no framework, no `npm install`. Every animation runs in the
visitor's browser, so the whole thing can be served by any static host.

## Pages

| File | Page |
|---|---|
| `index.html` | Home — drawn-staircase hero, client logos, the book, the founders, then a preview of each section |
| `company.html` | About — parallax hero, split-card disciplines |
| `capabilities.html` | Capabilities — the six service lines |
| `enterprise-brain.html` | Enterprise Brain — unified memory and the enterprise SLM capability |
| `industries.html` | Industries — six sectors |
| `research.html` | Research — The AI Auditor, Bharat Protect, The ExO Playbook |
| `engagements.html` | Engagements — client voices, attributed by sector |
| `leadership.html` | Leadership — founder profiles |
| `proposal.html` | Blueprint — visitor enters name and company, gets a downloadable PDF |
| `contact.html` | Contact |

`assets/` holds the CSS, the JavaScript effects, and the images.
`worker/` holds the Cloudflare Worker that powers the Blueprint page.

## Running it locally

```
python dev-server.py
```

Then open http://localhost:8760

Use this rather than `python -m http.server`. The browser caches HTML documents,
and the `?v=` stamps on the CSS and JS links cannot bust the document itself, so
edits to any `.html` file appear not to take effect. `dev-server.py` sends
no-cache headers on everything.

## Deploying

The site is served straight from `main` by GitHub Pages: **Settings → Pages →
Deploy from a branch → main → / (root)**. There is nothing to build, so a push
to `main` is a deploy.

`.nojekyll` stops GitHub's blog engine from processing the folder.

## The Blueprint page

`proposal.html` works on its own: it builds a blueprint in the browser from a
sector library. That is instant and free, but every company in a sector gets the
same words.

To make each blueprint genuinely researched, deploy the Cloudflare Worker in
`worker/` and paste its URL into `API_ENDPOINT` at the top of
`assets/proposal.js`. Full walkthrough in [`worker/DEPLOY.md`](worker/DEPLOY.md).

**No API key belongs in this repository.** Anything in a web page is readable by
anyone who opens developer tools. The Anthropic key lives only as a Cloudflare
Worker secret. If the Worker is unreachable the page quietly falls back to the
sector blueprint, so a visitor always gets a document.

## Things that will catch you out

**Case sensitivity.** Windows does not care about case in filenames; GitHub Pages
runs on Linux and does. `assets/Img/logo.png` will work on your laptop and 404 in
production. Match the case exactly.

**Cache stamps.** CSS and JS are linked with `?v=NN`. Bump that number across all
HTML files whenever you change a file in `assets/`, or returning visitors keep the
old version. It cannot bust the HTML documents themselves — only the assets.

**One shared animation loop.** Effects register through `FX.add` in
`assets/fx-core.js` rather than starting their own `requestAnimationFrame` loop,
and visibility comes from `FX.watch`. This exists because per-effect loops calling
`getBoundingClientRect` were forcing hundreds of layout flushes a second and
making the site feel slow. New effects should use the same seams.

**Performance probe.** Append `?perf=1` to any page, scroll it slowly, then press
`P` for a report of what each effect is costing.

**Relative URLs inside CSS custom properties.** A `url()` written into a custom
property in an HTML `style` attribute resolves against the *stylesheet that
consumes it*, not the page. `--img:url(assets/img/x.jpg)` used by a rule in
`assets/research.css` therefore requests `assets/assets/img/x.jpg` and 404s. Write
it as `url(img/x.jpg)`, relative to `assets/`. This silently broke five images on
the Research page for a while, because a missing background just looks like a
design choice.

**An inline SVG with no styles becomes a black blob.** Icons here are written
bare (`<svg viewBox="0 0 24 24"><path .../></svg>`) and get `fill:none;
stroke:currentColor` plus a size from CSS. Delete or rename that rule and the
SVG falls back to its own defaults: stretched to fill its container, with the
path filled solid black. A chevron rendered that way looks exactly like a giant
play button, which is how it was found. There is no global guard, because some
icons (the LinkedIn mark) genuinely rely on the default fill, so check the CSS
for an icon before deleting it.

**Prefer gradients to `filter: blur()` for glows.** `filter:blur(51px)` over a
1500x1000 element is one of the most expensive things a browser can paint, and
animating `filter` re-rasterises the whole subtree every frame. A
`radial-gradient` with soft stops is the same picture, painted once. Animate
only `transform` and `opacity`.

**WebGL contexts add up.** Each `data-` effect is its own context. The Research
page ran three.js with an EffectComposer post-processing chain for a hero
background, plus three more fields; it now runs none, and the same looks come
from drifting gradients. Reach for GL when the effect genuinely needs per-pixel
work, not for a slow wash of colour.

**Pinned sections cost scroll distance.** A `height:200vh` section with a pinned
child means two full screens of scrolling where the page does not advance. That
is what "sticky" means to a visitor. Keep the total across a page modest, and
prefer entrance animations over scrubbed ones for anything that is not the main
event.
