// node --experimental-strip-types --test lib/reading.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { scoreReading, tokenizeReference, targetVerdicts } from "./reading.ts";
import {
  READINGS,
  READ_WPM,
  readingMinutes,
  readingWordCount,
  targetIndices,
  wordCount,
} from "../content/readings.ts";
import { gloss } from "../content/glossary.ts";

/** Every section of every reading, flattened, with its reading for error messages. */
const SECTIONS = READINGS.flatMap((r) => r.sections.map((sec) => ({ r, sec })));

/** Builds word timings at a fixed cadence so pace assertions are exact. */
function speak(text, { wordS = 0.4, gaps = {} } = {}) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let t = 0;
  for (let i = 0; i < words.length; i++) {
    out.push({ word: words[i], start: t, end: t + wordS });
    t += wordS + (gaps[i] ?? 0);
  }
  return out;
}

test("tokenizer splits hyphens and marks phrasing breaks", () => {
  const { tokens, breakAfter } = tokenizeReference("It is load-bearing, truly.");
  assert.deepEqual(tokens, ["it", "is", "load", "bearing", "truly"]);
  assert.equal(breakAfter[3], true); // the comma after "load-bearing"
  assert.equal(breakAfter[4], true); // the full stop
  assert.equal(breakAfter[0], false);
});

test("a perfect read scores 100 and finds no stumbles", () => {
  const text = "The salient risk is the boring one.";
  const s = scoreReading(text, speak("the salient risk is the boring one"));
  assert.equal(s.accuracy, 100);
  assert.equal(s.stumbles.length, 0);
  assert.equal(s.insertions, 0);
});

test("a substituted word is reported with what was heard instead", () => {
  const text = "The epitome of the problem.";
  const s = scoreReading(text, speak("the epitomy of the problem"));
  assert.equal(s.stumbles.length, 1);
  assert.equal(s.stumbles[0].ref, "epitome");
  assert.equal(s.stumbles[0].status, "altered");
  assert.equal(s.stumbles[0].heard, "epitomy");
});

test("a skipped word is missed, not altered", () => {
  const text = "Storage is a commodity here.";
  const s = scoreReading(text, speak("storage is a here"));
  const missed = s.stumbles.filter((t) => t.status === "missed");
  assert.equal(missed.length, 1);
  assert.equal(missed[0].ref, "commodity");
  assert.equal(missed[0].heard, undefined);
});

test("extra words count as insertions without damaging accuracy", () => {
  const text = "We do not have consensus.";
  const s = scoreReading(text, speak("we do not sorry we do not have consensus"));
  assert.equal(s.insertions, 4);
  assert.equal(s.accuracy, 100);
});

test("pauses at punctuation are credited, pauses elsewhere are hesitation", () => {
  const text = "First, second third.";
  // Breathe after the comma (index 0), stall in the middle of the clause.
  const good = scoreReading(text, speak("first second third", { gaps: { 0: 0.5 } }));
  assert.deepEqual(good.phrasing, { honoured: 1, available: 2 });
  assert.equal(good.hesitations, 0);

  const bad = scoreReading(text, speak("first second third", { gaps: { 1: 1.2 } }));
  assert.equal(bad.phrasing.honoured, 0);
  assert.equal(bad.hesitations, 1);
  assert.equal(bad.longestGapS, 1.2);
});

test("pace is words per minute over the spoken span", () => {
  // Ten words, 0.4s each, no gaps → 4s → 150 wpm.
  const text = "one two three four five six seven eight nine ten";
  const s = scoreReading(text, speak(text));
  assert.equal(s.wpm, 150);
});

test("silence scores zero and reports every word as missed", () => {
  const s = scoreReading("Say something aloud.", [], { fallbackDurationS: 6 });
  assert.equal(s.accuracy, 0);
  assert.equal(s.wpm, 0);
  assert.equal(s.durationS, 6);
  assert.equal(s.stumbles.length, 3);
});

test("target accuracy is separate from overall accuracy", () => {
  const { sec } = SECTIONS[0];
  const targets = targetIndices(sec);
  const { tokens } = tokenizeReference(sec.text);

  // Read it perfectly except for one non-target word.
  const spoken = tokens.slice();
  const plainIndex = tokens.findIndex((_, i) => !targets.has(i));
  spoken[plainIndex] = "zzz";

  const s = scoreReading(sec.text, speak(spoken.join(" ")), { targets });
  assert.ok(s.accuracy < 100);
  assert.equal(s.targetAccuracy, 100);
});

test("a multi-token target only passes when every token of it is clean", () => {
  const { sec } = SECTIONS.find(({ sec }) => sec.targets.includes("second-order"));
  const targets = targetIndices(sec);
  const { tokens } = tokenizeReference(sec.text);

  const orderIndex = [...targets.entries()].find(
    ([i, w]) => w === "second-order" && tokens[i] === "order",
  )[0];
  const spoken = tokens.slice();
  spoken[orderIndex] = "odour";

  const s = scoreReading(sec.text, speak(spoken.join(" ")), { targets });
  const v = targetVerdicts(s).find((x) => x.word === "second-order");
  assert.equal(v.clean, false);
  assert.deepEqual(v.heard, ["odour"]);
});

// ── the corpus itself ─────────────────────────────────────────────────────────
// These are content tests, not code tests. They exist because the failure mode
// of authored material is silent: a target word that never appears in the prose,
// or a section that quietly drifts to 400 words, breaks the drill without
// breaking anything that would throw.

test("every target in every section is actually located in its text", () => {
  for (const { r, sec } of SECTIONS) {
    const found = new Set(targetIndices(sec).values());
    for (const word of sec.targets) {
      assert.ok(found.has(word), `${r.id}s${sec.n}: "${word}" not found in the section text`);
    }
  }
});

test("every target word has a glossary entry", () => {
  for (const { r, sec } of SECTIONS) {
    for (const word of sec.targets) {
      assert.ok(gloss(word), `${r.id}s${sec.n}: "${word}" has no glossary entry`);
    }
  }
});

test("no section repeats a target word", () => {
  for (const { r, sec } of SECTIONS) {
    assert.equal(
      new Set(sec.targets).size,
      sec.targets.length,
      `${r.id}s${sec.n} repeats a target`,
    );
  }
});

test("every reading is at least ten minutes aloud", () => {
  for (const r of READINGS) {
    const mins = readingMinutes(r);
    assert.ok(
      mins >= 10,
      `${r.id} is ${readingWordCount(r)} words — ${mins.toFixed(1)} min at ${READ_WPM} wpm`,
    );
  }
});

test("sections are a single sitting: 170-290 words", () => {
  for (const { r, sec } of SECTIONS) {
    const n = wordCount(sec);
    assert.ok(n >= 170 && n <= 290, `${r.id}s${sec.n} is ${n} words`);
  }
});
