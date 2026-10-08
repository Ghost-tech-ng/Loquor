// No-Um Gauntlet — rounds, hearts and focus span.
//
// Each round is a longer stretch of talking. A filler costs a heart, and so does
// dead air, because going silent for three seconds is the other way of losing
// the thread. The score is seconds survived, which makes it a direct measure of
// how long you can hold a clean line of thought — the attention span the game
// is named for.

import type { Metrics } from "../../lib/metrics.ts";

export const ROUNDS_S = [20, 30, 45, 60, 75, 90] as const;
export const HEARTS = 3;

export type Slip = { at: number; kind: "filler" | "dead-air" };

/** Every heart-costing moment in a take, in seconds, in order. */
export function slips(m: Metrics): Slip[] {
  const out: Slip[] = [
    ...m.fillerMarks.map((f) => ({ at: f * m.durationS, kind: "filler" as const })),
    ...m.deadAirSpans.map(([a]) => ({ at: a * m.durationS, kind: "dead-air" as const })),
  ];
  return out.sort((a, b) => a.at - b.at);
}

/** Longest stretch without a slip, in seconds. Dead air does not count as clean. */
export function focusSpan(m: Metrics): number {
  const cuts: [number, number][] = [
    ...m.fillerMarks.map((f): [number, number] => [f * m.durationS, f * m.durationS]),
    ...m.deadAirSpans.map(([a, b]): [number, number] => [a * m.durationS, b * m.durationS]),
  ].sort((x, y) => x[0] - y[0]);
  let best = 0;
  let from = 0;
  for (const [a, b] of cuts) {
    best = Math.max(best, a - from);
    from = Math.max(from, b);
  }
  return Math.max(best, m.durationS - from);
}

export type RoundResult = {
  round: number;
  /** Seconds survived within this round. */
  survived: number;
  heartsLeft: number;
  slips: Slip[];
  cleared: boolean;
  focus: number;
};

export function judgeRound(round: number, heartsBefore: number, m: Metrics): RoundResult {
  const length = ROUNDS_S[round] ?? ROUNDS_S[ROUNDS_S.length - 1]!;
  const all = slips(m).filter((s) => s.at <= length + 1);
  let hearts = heartsBefore;
  let survived = Math.min(length, m.durationS);
  for (const s of all) {
    hearts--;
    if (hearts <= 0) {
      survived = Math.min(s.at, length);
      break;
    }
  }
  // Stopping early is not surviving: the round has to be talked through.
  const cleared = hearts > 0 && m.durationS >= length - 1.5;
  return {
    round,
    survived: Math.max(0, survived),
    heartsLeft: Math.max(0, hearts),
    slips: all,
    cleared,
    focus: focusSpan(m),
  };
}

export function totalSurvived(results: readonly RoundResult[]): number {
  return Math.round(results.reduce((a, r) => a + r.survived, 0));
}
