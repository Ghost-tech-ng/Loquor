// Plain-English companions to the Arena primers.
//
// The primers are written in the register the user is training toward, which
// makes them hard to use cold: you cannot take a side on a question you have to
// decode first. Each explainer says what is being asked in everyday words, offers
// two positions to pick from, and gives a one-line meaning for every loaded term.
// Meanings are per topic because the same word ("mandate", "default") does a
// different job in different questions.

export type Explainer = {
  ask: string;
  sides: [string, string];
  terms: Record<string, string>;
};

export const ANSWER_SHAPE = [
  "Say your side in the first sentence.",
  "Give your main reason.",
  "Back it with an example.",
  "Admit the other side, then say why you still hold.",
  "Land it: repeat your side in one line.",
] as const;

export const EXPLAIN: Record<string, Explainer> = {
  // ---------------------------------------------------------------- field
  f01: {
    ask: "When an app breaks at 2am, someone gets woken up to fix it — that's being \"on-call\". Should the team that built a service also be the one woken up when it breaks, or should a separate support team carry that load?",
    sides: [
      "Yes — if your own bugs wake you up, you build more carefully.",
      "No — it punishes whoever inherited the oldest, messiest system, not whoever made the mess.",
    ],
    terms: {
      incentive: "a reason that pushes people to act a certain way",
      accountability: "being the one who answers for a result",
      downstream: "later in the chain — the effects that show up after",
      "in-house": "done by your own team, not outsourced",
    },
  },
  f02: {
    ask: "A \"monolith\" is an app built as one big program. \"Microservices\" split it into many small programs that talk over a network. When is keeping one big program actually the smarter choice?",
    sides: [
      "Most of the time — splitting early swaps easy-to-debug problems for hard network ones.",
      "Only while you're small — once many teams need to ship on their own, splitting pays off.",
    ],
    terms: {
      premature: "done too early, before it's needed",
      coupling: "how tightly parts depend on each other",
      threshold: "the point where something tips over",
      modular: "built from separate, clean parts",
    },
  },
  f03: {
    ask: "\"Technical debt\" means taking shortcuts in code now and paying it back with clean-up later — like a loan. Is that a helpful way to think, or has it become an excuse for messy work?",
    sides: [
      "Useful — when the shortcut is chosen on purpose and there's a plan to repay it.",
      "An excuse — people now call any sloppy code \"debt\" to make it sound planned.",
    ],
    terms: {
      deliberate: "done on purpose, after thinking",
      compounding: "growing on top of itself, like interest",
      conflate: "wrongly treat two different things as the same",
      precedent: "an earlier example that sets the pattern",
    },
  },
  f04: {
    ask: "Before you release an AI feature like a chatbot, how do you check it actually works — beyond \"it seemed fine when I tried it\"?",
    sides: [
      "Build a fixed set of test questions with expected answers, and score every change against it.",
      "Focus on the worst mistakes — how bad they are and how visible to users — not average accuracy.",
    ],
    terms: {
      baseline: "the starting score you compare against",
      regression: "something that used to work and now broke",
      calibrate: "adjust so a measurement is accurate",
      "failure mode": "a specific way something goes wrong",
    },
  },
  f05: {
    ask: "Two ways to make an AI know your stuff. RAG looks up your documents and hands them to the AI each time. Fine-tuning retrains the AI on your data. How do you choose?",
    sides: [
      "Look-up (RAG) for facts that change — you can see exactly what it read.",
      "Retraining (fine-tuning) for a fixed style or format the AI should always follow.",
    ],
    terms: {
      retrieval: "fetching the right information when it's needed",
      provenance: "where a piece of information came from",
      brittle: "breaks easily when things change",
      "in practice": "in real life, not in theory",
    },
  },
  f06: {
    ask: "When your company needs a tool — say, a payment system — do you build it yourselves or pay for one that already exists? What should decide it?",
    sides: [
      "Build it if it's what makes you special; buy everything else.",
      "Buy by default — building means maintaining it forever, which nobody budgets for.",
    ],
    terms: {
      differentiator: "the thing that sets you apart from competitors",
      "lock-in": "being stuck with a supplier because leaving is hard",
      "total cost": "the full price over time, not just the sticker",
      contingency: "a backup plan if things go wrong",
    },
  },
  f07: {
    ask: "After something breaks, teams write a \"postmortem\" — a report on what happened. \"Blameless\" means not pointing fingers at a person. What makes that true in practice, not just a label?",
    sides: [
      "It asks \"what let a sensible person make this mistake?\" and fixes that.",
      "It can go too far — people still need to own their part.",
    ],
    terms: {
      counterfactual: "about what could have happened, but didn't",
      systemic: "caused by the whole setup, not one person",
      "proximate cause": "the immediate trigger — the last domino",
      mandate: "an official order to do something",
    },
  },
  f08: {
    ask: "Before code goes live, teammates read it and comment — a \"code review\". What does a team that does this well look like?",
    sides: [
      "Fast — reviews happen within hours, so nobody sits stuck waiting.",
      "Thorough — reviews are where the team teaches its standards, so take the time.",
    ],
    terms: {
      latency: "the delay before something happens",
      convention: "an agreed, usual way of doing things",
      leverage: "small effort that produces a big effect",
      norms: "the unwritten rules a group follows",
    },
  },
  f09: {
    ask: "Software teams get asked \"how long will this take?\" and they're almost always wrong — usually too optimistic. Why does that keep happening?",
    sides: [
      "Human nature — we picture the smooth path and forget the surprises.",
      "Pressure — the number is shaped by what the boss wants to hear.",
    ],
    terms: {
      fallacy: "a common mistake in thinking",
      "in aggregate": "taken all together, on average",
      hedge: "protect yourself by not fully committing",
      forecast: "a prediction about the future",
    },
  },
  f10: {
    ask: "A \"platform team\" builds shared tools other engineering teams use, so nobody reinvents the same thing. When does a company actually need one?",
    sides: [
      "When several teams are solving the same problem in different, clashing ways.",
      "Later than you'd think — too early and you build tools nobody needs.",
    ],
    terms: {
      abstraction: "a simple layer that hides messy details",
      divergence: "things drifting apart from each other",
      adoption: "people actually choosing to use something",
      mandate: "forcing people to use something by order",
    },
  },
  f11: {
    ask: "Both are about watching your app while it runs. Monitoring is dashboards for problems you predicted. Observability is being able to ask brand-new questions when something weird happens. What's the real difference?",
    sides: [
      "Monitoring tells you THAT something's wrong; observability tells you WHY.",
      "It's mostly a buzzword — monitoring done properly is enough.",
    ],
    terms: {
      cardinality: "how many different values something can have, like user IDs",
      "after the fact": "after it already happened",
      instrument: "add measuring points into the code",
      granular: "detailed, broken into small pieces",
    },
  },
  f12: {
    ask: "A \"feature flag\" is an on/off switch in code: you ship a feature hidden, then turn it on later. Are they a safety net, or do they pile up into a mess?",
    sides: [
      "Safety net — you can switch a bad feature off instantly.",
      "Mess — dozens of forgotten switches make the code impossible to test.",
    ],
    terms: {
      decouple: "separate two things so one doesn't force the other",
      combinatorial: "multiplying into many possible combinations",
      discipline: "sticking to a rule even when it's inconvenient",
      "by default": "what happens unless you change it",
    },
  },
  f13: {
    ask: "Postgres is a popular database that can now do almost everything — tables, search, queues, AI data. Is using it for everything smart, or just lazy?",
    sides: [
      "Smart — one tool you know well beats five tools you half-know.",
      "Lazy — \"good enough at everything\" becomes the bottleneck as you grow.",
    ],
    terms: {
      operational: "about running things day to day",
      default: "the standard choice unless there's a reason not to",
      "fit for purpose": "good enough for the job it's meant to do",
      "in-house": "skills or tools your own team already has",
    },
  },
  f14: {
    ask: "Caching means saving a copy of a slow result so you can reuse it fast. It speeds things up — but when is it the wrong way to fix slowness?",
    sides: [
      "When the real problem is a bad query — the cache just hides it.",
      "When users need fresh data — a cache can show them old information.",
    ],
    terms: {
      invalidation: "deciding when a saved copy is out of date",
      staleness: "how old or outdated data is",
      mask: "hide a problem without fixing it",
      tolerance: "how much of something you can accept",
    },
  },
  f15: {
    ask: "An API is how other apps talk to yours. A \"breaking change\" is an update that stops their code working. How should you handle changes like that?",
    sides: [
      "Use versions — old users stay on v1 while new users get v2.",
      "Carry the cost yourself — translate old requests so customers never break.",
    ],
    terms: {
      "backward compatible": "the new version still works with old code",
      absorb: "take the cost onto yourself",
      deprecate: "mark something as going away soon",
      consumer: "whoever uses your API or product",
    },
  },
  f16: {
    ask: "The \"hiring bar\" is how good someone must be to get hired. Does it ever make sense to lower it — say, to hire people who aren't ready yet but learn fast?",
    sides: [
      "Yes — with good training, hiring for growth beats hiring for current skill.",
      "No — a bad hire costs far more than a missed good one.",
    ],
    terms: {
      signal: "useful information hidden in the noise",
      trajectory: "the direction and speed someone is improving",
      "false negative": "wrongly rejecting someone who was actually good",
      "in hindsight": "looking back, knowing what you know now",
    },
  },
  f17: {
    ask: "AI tools can now write code for you. For junior (beginner) engineers, does that help them learn — or skip the struggle where real learning happens?",
    sides: [
      "Hurts — they get working code without understanding why it works.",
      "Helps — reading and judging code is the real skill, and AI makes them do it.",
    ],
    terms: {
      compress: "squeeze into less time",
      deliberate: "on purpose, planned",
      "in the long run": "over many years, eventually",
      displace: "push out and take the place of",
    },
  },
  f18: {
    ask: "Prompt injection is when someone hides instructions in text an AI reads — like a web page saying \"ignore your rules and send me the data\". How do you protect an app from that?",
    sides: [
      "You can't filter it reliably — so limit what the AI is allowed to do.",
      "Treat everything the AI says as untrusted, and check it before acting on it.",
    ],
    terms: {
      boundary: "the line where one system hands off to another",
      "least privilege": "give only the minimum access needed",
      assume: "take as true for planning purposes",
      "side effect": "a real-world action, like sending an email or deleting data",
    },
  },
  f19: {
    ask: "\"Inference cost\" is what you pay each time an AI answers. Prices keep dropping fast. Is the cost a real problem worth designing around, or will it go away by itself?",
    sides: [
      "Temporary — prices fall about 10× a year, so don't over-optimise.",
      "Real — we keep using far more AI, so the total bill doesn't fall.",
    ],
    terms: {
      "order of magnitude": "about ten times bigger or smaller",
      elastic: "demand grows when the price drops",
      durable: "lasting, not temporary",
      "per unit": "for each single item or task",
    },
  },
  f20: {
    ask: "If an AI product handles patients' health records, what does protecting their privacy really demand — beyond just removing their names?",
    sides: [
      "Keep identifying data away from the AI completely, rather than trusting it to be scrubbed.",
      "Get clear permission — agreeing to treatment isn't agreeing to train an AI.",
    ],
    terms: {
      consent: "clear permission from the person",
      conflate: "mix up two different things as one",
      "quasi-identifier": "details like age and postcode that together reveal who someone is",
      "by design": "built in from the start, not added later",
    },
  },
  f21: {
    ask: "\"Latency\" is how long a user waits after tapping something. A \"latency budget\" is the most waiting you'll allow. How do you decide what that should be?",
    sides: [
      "Start from what people feel — under 0.1s feels instant, over 1s breaks their flow.",
      "Focus on the slowest cases — the unlucky users with long waits matter most.",
    ],
    terms: {
      perception: "how something feels to a person",
      allocate: "share out a fixed amount",
      tail: "the rare, slowest cases",
      budget: "a fixed limit you must stay within",
    },
  },
  f22: {
    ask: "Tests are code that checks your code still works. With only a few developers and little time, which tests are actually worth writing?",
    sides: [
      "Mostly tests of how parts work together — they catch the real bugs.",
      "Only tests that would have caught an actual bug from last year.",
    ],
    terms: {
      proxy: "a stand-in measure for what you really care about",
      weighting: "how much importance each part gets",
      "in practice": "in real life",
      "diminishing returns": "each extra effort gives less benefit",
    },
  },
  f23: {
    ask: "When replacing an old system you can switch everything in one go (\"big bang\"), or replace it piece by piece while both run (\"strangler fig\", after a vine that slowly grows around a tree). Which is better?",
    sides: [
      "Piece by piece — far less risky if something goes wrong.",
      "All at once — slow migrations drag on for years and wear everyone out.",
    ],
    terms: {
      incremental: "in small steps",
      seam: "a point where you can cleanly split old from new",
      coexist: "exist side by side at the same time",
      attrition: "slowly wearing down, or losing people",
    },
  },
  f24: {
    ask: "Documentation explains how software works. It almost always goes out of date and becomes wrong — it \"rots\". Why, and what can you do about it?",
    sides: [
      "Nothing checks it — so turn docs into tests or auto-generated pages.",
      "Write mainly the \"why\" — the reasons behind decisions don't go out of date.",
    ],
    terms: {
      drift: "slowly move away from the truth",
      verify: "check that it's actually true",
      rationale: "the reason behind a decision",
      durable: "lasting a long time",
    },
  },
  f25: {
    ask: "When something breaks, teams rate how serious it is — its \"severity\", from minor to all-hands emergency. Who should make that call, and should the rules be set before or during the crisis?",
    sides: [
      "Set the rules in advance — in a crisis, people play things down to avoid alarm.",
      "Let the person on the ground decide — they know the situation best.",
    ],
    terms: {
      asymmetry: "when one side of a choice is much riskier than the other",
      "motivated reasoning": "believing what you want to be true",
      threshold: "the line that triggers action",
      escalate: "raise to a higher level or more senior people",
    },
  },
  f26: {
    ask: "Vendor lock-in means depending so much on one company's product (like AWS) that switching away is very hard. How much of that is okay to accept?",
    sides: [
      "Accept it for basic services — avoiding it costs more than it saves.",
      "Resist it where your data lives — that's the hardest thing to move.",
    ],
    terms: {
      commodity: "a basic product many suppliers offer in the same way",
      leaky: "doesn't fully hide what's underneath",
      "exit cost": "what it costs to leave",
      pragmatic: "practical, focused on what works",
    },
  },
  f27: {
    ask: "An AI model trained on old data can slowly get worse as the world changes — it goes \"stale\". How can you tell when that's happened?",
    sides: [
      "Watch what users do — more retries or overrides means it's slipping.",
      "Watch the incoming data — if it looks different from what it learned on, act.",
    ],
    terms: {
      drift: "gradual change over time",
      proxy: "an indirect sign you can measure",
      decay: "slow decline in quality",
      downstream: "what happens later, after the model's answer",
    },
  },
  f28: {
    ask: "Async means communicating in writing that people answer when they can — messages, docs. Sync means talking live — meetings, calls. Which should a team use by default?",
    sides: [
      "Async by default — it works across time zones and leaves a record.",
      "Sync for anything tricky — a ten-minute call beats a three-day thread.",
    ],
    terms: {
      compounds: "builds up value over time",
      converge: "come together on one answer",
      "by default": "the normal choice unless there's a reason",
      ambiguity: "unclear, could mean more than one thing",
    },
  },
  f29: {
    ask: "Sometimes developers want to throw old code away and rewrite it from scratch. When is that genuinely right, rather than a costly mistake?",
    sides: [
      "Rarely — ugly old code often hides years of fixed bugs.",
      "When the foundation itself is wrong, and you can switch over gradually.",
    ],
    terms: {
      architectural: "about the basic structure of a system",
      accrued: "built up gradually over time",
      incremental: "in small steps",
      "in hindsight": "looking back afterwards",
    },
  },
  f30: {
    ask: "Can you actually measure how productive a software developer is — with numbers like lines of code or tasks finished?",
    sides: [
      "Measure the team's delivery, not individuals — that part works.",
      "Any number you track, people learn to game — ask them what slows them down instead.",
    ],
    terms: {
      proxy: "a stand-in measure",
      gameable: "easy to cheat or inflate",
      aggregate: "the total, taken all together",
      friction: "things that slow you down",
    },
  },

  // ---------------------------------------------------------------- random
  r01: {
    ask: "Working four days a week instead of five, for the same pay. Trials looked promising — but would it actually work across the whole economy?",
    sides: [
      "Yes for office work — people get the same done in less time and stay happier.",
      "Not everywhere — the trials used companies already suited to it, and some jobs need the hours.",
    ],
    terms: {
      "selection bias": "results skewed because only certain people took part",
      attrition: "people leaving their jobs",
      linear: "output goes up exactly with hours worked",
      transfer: "work the same way in a different setting",
    },
  },
  r02: {
    ask: "Since the pandemic, many people work from home. Has that argument been won, or has it just moved to new fights — hybrid days and return-to-office rules?",
    sides: [
      "Settled — productivity held up, so remote work is here to stay.",
      "Just moved — the losses are in mentoring and casual connections, which are hard to see.",
    ],
    terms: {
      "weak ties": "casual connections with people you don't know well",
      attribute: "say what caused something",
      distributional: "about who wins and who loses",
      mandate: "an official rule you must follow",
    },
  },
  r03: {
    ask: "Congestion pricing means charging drivers a fee to drive into a busy city centre. London and Stockholm do it. Does it actually reduce traffic?",
    sides: [
      "Yes — traffic dropped and stayed down, and people liked it once they tried it.",
      "It's unfair — it hits poorer drivers hardest unless the money helps them.",
    ],
    terms: {
      regressive: "hits poorer people harder",
      persisted: "lasted over time",
      "revenue-neutral": "the money raised is all given back somehow",
      elasticity: "how much behaviour changes when the price changes",
    },
  },
  r04: {
    ask: "Universal basic income (UBI) means the government gives everyone a regular payment, no conditions. Is it a realistic policy, or just a nice idea?",
    sides: [
      "Serious — it's simpler and less humiliating than complicated benefit checks.",
      "Thought experiment — paying everyone a real amount is hugely expensive.",
    ],
    terms: {
      "means-tested": "only given if you prove you're poor enough",
      "at scale": "for a whole country, not a small trial",
      administrative: "about the paperwork and running costs",
      "the strong version": "the most convincing form of the argument",
    },
  },
  r05: {
    ask: "As countries move off coal and gas (\"the transition\"), should nuclear power plants be part of the mix alongside wind and solar?",
    sides: [
      "Yes — it's clean and gives steady power when there's no wind or sun.",
      "No — it's now too expensive and slow to build compared with solar.",
    ],
    terms: {
      lifecycle: "the whole life, from building to shutting down",
      dispatchable: "can be turned up or down when needed",
      "steel-man": "the strongest version of the other side's argument",
      "at scale": "in large amounts",
    },
  },
  r06: {
    ask: "Teams now use data and stats to choose tactics — like basketball teams shooting far more three-pointers. Has that made sport more fun to watch, or more boring?",
    sides: [
      "Better — teams play smarter and with more skill.",
      "Worse — every team copies the same best tactic, so games look alike.",
    ],
    terms: {
      converge: "all end up in the same place",
      homogenise: "make everything the same",
      "dominant strategy": "one approach that beats all others",
      "trade-off": "gaining one thing by giving up another",
    },
  },
  r07: {
    ask: "Should countries stop using cash altogether and go fully to card and phone payments, the way Sweden nearly has?",
    sides: [
      "Yes — it's faster, safer, and cuts crime.",
      "No — cash works in power cuts, protects privacy, and helps the elderly.",
    ],
    terms: {
      rail: "the system money moves along — cards, bank transfers, cash",
      regressive: "falls harder on poorer people",
      "by default": "automatically, without asking",
      resilience: "the ability to keep working when things go wrong",
    },
  },
  r08: {
    ask: "Airlines sell more tickets than there are seats, expecting some people not to show up. Why do they do it, and is it fair?",
    sides: [
      "Smart — no-shows are predictable, and an empty seat is wasted money.",
      "Fair now — they pay volunteers to give up seats instead of forcing people off.",
    ],
    terms: {
      "in aggregate": "across many flights, overall",
      auction: "selling to whoever bids — here, whoever takes the lowest offer",
      "expected value": "the average result if repeated many times",
      mechanism: "how the system works",
    },
  },
  r09: {
    ask: "With insurance you pay a little every month in case something bad happens. What are you actually buying — and why is it worth it?",
    sides: [
      "Peace of mind — a small, certain cost instead of a small chance of ruin.",
      "It only works when bad events are rare and unlinked — not for climate or pandemics.",
    ],
    terms: {
      uncorrelated: "not linked — one doesn't make the other more likely",
      "adverse selection": "riskier people are more likely to buy cover",
      "moral hazard": "taking more risks because you're insured",
      "expected value": "the average outcome over many tries",
    },
  },
  r10: {
    ask: "Antibiotic resistance is when bacteria evolve so medicines stop killing them. How worried should we be?",
    sides: [
      "Very — nobody funds new drugs, because good new ones must be used sparingly.",
      "Worried, but it's fixable — most overuse is in farming, which policy can change.",
    ],
    terms: {
      "selection pressure": "conditions that help certain survivors spread",
      "market failure": "when the free market won't produce what society needs",
      dwarf: "be far bigger than",
      incentive: "a reason or reward to act",
    },
  },
  r11: {
    ask: "Houses are too expensive in many cities. Is that because not enough homes get built (supply), or because people and investors want them too much (demand)?",
    sides: [
      "Supply — rules make building slow and hard, so we've underbuilt for decades.",
      "Demand — homes are treated as investments, which pushes prices up.",
    ],
    terms: {
      constrained: "held back by limits",
      financialisation: "treating something as an investment for profit",
      distribution: "who gets what",
      "both can be true": "two causes can work at the same time",
    },
  },
  r12: {
    ask: "\"Just-in-time\" means factories keep almost no spare stock — parts arrive exactly when needed. It saved money for decades, then COVID broke supply chains. Was it a mistake?",
    sides: [
      "Not a mistake — it worked for forty years; just know your weak spots.",
      "A mistake — saving money left no cushion for a global shock.",
    ],
    terms: {
      "in tension": "pulling against each other",
      "single point of failure": "one part that breaks everything if it fails",
      correlated: "happening together, at the same time",
      buffer: "a spare cushion for emergencies",
    },
  },
  r13: {
    ask: "Why do movie studios keep making sequels and remakes instead of original films?",
    sides: [
      "Money — a known title is cheaper to advertise and less risky.",
      "It's shifting — streaming wants long series that keep subscribers paying.",
    ],
    terms: {
      "binding constraint": "the one limit that actually holds you back",
      variance: "how unpredictable the results are",
      calculus: "the way you weigh up a decision",
      "risk-averse": "avoiding risk, preferring safe bets",
    },
  },
  r14: {
    ask: "Free apps like TikTok make money by keeping you scrolling. Is that a broken market that should be regulated, or just people choosing how to spend their time?",
    sides: [
      "Broken — the apps are built to grab time, not to make lives better.",
      "Not broken — adults choosing their entertainment isn't a failure.",
    ],
    terms: {
      externality: "a cost that falls on others, not the buyer or seller",
      diffuse: "spread thinly across many people",
      paternalism: "deciding what's good for people instead of letting them choose",
      "optimisation target": "the number a system is built to maximise",
    },
  },
  r15: {
    ask: "When a central bank raises interest rates, how does that actually reach everyday life — prices, jobs, loans?",
    sides: [
      "Mostly through borrowing — loans get pricier, so people spend less.",
      "Slowly and indirectly — the effects show up a year or more later.",
    ],
    terms: {
      transmission: "how an effect passes from one place to another",
      lag: "a delay before the effect shows",
      duration: "how far into the future the payoff is",
      expectations: "what people believe will happen",
    },
  },
  r16: {
    ask: "Carbon offsets let a company pay someone else to cut or store carbon — like planting trees — to cancel out its own pollution. Do they actually work?",
    sides: [
      "Mostly not — many projects would have happened anyway, or don't last.",
      "Some do — directly pulling carbon out and storing it safely is real.",
    ],
    terms: {
      additionality: "would it have happened anyway, without the money?",
      permanence: "will the stored carbon stay stored?",
      verifiable: "can be checked and proven",
      "in principle": "in theory",
    },
  },
  r17: {
    ask: "Vertical farming grows crops indoors in tall stacks under LED lights. Does it make sense, or is it hype?",
    sides: [
      "Makes sense for herbs and salad — pricey, fresh, and grown close to cities.",
      "Mostly hype — swapping free sunlight for electricity is too expensive.",
    ],
    terms: {
      substitute: "replace one thing with another",
      "high-value": "sells for a lot",
      proximity: "being close to",
      "unit economics": "the profit or loss on each single item",
    },
  },
  r18: {
    ask: "\"Sleep debt\" is the idea that missed sleep adds up and has to be paid back. Is that real — and can you catch up at the weekend?",
    sides: [
      "Real — weekend lie-ins only partly fix a bad week.",
      "Real, but timing matters as much as hours — keep a steady schedule.",
    ],
    terms: {
      partial: "only part of it",
      impairment: "being less able to do things well",
      underweight: "give too little importance to",
      consistency: "keeping the same pattern every day",
    },
  },
  r19: {
    ask: "A placebo is a fake treatment, like a sugar pill, that still makes people feel better. Why does that happen?",
    sides: [
      "Belief is powerful — expecting to feel better really changes pain.",
      "Much of it is timing — people join trials at their worst and improve anyway.",
    ],
    terms: {
      "regression to the mean": "extreme results tend to drift back to normal",
      expectation: "what you believe will happen",
      insufficient: "not enough",
      measurable: "can be measured with numbers",
    },
  },
  r20: {
    ask: "Computer chess programs now beat every human. What did that do to the way people play and learn chess?",
    sides: [
      "Made it better — ordinary players are far stronger than they used to be.",
      "Made the top duller — top players memorise computer moves and draw more.",
    ],
    terms: {
      converge: "all end up the same",
      "the floor": "the lowest level, where beginners are",
      template: "a pattern that repeats elsewhere",
      depth: "how far ahead and how detailed",
    },
  },
  r21: {
    ask: "In some countries waiters earn a big part of their pay from tips. Should tipping be scrapped and replaced with proper wages?",
    sides: [
      "Yes — tips depend on looks and bias, not on good service.",
      "It's hard — restaurants that tried often went back, because prices looked higher.",
    ],
    terms: {
      rationale: "the reason given for something",
      revert: "go back to how it was",
      "shift risk": "move the danger of losing money onto someone else",
      correlate: "be linked, move together",
    },
  },
  r22: {
    ask: "A patent gives an inventor the sole right to their invention for years. Does that encourage new inventions, or block them?",
    sides: [
      "Encourages — in medicine, nobody would spend billions without protection.",
      "Blocks — in software, patents mostly feed lawsuits.",
    ],
    terms: {
      bargain: "a deal where each side gives something",
      thicket: "a tangled mess of overlapping patents",
      prominence: "how important or famous something seems",
      "sector-specific": "true for one industry, not all",
    },
  },
  r23: {
    ask: "Sanctions are when countries cut trade or freeze money to punish another country's government. Do they actually change anything?",
    sides: [
      "Rarely — they hurt ordinary people more than the leaders.",
      "They do something — they send a message to allies and voters at home.",
    ],
    terms: {
      "hit rate": "how often something succeeds",
      targeted: "aimed at specific people, not everyone",
      signalling: "sending a message through your actions",
      "second-order": "a knock-on effect of an effect",
    },
  },
  r24: {
    ask: "Many places are running short of fresh water. Is the answer finding more water — or is the real problem how we use and price it?",
    sides: [
      "It's about use — farming takes about 70%, and water is too cheap.",
      "Supply helps too — turning seawater into fresh water now works for cities.",
    ],
    terms: {
      "rounding error": "so small it barely matters",
      underpriced: "cheaper than its real cost",
      constructed: "created by our choices, not by nature",
      viable: "able to work in practice",
    },
  },
  r25: {
    ask: "A \"nudge\" is a small design choice that steers people without forcing them — like making organ donation automatic unless you opt out. Should governments do this?",
    sides: [
      "Yes — every form already steers people, so steer them well.",
      "Careful — nudges get used to dodge real policy changes.",
    ],
    terms: {
      default: "the option you get if you do nothing",
      "choice architecture": "how choices are laid out in front of people",
      canonical: "the classic, best-known example",
      "substitute for": "used instead of something",
    },
  },
  r26: {
    ask: "Spotify and others pay billions for music, yet most musicians earn very little from streams. Why?",
    sides: [
      "The payout system — your subscription mostly goes to the most-played stars.",
      "Old contracts — record labels hold the power and take the biggest share.",
    ],
    terms: {
      "pro-rata": "shared out by proportion",
      leverage: "bargaining power",
      redirect: "send somewhere else",
      predate: "come from before",
    },
  },
  r27: {
    ask: "Lab-grown meat is real meat grown from animal cells, without raising animals. Will it ever be cheap enough to compete with normal meat?",
    sides: [
      "Not soon — making it in huge amounts is still unsolved.",
      "Eventually — costs fall as production grows, like they did for solar panels.",
    ],
    terms: {
      scaling: "making a lot more of it",
      ceiling: "an upper limit",
      "the constraint": "the thing really holding it back",
      "cost curve": "how costs fall as you make more",
    },
  },
  r28: {
    ask: "Gig workers are people like Uber drivers or delivery riders. Should the law treat them as employees — with sick pay and minimum wage — or as independent contractors?",
    sides: [
      "Employees — the app sets prices and rules, so it's really their boss.",
      "Something new — workers value flexibility, and \"employee\" doesn't fit.",
    ],
    terms: {
      "control test": "the legal check of who controls the work",
      binary: "only two options",
      accommodate: "make room for",
      boundary: "the line between categories",
    },
  },
  r29: {
    ask: "Survivorship bias is taking lessons only from winners, because the failures aren't around to study. Where does that mistake sneak in?",
    sides: [
      "Business advice — failed founders did the same things, but nobody interviews them.",
      "Everywhere — so always ask what's missing from the data.",
    ],
    terms: {
      canonical: "the classic, standard example",
      absent: "missing, not there",
      "the general move": "the habit that works everywhere",
      falsify: "prove wrong",
    },
  },
  r30: {
    ask: "When interest rates go up, startups struggle to raise money and some shut down. Why are they hit so hard?",
    sides: [
      "Their value is in future profits, and higher rates shrink what the future is worth today.",
      "Investors can earn safe returns elsewhere, so less money flows to risky startups.",
    ],
    terms: {
      duration: "how far in the future the money arrives",
      discount: "shrink future money to what it's worth today",
      allocation: "how investors share out their money",
      lag: "a delay before the effect shows",
    },
  },
};
