// Deterministic delivery metrics.
//
// These are computed from the transcript and word timestamps, never by the LLM
// (PRD §5). That is a deliberate architectural line: an LLM asked "how many
// filler words?" will give a different answer on Tuesday than it gave on Monday
// for identical audio, which makes a 90-day trend meaningless. Arithmetic does
// not drift.
//
// Pure module — no React, no React Native, no network. Node can run it directly,
// which is how it gets tested.

// Explicit .ts extension: Metro resolves it, and it lets `node --test` run this
// module directly with type-stripping so the metrics have real unit tests.
import { countHedges, isFiller, normalise } from "./lexicon.ts";

export type Word = {
  word: string;
  start: number; // seconds
  end: number;   // seconds
};

/** Gaps longer than this count as dead air. Below it, a pause is just punctuation. */
export const DEAD_AIR_THRESHOLD_S = 2.5;

/** From the parametric filler study: 5/min is invisible to listeners, 12/min measurably damages you. */
export const FILLER_TARGET_PER_MIN = 5;

/** Comfortable presentation range. Outside it you are either rushing or dragging. */
export const PACE_BAND_WPM = { low: 130, high: 165 } as const;

export type Metrics = {
  durationS: number;
  wordCount: number;        // content words, fillers excluded
  fillerCount: number;
  fillerRate: number;       // per minute
  wpm: number;
  hedgeCount: number;
  hedgeDensity: number;     // percent of content words
  deadAirCount: number;
  deadAirTotalS: number;
  longestGapS: number;
  /** Filler positions as 0..1 fractions of the take. Drives the scorecard markers. */
  fillerMarks: number[];
  /** Dead-air spans as [start, end] 0..1 fractions. Drawn as gaps in the spectrogram. */
  deadAirSpans: [number, number][];
};

export function computeMetrics(words: Word[], fallbackDurationS?: number): Metrics {
  const empty: Metrics = {
    durationS: fallbackDurationS ?? 0,
    wordCount: 0,
    fillerCount: 0,
    fillerRate: 0,
    wpm: 0,
    hedgeCount: 0,
    hedgeDensity: 0,
    deadAirCount: 0,
    deadAirTotalS: 0,
    longestGapS: 0,
    fillerMarks: [],
    deadAirSpans: [],
  };

  if (words.length === 0) return empty;

  const first = words[0]!;
  const last = words[words.length - 1]!;

  // Prefer the recorder's duration: it includes leading and trailing silence,
  // which is exactly where dead air hides. Falling back to the span between the
  // first and last word would silently forgive a four-second stall before you
  // start talking.
  const spanS = Math.max(0, last.end - first.start);
  const durationS = fallbackDurationS && fallbackDurationS > spanS ? fallbackDurationS : spanS;
  if (durationS <= 0) return { ...empty, durationS: 0 };

  const minutes = durationS / 60;
  const origin = fallbackDurationS && fallbackDurationS > spanS ? 0 : first.start;
  const frac = (t: number) => clamp01((t - origin) / durationS);

  const fillerMarks: number[] = [];
  let fillerCount = 0;
  const contentWords: Word[] = [];

  for (const w of words) {
    if (isFiller(w.word)) {
      fillerCount++;
      fillerMarks.push(frac(w.start));
    } else {
      contentWords.push(w);
    }
  }

  // Dead air is measured across every word, filler included. An "um" filling a
  // four-second gap is still a four-second gap, and it should not be scored as
  // fluent just because a sound came out.
  const deadAirSpans: [number, number][] = [];
  let deadAirTotalS = 0;
  let longestGapS = 0;

  for (let i = 1; i < words.length; i++) {
    const gap = words[i]!.start - words[i - 1]!.end;
    if (gap > longestGapS) longestGapS = gap;
    if (gap > DEAD_AIR_THRESHOLD_S) {
      deadAirTotalS += gap;
      deadAirSpans.push([frac(words[i - 1]!.end), frac(words[i]!.start)]);
    }
  }

  const transcript = contentWords.map((w) => w.word).join(" ");
  const hedgeCount = countHedges(transcript);
  const wordCount = contentWords.length;

  return {
    durationS: round(durationS, 2),
    wordCount,
    fillerCount,
    fillerRate: round(fillerCount / minutes, 2),
    wpm: Math.round(wordCount / minutes),
    hedgeCount,
    hedgeDensity: wordCount === 0 ? 0 : round((hedgeCount / wordCount) * 100, 2),
    deadAirCount: deadAirSpans.length,
    deadAirTotalS: round(deadAirTotalS, 2),
    longestGapS: round(Math.max(0, longestGapS), 2),
    fillerMarks,
    deadAirSpans,
  };
}

/**
 * Where a value sits inside its target band, 0..1, for the marker on the metric
 * rail. Never a grade and never a verdict — PRD §12 interaction principle 5.
 */
export function bandPosition(value: number, low: number, high: number): number {
  const pad = (high - low) * 0.6;
  return clamp01((value - (low - pad)) / (high - low + pad * 2));
}

export function fillerVerdict(rate: number): "on-target" | "drifting" | "over" {
  if (rate <= FILLER_TARGET_PER_MIN) return "on-target";
  if (rate <= 12) return "drifting";
  return "over";
}

/**
 * Splits a timestamped transcript into sentences, keeping the timing so a single
 * sentence can be replayed or re-recorded. Whisper punctuates, so terminal marks
 * are the signal; the length cap catches the run-ons where it doesn't.
 */
export function toSentences(words: Word[]): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let buf: Word[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    out.push({
      text: buf.map((w) => w.word).join(" ").replace(/\s+([.,!?;:])/g, "$1").trim(),
      start: buf[0]!.start,
      end: buf[buf.length - 1]!.end,
    });
    buf = [];
  };

  for (const w of words) {
    buf.push(w);
    if (/[.!?]$/.test(w.word.trim()) || buf.length >= 40) flush();
  }
  flush();
  return out.filter((s) => normalise(s.text).length > 0);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
