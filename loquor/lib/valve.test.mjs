import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_RUNGS,
  FLOOR_DB,
  MIN_SPREAD_DB,
  RUNGS,
  calibrationFault,
  calibrationUsable,
  decayPeak,
  hitRung,
  ladderResult,
  ladderVerdict,
  rungBand,
  rungCentreDb,
  rungPosition,
  sustainedPeak,
  thresholdTrend,
  workingRung,
} from "./valve.ts";
import { MATCH_PHRASE, PASSAGES, PRESSURE_PHRASES } from "../content/valve.ts";

// --------------------------------------------------------------- the content
//
// This is the load-bearing test in the feature. Everything else here is
// arithmetic that would fail loudly; a stray "and" in a drill phrase fails
// silently and invalidates every reading the drill has ever produced.

// English spells /m/, /n/ and /ŋ/ with exactly two letters, M and N, so the
// letter test below is the sound test.

function spokenLines() {
  return [...PRESSURE_PHRASES, MATCH_PHRASE, ...PASSAGES.map((p) => p.text)];
}

test("nothing the drill asks you to say contains a nasal consonant", () => {
  for (const line of spokenLines()) {
    const offenders = [...line.matchAll(/\S*[mn]\S*/gi)].map((m) => m[0]);
    assert.deepEqual(
      offenders,
      [],
      `nasal letter in drill text — the whole measurement depends on there being none:\n  "${line}"\n  offending words: ${offenders.join(", ")}`
    );
  }
});

test("the drill text is loaded with pressure consonants", () => {
  // A phrase of open vowels is comfortable and proves nothing: it is the stops
  // and fricatives that demand the oral pressure a weak seal cannot hold.
  for (const phrase of PRESSURE_PHRASES) {
    const letters = phrase.replace(/[^a-z]/gi, "");
    const pressure = (phrase.match(/[pbtdkgs]/gi) ?? []).length;
    assert.ok(
      pressure / letters.length > 0.2,
      `"${phrase}" is only ${((pressure / letters.length) * 100).toFixed(0)}% pressure consonants`
    );
  }
});

test("every passage is long enough for attention to wander off the seal", () => {
  // The carry-over step fails at its job if the reader can hold the whole thing
  // in working memory — the habit only reasserts once you are thinking about
  // meaning instead of mechanics.
  for (const p of PASSAGES) {
    assert.ok(p.text.split(/\s+/).length >= 55, `${p.id} is too short to carry over`);
  }
});

// ---------------------------------------------------------- the calibration

test("a usable calibration needs real distance between quiet and loud", () => {
  assert.equal(calibrationUsable({ quietDb: -40, loudDb: -12 }), true);
  assert.equal(calibrationFault({ quietDb: -40, loudDb: -12 }), null);
});

test("two takes at the same level are rejected rather than scored", () => {
  // The failure this guards against is not user error, it is iOS gain control
  // flattening the range. Five rungs interpolated across 3 dB would be five
  // names for one level, and the drill would report progress that is noise.
  const flat = { quietDb: -20, loudDb: -18 };
  assert.equal(calibrationUsable(flat), false);
  assert.match(calibrationFault(flat) ?? "", /nearly the same level/i);
});

test("silence is reported as a microphone problem, not a quiet voice", () => {
  const silent = { quietDb: FLOOR_DB - 5, loudDb: FLOOR_DB - 1 };
  assert.equal(calibrationUsable(silent), false);
  assert.match(calibrationFault(silent) ?? "", /microphone/i);
});

test("the spread threshold is the one being tested, not an accident", () => {
  assert.equal(calibrationUsable({ quietDb: -30, loudDb: -30 + MIN_SPREAD_DB }), true);
  assert.equal(calibrationUsable({ quietDb: -30, loudDb: -30 + MIN_SPREAD_DB - 0.1 }), false);
});

// ---------------------------------------------------------------- the rungs

test("the rungs tile the calibrated range exactly, with no gap and no overlap", () => {
  const c = { quietDb: -45, loudDb: -5 };
  for (let i = 0; i < ALL_RUNGS.length - 1; i++) {
    const a = rungBand(ALL_RUNGS[i], c);
    const b = rungBand(ALL_RUNGS[i + 1], c);
    assert.ok(Math.abs(a.highDb - b.lowDb) < 1e-9, `rung ${i + 1} does not meet rung ${i + 2}`);
  }
  assert.ok(Math.abs(rungBand(1, c).lowDb - c.quietDb) < 1e-9);
  assert.ok(Math.abs(rungBand(RUNGS, c).highDb - c.loudDb) < 1e-9);
});

test("rung position is monotonic in level", () => {
  // The single property that survives gain control, and therefore the only one
  // the drill is allowed to depend on: louder always reads as further up.
  const c = { quietDb: -50, loudDb: -10 };
  let last = -Infinity;
  for (let db = -60; db <= 0; db += 1) {
    const p = rungPosition(db, c);
    assert.ok(p >= last, `position fell going from quieter to louder at ${db} dB`);
    last = p;
  }
});

test("a compressed range still orders the rungs correctly", () => {
  // Exactly what a phone with aggressive gain control produces. The absolute
  // numbers are meaningless; the ordering is not, and the ordering is the drill.
  const squashed = { quietDb: -24, loudDb: -16 };
  assert.equal(calibrationUsable(squashed), true);
  assert.ok(rungCentreDb(4, squashed) > rungCentreDb(2, squashed));
  assert.equal(hitRung(rungCentreDb(3, squashed), 3, squashed), true);
});

test("speaking at the wrong rung does not count as hitting it", () => {
  const c = { quietDb: -50, loudDb: -10 };
  assert.equal(hitRung(rungCentreDb(5, c), 5, c), true);
  assert.equal(hitRung(rungCentreDb(1, c), 5, c), false);
  assert.equal(hitRung(rungCentreDb(2, c), 4, c), false);
});

// -------------------------------------------------------------- the ladder

const outcome = (rung, leaked, reached = true) => ({ rung, peakDb: -20, reached, leaked });

test("the threshold is the lowest rung that leaked", () => {
  const r = ladderResult([
    outcome(1, false),
    outcome(2, false),
    outcome(3, true),
    outcome(4, true),
    outcome(5, true),
  ]);
  assert.equal(r.threshold, 3);
  assert.equal(r.topClean, 2);
  assert.equal(r.complete, true);
});

test("a seal that holds everywhere reports above the top rung, not a failure", () => {
  const r = ladderResult(ALL_RUNGS.map((n) => outcome(n, false)));
  assert.equal(r.threshold, RUNGS + 1);
  assert.equal(r.topClean, RUNGS);
  assert.equal(r.complete, true);
  assert.match(ladderVerdict(r), /held at every level/i);
});

test("rungs the speaker never reached are not counted as clean", () => {
  // The whole reason this drill exists is a man who has spent years avoiding
  // volume. Scoring an unreached rung as a pass would hand him a perfect result
  // for never getting loud, which is the habit, not the cure.
  const r = ladderResult([
    outcome(1, false),
    outcome(2, false),
    outcome(3, false, false),
    outcome(4, false, false),
    outcome(5, false, false),
  ]);
  assert.equal(r.topClean, 2);
  assert.equal(r.complete, false);
  assert.match(ladderVerdict(r), /floor, not a limit/i);
});

test("a leak found low still completes the ladder", () => {
  // Once it has gone there is nothing above it worth measuring, so stopping
  // early is the correct behaviour rather than an abandoned session.
  const r = ladderResult([outcome(1, false), outcome(2, true)]);
  assert.equal(r.threshold, 2);
  assert.equal(r.complete, true);
});

test("leaking at the very bottom is reported as its own case", () => {
  const r = ladderResult([outcome(1, true)]);
  assert.equal(r.threshold, 1);
  assert.equal(r.topClean, 0);
  assert.equal(workingRung(r), 1);
  assert.match(ladderVerdict(r), /quietest/i);
});

test("a leak below a clean rung still caps the working level", () => {
  // Ordering is not guaranteed — someone can pass rung 4 after failing rung 3,
  // by luck or by a misread mirror. The lower failure is the honest reading.
  const r = ladderResult([
    outcome(1, false),
    outcome(2, false),
    outcome(3, true),
    outcome(4, false),
  ]);
  assert.equal(r.threshold, 3);
  assert.equal(r.topClean, 2, "a clean rung above the leak must not raise the working level");
  assert.equal(workingRung(r), 2);
});

// --------------------------------------------------------------- the trend

test("no trend is claimed before there is enough history to survive a bad day", () => {
  assert.equal(thresholdTrend([3, 4, 3, 2, 4]).ready, false);
});

test("a rising threshold reads as better", () => {
  const t = thresholdTrend([5, 5, 4, 3, 2, 3]);
  assert.equal(t.ready, true);
  assert.equal(t.direction, "better");
});

test("a falling threshold reads as worse", () => {
  assert.equal(thresholdTrend([2, 2, 3, 5, 4, 5]).direction, "worse");
});

test("half a rung of movement is not movement", () => {
  assert.equal(thresholdTrend([3, 4, 3, 3, 4, 3]).direction, "flat");
});

// --------------------------------------------------------------- the meter

test("the peak holds through the gaps between words and then decays", () => {
  let p = FLOOR_DB;
  p = decayPeak(p, -14);
  assert.equal(p, -14, "a new maximum is taken immediately");
  p = decayPeak(p, -50);
  assert.equal(p, -15.2, "a gap decays the peak rather than collapsing it");
});

test("the peak cannot decay below silence", () => {
  let p = FLOOR_DB + 0.5;
  for (let i = 0; i < 20; i++) p = decayPeak(p, FLOOR_DB - 20);
  assert.equal(p, FLOOR_DB);
});

test("one loud spike does not certify a rung the voice never held", () => {
  // A door, a cough, a chair. Without this the ladder can be passed by accident.
  const withSpike = [-40, -38, -39, -6, -41, -40];
  assert.ok(sustainedPeak(withSpike) < -30, "a single spike set the level");
});

test("a genuinely held level is reported as held", () => {
  assert.equal(sustainedPeak([-40, -12, -11, -13, -12, -41]), -12);
});
