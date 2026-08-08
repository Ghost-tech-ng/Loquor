// Scoring a read-aloud take.
//
// The Arena scores speech you invented. This scores speech against a text we
// already have, which makes a different and much sharper signal available: we
// know exactly what you were supposed to say, so every divergence is locatable.
//
// The honest limit, stated up front because the UI has to state it too:
//
//   Whisper is trained to be robust to accent. It will cheerfully transcribe a
//   mangled "epitome" as "epitome" because the context makes it the only
//   plausible word. So a word that comes back wrong is strong evidence you said
//   it wrong; a word that comes back right is weak evidence you said it right.
//   This is a stumble detector, not a pronunciation score. Presenting it as the
//   latter would be a lie, and a demoralising one.
//
// What is *not* limited by that: pace, phrasing against punctuation, and
// hesitation. Those come from word timings and are exactly as reliable here as
// in the Arena — arguably more, since the text is fixed and the only variable
// left is delivery.
//
// Pure module. No React, no network, so `node --experimental-strip-types --test`
// runs it directly.

import type { Word } from "./metrics.ts";

/** A pause shorter than this is not a pause, it is the gap between two words. */
export const PHRASE_PAUSE_MIN_S = 0.18;

/** Long enough at a place with no punctuation that a listener hears searching. */
export const HESITATION_S = 0.7;

/** Reading aloud well is slower than speaking. Faster than this is rushing. */
export const READ_BAND_WPM = { low: 120, high: 150 } as const;

export type TokenStatus = "clean" | "altered" | "missed";

export type ReadToken = {
  index: number;
  ref: string;
  status: TokenStatus;
  /** What came back instead. Absent when the word simply did not appear. */
  heard?: string;
  start?: number;
  end?: number;
  /** Set when this token is part of one of the passage's target words. */
  target?: string;
};

export type ReadingScore = {
  durationS: number;
  wpm: number;
  /** Percent of reference words that came back intact. */
  accuracy: number;
  /** The same figure computed over target words only, or null if none were tagged. */
  targetAccuracy: number | null;
  /** Words you added that are not in the text. Usually self-corrections. */
  insertions: number;
  /** Every divergence, targets first, then in reading order. */
  stumbles: ReadToken[];
  /** Punctuation marks you actually breathed at, over the number available. */
  phrasing: { honoured: number; available: number };
  /** Long gaps at places with no punctuation — searching for the next word. */
  hesitations: number;
  longestGapS: number;
  tokens: ReadToken[];
};

/**
 * The canonical tokenisation for read-aloud material. `content/readings.ts`
 * imports this so the text a section is graded against can never drift from
 * the text targets were located in.
 *
 * Hyphens become spaces: "load-bearing" is two tokens, because Whisper returns
 * it as two words and a scorer that disagreed with the transcriber about word
 * boundaries would report a stumble on every compound in the corpus.
 */
export function tokenizeReference(text: string): { tokens: string[]; breakAfter: boolean[] } {
  const tokens: string[] = [];
  const breakAfter: boolean[] = [];

  const chunks = text.replace(/[‘’]/g, "'").split(/\s+/);
  for (const chunk of chunks) {
    // A dash standing alone is a phrasing mark attached to the previous word.
    if (/^[-–—]+$/.test(chunk)) {
      if (breakAfter.length > 0) breakAfter[breakAfter.length - 1] = true;
      continue;
    }
    const ends = /[.,;:!?…–—]$/.test(chunk.replace(/["')\]]+$/, ""));
    const cleaned = chunk
      .toLowerCase()
      .replace(/[-–—]/g, " ")
      .replace(/[^a-z0-9'\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;

    const parts = cleaned.split(" ");
    for (let i = 0; i < parts.length; i++) {
      tokens.push(parts[i]!);
      breakAfter.push(ends && i === parts.length - 1);
    }
  }
  return { tokens, breakAfter };
}

function normaliseHeard(word: string): string {
  return word
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Op = { kind: "match" | "sub" | "del" | "ins"; r: number; h: number };

/**
 * Levenshtein alignment over word tokens, with backtrace. Equal costs for
 * substitution, deletion and insertion: no divergence is privileged, because we
 * do not know in advance whether you skipped a word or slurred it into the next.
 *
 * This is why a reading is recorded a section at a time rather than in one
 * ten-minute take. A section is ~230 tokens against maybe 260 heard, so the
 * O(n·m) table is around sixty thousand cells — trivial. The whole reading in
 * one go would be twenty-five times that in a JS array-of-arrays on a phone,
 * for a worse product: one stumble at minute nine and you re-record everything.
 */
function align(ref: string[], hyp: string[]): Op[] {
  const n = ref.length;
  const m = hyp.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = ref[i - 1] === hyp[j - 1];
      d[i]![j] = Math.min(
        d[i - 1]![j - 1]! + (same ? 0 : 1),
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
      );
    }
  }

  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = ref[i - 1] === hyp[j - 1];
      if (d[i]![j] === d[i - 1]![j - 1]! + (same ? 0 : 1)) {
        ops.push({ kind: same ? "match" : "sub", r: i - 1, h: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) {
      ops.push({ kind: "del", r: i - 1, h: -1 });
      i--;
      continue;
    }
    ops.push({ kind: "ins", r: -1, h: j - 1 });
    j--;
  }
  return ops.reverse();
}

export function scoreReading(
  referenceText: string,
  heard: Word[],
  opts: { targets?: Map<number, string>; fallbackDurationS?: number } = {},
): ReadingScore {
  const { tokens: ref, breakAfter } = tokenizeReference(referenceText);

  // One transcript word can normalise to two tokens ("load-bearing"), so the
  // hypothesis is flattened before alignment and each piece keeps the timing of
  // the word it came from.
  const hypWords: { text: string; start: number; end: number }[] = [];
  for (const w of heard) {
    const norm = normaliseHeard(w.word);
    if (!norm) continue;
    for (const piece of norm.split(" ")) hypWords.push({ text: piece, start: w.start, end: w.end });
  }

  const spanS =
    hypWords.length > 0
      ? Math.max(0, hypWords[hypWords.length - 1]!.end - hypWords[0]!.start)
      : 0;
  const durationS =
    opts.fallbackDurationS && opts.fallbackDurationS > spanS ? opts.fallbackDurationS : spanS;

  const tokens: ReadToken[] = ref.map((r, index) => ({
    index,
    ref: r,
    status: "missed" as TokenStatus,
    ...(opts.targets?.get(index) !== undefined ? { target: opts.targets.get(index)! } : {}),
  }));

  if (hypWords.length === 0 || ref.length === 0) {
    return {
      durationS: round(durationS, 2),
      wpm: 0,
      accuracy: 0,
      targetAccuracy: tokens.some((t) => t.target) ? 0 : null,
      insertions: 0,
      stumbles: tokens,
      phrasing: { honoured: 0, available: breakAfter.filter(Boolean).length },
      hesitations: 0,
      longestGapS: 0,
      tokens,
    };
  }

  const ops = align(ref, hypWords.map((h) => h.text));
  const hypIndexForRef = new Array<number>(ref.length).fill(-1);
  let insertions = 0;

  for (const op of ops) {
    if (op.kind === "ins") {
      insertions++;
      continue;
    }
    const t = tokens[op.r]!;
    if (op.kind === "match") {
      t.status = "clean";
    } else if (op.kind === "sub") {
      t.status = "altered";
      t.heard = hypWords[op.h]!.text;
    } else {
      t.status = "missed";
      continue;
    }
    t.start = hypWords[op.h]!.start;
    t.end = hypWords[op.h]!.end;
    hypIndexForRef[op.r] = op.h;
  }

  // Phrasing and hesitation are measured on the spoken stream, at the positions
  // the *text* marks. A gap only counts as honouring a comma if the words either
  // side of it were both actually said — otherwise the silence is a skipped
  // word, not a breath.
  let honoured = 0;
  let available = 0;
  let hesitations = 0;
  let longestGapS = 0;

  for (let r = 0; r < ref.length - 1; r++) {
    const a = hypIndexForRef[r]!;
    const b = hypIndexForRef[r + 1]!;
    if (a < 0 || b < 0 || b <= a) continue;
    const gap = hypWords[b]!.start - hypWords[a]!.end;
    if (gap > longestGapS) longestGapS = gap;

    if (breakAfter[r]) {
      available++;
      if (gap >= PHRASE_PAUSE_MIN_S) honoured++;
    } else if (gap >= HESITATION_S) {
      hesitations++;
    }
  }
  // Marks whose neighbours went missing are still marks that existed.
  const totalMarks = breakAfter.filter(Boolean).length;
  available = Math.max(available, 0);

  const clean = tokens.filter((t) => t.status === "clean").length;
  const targetTokens = tokens.filter((t) => t.target !== undefined);
  const targetClean = targetTokens.filter((t) => t.status === "clean").length;

  const stumbles = tokens
    .filter((t) => t.status !== "clean")
    .sort((a, b) => {
      const at = a.target !== undefined ? 0 : 1;
      const bt = b.target !== undefined ? 0 : 1;
      return at - bt || a.index - b.index;
    });

  return {
    durationS: round(durationS, 2),
    wpm: durationS > 0 ? Math.round(hypWords.length / (durationS / 60)) : 0,
    accuracy: round((clean / ref.length) * 100, 1),
    targetAccuracy:
      targetTokens.length === 0 ? null : round((targetClean / targetTokens.length) * 100, 1),
    insertions,
    stumbles,
    phrasing: { honoured, available: totalMarks },
    hesitations,
    longestGapS: round(longestGapS, 2),
    tokens,
  };
}

/**
 * Per-target verdict for the scorecard. A target counts as clean only if every
 * token of it came back intact — half of "second order" is not a pass.
 */
export function targetVerdicts(
  score: ReadingScore,
): { word: string; clean: boolean; heard: string[] }[] {
  const byWord = new Map<string, { clean: boolean; heard: string[] }>();
  for (const t of score.tokens) {
    if (t.target === undefined) continue;
    const entry = byWord.get(t.target) ?? { clean: true, heard: [] };
    if (t.status !== "clean") {
      entry.clean = false;
      entry.heard.push(t.heard ?? "—");
    }
    byWord.set(t.target, entry);
  }
  return [...byWord.entries()].map(([word, v]) => ({ word, ...v }));
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
