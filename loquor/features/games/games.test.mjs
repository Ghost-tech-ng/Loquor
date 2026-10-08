import { test } from "node:test";
import assert from "node:assert/strict";

import { yin, semitones, PitchTracker, decimate, monoFloat } from "./pitch.ts";
import { melody, punch, rhythm, liveliness, labelFor, contrast, emphasis } from "./prosody.ts";
import { startGate, tick, GATE, gatePoints } from "./pauseGate.ts";
import { forms, findUse, editDistance } from "./wordMatch.ts";
import { makeQuestion, deck, answerPoints, multiplier, recognitionGrade, rng } from "./blitz.ts";
import { judgeRound, focusSpan, slips, totalSurvived, ROUNDS_S, HEARTS } from "./gauntlet.ts";
import { gameXp } from "../progression/xp.ts";

const RATE = 48000;

function tone(hz, seconds, rate = RATE, amp = 0.3) {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

// A voice-like tone: a weak fundamental under stronger harmonics, the case that
// trips plain autocorrelation into octave errors.
function voiced(hz, seconds, rate = RATE) {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) {
    const ph = (2 * Math.PI * hz * i) / rate;
    out[i] = 0.08 * Math.sin(ph) + 0.15 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph) + 0.05 * Math.sin(4 * ph);
  }
  return out;
}

function chirp(from, to, seconds, rate = RATE) {
  const out = new Float32Array(Math.round(seconds * rate));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const hz = from + ((to - from) * i) / out.length;
    phase += (2 * Math.PI * hz) / rate;
    out[i] = 0.3 * Math.sin(phase);
  }
  return out;
}

const within1st = (got, want) => Math.abs(semitones(got) - semitones(want)) <= 1;

// --- pitch -----------------------------------------------------------------

test("yin finds pure tones across the voice range within a semitone", () => {
  for (const hz of [85, 120, 180, 220, 300, 420]) {
    const frame = decimate(tone(hz, 0.05), 4);
    const p = yin(frame, RATE / 4);
    assert.ok(p, `no pitch at ${hz}`);
    assert.ok(within1st(p.hz, hz), `${hz} Hz read as ${p.hz.toFixed(1)}`);
    assert.ok(p.clarity > 0.85);
  }
});

test("yin does not jump an octave on a harmonic-heavy voice", () => {
  for (const hz of [100, 150, 210]) {
    const p = yin(decimate(voiced(hz, 0.05), 4), RATE / 4);
    assert.ok(p, `no pitch at ${hz}`);
    assert.ok(within1st(p.hz, hz), `${hz} Hz read as ${p.hz.toFixed(1)}`);
  }
});

test("yin returns null for silence and noise", () => {
  assert.equal(yin(new Float32Array(600), 12000), null);
  const r = rng(7);
  const noise = Float32Array.from({ length: 600 }, () => (r() - 0.5) * 0.4);
  assert.equal(yin(noise, 12000), null);
});

test("PitchTracker follows a chirp across odd-sized buffers", () => {
  const audio = chirp(110, 220, 1.0);
  const tracker = new PitchTracker();
  for (let i = 0; i < audio.length; i += 4410) tracker.push(audio.subarray(i, i + 4410), RATE);
  assert.ok(tracker.frames >= 20);
  assert.ok(tracker.points.length >= 18);
  for (const p of tracker.points) {
    const want = 110 + 110 * p.t;
    assert.ok(within1st(p.hz, want), `t=${p.t.toFixed(2)} want ${want.toFixed(0)} got ${p.hz.toFixed(0)}`);
  }
  // Time stamps must rise monotonically across buffer boundaries.
  for (let i = 1; i < tracker.points.length; i++) assert.ok(tracker.points[i].t > tracker.points[i - 1].t);
});

test("monoFloat mixes interleaved stereo down", () => {
  const stereo = new Float32Array([1, 0, 0.5, 0.5, -1, 1]);
  assert.deepEqual(Array.from(monoFloat(stereo.buffer, 2)), [0.5, 0.5, 0]);
  assert.equal(monoFloat(stereo.buffer, 1).length, 6);
});

// --- prosody ---------------------------------------------------------------

const flatLine = Array.from({ length: 60 }, (_, i) => ({ t: i * 0.04, hz: 140 + (i % 2), clarity: 0.95 }));
const liveLine = Array.from({ length: 60 }, (_, i) => ({
  t: i * 0.04,
  hz: 140 * 2 ** ((4 * Math.sin(i / 6)) / 12),
  clarity: 0.95,
}));

test("melody tells a monotone from a lively contour", () => {
  const flat = melody(flatLine);
  const live = melody(liveLine);
  assert.ok(flat && live);
  assert.ok(flat.rangeSt < 1);
  assert.ok(live.rangeSt > 6);
  assert.ok(flat.score < 10);
  assert.ok(live.score > 70);
  assert.equal(melody(flatLine.slice(0, 10)), null);
});

test("punch reads loudness spread only while talking", () => {
  const flat = Array.from({ length: 60 }, (_, i) => (i % 10 < 2 ? -60 : -22 + (i % 2)));
  const dynamic = Array.from({ length: 60 }, (_, i) => (i % 10 < 2 ? -60 : -30 + (i % 5) * 4));
  const a = punch(flat);
  const b = punch(dynamic);
  assert.ok(a && b);
  assert.ok(a.score < 15, `flat scored ${a.score}`);
  assert.ok(b.score > 60, `dynamic scored ${b.score}`);
  assert.equal(punch([-30, -31]), null);
});

function wordsFrom(durations, gaps) {
  const out = [];
  let t = 0;
  durations.forEach((d, i) => {
    out.push({ word: "word", start: t, end: t + d });
    t += d + (gaps[i] ?? 0.05);
  });
  return out;
}

test("rhythm scores a metronome low and uneven speech high", () => {
  const metronome = rhythm(wordsFrom(Array(12).fill(0.3), Array(12).fill(0.05)));
  const talking = rhythm(
    wordsFrom([0.2, 0.5, 0.15, 0.35, 0.6, 0.18, 0.25, 0.7, 0.16, 0.3, 0.45, 0.2], [0, 0, 0.6, 0, 0, 0.02, 0.9, 0, 0, 0.4, 0, 0])
  );
  assert.ok(metronome && talking);
  assert.ok(metronome.score < 10, `metronome ${metronome.score}`);
  assert.ok(talking.score > 60, `talking ${talking.score}`);
  assert.equal(rhythm(wordsFrom([0.3, 0.3], [])), null);
});

test("liveliness renormalises over the parts it has", () => {
  assert.equal(liveliness({}), null);
  const onlyMelody = liveliness({ points: liveLine });
  assert.equal(onlyMelody.score, onlyMelody.melody.score);
  assert.equal(onlyMelody.punch, null);
  const robot = liveliness({ points: flatLine, words: wordsFrom(Array(12).fill(0.3), Array(12).fill(0.05)) });
  assert.equal(robot.label, "Robot");
});

test("labels step at 35, 55 and 75", () => {
  assert.deepEqual([0, 34, 35, 54, 55, 74, 75, 100].map(labelFor), [
    "Robot", "Robot", "Reading", "Reading", "Talking", "Talking", "Alive", "Alive",
  ]);
});

test("contrast is zero for identical deliveries and high for different ones", () => {
  const a = liveliness({ points: flatLine });
  const b = liveliness({ points: liveLine });
  assert.equal(contrast([a, a, a]), 0);
  assert.ok(contrast([a, b]) > 50);
  assert.equal(contrast([a]), 0);
});

test("emphasis notices a stretched, louder word", () => {
  const words = wordsFrom([0.2, 0.2, 0.2, 0.55, 0.2, 0.2], Array(6).fill(0.05));
  const levels = Array.from({ length: 30 }, (_, i) => (i >= 7 && i <= 13 ? -14 : -24));
  const hit = emphasis({ words, target: 3, levelsDb: levels });
  assert.ok(hit.longer && hit.louder && hit.hit);
  const miss = emphasis({ words, target: 1, levelsDb: levels });
  assert.equal(miss.hit, false);
});

// --- pause gate ------------------------------------------------------------

// Drives the machine at 10 Hz with a script deciding the level at each tick.
function run(seed, levelAt, untilMs) {
  let s = startGate(seed);
  for (let t = 0; t <= untilMs; t += 100) s = tick(s, t, levelAt(t, s));
  return s;
}

const LOUD = -20;
const QUIET = -55;
const calib = (t) => (t % 500 < 100 ? QUIET : LOUD);

test("calibration places the quiet line between room and voice", () => {
  const s = run(1, calib, GATE.calibrateMs);
  assert.equal(s.phase, "talk");
  assert.ok(s.quietDb > QUIET && s.quietDb < s.talkDb && s.talkDb < LOUD);
});

test("a speaker who obeys every gate scores clean gates and a combo", () => {
  const obey = (t, s) => {
    if (t < GATE.calibrateMs) return calib(t);
    if (s.phase === "gate" || s.phase === "hold") return QUIET;
    return LOUD;
  };
  const s = run(42, obey, GATE.calibrateMs + GATE.lengthMs + 5000);
  assert.equal(s.phase, "done");
  assert.ok(s.gates >= 6, `only ${s.gates} gates`);
  assert.equal(s.clean, s.gates);
  assert.equal(s.bestCombo, s.gates);
  assert.ok(s.events.every((e) => e.outcome === "clean"));
  assert.equal(s.events[0].points, gatePoints(1));
});

test("talking straight through a gate breaks the combo", () => {
  const s = run(42, (t) => (t < GATE.calibrateMs ? calib(t) : LOUD), GATE.calibrateMs + 30_000);
  assert.ok(s.events.length > 0);
  assert.ok(s.events.every((e) => e.outcome === "talked-through" && e.points === 0));
  assert.equal(s.clean, 0);
});

test("going silent while meant to talk is dead air and does not count as a gate", () => {
  const s = run(3, (t) => (t < GATE.calibrateMs ? calib(t) : QUIET), GATE.calibrateMs + GATE.deadAirMs + 200);
  assert.equal(s.events[0].outcome, "dead-air");
  assert.equal(s.gates, 0);
});

test("never resuming after the hold is a stall", () => {
  let gated = false;
  const s = run(
    9,
    (t, st) => {
      if (t < GATE.calibrateMs) return calib(t);
      if (st.phase === "gate") gated = true;
      return gated ? QUIET : LOUD;
    },
    GATE.calibrateMs + GATE.gapMax + GATE.holdMax + GATE.resumeMs + 1000
  );
  assert.equal(s.events[0].outcome, "stalled");
});

test("gate points grow with the combo and cap", () => {
  assert.equal(gatePoints(1), 100);
  assert.equal(gatePoints(3), 150);
  assert.equal(gatePoints(9), 300);
  assert.equal(gatePoints(50), 300);
});

// --- word match ------------------------------------------------------------

test("forms covers inflections and derivations", () => {
  const has = (w, f) => assert.ok(forms(w).has(f), `${w} → ${f}`);
  has("mitigate", "mitigated");
  has("mitigate", "mitigating");
  has("mitigate", "mitigation");
  has("contingent", "contingency");
  has("leverage", "leveraging");
  has("commit", "committed");
  has("tractable", "tractability");
  has("specify", "specified");
  has("pragmatic", "pragmatically");
});

test("findUse accepts real uses and transcriber slips, and nothing looser", () => {
  assert.equal(findUse("It's contingent on funding.", "contingent"), "contingent");
  assert.equal(findUse("We mitigated the risk early", "mitigate"), "mitigated");
  assert.equal(findUse("that problem is trac table now", "tractable"), "trac table");
  assert.equal(findUse("the tractible part is the API", "tractable"), "tractible");
  assert.equal(findUse("I had a contingency plan", "contingent"), "contingency");
  assert.equal(findUse("we should just move on", "contingent"), null);
  assert.equal(findUse("it is a cat", "cut"), null);
  assert.equal(findUse("", "anything"), null);
});

test("editDistance", () => {
  assert.equal(editDistance("kitten", "sitting"), 3);
  assert.equal(editDistance("same", "same"), 0);
  assert.equal(editDistance("", "abc"), 3);
});

// --- blitz -----------------------------------------------------------------

const GLOSS = Array.from({ length: 30 }, (_, i) => ({ word: `w${i}`, meaning: `meaning ${i}` }));

test("blitz questions carry the answer and three distinct neighbours", () => {
  const q = makeQuestion("w15", GLOSS, rng(1));
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes("w15"));
  assert.equal(new Set(q.options).size, 4);
  assert.equal(q.meaning, "meaning 15");
  for (const o of q.options) assert.ok(Math.abs(Number(o.slice(1)) - 15) <= 8);
  assert.equal(makeQuestion("nope", GLOSS, rng(1)), null);
});

test("blitz deck puts due words first and covers everything once", () => {
  const all = GLOSS.map((g) => g.word);
  const d = deck(["w3", "w9", "missing"], all, rng(2));
  assert.deepEqual(new Set(d.slice(0, 2)), new Set(["w3", "w9"]));
  assert.equal(d.length, all.length);
  assert.equal(new Set(d).size, all.length);
});

test("blitz scoring rewards speed and streaks", () => {
  assert.equal(answerPoints(false, 500, 5), 0);
  assert.equal(answerPoints(true, 1000, 1), 160);
  assert.equal(answerPoints(true, 9000, 1), 100);
  assert.equal(answerPoints(true, 5000, 1), 130);
  assert.equal(multiplier(3), 1.5);
  assert.equal(multiplier(100), 3);
  assert.equal(answerPoints(true, 1000, 30), 480);
});

test("recognition grades follow answer time", () => {
  assert.equal(recognitionGrade(false, 100), 1);
  assert.equal(recognitionGrade(true, 7000), 2);
  assert.equal(recognitionGrade(true, 4000), 3);
  assert.equal(recognitionGrade(true, 1500), 4);
});

// --- gauntlet --------------------------------------------------------------

function metrics(durationS, fillerAt = [], deadAir = []) {
  return {
    durationS,
    wordCount: 0, fillerCount: fillerAt.length, fillerRate: 0, wpm: 0,
    hedgeCount: 0, hedgeDensity: 0, deadAirCount: deadAir.length, deadAirTotalS: 0, longestGapS: 0,
    fillerMarks: fillerAt.map((s) => s / durationS),
    deadAirSpans: deadAir.map(([a, b]) => [a / durationS, b / durationS]),
  };
}

test("a clean round is cleared with every heart", () => {
  const r = judgeRound(0, HEARTS, metrics(20.5));
  assert.equal(r.cleared, true);
  assert.equal(r.heartsLeft, 3);
  assert.equal(r.survived, ROUNDS_S[0]);
  assert.ok(Math.abs(r.focus - 20.5) < 1e-9);
});

test("fillers and dead air each cost a heart, and the last one ends the run", () => {
  const r = judgeRound(1, 2, metrics(30, [5], [[12, 15.5]]));
  assert.equal(r.heartsLeft, 0);
  assert.equal(r.cleared, false);
  assert.ok(Math.abs(r.survived - 12) < 1e-9);
  assert.deepEqual(r.slips.map((s) => s.kind), ["filler", "dead-air"]);
});

test("stopping short of the round is not a clear", () => {
  const r = judgeRound(2, 3, metrics(30));
  assert.equal(r.cleared, false);
  assert.equal(r.survived, 30);
});

test("focus span is the longest stretch between slips", () => {
  const m = metrics(60, [10, 50], [[20, 24]]);
  assert.ok(Math.abs(focusSpan(m) - 26) < 1e-9);
  assert.equal(slips(m).length, 3);
  assert.equal(totalSurvived([{ survived: 20 }, { survived: 29.6 }]), 50);
});

// --- game xp ---------------------------------------------------------------

test("game xp is capped per game", () => {
  assert.equal(gameXp("gauntlet", 320), 80);
  assert.equal(gameXp("gauntlet", 1000), 80);
  assert.equal(gameXp("bomb", 3), 45);
  assert.equal(gameXp("bomb", 5), 75);
  assert.equal(gameXp("blitz", 0), 0);
  assert.ok(gameXp("blitz", 100_000) <= 80);
  assert.equal(gameXp("alive", 100), 70);
  assert.equal(gameXp("pause", -5), 0);
});
