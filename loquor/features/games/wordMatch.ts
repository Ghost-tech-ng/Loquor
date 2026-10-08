// Did the sentence use the word?
//
// Word Bomb hands you "contingent" and you say "it's contingent upon funding" —
// easy. But you may also say "contingency", "mitigated", "leveraging", and
// Whisper may hand back "trac table". A matcher that only takes the bare form
// punishes exactly the fluency the game is trying to build, so this accepts the
// inflections and the near-misses a transcriber produces, and nothing looser.

import { normalise } from "../../lib/lexicon.ts";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** The bare word plus its regular inflections and the common derivations. */
export function forms(word: string): Set<string> {
  const w = normalise(word);
  const out = new Set<string>([w]);
  const add = (...xs: string[]) => xs.forEach((x) => out.add(x));
  const last = w.slice(-1);
  const stem = w.slice(0, -1);

  add(w + "s", w + "es", w + "ed", w + "ing", w + "ly", w + "er", w + "ment", w + "ness");
  if (last === "e") add(w + "d", stem + "ing", stem + "y", stem + "ion", stem + "ation", stem + "able", w + "r");
  if (last === "y" && !VOWELS.has(w.slice(-2, -1))) add(stem + "ies", stem + "ied", stem + "ily", stem + "iness");
  // A single consonant after a single vowel doubles: commit → committed.
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) add(w + last + "ed", w + last + "ing");
  if (w.endsWith("t")) add(w + "ion", stem + "cy", stem + "ce");
  if (w.endsWith("ent")) add(w.slice(0, -1) + "ce", w.slice(0, -1) + "cy");
  if (w.endsWith("ant")) add(w.slice(0, -1) + "ce", w.slice(0, -1) + "cy");
  if (w.endsWith("able") || w.endsWith("ible")) add(w.slice(0, -1) + "y", w.slice(0, -2) + "ility");
  if (w.endsWith("ic")) add(w + "ally");
  if (w.endsWith("ate")) add(stem + "ion", stem + "or");
  if (w.endsWith("ize") || w.endsWith("ise")) add(stem + "ation");
  return out;
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/** The token in the transcript that used the word, or null. */
export function findUse(transcript: string, word: string): string | null {
  const tokens = normalise(transcript).split(" ").filter(Boolean);
  const want = forms(word);
  const target = normalise(word);

  for (const t of tokens) if (want.has(t)) return t;

  // Whisper splits long rare words: "trac table".
  for (let i = 0; i + 1 < tokens.length; i++) {
    const joined = tokens[i]! + tokens[i + 1]!;
    if (want.has(joined)) return `${tokens[i]} ${tokens[i + 1]}`;
  }

  // One slip in a long word is a transcription error, not a different word.
  if (target.length >= 6) {
    for (const t of tokens) {
      if (Math.abs(t.length - target.length) <= 3 && editDistance(t, target) <= 1) return t;
      if (t.startsWith(target.slice(0, -1)) && t.length - target.length <= 4) return t;
    }
  }
  return null;
}
