// Networking without small talk.
//
// A live counterpart you talk to for a few turns. They open with something
// low-information — "yeah, we're doing some AI stuff" — and they have one
// genuinely interesting thing they will only say once you have earned it by
// asking something worth answering.
//
// This is the one place in the app the model runs warm rather than at
// temperature 0. A counterpart who says the same sentence every time trains you
// to answer that sentence. The guard in each counterpart's definition is what
// keeps the warmth from turning into a chatbot that volunteers everything in
// turn one, which would make the drill pointless.
//
// Two things are measured at the end, and neither is "was the conversation
// pleasant":
//
//   turnsToSubstance  how many exchanges before the counterpart said the
//                     interesting thing. Fewer is better. This is the whole
//                     "less small talk" aim expressed as a number.
//   askedVsTold       the ratio of the user's words spent asking to words spent
//                     talking about themselves. Networking fails far more often
//                     from the second than the first.

import { converse, structured, clampScore, str, LLMError, type Provider, type Turn } from "./llm.ts";
import type { Counterpart } from "../content/scaffolds.ts";

export class RoleplayError extends Error {}

/** The marker the counterpart emits when the user has earned the real answer. */
const SUBSTANCE_TAG = "[[SUBSTANCE]]";

export type Exchange = { you: string; them: string; substance: boolean };

export function systemFor(c: Counterpart): string {
  return `You are ${c.name}, ${c.role}. You are at ${c.setting}, talking to someone you have just met.

Stay in character. You are a person at an event, not an assistant. Never break character, never offer help, never mention that you are an AI, and never coach the person you are talking to.

HOW YOU TALK
Speak the way people actually speak standing up with a drink: one to three sentences, contractions, the occasional trailing thought. Never deliver a paragraph. Never ask more than one question back.

WHAT YOU GUARD
${c.guard}

THE INTERESTING THING
You know something genuinely worth hearing:

${c.substance}

You do NOT volunteer this. Vague, polite, or generic questions get vague, polite, generic answers — that is realistic and it is the point. You share it only when they ask something that shows they were actually listening: a specific question about something you said, a question that tests a claim you made, or one that gets at the mechanism rather than the summary. A question being merely open-ended is not enough.

When you do decide they have earned it, begin that reply with the exact marker ${SUBSTANCE_TAG} and then say the interesting thing in your own voice, naturally, as part of the conversation. Use the marker exactly once in the whole conversation. Never mention the marker or explain it.

If they only talk about themselves and ask nothing, respond the way a real person would — a short polite acknowledgement, and do not help them out.`;
}

/**
 * One turn. `history` is the exchanges so far; `said` is what the user just
 * said. Returns the counterpart's reply with the marker stripped — the marker is
 * plumbing and must never reach the screen.
 */
export async function reply(
  args: { counterpart: Counterpart; history: Exchange[]; said: string },
  provider: Provider,
  apiKey: string
): Promise<{ text: string; substance: boolean; latencyMs: number }> {
  const said = args.said.trim();
  if (said.length === 0) throw new RoleplayError("Nothing was transcribed.");

  const turns: Turn[] = [];
  for (const e of args.history) {
    turns.push({ role: "user", content: e.you });
    turns.push({ role: "assistant", content: e.them });
  }
  turns.push({ role: "user", content: said });

  try {
    const r = await converse(
      { system: systemFor(args.counterpart), turns, maxTokens: 220 },
      provider,
      apiKey
    );
    const substance = r.text.includes(SUBSTANCE_TAG);
    return {
      text: r.text.split(SUBSTANCE_TAG).join("").trim(),
      substance,
      latencyMs: r.latencyMs,
    };
  } catch (e) {
    throw e instanceof LLMError ? new RoleplayError(e.message) : e;
  }
}

// ── scoring the conversation ──────────────────────────────────────────────────

export type RoleplayScores = {
  /** Did the questions build on what was said, or arrive from a list. */
  listening: number;
  /** Did they get past the polite surface. */
  depth: number;
  /** Did it read as a conversation or as an interrogation. */
  ease: number;
};

export type RoleplayResult = {
  scores: RoleplayScores;
  /** 0–4 mean. Feeds the EWMA. */
  score: number;
  /** Exchange number where substance landed, or null if it never did. */
  turnsToSubstance: number | null;
  /** Words spent asking ÷ words spent talking about themselves. */
  askedVsTold: number;
  /** The question that unlocked it, verbatim. Empty if nothing did. */
  unlocking_question: string;
  /** One sentence, second person. */
  headline: string;
  /** The question they should have asked in turn one. */
  model_opener: string;
  latencyMs: number;
};

const SYSTEM = `You are reviewing a short networking conversation. One side is a senior software engineer practising how to have a substantive conversation with a stranger without small talk. The other side is a character played by a model.

Judge ONLY the engineer's side.

Score 0-4. Use the full range. Polite and unmemorable is a 2.

  listening  0 asked questions from a mental list, ignoring the answers / 2 loosely followed on / 4 every question built on the specific thing just said
  depth      0 never got past what could be read on a name badge / 2 got one real answer / 4 got to something the other person actually thinks about
  ease       0 an interrogation, or a monologue about themselves / 2 functional / 4 felt like two people talking, questions carried their own weight without feeling like probes

unlocking_question: copy VERBATIM the engineer's question that got the other person to open up. Empty string if none did.

headline: one sentence, second person, the highest-leverage change. Direct.

model_opener: the question they should have asked FIRST, given how the other person opened. One sentence, specific to what was actually said, and something a stranger would enjoy answering.`;

const SCHEMA = {
  type: "object",
  properties: {
    listening: { type: "integer", minimum: 0, maximum: 4 },
    depth: { type: "integer", minimum: 0, maximum: 4 },
    ease: { type: "integer", minimum: 0, maximum: 4 },
    unlocking_question: { type: "string" },
    headline: { type: "string" },
    model_opener: { type: "string" },
  },
  required: ["listening", "depth", "ease", "unlocking_question", "headline", "model_opener"],
  additionalProperties: false,
} as const;

export async function scoreRoleplay(
  args: { counterpart: Counterpart; history: Exchange[] },
  provider: Provider,
  apiKey: string
): Promise<RoleplayResult> {
  if (args.history.length === 0) throw new RoleplayError("Nothing was said.");

  const user = `WHO THEY WERE TALKING TO
${args.counterpart.name}, ${args.counterpart.role}, at ${args.counterpart.setting}

THE CONVERSATION
${args.history
  .map((e, i) => `[${i + 1}] THEM: ${i === 0 ? args.counterpart.opener : ""}\nYOU: ${e.you}\nTHEM: ${e.them}`)
  .join("\n\n")}`;

  let parsed: Record<string, unknown>;
  let latencyMs: number;
  try {
    const r = await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_roleplay", maxTokens: 700 },
      provider,
      apiKey
    );
    parsed = r.data;
    latencyMs = r.latencyMs;
  } catch (e) {
    throw e instanceof LLMError ? new RoleplayError(e.message) : e;
  }

  const scores: RoleplayScores = {
    listening: clampScore(parsed.listening),
    depth: clampScore(parsed.depth),
    ease: clampScore(parsed.ease),
  };

  return {
    scores,
    score: (scores.listening + scores.depth + scores.ease) / 3,
    turnsToSubstance: turnsToSubstance(args.history),
    askedVsTold: askedVsTold(args.history),
    unlocking_question: str(parsed.unlocking_question),
    headline: str(parsed.headline),
    model_opener: str(parsed.model_opener),
    latencyMs,
  };
}

/** 1-indexed exchange where substance landed, or null. */
export function turnsToSubstance(history: Exchange[]): number | null {
  const i = history.findIndex((e) => e.substance);
  return i === -1 ? null : i + 1;
}

/**
 * Words in the user's questions ÷ words in everything else they said.
 *
 * A sentence counts as asking if it ends in a question mark or opens with an
 * interrogative — transcripts often lose the punctuation, so both are needed.
 * Returns Infinity when they only asked; 0 when they only talked.
 */
export function askedVsTold(history: Exchange[]): number {
  let asked = 0;
  let told = 0;
  for (const e of history) {
    for (const s of e.you.split(/(?<=[.?!])\s+/)) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words === 0) continue;
      if (isQuestion(s)) asked += words;
      else told += words;
    }
  }
  if (told === 0) return asked > 0 ? Infinity : 0;
  return asked / told;
}

const INTERROGATIVE = /^(what|why|how|when|where|who|which|do|does|did|is|are|was|were|can|could|would|will|have|has|any)\b/i;

function isQuestion(s: string): boolean {
  const t = s.trim();
  if (t.endsWith("?")) return true;
  return INTERROGATIVE.test(t);
}

export const ROLEPLAY_LABELS: { key: keyof RoleplayScores; label: string; hint: string }[] = [
  { key: "listening", label: "Listening", hint: "Built on what they actually said" },
  { key: "depth", label: "Depth", hint: "Got past the name badge" },
  { key: "ease", label: "Ease", hint: "A conversation, not an interview" },
];
