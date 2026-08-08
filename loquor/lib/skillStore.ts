// The skill layer's seam.
//
// coach.ts is pure arithmetic and knows nothing about SQLite. db.ts stores rows
// and knows nothing about what a drill is. This joins them, exactly as
// lexiconStore.ts joins fsrs.ts to db.ts, and it owns the one policy decision
// that is neither maths nor storage: what the app picks for you to practise
// next, and how it decides you are done covering the breadth.

import { ARCHETYPES, archetype, byFamily, type Archetype, type Family } from "../content/archetypes.ts";
import { SCAFFOLDS, MOVES } from "../content/scaffolds.ts";
import { SCENARIOS, pickScenario, type Scenario } from "../content/scenarios.ts";
import {
  buildPrep,
  familyAverages,
  mastery,
  updateSkill,
  weakest,
  type Mastery,
  type PrepCard,
  type SkillState,
} from "./coach.ts";
import { putSkill, skillStats, usedContextIds, type Drill } from "./db.ts";

export type { Drill } from "./db.ts";

async function load(drill: Drill): Promise<Map<string, SkillState>> {
  const rows = await skillStats(drill);
  return new Map(
    rows.map((r) => [
      r.item_id,
      { itemId: r.item_id, attempts: r.attempts, ewma: r.ewma, lastAt: r.last_at },
    ])
  );
}

/** Fold one 0–4 result into an item's running average and persist it. */
export async function record(
  drill: Drill,
  itemId: string,
  score: number,
  now = Date.now()
): Promise<SkillState> {
  const states = await load(drill);
  const next = updateSkill(states.get(itemId), itemId, score, now);
  await putSkill({
    drill,
    item_id: next.itemId,
    attempts: next.attempts,
    ewma: next.ewma,
    last_at: next.lastAt,
  });
  return next;
}

export type ArchetypeStat = { archetype: Archetype; state: SkillState | undefined; mastery: Mastery };

export async function archetypeStats(): Promise<ArchetypeStat[]> {
  const states = await load("archetype");
  return ARCHETYPES.map((a) => ({
    archetype: a,
    state: states.get(a.id),
    mastery: mastery(states.get(a.id)),
  }));
}

export async function familyMap(): Promise<
  { family: Family; tried: number; total: number; avg: number }[]
> {
  const states = await load("archetype");
  const avgs = familyAverages(ARCHETYPES, states);
  return (Object.keys(avgs) as Family[]).map((f) => ({ family: f, ...avgs[f] }));
}

export type Assignment = { archetype: Archetype; scenario: Scenario };

/**
 * The next Playbook drill.
 *
 * The archetype is whichever is weakest; the scenario is one not yet drilled,
 * alternating between the user's own field and everything else. The two are
 * chosen independently on purpose — pairing each archetype with the snippet it
 * fits best would teach that this archetype belongs to that kind of meeting,
 * and the skill is being able to reach for the move anywhere. `fits` is a hint
 * to the judge, never a filter on what gets asked.
 */
export async function nextDrill(pin?: string): Promise<Assignment> {
  const states = await load("archetype");
  const id = pin ?? weakest(ARCHETYPES.map((a) => a.id), states, 1)[0]!;
  const a = archetype(id) ?? ARCHETYPES[0]!;

  const used = await usedContextIds("playbook");
  const lastDomain = SCENARIOS.find((s) => s.id === used[used.length - 1])?.domain;
  return { archetype: a, scenario: pickScenario({ usedIds: used, lastDomain }) };
}

/** The weakest scaffold, for the Lab's argument drill. */
export async function nextScaffold() {
  const states = await load("scaffold");
  const id = weakest(SCAFFOLDS.map((s) => s.id), states, 1)[0]!;
  return SCAFFOLDS.find((s) => s.id === id) ?? SCAFFOLDS[0]!;
}

export async function scaffoldStats() {
  const states = await load("scaffold");
  return SCAFFOLDS.map((s) => ({
    scaffold: s,
    state: states.get(s.id),
    mastery: mastery(states.get(s.id)),
  }));
}

export async function moveStats() {
  const states = await load("move");
  return MOVES.map((m) => ({ move: m, state: states.get(m.id), mastery: mastery(states.get(m.id)) }));
}

/** Assemble a Prep Card from current skill state. */
export async function prepFor(decision: string): Promise<PrepCard> {
  const [states, scaffoldStates] = await Promise.all([load("archetype"), load("scaffold")]);
  return buildPrep({ decision, archetypes: ARCHETYPES, states, scaffolds: SCAFFOLDS, scaffoldStates });
}

/** Headline coverage for Today: how much of the playbook has been touched at all. */
export async function coverage(): Promise<{ tried: number; solid: number; total: number }> {
  const states = await load("archetype");
  let tried = 0;
  let solid = 0;
  for (const a of ARCHETYPES) {
    const m = mastery(states.get(a.id));
    if (m !== "untried") tried++;
    if (m === "solid") solid++;
  }
  return { tried, solid, total: ARCHETYPES.length };
}

/** Family coverage, used by the Playbook map's header line. */
export function familySize(f: Family): number {
  return byFamily(f).length;
}
