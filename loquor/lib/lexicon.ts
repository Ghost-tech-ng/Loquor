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

const HEDGE_TOKENS: readonly (readonly string[])[] = [...HEDGES]
  .map((p) => p.split(" "))
  .sort((a, b) => b.length - a.length);

const LIKE_AS_VERB_OR_COMPARISON = new Set([
  "i", "you", "we", "they", "would", "d", "don't", "didn't", "doesn't",
  "look", "looks", "looked", "looking", "feel", "feels", "felt",
  "seem", "seems", "seemed", "sound", "sounds", "sounded",
  "something", "nothing", "anything", "more", "much", "just",
]);
const KIND_AS_NOUN = new Set([
  "what", "which", "this", "that", "these", "those", "the", "a", "any",
  "every", "each", "same", "different", "one",
]);
const KNOW_AS_QUESTION = new Set(["do", "did", "does", "if", "what", "as"]);

/** A phrase that is spelled like a hedge but is doing literal work. */
function isLiteral(phrase: readonly string[], prev: string | undefined, rest: readonly string[]): boolean {
  const head = phrase.join(" ");
  if (head === "like") return prev !== undefined && (LIKE_AS_VERB_OR_COMPARISON.has(prev) || prev.endsWith("'d"));
  if (head === "kind of" || head === "sort of") return prev !== undefined && KIND_AS_NOUN.has(prev);
  if (head === "you know") return prev !== undefined && KNOW_AS_QUESTION.has(prev);
  if (head === "just") {
    if (rest[0] === "in" && rest[1] === "time") return true;
    return prev === "a" || prev === "the" || prev === "most";
  }
  return false;
}

// Walks the tokens once, longest phrase first, and consumes what it matches —
// "i feel like" is one hedge, not "i feel like" plus "like". Counting each
// phrase independently over the whole string double-counted every overlap and
// made the trend line measure vocabulary rather than habit.
export function countHedges(text: string): number {
  const tokens = normalise(text).split(" ").filter(Boolean);
  let total = 0;
  let i = 0;
  while (i < tokens.length) {
    const hit = HEDGE_TOKENS.find(
      (p) =>
        p.every((t, k) => tokens[i + k] === t) &&
        !isLiteral(p, tokens[i - 1], tokens.slice(i + p.length, i + p.length + 2)),
    );
    if (hit) {
      total++;
      i += hit.length;
    } else {
      i++;
    }
  }
  return total;
}
