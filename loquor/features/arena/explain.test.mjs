import { test } from "node:test";
import assert from "node:assert/strict";

import { TOPICS } from "./topics.ts";
import { EXPLAIN } from "./explain.ts";

test("every topic has a plain explainer with two sides", () => {
  for (const t of TOPICS) {
    const e = EXPLAIN[t.id];
    assert.ok(e, `${t.id} has no explainer`);
    assert.ok(e.ask.length > 40, `${t.id} ask is too thin`);
    assert.equal(e.sides.length, 2);
  }
});

test("explainer terms are exactly the topic's loaded terms", () => {
  for (const t of TOPICS) {
    assert.deepEqual(Object.keys(EXPLAIN[t.id].terms).sort(), [...t.loadedTerms].sort(), t.id);
  }
});

test("no orphan explainers", () => {
  const ids = new Set(TOPICS.map((t) => t.id));
  for (const id of Object.keys(EXPLAIN)) assert.ok(ids.has(id), `${id} is not a topic`);
});

import { scaffoldLevel, takesToNext } from "./scaffold.ts";

test("scaffold fades with takes", () => {
  assert.equal(scaffoldLevel(0, []), 0);
  assert.equal(scaffoldLevel(4, []), 0);
  assert.equal(scaffoldLevel(5, []), 1);
  assert.equal(scaffoldLevel(15, []), 2);
  assert.equal(scaffoldLevel(30, []), 3);
  assert.equal(scaffoldLevel(200, [15, 16, 14]), 3);
});

test("weak recent judgements ease it back one step, never below guided", () => {
  assert.equal(scaffoldLevel(30, [6, 7, 8]), 2);
  assert.equal(scaffoldLevel(5, [4, 5, 6]), 0);
  assert.equal(scaffoldLevel(0, [2, 2, 2]), 0);
  // Two scores is not a trend.
  assert.equal(scaffoldLevel(30, [4, 4]), 3);
  // Unscored takes are skipped, not counted as zero.
  assert.equal(scaffoldLevel(30, [null, 15, null, 14, 16]), 3);
});

test("takes to next level", () => {
  assert.equal(takesToNext(3, 0), 2);
  assert.equal(takesToNext(20, 2), 10);
  assert.equal(takesToNext(40, 3), null);
});
