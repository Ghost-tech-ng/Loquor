// The Question Playbook. PRD §5 Pillar 2 — the core intellectual asset.
//
// Thirty named question shapes. You learn the *shape*, then fill it with
// whatever is in the room. The bet is that "ask a good question" is not a skill
// you can practise, because it names no motion; "notice an unexamined assumption
// and probe it" is, because it does.
//
// Every archetype carries a `trap`, and that field is doing more work than it
// looks like. Each of these can be asked badly, and asked badly most of them
// read as hostile or as showing off — which is precisely the failure mode
// someone trying to be *noticed* in meetings is most at risk of. The trap is the
// difference between contributing and scoring points.
//
// `family` groups them for the weakness report, so "you never probe risk" is
// sayable. `cue` is what you actually notice in the room a second before you ask
// — the drill trains the trigger, not the sentence.

export type Family = "probe" | "frame" | "risk" | "decide" | "people";

export type Archetype = {
  id: string;
  name: string;
  /** The canonical phrasing. Short enough to say without reading. */
  form: string;
  /** What you notice that tells you this is the moment. */
  cue: string;
  family: Family;
  /** Two more phrasings, so the shape does not fossilise into one sentence. */
  variants: string[];
  /** How this question goes wrong. Usually: asked as a gotcha. */
  trap: string;
};

export const FAMILY_LABELS: Record<Family, string> = {
  probe: "Probe the claim",
  frame: "Move the frame",
  risk: "Surface the risk",
  decide: "Force the decision",
  people: "Work the room",
};

export const ARCHETYPES: Archetype[] = [
  // ── probe ───────────────────────────────────────────────────────────────────
  {
    id: "assumption-probe",
    name: "Assumption Probe",
    form: "What has to be true for that to work?",
    cue: "A plan is being described confidently and none of its preconditions have been named.",
    family: "probe",
    variants: [
      "What are we assuming about the traffic pattern there?",
      "That works if the data is clean — is it?",
    ],
    trap: "Asked flatly it sounds like you think the plan is stupid. Name the part you believe first, then probe the part you don't.",
  },
  {
    id: "definition-check",
    name: "Definition Check",
    form: "When you say scalable, do you mean A or B?",
    cue: "One word is carrying the whole argument and two people in the room are hearing different things by it.",
    family: "probe",
    variants: [
      "Is 'done' here merged, or deployed, or being used?",
      "By 'soon', are we talking this sprint or this quarter?",
    ],
    trap: "Do not do this to every ambiguous word — only the one the decision turns on. Otherwise it reads as pedantry.",
  },
  {
    id: "falsifier",
    name: "Falsifier",
    form: "What would we see if this were wrong?",
    cue: "A claim is being made that no observation could contradict.",
    family: "probe",
    variants: [
      "What result would make us abandon this?",
      "How would we find out we were wrong — and how long would that take?",
    ],
    trap: "This is the most philosophical-sounding question in the set. Ground it in a metric or it lands as a debating trick.",
  },
  {
    id: "scope-narrow",
    name: "Scope Narrow",
    form: "Is that generally true, or just for this case?",
    cue: "A single incident is being generalised into a rule.",
    family: "probe",
    variants: [
      "Did that happen once, or is it the pattern?",
      "Is that true of all the endpoints, or the two we looked at?",
    ],
    trap: "Adjacent to calling someone sloppy. Attribute the overreach to the evidence, not to the speaker.",
  },
  {
    id: "evidence-source",
    name: "Evidence Source",
    form: "Where does that number come from?",
    cue: "A figure is quoted with confidence and no provenance.",
    family: "probe",
    variants: [
      "Is that measured or estimated?",
      "Is that p50 or p99?",
    ],
    trap: "Ask it about the number that matters, once. Asking it twice in a meeting turns you into the auditor nobody invites.",
  },
  {
    id: "mechanism-ask",
    name: "Mechanism Ask",
    form: "What is the actual mechanism there?",
    cue: "A correlation, a vendor claim, or a 'it just gets faster' has been offered as an explanation.",
    family: "probe",
    variants: [
      "Why does that make it faster, specifically?",
      "What is doing the work in that improvement?",
    ],
    trap: "Only worth asking if you would understand the answer. Otherwise you are asking someone to perform for you.",
  },

  // ── frame ───────────────────────────────────────────────────────────────────
  {
    id: "steel-man",
    name: "Steel-man",
    form: "The strongest case for the other option is X — how do we answer it?",
    cue: "The room has converged and the losing option was never stated well.",
    family: "frame",
    variants: [
      "Let me argue the other side for a second, badly, so someone can knock it down.",
      "If we picked the other one, what would we be right about?",
    ],
    trap: "Only steel-man a position you can state fairly. A weak steel-man is worse than none — it looks like you are burying the alternative politely.",
  },
  {
    id: "level-shift",
    name: "Level Shift",
    form: "Are we solving the right problem, or the visible one?",
    cue: "Forty minutes of detail on a symptom nobody has traced upward.",
    family: "frame",
    variants: [
      "What is the problem underneath this one?",
      "If this were fixed perfectly, what would still be broken?",
    ],
    trap: "The single most annoying question in the set when mistimed. Never ask it in the last five minutes of a meeting that has nearly decided.",
  },
  {
    id: "counterfactual",
    name: "Counterfactual",
    form: "What happens if we do nothing?",
    cue: "Action is being treated as obviously necessary and the null option was never priced.",
    family: "frame",
    variants: [
      "What breaks if we just leave it?",
      "Who is actually complaining right now?",
    ],
    trap: "Reads as obstruction unless you signal you are pricing the option rather than advocating it.",
  },
  {
    id: "unit-of-analysis",
    name: "Unit of Analysis",
    form: "Are we optimising for the request, the user, or the quarter?",
    cue: "Two people are both right because they are measuring different things.",
    family: "frame",
    variants: [
      "Per request or per session?",
      "Is this a per-team cost or a company cost?",
    ],
    trap: "Useless unless you name the two candidate units. 'It depends what you measure' is not a contribution.",
  },
  {
    id: "analogy-test",
    name: "Analogy Test",
    form: "Where does that comparison break down?",
    cue: "An analogy is doing argumentative work — 'it's basically just a cache', 'this is our Netflix moment'.",
    family: "frame",
    variants: [
      "It's like a queue until the consumers are stateful — are ours?",
      "That worked for them at their scale. What is different about ours?",
    ],
    trap: "Attack the analogy, never the person's taste in analogies.",
  },
  {
    id: "prior-art",
    name: "Prior Art",
    form: "Has anyone solved this already, in-house or outside?",
    cue: "A build decision is being made without a survey.",
    family: "frame",
    variants: [
      "Is there a team here that already has this?",
      "What does the boring off-the-shelf version cost?",
    ],
    trap: "Do not ask if you already know the answer and want to display it. Ask, then add what you know.",
  },

  // ── risk ────────────────────────────────────────────────────────────────────
  {
    id: "second-order",
    name: "Second-Order",
    form: "If this works, what breaks downstream?",
    cue: "A proposal is being evaluated only on whether it succeeds.",
    family: "risk",
    variants: [
      "Who inherits the load when this lands?",
      "What does success here cost the team next door?",
    ],
    trap: "Be specific about the downstream thing. A vague 'have we thought about second-order effects' is noise.",
  },
  {
    id: "reversibility",
    name: "Reversibility",
    form: "How expensive is it to undo?",
    cue: "A decision is being weighed on whether it is right, not on what being wrong would cost.",
    family: "risk",
    variants: [
      "Is this a one-way door?",
      "If we hate it in a month, what does backing out involve?",
    ],
    trap: "The most useful question in the set and the hardest to ruin — but pair it with a recommendation, or it just adds fear.",
  },
  {
    id: "failure-mode",
    name: "Failure Mode",
    form: "What does this look like when it fails at 3am?",
    cue: "A design has been described only in the happy path.",
    family: "risk",
    variants: [
      "What is the page that fires, and what does the on-call do about it?",
      "How does this degrade — gracefully, or all at once?",
    ],
    trap: "Skip it if the thing is not on a critical path. Applied everywhere, it becomes a tax on shipping.",
  },
  {
    id: "blast-radius",
    name: "Blast Radius",
    form: "If this is wrong, who finds out and how far does it spread?",
    cue: "A change is being scoped by effort rather than by exposure.",
    family: "risk",
    variants: [
      "Is this contained to us or does it reach customers?",
      "How many services sit behind this?",
    ],
    trap: "Not the same question as failure mode. This one is about spread, not about the moment of breakage — do not ask both.",
  },
  {
    id: "silent-failure",
    name: "Silent Failure",
    form: "How would we notice this quietly going wrong?",
    cue: "A system that can degrade without alarming — data quality, a model, a cache.",
    family: "risk",
    variants: [
      "What is the alert that catches this, and does it exist yet?",
      "Would we find out from a dashboard or from a customer?",
    ],
    trap: "Has a real answer or it does not. If the team has no detection story, stop asking and offer to build one.",
  },
  {
    id: "load-bearing",
    name: "Load-Bearing Check",
    form: "Which part of this is load-bearing?",
    cue: "A plan with many components, most of them optional, none of them labelled.",
    family: "risk",
    variants: [
      "If we had to cut half of this, what has to survive?",
      "Which of these is the one that actually has to work?",
    ],
    trap: "Half a scope-cutting question. If nobody can answer it, you have found the real problem — say that out loud gently.",
  },

  // ── decide ──────────────────────────────────────────────────────────────────
  {
    id: "tradeoff-surfacer",
    name: "Tradeoff Surfacer",
    form: "What are we giving up by doing it that way?",
    cue: "A decision is being presented as free.",
    family: "decide",
    variants: [
      "What does this cost us that the other one doesn't?",
      "Where does the pain move to?",
    ],
    trap: "Nearly always welcome, which makes it easy to over-use. If you have asked it twice already, propose the tradeoff instead of asking for it.",
  },
  {
    id: "constraint-reveal",
    name: "Constraint Reveal",
    form: "What is actually stopping us — is it technical, or is it approval?",
    cue: "A discussion has been circling for ten minutes without moving.",
    family: "decide",
    variants: [
      "Is this blocked on a person or on a problem?",
      "If budget were not the issue, would we still be arguing?",
    ],
    trap: "Can expose a political constraint someone is deliberately not naming. Read the room before you pull it.",
  },
  {
    id: "cost-of-delay",
    name: "Cost of Delay",
    form: "What does waiting a quarter cost us?",
    cue: "Inaction is being treated as the safe default.",
    family: "decide",
    variants: [
      "What is the price of deciding this in March instead of now?",
      "Does the option get more expensive the longer we hold it?",
    ],
    trap: "Do not use it to push your own preferred option through. It is a pricing question, not a lever.",
  },
  {
    id: "decision-owner",
    name: "Decision Owner",
    form: "Who is actually deciding this, and by when?",
    cue: "Consensus is being sought where there is no decider, and the meeting is about to end without one.",
    family: "decide",
    variants: [
      "Is this ours to decide or are we recommending?",
      "What is the date this needs to be settled by?",
    ],
    trap: "The highest-leverage question in the set and the one most likely to sound like a manager. Ask it as a service, not as a challenge.",
  },
  {
    id: "smallest-test",
    name: "Smallest Test",
    form: "What is the cheapest thing that would tell us?",
    cue: "The room is arguing about an empirical question nobody has measured.",
    family: "decide",
    variants: [
      "Could we answer this with a day of work instead of a quarter?",
      "Is there a version of this we could try on one customer?",
    ],
    trap: "Come with a candidate. Asking for a cheap test without proposing one is asking someone else to do the thinking.",
  },
  {
    id: "threshold-ask",
    name: "Threshold Ask",
    form: "At what number would we change our mind?",
    cue: "A commitment is being made open-endedly, with no stopping rule.",
    family: "decide",
    variants: [
      "How bad would latency have to get before we roll back?",
      "What is the kill criterion?",
    ],
    trap: "Only works if the number is one the team can actually observe. An unmeasurable threshold is theatre.",
  },
  {
    id: "sequencing",
    name: "Sequencing",
    form: "What has to happen first for the rest of this to be worth doing?",
    cue: "A list of good work with no order, about to be started in parallel.",
    family: "decide",
    variants: [
      "Which of these unblocks the others?",
      "Is there a piece here that makes the rest cheaper?",
    ],
    trap: "Do not turn it into a planning session. One question, then let the owner take it away.",
  },

  // ── people ──────────────────────────────────────────────────────────────────
  {
    id: "concede-and-narrow",
    name: "Concede and Narrow",
    form: "You are right that X. The question is whether that applies here, because…",
    cue: "You disagree with a conclusion but not with the reasoning that produced it.",
    family: "people",
    variants: [
      "That is true in general. This case has a wrinkle — the writes are not idempotent.",
      "Agreed on the principle. I think we are in the exception.",
    ],
    trap: "The concession must be real. A fake one — conceding something trivial to seize the floor — is transparent and costs you more than disagreeing plainly.",
  },
  {
    id: "invite-the-quiet",
    name: "Invite the Quiet",
    form: "Priya, you have shipped this before — what are we missing?",
    cue: "The person with the most relevant experience has not spoken in twenty minutes.",
    family: "people",
    variants: [
      "You have the most scar tissue here — does this match what you saw?",
      "Before we lock it, is there a view we have not heard?",
    ],
    trap: "Never put someone on the spot for a topic that is not theirs. Done wrong this is a small public ambush.",
  },
  {
    id: "name-the-unsaid",
    name: "Name the Unsaid",
    form: "I think the thing nobody is saying is that this slips the launch.",
    cue: "Everyone in the room knows the same thing and the meeting is proceeding as if they do not.",
    family: "people",
    variants: [
      "Are we all quietly assuming the migration does not happen?",
      "Is the real objection that nobody wants to own it?",
    ],
    trap: "The highest-variance move in the product. Get it right and the room turns; get it wrong and you have accused people of something. Only name what you would say to each person alone.",
  },
  {
    id: "hard-question",
    name: "The Hard Question",
    form: "What is the hardest part of that?",
    cue: "A conversation is running on pleasantries and you want substance without an interrogation.",
    family: "people",
    variants: [
      "What is the part everyone underestimates?",
      "What would you do differently if you started it again?",
    ],
    trap: "Nearly universal — which means it can become a verbal tic. Use once per conversation and actually listen to the answer.",
  },
  {
    id: "summarise-and-check",
    name: "Summarise and Check",
    form: "So the position is X, on the condition Y — have I got that right?",
    cue: "A long discussion has arrived somewhere and nobody has said where.",
    family: "people",
    variants: [
      "Let me play that back: we ship the read path now, the writes in Q3.",
      "Are we agreeing on the plan, or on the direction?",
    ],
    trap: "Summarise honestly. Sliding your own preference into the recap is the fastest way to lose the room's trust permanently.",
  },
];

export const ARCHETYPES_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

export function archetype(id: string): Archetype | undefined {
  return ARCHETYPES_BY_ID.get(id);
}

export function byFamily(family: Family): Archetype[] {
  return ARCHETYPES.filter((a) => a.family === family);
}
