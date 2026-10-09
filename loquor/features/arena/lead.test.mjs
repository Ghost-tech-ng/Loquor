import { test } from "node:test";
import assert from "node:assert/strict";

import { fillerCount, leadLine } from "./lead.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;
const take = (id, daysAgo, rate) => ({ id, started_at: now - daysAgo * DAY, filler_rate: rate });

test("counts read as words", () => {
  assert.equal(fillerCount(0), "No fillers");
  assert.equal(fillerCount(1), "1 filler");
  assert.equal(fillerCount(3), "3 fillers");
});

test("a new low this week says so", () => {
  const line = leadLine({ take: take("a", 0, 2), count: 3, others: [take("b", 2, 4), take("c", 5, 6)], parentRate: null });
  assert.equal(line, "3 fillers. Your best this week.");
});

test("takes older than a week are not compared", () => {
  const line = leadLine({ take: take("a", 0, 9), count: 9, others: [take("b", 8, 1)], parentRate: null });
  assert.equal(line, "9 fillers. Audible, not costly yet.");
});

test("over target and behind the week's best names the best", () => {
  const line = leadLine({ take: take("a", 0, 8), count: 8, others: [take("b", 1, 3.5)], parentRate: null });
  assert.equal(line, "8 fillers. Your best this week was 3.5 a minute.");
});

test("reopening an old card ignores takes recorded after it", () => {
  const line = leadLine({ take: take("a", 3, 2), count: 2, others: [take("b", 1, 0.5), take("c", 5, 4)], parentRate: null });
  assert.equal(line, "2 fillers. Your best this week.");
});

test("a rewrite is compared with its first take", () => {
  assert.equal(
    leadLine({ take: take("a", 0, 1), count: 1, others: [], parentRate: 4 }),
    "1 filler. Cleaner than your first take."
  );
  assert.equal(leadLine({ take: take("a", 0, 4), count: 4, others: [], parentRate: 4 }), "4 fillers. Level with your first take.");
});
