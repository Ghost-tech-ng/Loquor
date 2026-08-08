// The Arena corpus. 60 seeded topics, half from the user's field and half from
// everywhere else — "no knowledge is wasted".
//
// Each topic is phrased as a question someone would actually ask in a room, not
// an essay title, because the drill is answering a person rather than writing.
//
// The primer is three bullets: enough to have a position after sixty seconds of
// reading, deliberately not enough to recite. That gap is the point — the skill
// being trained is speaking on something you half-know, which is the situation
// that produces filler words in real meetings.
//
// loadedTerms are the words to deploy in the answer. They are the bridge to the
// Lexicon pillar in Phase 2: useful register a strong speaker reaches for and
// most people never quite do.

export type Topic = {
  id: string;
  title: string;
  domain: "field" | "random";
  primer: string[];
  loadedTerms: string[];
};

export const TOPICS: Topic[] = [
  // ---------------------------------------------------------------- field
  {
    id: "f01",
    title: "Should engineering teams own their own on-call budget?",
    domain: "field",
    primer: [
      "Teams that carry the pager for their own services ship more defensively — the incentive lands on the people who make the design calls.",
      "The counter: on-call is a tax paid disproportionately by whoever owns the oldest, ugliest service, which is rarely who caused the mess.",
      "Google's SRE model caps toil at 50% and lets a team hand the pager back if error budgets are blown — accountability with an exit.",
    ],
    loadedTerms: ["incentive", "accountability", "downstream", "in-house"],
  },
  {
    id: "f02",
    title: "When is a monolith the right answer in 2026?",
    domain: "field",
    primer: [
      "Microservices trade a hard problem you can debug (a big codebase) for a hard problem you cannot (a distributed system).",
      "The honest threshold is organisational, not technical: services help when teams need to deploy independently.",
      "Shopify and Stack Overflow run enormous modular monoliths. Scale alone does not force the split.",
    ],
    loadedTerms: ["premature", "coupling", "threshold", "modular"],
  },
  {
    id: "f03",
    title: "Is technical debt a useful metaphor or an excuse?",
    domain: "field",
    primer: [
      "Ward Cunningham's original meaning was deliberate: ship now, knowing you will pay interest, and refactor once you understand the domain.",
      "In practice the word now covers ordinary bad code, which lets teams describe carelessness as a financing decision.",
      "The distinction that survives: debt you took on purpose and can name, versus mess you accumulated and cannot.",
    ],
    loadedTerms: ["deliberate", "compounding", "conflate", "precedent"],
  },
  {
    id: "f04",
    title: "How would you evaluate an LLM feature before shipping it?",
    domain: "field",
    primer: [
      "Vibes do not survive contact with production. You need a fixed eval set with expected outputs before you touch the prompt.",
      "LLM-as-judge is cheap and correlates well, but it drifts with model versions — pin the judge model or the baseline moves under you.",
      "The metric that matters is usually not accuracy but the cost of the worst failure and how visible it is to the user.",
    ],
    loadedTerms: ["baseline", "regression", "calibrate", "failure mode"],
  },
  {
    id: "f05",
    title: "RAG or fine-tuning — how do you decide?",
    domain: "field",
    primer: [
      "Rough rule: retrieval for knowledge that changes, fine-tuning for behaviour and format that does not.",
      "Fine-tuning does not reliably add facts; it shifts style and structure. Teams that reach for it to inject knowledge usually end up back at retrieval.",
      "Retrieval fails loudly and is debuggable — you can read the chunks. A fine-tune fails silently.",
    ],
    loadedTerms: ["retrieval", "provenance", "brittle", "in practice"],
  },
  {
    id: "f06",
    title: "Build or buy — what actually decides it?",
    domain: "field",
    primer: [
      "Build what is your differentiator; buy what is table stakes. The hard part is being honest about which is which.",
      "The real cost of buying is integration and lock-in; the real cost of building is the maintenance nobody budgets for.",
      "A useful test: if this vendor doubled its price tomorrow, what would we do? If the answer is 'pay it', that is the risk.",
    ],
    loadedTerms: ["differentiator", "lock-in", "total cost", "contingency"],
  },
  {
    id: "f07",
    title: "What makes a postmortem actually blameless?",
    domain: "field",
    primer: [
      "Blameless does not mean no accountability — it means the analysis targets the system that let a reasonable person make that mistake.",
      "Counterfactual language ('he should have checked') is the tell. It describes a world that did not happen instead of the one that did.",
      "The output is a small number of committed action items with owners. A postmortem with twenty recommendations produces zero.",
    ],
    loadedTerms: ["counterfactual", "systemic", "proximate cause", "mandate"],
  },
  {
    id: "f08",
    title: "What does a good code review culture look like?",
    domain: "field",
    primer: [
      "The bottleneck is almost always review latency, not review quality. A day of waiting costs more than most comments save.",
      "Separate blocking from non-blocking explicitly — 'nit:' as a convention removes an enormous amount of friction.",
      "Reviews are where architectural norms actually propagate. It is the highest-leverage teaching surface a team has.",
    ],
    loadedTerms: ["latency", "convention", "leverage", "norms"],
  },
  {
    id: "f09",
    title: "Why are software estimates so consistently wrong?",
    domain: "field",
    primer: [
      "The planning fallacy is robust: people estimate the median path and are surprised by the tail every single time.",
      "Estimates are also a negotiation, not a forecast — the number given is shaped by what the asker wants to hear.",
      "Ranges with confidence levels survive contact with reality better than points, but organisations keep asking for points.",
    ],
    loadedTerms: ["fallacy", "in aggregate", "hedge", "forecast"],
  },
  {
    id: "f10",
    title: "When does a company need a platform team?",
    domain: "field",
    primer: [
      "Too early and you build abstractions for use cases that never appear; too late and every team solves deployment differently.",
      "The signal is duplication with divergence — five teams solving the same problem five incompatible ways.",
      "Platform teams fail when they mandate rather than attract. If people route around you, the product is bad.",
    ],
    loadedTerms: ["abstraction", "divergence", "adoption", "mandate"],
  },
  {
    id: "f11",
    title: "What is the difference between monitoring and observability?",
    domain: "field",
    primer: [
      "Monitoring answers questions you thought of in advance. Observability lets you ask new ones without shipping code.",
      "The practical difference is high-cardinality data — being able to slice by user id or request id after the fact.",
      "Most teams have plenty of dashboards and still cannot answer 'why is this one customer slow?'",
    ],
    loadedTerms: ["cardinality", "after the fact", "instrument", "granular"],
  },
  {
    id: "f12",
    title: "Are feature flags a safety net or a source of debt?",
    domain: "field",
    primer: [
      "They decouple deploy from release, which is genuinely transformative for risk.",
      "They also multiply code paths combinatorially — a codebase with 40 live flags has no testable state.",
      "The discipline is expiry: every flag gets an owner and a removal date at creation, or it is permanent.",
    ],
    loadedTerms: ["decouple", "combinatorial", "discipline", "by default"],
  },
  {
    id: "f13",
    title: "Postgres for everything — reasonable default or laziness?",
    domain: "field",
    primer: [
      "Postgres now credibly covers relational, JSON, full-text, queues, and vectors. One operational surface is a real advantage.",
      "The counter: 'good enough at everything' becomes the bottleneck at scale, and by then migration is expensive.",
      "Operational familiarity usually beats theoretical fit. The database you can debug at 3am is the right one.",
    ],
    loadedTerms: ["operational", "default", "fit for purpose", "in-house"],
  },
  {
    id: "f14",
    title: "When is caching the wrong fix?",
    domain: "field",
    primer: [
      "A cache in front of a slow query hides the problem and adds invalidation, which is genuinely one of the hard problems.",
      "It also converts a consistent system into an eventually consistent one, usually without anyone deciding to.",
      "Cache when the underlying work is genuinely expensive and the data tolerates staleness. Otherwise fix the query.",
    ],
    loadedTerms: ["invalidation", "staleness", "mask", "tolerance"],
  },
  {
    id: "f15",
    title: "How should an API handle breaking changes?",
    domain: "field",
    primer: [
      "Versioning in the URL is crude but legible; header negotiation is elegant and nobody uses it correctly.",
      "Stripe's approach — pin each customer to the version they joined on, and translate forward — is expensive and beloved.",
      "The real question is who absorbs the cost of change: you, once, or every consumer, repeatedly.",
    ],
    loadedTerms: ["backward compatible", "absorb", "deprecate", "consumer"],
  },
  {
    id: "f16",
    title: "Does lowering the hiring bar ever make sense?",
    domain: "field",
    primer: [
      "The standard argument says a bad hire costs more than a missed one — but that assumes you can measure either.",
      "Interview signal is weak and expensive; most processes optimise for false-negative avoidance nobody measures.",
      "Teams with strong onboarding can hire on trajectory rather than current skill and consistently beat the bar-raisers.",
    ],
    loadedTerms: ["signal", "trajectory", "false negative", "in hindsight"],
  },
  {
    id: "f17",
    title: "What do AI coding assistants do to junior engineers?",
    domain: "field",
    primer: [
      "They compress the time to a working solution and expand the gap between working and understood.",
      "Juniors historically learned by struggling through the middle. If the middle disappears, the learning path has to be rebuilt deliberately.",
      "The optimistic read: reading and judging code is now the core skill, and that was always the more valuable one.",
    ],
    loadedTerms: ["compress", "deliberate", "in the long run", "displace"],
  },
  {
    id: "f18",
    title: "How do you defend an app against prompt injection?",
    domain: "field",
    primer: [
      "There is no reliable filter. Instructions and data share a channel, which is the same class of problem as SQL injection but without the parameterised query.",
      "The workable defence is architectural: assume the model is compromised and constrain what it is permitted to do.",
      "Treat model output as untrusted user input at every boundary, especially before it reaches a tool with side effects.",
    ],
    loadedTerms: ["boundary", "least privilege", "assume", "side effect"],
  },
  {
    id: "f19",
    title: "Is inference cost a real constraint or a temporary one?",
    domain: "field",
    primer: [
      "Cost per token has fallen roughly an order of magnitude a year, which makes today's optimisation tomorrow's dead code.",
      "But demand expands to fill it — agents make many more calls than chat did, so the bill does not actually fall.",
      "The durable question is not cost per token but cost per resolved task, which is where most teams have no instrumentation at all.",
    ],
    loadedTerms: ["order of magnitude", "elastic", "durable", "per unit"],
  },
  {
    id: "f20",
    title: "What does patient data privacy actually require of an AI product?",
    domain: "field",
    primer: [
      "De-identification is weaker than it sounds — re-identification from a few quasi-identifiers is well documented.",
      "The safest architecture keeps identifiable data out of the model's context entirely rather than trusting a redaction step.",
      "Consent for treatment is not consent for training. Conflating them is the mistake that ends products.",
    ],
    loadedTerms: ["consent", "conflate", "quasi-identifier", "by design"],
  },
  {
    id: "f21",
    title: "How do you set a latency budget for a user-facing feature?",
    domain: "field",
    primer: [
      "Start from perception: about 100ms feels instant, one second keeps flow, ten seconds loses attention entirely.",
      "Budget the whole chain and allocate, rather than optimising whichever stage you happen to be looking at.",
      "Tail latency is the real experience. A good p50 with a terrible p99 means a portion of users always have a bad time.",
    ],
    loadedTerms: ["perception", "allocate", "tail", "budget"],
  },
  {
    id: "f22",
    title: "What is the right testing strategy for a small team?",
    domain: "field",
    primer: [
      "The pyramid says many unit tests, few end-to-end. The trophy says the opposite weighting toward integration, and for web work it holds up better.",
      "Coverage is a proxy that becomes a target immediately, at which point it stops measuring anything.",
      "The question worth asking per test: what bug would this have caught in the last year?",
    ],
    loadedTerms: ["proxy", "weighting", "in practice", "diminishing returns"],
  },
  {
    id: "f23",
    title: "Big-bang migration or strangler fig?",
    domain: "field",
    primer: [
      "Incremental migration is almost always right and almost always takes longer than the big bang would have, if the big bang had worked.",
      "The strangler pattern needs a seam — a routing layer where old and new can coexist. No seam, no incrementalism.",
      "Long migrations die politically, not technically: two systems running for two years exhausts everyone's patience.",
    ],
    loadedTerms: ["incremental", "seam", "coexist", "attrition"],
  },
  {
    id: "f24",
    title: "Why does documentation always rot?",
    domain: "field",
    primer: [
      "It rots because it is not executed. Anything not verified by a machine drifts from reality at the speed of commits.",
      "The counter-move is making docs executable — tests, types, generated references — and writing prose only for the why.",
      "The why is the part that never rots and the part nobody writes down.",
    ],
    loadedTerms: ["drift", "verify", "rationale", "durable"],
  },
  {
    id: "f25",
    title: "Who should decide incident severity — and when?",
    domain: "field",
    primer: [
      "Deciding severity mid-incident invites motivated reasoning: nobody wants to declare the sev-1 that wakes the VP.",
      "Pre-agreed, mechanical criteria remove the judgement call at exactly the moment judgement is worst.",
      "Over-declaring is cheap and under-declaring is catastrophic, so the asymmetry should be encoded in the thresholds.",
    ],
    loadedTerms: ["asymmetry", "motivated reasoning", "threshold", "escalate"],
  },
  {
    id: "f26",
    title: "How much vendor lock-in is acceptable?",
    domain: "field",
    primer: [
      "Every abstraction layer built to avoid lock-in is itself a thing you now maintain, and it usually leaks anyway.",
      "The pragmatic position: accept lock-in where switching is cheap or the service is genuinely commodity; resist it where your data lives.",
      "Ask what the exit actually costs in weeks. If nobody has estimated it, that is the finding.",
    ],
    loadedTerms: ["commodity", "leaky", "exit cost", "pragmatic"],
  },
  {
    id: "f27",
    title: "How do you know a deployed model has gone stale?",
    domain: "field",
    primer: [
      "Input drift is detectable without labels; performance decay usually is not, which is why teams notice late.",
      "The cheapest signal is often downstream behaviour — override rates, retries, abandonment — rather than the model's own metrics.",
      "A model without a monitored proxy metric is a model nobody will notice failing until a customer does.",
    ],
    loadedTerms: ["drift", "proxy", "decay", "downstream"],
  },
  {
    id: "f28",
    title: "Should engineering default to async or synchronous communication?",
    domain: "field",
    primer: [
      "Async scales across time zones and produces a written record, which compounds. It is also slower to resolve ambiguity.",
      "Synchronous is expensive per participant but unmatched for anything with genuine disagreement in it.",
      "A usable rule: async by default, sync when the thread has gone three rounds without converging.",
    ],
    loadedTerms: ["compounds", "converge", "by default", "ambiguity"],
  },
  {
    id: "f29",
    title: "When is a rewrite genuinely the right call?",
    domain: "field",
    primer: [
      "Spolsky's argument still lands: the old code contains years of bug fixes that look like ugliness and are actually knowledge.",
      "Rewrites are justified when the constraint is architectural rather than cosmetic — you cannot refactor your way to a different data model.",
      "The decisive question is whether you can ship the rewrite incrementally. If not, the risk is usually unacceptable.",
    ],
    loadedTerms: ["architectural", "accrued", "incremental", "in hindsight"],
  },
  {
    id: "f30",
    title: "Can developer productivity be measured at all?",
    domain: "field",
    primer: [
      "DORA's four metrics measure the delivery system, not individuals, and that distinction is the whole value.",
      "Any individual metric becomes a target and then a game — lines, commits, story points, all of it.",
      "The most useful available signal is self-reported friction, which feels unrigorous and predicts a great deal.",
    ],
    loadedTerms: ["proxy", "gameable", "aggregate", "friction"],
  },

  // --------------------------------------------------------------- random
  {
    id: "r01",
    title: "Would a four-day week actually work?",
    domain: "random",
    primer: [
      "The UK 2022 trial: 92% of participating companies continued, revenue broadly flat, attrition and sick days down.",
      "Selection bias is severe — firms that volunteer for this are already the ones it could work for.",
      "It transfers cleanly to knowledge work with slack in it and badly to anything where output is a linear function of hours.",
    ],
    loadedTerms: ["selection bias", "attrition", "linear", "transfer"],
  },
  {
    id: "r02",
    title: "Has remote work settled the debate or just moved it?",
    domain: "random",
    primer: [
      "Measured productivity holds up; the contested losses are in mentorship, weak ties, and serendipity — all slow-moving and hard to attribute.",
      "Hybrid mandates are often about property costs and control, and are argued on collaboration grounds.",
      "The distributional point: remote is worth most to caregivers and people far from expensive cities, which is rarely who decides.",
    ],
    loadedTerms: ["weak ties", "attribute", "distributional", "mandate"],
  },
  {
    id: "r03",
    title: "Does congestion pricing work?",
    domain: "random",
    primer: [
      "London, Stockholm, Singapore all show real traffic reductions that persisted rather than decaying.",
      "Stockholm's trial is the striking case: public opinion was against it before and in favour after, once people experienced it.",
      "The regressive objection is real and answerable — it depends entirely on what the revenue funds.",
    ],
    loadedTerms: ["regressive", "persisted", "revenue-neutral", "elasticity"],
  },
  {
    id: "r04",
    title: "Is universal basic income a serious policy or a thought experiment?",
    domain: "random",
    primer: [
      "Pilots consistently fail to show the predicted collapse in work, but pilots are time-limited and everyone knows it.",
      "The financing question is the real one: at any meaningful level it is a very large share of GDP.",
      "The strongest version of the case is administrative — it replaces a means-tested apparatus that costs a fortune to run and humiliates people.",
    ],
    loadedTerms: ["means-tested", "at scale", "administrative", "the strong version"],
  },
  {
    id: "r05",
    title: "Should nuclear be part of the transition?",
    domain: "random",
    primer: [
      "Lifecycle emissions are comparable to wind. The objections that survive are cost and construction time, not carbon.",
      "Western build costs have risen while solar has collapsed, so the economic case has genuinely weakened.",
      "The steel-man is dispatchability: firm baseload that does not depend on weather or storage that does not yet exist at scale.",
    ],
    loadedTerms: ["lifecycle", "dispatchable", "steel-man", "at scale"],
  },
  {
    id: "r06",
    title: "Has analytics made sport better or worse to watch?",
    domain: "random",
    primer: [
      "Optimisation converges on a dominant strategy — the NBA three-point explosion is the clearest case.",
      "Homogenised play is the cost; more competent play is the benefit, and fans disagree on the exchange rate.",
      "Leagues respond by changing rules to re-open the strategy space, which is an interesting admission.",
    ],
    loadedTerms: ["converge", "homogenise", "dominant strategy", "trade-off"],
  },
  {
    id: "r07",
    title: "Should societies go cashless?",
    domain: "random",
    primer: [
      "Sweden is nearly there and has had to legislate to protect cash access for the elderly and rural.",
      "Cash is the only payment rail that works when the power is out and the only one that is anonymous by default.",
      "Card fees are a regressive tax paid by merchants and passed to everyone, including those paying cash.",
    ],
    loadedTerms: ["rail", "regressive", "by default", "resilience"],
  },
  {
    id: "r08",
    title: "Why do airlines overbook?",
    domain: "random",
    primer: [
      "No-show rates are stable and predictable in aggregate, so an empty seat is guaranteed lost revenue.",
      "The mechanism improved dramatically when they moved from bumping people to auctioning the seat back — a genuine economics-to-policy success.",
      "It is a clean illustration of pricing a small probability of a large inconvenience.",
    ],
    loadedTerms: ["in aggregate", "auction", "expected value", "mechanism"],
  },
  {
    id: "r09",
    title: "What is insurance actually selling?",
    domain: "random",
    primer: [
      "It converts a small chance of ruin into a certain small cost. The buyer knowingly pays above expected value for that.",
      "It only functions when risks are uncorrelated — which is exactly why climate and pandemic risk break the model.",
      "Adverse selection and moral hazard are the two failure modes, and most policy design is aimed at one or the other.",
    ],
    loadedTerms: ["uncorrelated", "adverse selection", "moral hazard", "expected value"],
  },
  {
    id: "r10",
    title: "How worried should we be about antibiotic resistance?",
    domain: "random",
    primer: [
      "Resistance is evolution operating on a very short generation time — it is not preventable, only slowable.",
      "The market is broken in an unusual way: a valuable new antibiotic should be used as little as possible, so nobody can fund developing one.",
      "Agricultural use dwarfs clinical use in volume, which makes this a farming policy question as much as a medical one.",
    ],
    loadedTerms: ["selection pressure", "market failure", "dwarf", "incentive"],
  },
  {
    id: "r11",
    title: "Is housing scarcity a supply problem or a demand problem?",
    domain: "random",
    primer: [
      "The supply-side case is strong in expensive cities: constrained permitting, decades of underbuilding.",
      "The counter points at treating housing as an investment asset — which changes who builds what, and for whom.",
      "Both can be true. Supply sets the level; financialisation shapes the distribution.",
    ],
    loadedTerms: ["constrained", "financialisation", "distribution", "both can be true"],
  },
  {
    id: "r12",
    title: "Did just-in-time supply chains turn out to be a mistake?",
    domain: "random",
    primer: [
      "JIT optimised working capital brilliantly for forty years, then failed badly under a correlated global shock.",
      "The lesson is not 'hold more inventory' but 'know which single points of failure you have', which is harder and less popular.",
      "Efficiency and resilience are genuinely in tension. You cannot have the maximum of both.",
    ],
    loadedTerms: ["in tension", "single point of failure", "correlated", "buffer"],
  },
  {
    id: "r13",
    title: "Why does Hollywood make so many sequels?",
    domain: "random",
    primer: [
      "Marketing cost is the binding constraint, and a known title is pre-marketed — the economics, not the creativity, drive it.",
      "The tentpole model makes losses catastrophic, so variance reduction dominates decision-making.",
      "Streaming changed the calculus again: retention beats opening weekend, which favours series over films.",
    ],
    loadedTerms: ["binding constraint", "variance", "calculus", "risk-averse"],
  },
  {
    id: "r14",
    title: "Is the attention economy a market failure?",
    domain: "random",
    primer: [
      "When the product is free the user is the inventory, and the optimisation target is time rather than benefit.",
      "The externality is diffuse and delayed, which is exactly the profile regulation handles worst.",
      "The strongest counter is paternalism: adults choosing how to spend attention is not obviously a failure at all.",
    ],
    loadedTerms: ["externality", "diffuse", "paternalism", "optimisation target"],
  },
  {
    id: "r15",
    title: "How do interest rates actually reach the real economy?",
    domain: "random",
    primer: [
      "Transmission runs through borrowing cost, asset prices, currency, and expectations — with long and variable lags.",
      "The lag is the reason central banks look like they are always overshooting: they are steering on old data.",
      "Rates hit long-duration assets hardest, which is why startups feel it before anyone else does.",
    ],
    loadedTerms: ["transmission", "lag", "duration", "expectations"],
  },
  {
    id: "r16",
    title: "Are carbon offsets worth anything?",
    domain: "random",
    primer: [
      "Additionality is the whole question — would this have happened anyway? Investigations have found large fractions of forestry credits fail it.",
      "Permanence is the second problem: a forest that burns in 2040 releases carbon sold as permanently stored.",
      "Removals with measurable permanence are defensible; avoided-emissions credits mostly are not.",
    ],
    loadedTerms: ["additionality", "permanence", "verifiable", "in principle"],
  },
  {
    id: "r17",
    title: "Does vertical farming make sense?",
    domain: "random",
    primer: [
      "It substitutes cheap sunlight for expensive electricity, so the economics only work where the crop is high-value and perishable.",
      "That is why it is leafy greens and herbs, not staples — and why several well-funded companies have failed.",
      "The genuine wins are water use and proximity to market, not calories per hectare.",
    ],
    loadedTerms: ["substitute", "high-value", "proximity", "unit economics"],
  },
  {
    id: "r18",
    title: "Is sleep debt real?",
    domain: "random",
    primer: [
      "Recovery is partial — one long weekend does not undo a week of restriction, though it helps more than nothing.",
      "Self-assessed impairment degrades faster than actual performance, so tired people reliably think they are fine.",
      "Consistency of timing seems to matter about as much as total duration, which most advice underweights.",
    ],
    loadedTerms: ["partial", "impairment", "underweight", "consistency"],
  },
  {
    id: "r19",
    title: "Why do placebos work?",
    domain: "random",
    primer: [
      "Expectation genuinely changes reported outcomes and some measurable ones — pain and nausea especially.",
      "Much of the apparent effect is regression to the mean: people enrol at their worst and would improve anyway.",
      "Open-label placebos still show effects, which is the finding that makes the pure-deception explanation insufficient.",
    ],
    loadedTerms: ["regression to the mean", "expectation", "insufficient", "measurable"],
  },
  {
    id: "r20",
    title: "What did chess engines do to human chess?",
    domain: "random",
    primer: [
      "Preparation depth exploded and top-level draw rates rose — the game got more solved at the elite level.",
      "But engine training also made mid-tier players dramatically stronger than their equivalents thirty years ago.",
      "The near-universal template for AI in a domain: elite play converges, the floor rises sharply.",
    ],
    loadedTerms: ["converge", "the floor", "template", "depth"],
  },
  {
    id: "r21",
    title: "Should tipping be abolished?",
    domain: "random",
    primer: [
      "Tip amounts correlate weakly with service quality and measurably with race and attractiveness, which undermines the stated rationale.",
      "Restaurants that moved to service-included have often reverted — customers read the higher menu prices as expensive.",
      "It persists because it shifts wage risk from owner to worker and is invisible on the menu.",
    ],
    loadedTerms: ["rationale", "revert", "shift risk", "correlate"],
  },
  {
    id: "r22",
    title: "Do patents encourage innovation?",
    domain: "random",
    primer: [
      "The bargain is disclosure in exchange for monopoly. It works well where R&D is expensive and copying is trivial — pharma is the clear case.",
      "In software it works badly: short product cycles, obvious claims, and a thicket that mostly funds litigation.",
      "The evidence for a general innovation boost is much weaker than the institution's prominence suggests.",
    ],
    loadedTerms: ["bargain", "thicket", "prominence", "sector-specific"],
  },
  {
    id: "r23",
    title: "Do economic sanctions achieve anything?",
    domain: "random",
    primer: [
      "The historical hit rate on changing regime behaviour is low; the harm to civilians is reliable.",
      "Targeted financial sanctions perform better than broad trade embargoes, which mostly build black markets.",
      "The under-discussed function is signalling — to allies and domestic audiences, rather than to the target at all.",
    ],
    loadedTerms: ["hit rate", "targeted", "signalling", "second-order"],
  },
  {
    id: "r24",
    title: "Is water scarcity a supply problem?",
    domain: "random",
    primer: [
      "Agriculture is roughly 70% of freshwater use, so household conservation is nearly a rounding error.",
      "Water is chronically underpriced, which is precisely why it is over-used — the scarcity is largely constructed.",
      "Desalination is now viable for cities and still far too expensive for farming, which is where the demand actually is.",
    ],
    loadedTerms: ["rounding error", "underpriced", "constructed", "viable"],
  },
  {
    id: "r25",
    title: "Are behavioural nudges a legitimate tool of government?",
    domain: "random",
    primer: [
      "Defaults are extraordinarily powerful — organ donation opt-out rates are the canonical demonstration.",
      "There is no neutral choice architecture, so 'do not nudge' is not actually available as an option.",
      "The honest objection is not manipulation but scale: nudges have been used where a policy change was needed and avoided.",
    ],
    loadedTerms: ["default", "choice architecture", "canonical", "substitute for"],
  },
  {
    id: "r26",
    title: "Why do musicians make so little from streaming?",
    domain: "random",
    primer: [
      "The pro-rata pool pays out by share of total plays, so a subscriber's money mostly goes to whoever is globally popular.",
      "User-centric payment would redirect it to what each person actually listens to — modelled repeatedly, adopted rarely.",
      "Labels hold the leverage in the negotiation, and artist contracts predate streaming entirely.",
    ],
    loadedTerms: ["pro-rata", "leverage", "redirect", "predate"],
  },
  {
    id: "r27",
    title: "Will lab-grown meat ever be competitive?",
    domain: "random",
    primer: [
      "The scaling problem is bioreactor cost and contamination risk, not the science of growing cells.",
      "Plant-based products already compete on cost and have hit a ceiling on taste and cultural resistance instead.",
      "Regulatory approval has arrived in several markets while production volumes remain effectively zero — approval was never the constraint.",
    ],
    loadedTerms: ["scaling", "ceiling", "the constraint", "cost curve"],
  },
  {
    id: "r28",
    title: "Are gig workers employees?",
    domain: "random",
    primer: [
      "The legal test is control — who sets price, allocation, and standards. On that test most platforms look like employers.",
      "Workers consistently value the flexibility, and the binary employee/contractor split does not accommodate it.",
      "Several countries have created a third category, which mostly produced a new boundary to litigate.",
    ],
    loadedTerms: ["control test", "binary", "accommodate", "boundary"],
  },
  {
    id: "r29",
    title: "Where does survivorship bias hide?",
    domain: "random",
    primer: [
      "Wald's bombers is the canonical example: armour where the returning planes are not hit, because those are the fatal spots.",
      "Business advice is almost entirely survivorship bias — the failures did the same things and are not available to interview.",
      "The general move is to ask what data would be missing if the hypothesis were false.",
    ],
    loadedTerms: ["canonical", "absent", "the general move", "falsify"],
  },
  {
    id: "r30",
    title: "Why are startups so sensitive to interest rates?",
    domain: "random",
    primer: [
      "Their value is nearly all in distant cash flows, and discounting hits distant flows hardest — the same maths as long-duration bonds.",
      "The second channel is the LP allocation decision: when safe assets pay well, illiquid venture looks much less attractive.",
      "So the effect arrives twice, and the second wave lags the first by a year or more.",
    ],
    loadedTerms: ["duration", "discount", "allocation", "lag"],
  },
];

export const TOPICS_BY_ID: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.id, t]));

/**
 * Picks today's topic. Unseen topics first; alternates domain against the last
 * session so the field/random mix stays honest rather than drifting toward
 * whichever the user finds comfortable. Deterministic per day, so opening the
 * app twice does not reroll the prompt — that would turn a commitment into a
 * slot machine.
 */
export function pickTopic(args: { usedIds: string[]; lastDomain?: Topic["domain"]; date?: Date }): Topic {
  const used = new Set(args.usedIds);
  const wanted: Topic["domain"] = args.lastDomain === "field" ? "random" : "field";

  const pools = [
    TOPICS.filter((t) => !used.has(t.id) && t.domain === wanted),
    TOPICS.filter((t) => !used.has(t.id)),
    TOPICS.filter((t) => t.domain === wanted),
    TOPICS,
  ];
  const pool = pools.find((p) => p.length > 0) ?? TOPICS;

  const d = args.date ?? new Date();
  const dayIndex = Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000
  );
  return pool[dayIndex % pool.length]!;
}
