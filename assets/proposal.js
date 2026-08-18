/* ============================================================
   AI PROPOSAL PAGE
   Scan the card QR -> land here -> name + company -> a board-ready
   proposal, downloadable as a PDF on the STAIR template.

   TWO THINGS THAT ARE DELIBERATE
   1. There is NO API key in this file, and there never should be. Anything in
      the browser is readable by anyone who opens DevTools, so a key here would
      be public and spendable by strangers. The generator below runs locally:
      instant, offline, and always on brand. If you later want live, web
      grounded AI, stand up a small server that holds the key and set
      API_ENDPOINT to it — the browser calls your server, your server calls the
      model. The key never leaves your machine.
   2. "Book a meeting" opens the site's own contact chooser (email / call)
      rather than a third party scheduler, which is what the old build pointed
      at and which was not live.
   ============================================================ */
(function () {
  "use strict";

  /* Paste your Cloudflare Worker URL here to switch on real, researched
     blueprints (see worker/DEPLOY.md). Blank = the built-in sector generator,
     which is instant and free but identical for every company in a sector.
     Either way the page works: if the Worker fails, we fall back locally. */
  var API_ENDPOINT = "";

  /* ---------------------------------------------------------------
     WHERE THE ENQUIRY EMAIL GOES

     Every finished blueprint is emailed to STAIR with the enquirer's
     name, company, work email and phone, and the full text of the
     document they were shown.

     This posts to Web3Forms, which turns a JSON body into an email. No
     server of ours, no library on the page, and one host added to the
     Content-Security-Policy.

     TO TURN IT ON, one step:
       1. Go to web3forms.com, enter devraj@stair.digital, and they email
          back an access key (a UUID).
       2. Paste it between the quotes below.

     The key is public by design - it only permits sending TO the address
     it was created for, so it cannot be used to mail anyone else. The
     inbox is set by whoever created the key, not by this file.

     While the key is blank nothing is sent, and the visitor still gets
     their blueprint and the "Send this to STAIR" mail button.
     --------------------------------------------------------------- */
  var LEAD_ACCESS_KEY = "c72aadf5-46c7-4582-96d6-a6a5fc16403e";
  var LEAD_ENDPOINT   = "https://api.web3forms.com/submit";
  var LEAD_INBOX      = "devraj@stair.digital";

  /* ---------- 1. decrypt-text (vanilla port of the React component) ----------
     The real string is in the DOM first and stays in an sr-only span, so the
     text is readable by search engines and screen readers and survives JS
     failing. The scrambling layer is aria-hidden and purely decorative. */
  var POOL = "#%&@$?!*+=/{}[]<>~^";

  function decrypt(el, opts) {
    opts = opts || {};
    var text = el.getAttribute('data-decrypt') || el.textContent;
    var speed = +(opts.speed || 45), stagger = +(opts.stagger || 42);
    var startDelay = +(opts.delay || 220), jitter = 110;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

    /* build: sr-only truth + aria-hidden glyph layer */
    el.textContent = '';
    var sr = document.createElement('span');
    sr.className = 'sr-only'; sr.textContent = text;
    var layer = document.createElement('span');
    layer.setAttribute('aria-hidden', 'true');

    var cells = [];
    text.split(' ').forEach(function (word, wi, arr) {
      var w = document.createElement('span');
      w.className = 'dt-w';
      Array.from(word).forEach(function (ch) {
        var s = document.createElement('span');
        s.textContent = ch; s.setAttribute('data-ch', ch);
        w.appendChild(s); cells.push(s);
      });
      layer.appendChild(w);
      if (wi < arr.length - 1) layer.appendChild(document.createTextNode(' '));
    });
    el.appendChild(sr); el.appendChild(layer);

    var lockAt = [], nextAt = [], locked = [], remaining = cells.length, t0 = 0, raf = null;
    function arm() {
      cells.forEach(function (s, i) {
        lockAt[i] = startDelay + i * stagger + (Math.random() * 2 - 1) * jitter;
        nextAt[i] = 0; locked[i] = 0;
        s.setAttribute('data-s', 'scramble');
        s.textContent = POOL.charAt(Math.random() * POOL.length | 0);
      });
      remaining = cells.length; t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function frame() {
      var now = performance.now() - t0;
      for (var i = 0; i < cells.length; i++) {
        if (locked[i]) continue;
        if (now >= lockAt[i]) {
          cells[i].textContent = cells[i].getAttribute('data-ch');
          cells[i].setAttribute('data-s', 'lock');
          locked[i] = 1; remaining--;
        } else if (now >= nextAt[i]) {
          cells[i].textContent = POOL.charAt(Math.random() * POOL.length | 0);
          nextAt[i] = now + speed + Math.random() * 35;
        }
      }
      raf = remaining > 0 ? requestAnimationFrame(frame) : null;
    }
    /* only run once it is actually on screen */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { io.disconnect(); arm(); }
      }, { threshold: .25 });
      io.observe(el);
    } else { arm(); }
  }

  /* ---------- 2. sector intelligence ---------- */
  var SECTOR_MAP = [
    [/(insur|life insurance|general insurance|policybazaar|acko|niva)/, 'insurance'],
    [/(bank|hdfc|icici|axis|kotak|\bsbi\b|indusind|federal|bandhan|finserv|finance|capital|lending|fintech|payments|securities)/, 'banking'],
    [/(motor|auto|automobile|maruti|mahindra|bajaj|hero|tvs|ashok leyland|eicher|vehicle|mobility)/, 'automotive'],
    [/(pharma|pharmaceutic|labs|life ?science|healthcare|hospital|diagnost|cipla|sun pharma|lupin|biocon|apollo|fortis|medic)/, 'pharma'],
    [/(energy|power|petroleum|\boil\b|\bgas\b|solar|renewable|ntpc|ongc|bpcl|hpcl|adani|tata power|utilit)/, 'energy'],
    [/(infosys|\btcs\b|wipro|\bhcl\b|tech ?mahindra|ltimindtree|software|infotech|technolog|consultanc|persistent|mphasis|coforge)/, 'it_services'],
    [/(paints|fmcg|foods|beverage|dabur|marico|nestle|unilever|\bhul\b|\bitc\b|britannia|godrej|emami|consumer)/, 'fmcg'],
    [/(retail|\bmart\b|stores|bazaar|fashion|trent|dmart|flipkart|myntra|nykaa|meesho|ecommerce|e-commerce)/, 'retail'],
    [/(telecom|airtel|\bjio\b|vodafone|bsnl|communications|cellular)/, 'telecom'],
    [/(steel|cement|infra|construction|engineering|l&t|larsen|jsw|ultratech|ambuja|industries|manufactur|industrial|defence)/, 'industrials'],
    [/(realty|estate|housing|developers|properties|\bdlf\b|oberoi|prestige|brigade|lodha)/, 'realestate'],
    [/(logistic|supply chain|cargo|freight|courier|delhivery|blue dart|transport|shipping)/, 'logistics']
  ];
  function detectSector(c) {
    var s = (c || '').toLowerCase();
    for (var i = 0; i < SECTOR_MAP.length; i++) if (SECTOR_MAP[i][0].test(s)) return SECTOR_MAP[i][1];
    return 'default';
  }

  var THEMES = ['AI opportunities', 'Operational efficiency', 'Energy optimisation', 'Predictive analytics', 'Automation'];

  var S = {
    banking: { label: 'Banking and financial services',
      exec: '{C} operates where speed, trust and data depth decide who keeps the customer. STAIR would help {C} turn its data and channels into an AI advantage, delivered under board grade governance and full regulatory control.',
      why: 'As digital first lenders reset customer expectations, the institutions that embed AI now will own the cost and experience benchmark.',
      f: [['Conversational and advisory AI', 'Deploy assistants across {C}’s app, branch and call centre journeys to resolve queries and surface the next best product.'],
          ['Straight through processing', 'Automate onboarding, KYC, underwriting and servicing so {C} cuts turnaround time and manual cost.'],
          ['Energy aware operations', 'Optimise data centre and branch energy across {C}’s footprint to lower cost and carbon.'],
          ['Risk and fraud foresight', 'Use predictive models to flag fraud, default and churn earlier across {C}’s portfolio.'],
          ['Governed automation', 'Automate reconciliation, compliance reporting and collections at {C} with auditable agents.']],
      impact: ['Lower cost to serve', 'Sharper risk decisions', 'A defensible data advantage'] },
    insurance: { label: 'Insurance',
      exec: '{C} sits where underwriting precision, claims speed and customer trust drive growth. STAIR would help {C} turn its data into sharper pricing and faster service, under board grade governance.',
      why: 'As digital insurers and embedded cover reset expectations, the carriers that adopt AI now will set the price and service benchmark.',
      f: [['Conversational and advisory AI', 'Guide {C}’s customers through cover selection, renewals and claims with assistants on every channel.'],
          ['Straight through claims', 'Automate {C}’s claims intake, triage and settlement to cut cycle time and leakage.'],
          ['Energy aware operations', 'Optimise data centre and office energy across {C} to lower cost and carbon.'],
          ['Risk and pricing foresight', 'Use predictive models to refine {C}’s underwriting, fraud detection and reserving.'],
          ['Governed automation', 'Automate policy servicing, compliance and reporting at {C} with auditable agents.']],
      impact: ['Lower claims leakage', 'Sharper underwriting', 'Faster customer service'] },
    automotive: { label: 'Automotive and mobility',
      exec: '{C} operates where product, plant and customer experience all compound. STAIR would help {C} apply AI from the factory floor to the showroom, under board grade governance.',
      why: 'As EVs and software defined vehicles reshape the industry, the makers that embed AI now will lead on cost and experience.',
      f: [['Customer and dealer intelligence', 'Lift {C}’s conversion and aftersales with AI across enquiry, configuration and service journeys.'],
          ['Smart manufacturing', 'Use computer vision and process AI to raise quality and uptime across {C}’s plants.'],
          ['Energy and emissions optimisation', 'Forecast and optimise energy across {C}’s manufacturing and facilities to cut cost and carbon.'],
          ['Demand and supply foresight', 'Turn {C}’s data into sharper demand planning, inventory and supply chain decisions.'],
          ['Governed automation', 'Automate procurement, warranty and reporting workflows at {C} with auditable agents.']],
      impact: ['Higher plant uptime', 'Lower quality cost', 'A sharper demand picture'] },
    pharma: { label: 'Pharmaceuticals and healthcare',
      exec: '{C} works where research velocity, quality and compliance decide outcomes. STAIR would help {C} apply AI across discovery, manufacturing and commercial, under board grade governance.',
      why: 'As AI reshapes discovery and manufacturing, the firms that adopt it now will compress timelines competitors spend years on.',
      f: [['Research and document intelligence', 'Accelerate {C}’s literature review, trial documentation and regulatory submissions with AI.'],
          ['Quality and manufacturing intelligence', 'Use process AI and vision to raise yield and compliance across {C}’s plants.'],
          ['Energy aware operations', 'Optimise energy across {C}’s manufacturing and labs to cut cost and carbon.'],
          ['Predictive supply and demand', 'Turn {C}’s data into sharper demand, inventory and cold chain decisions.'],
          ['Governed automation', 'Automate pharmacovigilance, reporting and quality workflows at {C} with auditable agents.']],
      impact: ['Faster submissions', 'Higher manufacturing yield', 'Tighter compliance'] },
    energy: { label: 'Energy and utilities',
      exec: '{C} sits at the centre of the energy transition, where efficiency and foresight compound at scale. STAIR would help {C} apply AI across assets, grid and customers, under board grade governance.',
      why: 'As the grid decarbonises and demand patterns shift, the operators that embed AI now will set the efficiency benchmark.',
      f: [['Customer and demand intelligence', 'Use AI to forecast demand and personalise {C}’s customer and B2B engagement.'],
          ['Asset and process intelligence', 'Apply predictive maintenance and process AI across {C}’s plants and infrastructure.'],
          ['Energy optimisation', 'Optimise generation, distribution and consumption across {C}’s network to cut cost and carbon.'],
          ['Predictive analytics', 'Turn {C}’s operational data into forward decisions on output, risk and pricing.'],
          ['Governed automation', 'Automate trading support, reporting and compliance at {C} with auditable agents.']],
      impact: ['Higher asset uptime', 'Lower energy cost', 'A cleaner footprint'] },
    it_services: { label: 'Technology and IT services',
      exec: '{C} sells expertise at scale, where delivery efficiency and differentiation decide margin. STAIR would help {C} embed AI in delivery and in client offerings, under board grade governance.',
      why: 'As AI resets software delivery economics, the firms that adopt it now will protect margin and win the AI mandate from clients.',
      f: [['AI native client offerings', 'Help {C} package agentic and generative AI into new, higher margin client services.'],
          ['Delivery intelligence', 'Use AI to lift {C}’s engineering productivity, code quality and project predictability.'],
          ['Energy aware operations', 'Optimise data centre and office energy across {C} to lower cost and carbon.'],
          ['Predictive delivery analytics', 'Turn {C}’s delivery data into forward decisions on risk, staffing and margin.'],
          ['Governed automation', 'Automate {C}’s internal operations, reporting and compliance with auditable agents.']],
      impact: ['Higher delivery margin', 'New AI revenue lines', 'Predictable delivery'] },
    fmcg: { label: 'Consumer goods',
      exec: '{C} competes on brand, reach and cost in a fast moving consumer market. STAIR would help {C} apply AI across demand, plant and customer, under board grade governance.',
      why: 'As commerce fragments across channels, the consumer firms that embed AI now will own the cost and shelf advantage.',
      f: [['Consumer and channel intelligence', 'Use AI to sharpen {C}’s marketing, assortment and trade spend across channels.'],
          ['Process and plant intelligence', 'Raise quality and throughput across {C}’s manufacturing with process AI and vision.'],
          ['Energy optimisation', 'Forecast and optimise energy across {C}’s plants and distribution to cut cost and carbon.'],
          ['Demand and supply foresight', 'Turn {C}’s data into sharper demand planning, inventory and distribution.'],
          ['Governed automation', 'Automate {C}’s finance, trade and reporting workflows with auditable agents.']],
      impact: ['Sharper trade spend', 'Lower supply cost', 'Stronger demand planning'] },
    retail: { label: 'Retail and commerce',
      exec: '{C} wins on assortment, experience and supply chain speed. STAIR would help {C} apply AI from demand to doorstep, under board grade governance.',
      why: 'As shoppers move fluidly between online and store, the retailers that embed AI now will set the experience and cost benchmark.',
      f: [['Customer and merchandising intelligence', 'Personalise {C}’s recommendations, pricing and assortment across channels.'],
          ['Operations intelligence', 'Use AI to streamline {C}’s store, warehouse and fulfilment operations.'],
          ['Energy optimisation', 'Optimise energy across {C}’s stores and warehouses to cut cost and carbon.'],
          ['Demand and inventory foresight', 'Turn {C}’s data into sharper demand, pricing and inventory decisions.'],
          ['Governed automation', 'Automate {C}’s back office, returns and reporting workflows with auditable agents.']],
      impact: ['Higher conversion', 'Fewer stockouts', 'Leaner operations'] },
    telecom: { label: 'Telecommunications',
      exec: '{C} runs a vast network serving millions, where experience and efficiency decide share. STAIR would help {C} apply AI across network, customer and operations, under board grade governance.',
      why: 'As data demand and 5G economics intensify, the operators that embed AI now will lead on cost and experience.',
      f: [['Customer experience AI', 'Resolve {C}’s customer queries and reduce churn with assistants across every channel.'],
          ['Network intelligence', 'Use predictive AI to optimise {C}’s network performance, capacity and maintenance.'],
          ['Energy optimisation', 'Optimise energy across {C}’s towers and data centres to cut cost and carbon.'],
          ['Predictive analytics', 'Turn {C}’s network and usage data into forward decisions on demand, churn and risk.'],
          ['Governed automation', 'Automate {C}’s provisioning, billing and reporting workflows with auditable agents.']],
      impact: ['Lower churn', 'Higher network efficiency', 'Lower energy cost'] },
    industrials: { label: 'Industrials and engineering',
      exec: '{C} builds and operates at scale, where uptime, quality and project control decide returns. STAIR would help {C} apply AI from plant to project, under board grade governance.',
      why: 'As industrial AI matures, the firms that adopt it now will set the cost, quality and delivery benchmark.',
      f: [['Project and bid intelligence', 'Use AI to sharpen {C}’s estimation, bidding and project controls.'],
          ['Plant and process intelligence', 'Apply vision and predictive maintenance to raise quality and uptime across {C}’s operations.'],
          ['Energy optimisation', 'Forecast and optimise energy across {C}’s plants and sites to cut cost and carbon.'],
          ['Predictive analytics', 'Turn {C}’s operational data into forward decisions on risk, schedule and cost.'],
          ['Governed automation', 'Automate {C}’s procurement, safety and reporting workflows with auditable agents.']],
      impact: ['Higher uptime', 'Tighter project control', 'Lower operating cost'] },
    realestate: { label: 'Real estate and development',
      exec: '{C} creates and manages assets where capital efficiency and customer experience compound. STAIR would help {C} apply AI across sales, projects and operations, under board grade governance.',
      why: 'As buyers and tenants expect digital first experiences, the developers that embed AI now will lead on velocity and margin.',
      f: [['Sales and customer intelligence', 'Use AI to qualify, nurture and convert {C}’s buyers across every channel.'],
          ['Project intelligence', 'Apply AI to {C}’s design, costing and construction controls to protect schedule and margin.'],
          ['Energy optimisation', 'Optimise energy across {C}’s projects and managed assets to cut cost and carbon.'],
          ['Predictive analytics', 'Turn {C}’s data into sharper decisions on demand, pricing and project risk.'],
          ['Governed automation', 'Automate {C}’s documentation, approvals and reporting with auditable agents.']],
      impact: ['Faster sales velocity', 'Tighter project margin', 'Lower operating cost'] },
    logistics: { label: 'Logistics and supply chain',
      exec: '{C} moves goods at scale, where speed, cost and reliability decide loyalty. STAIR would help {C} apply AI across network, fleet and customer, under board grade governance.',
      why: 'As commerce demands faster and cheaper delivery, the operators that embed AI now will set the cost and service benchmark.',
      f: [['Customer and demand intelligence', 'Use AI to forecast volumes and personalise {C}’s customer and B2B engagement.'],
          ['Network and route intelligence', 'Optimise {C}’s routing, capacity and hub operations with predictive AI.'],
          ['Energy optimisation', 'Optimise fuel and facility energy across {C}’s fleet and network to cut cost and carbon.'],
          ['Predictive analytics', 'Turn {C}’s data into forward decisions on demand, delays and cost.'],
          ['Governed automation', 'Automate {C}’s documentation, tracking and reporting workflows with auditable agents.']],
      impact: ['Faster delivery', 'Lower cost per shipment', 'Higher reliability'] },
    'default': { label: '',
      exec: '{C} sits at a moment where artificial intelligence can compound efficiency, insight and growth at once. STAIR would partner with {C}’s leadership to find the highest return AI opportunities and deliver them under board grade governance.',
      why: 'Across your industry, the firms that embed AI now will set the cost and experience benchmark that others spend years chasing.',
      f: [['Customer facing intelligence', 'Bring AI assistants and recommendation engines into {C}’s customer journey to lift conversion and lifetime value.'],
          ['Process intelligence', 'Map {C}’s core workflows and remove manual handoffs with agentic automation, freeing teams for higher value work.'],
          ['Smart consumption', 'Forecast and optimise energy use across {C}’s facilities and infrastructure to cut both cost and carbon.'],
          ['Demand and risk foresight', 'Turn {C}’s historical data into forward decisions on demand, churn and risk.'],
          ['Back office automation', 'Automate repetitive finance, support and reporting tasks at {C} with governed AI agents.']],
      impact: ['Lower operating cost', 'Faster, sharper decisions', 'A defensible AI advantage'] }
  };

  var CREDENTIALS = [
    'Co-founded with Shailesh Haribhakti, Chairman, with 70 plus board associations',
    'Trusted by ICICI Securities, the Adani Group, L&amp;T, Vakils and Dinshaws',
    'Oxford Saïd Business School and IET pedigree, with 13 years of applied AI research',
    'Co-author of The AI Auditor and TEDx speaker on AI at Oxford and Bocconi'
  ];

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  /* Fire-and-forget: a failed enquiry post must never stop the visitor
     getting their blueprint, so nothing here is awaited or surfaced. */
  /* Flatten the blueprint into something readable in an inbox. The email
     should be enough to act on without opening the site. */
  function blueprintText(d) {
    var L = [];
    L.push(d.title || 'AI blueprint');
    L.push('Sector read: ' + (d.sector || 'general'));
    L.push('');
    L.push('EXECUTIVE SUMMARY');
    L.push(d.exec || '');
    if (d.why) { L.push(''); L.push('WHY NOW'); L.push(d.why); }
    if (d.focus && d.focus.length) {
      L.push(''); L.push('FOCUS AREAS');
      d.focus.forEach(function (f) {
        L.push('- ' + (f.theme ? f.theme + ' | ' : '') + (f.title || ''));
        if (f.detail) L.push('  ' + f.detail);
      });
    }
    if (d.approach && d.approach.length) {
      L.push(''); L.push('APPROACH');
      d.approach.forEach(function (a) {
        L.push('- ' + (a.phase || '') + ': ' + (a.detail || ''));
      });
    }
    if (d.governance) { L.push(''); L.push('GOVERNANCE'); L.push(d.governance); }
    if (d.impact && d.impact.length) {
      L.push(''); L.push('EXPECTED IMPACT');
      d.impact.forEach(function (x) { L.push('- ' + x); });
    }
    return L.join('\n');
  }

  /* Fire-and-forget. A failed send must never stop the visitor getting
     their blueprint, so nothing here is awaited or surfaced to them. */
  function sendLead(d, contact) {
    if (!LEAD_ACCESS_KEY) return;
    var payload = {
      access_key: LEAD_ACCESS_KEY,
      subject: 'AI blueprint enquiry: ' + (d.company || 'unknown company'),
      from_name: 'STAIR Digital website',
      /* Web3Forms uses this as the Reply-To, so hitting reply in the
         inbox answers the enquirer directly. */
      email: contact.email || '',
      name: d.name || '',
      company: d.company || '',
      phone: contact.phone || '',
      submitted_at: new Date().toISOString(),
      page: 'proposal.html',
      blueprint: blueprintText(d)
    };
    try {
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true          /* survives the tab being closed straight after */
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  /* read back at build time so the sheet can carry who asked for it */
  function em0() { var e = document.getElementById('prEmail'); return e ? e.value.trim() : ''; }
  function ph0() { var e = document.getElementById('prPhone'); return e ? e.value.trim() : ''; }

  function build(name, company) {
    var C = company, sec = S[detectSector(C)] || S['default'];
    var fill = function (t) { return t.replace(/\{C\}/g, C); };
    var titles = ['An AI-first blueprint for ' + C, C + ': a governance-led AI roadmap',
                  'Putting AI to work at ' + C, 'An AAAi blueprint for ' + C];
    return {
      name: name, company: C, sector: sec.label,
      title: titles[hash(C) % titles.length],
      exec: fill(sec.exec), why: fill(sec.why),
      focus: sec.f.map(function (x, i) { return { theme: THEMES[i], title: x[0], detail: fill(x[1]) }; }),
      /* STAIR's own three phases, the same Ground / Prove / Widen used on
         the Enterprise Brain, so a visitor meets one method across the site
         rather than a generic diagnose-pilot-scale that any firm could
         have written. */
      approach: [
        { phase: 'Ground',
          detail: 'Map where knowledge actually lives inside ' + C + ', connect the first sources, and stand '
                + 'the work up against one function, most often finance, audit or legal. Permissions and '
                + 'provenance are built in here, not retrofitted later.' },
        { phase: 'Prove',
          detail: 'Run it against the questions that function is asked every month, beside how they are '
                + 'answered today. The evaluation harness is written at this point, so improvement at ' + C
                + ' becomes measurable rather than anecdotal.' },
        { phase: 'Widen',
          detail: 'Extend across functions with agents on top, each inside the same permissions and the same '
                + 'audit trail, so every later initiative at ' + C + ' connects to one memory rather than '
                + 'adding another silo beside it.' }
      ],
      governance: 'Built to the standard set out in The AI Auditor, the book our founders wrote for the '
                + 'people who carry the risk. Every claim carries its source, the system declines rather than '
                + 'guesses, access is inherited rather than granted, and question, sources and model version '
                + 'are logged so an internal auditor can reconstruct any answer months later. That is what '
                + 'lets ' + C + '’s board act on the output rather than only admire it.',
      impact: sec.impact,
      cta: 'Let us map ' + C + '’s AI roadmap together.',
      contact: { email: em0(), phone: ph0() }
    };
  }

  /* ---------- 3. render ---------- */
  function render(d) {
    var date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var focus = d.focus.map(function (f) {
      return '<div class="pr-row"><div class="pr-theme">' + esc(f.theme) + '</div>' +
             '<div><b>' + esc(f.title) + '</b><span>' + esc(f.detail) + '</span></div></div>';
    }).join('');
    var approach = d.approach.map(function (a, i) {
      return '<div class="pr-step"><span class="pr-n">0' + (i + 1) + '</span><div><b>' + esc(a.phase) +
             '</b><span>' + esc(a.detail) + '</span></div></div>';
    }).join('');
    var impact = d.impact.map(function (x) { return '<div class="pr-imp"><i></i><span>' + esc(x) + '</span></div>'; }).join('');
    var creds = CREDENTIALS.map(function (c) { return '<li>' + c + '</li>'; }).join('');

    return '' +
    '<div class="pr-ready">' +
      '<span class="pr-tick" aria-hidden="true">&#10003;</span>' +
      '<p>Your proposal for <b>' + esc(d.company) + '</b> is ready.</p>' +
      '<button class="pr-dl" data-print>Download PDF</button>' +
    '</div>' +
    '<div id="prDoc">' +
      '<article class="pr-sheet">' +
        '<header class="pr-head">' +
          '<img src="assets/stair-logo-full.png" alt="STAIR Digital" class="pr-logo">' +
          '<div class="pr-meta">Confidential proposal<br>' + date + '</div>' +
        '</header>' +
        '<div class="pr-rule"></div>' +
        '<div class="pr-for"><span>Prepared for</span><h2>' + esc(d.company) + '</h2>' +
          (d.sector ? '<p class="pr-sec">' + esc(d.sector) + '</p>' : '') +
          '<p class="pr-att">At the request of ' + esc(d.name) + '</p></div>' +
        /* only present when a backend researched the company - it is the
           visible proof that this blueprint is not a sector template */
        (d.snapshot ? '<p class="pr-snap"><i aria-hidden="true"></i>' + esc(d.snapshot) + '</p>' : '') +
        '<h1 class="pr-title">' + esc(d.title) + '</h1>' +
        '<p class="pr-exec">' + esc(d.exec) + '</p>' +
        '<blockquote class="pr-why">' + esc(d.why) + '</blockquote>' +
        '<h3 class="pr-lbl">Where AI moves the needle</h3>' + focus +
      '</article>' +
      '<article class="pr-sheet">' +
        '<h3 class="pr-lbl">How STAIR delivers</h3>' + approach +
        '<div class="pr-impact"><h3 class="pr-lbl">Expected impact</h3>' + impact + '</div>' +
        '<h3 class="pr-lbl">Governance built in</h3>' +
        '<p class="pr-gov">' + esc(d.governance) + '</p>' +
        '<h3 class="pr-lbl">Why STAIR</h3><ul class="pr-creds">' + creds + '</ul>' +
        '<div class="pr-cta">' +
          '<p class="pr-cta-h">' + esc(d.cta) + '</p>' +
          '<p class="pr-cta-p">A thirty minute conversation with our founders to pressure-test the opportunity.</p>' +
          /* data-consult opens the site's own email / call chooser */
          '<button class="pr-cta-b" data-consult>Book a meeting</button>' +
        '</div>' +
        '<footer class="pr-sig"><div><b>Shubham Saraff</b><span>Cofounder &amp; Director</span>' +
          '<span>saraff@stair.digital &middot; +91 99302 20342 &middot; www.stair.digital</span></div>' +
          '<img src="assets/stair-mark.png" alt="" class="pr-mark"></footer>' +
      '</article>' +
    '</div>' +
    '<div class="pr-actions">' +
      '<button class="pr-dl" data-print>Download proposal (PDF)</button>' +
      '<a class="pr-send" href="' + mailtoLead(d) + '">Send this to STAIR</a>' +
      '<button class="pr-again" data-again>Draft another</button>' +
    '</div>';
  }

  /* A prefilled mail to the firm carrying the visitor's own details. This
     is the stopgap while LEAD_ENDPOINT is blank: it depends on the visitor
     clicking, so it is not lead capture, but it means an interested reader
     always has a one-tap way to reach a founder. */
  function mailtoLead(d) {
    var c = d.contact || {};
    var body = [
      'I generated an AI blueprint on stair.digital and would like to discuss it.',
      '',
      'Name: ' + (d.name || ''),
      'Company: ' + (d.company || ''),
      'Email: ' + (c.email || ''),
      'Phone: ' + (c.phone || ''),
      'Sector read: ' + (d.sector || ''),
      '',
      'Blueprint: ' + (d.title || '')
    ].join('\n');
    return 'mailto:' + LEAD_INBOX
         + '?subject=' + encodeURIComponent('AI blueprint enquiry: ' + (d.company || ''))
         + '&body=' + encodeURIComponent(body);
  }

  /* ---------- 4. wire up ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-decrypt]').forEach(function (el) {
      decrypt(el, { stagger: +(el.getAttribute('data-stagger') || 42), delay: +(el.getAttribute('data-delay') || 220) });
    });

    var form = document.getElementById('prForm');
    if (!form) return;
    var nameEl = document.getElementById('prName'),
        coEl = document.getElementById('prCo'),
        emailEl = document.getElementById('prEmail'),
        phoneEl = document.getElementById('prPhone'),
        err = document.getElementById('prErr'),
        load = document.getElementById('prLoad'),
        bar = document.getElementById('prBar'),
        step = document.getElementById('prStep'),
        out = document.getElementById('prOut'),
        intro = document.getElementById('prIntro');

    /* With a backend wired up the model really is searching the web, which takes
       longer, so the steps say so rather than pretending to be instant. */
    var STEPS = API_ENDPOINT
      ? ['Researching the company', 'Reading recent public developments',
         'Mapping AI, efficiency and automation gains', 'Shaping the engagement',
         'Applying STAIR governance', 'Typesetting your blueprint']
      : ['Reading the company and its sector', 'Mapping AI, efficiency and automation gains',
         'Shaping the engagement', 'Applying STAIR governance', 'Typesetting your blueprint'];

    function show(d) {
      out.innerHTML = render(d);
      out.hidden = false;
      intro.classList.add('is-done');
      /* the chooser and print buttons are created after site.js ran, so bind here */
      out.querySelectorAll('[data-print]').forEach(function (b) {
        b.addEventListener('click', function () { window.print(); });
      });
      out.querySelectorAll('[data-again]').forEach(function (b) {
        b.addEventListener('click', function () {
          out.hidden = true; out.innerHTML = '';
          intro.classList.remove('is-done');
          nameEl.value = ''; coEl.value = '';
          window.scrollTo({ top: document.getElementById('prStart').offsetTop - 80, behavior: 'smooth' });
        });
      });
      out.querySelectorAll('[data-consult]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          var ch = document.getElementById('chooser');
          if (ch) { ch.classList.add('open'); ch.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
        });
      });
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = nameEl.value.trim(), c = coEl.value.trim();
      var em = emailEl ? emailEl.value.trim() : '', ph = phoneEl ? phoneEl.value.trim() : '';

      /* All four are required before anything is generated. Validated here
         as well as with the `required` attribute, because the attribute is
         trivially removed in devtools and this is the only gate we have. */
      function fail(msg, el) { err.textContent = msg; err.hidden = false; if (el) el.focus(); }
      if (!n)  { return fail('Please add your name.', nameEl); }
      if (!c)  { return fail('Please add your company.', coEl); }
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) {
        return fail('Please add a valid work email so we can send this to you.', emailEl);
      }
      /* digits only, so +91 00000 00000 and 0000000000 both pass */
      if (!ph || (ph.replace(/[^\d]/g, '').length < 8)) {
        return fail('Please add a phone number a founder can reach you on.', phoneEl);
      }
      err.hidden = true;
      load.hidden = false;
      var i = 0; step.textContent = STEPS[0]; bar.style.width = '10%';
      var t = setInterval(function () {
        i = Math.min(i + 1, STEPS.length - 1);
        step.textContent = STEPS[i];
        bar.style.width = (10 + (i / (STEPS.length - 1)) * 80) + '%';
      }, API_ENDPOINT ? 2600 : 560);

      var finish = function (d) {
        d.name = d.name || n;
        d.company = d.company || c;
        d.contact = d.contact || { email: em, phone: ph };
        /* sent here rather than on submit, so the email carries the
           document the visitor was actually shown */
        sendLead(d, d.contact);
        clearInterval(t); bar.style.width = '100%';
        setTimeout(function () { load.hidden = true; bar.style.width = '0'; show(d); }, 320);
      };

      if (API_ENDPOINT) {
        fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, company: c, email: em, phone: ph }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (d) {
            /* a researched blueprint must actually contain research; anything
               malformed or refused falls back rather than shipping a stub */
            if (!d || d.error || !Array.isArray(d.focus)) { finish(build(n, c)); return; }
            d.why = d.why || d.whyNow;       /* the backend names this whyNow */
            d.name = d.name || n;
            d.company = d.company || c;
            d.contact = d.contact || { email: em, phone: ph };
            finish(d);
          })
          .catch(function () { finish(build(n, c)); });   /* never leave the user stuck */
      } else {
        setTimeout(function () { finish(build(n, c)); }, 2000);
      }
    });
  });
})();
