// The debrief.
//
// You walk out of a meeting and, within a few hours, you speak for ninety
// seconds about what happened: what you said, what you did not say, what you
// wish you had said. This turns that into structure.
//
// It is the only feature in the app that touches a real room, and the design is
// shaped entirely by one rule: nothing about the meeting is recorded. No audio,
// no attendees, no minutes. The user's own retelling is the only input, and the
// only thing kept is what it says about *them*.
//
// The gap — the difference between what was said and what the user wishes they
// had said — is the most valuable field here. It is the one piece of training
// data the app cannot generate for itself. Everything in the Playbook is a
// simulation; this is the record of the real thing going wrong, in their words,
// while it is still fresh. The whole Rooms feature exists to capture that field.
//
// The counts are extracted, not scored. Whether you asked two questions or none
// is a fact about the meeting; a 0-4 rating of your performance from a model
// that was not there would be invention.

import { structured, str, LLMError, type Provider } from "./llm.ts";

export type RoomDebrief = {
  /** Did they speak at all. The first stage of the funnel and the hardest one. */
  spoke: boolean;
  /** Real questions put to the room. Not rhetorical, not "does that make sense". */
  questions_asked: number;
  /** Times they said what they thought and could be argued with. */
  positions_taken: number;
  /** Did anything they said visibly change the room's direction. */
  turned: boolean;
  /** Verbatim-ish, the contributions they made. */
  contributions: string[];
  /** The gap. Second person, specific, quoting the moment. */
  unsaid: string;
  /** The single archetype that would have unlocked the moment they missed. */
  suggested_archetype: string;
  /** One sentence, second person, the highest-leverage change for next time. */
  headline: string;
  latencyMs: number;
};

export class RoomJudgeError extends Error {}

const SYSTEM = `You are debriefing a senior software engineer immediately after a meeting. They are speaking from memory. You did not attend, and you must not pretend to know anything they did not say.

Your job is EXTRACTION, not evaluation. Read their account and record what happened.

  spoke              true if they contributed anything at all beyond greetings and agreement noises.
  questions_asked    count of real questions they put to the room — questions seeking information, testing a claim, or opening something up. Do NOT count "does that make sense?", "any thoughts?", or clarifying logistics. If unclear, count conservatively.
  positions_taken    count of times they stated a view someone could disagree with. Agreeing with someone else's point is not a position. Hedged non-committal statements are not positions.
  turned             true ONLY if they describe the room's direction actually changing because of something they said. A polite "good point" is not the room turning. Default to false.

  contributions      short paraphrases of what they actually said, in their words where possible. Empty array if they did not speak.

  unsaid             The gap between what they said and what they wish they had said. This is the most important field. Be specific and quote the moment they describe. If they mention hesitating, thinking of something too late, or holding back — that is the answer. If they describe no gap, say plainly that they did not name one rather than inventing one.

  suggested_archetype  ONE question archetype from the list you are given that would have opened the moment they missed. Give the id exactly as written. If nothing fits, give an empty string rather than a bad match.

  headline           One sentence, second person, the single highest-leverage change for the next room. Direct. No praise sandwich, no encouragement filler.

Never invent detail. If their account is vague, your extraction is thin — that is correct behaviour, not a failure. Do not speculate about other people's motives.`;

const SCHEMA = {
  type: "object",
  properties: {
    spoke: { type: "boolean" },
    questions_asked: { type: "integer", minimum: 0 },
    positions_taken: { type: "integer", minimum: 0 },
    turned: { type: "boolean" },
    contributions: { type: "array", items: { type: "string" } },
    unsaid: { type: "string" },
    suggested_archetype: { type: "string" },
    headline: { type: "string" },
  },
  required: [
    "spoke",
    "questions_asked",
    "positions_taken",
    "turned",
    "contributions",
    "unsaid",
    "suggested_archetype",
    "headline",
  ],
  additionalProperties: false,
} as const;

export async function judgeRoom(
  args: {
    title: string;
    decision: string;
    /** The archetypes they prepped, so the suggestion can name one they know. */
    archetypeMenu: { id: string; name: string; form: string }[];
    transcript: string;
  },
  provider: Provider,
  apiKey: string
): Promise<RoomDebrief> {
  const heard = args.transcript.trim();
  if (heard.length === 0) throw new RoomJudgeError("Nothing was transcribed.");

  const user = `THE MEETING
${args.title}

THE DECISION ON THE TABLE
${args.decision || "(not recorded)"}

QUESTION ARCHETYPES AVAILABLE (use an id exactly)
${args.archetypeMenu.map((a) => `${a.id} — ${a.name}: ${a.form}`).join("\n")}

WHAT THEY SAID HAPPENED
${heard}`;

  let parsed: Record<string, unknown>;
  let latencyMs: number;
  try {
    const r = await structured(
      { system: SYSTEM, user, schema: SCHEMA, name: "record_debrief", maxTokens: 1200 },
      provider,
      apiKey
    );
    parsed = r.data;
    latencyMs = r.latencyMs;
  } catch (e) {
    throw e instanceof LLMError ? new RoomJudgeError(e.message) : e;
  }

  const spoke = parsed.spoke === true;
  // Counts are gated on `spoke` rather than trusted independently: a model that
  // answers "did not speak" and "asked two questions" in the same object has
  // contradicted itself, and the funnel must not inherit the contradiction.
  return {
    spoke,
    questions_asked: spoke ? count(parsed.questions_asked) : 0,
    positions_taken: spoke ? count(parsed.positions_taken) : 0,
    turned: spoke && parsed.turned === true,
    contributions: Array.isArray(parsed.contributions)
      ? parsed.contributions.map(str).filter((s) => s.length > 0)
      : [],
    unsaid: str(parsed.unsaid),
    suggested_archetype: pickArchetype(parsed.suggested_archetype, args.archetypeMenu),
    headline: str(parsed.headline),
    latencyMs,
  };
}

function count(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(20, n);
}

/** A hallucinated id is dropped rather than shown as a broken link. */
function pickArchetype(v: unknown, menu: { id: string }[]): string {
  const id = str(v);
  return menu.some((a) => a.id === id) ? id : "";
}
