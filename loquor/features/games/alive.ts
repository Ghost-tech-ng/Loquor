// Bring It to Life: the content and the scoring for each mode.
//
// Every mode boils down to liveliness readings from prosody.ts; this file only
// decides what to ask for and how the readings combine into one score.

import type { Word } from "../../lib/metrics.ts";
import { normalise } from "../../lib/lexicon.ts";
import { contrast, type Liveliness } from "./prosody.ts";

export type AliveMode = "talk" | "deliveries" | "retell" | "emphasis";

export const TALK_PROMPTS = [
  "Tell me about the best meal you have ever had.",
  "Describe a moment you were genuinely surprised.",
  "What is something you changed your mind about?",
  "Explain your job to someone who has never heard of it.",
  "Tell me about a place you would go back to.",
  "What is a small thing that makes your day better?",
] as const;

/** One line, said three ways. Same words, so only the voice can differ. */
export const DELIVERY_LINES = [
  "I can't believe they actually did it.",
  "So that's how the whole thing ended.",
  "Well, we're not doing that again.",
  "You won't guess who walked in.",
] as const;

export const INTENTS = [
  { key: "gossip", label: "Telling a friend gossip", cue: "Lean in. Let it rise. You can't wait to tell them." },
  { key: "commentator", label: "Sports commentator", cue: "Big, fast, loud. The crowd is on its feet." },
  { key: "gently", label: "Letting someone down gently", cue: "Slow, soft, warm. Each word placed with care." },
] as const;

/** Short enough to retell from memory after one read. */
export const PASSAGES = [
  "The first lighthouse keepers lived alone for months. Supplies came by boat when the sea allowed, which was not often. Many kept journals, and the most common entry was not about storms. It was about the silence, and how loud it became.",
  "Honeybees decide where to build a new hive by dancing. Scouts return and dance for the site they found, and the better the site, the longer they dance. Other bees go and check. Within a day or two, the whole swarm agrees.",
  "A city in Japan once replaced its train station's departure chime with a short melody. Complaints about missed trains dropped. The tune was the same length as the old buzzer, but people found it easier to notice and harder to ignore.",
  "The oldest known recipe is for beer, written on a clay tablet nearly four thousand years ago. It is a poem to a goddess, and the steps are hidden in the verses. Brewers who followed it found it actually works.",
] as const;

/** Lines with one word to lean on. `target` is the word, not its position. */
export const EMPHASIS_LINES = [
  { text: "I never said she stole the money.", target: "never" },
  { text: "This is the last time I'm asking.", target: "last" },
  { text: "We need an answer by Friday, not Monday.", target: "Friday" },
  { text: "It was the smallest room I have ever seen.", target: "smallest" },
  { text: "Nobody told me the meeting had moved.", target: "Nobody" },
  { text: "The problem isn't the price, it's the timing.", target: "timing" },
] as const;

export const EMPHASIS_ROUNDS = 3;

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Three deliveries: half how lively they were, half how different. */
export function deliveriesScore(takes: readonly Liveliness[]): { score: number; contrast: number; average: number } {
  const average = Math.round(avg(takes.map((t) => t.score)));
  const c = contrast(takes);
  return { score: Math.round(0.5 * average + 0.5 * c), contrast: c, average };
}

/**
 * Read, then retell. The retell is how you sound when you talk; the gap is how
 * much of that disappears when there is a page in front of you. A lively read
 * scores well whatever the retell did, so reading better than you talk is fine.
 */
export function retellScore(read: Liveliness, retell: Liveliness): { score: number; gap: number } {
  const gap = retell.score - read.score;
  return { score: Math.round(clamp(0.7 * read.score + 0.3 * (100 - Math.max(0, gap)))), gap };
}

/** Emphasis rounds: 60% landing the word, 40% the voice around it. */
export function emphasisScore(rounds: readonly { hit: boolean; liveliness: number | null }[]): number {
  if (rounds.length === 0) return 0;
  const hits = rounds.filter((r) => r.hit).length / rounds.length;
  const lively = rounds.map((r) => r.liveliness).filter((x): x is number => x !== null);
  return Math.round(60 * hits + 0.4 * avg(lively));
}

/** Where the target word landed in the transcript, or -1 when it was not said. */
export function locate(words: readonly Word[], target: string): number {
  const t = normalise(target);
  return words.findIndex((w) => normalise(w.word) === t);
}

/** 0 robot, 1 orb. Below 30 is all robot; 80 and up is all orb. */
export function morph(score: number): number {
  return clamp((score - 30) / 50, 0, 1);
}

export function pick<T>(xs: readonly T[], not?: T): T {
  const pool = xs.length > 1 && not !== undefined ? xs.filter((x) => x !== not) : xs;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
