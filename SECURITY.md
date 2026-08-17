# Security

What is already in place, what you have to do yourself, and one thing that
cannot be done at all.

---

## 1. What the code already does

**Subresource Integrity on every third-party script.** The site loads GSAP,
ScrollTrigger and Lenis from jsDelivr. Each `<script>` and `<link>` now carries a
`sha384` `integrity` hash. If jsDelivr were ever compromised and served altered
code, the browser compares the hash, sees the mismatch, and refuses to execute
it. Without this, a CDN breach would run attacker code on your visitors with
full access to the page.

If you upgrade a library version you **must** regenerate its hash, or the site
will stop loading it:

```bash
curl -sSL "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" | openssl dgst -sha384 -binary | openssl base64 -A
```

**A Content Security Policy** on all ten pages. Scripts may only load from this
site and jsDelivr, fonts only from Google Fonts, images only from this site, and
`connect-src 'self'` means no script on the page can send data to an outside
server. `object-src 'none'` and `frame-src 'none'` block plugin and iframe
injection. Two limits worth knowing: it allows `'unsafe-inline'` because the
site uses inline styles and a few inline scripts, and `frame-ancestors` is
ignored when CSP is delivered by `<meta>` — GitHub Pages will not let you set
real HTTP headers, so clickjacking protection needs a proxy (see §4).

**No secrets in the repository.** I scanned every tracked file and all 13
commits of history: no API keys, tokens or private keys have ever been
committed. `.gitignore` blocks `.env`, `*.key` and `secrets.*`.

**No API key will ever be in the site.** When you deploy the Blueprint Worker,
the Anthropic key lives only as an encrypted Cloudflare secret. The browser
calls your Worker; your Worker calls Anthropic. The key never reaches the page.
Anything in a web page is readable by anyone who opens developer tools, so this
is the only safe arrangement.

---

## 2. Locking down GitHub — you must do these

I cannot change repository settings; they need your login.

**Check who has access.**
Settings → Collaborators and teams. Remove anyone who should not be able to
push. Right now `inland-taipen` has contributed to this project's history — if
they should no longer have write access, remove them here.

**Protect the branch.**
Settings → Rules → Rulesets → New branch ruleset. Target `main`, then enable:

- Restrict deletions
- Block force pushes
- Require a pull request before merging

That stops anyone — including you on a bad day — from rewriting or deleting
`main`. Every change then arrives as a reviewable pull request.

**Turn on two-factor authentication.**
github.com/settings/security. This is the single highest-value item on this
page. Branch protection is worthless if someone has your password.

**Review deploy keys and tokens.**
Settings → Deploy keys, and github.com/settings/tokens. Delete anything you do
not recognise or no longer use.

---

## 3. "Stop people copying the code" — this is not possible

I want to be straight with you rather than sell you something that does not
work.

A website's HTML, CSS and JavaScript are **downloaded to the visitor's browser
in order to render**. That is how the web functions. Anyone can read it with
View Source, developer tools, `curl`, "Save Page As", or an archive service.
There is no setting, script or service that prevents this. Any product claiming
otherwise is selling a speed bump.

The measures people reach for do not hold:

- **Disabling right-click or F12** is bypassed by Ctrl+U, by the browser menu,
  or by `curl`. It achieves nothing except irritating real visitors.
- **Minifying or obfuscating** slows a casual copier by minutes. It does not
  stop anyone who wants the code, and it makes your own debugging harder.
- On top of all this, **the repository is public**, because GitHub Pages on the
  free plan requires it. The source is browsable on github.com by design.

What actually protects you is **legal, not technical**:

- `LICENSE` now asserts your copyright explicitly. Copying the site becomes a
  documented infringement rather than an ambiguity.
- The git history timestamps your authorship, which is useful evidence.
- If you want the source genuinely non-public, GitHub Pages from a **private**
  repo requires a paid plan (Pro or Team). That hides the repo. It still does
  not hide the served code from visitors — nothing can.

The thing worth protecting is not the markup. It is the domain, the GitHub
account, and the API key. Those are covered in §2 and §4.

---

## 4. When the Blueprint Worker goes live

The Worker is written but not deployed. Before it is:

- Keep `ALLOWED_ORIGINS` in `worker/proposal-worker.js` restricted to your own
  domains. Without that it is an open proxy: anyone could point their own site
  at your Worker and spend your Anthropic credit.
- Add a rate limit in Cloudflare (Security → WAF → Rate limiting), something
  like 10 requests per minute per IP. Without one, a single script can run your
  bill up overnight.
- Set a spend limit on the Anthropic key at console.anthropic.com.
- Add your Worker's origin to `connect-src` in the CSP on `proposal.html`, or
  the browser will block the call.

**If you ever put the site behind Cloudflare as a proxy**, you also gain real
HTTP headers, which GitHub Pages cannot give you: `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY` for the
clickjacking protection the meta CSP cannot provide.

---

## 5. Reporting

Security issues: **saraff@stair.digital**.
