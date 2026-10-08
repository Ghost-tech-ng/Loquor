// Lexicon Blitz — rounds and scoring.
//
// Distractors come from the target's neighbours in the glossary, because the
// glossary is authored in themed runs (scoping words together, conflict words
// together). Four words from the same run make you know the difference between
// "tractable" and "contingent"; four random words only make you recognise a shape.

export type BlitzQuestion = {
  word: string;
  meaning: string;
  options: string[];
};

export const BLITZ = {
  lengthMs: 60_000,
  base: 100,
  speedBonus: 60,
  /** Under this, the full speed bonus. */
  fastMs: 2000,
  /** Over this, none. */
  slowMs: 8000,
  maxMultiplier: 3,
} as const;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function makeQuestion(
  word: string,
  all: readonly { word: string; meaning: string }[],
  r: () => number
): BlitzQuestion | null {
  const i = all.findIndex((g) => g.word === word);
  if (i < 0 || all.length < 4) return null;
  const near = all
    .map((g, k) => ({ g, d: Math.abs(k - i) }))
    .filter(({ d }) => d > 0 && d <= 8)
    .map(({ g }) => g.word);
  const pool = near.length >= 3 ? near : all.filter((g) => g.word !== word).map((g) => g.word);
  const distractors = shuffle(pool, r).slice(0, 3);
  return { word, meaning: all[i]!.meaning, options: shuffle([word, ...distractors], r) };
}

/** Words to ask, due or seen first so the game is real review, then the rest. */
export function deck(
  preferred: readonly string[],
  all: readonly string[],
  r: () => number
): string[] {
  const known = new Set(all);
  const first = shuffle(preferred.filter((w) => known.has(w)), r);
  const taken = new Set(first);
  return [...first, ...shuffle(all.filter((w) => !taken.has(w)), r)];
}

export function multiplier(combo: number): number {
  return Math.min(BLITZ.maxMultiplier, 1 + Math.floor(combo / 3) * 0.5);
}

/** Points for an answer. `combo` is the streak including this answer. */
export function answerPoints(correct: boolean, ms: number, combo: number): number {
  if (!correct) return 0;
  const speed =
    ms <= BLITZ.fastMs
      ? 1
      : ms >= BLITZ.slowMs
        ? 0
        : 1 - (ms - BLITZ.fastMs) / (BLITZ.slowMs - BLITZ.fastMs);
  return Math.round((BLITZ.base + BLITZ.speedBonus * speed) * multiplier(combo));
}

/** FSRS grade for a recognition answer: wrong is Again, slow is Hard, fast is Easy. */
export function recognitionGrade(correct: boolean, ms: number): 1 | 2 | 3 | 4 {
  if (!correct) return 1;
  if (ms > 6000) return 2;
  if (ms < 2500) return 4;
  return 3;
}
