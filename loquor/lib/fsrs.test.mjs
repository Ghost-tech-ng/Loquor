// node --experimental-strip-types --test lib/fsrs.test.mjs
//
// These do not check FSRS against reference values — the weights are published
// and the formulas are transcribed, so a value test would only assert that I
// typed them in correctly, once. What is worth testing is the properties the app
// depends on, because those are what break when someone "improves" the module.

import test from "node:test";
import assert from "node:assert/strict";

import {
  OWNED_STABILITY_DAYS,
  REAL_USE_FLOOR_DAYS,
  creditRealUse,
  describeInterval,
  intervalFor,
  isNew,
  newCard,
  owned,
  retrievability,
  review,
} from "./fsrs.ts";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

test("a new card is due immediately and reads as new", () => {
  const c = newCard(T0);
  assert.equal(c.dueAt, T0);
  assert.equal(isNew(c), true);
  assert.equal(c.reps, 0);
});

test("retrievability starts at 1 and decays monotonically", () => {
  assert.equal(retrievability(0, 5), 1);
  const a = retrievability(1, 5);
  const b = retrievability(10, 5);
  const c = retrievability(100, 5);
  assert.ok(a > b && b > c);
  assert.ok(c > 0);
});

test("intervalFor recovers the requested retention", () => {
  for (const s of [1, 7, 60, 400]) {
    const days = intervalFor(s);
    assert.ok(Math.abs(retrievability(days, s) - 0.9) < 1e-9, `stability ${s}`);
  }
});

test("a better grade produces a longer interval", () => {
  const c = newCard(T0);
  const intervals = [1, 2, 3, 4].map((g) => review(c, g, T0).dueAt - T0);
  for (let i = 1; i < intervals.length; i++) {
    assert.ok(intervals[i] > intervals[i - 1], `grade ${i + 1} did not outrank grade ${i}`);
  }
});

test("a lapse comes back inside the session, not tomorrow", () => {
  const failed = review(newCard(T0), 1, T0);
  const gap = failed.dueAt - T0;
  assert.ok(gap > 0 && gap < DAY, `${gap}ms`);
  assert.equal(failed.lapses, 1);
});

test("a lapse never leaves stability higher than it was", () => {
  let c = review(newCard(T0), 3, T0);
  c = review(c, 4, T0 + 30 * DAY);
  const before = c.stability;
  const after = review(c, 1, T0 + 90 * DAY);
  assert.ok(after.stability <= before);
  assert.equal(after.lapses, 1);
});

test("same-day repetition is credited far more cautiously than a real interval", () => {
  const base = review(newCard(T0), 3, T0);
  const sameDay = review(base, 3, T0 + 3 * 3_600_000);
  const nextWeek = review(base, 3, T0 + 7 * DAY);
  assert.ok(
    sameDay.stability < nextWeek.stability,
    "cramming must not buy the same stability as spacing",
  );
});

test("repeated success grows stability without bound in the useful range", () => {
  let c = review(newCard(T0), 3, T0);
  let t = T0;
  let last = c.stability;
  for (let i = 0; i < 8; i++) {
    t += Math.max(DAY, c.dueAt - t);
    c = review(c, 3, t);
    assert.ok(c.stability > last, `review ${i} shrank stability`);
    last = c.stability;
  }
  assert.equal(owned(c), c.stability >= OWNED_STABILITY_DAYS);
  assert.equal(c.lapses, 0);
});

test("difficulty stays inside 1-10 under any sequence", () => {
  let c = newCard(T0);
  let t = T0;
  for (const g of [1, 1, 4, 4, 1, 3, 2, 4, 1, 2, 3, 4]) {
    t += 2 * DAY;
    c = review(c, g, t);
    assert.ok(c.difficulty >= 1 && c.difficulty <= 10, `difficulty ${c.difficulty}`);
  }
});

test("a real-world use never lowers stability and clears the floor", () => {
  const weak = creditRealUse(review(newCard(T0), 1, T0), T0);
  assert.ok(weak.stability >= REAL_USE_FLOOR_DAYS);

  let strong = review(newCard(T0), 4, T0);
  strong = review(strong, 4, T0 + 60 * DAY);
  const credited = creditRealUse(strong, T0 + 61 * DAY);
  assert.ok(credited.stability > strong.stability);
  // It is evidence, not a review: the rep count is unchanged.
  assert.equal(credited.reps, strong.reps);
});

test("describeInterval picks a unit a human would use", () => {
  assert.equal(describeInterval(10 * 60_000), "10 min");
  assert.equal(describeInterval(5 * 3_600_000), "5 h");
  assert.equal(describeInterval(3 * DAY), "3 d");
  assert.equal(describeInterval(90 * DAY), "3 mo");
  assert.equal(describeInterval(730 * DAY), "2.0 y");
});
