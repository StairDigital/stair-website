/* ============================================================
   Intelligence Briefings — the articles section on Research.

   Content is drawn from STAIR's own monthly AI Intelligence Briefings
   (April and July 2026). Every figure and attribution below appears in
   those briefings; nothing here is invented. Where a number is quoted
   the house that published it is named, because a statistic without a
   source is the thing this firm tells clients not to accept.

   Rendering is plain DOM building. The reader is one overlay reused for
   whichever article is open, and the PDF is window.print() against the
   print rules in articles.css, which is the same approach the Blueprint
   page uses: no library, nothing loaded from a CDN, and it stays inside
   the site's Content Security Policy.
   ============================================================ */
(function () {
  "use strict";

  var ARTICLES = [
    {
      id: 'checkpoint',
      cat: 'Governance',
      date: '2026-07-28',
      dateLabel: 'July 2026',
      read: 6,
      accent: '#0E9C93',
      glyph: '<path d="M12 3l7.5 3.2v5.1c0 5.1-3.2 8.3-7.5 10.4-4.3-2.1-7.5-5.3-7.5-10.4V6.2z"/><path d="m8.6 12.1 2.4 2.4 4.4-4.6"/>',
      title: 'The checkpoint nobody can name',
      deck: 'Every large organisation has an AI governance framework. Very few can tell you the moment a model is cleared to run in production, and who signed.',
      body: [
        {p: 'Ask a board how it governs artificial intelligence and you will usually be handed a document. Ask the same board to name the checkpoint at which a model is cleared for production, and who put their name to that decision, and the room goes quiet. Across the work published by BCG, McKinsey and Deloitte through 2026, that is the same gap reported again and again: the framework exists on paper, and the control does not exist in the process.'},
        {p: 'This has become the binding constraint on enterprise AI value. Not model capability, which improves every quarter without anyone in the enterprise having to do anything. Governance, which improves only when someone builds it.'},
        {h: 'Why the old controls stopped working'},
        {p: 'For most of the last decade, enterprise AI advised. A model scored a lead, flagged a transaction, ranked a CV. A human then decided. That arrangement is forgiving, because the human is the control: if the model is wrong, the person catches it before anything happens.'},
        {p: 'Agentic systems break that arrangement. They execute, and then a human sees the result. Anthropic\'s 2026 State of AI Agents Report found that 81% of surveyed organisations planned to take on more complex use cases within the year, with 39% building agents for multi-step processes and 29% for cross-functional work. In each of those, the action lands before the review.'},
        {q: 'Advisory-era controls assume a human stands between the model and the consequence. Agentic systems remove that person and leave the control diagram unchanged.'},
        {p: 'Deloitte put the same point more bluntly: agentic AI is scaling faster than the guardrails meant to contain it. That is not a warning about the technology. It is a warning about sequencing.'},
        {h: 'What a real checkpoint looks like'},
        {p: 'A governance framework becomes a control when it can answer four questions on any given day, in writing, without a meeting:'},
        {ul: [
          'Which named executive owns this model in production, and against which P&amp;L line?',
          'What did it score on an evaluation set built from our own work, not a public leaderboard?',
          'What is it permitted to do unaided, and where does it have to stop and escalate?',
          'If an auditor asks in eleven months what answered a question in March, can we reconstruct it?'
        ]},
        {p: 'None of those require new technology. They require someone to decide, and the decision to be recorded somewhere an auditor can find it. Most organisations we open up have the capability to answer all four and have never been asked to.'},
        {h: 'Where regulators have got to'},
        {p: 'The Reserve Bank of India\'s draft model-risk guidance is the clearest signal yet that this is moving from good practice to expectation, at least in financial services. The EU AI Act is phasing in, with prohibited uses first. Neither asks whether an organisation has a policy. Both ask what happens at the point of deployment.'},
        {p: 'The practical implication for an Indian enterprise is that the checkpoint has to exist before the regulator asks for it, because it cannot be retrofitted onto decisions already made. A model already running in production without a recorded clearance is a finding waiting to be written up.'},
        {h: 'What to do this quarter'},
        {p: 'Pick the function where AI is furthest along, most often finance, audit or legal. Write down the four answers above for every model already live there. The exercise usually takes a fortnight and it produces two things: a control that did not exist before, and an honest list of what is running without an owner.'},
        {p: 'That list is uncomfortable. It is also the most useful document a board will read this year.'}
      ]
    },

    {
      id: 'structure',
      cat: 'Operating model',
      date: '2026-04-30',
      dateLabel: 'April 2026',
      read: 6,
      accent: '#3D6B8A',
      glyph: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
      title: 'Structure precedes scale',
      deck: 'The gating factor on AI returns is organisational design, not model selection. The evidence on that is now uncomfortably consistent.',
      body: [
        {p: 'There is a version of the AI conversation that never leaves the technology. Which model, which vendor, which cloud. It is a comfortable conversation because every question in it has a procurable answer.'},
        {p: 'The evidence from 2026 points somewhere less comfortable. BCG finds agent-first leaders cutting costs by 15% to 20%, while most organisations remain below 30% adoption. The difference between those two groups is not model access. Every one of them can buy the same models on the same terms this afternoon. The difference is how the organisation around the model is arranged.'},
        {h: 'Seventy per cent of the work is not technical'},
        {p: 'The figure that should reset most transformation plans is this: success in these programmes is roughly 70% people and change management. Not 70% of the risk. Seventy per cent of the work.'},
        {p: 'That ratio explains why so many pilots succeed and so few scale. A pilot can be delivered by a technical team working around the organisation. Scaling requires the organisation itself to change shape, and nobody on the technical team has the authority to do that.'},
        {q: 'A pilot is something you can do to an organisation. Scaling is something the organisation has to do to itself.'},
        {h: 'Workflows, not tasks'},
        {p: 'The second structural finding is about the unit of redesign. Most enterprises automate tasks: the invoice match, the reconciliation line, the first-draft clause. Each one returns a small, real saving that is then absorbed by the process around it, which has not changed.'},
        {p: 'The returns arrive when the unit of redesign is the end-to-end workflow, which almost always crosses a departmental boundary, which is precisely why it does not happen by itself. Two directors optimising their own halves of a process will never produce the redesign that the whole process needs.'},
        {p: 'That is an argument for a single accountable executive owner spanning the workflow, with the authority to change how both halves work. Without one, the work stalls at the boundary every time.'},
        {h: 'The centralised function that makes it possible'},
        {p: 'Agentic operations, in particular, demand a centralised transformation function. Not a centre of excellence that publishes standards and hopes, but a function that owns the redesign, the evaluation harness, the deployment gates and the reporting line into the board.'},
        {p: 'Deloitte\'s reading of the same period lands on three things: governance, operating models and proven return. The order matters. The organisations getting returns did the operating-model work first and found the returns followed. The ones chasing returns directly are still running pilots.'},
        {h: 'The question to put to the board'},
        {p: 'Not "which model should we standardise on". That question has a shelf life of about six months and no bearing on outcomes.'},
        {p: 'The question is: which end-to-end process are we redesigning this year, who owns it across every function it touches, and what is the number against their name. If nobody in the room can answer that, the AI budget is funding experiments rather than change.'}
      ]
    },

    {
      id: 'moat',
      cat: 'Strategy',
      date: '2026-07-31',
      dateLabel: 'July 2026',
      read: 5,
      accent: '#D96A30',
      glyph: '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="15.4" r="1.4"/>',
      title: 'Rented intelligence has no moat',
      deck: 'Savings from off-the-shelf tools get competed away, because your competitor buys the same licence. What survives is the logic you own.',
      body: [
        {p: 'The most consequential shift in enterprise AI this year is also the least discussed in public. Analysis from MIT Technology Review and BCG shows that standard foundation-model scaling is delivering diminishing returns. The curve that justified simply buying the largest available model has flattened.'},
        {p: 'That matters commercially for a reason that has nothing to do with model quality. If a capability arrives as a licence, every competitor can license it too. The efficiency gain is real for a quarter or two, and then the market competes it away and it shows up in customer pricing rather than in your margin.'},
        {h: 'What cannot be competed away'},
        {p: 'What survives is the part nobody else can buy: your own business logic, embedded into an execution layer you own. The approval thresholds your board actually set. The way your contracts are written. The reason a decision was taken in 2019. None of that is in anyone\'s foundation model, and none of it can be acquired by a competitor with a purchase order.'},
        {q: 'A capability you can buy is a capability your competitor has already bought. Margin comes from the part of the system that is specific to you.'},
        {p: 'This is why the budget conversation is moving from broad foundation-model licences toward proprietary execution architectures, and toward products that generate revenue rather than only removing cost.'},
        {h: 'The practical shape of it'},
        {p: 'In practice this means the frontier model stops being the product and becomes a component. It sets the standard on your own questions and it is what you distil from. What goes into production is smaller, tuned on your corpus, running inside your estate, and versioned like any other control.'},
        {p: 'A small model trained tightly on one enterprise\'s domain frequently outperforms a far larger general model on that enterprise\'s own work, because all of its capacity is spent there rather than on everything else. It also costs a fraction to run, does not meter per token, and can be frozen so that an answer given in March is reproducible in December.'},
        {h: 'Where this leaves the CIO'},
        {p: 'The uncomfortable question for anyone who has already signed a large platform commitment is what proportion of it funds capability that a competitor could match by signing the same contract. For most enterprises the honest answer is: most of it.'},
        {p: 'That does not make the spend wrong. Frontier models still set the benchmark and are what you distil from, and for genuinely open-ended work they remain the right tool. It makes the spend insufficient on its own. The differentiated part has to be built, and building it is a decision that gets made once, deliberately, rather than arrived at by default.'}
      ]
    },

    {
      id: 'budgets',
      cat: 'Capital',
      date: '2026-04-30',
      dateLabel: 'April 2026',
      read: 5,
      accent: '#B8863B',
      glyph: '<path d="M4 20h16"/><path d="M7 20v-5M12 20v-9M17 20v-13"/><path d="M14.4 8.2 17 5.6l2.6 2.6"/>',
      title: 'The budget doubled. The question changed.',
      deck: 'AI spending is accelerating and CEOs have taken direct ownership of it. The hard part is no longer deployment. It is proving the return.',
      body: [
        {p: 'The numbers for 2026 are not ambiguous. Gartner projects AI model and platform spend reaching $64 billion, up 63% year on year, with generative AI up 117%. BCG reports enterprise AI budgets nearly doubling, to around 1.7% of revenue, and — the detail that matters most — under direct CEO ownership.'},
        {p: 'By the middle of the year, close to 75% of global CEOs were steering AI investment personally rather than delegating it to technology functions.'},
        {h: 'What CEO ownership actually changes'},
        {p: 'When a chief executive owns the budget, the reporting standard changes with it. A technology function can report adoption: seats provisioned, queries served, pilots launched. A chief executive reporting to a board cannot. They are asked what it returned.'},
        {p: 'This is why the framing has shifted from deployment to value. Deployment was the hard part when models were difficult to access and integrate. Both problems are largely solved. What is not solved is demonstrating, in the language of a P&amp;L, that the spend produced something.'},
        {q: 'Pilot counts and usage metrics are activity, not return. A board that accepts them as evidence is funding motion.'},
        {h: 'Treat it as a portfolio'},
        {p: 'The most useful reframing we see working is to stop treating the AI budget as a technology line and start treating it as a portfolio across four things: technology, data, talent and governance.'},
        {p: 'Most organisations are heavily overweight the first and underweight the other three. That imbalance is the mechanical reason the returns do not appear: the model arrives, and the data it needs is not ready, the people around it have not changed how they work, and there is no control allowing it to be trusted with anything that matters.'},
        {h: 'Tie the next tranche to an outcome'},
        {p: 'The discipline that separates the organisations getting returns is unglamorous. Continued investment is tied to financial outcomes rather than to pilot counts. Each tranche of funding is released against a number that someone has put their name to.'},
        {p: 'That is ordinary capital discipline. It is applied as a matter of course to a new plant or an acquisition, and it is very often suspended for AI on the grounds that the technology is new. The technology being new is exactly why the discipline is needed.'},
        {p: 'One test, before the next budget cycle: for every AI initiative currently funded, can you name the executive accountable and the financial line it moves? Where you cannot, you are not looking at an investment. You are looking at an experiment that has been running long enough to look like one.'}
      ]
    },

    {
      id: 'india',
      cat: 'Regulation',
      date: '2026-07-31',
      dateLabel: 'July 2026',
      read: 6,
      accent: '#7A5C8E',
      glyph: '<path d="M12 3v3M6.5 5.5 8.6 7.6M17.5 5.5 15.4 7.6"/><path d="M4 10h16"/><path d="M7 10v7M12 10v7M17 10v7"/><path d="M4.5 20h15"/>',
      title: 'India is writing deployment-first rules',
      deck: 'While the EU regulates by category of risk, India is regulating by sector and by point of use. For Indian enterprises that is the more immediate constraint.',
      body: [
        {p: 'Two regulatory philosophies are taking shape in parallel, and Indian enterprises are exposed to both.'},
        {p: 'The European Union has codified governance and transparency obligations in the AI Act, phasing in with prohibited uses first. It is horizontal: it classifies systems by risk category and applies obligations accordingly, regardless of industry.'},
        {p: 'India is doing something different. Rather than one horizontal statute, sector regulators are setting expectations at the point where AI is actually deployed. The Reserve Bank of India\'s draft model-risk guidance is the clearest example, and financial services will not be the last sector to receive one.'},
        {h: 'Why deployment-first is harder to prepare for'},
        {p: 'A horizontal regime lets an enterprise build one compliance programme and map every system into it. A deployment-first regime does not. The obligations arrive per sector, at different times, phrased in the language of that sector\'s existing supervision.'},
        {q: 'A single AI policy will not satisfy a sector regulator asking how a specific model behaves inside a specific control.'},
        {p: 'For a diversified group operating across financial services, healthcare and manufacturing, that means the same underlying model may sit under three different sets of expectations depending on which subsidiary is running it.'},
        {h: 'The state is also a builder'},
        {p: 'The regulatory picture cannot be separated from the industrial one. Capital has been committed to the IndiaAI Mission, MeitY is planning an AI-led overhaul of government IT, and sovereign model releases mark a shift from consuming AI to producing it. NITI Aayog has flagged the moment as an inflection point for India\'s technology services sector.'},
        {p: 'Stanford HAI tracks the same movement globally: a shift toward national AI sovereignty, with data-residency mandates from both the EU and MeitY reshaping where inference is allowed to happen. That is not only a legal question. It is an architectural one, and it is why hybrid and sovereign deployment has moved onto the CIO agenda.'},
        {h: 'What this means for an Indian board'},
        {p: 'Three things follow, and none of them wait for the final text of any rule.'},
        {ul: [
          'Know which sector regulator has jurisdiction over each AI system you run, and read what they have drafted rather than what has been enacted.',
          'Establish where your inference physically happens. If a regulated workload leaves the jurisdiction, that is a finding regardless of how the model performs.',
          'Validate vendor capability claims against independent benchmarks before committing capital, because a supervisor will not accept a vendor datasheet as evidence.'
        ]},
        {p: 'India is emerging as a deployment-first regulatory pole. For enterprises headquartered here, that is not a distant compliance exercise. It is the environment the next three years of AI investment will be supervised in.'}
      ]
    },

    {
      id: 'routing',
      cat: 'Architecture',
      date: '2026-07-31',
      dateLabel: 'July 2026',
      read: 5,
      accent: '#5F8A5A',
      glyph: '<circle cx="5" cy="12" r="2.4"/><circle cx="19" cy="6.5" r="2.4"/><circle cx="19" cy="17.5" r="2.4"/><path d="M7.3 11.1 16.7 7.4M7.3 12.9l9.4 3.7"/>',
      title: 'One model no longer fits',
      deck: 'Compute inflation and data-residency rules have made the single centralised model strategy untenable. Routing is now a budget decision.',
      body: [
        {p: 'For several years the sensible enterprise architecture was singular: choose the strongest available model, route everything through it, and let capability improvements arrive for free. Enterprise frameworks published this year by NVIDIA and Microsoft describe the end of that arrangement.'},
        {p: 'Two forces broke it. Compute costs rose faster than the budgets funding them, and regional data mandates — from the European Union and from India\'s Ministry of Electronics and Information Technology — made it unlawful in specific cases for a workload to be processed wherever it happened to be cheapest.'},
        {h: 'Workloads are splitting'},
        {p: 'What replaces it is a split. Frontier models in the cloud handle genuinely open-ended work. Cheaper private inference, running locally or inside a controlled boundary, handles the high-volume repetitive work that makes up most of an enterprise\'s actual query load.'},
        {p: 'This is now a budgeting question as much as a technical one. The difference between routing every query to a frontier model and routing only the queries that need one is, at enterprise volume, the difference between two very different annual numbers.'},
        {q: 'Sending every question to the largest available model is the AI equivalent of flying a courier business class. It works, and it is not a strategy.'},
        {h: 'Dynamic routing as a control'},
        {p: 'Dynamic model routing — deciding per request which model should answer — does two jobs at once. It controls infrastructure spend, and it keeps regulated material inside the jurisdiction it is required to stay in. Those two requirements happen to be satisfied by the same mechanism, which is unusual and worth exploiting.'},
        {p: 'The prerequisite is knowing what your query mix actually looks like. Most enterprises have never measured it, and are surprised by the answer: the overwhelming majority of production queries are narrow, repetitive and well within the reach of a far smaller model.'},
        {h: 'What to ask the technology function'},
        {ul: [
          'What proportion of our production queries genuinely require a frontier model, measured rather than assumed?',
          'Which workloads are legally required to remain in-jurisdiction, and can we prove today where they run?',
          'What would our annual inference cost be under routing, against what we are paying now?'
        ]},
        {p: 'The answers usually make the case on their own. Single-architecture, centralised model strategies are becoming financially and legally unsustainable for any firm operating across more than one jurisdiction — and hybrid is not a compromise position. It is the architecture that survives both the cost curve and the regulator.'}
      ]
    }
  ];

  /* ---------------- render ---------------- */
  var grid = document.getElementById('artGrid');
  var filters = document.getElementById('artFilters');
  if (!grid) return;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* One row per briefing, separated by a rule rather than boxed. The mark
     on the left is a flat block of the article's own colour carrying a
     glyph that stands for its argument: no photography, because generic
     stock had nothing to do with any of these pieces. */
  function row(a, n) {
    var c = el('article', 'art-row');
    c.setAttribute('data-cat', a.cat);
    c.style.setProperty('--c', a.accent);
    c.innerHTML =
      '<button class="art-open" aria-label="Read: ' + a.title + '">' +
        '<span class="art-n">' + (n < 9 ? '0' : '') + (n + 1) + '</span>' +
        '<span class="art-mark" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24">' + a.glyph + '</svg>' +
        '</span>' +
        '<span class="art-body">' +
          '<span class="art-meta"><em>' + a.cat + '</em><i></i>' + a.dateLabel + '<i></i>' + a.read + ' min read</span>' +
          '<span class="art-title">' + a.title + '</span>' +
          '<span class="art-deck">' + a.deck + '</span>' +
        '</span>' +
        '<span class="art-go" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</span>' +
      '</button>';
    c.querySelector('.art-open').addEventListener('click', function () { open(a); });
    return c;
  }

  ARTICLES.forEach(function (a, i) { grid.appendChild(row(a, i)); });

  /* category filter */
  if (filters) {
    var cats = ['All'].concat(ARTICLES.map(function (a) { return a.cat; })
      .filter(function (v, i, s) { return s.indexOf(v) === i; }));
    cats.forEach(function (cat, i) {
      var b = el('button', 'art-chip' + (i === 0 ? ' on' : ''), cat);
      b.addEventListener('click', function () {
        filters.querySelectorAll('.art-chip').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        grid.querySelectorAll('.art-row').forEach(function (c) {
          var show = cat === 'All' || c.getAttribute('data-cat') === cat;
          c.classList.toggle('art-hide', !show);
        });
      });
      filters.appendChild(b);
    });
  }

  /* ---------------- reader ---------------- */
  var reader = document.getElementById('artReader');
  var readerBody = document.getElementById('artReaderBody');
  var lastFocus = null;

  function blocks(list) {
    return list.map(function (b) {
      if (b.h) return '<h3>' + b.h + '</h3>';
      if (b.q) return '<blockquote>' + b.q + '</blockquote>';
      if (b.ul) return '<ul>' + b.ul.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
      return '<p>' + b.p + '</p>';
    }).join('');
  }

  function open(a) {
    if (!reader || !readerBody) return;
    lastFocus = document.activeElement;
    readerBody.style.setProperty('--c', a.accent);
    readerBody.innerHTML =
      '<header class="ar-head">' +
        '<span class="ar-mark" aria-hidden="true"><svg viewBox="0 0 24 24">' + a.glyph + '</svg></span>' +
        '<p class="ar-meta"><em>' + a.cat + '</em><i></i>' + a.dateLabel + '<i></i>' + a.read + ' min read</p>' +
        '<h2>' + a.title + '</h2>' +
        '<p class="ar-deck">' + a.deck + '</p>' +
        '<div class="ar-byline">STAIR Digital &middot; AI Intelligence Briefing</div>' +
      '</header>' +
      '<div class="ar-copy">' + blocks(a.body) + '</div>';

    /* the print sheet is built from the same data, on the STAIR letterhead */
    var sheet = document.getElementById('artPrintBody');
    if (sheet) {
      sheet.innerHTML =
        '<p class="ap-kicker">AI Intelligence Briefing &middot; ' + a.dateLabel + '</p>' +
        '<h1>' + a.title + '</h1>' +
        '<p class="ap-deck">' + a.deck + '</p>' +
        '<div class="ap-copy">' + blocks(a.body) + '</div>';
    }

    reader.classList.add('open');
    reader.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
    readerBody.scrollTop = 0;
    var x = reader.querySelector('.ar-x');
    if (x) x.focus();
  }

  function close() {
    if (!reader) return;
    reader.classList.remove('open');
    reader.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (window.__lenis && window.__lenis.start) window.__lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (reader) {
    reader.querySelectorAll('[data-arclose]').forEach(function (b) {
      b.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && reader.classList.contains('open')) close();
    });
    var dl = document.getElementById('artDownload');
    if (dl) dl.addEventListener('click', function () { window.print(); });
  }
})();
