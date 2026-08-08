// The weekly synthesis.
//
// Everything on the Progress screen except this is arithmetic. This is the one
// place a model is asked to look at a week and say what happened — and it is
// given *only* figures that were already computed, never a transcript and never
// a raw recording. It cannot revise a number; it can only join numbers up.
//
// That separation is the same one that governs the scorecard (metrics.ts counts,
// judge.ts judges), and it matters more here, not less: a paragraph that says
// "your filler rate came down" while the chart above it goes up is worse than no
// paragraph, and the only reliable way to prevent that is to make the paragraph
// downstream of the chart rather than a second opinion about it.
//
// One instruction out, not five. PRD §7: one decision per screen. A synthesis
// that ends with a list is a synthesis you close without doing anything.

import { structured, str, LLMError, type Provider } from "./llm.ts";
import type { WeekStats } from "./progress.ts";

export type Synthesis = {
  /** One sentence: what this week actually was. */
  headline: string;
  /** What moved, and the figure that says so. */
  worked: string;
  /** What did not move. Never softened into a compliment. */
  stalled: string;
  /** The single thing to do next week. Specific enough to act on before thinking. */
  next_week: string;
  latencyMs: number;
};

export class SynthesisError extends Error {}

const SYSTEM = `You write one short weekly report for someone training to contribute more in meetings: to ask better questions, hedge less, use a wider active vocabulary, and be heard rather than merely present.

You are given ONLY computed figures. You have not heard the recordings. Never estimate, revise, invent or round a number that is not in the input, and never describe a metric that is marked "no data" as if it had a value. If the week is too thin to conclude anything, say that plainly — a report that manufactures a trend out of two sessions teaches the person to distrust every later one.

Write in the second person. No praise inflation, no encouragement, no exclamation marks, no "keep it up". Treat the reader as a competent adult reading an instrument.

headline   one sentence naming what this week was. Not a summary of every number — the one thing that characterises it.
worked     one sentence on what moved in the right direction, citing the specific figure. If nothing moved, say nothing moved.
stalled    one sentence on what did not move, or what was not attempted at all. An untouched drill is a finding, not an omission to be polite about.
next_week  ONE instruction for next week. One, not a list. Specific and small enough to start without deciding anything: name the drill, the count, or the behaviour. It must follow from the figures above, not from general advice about public speaking.

Delivery figures with a "≈" were produced by a transcriber that drops some filler words, so the true rate is at least that high. Treat them as a floor and do not describe a change smaller than about one per minute as meaningful.`;

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    worked: { type: "string" },
    stalled: { type: "string" },
    next_week: { type: "string" },
  },
  required: ["headline", "worked", "stalled", "next_week"],
  additionalProperties: false,
} as const;

export async function synthesise(
  args: {
    week: WeekStats;
    previous: WeekStats | null;
    /** Whether filler counts came from a transcriber that drops disfluencies. */
    approximate: boolean;
    /** Archetypes and scaffolds with the lowest running averages, worst first. */
    weakest: string[];
    /** Where the contribution funnel loses the most, if there is one. */
    bottleneck: string | null;
  },
  provider: Provider,
  apiKey: string
): Promise<Synthesis> {
  const user = `THIS WEEK
${describe(args.week, args.approximate)}

LAST WEEK
${args.previous ? describe(args.previous, args.approximate) : "No data — this is the first week."}

WEAKEST MOVES RIGHT NOW (worst first)
${args.weakest.length > 0 ? args.weakest.join(", ") : "Nothing drilled yet."}

CONTRIBUTION FUNNEL
${args.bottleneck ?? "No debriefed rooms yet."}`;

  let parsed: Record<string, unknown>;
  let latencyMs: number;
  try {
    const r = await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_weekly_synthesis", maxTokens: 700 },
      provider,
      apiKey
    );
    parsed = r.data;
    latencyMs = r.latencyMs;
  } catch (e) {
    throw e instanceof LLMError ? new SynthesisError(e.message) : e;
  }

  return {
    headline: str(parsed.headline),
    worked: str(parsed.worked),
    stalled: str(parsed.stalled),
    next_week: str(parsed.next_week),
    latencyMs,
  };
}

/**
 * The week as plain text. `no data` rather than `0` wherever a figure is null —
 * a model shown "filler rate: 0" will congratulate someone who did not speak.
 */
export function describe(w: WeekStats, approximate: boolean): string {
  const n = (v: number | null, digits = 1, prefix = "") =>
    v === null ? "no data" : `${prefix}${v.toFixed(digits)}`;

  return [
    `days practised: ${w.daysActive} of 7`,
    `arena sessions: ${w.sessions} (weekly target 5)`,
    `filler rate, median: ${n(w.fillerRate, 1, approximate ? "≈" : "")} per minute (target 5 or below)`,
    `pace, median: ${n(w.wpm, 0)} wpm (comfortable band 130-165)`,
    `hedge density, median: ${n(w.hedgeDensity, 1)}% of words`,
    `content score, mean: ${w.rubric === null ? "no data" : `${w.rubric.toFixed(1)} of 20`}`,
    `read-aloud accuracy, median: ${n(w.readAccuracy === null ? null : w.readAccuracy * 100, 0)}%`,
    `playbook questions drilled: ${w.drills.playbook}`,
    `argument scaffolds drilled: ${w.drills.scaffold}`,
    `networking role-plays: ${w.drills.roleplay}`,
    `drill score, mean: ${n(w.drillScore, 2)} of 4`,
    `real meetings debriefed: ${w.rooms} (weekly target 3)`,
    `of those, spoke in: ${w.spoke}; questions asked: ${w.questions}; positions taken: ${w.positions}; decisions turned: ${w.turned}`,
    `words reaching production: ${w.wordsProduced} (weekly target 8)`,
  ].join("\n");
}
