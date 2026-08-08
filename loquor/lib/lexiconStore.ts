// The Lexicon's scheduling layer.
//
// fsrs.ts is pure arithmetic and knows nothing about words or SQLite. db.ts
// stores rows and knows nothing about memory models. This is the seam: it turns
// a row into a Card, grades it, and writes it back, and it owns the two policy
// decisions that are neither maths nor storage —
//
//   1. WHICH WORDS EXIST. The corpus is content/glossary.ts, the same entries the
//      readings mark up. A word enters the Lexicon the first time it is graded,
//      not when the app is installed, so an empty database means an empty queue
//      rather than 96 cards all due at once.
//   2. WHAT EACH TRACK ACCEPTS. Recognition is graded by reading the word aloud
//      cleanly in a passage or by tapping it in review. Production can only be
//      raised by the speak-to-unlock judge or by a confirmed real-world use.
//      Nothing else may touch it — the moment reading a word aloud counts as
//      producing it, the production number stops meaning anything.

import { ALL_WORDS, gloss, type Gloss } from "../content/glossary.ts";
import {
  creditRealUse,
  isNew,
  newCard,
  owned,
  review,
  type Card,
  type Grade,
} from "./fsrs.ts";
import {
  dueCards,
  getCard,
  markRealUse,
  putCard,
  seenWords,
  type LexiconRow,
  type Track,
} from "./db.ts";

export type { Track } from "./db.ts";

/** How many unseen words a single day may introduce. */
export const NEW_PER_DAY = 4;

function toCard(row: LexiconRow): Card {
  return {
    stability: row.stability,
    difficulty: row.difficulty,
    dueAt: row.due_at,
    lastAt: row.last_at,
    reps: row.reps,
    lapses: row.lapses,
  };
}

function toRow(word: string, track: Track, card: Card, from?: LexiconRow | null): LexiconRow {
  return {
    word,
    track,
    stability: card.stability,
    difficulty: card.difficulty,
    due_at: card.dueAt,
    last_at: card.lastAt,
    reps: card.reps,
    lapses: card.lapses,
    real_use_at: from?.real_use_at ?? null,
    real_use_note: from?.real_use_note ?? null,
  };
}

/** Load a card, creating the new-word state in memory if it has never been seen. */
export async function cardFor(word: string, track: Track): Promise<Card> {
  const row = await getCard(word, track);
  return row ? toCard(row) : newCard();
}

/**
 * Grade one word on one track and persist the result. Returns the new card so
 * the screen can say when it comes back without a second read.
 */
export async function grade(
  word: string,
  track: Track,
  g: Grade,
  now = Date.now()
): Promise<Card> {
  const row = await getCard(word, track);
  const next = review(row ? toCard(row) : newCard(now), g, now);
  await putCard(toRow(word, track, next, row));
  return next;
}

/**
 * Read-aloud feedback, applied to the recognition track only.
 *
 * A clean target word is a Good, not an Easy: you had the word in front of you,
 * which is the easiest possible retrieval cue, and grading that as Easy would
 * push the interval out on evidence that does not support it. A stumble is a
 * Hard rather than an Again, because Whisper mangling a word is real evidence of
 * a stumble but not proof you have lost the meaning.
 */
export async function gradeRecognition(
  verdicts: { word: string; clean: boolean }[],
  now = Date.now()
): Promise<void> {
  for (const v of verdicts) {
    if (!gloss(v.word)) continue;
    await grade(v.word, "recognition", v.clean ? 3 : 2, now);
  }
}

/**
 * The speak-to-unlock result, applied to the production track only.
 *
 * Three gates, all of which must pass: right sense, natural collocation, right
 * register. Passing all three is an Easy — an unprompted, correct, natural use
 * under time pressure is the hardest evidence the app can collect. Two of three
 * is a Good, one is a Hard, none is a lapse.
 */
export async function gradeProduction(
  word: string,
  gates: { sense: boolean; collocation: boolean; register: boolean },
  now = Date.now()
): Promise<Card> {
  const passed = Number(gates.sense) + Number(gates.collocation) + Number(gates.register);
  const g: Grade = passed === 3 ? 4 : passed === 2 ? 3 : passed === 1 ? 2 : 1;
  return grade(word, "production", g, now);
}

/**
 * A confirmed use in a real conversation. Credits the production track and
 * records the note, which is the only free-text the Lexicon keeps — a word you
 * can point at a real moment for is a word you own.
 */
export async function confirmRealUse(word: string, note: string, now = Date.now()): Promise<void> {
  const row = await getCard(word, "production");
  const next = creditRealUse(row ? toCard(row) : review(newCard(now), 3, now), now);
  await putCard(toRow(word, "production", next, row));
  await markRealUse(word, note, now);
}

export type QueueItem = {
  gloss: Gloss;
  track: Track;
  card: Card;
  /** True when this word has never been graded on this track before. */
  fresh: boolean;
};

/**
 * The day's queue: everything overdue on either track, then up to NEW_PER_DAY
 * unseen words.
 *
 * Due work comes first and new words are the remainder rather than a separate
 * daily quota, because a backlog of half-learned words is worth more than a
 * wider shallow front. Recognition is ordered ahead of production for the same
 * word so you are reminded what it means before being asked to use it.
 */
export async function buildQueue(now = Date.now(), limit = 20): Promise<QueueItem[]> {
  const [dueRec, dueProd, seenRec] = await Promise.all([
    dueCards("recognition", now, limit),
    dueCards("production", now, limit),
    seenWords("recognition"),
  ]);

  const items: QueueItem[] = [];
  const push = (row: LexiconRow) => {
    const g = gloss(row.word);
    if (g) items.push({ gloss: g, track: row.track, card: toCard(row), fresh: false });
  };

  const prodByWord = new Map(dueProd.map((r) => [r.word, r]));
  for (const row of dueRec) {
    push(row);
    const p = prodByWord.get(row.word);
    if (p) {
      push(p);
      prodByWord.delete(row.word);
    }
  }
  for (const row of prodByWord.values()) push(row);

  const room = Math.max(0, limit - items.length);
  if (room > 0) {
    const seen = new Set(seenRec);
    let added = 0;
    for (const word of ALL_WORDS) {
      if (added >= Math.min(room, NEW_PER_DAY)) break;
      if (seen.has(word)) continue;
      const g = gloss(word);
      if (!g) continue;
      items.push({ gloss: g, track: "recognition", card: newCard(now), fresh: true });
      added++;
    }
  }

  return items.slice(0, limit);
}

/**
 * The Word of the Day: the word most worth carrying into a real conversation.
 *
 * Not the newest and not the weakest — the one you can already recognise but
 * have never produced. That is the exact gap the app exists to close, and it is
 * a word you will recognise the moment it becomes useful in a meeting.
 */
export async function wordOfTheDay(now = Date.now()): Promise<Gloss | null> {
  const [recWords, prodWords] = await Promise.all([
    seenWords("recognition"),
    seenWords("production"),
  ]);
  const prod = new Set(prodWords);

  const candidates: string[] = [];
  for (const w of recWords) {
    if (prod.has(w)) continue;
    const c = await cardFor(w, "recognition");
    if (!isNew(c) && c.stability >= 3) candidates.push(w);
  }

  const pool = candidates.length > 0 ? candidates : recWords.length > 0 ? recWords : [...ALL_WORDS];
  if (pool.length === 0) return null;

  // Deterministic per day: reopening the app must not reroll the word you have
  // been carrying around since breakfast.
  const d = new Date(now);
  const dayIndex = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return gloss(pool[Math.abs(dayIndex) % pool.length]!) ?? null;
}

/** Corpus-wide progress, for Today and the scorecard. */
export async function ownership(): Promise<{
  corpus: number;
  recognised: number;
  produced: number;
}> {
  const [rec, prod] = await Promise.all([seenWords("recognition"), seenWords("production")]);
  let recognised = 0;
  for (const w of rec) if (owned(await cardFor(w, "recognition"))) recognised++;
  let produced = 0;
  for (const w of prod) if (owned(await cardFor(w, "production"))) produced++;
  return { corpus: ALL_WORDS.length, recognised, produced };
}
