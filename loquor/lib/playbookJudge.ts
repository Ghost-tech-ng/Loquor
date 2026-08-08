// The Playbook drill judge.
//
// You read a meeting snippet, you are told which archetype to use, and you say
// the question out loud. This scores that one question.
//
// Four dimensions, and the fourth is the one that matters most to the stated
// goal. "Contribute and be noticed" fails in two opposite directions: saying
// nothing, and saying something that makes the room defensive. A question can be
// technically perfect — correct archetype, precise, short — and still shut the
// conversation down, because of how it lands rather than what it asks. `opens`
// is the only score here that measures the room's reaction rather than the
// sentence's quality, and it is deliberately the hardest to get a 4 on.
//
// The scenario's `fits` list is given to the judge as a floor, not a ceiling:
// the prompt says explicitly that a well-aimed question outside the list still
// scores. Otherwise the drill teaches the answer key rather than the skill.

import { structured, clampScore, str, LLMError, type Provider } from "./llm.ts";

export type QuestionScores = {
  /** Is this actually the archetype they were asked to use. */
  archetype_fit: number;
  /** Is it about THIS snippet, or could it be asked in any meeting. */
  specificity: number;
  /** One sentence, or a preamble with a question buried in it. */
  brevity: number;
  /** Does it open the conversation up or close it down. */
  opens: number;
};

export type QuestionVerdict = {
  scores: QuestionScores;
  /** 0–4, the mean. What feeds the EWMA. */
  score: number;
  heard: string;
  /** One sentence, second person, naming the single problem. */
  verdict: string;
  /** The same question asked well. The thing to imitate. */
  model_question: string;
  /** What the room would most likely say back. Makes the cost of a bad ask concrete. */
  likely_reply: string;
  latencyMs: number;
};

export class PlaybookJudgeError extends Error {}

const SYSTEM = `You judge ONE question a senior software engineer asked out loud in response to a meeting snippet. They were told which question archetype to use.

Score 0-4 on each. Use the full range. A competent-but-forgettable question is a 2. Reserve 4 for a question that would visibly change the room.

  archetype_fit  0 a different move entirely / 2 gestures at it / 4 unmistakably this archetype, done properly
  specificity    0 could be asked in any meeting about anything / 2 references the topic / 4 names something specific from the snippet that only someone listening would catch
  brevity        0 a speech with a question at the end / 2 one sentence plus padding / 4 one sentence, no preamble
  opens          0 makes the speaker defensive or is a gotcha / 2 answerable but flat / 4 the speaker wants to answer it and the room gets more information

opens is the hardest and the most important. A question can be correct and still land as an attack or as showing off. Ask yourself what the person on the receiving end feels. Points scored at someone's expense are a 0 or 1 here no matter how sharp the question is.

You are given a list of archetypes that fit this snippet well. Use it as a floor, not a ceiling — a well-aimed question that is NOT on that list can still score highly, provided it is the archetype they were asked for.

The transcript is automatic. Ignore punctuation, capitalisation, and obvious mis-hearings.

verdict is one sentence, second person, naming the single biggest problem. If it was strong, say what made it strong. Never both.

model_question is the question they should have asked — same archetype, same snippet, said the way someone respected in the room would say it. One sentence. It is a model to imitate.

likely_reply is one sentence: what the person in the snippet would most plausibly say back to THEIR question, not to your model one. If the question was weak, this shows them the cost — a deflection, a defensive answer, or a non-answer.`;

const SCHEMA = {
  type: "object",
  properties: {
    archetype_fit: { type: "integer", minimum: 0, maximum: 4 },
    specificity: { type: "integer", minimum: 0, maximum: 4 },
    brevity: { type: "integer", minimum: 0, maximum: 4 },
    opens: { type: "integer", minimum: 0, maximum: 4 },
    verdict: { type: "string" },
    model_question: { type: "string" },
    likely_reply: { type: "string" },
  },
  required: [
    "archetype_fit",
    "specificity",
    "brevity",
    "opens",
    "verdict",
    "model_question",
    "likely_reply",
  ],
  additionalProperties: false,
} as const;

export async function judgeQuestion(
  args: {
    archetype: { id: string; name: string; form: string; cue: string; trap: string };
    scenario: { setting: string; transcript: string; fits: string[] };
    transcript: string;
  },
  provider: Provider,
  apiKey: string
): Promise<QuestionVerdict> {
  const heard = args.transcript.trim();
  if (heard.length === 0) throw new PlaybookJudgeError("Nothing was transcribed.");

  const a = args.archetype;
  const user = `ARCHETYPE THEY WERE ASKED TO USE
${a.name} — ${a.form}
When to reach for it: ${a.cue}
Common trap: ${a.trap}

THE ROOM
${args.scenario.setting}

WHAT WAS SAID
${args.scenario.transcript}

ARCHETYPES THAT FIT THIS SNIPPET WELL (a floor, not a ceiling)
${args.scenario.fits.join(", ")}

THE QUESTION THEY ASKED
${heard}`;

  let parsed: Record<string, unknown>;
  let latencyMs: number;
  try {
    const r = await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_question_verdict", maxTokens: 800 },
      provider,
      apiKey
    );
    parsed = r.data;
    latencyMs = r.latencyMs;
  } catch (e) {
    throw e instanceof LLMError ? new PlaybookJudgeError(e.message) : e;
  }

  const scores: QuestionScores = {
    archetype_fit: clampScore(parsed.archetype_fit),
    specificity: clampScore(parsed.specificity),
    brevity: clampScore(parsed.brevity),
    opens: clampScore(parsed.opens),
  };

  return {
    scores,
    score: mean(scores),
    heard,
    verdict: str(parsed.verdict),
    model_question: str(parsed.model_question),
    likely_reply: str(parsed.likely_reply),
    latencyMs,
  };
}

/**
 * A plain mean, unweighted on purpose. Weighting `opens` higher would let a
 * question that is not the requested archetype score well for being pleasant,
 * and the drill is archetype practice first.
 */
export function mean(s: QuestionScores): number {
  return (s.archetype_fit + s.specificity + s.brevity + s.opens) / 4;
}

export const QUESTION_LABELS: { key: keyof QuestionScores; label: string; hint: string }[] = [
  { key: "archetype_fit", label: "Archetype", hint: "Was this the move you were asked for" },
  { key: "specificity", label: "Specificity", hint: "Tied to this room, not any room" },
  { key: "brevity", label: "Brevity", hint: "One sentence, no run-up" },
  { key: "opens", label: "Opens", hint: "They want to answer it" },
];
