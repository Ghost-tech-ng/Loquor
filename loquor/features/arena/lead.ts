// The one sentence a scorecard opens with.
//
// Six rails and a rubric is a lot to read after talking for two minutes, and
// most people only want to know whether that went better. So the card leads with
// a count and a comparison you can take in at a glance, and keeps the rest behind
// "See details". Pure, so node can test the wording.

import { FILLER_TARGET_PER_MIN } from "../../lib/metrics.ts";

export type LeadTake = { id: string; started_at: number; filler_rate: number };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function fillerCount(n: number): string {
  if (n === 0) return "No fillers";
  return `${n} filler${n === 1 ? "" : "s"}`;
}

export function leadLine({
  take,
  count,
  others,
  parentRate,
}: {
  take: LeadTake;
  count: number;
  /** Earlier takes, any order. Only the seven days before this one are compared. */
  others: readonly LeadTake[];
  /** Filler rate of the first take when this one is a rewrite. */
  parentRate: number | null;
}): string {
  const head = fillerCount(count);
  const rate = take.filler_rate;

  if (parentRate !== null) {
    if (rate < parentRate - 0.05) return `${head}. Cleaner than your first take.`;
    if (rate > parentRate + 0.05) return `${head}. The first take was cleaner; the rewrite is about the sentence.`;
    return `${head}. Level with your first take.`;
  }

  const week = others.filter(
    (o) => o.id !== take.id && o.started_at < take.started_at && take.started_at - o.started_at <= WEEK_MS
  );
  if (week.length > 0) {
    const best = Math.min(...week.map((o) => o.filler_rate));
    if (rate < best) return `${head}. Your best this week.`;
    if (rate <= FILLER_TARGET_PER_MIN) return `${head}. Under the line nobody notices.`;
    return `${head}. Your best this week was ${best.toFixed(1)} a minute.`;
  }

  if (rate <= FILLER_TARGET_PER_MIN) return `${head}. Under the line nobody notices.`;
  if (rate <= 12) return `${head}. Audible, not costly yet.`;
  return `${head}. Enough that people will remember them.`;
}
