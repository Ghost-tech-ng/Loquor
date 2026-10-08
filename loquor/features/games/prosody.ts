// Liveliness: why a voice sounds like it is reading.
//
// Three things separate a reading voice from a talking one, and each is
// measurable without a model:
//
//   Melody — pitch moves when you mean something. A reading voice sits within
//     two or three semitones; a lively one ranges six to eight or more.
//   Punch  — loudness moves too. Stressed words come out louder, asides drop.
//     Reading flattens that into one level.
//   Rhythm — talking is uneven: some words stretch, some rush, pauses land at
//     the ends of thoughts. Reading ticks like a metronome.
//
// Melody needs the pitch line, which only exists when audio could be sampled.
// Punch and rhythm need only the meter and the word timestamps every take
// already has, so the Arena and Reading get them for free.

import type { PitchPoint } from "./pitch.ts";
import { semitones } from "./pitch.ts";
import type { Word } from "../../lib/metrics.ts";
import { isFiller } from "../../lib/lexicon.ts";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function cv(xs: readonly number[]): number {
  const m = mean(xs);
  if (xs.length < 2 || m === 0) return 0;
  const variance = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(variance) / m;
}

export type MelodyReading = {
  /** p10–p90 spread in semitones. */
  rangeSt: number;
  /** Median semitone change between neighbouring voiced frames. */
  movementSt: number;
  score: number;
};

/** Below this many voiced frames there is not enough melody to judge. */
export const MIN_VOICED = 25;

export function melody(points: readonly PitchPoint[]): MelodyReading | null {
  const voiced = points.filter((p) => p.clarity >= 0.7);
  if (voiced.length < MIN_VOICED) return null;
  const st = voiced.map((p) => semitones(p.hz));
  const sorted = [...st].sort((a, b) => a - b);
  const rangeSt = quantile(sorted, 0.9) - quantile(sorted, 0.1);

  // Movement within a phrase only: a jump across a pause is a new phrase, not glide.
  const steps: number[] = [];
  for (let i = 1; i < voiced.length; i++) {
    if (voiced[i]!.t - voiced[i - 1]!.t <= 0.1) steps.push(Math.abs(st[i]! - st[i - 1]!));
  }
  const movementSt = quantile([...steps].sort((a, b) => a - b), 0.5);

  // 2.5 st reads as monotone, 8 st as fully alive. Movement is the tiebreaker.
  const range = clamp01((rangeSt - 2.5) / 5.5);
  const move = clamp01((movementSt - 0.15) / 0.45);
  return { rangeSt, movementSt, score: Math.round(100 * (0.8 * range + 0.2 * move)) };
}

export type PunchReading = { spreadDb: number; score: number };

/**
 * Loudness dynamics from meter readings in dBFS. Only the frames where you are
 * talking count — silence would make every take look dynamic.
 */
export function punch(levelsDb: readonly number[]): PunchReading | null {
  const finite = levelsDb.filter((d) => Number.isFinite(d) && d > -90);
  if (finite.length < 20) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const floor = quantile(sorted, 0.1);
  const peak = quantile(sorted, 0.95);
  const gate = floor + (peak - floor) * 0.35;
  const speaking = sorted.filter((d) => d >= gate);
  if (speaking.length < 10) return null;
  const spreadDb = quantile(speaking, 0.9) - quantile(speaking, 0.2);
  // 3 dB is a flat read; 10 dB and up is someone leaning on their words.
  return { spreadDb, score: Math.round(100 * clamp01((spreadDb - 3) / 7)) };
}

export type RhythmReading = {
  /** Variation in time spent per letter, word to word. */
  durationCv: number;
  /** Variation in the gaps between words. */
  gapCv: number;
  score: number;
};

export function rhythm(words: readonly Word[]): RhythmReading | null {
  const content = words.filter((w) => !isFiller(w.word) && w.end > w.start);
  if (content.length < 8) return null;
  const perLetter = content.map((w) => (w.end - w.start) / Math.max(2, w.word.replace(/[^a-z]/gi, "").length));
  const gaps: number[] = [];
  for (let i = 1; i < content.length; i++) gaps.push(Math.max(0, content[i]!.start - content[i - 1]!.end));

  const durationCv = cv(perLetter);
  // Gaps cluster at zero in fluent speech; the shape that matters is whether a
  // few long ones stand out, so measure spread against a small floor.
  const gapCv = cv(gaps.map((g) => g + 0.05));

  const dur = clamp01((durationCv - 0.25) / 0.35);
  const gap = clamp01((gapCv - 0.5) / 1.0);
  return { durationCv, gapCv, score: Math.round(100 * (0.55 * dur + 0.45 * gap)) };
}

export type Liveliness = {
  score: number;
  melody: MelodyReading | null;
  punch: PunchReading | null;
  rhythm: RhythmReading | null;
  label: LivelinessLabel;
};

export type LivelinessLabel = "Robot" | "Reading" | "Talking" | "Alive";

export function labelFor(score: number): LivelinessLabel {
  if (score < 35) return "Robot";
  if (score < 55) return "Reading";
  if (score < 75) return "Talking";
  return "Alive";
}

/** Whatever parts are measurable, weighted; null when none are. */
export function liveliness(args: {
  points?: readonly PitchPoint[];
  levelsDb?: readonly number[];
  words?: readonly Word[];
}): Liveliness | null {
  const m = args.points ? melody(args.points) : null;
  const p = args.levelsDb ? punch(args.levelsDb) : null;
  const r = args.words ? rhythm(args.words) : null;
  const parts: [number, number][] = [];
  if (m) parts.push([m.score, 0.45]);
  if (p) parts.push([p.score, 0.3]);
  if (r) parts.push([r.score, 0.25]);
  if (parts.length === 0) return null;
  const weight = parts.reduce((a, [, w]) => a + w, 0);
  const score = Math.round(parts.reduce((a, [s, w]) => a + s * w, 0) / weight);
  return { score, melody: m, punch: p, rhythm: r, label: labelFor(score) };
}

/**
 * How different several deliveries of the same line were, 0..100. Saying it as
 * gossip and as commentary should not produce the same melody and loudness.
 */
export function contrast(takes: readonly Liveliness[]): number {
  if (takes.length < 2) return 0;
  const feature = (l: Liveliness) => [
    l.melody ? l.melody.rangeSt / 8 : 0,
    l.punch ? l.punch.spreadDb / 10 : 0,
    l.rhythm ? l.rhythm.durationCv / 0.6 : 0,
    l.score / 100,
  ];
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < takes.length; i++) {
    for (let j = i + 1; j < takes.length; j++) {
      const a = feature(takes[i]!);
      const b = feature(takes[j]!);
      total += Math.sqrt(a.reduce((acc, x, k) => acc + (x - b[k]!) ** 2, 0));
      pairs++;
    }
  }
  return Math.round(100 * clamp01(total / pairs / 0.6));
}

/** Did the highlighted word stand out: louder, longer or higher than its neighbours? */
export function emphasis(args: {
  words: readonly Word[];
  target: number;
  levelsDb?: readonly number[];
  /** Seconds per meter reading. */
  levelStep?: number;
  points?: readonly PitchPoint[];
}): { louder: boolean; longer: boolean; higher: boolean; hit: boolean } {
  const { words, target } = args;
  const w = words[target];
  if (!w) return { louder: false, longer: false, higher: false, hit: false };
  const around = words.filter((_, i) => i !== target && Math.abs(i - target) <= 4);

  const perLetter = (x: Word) => (x.end - x.start) / Math.max(2, x.word.replace(/[^a-z]/gi, "").length);
  const longer = around.length > 0 && perLetter(w) > 1.3 * mean(around.map(perLetter));

  const step = args.levelStep ?? 0.1;
  const levelIn = (x: Word) => {
    const lv = args.levelsDb ?? [];
    const slice = lv.slice(Math.floor(x.start / step), Math.ceil(x.end / step) + 1);
    return slice.length ? Math.max(...slice) : -160;
  };
  const louder =
    args.levelsDb !== undefined &&
    around.length > 0 &&
    levelIn(w) > mean(around.map(levelIn)) + 2.5;

  const pitchIn = (x: Word) => {
    const ps = (args.points ?? []).filter((p) => p.t >= x.start && p.t <= x.end);
    return ps.length ? Math.max(...ps.map((p) => semitones(p.hz))) : null;
  };
  const mine = pitchIn(w);
  const theirs = around.map(pitchIn).filter((x): x is number => x !== null);
  const higher = mine !== null && theirs.length > 0 && mine > mean(theirs) + 1.5;

  return { louder, longer, higher, hit: louder || longer || higher };
}
