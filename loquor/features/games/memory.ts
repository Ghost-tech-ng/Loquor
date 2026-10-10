// Memory Gym — levels, generators and scoring for the three memory games.
//
// The three are the most studied ways to work memory, one per kind of load:
// Pip Says is a spatial span (Corsi blocks), Echo is n-back (holding a moving
// window and updating it), and Word Chain is serial recall of a word list.
// Talking needs all three: holding your point while you build the sentence,
// dropping the last clause for the next, and landing your points in order.
//
// Every run is one level. A passed run's score is that level, a missed run
// scores 0, so MAX(score) is the highest level cleared and the next one is
// unlocked. Nothing about levels is stored that the run history does not say.

import { rng, shuffle } from "./blitz.ts";
import { streakOf, type Streak } from "../progression/streak.ts";

export type MemoryGameId = "span" | "nback" | "chain";

export const MEMORY_GAMES: readonly MemoryGameId[] = ["span", "nback", "chain"];

export const MAX_LEVEL: Record<MemoryGameId, number> = { span: 12, nback: 10, chain: 10 };

/** The level to offer: one past the best cleared, capped at the top. */
export function unlockedLevel(game: MemoryGameId, best: number | null): number {
  return Math.min(MAX_LEVEL[game], Math.max(1, (best ?? 0) + 1));
}

export function clampLevel(game: MemoryGameId, level: number): number {
  return Math.min(MAX_LEVEL[game], Math.max(1, Math.round(level)));
}

// ── Pip Says (spatial span) ──────────────────────────────────────────────────

export type SpanLevel = {
  /** Tiles to remember. */
  length: number;
  /** Tiles per side. */
  side: number;
  /** How long each tile stays lit, and the gap after it. */
  onMs: number;
  offMs: number;
  trials: number;
  /** Trials that must be perfect to clear the level. */
  toPass: number;
};

export function spanLevel(level: number): SpanLevel {
  const l = clampLevel("span", level);
  return {
    length: l + 2,
    side: l <= 5 ? 3 : 4,
    onMs: Math.max(380, 640 - l * 22),
    offMs: Math.max(160, 260 - l * 8),
    trials: 3,
    toPass: 2,
  };
}

/** A sequence of tile indexes. A tile can come back, but never twice in a row. */
export function spanSequence(lv: SpanLevel, r: () => number): number[] {
  const tiles = lv.side * lv.side;
  const out: number[] = [];
  while (out.length < lv.length) {
    const t = Math.floor(r() * tiles);
    if (t !== out[out.length - 1]) out.push(t);
  }
  return out;
}

/** Taps judged as they come: the index of the first wrong tap, or -1 while all are right. */
export function firstSlip(target: readonly number[], taps: readonly number[]): number {
  for (let i = 0; i < taps.length; i++) if (taps[i] !== target[i]) return i;
  return -1;
}

// ── Echo (n-back) ────────────────────────────────────────────────────────────

/** Letters that do not sound or look like one another. */
export const ECHO_LETTERS = ["B", "F", "H", "K", "M", "Q", "R", "T"] as const;

export type NbackLevel = {
  n: number;
  /** Time each letter has on screen, including the blank after it. */
  stepMs: number;
  length: number;
  targets: number;
  /** The share of targets you must catch, after false alarms are taken off. */
  toPass: number;
};

// Odd levels introduce a new n at an easy pace; the even level after it is the
// same n, faster. So 2-back arrives at level 3, and 5-back at level 9.
export function nbackLevel(level: number): NbackLevel {
  const l = clampLevel("nback", level);
  const n = Math.ceil(l / 2);
  const length = 20 + n;
  return {
    n,
    stepMs: l % 2 === 1 ? 2600 : 2000,
    length,
    targets: Math.round(20 * 0.3),
    toPass: 0.7,
  };
}

/**
 * A stream with exactly `targets` positions that match the letter n back, and
 * no accidental matches anywhere else. Accidental ones would make the count of
 * targets a lie and punish a correct "no".
 */
export function nbackStream(lv: NbackLevel, r: () => number): { letters: string[]; isTarget: boolean[] } {
  const eligible = Array.from({ length: lv.length - lv.n }, (_, i) => i + lv.n);
  const targetAt = new Set(shuffle(eligible, r).slice(0, lv.targets));
  const letters: string[] = [];
  const isTarget: boolean[] = [];
  for (let i = 0; i < lv.length; i++) {
    const back = i >= lv.n ? letters[i - lv.n] : undefined;
    if (back !== undefined && targetAt.has(i)) {
      letters.push(back);
      isTarget.push(true);
      continue;
    }
    const pool = ECHO_LETTERS.filter((c) => c !== back);
    letters.push(pool[Math.floor(r() * pool.length)]!);
    isTarget.push(false);
  }
  return { letters, isTarget };
}

export type NbackTally = { hits: number; misses: number; falseAlarms: number; targets: number };

export function nbackTally(isTarget: readonly boolean[], pressed: readonly boolean[]): NbackTally {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let targets = 0;
  for (let i = 0; i < isTarget.length; i++) {
    if (isTarget[i]) {
      targets++;
      if (pressed[i]) hits++;
      else misses++;
    } else if (pressed[i]) {
      falseAlarms++;
    }
  }
  return { hits, misses, falseAlarms, targets };
}

/** 0..1: targets caught, less one for every false alarm, so pressing on everything scores nothing. */
export function nbackAccuracy(t: NbackTally): number {
  if (t.targets === 0) return 0;
  return Math.max(0, t.hits - t.falseAlarms) / t.targets;
}

// ── Word Chain (serial recall) ───────────────────────────────────────────────

// Concrete, picturable nouns: the easiest kind of word to hold, so the level is
// about how many you can keep in order, not about whether you know the word.
export const CHAIN_WORDS = [
  "anchor", "apple", "arrow", "badge", "basket", "bell", "blanket", "bottle", "bridge", "brush",
  "bucket", "button", "cabin", "camera", "candle", "canoe", "carpet", "castle", "chair", "cherry",
  "clock", "cloud", "coin", "comb", "compass", "crown", "cup", "curtain", "desk", "drum",
  "eagle", "engine", "feather", "fence", "flag", "flute", "fork", "fountain", "garden", "ghost",
  "glove", "guitar", "hammer", "harbor", "helmet", "honey", "island", "jacket", "kettle", "key",
  "kite", "ladder", "lamp", "lemon", "letter", "lighthouse", "lion", "magnet", "mirror", "monkey",
  "moon", "needle", "nest", "ocean", "orange", "owl", "paddle", "parrot", "pencil", "piano",
  "pillow", "planet", "pocket", "pumpkin", "rabbit", "ribbon", "river", "rocket", "saddle", "scarf",
  "shell", "shovel", "spoon", "stamp", "statue", "suitcase", "sword", "table", "tiger", "tent",
  "ticket", "tower", "train", "trumpet", "tunnel", "umbrella", "violin", "wagon", "wallet", "whistle",
  "window", "wolf", "zebra",
] as const;

export type ChainLevel = {
  words: number;
  /** Time each word is on screen, and the blank after it. */
  showMs: number;
  gapMs: number;
  /** Words on the board at recall: the list plus decoys. */
  board: number;
  trials: number;
  /** Share of all slots that must hold the right word in the right place. */
  toPass: number;
};

export function chainLevel(level: number): ChainLevel {
  const l = clampLevel("chain", level);
  const words = l + 3;
  return {
    words,
    showMs: Math.max(900, 1400 - l * 50),
    gapMs: 300,
    board: Math.min(16, words + Math.max(3, Math.ceil(words / 2))),
    trials: 2,
    toPass: 0.8,
  };
}

/** The list to remember, and the board to rebuild it from. */
export function chainRound(lv: ChainLevel, r: () => number): { list: string[]; board: string[] } {
  const picked = shuffle(CHAIN_WORDS, r).slice(0, lv.board);
  const list = picked.slice(0, lv.words);
  return { list, board: shuffle(picked, r) };
}

/** Slots holding the right word in the right place. */
export function chainCorrect(list: readonly string[], answer: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (answer[i] === list[i]) n++;
  return n;
}

// ── Runs ─────────────────────────────────────────────────────────────────────

/** The score a run saves: the level when cleared, 0 when not. */
export function runScore(level: number, passed: boolean): number {
  return passed ? level : 0;
}

/** Which of the three games were played today. */
export type Workout = {
  done: Record<MemoryGameId, boolean>;
  count: number;
  complete: boolean;
};

export function workoutOf(playedToday: Iterable<string>): Workout {
  const played = new Set(playedToday);
  const done = { span: played.has("span"), nback: played.has("nback"), chain: played.has("chain") };
  const count = MEMORY_GAMES.filter((g) => done[g]).length;
  return { done, count, complete: count === MEMORY_GAMES.length };
}

/** Everything the hub shows, from the run history alone. `day` is a local day number. */
export type MemorySummary = {
  best: Record<MemoryGameId, number>;
  next: Record<MemoryGameId, number>;
  workout: Workout;
  /** Days with any Memory Gym run, with the main streak's freezes. */
  streak: Streak;
  /** Days on which all three were played. */
  fullDays: number;
};

export function memorySummary(runs: readonly { game: string; day: number; score: number }[], today: number): MemorySummary {
  const best: Record<MemoryGameId, number> = { span: 0, nback: 0, chain: 0 };
  const byDay = new Map<number, Set<string>>();
  for (const r of runs) {
    if (!(MEMORY_GAMES as readonly string[]).includes(r.game)) continue;
    const g = r.game as MemoryGameId;
    best[g] = Math.max(best[g], r.score);
    const set = byDay.get(r.day) ?? new Set<string>();
    set.add(g);
    byDay.set(r.day, set);
  }
  let fullDays = 0;
  for (const set of byDay.values()) if (set.size === MEMORY_GAMES.length) fullDays++;
  return {
    best,
    next: {
      span: unlockedLevel("span", best.span),
      nback: unlockedLevel("nback", best.nback),
      chain: unlockedLevel("chain", best.chain),
    },
    workout: workoutOf(byDay.get(today) ?? []),
    streak: streakOf([...byDay.keys()], today),
    fullDays,
  };
}

export { rng };
