// The arithmetic behind the Playbook, the Lab and the Rooms funnel.
//
// Pure on purpose. Nothing here touches SQLite, the network or a React hook, so
// all of it is testable under `node --experimental-strip-types --test` and none
// of it can be quietly wrong on a device in a way a test would not catch.
//
// Two ideas live here.
//
// 1. Skill is an EWMA, not a schedule. The Lexicon uses FSRS because a word is a
//    memory and memories decay on a curve worth modelling. An archetype is not a
//    memory — you do not *forget* how to ask what would change your mind, you are
//    simply out of practice. What matters is "how have the last few attempts
//    gone", which is exactly an exponentially weighted moving average, and the
//    right thing to drill next is whatever that average is worst at.
//
// 2. The Contribution Score is a funnel, not a number out of a hundred. The three
//    aims were: contribute and be noticed, network without small talk, influence
//    and convince. Those are stages — you cannot take a position in a room you
//    never spoke in — and a funnel shows you *where* you fall out. A single
//    composite score would hide that, which is the only thing it was supposed to
//    reveal.

import type { Family } from "../content/archetypes.ts";

// ── Skill ─────────────────────────────────────────────────────────────────────

export type SkillState = { itemId: string; attempts: number; ewma: number; lastAt: number };

/**
 * How fast a new score moves the average.
 *
 * `1/(attempts+1)` for the first few reps, so attempt one *is* the average and
 * attempt two is its true mean — starting an EWMA at a fixed 0.3 would leave a
 * first score of 4 reading as 1.2 and tell the user they are bad at something
 * they just did well. Floored at 0.3 so it stays responsive forever after: at
 * fifty attempts the last three reps still dominate, which is what "out of
 * practice" should mean.
 */
export function alphaFor(attempts: number): number {
  return Math.max(0.3, 1 / (attempts + 1));
}

/** Fold one 0–4 score into an item's running state. */
export function updateSkill(
  prev: SkillState | undefined,
  itemId: string,
  score: number,
  now: number
): SkillState {
  const s = Math.min(4, Math.max(0, score));
  if (!prev || prev.attempts === 0) {
    return { itemId, attempts: 1, ewma: s, lastAt: now };
  }
  const a = alphaFor(prev.attempts);
  return {
    itemId,
    attempts: prev.attempts + 1,
    ewma: prev.ewma + a * (s - prev.ewma),
    lastAt: now,
  };
}

export type Mastery = "untried" | "shaky" | "working" | "solid";

export function mastery(s: SkillState | undefined): Mastery {
  if (!s || s.attempts === 0) return "untried";
  if (s.attempts < 3) return "shaky";
  return s.ewma >= 3 ? "solid" : "working";
}

export const MASTERY_LABELS: Record<Mastery, string> = {
  untried: "Not tried",
  shaky: "Early",
  working: "Working",
  solid: "Solid",
};

/**
 * What to drill next, worst first.
 *
 * Never-attempted items come before any scored one regardless of score: an
 * archetype you have never used is a bigger hole than one you use badly, and
 * breadth is the point of a thirty-item playbook. Among tried items, lowest
 * average first. Ties break on staleness so the same two items do not alternate
 * forever, and finally on id so the order is deterministic and the tests can
 * assert on it.
 */
export function weakest(
  ids: string[],
  states: Map<string, SkillState>,
  limit = ids.length
): string[] {
  const rank = (id: string): [number, number, number, string] => {
    const s = states.get(id);
    if (!s || s.attempts === 0) return [0, 0, 0, id];
    return [1, s.ewma, s.lastAt, id];
  };
  return [...ids]
    .sort((x, y) => {
      const a = rank(x);
      const b = rank(y);
      if (a[0] !== b[0]) return a[0] - b[0];
      if (a[1] !== b[1]) return a[1] - b[1];
      if (a[2] !== b[2]) return a[2] - b[2];
      return a[3] < b[3] ? -1 : 1;
    })
    .slice(0, limit);
}

/** Per-family averages, for the Playbook's map. Untried items are excluded. */
export function familyAverages(
  items: { id: string; family: Family }[],
  states: Map<string, SkillState>
): Record<Family, { tried: number; total: number; avg: number }> {
  const out = {} as Record<Family, { tried: number; total: number; avg: number }>;
  for (const it of items) {
    const bucket = out[it.family] ?? { tried: 0, total: 0, avg: 0 };
    bucket.total += 1;
    const s = states.get(it.id);
    if (s && s.attempts > 0) {
      bucket.avg = (bucket.avg * bucket.tried + s.ewma) / (bucket.tried + 1);
      bucket.tried += 1;
    }
    out[it.family] = bucket;
  }
  return out;
}

// ── Prep Cards ────────────────────────────────────────────────────────────────

export type PrepCard = {
  /** One line you can say in the first five minutes. Written by the user, not us. */
  opener: string;
  /** Three archetypes to have loaded, chosen to be the ones they are worst at. */
  questions: { id: string; name: string; form: string; cue: string }[];
  /** The scaffold to reach for if they need to argue rather than ask. */
  scaffold: { id: string; name: string; steps: string[] } | null;
  /** The single thing to attempt. One, because three intentions is none. */
  intent: string;
};

export type PrepInputs = {
  decision: string;
  archetypes: { id: string; name: string; form: string; cue: string; family: Family }[];
  states: Map<string, SkillState>;
  scaffolds: { id: string; name: string; steps: { label: string }[] }[];
  scaffoldStates: Map<string, SkillState>;
};

/**
 * Assemble the card for a room.
 *
 * Three questions, not ten. A card you can hold in your head walking in is worth
 * more than a complete one you glance at once and abandon — and the failure mode
 * this product exists to fix is having nothing loaded, not having too little
 * choice. They are drawn from distinct families so the card cannot hand back
 * three flavours of the same move.
 */
export function buildPrep(input: PrepInputs): PrepCard {
  const order = weakest(
    input.archetypes.map((a) => a.id),
    input.states
  );
  const byId = new Map(input.archetypes.map((a) => [a.id, a]));

  const picked: typeof input.archetypes = [];
  const families = new Set<Family>();
  for (const id of order) {
    const a = byId.get(id);
    if (!a || families.has(a.family)) continue;
    picked.push(a);
    families.add(a.family);
    if (picked.length === 3) break;
  }
  // Fall back to plain weakest-first if the family spread could not be met.
  for (const id of order) {
    if (picked.length === 3) break;
    const a = byId.get(id);
    if (a && !picked.includes(a)) picked.push(a);
  }

  const scaffoldId = weakest(
    input.scaffolds.map((s) => s.id),
    input.scaffoldStates,
    1
  )[0];
  const sc = input.scaffolds.find((s) => s.id === scaffoldId) ?? null;

  return {
    opener: "",
    questions: picked.map((a) => ({ id: a.id, name: a.name, form: a.form, cue: a.cue })),
    scaffold: sc ? { id: sc.id, name: sc.name, steps: sc.steps.map((s) => s.label) } : null,
    intent: input.decision.trim()
      ? `Ask one question that changes how the room sees: ${input.decision.trim()}`
      : "Ask one real question before the halfway point.",
  };
}

// ── Contribution funnel ───────────────────────────────────────────────────────

export type FunnelStage = { key: string; label: string; count: number; ofPrevious: number };

export type Funnel = {
  stages: FunnelStage[];
  /** Where the biggest drop is, or null when there is nothing to compare yet. */
  bottleneck: { key: string; label: string; ofPrevious: number } | null;
  headline: string;
};

export type FunnelInput = {
  entered: number;
  spoke: number;
  questions: number;
  positions: number;
  turned: number;
};

/**
 * Ratios are stage-over-stage, and only the first three are true funnel stages —
 * you cannot speak in more rooms than you entered, but you can absolutely ask
 * four questions in one meeting. Questions and positions are therefore counts
 * with per-room *rates*, not percentages that would exceed 100 and look broken.
 */
export function funnel(input: FunnelInput): Funnel {
  const { entered, spoke, questions, positions, turned } = input;
  const pct = (n: number, d: number) => (d > 0 ? n / d : 0);

  const stages: FunnelStage[] = [
    { key: "entered", label: "Rooms entered", count: entered, ofPrevious: 1 },
    { key: "spoke", label: "Rooms you spoke in", count: spoke, ofPrevious: pct(spoke, entered) },
    {
      key: "questions",
      label: "Questions asked",
      count: questions,
      ofPrevious: pct(questions, spoke),
    },
    {
      key: "positions",
      label: "Positions taken",
      count: positions,
      ofPrevious: pct(positions, spoke),
    },
    { key: "turned", label: "Rooms you turned", count: turned, ofPrevious: pct(turned, spoke) },
  ];

  if (entered === 0) {
    return { stages, bottleneck: null, headline: "No debriefed rooms yet." };
  }

  const candidates = stages.slice(1);
  let worst = candidates[0]!;
  for (const s of candidates) if (s.ofPrevious < worst.ofPrevious) worst = s;

  return {
    stages,
    bottleneck: { key: worst.key, label: worst.label, ofPrevious: worst.ofPrevious },
    headline: headlineFor(input),
  };
}

function headlineFor(i: FunnelInput): string {
  if (i.spoke === 0) return "You have not spoken in any room yet. That is the only thing to fix.";
  if (i.spoke < i.entered)
    return `You spoke in ${i.spoke} of ${i.entered}. Silence is still the bottleneck.`;
  if (i.questions === 0) return "You spoke every time, but asked nothing. Load the Playbook.";
  if (i.positions === 0) return "You ask well. You have not once said what you think.";
  if (i.turned === 0) return "You contribute. Nothing you said has moved a decision yet.";
  return `${i.turned} room${i.turned === 1 ? "" : "s"} turned on something you said.`;
}

/** 0.42 → "42%". Rates above 1 are shown as multiples: 1.8 → "1.8×". */
export function ratio(n: number): string {
  if (n > 1) return `${n.toFixed(1)}×`;
  return `${Math.round(n * 100)}%`;
}
