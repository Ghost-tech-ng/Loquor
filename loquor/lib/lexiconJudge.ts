// Speak-to-unlock.
//
// A word is not owned because you tapped "I knew that". It is owned when it
// arrives unprompted, in the right slot, in a sentence you invented under time
// pressure. This judge is the gate: you say one sentence using the word, and it
// answers three independent yes/no questions.
//
//   sense        Does it mean here what it actually means? This is the one that
//                catches "I want to reiterate that for the first time".
//   collocation  Do the words around it belong there? "Make a decision" is
//                natural, "do a decision" is not, and no dictionary entry
//                teaches the difference.
//   register     Is this the room the word belongs in? A word can be used
//                correctly and still be wrong — "heretofore" in a standup is a
//                register failure, not a meaning failure.
//
// Three booleans, not a 0-4 score, and deliberately so. The gates map onto
// separate repairs: a sense failure means re-read the entry, a collocation
// failure means say it again with a different verb, a register failure means the
// word was fine and the room was wrong. A single blended number would tell you
// something was off and nothing about what to do next.
//
// Same discipline as judge.ts: temperature 0, strict schema, no delivery metrics
// anywhere near the model.

import type { Gloss } from "../content/glossary.ts";
import { structured, str, LLMError, type Provider } from "./llm.ts";

export type Gates = {
  sense: boolean;
  collocation: boolean;
  register: boolean;
};

export type WordVerdict = {
  gates: Gates;
  /** True only when all three passed. */
  unlocked: boolean;
  /** The sentence as transcribed, so the screen can quote it back. */
  heard: string;
  /** One sentence naming the first failed gate, or confirming the use. */
  verdict: string;
  /** The same idea said better. Present even on a pass — there is always a sharper version. */
  model_sentence: string;
  latencyMs: number;
};

export class LexiconJudgeError extends Error {}

const SYSTEM = `You judge whether a single English word was USED correctly in one spoken sentence.

You are given the word, its dictionary meaning, its natural collocations, and the situation it belongs in. You are given a transcript of one sentence the speaker said out loud.

Answer three INDEPENDENT yes/no questions. Do not let one influence another.

  sense        Is the word carrying its actual meaning in this sentence? No if the sentence would still make sense with the word swapped for an unrelated one — that means it is decoration, not usage.
  collocation  Do the surrounding words go with it in natural English? Judge the phrasing around the word only. Non-native-sounding prepositions, verbs, or articles attached to the word fail this.
  register     Is this the kind of sentence the word belongs in? The speaker is a senior software engineer speaking in professional meetings. A word used correctly but far too formal or ornate for that room fails this, and so does a word used in a sentence too casual to carry it.

The transcript comes from an automatic transcriber. Ignore missing punctuation, capitalisation, and obvious mis-hearings of OTHER words. Judge the target word and its immediate surroundings.

verdict is one sentence, second person. If a gate failed, name that gate's problem specifically and quote the offending phrase. If all three passed, say what made it work — not generic praise.

model_sentence is one sentence using the same word, about the same subject the speaker chose, said the way a fluent professional would say it. It is a model to imitate. Never explain the word in it, and never define it.`;

const SCHEMA = {
  type: "object",
  properties: {
    sense: { type: "boolean" },
    collocation: { type: "boolean" },
    register: { type: "boolean" },
    verdict: { type: "string" },
    model_sentence: { type: "string" },
  },
  required: ["sense", "collocation", "register", "verdict", "model_sentence"],
  additionalProperties: false,
} as const;

export async function judgeUse(
  args: { gloss: Gloss; transcript: string },
  provider: Provider,
  apiKey: string
): Promise<WordVerdict> {
  const heard = args.transcript.trim();
  if (heard.length === 0) throw new LexiconJudgeError("Nothing was transcribed.");

  const g = args.gloss;
  const user = `WORD
${g.word}

MEANING
${g.meaning}

NATURAL COLLOCATIONS
${g.collocations.join(", ")}

WHERE IT BELONGS
${g.slot}

COMMON MISUSE
${g.antiPattern}

WHAT THE SPEAKER SAID
${heard}`;

  let parsed: Record<string, unknown>;
  let latencyMs: number;
  try {
    const r = await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_verdict", maxTokens: 512 },
      provider,
      apiKey
    );
    parsed = r.data;
    latencyMs = r.latencyMs;
  } catch (e) {
    throw e instanceof LLMError ? new LexiconJudgeError(e.message) : e;
  }

  const gates: Gates = {
    sense: parsed.sense === true,
    collocation: parsed.collocation === true,
    register: parsed.register === true,
  };

  return {
    gates,
    unlocked: gates.sense && gates.collocation && gates.register,
    heard,
    verdict: str(parsed.verdict),
    model_sentence: str(parsed.model_sentence),
    latencyMs,
  };
}

export const GATE_LABELS: { key: keyof Gates; label: string; fail: string }[] = [
  { key: "sense", label: "Sense", fail: "It did not mean what you needed it to mean." },
  { key: "collocation", label: "Collocation", fail: "The words around it do not sit naturally." },
  { key: "register", label: "Register", fail: "Right word, wrong room." },
];
