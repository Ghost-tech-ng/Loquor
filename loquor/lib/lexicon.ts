// Two disjoint lexicons. The split matters: they behave differently under
// transcription and they mean different things about your speech.
//
// NON_LEXICAL are disfluencies. Whisper is trained to delete them, which is what
// the Phase 0 gate measures. They are noise — pure cost, no content.
//
// HEDGES are real words that survive transcription intact. They are not noise;
// they are a *stance*. "Sort of", "I think", "maybe" soften a claim, and the
// problem is using them when you actually mean the strong version. Counting them
// separately from fillers is the whole point — one is a tic, the other is a habit
// of not committing.

export const NON_LEXICAL = [
  "um", "umm", "ummm",
  "uh", "uhh", "uhhh",
  "er", "err", "erm", "ermm",
  "ah", "ahh",
  "mm", "mmm", "hmm", "hm", "mhm",
  "eh",
] as const;

export const HEDGES = [
  "like",
  "you know",
  "i mean",
  "sort of", "kind of", "kinda", "sorta",
  "basically", "actually", "literally",
  "just",
  "i guess", "i think", "i feel like",
  "maybe", "probably", "possibly",
  "a bit", "a little",
  "or something", "or whatever",
] as const;

const PUNCT = /[.,!?;:"“”‘’()[\]…]/g;

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NON_LEXICAL_SET: ReadonlySet<string> = new Set(NON_LEXICAL);

export function isFiller(token: string): boolean {
  return NON_LEXICAL_SET.has(normalise(token));
}

// Hedges are matched on the joined transcript rather than token-by-token because
// most of them are multi-word. Returns total occurrences.
export function countHedges(text: string): number {
  const norm = normalise(text);
  let total = 0;
  for (const phrase of HEDGES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    total += (norm.match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length;
  }
  return total;
}
