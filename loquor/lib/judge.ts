// The LLM judge.
//
// It scores content only: clarity, specificity, structure, register, economy.
// It is never shown filler counts, pace, or dead air and is never asked to
// compute them — those are arithmetic (see metrics.ts) and arithmetic does not
// give a different answer next Tuesday. Keeping the two apart is what makes a
// 90-day trend mean anything.
//
// temperature 0 + a strict JSON schema + a fixed anchor. Score drift across
// sessions is the failure mode that would quietly ruin this feature.

import type { Metrics } from "./metrics.ts";
import { structured, clampScore, str, LLMError, type Provider } from "./llm.ts";

export type Rubric = {
  clarity: number;
  specificity: number;
  structure: number;
  register: number;
  economy: number;
};

export type Judgement = {
  rubric: Rubric;
  /** One sentence, second person, naming the single highest-leverage change. */
  headline: string;
  /** Verbatim from the transcript, so it can be pointed at and re-recorded. */
  weakest_sentence: string;
  /** Why that sentence is the weak one. */
  weakest_reason: string;
  /** A concrete rewrite of it. The user's Rewrite target, not a lecture. */
  suggested_rewrite: string;
  /** The one thing that genuinely worked. Never empty, never generic praise. */
  strongest_moment: string;
  latencyMs: number;
};

export class JudgeError extends Error {}

const SYSTEM = `You are a speaking coach for a senior software engineer who wants to contribute more in meetings.

You judge CONTENT ONLY. Never mention filler words, pace, speed, pauses, "um", or delivery — those are measured separately by an algorithm and commenting on them duplicates it badly.

Score 0-4 on each dimension. Use the full range. A competent-but-unremarkable answer is a 2. Reserve 4 for genuinely excellent. Do not inflate: a scorecard where everything is a 3 teaches nothing.

  clarity      0 point never lands / 2 point lands late / 4 point lands in the first sentence
  specificity  0 generic, could be about anything / 2 some concrete detail / 4 named, falsifiable, tied to context
  structure    0 rambling / 2 loose order / 4 recognisable scaffold
  register     0 wrong level, too casual or too ornate / 2 serviceable / 4 precise, professional, unforced
  economy      0 twice as long as needed / 2 some padding / 4 tight

weakest_sentence MUST be copied verbatim from the transcript. Do not paraphrase it, do not clean it up. It is used to let the speaker re-record that exact sentence.

suggested_rewrite is what they should have said instead — same idea, said well. One or two sentences. It is a model to imitate, not advice about how to improve.

headline is one sentence, second person, naming the single highest-leverage change. Be direct. No praise sandwich.

strongest_moment names one thing that actually worked, quoting it if possible. If the answer was weak throughout, find the least weak part and say so honestly rather than inventing a compliment.`;

const SCHEMA = {
  type: "object",
  properties: {
    clarity: { type: "integer", minimum: 0, maximum: 4 },
    specificity: { type: "integer", minimum: 0, maximum: 4 },
    structure: { type: "integer", minimum: 0, maximum: 4 },
    register: { type: "integer", minimum: 0, maximum: 4 },
    economy: { type: "integer", minimum: 0, maximum: 4 },
    headline: { type: "string" },
    weakest_sentence: { type: "string" },
    weakest_reason: { type: "string" },
    suggested_rewrite: { type: "string" },
    strongest_moment: { type: "string" },
  },
  required: [
    "clarity", "specificity", "structure", "register", "economy",
    "headline", "weakest_sentence", "weakest_reason", "suggested_rewrite", "strongest_moment",
  ],
  additionalProperties: false,
} as const;

export async function judge(
  args: {
    topic: string;
    transcript: string;
    /** Passed for length context only — no delivery figures reach the model. */
    metrics: Pick<Metrics, "durationS" | "wordCount">;
  },
  provider: Provider,
  apiKey: string
): Promise<Judgement> {
  if (args.transcript.trim().length === 0) throw new JudgeError("Nothing was transcribed.");

  const user = `TOPIC
${args.topic}

TRANSCRIPT (${Math.round(args.metrics.durationS)}s, ${args.metrics.wordCount} words)
${args.transcript}`;

  const { data: parsed, latencyMs } = await call(user, provider, apiKey);

  return {
    rubric: {
      clarity: clampScore(parsed.clarity),
      specificity: clampScore(parsed.specificity),
      structure: clampScore(parsed.structure),
      register: clampScore(parsed.register),
      economy: clampScore(parsed.economy),
    },
    headline: str(parsed.headline),
    weakest_sentence: str(parsed.weakest_sentence),
    weakest_reason: str(parsed.weakest_reason),
    suggested_rewrite: str(parsed.suggested_rewrite),
    strongest_moment: str(parsed.strongest_moment),
    latencyMs,
  };
}

// Callers catch JudgeError, so the transport's LLMError is re-thrown as one
// rather than escaping as a second error type every screen would have to know.
async function call(user: string, provider: Provider, apiKey: string) {
  try {
    return await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_judgement" },
      provider,
      apiKey
    );
  } catch (e) {
    throw e instanceof LLMError ? new JudgeError(e.message) : e;
  }
}

export function rubricTotal(r: Rubric): number {
  return r.clarity + r.specificity + r.structure + r.register + r.economy;
}

export const RUBRIC_LABELS: { key: keyof Rubric; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "specificity", label: "Specificity" },
  { key: "structure", label: "Structure" },
  { key: "register", label: "Register" },
  { key: "economy", label: "Economy" },
];
