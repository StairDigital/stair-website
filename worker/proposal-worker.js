/**
 * STAIR Digital — AI blueprint backend (Cloudflare Worker)
 * ============================================================
 * WHY THIS EXISTS
 * The blueprint page runs entirely in the visitor's browser, so it cannot hold
 * an API key — anything in the browser is readable by anyone. This Worker sits
 * between the two: the browser calls the Worker, the Worker calls Claude with
 * the key, and the key never leaves Cloudflare.
 *
 *   browser  ──POST {name, company}──>  this Worker  ──key──>  Claude
 *            <──────  JSON blueprint  ──────
 *
 * It is one file with no build step and no npm install: paste it into the
 * Cloudflare dashboard, add the key as a secret, done. See DEPLOY.md.
 *
 * The model researches the company with web search first, so the blueprint is
 * grounded in what that company is actually doing now rather than in a sector
 * template.
 */

/* Model and tool versions are deliberately pinned and commented — these are the
   two things most likely to be wrong if this file is ever copied from an older
   example. */
const MODEL = 'claude-opus-5';
const WEB_SEARCH_TOOL = 'web_search_20260209';   // dynamic-filtering version
const MAX_TOKENS = 16000;                        // room for research + thinking + JSON
const EFFORT = 'medium';                         // 'high' for richer output, 'low' to cut cost

/* Only these origins may call the Worker. Add your live domain before going
   public; leaving this open lets anyone spend your API budget. */
const ALLOWED_ORIGINS = [
  'https://www.stair.digital',
  'https://stair.digital',
  'http://localhost:8760'
];

const SYSTEM = `You are the blueprint engine for STAIR Digital, an institutional advisory firm that builds AI-enabled, governance-led enterprises for India's largest listed and promoter-led companies. Co-founded by Shubham Saraff with Chairman Shailesh Haribhakti. STAIR works through its Autonomous, Agentic and Augmented Intelligence (AAAi) lens and pairs board-level governance with frontier AI.

First use the web_search tool to establish what the named company actually does right now: its sector, scale, recent public developments, stated priorities and any current pressures. Ground every company-specific claim in that verified public information.

Never invent facts, figures, leadership names or initiatives. If you cannot verify something, write generally rather than fabricating a specific. Where you cite a recent development, it must be one you actually found.

Then write a board-ready two-page blueprint, specific to that company and its sector, covering five areas made concrete to them: AI opportunities, operational efficiency, energy optimisation, predictive analytics, automation.

Style: British spelling. Hyphens only, never em or en dashes. Specific and confident, never hype. Concise enough that the whole JSON fits comfortably.

Return ONLY a valid JSON object as your final output. No preamble, no markdown fences, exactly this shape:
{"company":"","sector":"","snapshot":"","title":"","exec":"","whyNow":"",
"focus":[{"theme":"AI opportunities","title":"","detail":""},{"theme":"Operational efficiency","title":"","detail":""},{"theme":"Energy optimisation","title":"","detail":""},{"theme":"Predictive analytics","title":"","detail":""},{"theme":"Automation","title":"","detail":""}],
"approach":[{"phase":"","detail":""},{"phase":"","detail":""},{"phase":"","detail":""}],
"governance":"","impact":["","",""],"cta":""}

"snapshot" is one sentence on what you verified about the company today - this is what proves the blueprint is researched rather than generic.`;

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) }
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, origin);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY secret is not set' }, 500, origin);

    let name, company;
    try {
      const body = await request.json();
      name = String(body.name || '').trim().slice(0, 120);
      company = String(body.company || '').trim().slice(0, 160);
    } catch {
      return json({ error: 'Body must be JSON' }, 400, origin);
    }
    if (!name || !company) return json({ error: 'name and company are required' }, 400, origin);

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          output_config: { effort: EFFORT },
          tools: [{ type: WEB_SEARCH_TOOL, name: 'web_search', max_uses: 5 }],
          messages: [{
            role: 'user',
            content: `Prospect name: ${name}\nCompany: ${company}`
          }]
        })
      });
    } catch (e) {
      return json({ error: 'Could not reach the model: ' + e.message }, 502, origin);
    }

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Model returned ${res.status}`, detail: detail.slice(0, 400) }, 502, origin);
    }

    const data = await res.json();

    /* Claude Opus 5 runs safety classifiers and can decline a request. That
       comes back as a normal 200 with stop_reason "refusal" and empty content,
       so reading content[0] blindly would throw here. */
    if (data.stop_reason === 'refusal') {
      return json({ error: 'refused', category: data.stop_details?.category ?? null }, 200, origin);
    }

    /* A response can contain thinking blocks and web-search results alongside
       the text, so concatenate only the text blocks. */
    let text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
      .replace(/```json|```/g, '')
      .trim();

    const open = text.indexOf('{');
    const close = text.lastIndexOf('}');
    if (open >= 0 && close > open) text = text.slice(open, close + 1);

    let blueprint;
    try {
      blueprint = JSON.parse(text);
    } catch {
      return json({ error: 'Model did not return parseable JSON' }, 502, origin);
    }
    if (!blueprint || !Array.isArray(blueprint.focus)) {
      return json({ error: 'Model returned an unexpected shape' }, 502, origin);
    }

    blueprint.company = blueprint.company || company;
    blueprint.name = name;
    return json(blueprint, 200, origin);
  }
};
