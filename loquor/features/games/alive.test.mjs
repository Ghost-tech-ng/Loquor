import { test } from "node:test";
import assert from "node:assert/strict";

import { deliveriesScore, retellScore, emphasisScore, locate, morph, pick, EMPHASIS_LINES, DELIVERY_LINES } from "./alive.ts";
import { labelFor } from "./prosody.ts";

const live = (score, spreadDb = 5, rangeSt = 4) => ({
  score,
  melody: { rangeSt, movementSt: 0.3, score },
  punch: { spreadDb, score },
  rhythm: null,
  label: labelFor(score),
});

test("deliveries: three identical takes earn only half the average", () => {
  const same = deliveriesScore([live(60), live(60), live(60)]);
  assert.equal(same.contrast, 0);
  assert.equal(same.score, 30);
});

test("deliveries: different takes beat identical ones at the same average", () => {
  const varied = deliveriesScore([live(30, 3, 2), live(90, 12, 9), live(60, 6, 5)]);
  const same = deliveriesScore([live(60), live(60), live(60)]);
  assert.ok(varied.contrast > 50);
  assert.ok(varied.score > same.score);
});

test("retell: the gap is retell minus read", () => {
  const r = retellScore(live(40), live(70));
  assert.equal(r.gap, 30);
  assert.equal(r.score, Math.round(0.7 * 40 + 0.3 * 70));
});

test("retell: reading livelier than you talk is not punished", () => {
  const r = retellScore(live(80), live(50));
  assert.equal(r.gap, -30);
  assert.equal(r.score, Math.round(0.7 * 80 + 30));
});

test("emphasis: all hits and lively voice scores high, all misses low", () => {
  assert.equal(emphasisScore([{ hit: true, liveliness: 100 }, { hit: true, liveliness: 100 }]), 100);
  assert.equal(emphasisScore([{ hit: false, liveliness: null }]), 0);
  assert.equal(emphasisScore([{ hit: true, liveliness: null }, { hit: false, liveliness: 50 }]), 50);
  assert.equal(emphasisScore([]), 0);
});

test("locate finds the target regardless of case and punctuation", () => {
  const words = ["I", "never", "said", "she", "stole"].map((w, i) => ({ word: w, start: i, end: i + 0.5 }));
  assert.equal(locate(words, "Never"), 1);
  assert.equal(locate([{ word: "Friday,", start: 0, end: 1 }], "Friday"), 0);
  assert.equal(locate(words, "money"), -1);
});

test("every emphasis target appears in its line", () => {
  for (const l of EMPHASIS_LINES) {
    const words = l.text.split(/\s+/).map((w, i) => ({ word: w, start: i, end: i + 0.4 }));
    assert.notEqual(locate(words, l.target), -1, l.text);
  }
});

test("morph clamps to 0..1", () => {
  assert.equal(morph(0), 0);
  assert.equal(morph(30), 0);
  assert.equal(morph(55), 0.5);
  assert.equal(morph(100), 1);
});

test("pick avoids the previous item when it can", () => {
  for (let i = 0; i < 50; i++) assert.notEqual(pick(DELIVERY_LINES, DELIVERY_LINES[0]), DELIVERY_LINES[0]);
  assert.equal(pick(["only"], "only"), "only");
});
