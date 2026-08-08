// node --experimental-strip-types --test lib/coach.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  alphaFor,
  updateSkill,
  mastery,
  weakest,
  familyAverages,
  buildPrep,
  funnel,
  ratio,
} from "./coach.ts";
import { ARCHETYPES, archetype, byFamily, FAMILY_LABELS } from "../content/archetypes.ts";
import { SCENARIOS, pickScenario } from "../content/scenarios.ts";
import { SCAFFOLDS, MOVES, COUNTERPARTS } from "../content/scaffolds.ts";

const NOW = 1_700_000_000_000;

function states(entries) {
  return new Map(
    entries.map(([itemId, attempts, ewma, lastAt = NOW]) => [
      itemId,
      { itemId, attempts, ewma, lastAt },
    ])
  );
}

// ── EWMA ──────────────────────────────────────────────────────────────────────

test("first attempt is the average, not a fraction of it", () => {
  const s = updateSkill(undefined, "a", 4, NOW);
  assert.equal(s.attempts, 1);
  assert.equal(s.ewma, 4);
});

test("second attempt is the true mean of two", () => {
  let s = updateSkill(undefined, "a", 4, NOW);
  s = updateSkill(s, "a", 2, NOW + 1);
  assert.equal(s.attempts, 2);
  assert.equal(s.ewma, 3);
});

test("alpha floors at 0.3 so the average stays responsive forever", () => {
  assert.equal(alphaFor(0), 1);
  assert.equal(alphaFor(1), 0.5);
  assert.equal(alphaFor(50), 0.3);
});

test("a long good run is dragged down by a bad patch", () => {
  let s;
  for (let i = 0; i < 20; i++) s = updateSkill(s, "a", 4, NOW + i);
  assert.equal(s.ewma, 4);
  for (let i = 0; i < 3; i++) s = updateSkill(s, "a", 0, NOW + 100 + i);
  assert.ok(s.ewma < 1.5, `expected recent failures to dominate, got ${s.ewma}`);
});

test("scores are clamped into 0..4", () => {
  assert.equal(updateSkill(undefined, "a", 9, NOW).ewma, 4);
  assert.equal(updateSkill(undefined, "a", -3, NOW).ewma, 0);
});

test("mastery needs reps, not just one lucky score", () => {
  assert.equal(mastery(undefined), "untried");
  assert.equal(mastery({ itemId: "a", attempts: 1, ewma: 4, lastAt: NOW }), "shaky");
  assert.equal(mastery({ itemId: "a", attempts: 5, ewma: 3.2, lastAt: NOW }), "solid");
  assert.equal(mastery({ itemId: "a", attempts: 5, ewma: 2.1, lastAt: NOW }), "working");
});

// ── selection ─────────────────────────────────────────────────────────────────

test("untried items outrank any scored item, however badly scored", () => {
  const order = weakest(["a", "b", "c"], states([["a", 4, 0.1], ["c", 2, 3.9]]));
  assert.equal(order[0], "b");
});

test("among tried items the worst average comes first", () => {
  const order = weakest(["a", "b", "c"], states([["a", 3, 2.0], ["b", 3, 0.5], ["c", 3, 3.5]]));
  assert.deepEqual(order, ["b", "a", "c"]);
});

test("equal averages break on staleness, so drills do not ping-pong", () => {
  const order = weakest(
    ["a", "b"],
    states([["a", 3, 2.0, NOW], ["b", 3, 2.0, NOW - 86_400_000]])
  );
  assert.deepEqual(order, ["b", "a"]);
});

test("family averages count only tried items but total counts all", () => {
  const avg = familyAverages(ARCHETYPES, states([["steel-man", 4, 2]]));
  const frame = avg[/** @type {const} */ ("frame")];
  assert.equal(frame.total, byFamily("frame").length);
  assert.equal(frame.tried, 1);
  assert.equal(frame.avg, 2);
});

// ── prep cards ────────────────────────────────────────────────────────────────

function prepInput(overrides = {}) {
  return {
    decision: "whether to migrate off Dynamo",
    archetypes: ARCHETYPES,
    states: new Map(),
    scaffolds: SCAFFOLDS,
    scaffoldStates: new Map(),
    ...overrides,
  };
}

test("a prep card holds three questions and never repeats a family", () => {
  const card = buildPrep(prepInput());
  assert.equal(card.questions.length, 3);
  const fams = card.questions.map((q) => archetype(q.id).family);
  assert.equal(new Set(fams).size, 3);
});

test("the card names the decision so the intent is not generic", () => {
  const card = buildPrep(prepInput());
  assert.match(card.intent, /Dynamo/);
  assert.match(buildPrep(prepInput({ decision: "  " })).intent, /before the halfway point/);
});

test("a well-drilled archetype is not offered again while weaker ones exist", () => {
  const strong = ARCHETYPES.slice(0, 5).map((a) => [a.id, 6, 4.0]);
  const card = buildPrep(prepInput({ states: states(strong) }));
  for (const q of card.questions) {
    assert.ok(
      !strong.some(([id]) => id === q.id),
      `${q.id} is already solid and should not be on the card`
    );
  }
});

test("the card carries a scaffold with its steps", () => {
  const card = buildPrep(prepInput());
  assert.ok(card.scaffold);
  assert.ok(card.scaffold.steps.length >= 3);
});

// ── funnel ────────────────────────────────────────────────────────────────────

test("an empty funnel says so rather than dividing by zero", () => {
  const f = funnel({ entered: 0, spoke: 0, questions: 0, positions: 0, turned: 0 });
  assert.equal(f.bottleneck, null);
  for (const s of f.stages) assert.ok(Number.isFinite(s.ofPrevious));
});

test("silence is named as the bottleneck", () => {
  const f = funnel({ entered: 10, spoke: 2, questions: 4, positions: 1, turned: 0 });
  assert.equal(f.bottleneck.key, "turned");
  assert.match(f.headline, /Silence/);
});

test("asking without ever taking a position is called out", () => {
  const f = funnel({ entered: 5, spoke: 5, questions: 12, positions: 0, turned: 0 });
  assert.match(f.headline, /what you think/);
});

test("questions can exceed rooms and render as a multiple, not 240%", () => {
  const f = funnel({ entered: 5, spoke: 5, questions: 12, positions: 3, turned: 1 });
  const q = f.stages.find((s) => s.key === "questions");
  assert.equal(ratio(q.ofPrevious), "2.4×");
  assert.equal(ratio(0.42), "42%");
});

// ── content integrity ─────────────────────────────────────────────────────────

test("archetype ids are unique and every field is filled", () => {
  const seen = new Set();
  for (const a of ARCHETYPES) {
    assert.ok(!seen.has(a.id), `duplicate archetype id ${a.id}`);
    seen.add(a.id);
    for (const k of ["name", "form", "cue", "trap"]) {
      assert.ok(a[k].trim().length > 0, `${a.id}.${k} is empty`);
    }
    assert.ok(a.variants.length >= 2, `${a.id} needs at least two variants`);
    assert.ok(FAMILY_LABELS[a.family], `${a.id} has an unknown family`);
  }
  assert.equal(ARCHETYPES.length, 30);
});

test("every scenario's fits resolve to real archetypes", () => {
  for (const s of SCENARIOS) {
    assert.ok(s.fits.length >= 2, `${s.id} needs at least two fitting archetypes`);
    for (const id of s.fits) {
      assert.ok(archetype(id), `scenario ${s.id} points at unknown archetype ${id}`);
    }
  }
});

test("scenarios are split between the user's field and everything else", () => {
  const field = SCENARIOS.filter((s) => s.domain === "field").length;
  const random = SCENARIOS.filter((s) => s.domain === "random").length;
  assert.ok(field >= 6 && random >= 6, `field ${field}, random ${random}`);
});

test("transcripts are long enough to contain something worth questioning", () => {
  for (const s of SCENARIOS) {
    const words = s.transcript.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 60, `${s.id} is only ${words} words`);
  }
});

test("scenario picking avoids repeats and alternates domain", () => {
  const first = pickScenario({ usedIds: [], lastDomain: "field" });
  assert.equal(first.domain, "random");
  const usedIds = SCENARIOS.filter((s) => s.id !== first.id).map((s) => s.id);
  assert.equal(pickScenario({ usedIds }).id, first.id);
  // Exhausted history must still return something rather than throw.
  assert.ok(pickScenario({ usedIds: SCENARIOS.map((s) => s.id) }));
});

test("scaffolds, moves and counterparts are complete", () => {
  for (const s of SCAFFOLDS) {
    assert.ok(s.steps.length >= 3, `${s.id} has too few steps`);
    for (const st of s.steps) {
      assert.ok(st.ask.trim().length > 0, `${s.id}/${st.label} has no ask`);
      assert.ok(st.shareS > 0, `${s.id}/${st.label} has no time budget`);
    }
    assert.ok(s.example.trim().length > 0, `${s.id} has no worked example`);
  }
  for (const m of MOVES) assert.ok(m.trap.trim().length > 0, `${m.id} has no trap`);
  for (const c of COUNTERPARTS) {
    assert.ok(c.guard.trim().length > 0, `${c.id} has no guard`);
    assert.ok(c.substance.trim().length > 0, `${c.id} reveals nothing worth earning`);
  }
});
