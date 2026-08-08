// node --test lib/metrics.test.mjs  (run via: npm test)
//
// The metrics engine is the only thing in Loquor that produces a 90-day trend.
// If it is subtly wrong, every number the user ever sees is wrong in the same
// direction and nothing about the UI will reveal it. Hence real tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMetrics,
  toSentences,
  fillerVerdict,
  bandPosition,
  DEAD_AIR_THRESHOLD_S,
} from "./metrics.ts";

/** Lays words end to end at `rate` seconds each, starting at `from`. */
function seq(tokens, { from = 0, rate = 0.4 } = {}) {
  return tokens.map((word, i) => ({
    word,
    start: from + i * rate,
    end: from + i * rate + rate * 0.8,
  }));
}

test("empty input does not divide by zero", () => {
  const m = computeMetrics([]);
  assert.equal(m.fillerRate, 0);
  assert.equal(m.wpm, 0);
  assert.equal(m.durationS, 0);
});

test("fillers are counted and excluded from the word count", () => {
  // 10 tokens, 3 of them fillers, laid out over exactly 60s.
  const words = seq(["um", "we", "should", "uh", "cache", "the", "result", "hmm", "i", "think"], {
    rate: 6,
  });
  const m = computeMetrics(words);

  assert.equal(m.fillerCount, 3);
  assert.equal(m.wordCount, 7, "fillers must not inflate wpm");
  assert.equal(m.fillerMarks.length, 3);
});

test("filler rate is per minute, not per take", () => {
  // 4 fillers in 30 seconds is 8/min, not 4.
  const words = seq(["um", "a", "uh", "b", "um", "c", "uh", "d"], { rate: 3.75 });
  const m = computeMetrics(words, 30);
  assert.equal(m.durationS, 30);
  assert.equal(m.fillerCount, 4);
  assert.equal(m.fillerRate, 8);
});

test("recorder duration wins over word span, so leading silence still counts", () => {
  // Speech occupies 10s but the recording ran 60s: four seconds of stalling
  // before the first word is real dead air and must not be forgiven.
  const words = seq(["we", "should", "cache", "it"], { from: 40, rate: 2.5 });
  const m = computeMetrics(words, 60);

  assert.equal(m.durationS, 60);
  assert.equal(m.wpm, 4, "4 words over a full minute");
  for (const mark of m.fillerMarks) assert.ok(mark >= 0 && mark <= 1);
});

test("dead air needs a gap strictly above threshold", () => {
  const under = [
    { word: "a", start: 0, end: 1 },
    { word: "b", start: 1 + DEAD_AIR_THRESHOLD_S - 0.1, end: 5 },
  ];
  const over = [
    { word: "a", start: 0, end: 1 },
    { word: "b", start: 1 + DEAD_AIR_THRESHOLD_S + 0.5, end: 6 },
  ];
  assert.equal(computeMetrics(under).deadAirCount, 0);
  assert.equal(computeMetrics(over).deadAirCount, 1);
});

test("a filler inside a long gap does not rescue it", () => {
  // "um" sits in the middle of a 7s stall. Two gaps, both over threshold.
  const words = [
    { word: "so", start: 0, end: 0.5 },
    { word: "um", start: 3.5, end: 4.0 },
    { word: "caching", start: 7.5, end: 8.0 },
  ];
  const m = computeMetrics(words);
  assert.equal(m.deadAirCount, 2, "sound coming out is not the same as speaking");
  assert.ok(m.deadAirTotalS > 6);
});

test("hedge density is a percentage of content words", () => {
  const words = seq(["i", "think", "we", "should", "maybe", "just", "cache", "it"], { rate: 7.5 });
  const m = computeMetrics(words);
  // "i think", "maybe", "just"
  assert.equal(m.hedgeCount, 3);
  assert.equal(m.wordCount, 8);
  assert.equal(m.hedgeDensity, 37.5);
});

test("hedges match on word boundaries", () => {
  // "unlike" must not match "like"; "adjusted" must not match "just".
  const words = seq(["unlike", "the", "adjusted", "baseline"], { rate: 15 });
  assert.equal(computeMetrics(words).hedgeCount, 0);
});

test("fractions stay inside 0..1", () => {
  const words = seq(["um", "a", "b", "um", "c", "um"], { from: 5, rate: 2 });
  const m = computeMetrics(words, 30);
  for (const f of m.fillerMarks) assert.ok(f >= 0 && f <= 1, `mark ${f} out of range`);
  for (const [s, e] of m.deadAirSpans) {
    assert.ok(s >= 0 && s <= 1 && e >= 0 && e <= 1);
    assert.ok(e >= s);
  }
});

test("sentences split on terminal punctuation and keep timing", () => {
  const words = [
    { word: "We", start: 0, end: 0.3 },
    { word: "should", start: 0.3, end: 0.6 },
    { word: "cache.", start: 0.6, end: 1.0 },
    { word: "It", start: 1.5, end: 1.7 },
    { word: "helps.", start: 1.7, end: 2.2 },
  ];
  const s = toSentences(words);
  assert.equal(s.length, 2);
  assert.equal(s[0].text, "We should cache.");
  assert.equal(s[0].start, 0);
  assert.equal(s[1].start, 1.5);
  assert.equal(s[1].end, 2.2);
});

test("run-on speech still yields sentences", () => {
  // Whisper sometimes returns 100 words with no terminal punctuation. The
  // Rewrite feature needs a sentence to point at regardless.
  const words = seq(new Array(90).fill("word"), { rate: 0.4 });
  const s = toSentences(words);
  assert.ok(s.length >= 2, "length cap must break up unpunctuated runs");
});

test("verdict thresholds match the research", () => {
  assert.equal(fillerVerdict(4.9), "on-target");
  assert.equal(fillerVerdict(5), "on-target");
  assert.equal(fillerVerdict(5.1), "drifting");
  assert.equal(fillerVerdict(12), "drifting");
  assert.equal(fillerVerdict(12.1), "over");
});

test("band position is clamped and centred", () => {
  assert.equal(bandPosition(-1000, 130, 165), 0);
  assert.equal(bandPosition(1000, 130, 165), 1);
  const mid = bandPosition(147.5, 130, 165);
  assert.ok(Math.abs(mid - 0.5) < 0.01, "midpoint of the band sits at the middle");
});
