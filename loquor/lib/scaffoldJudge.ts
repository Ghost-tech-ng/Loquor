// The scaffold drill judge.
//
// The Playbook trains asking. This trains arguing. You are given a position and
// a named structure — PREP, SCQA, concede-and-narrow, steel-and-turn, BLUF —
// and ninety seconds to make the case out loud.
//
// The judge scores each STEP separately, not the argument as a whole, and that
// is the entire point. "That was unconvincing" is unusable feedback. "You had a
// point and a reason but never gave an example, so it stayed abstract" tells you
// exactly which ninety seconds to record again. A step-level verdict is a repair
// instruction; a global score is a verdict on you.
//
// Steps are matched in ORDER. Making all the right moves in the wrong sequence
// is a real failure — a concession that arrives after the narrowing reads as
// retreat rather than as generosity, and BLUF with the bottom line last is not
// BLUF at all.

import { structured, clampScore, str, LLMError, type Provider } from "./llm.ts";

export type StepVerdict = {
  label: string;
  /** 0–4 for this step alone. */
  score: number;
  /** Verbatim from the transcript, or empty when the step never happened. */
  heard: string;
  /** One sentence: what was missing, or what made it land. */
  note: string;
};

export type ScaffoldVerdict = {
  steps: StepVerdict[];
  /** Were the steps in the scaffold's order. */
  in_order: boolean;
  /** 0–4 mean across steps, with an order penalty. Feeds the EWMA. */
  score: number;
  heard: string;
  /** One sentence, second person, the single highest-leverage fix. */
  headline: string;
  /** The whole argument, rewritten to the scaffold. Under 90 seconds of speech. */
  model_argument: string;
  latencyMs: number;
};

export class ScaffoldJudgeError extends Error {}

const SYSTEM = `You judge whether a spoken argument followed a named structure. The speaker is a senior software engineer practising how to make a case in a meeting.

You are given the scaffold's steps in order. For EACH step, in the order given, decide whether the speaker did it and how well.

  score  0 the step never happened / 1 gestured at / 2 present but weak / 3 done properly / 4 done well enough to quote
  heard  the words from the transcript that constitute this step, copied VERBATIM. Empty string if the step did not happen. Never paraphrase — this is used to show the speaker their own words.
  note   one sentence, second person. If the step is missing, say what should have been there instead of naming the omission twice. If it is strong, say what made it strong.

in_order: true only if the steps that DID happen appeared in the scaffold's sequence. Steps that were skipped do not break order. Order matters: a concession after the narrowing reads as retreat, and a bottom line at the end is not a bottom line first.

headline: one sentence, second person, the single highest-leverage fix. Direct. No praise sandwich.

model_argument: the same position, argued to this scaffold, as one continuous piece of speech. Under 200 words — it has to be sayable in ninety seconds. Use their subject and their actual reasons where they gave any. It is a model to imitate, not commentary on their attempt.

The transcript is automatic. Ignore punctuation, capitalisation, and obvious mis-hearings. Filler words are measured separately — never mention them.`;

const SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 4 },
          heard: { type: "string" },
          note: { type: "string" },
        },
        required: ["label", "score", "heard", "note"],
        additionalProperties: false,
      },
    },
    in_order: { type: "boolean" },
    headline: { type: "string" },
    model_argument: { type: "string" },
  },
  required: ["steps", "in_order", "headline", "model_argument"],
  additionalProperties: false,
} as const;

export async function judgeScaffold(
  args: {
    scaffold: { id: string; name: string; gloss: string; steps: { label: string; ask: string }[] };
    position: string;
    transcript: string;
  },
  provider: Provider,
  apiKey: string
): Promise<ScaffoldVerdict> {
  const heard = args.transcript.trim();
  if (heard.length === 0) throw new ScaffoldJudgeError("Nothing was transcribed.");

  const sc = args.scaffold;
  const user = `SCAFFOLD
${sc.name} — ${sc.gloss}

STEPS, IN ORDER
${sc.steps.map((s, i) => `${i + 1}. ${s.label} — ${s.ask}`).join("\n")}

THE POSITION THEY WERE ASKED TO ARGUE
${args.position}

WHAT THEY SAID
${heard}`;

  let parsed: Record<string, unknown>;
  let latencyMs: number;
  try {
    const r = await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_scaffold_verdict", maxTokens: 1600 },
      provider,
      apiKey
    );
    parsed = r.data;
    latencyMs = r.latencyMs;
  } catch (e) {
    throw e instanceof LLMError ? new ScaffoldJudgeError(e.message) : e;
  }

  // The model's step list is aligned back onto the real scaffold rather than
  // trusted: a returned array that is short, long, or relabelled would otherwise
  // render as a scaffold the user was never asked to follow.
  const returned = Array.isArray(parsed.steps) ? (parsed.steps as Record<string, unknown>[]) : [];
  const steps: StepVerdict[] = sc.steps.map((s, i) => {
    const r = returned[i] ?? {};
    return {
      label: s.label,
      score: clampScore(r.score),
      heard: str(r.heard),
      note: str(r.note),
    };
  });

  return {
    steps,
    in_order: parsed.in_order === true,
    score: scaffoldScore(steps, parsed.in_order === true),
    heard,
    headline: str(parsed.headline),
    model_argument: str(parsed.model_argument),
    latencyMs,
  };
}

/**
 * Mean of the steps, less half a point when they arrived out of sequence.
 *
 * Half a point rather than a whole one: the steps being present at all is most
 * of the work, and someone who makes every move but misorders two of them is
 * much closer to competent than someone who skipped a move entirely.
 */
export function scaffoldScore(steps: StepVerdict[], inOrder: boolean): number {
  if (steps.length === 0) return 0;
  const m = steps.reduce((a, s) => a + s.score, 0) / steps.length;
  return Math.max(0, inOrder ? m : m - 0.5);
}
