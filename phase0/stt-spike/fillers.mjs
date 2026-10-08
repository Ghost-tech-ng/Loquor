// Two disjoint lexicons, measured separately on purpose.
//
// NON_LEXICAL is the population actually at risk: Whisper's training objective
// rewrites speech into clean prose, and these tokens are what it drops. This is
// the set the >=80% recall gate in PRD 6.2a is about.
//
// LEXICAL_HEDGE is the control group. These are real words, so Whisper has no
// reason to strip them. If recall here is not near 100%, the harness itself is
// wrong -- not the model.

export const NON_LEXICAL = [
  "um", "umm", "ummm",
  "uh", "uhh", "uhhh",
  "er", "err", "erm", "ermm",
  "ah", "ahh",
  "mm", "mmm", "hmm", "hm", "mhm",
  "eh",
];

export const LEXICAL_HEDGE = [
  "like",
  "you know",
  "i mean",
  "sort of", "kind of",
  "basically", "actually", "literally",
  "right",
];

const PUNCT = /[.,!?;:"“”‘’()\[\]…]/g;

export function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Counts occurrences of each phrase in `text`. Multi-word phrases are matched
// on the normalised string; single tokens on word boundaries so "like" does not
// match inside "unlike".
export function countPhrases(text, phrases) {
  const norm = normalise(text);
  const counts = {};
  let total = 0;

  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "g");
    const n = (norm.match(re) || []).length;
    if (n > 0) {
      counts[phrase] = n;
      total += n;
    }
  }

  return { counts, total };
}

// Per-phrase capped overlap. Summing min(hyp, truth) prevents a model that
// hallucinates twelve "um"s from scoring above one that found the right three.
//
// That cap is also why recall alone is not enough: it makes over-reporting
// free. A primer that teaches Whisper to sprinkle "um" everywhere scores the
// same recall as one that hears them correctly, and inflates every filler rate
// the app shows. Precision is what catches it -- matched over everything the
// model emitted, so each invented token costs something.
export function score(truthCounts, hypCounts) {
  let matched = 0;
  let truth = 0;
  let hyp = 0;

  for (const [phrase, t] of Object.entries(truthCounts)) {
    truth += t;
    matched += Math.min(t, hypCounts[phrase] || 0);
  }
  for (const n of Object.values(hypCounts)) hyp += n;

  return {
    matched,
    truth,
    hyp,
    falsePositives: hyp - matched,
    rate: truth === 0 ? null : matched / truth,
    precision: hyp === 0 ? null : matched / hyp,
  };
}

export function recall(truthCounts, hypCounts) {
  const { matched, truth, rate } = score(truthCounts, hypCounts);
  return { matched, truth, rate };
}
