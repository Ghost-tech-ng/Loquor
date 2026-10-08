// FSRS-5, with two tracks per word.
//
// PRD §5.1: a word has two memories, and they decay at different rates.
// Recognition — you see "orthogonal" and know what it means — is cheap to form
// and slow to fade. Production — the word arrives unprompted, in the right slot,
// under time pressure, in front of people — is expensive and fades fast. A
// single schedule averages them and gets both wrong: it keeps showing you words
// you can already read, and stops showing you words you still cannot say.
//
// So every word carries two independent cards with their own stability and
// difficulty. The recognition card is graded by a tap or by reading the word
// aloud cleanly in a passage. The production card is graded by the speak-to-
// unlock judge, and nothing else can raise it.
//
// The algorithm itself is stock FSRS-5 with the published default weights. It is
// used unmodified deliberately — the parameters were fitted on hundreds of
// millions of real reviews, and hand-tuning them against intuition would be
// replacing evidence with taste.
//
// Pure module. No React, no network, no SQLite.

export type Track = "recognition" | "production";

/** 1 Again · 2 Hard · 3 Good · 4 Easy. The FSRS grade scale, unmodified. */
export type Grade = 1 | 2 | 3 | 4;

export type Card = {
  stability: number;
  difficulty: number;
  dueAt: number;
  lastAt: number;
  reps: number;
  lapses: number;
};

// FSRS-5 defaults (19 parameters).
const W: readonly number[] = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

/** Indexed access with the checker satisfied; W is fixed-length by construction. */
const w = (i: number): number => W[i] as number;

const DECAY = -0.5;
const FACTOR = 19 / 81;

const DAY_MS = 86_400_000;

/** The retention the schedule aims for. 0.9 is the FSRS default and a good one. */
export const REQUEST_RETENTION = 0.9;

/**
 * Probability the word is still available, t days after the last review.
 * This is the number everything else is derived from.
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * (Math.max(0, elapsedDays) / stability), DECAY);
}

/** Days until retrievability decays to `retention`. */
export function intervalFor(stability: number, retention = REQUEST_RETENTION): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

function clampDifficulty(d: number): number {
  return Math.min(10, Math.max(1, d));
}

function initialDifficulty(g: Grade): number {
  return clampDifficulty(w(4) - Math.exp(w(5) * (g - 1)) + 1);
}

function nextDifficulty(d: number, g: Grade): number {
  const delta = -w(6) * (g - 3);
  const damped = d + delta * ((10 - d) / 9);
  // Mean reversion toward the difficulty an "easy" first answer would imply.
  return clampDifficulty(w(7) * initialDifficulty(4) + (1 - w(7)) * damped);
}

function stabilityAfterRecall(d: number, s: number, r: number, g: Grade): number {
  const hard = g === 2 ? w(15) : 1;
  const easy = g === 4 ? w(16) : 1;
  return (
    s *
    (1 +
      Math.exp(w(8)) *
        (11 - d) *
        Math.pow(s, -w(9)) *
        (Math.exp(w(10) * (1 - r)) - 1) *
        hard *
        easy)
  );
}

function stabilityAfterLapse(d: number, s: number, r: number): number {
  const next =
    w(11) * Math.pow(d, -w(12)) * (Math.pow(s + 1, w(13)) - 1) * Math.exp(w(14) * (1 - r));
  // FSRS-5: a lapse can never leave you better off than you were.
  return Math.min(next, s);
}

function shortTermStability(s: number, g: Grade): number {
  return s * Math.exp(w(17) * (g - 3 + w(18)));
}

/**
 * The card for a word being introduced. `dueAt` is now — a new word is reviewed
 * in the same session it is introduced, which is the single highest-value
 * repetition in the whole schedule.
 */
export function newCard(now = Date.now()): Card {
  return { stability: 0, difficulty: 0, dueAt: now, lastAt: 0, reps: 0, lapses: 0 };
}

export function isNew(card: Card): boolean {
  return card.reps === 0 || card.stability <= 0;
}

/**
 * Grade a review and produce the next card. Pure — takes the clock rather than
 * reading it, so the tests can move time around.
 */
export function review(card: Card, grade: Grade, now = Date.now()): Card {
  if (isNew(card)) {
    const stability = w(grade - 1);
    const difficulty = initialDifficulty(grade);
    return {
      stability,
      difficulty,
      dueAt: now + Math.round(scheduleDays(stability, grade) * DAY_MS),
      lastAt: now,
      reps: 1,
      lapses: grade === 1 ? 1 : 0,
    };
  }

  const elapsedDays = (now - card.lastAt) / DAY_MS;
  const r = retrievability(elapsedDays, card.stability);

  // Reviewed again the same day: the memory has not had time to decay, so the
  // long-term formula would read the near-perfect recall as evidence of strength
  // it has not earned. FSRS-5 has a separate, much flatter curve for this.
  const sameDay = elapsedDays < 1;

  const difficulty = nextDifficulty(card.difficulty, grade);
  const stability = sameDay
    ? shortTermStability(card.stability, grade)
    : grade === 1
      ? stabilityAfterLapse(difficulty, card.stability, r)
      : stabilityAfterRecall(difficulty, card.stability, r, grade);

  return {
    stability,
    difficulty,
    dueAt: now + Math.round(scheduleDays(stability, grade) * DAY_MS),
    lastAt: now,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 1 ? 1 : 0),
  };
}

/**
 * Interval in days, floored at ten minutes for a lapse. A word you just failed
 * should come back inside the session — pushing it to tomorrow means the only
 * thing you practised today was getting it wrong.
 */
function scheduleDays(stability: number, grade: Grade): number {
  if (grade === 1) return 10 / (60 * 24);
  const days = intervalFor(stability);
  return Math.min(365, Math.max(1, Math.round(days)));
}

/**
 * The threshold at which a word counts as owned on its track: three weeks of
 * stability, meaning FSRS expects you to still have it in three weeks without
 * being shown it. Chosen because it is the point where the interval starts
 * outrunning the app's own review cadence.
 */
export const OWNED_STABILITY_DAYS = 21;

export function owned(card: Card): boolean {
  return card.stability >= OWNED_STABILITY_DAYS;
}

/**
 * A real-world use is worth more than any number of drills, because it is the
 * only evidence collected outside the conditions the drill created. Rather than
 * inventing a fifth grade, it is applied as a stability multiplier with a floor:
 * whatever the schedule thought, you have now demonstrated more than it knew.
 */
export const REAL_USE_MULTIPLIER = 1.6;
export const REAL_USE_FLOOR_DAYS = 14;

export function creditRealUse(card: Card, now = Date.now()): Card {
  const stability = Math.max(card.stability * REAL_USE_MULTIPLIER, REAL_USE_FLOOR_DAYS);
  return {
    ...card,
    stability,
    dueAt: now + Math.round(Math.min(365, intervalFor(stability)) * DAY_MS),
    lastAt: now,
  };
}

/** Human-readable interval, for the review screen's "next in" line. */
export function describeInterval(ms: number): string {
  const mins = ms / 60_000;
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
  const days = ms / DAY_MS;
  if (days < 1) return `${Math.round(ms / 3_600_000)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  const months = days / 30.4;
  if (months < 12) return `${Math.round(months)} mo`;
  return `${(days / 365).toFixed(1)} y`;
}
