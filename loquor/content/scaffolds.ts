// The Persuasion Lab. PRD §5 Pillar 5.
//
// Two drill families with one thing in common: they are structures, not scripts.
// A script fails the moment the room says something you did not plan for. A
// structure survives, because each step is a question you can answer about
// whatever just happened.
//
// A. Scaffolds — five ways to shape a spoken argument, drilled against the same
//    Arena topics so the variable is the shape and not the subject.
// B. Counterparts — role-play partners for networking without small talk. Each
//    one has something worth reaching and a guard in front of it.
//
// The `trap` on each scaffold is the failure mode of that scaffold specifically,
// which is a more useful thing to know than the scaffold itself. Anyone can
// recite PREP. Knowing that PREP collapses into a lecture when the Example runs
// long is the part that changes how you sound.

export type Step = {
  label: string;
  /** The question this step answers. What you actually think about in the moment. */
  ask: string;
  /** Roughly how much of the 60 seconds it should take. */
  shareS: number;
};

export type Scaffold = {
  id: string;
  name: string;
  /** Expanded acronym where there is one. */
  gloss: string;
  when: string;
  steps: Step[];
  /** One worked example, spoken not written. */
  example: string;
  trap: string;
};

export const SCAFFOLDS: Scaffold[] = [
  {
    id: "prep",
    name: "PREP",
    gloss: "Point, Reason, Example, Point",
    when: "You are asked what you think and you have about a minute. The default shape for a spoken opinion.",
    steps: [
      { label: "Point", ask: "What do you actually think? One sentence, no wind-up.", shareS: 10 },
      { label: "Reason", ask: "Why? The single strongest reason, not all four.", shareS: 15 },
      { label: "Example", ask: "One concrete instance. Named, dated, real.", shareS: 25 },
      { label: "Point", ask: "Say the point again, tightened by what you just said.", shareS: 10 },
    ],
    example:
      "We should keep the monolith for now. The reason is that our deploy pain is coming from the test suite, not from the architecture. When we split out the notifications service last year, deploy time went up, not down, because we still had to run everything to be sure. So: fix the tests first, and revisit the split when a team actually needs to ship independently.",
    trap: "The Example swallows the clock. If you are still describing the example at forty seconds, you will run out of time before the closing Point — and the closing Point is the only part anyone remembers.",
  },
  {
    id: "scqa",
    name: "SCQA",
    gloss: "Situation, Complication, Question, Answer",
    when: "You are briefing someone senior who does not have the context, and you need them to want the answer before you give it.",
    steps: [
      { label: "Situation", ask: "What does everyone already agree is true? Uncontroversial, brief.", shareS: 12 },
      { label: "Complication", ask: "What changed, or what did we find, that breaks that?", shareS: 15 },
      { label: "Question", ask: "State the question that now has to be answered. Say it out loud.", shareS: 8 },
      { label: "Answer", ask: "Your answer, and the one thing you need from them.", shareS: 25 },
    ],
    example:
      "We've been planning to launch the API in June and the build has been on track. What we found last week is that the rate limiter can't tell tenants apart — one customer can starve the rest. So the question is whether we launch on time with a per-account cap that some customers will hit, or slip four weeks and do it properly. My answer is slip four weeks: the customers who'd hit the cap are the three we most want to keep. I need a decision from you by Friday.",
    trap: "Skipping the Question. It feels redundant because everyone can infer it — but said out loud it is the move that makes the room agree on what is being decided, which is most of the work.",
  },
  {
    id: "concede-narrow",
    name: "Concede and Narrow",
    gloss: "Grant the principle, contest the application",
    when: "Engineering disagreement where the other person is right in general and wrong here. The most useful move in the set.",
    steps: [
      { label: "Concede", ask: "What is genuinely right about their position? Say it in their words.", shareS: 12 },
      { label: "Narrow", ask: "What is specific about this case that puts it outside the rule?", shareS: 20 },
      { label: "Evidence", ask: "What makes you confident the exception is real?", shareS: 18 },
      { label: "Proposal", ask: "What do you actually want to happen now?", shareS: 10 },
    ],
    example:
      "You're right that we shouldn't build our own auth — that's almost always a mistake and it's a lot of surface area to own. Where I think this one is different is that we need per-field permissions and none of the three vendors we looked at do that below the enterprise tier. I checked with Auth0 last month and it's a forty thousand a year jump. So what I'd propose is we use the vendor for identity and build only the authorisation layer, which is about a week.",
    trap: "A concession the other person does not recognise as their position. If they have to correct your summary of them, you have lost the move and made it adversarial in the process.",
  },
  {
    id: "steel-turn",
    name: "Steel-man then Turn",
    gloss: "State their case better than they did, then move",
    when: "The room is split and you want to be the person who is clearly listening rather than clearly winning.",
    steps: [
      { label: "Steel-man", ask: "Make the other case as strong as it honestly gets.", shareS: 20 },
      { label: "Grant", ask: "Name what that case gets right that yours does not.", shareS: 10 },
      { label: "Turn", ask: "The one consideration that outweighs it. Only one.", shareS: 20 },
      { label: "Land", ask: "What you are asking for, stated plainly.", shareS: 10 },
    ],
    example:
      "The case for shipping now is stronger than we've been treating it. We've got a customer waiting, the feature works for the main path, and every week we hold it we're paying for a decision we could revisit later. That's real, and it's more than the caution argument admits. What tips it for me is the data migration — it's the one part we can't undo cheaply, and it's exactly the part that isn't finished. So I'd ship the read path this week and hold the migration.",
    trap: "Turning too fast. If the steel-man is three seconds long it reads as a formality, and the room hears 'I am about to disagree' rather than 'I understood you'.",
  },
  {
    id: "bluf",
    name: "Bottom Line Up Front",
    gloss: "Answer first, reasoning after",
    when: "Someone senior asked a direct question, or the meeting has four minutes left. Trained against the instinct to build up to the point.",
    steps: [
      { label: "Bottom line", ask: "The answer. First sentence. No preamble, no context-setting.", shareS: 8 },
      { label: "Confidence", ask: "How sure are you, and what is that based on?", shareS: 12 },
      { label: "Because", ask: "The reasoning, now that they know where it goes.", shareS: 30 },
      { label: "Ask", ask: "What you need from them, if anything.", shareS: 10 },
    ],
    example:
      "No, it won't be ready for the July board meeting. I'm fairly confident of that — we're four weeks in on a six-week piece and the integration hasn't started. The reason is that the partner's sandbox only came online last Tuesday, so everything we'd sequenced behind it moved. What I need from you is whether we present the read-only version in July or wait until September.",
    trap: "Undermining the bottom line in the second sentence. 'No — well, it depends' throws away the entire point of the structure. Commit to the answer, then qualify it inside the Confidence step where it belongs.",
  },
];

export const SCAFFOLDS_BY_ID = new Map(SCAFFOLDS.map((s) => [s.id, s]));

// ── Networking without small talk ─────────────────────────────────────────────
//
// The stated aim was "learn networking with less small talk". The role-play is
// three turns from cold open to substance, and it is scored on how quickly you
// got there and on whether you asked more than you told — because the fastest
// way to be remembered as interesting is to be interested, and that is a
// behaviour, not a personality.

export type Move = {
  id: string;
  name: string;
  form: string;
  why: string;
  trap: string;
};

export const MOVES: Move[] = [
  {
    id: "substance-opener",
    name: "The Substance Opener",
    form: "You mentioned you're on the payments team — what's the part of that everyone underestimates?",
    why: "'So what do you do?' hands them a script they have recited two hundred times. A specific observation makes them think, and thinking is what makes a conversation memorable.",
    trap: "Requires one real detail about them. Without it the question is generic and lands as an interview.",
  },
  {
    id: "the-ladder",
    name: "The Ladder",
    form: "Role → problem → opinion, in three moves, under sixty seconds.",
    why: "Most conversations stall at role because nobody climbs. Each rung is one question: what you do, what is hard about it, what you think should be done about it. By the third you are talking to a person rather than a job title.",
    trap: "Climbing too fast. Jumping straight to opinion before they have named a problem reads as an argument looking for a subject.",
  },
  {
    id: "the-hard-question",
    name: "The Hard Question",
    form: "What's the hardest part of that?",
    why: "The near-universal small-talk escape hatch. It works on any topic, it flatters without flattering, and the answer is always more interesting than the summary that preceded it.",
    trap: "Becomes a tic. Once per conversation, and you have to actually engage with the answer or it is obviously a formula.",
  },
  {
    id: "the-handoff",
    name: "The Handoff",
    form: "I want to hear how the migration goes — send me a line when it lands?",
    why: "Closing so the conversation continues later. Most people end on 'nice to meet you', which closes it permanently.",
    trap: "Vague future intent ('we should chat sometime') is worse than nothing. Name the thing you want to hear about.",
  },
];

export type Counterpart = {
  id: string;
  name: string;
  role: string;
  setting: string;
  /** What they say first. Deliberately low-information — that is the problem. */
  opener: string;
  /** How they behave until you earn more. Fed to the model as character. */
  guard: string;
  /** The genuinely interesting thing underneath. The model only reveals it once earned. */
  substance: string;
};

export const COUNTERPARTS: Counterpart[] = [
  {
    id: "c01",
    name: "Dami",
    role: "Staff engineer on a payments team",
    setting: "Coffee queue at a conference, twenty minutes before a talk you both want to see.",
    opener: "Hey. Long queue. You here for the whole thing or just today?",
    guard:
      "Polite and a bit tired of conference small talk. Gives short, pleasant, low-information answers to generic questions. Warms up noticeably when asked something specific enough that nobody has asked it today.",
    substance:
      "They spent eighteen months migrating off a payments provider mid-contract and the hard part was not technical — it was that reconciliation broke silently for six weeks and nobody noticed because the dashboards averaged it away.",
  },
  {
    id: "c02",
    name: "Rachel",
    role: "VP Engineering at a 300-person company",
    setting: "Standing at the edge of a company offsite dinner. You have not met.",
    opener: "You're on the platform side, right? I think I've seen your name on some docs.",
    guard:
      "Busy, senior, used to people wanting something from her. Deflects flattery. Interested in anyone who has a view rather than a request, and impatient with anyone who takes more than a sentence to get to it.",
    substance:
      "She thinks the org's biggest problem is that decisions get made in the doc-comment threads and nobody outside the thread ever learns they happened. She has not said this publicly because she does not yet have a proposal.",
  },
  {
    id: "c03",
    name: "Tobi",
    role: "Founder of a two-person AI startup",
    setting: "Meetup, standing by the food, thirty minutes in.",
    opener: "Yeah so we're doing AI for legal document review. What about you?",
    guard:
      "Pitches by reflex — every question gets answered with the deck. Becomes a real person when asked something the deck does not cover, especially anything about what has not worked.",
    substance:
      "The product works fine; the problem is that law firms will not let the documents leave their network, so the entire architecture had to be rebuilt for on-premise deployment and it halved their velocity.",
  },
  {
    id: "c04",
    name: "Ingrid",
    role: "Anaesthetist, no technology background",
    setting: "A friend's birthday dinner. You are seated next to each other.",
    opener: "So how do you know the birthday girl? … Oh right. And what is it you do?",
    guard:
      "Friendly, entirely uninterested in technical detail, and will disengage instantly from jargon. Lights up when the conversation is about people, judgement, or things going wrong.",
    substance:
      "She has strong views on checklists — she has watched the same intervention save lives in theatre and be resented as bureaucracy, and she thinks the difference is entirely about who wrote them.",
  },
  {
    id: "c05",
    name: "Marcus",
    role: "Engineering manager at a competitor",
    setting: "Post-conference bar. You both know roughly what the other's company is building.",
    opener: "Ha — we're basically building the same thing, aren't we. How's it going over there?",
    guard:
      "Guarded about anything commercially sensitive and testing whether you are fishing. Opens up considerably on shared problems that are not competitive — hiring, on-call, tooling.",
    substance:
      "They tried the same architecture you did two years earlier, abandoned it, and would tell you why if you asked about the problem rather than about their roadmap.",
  },
  {
    id: "c06",
    name: "Priya",
    role: "Data scientist, six months into her first industry job",
    setting: "Internal lunch table. She is more junior than you and slightly nervous.",
    opener: "Hi — sorry, is this seat taken? I'm on the forecasting team, I think we're in the same all-hands.",
    guard:
      "Deferential and inclined to ask you questions rather than talk about herself. Will keep the conversation on you unless you actively turn it around.",
    substance:
      "She found a labelling error that invalidates about a third of the forecasting team's historical benchmark, has told her manager once, and does not know how hard to push.",
  },
];

export const COUNTERPARTS_BY_ID = new Map(COUNTERPARTS.map((c) => [c.id, c]));
