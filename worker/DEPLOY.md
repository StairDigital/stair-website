# Turning on real, researched blueprints

Right now the blueprint page builds its content in the visitor's browser from a
sector library. It is instant and free, but every company in a sector gets the
same words.

To make each blueprint genuinely researched — the model looks up what the
company is actually doing before writing — you need one small backend. This is
the whole setup, about ten minutes, and it is free for normal traffic.

## Why a backend at all

The key that unlocks the AI must never sit in the web page. Anything in a web
page can be read by anyone who opens developer tools, and a leaked key can be
used to spend your money. So the key lives on a server instead:

```
visitor's browser  ──>  your Worker (holds the key)  ──>  Claude
```

The browser never sees the key. That is the only reason this step exists.

## What it costs

Cloudflare Workers is free up to 100,000 requests a day — far beyond what QR
scans will produce. You pay only Anthropic for the model, roughly a few pence
per blueprint. Set a spend limit in the Anthropic console if you want a hard
ceiling.

---

## Step 1 — Get an Anthropic API key

1. Go to **console.anthropic.com** and sign in
2. **Settings → API Keys → Create Key**
3. Name it `stair-blueprint`
4. **Copy it now** — you are shown it once. It starts `sk-ant-`

Treat it like a password. Do not paste it into the website, into email, or into
this chat.

## Step 2 — Create the Worker

1. Go to **dash.cloudflare.com** (sign up free if needed)
2. **Compute (Workers) → Create → Start from Hello World! → Deploy**
3. Name it `stair-blueprint`
4. Click **Edit code**
5. Delete everything in the editor
6. Paste the entire contents of `proposal-worker.js`
7. **Deploy**

## Step 3 — Add your key as a secret

1. In the Worker, go to **Settings → Variables and Secrets**
2. **Add** → type **Secret**
3. Name: `ANTHROPIC_API_KEY` (exactly this)
4. Value: paste your `sk-ant-...` key
5. **Deploy**

A secret is encrypted and never visible again, including to you. That is what
keeps it out of the browser.

## Step 4 — Point the site at it

Copy your Worker URL from the dashboard. It looks like:

```
https://stair-blueprint.<your-subdomain>.workers.dev
```

Open `assets/proposal.js` and put it in the first setting:

```js
var API_ENDPOINT = "https://stair-blueprint.<your-subdomain>.workers.dev";
```

Save, hard-refresh the page, and generate a blueprint. You should now see a
**snapshot** line — one sentence of what the model verified about that company
today. That line is your proof the research actually happened.

## Step 5 — Lock it to your domain

Open `proposal-worker.js` and edit `ALLOWED_ORIGINS` near the top so it lists
your real domain. Without this, anyone who finds the Worker URL can use it and
spend your budget.

---

## If something goes wrong

The page never breaks: if the Worker is unreachable, slow, or misconfigured,
the browser quietly falls back to the built-in sector blueprint. A visitor
always gets a document. So a failure costs you research quality, never the
page.

| What you see | What it means |
|---|---|
| Blueprint appears but no snapshot line | The Worker was not reached — check `API_ENDPOINT` for a typo |
| `ANTHROPIC_API_KEY secret is not set` | Step 3 was missed, or the name is not exactly that |
| `Model returned 401` | The key is wrong or was revoked — make a new one |
| `Model returned 429` | You are out of credit or hitting a rate limit |
| `refused` in the log stream | The model declined this particular company for safety reasons; rare. The visitor still gets the sector blueprint |

To watch it live, open the Worker → **Logs** → **Begin log stream**, then
generate a blueprint.

## Two notes on the code

- The model is pinned to `claude-opus-5` and the search tool to
  `web_search_20260209`. If you ever copy settings from an older tutorial, these
  are the two lines most likely to be stale — older tool versions and models
  will error or silently behave differently.
- `EFFORT` near the top trades cost against depth: `low` is cheapest, `medium`
  is the default here, `high` produces a richer blueprint for more money.
