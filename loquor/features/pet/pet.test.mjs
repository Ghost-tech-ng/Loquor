import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STAGES,
  backLine,
  evolveLine,
  moodOf,
  nextSpot,
  nextStageOf,
  petLine,
  restMs,
  spokenText,
  stageOf,
  voiceOf,
} from "./pet.ts";

/** Deterministic rng for repeatable sweeps. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const BOUNDS = { width: 390, top: 50, ground: 750 };
const byName = (n) => STAGES.find((s) => s.name === n);

test("stageOf follows level and never goes backwards", () => {
  assert.equal(stageOf(1).name, "egg");
  assert.equal(stageOf(2).name, "egg");
  assert.equal(stageOf(3).name, "chick");
  assert.equal(stageOf(6).name, "fledgling");
  assert.equal(stageOf(10).name, "parrot");
  assert.equal(stageOf(21).name, "macaw");
  assert.equal(stageOf(400).name, "macaw");
  let prev = 0;
  for (let l = 1; l < 60; l++) {
    const size = stageOf(l).size;
    assert.ok(size >= prev);
    prev = size;
  }
});

test("nextStageOf points at the next hatch or growth, and stops at the top", () => {
  assert.deepEqual(
    { name: nextStageOf(1).stage.name, at: nextStageOf(1).atLevel },
    { name: "chick", at: 3 }
  );
  assert.equal(nextStageOf(9).stage.name, "parrot");
  assert.equal(nextStageOf(21), null);
});

test("moodOf: happy today, sleepy after a lost streak, idle otherwise", () => {
  assert.equal(moodOf({ current: 4, best: 4, activeToday: true }), "happy");
  assert.equal(moodOf({ current: 0, best: 6, activeToday: false }), "sleepy");
  assert.equal(moodOf({ current: 3, best: 6, activeToday: false }), "idle");
  assert.equal(moodOf({ current: 0, best: 0, activeToday: false }), "idle");
});

test("nextSpot keeps Pip on screen, and non-fliers on the ground", () => {
  for (const stage of STAGES) {
    for (const mood of ["happy", "idle", "sleepy"]) {
      const rng = seeded(stage.size * 7 + mood.length);
      let from = { x: 100, y: BOUNDS.ground - stage.size };
      for (let i = 0; i < 300; i++) {
        const s = nextSpot(rng, BOUNDS, from, stage, mood);
        assert.ok(s.x >= -stage.size * 0.2 && s.x <= BOUNDS.width - stage.size * 0.8, `x ${s.x}`);
        assert.ok(s.y >= BOUNDS.top && s.y <= BOUNDS.ground - stage.size, `y ${s.y}`);
        if (!stage.flies || mood === "sleepy") assert.equal(s.perch, "ground");
        if (s.perch === "ground") assert.equal(s.y, BOUNDS.ground - stage.size);
        from = s;
      }
    }
  }
});

test("nextSpot: the egg only rolls a little, and every move actually moves", () => {
  const egg = byName("egg");
  const rng = seeded(3);
  let from = { x: 180, y: BOUNDS.ground - egg.size };
  for (let i = 0; i < 300; i++) {
    const s = nextSpot(rng, BOUNDS, from, egg, "idle");
    const d = Math.abs(s.x - from.x);
    assert.ok(d <= 50 + 1e-9, `rolled ${d}`);
    assert.ok(d >= 1, "stood still");
    from = s;
  }
});

test("nextSpot: fliers do use the side perches", () => {
  const parrot = byName("parrot");
  const rng = seeded(11);
  const perches = new Set();
  for (let i = 0; i < 200; i++) {
    perches.add(nextSpot(rng, BOUNDS, { x: 100, y: 600 }, parrot, "happy").perch);
  }
  assert.deepEqual([...perches].sort(), ["ground", "left", "right"]);
});

test("nextSpot falls back to the ground on a screen too short for a side perch", () => {
  const rng = seeded(5);
  const short = { width: 390, top: 50, ground: 300 };
  for (let i = 0; i < 100; i++) {
    assert.equal(nextSpot(rng, short, { x: 50, y: 0 }, byName("macaw"), "happy").perch, "ground");
  }
});

test("restMs: sleepy rests longest", () => {
  const rng = seeded(9);
  for (let i = 0; i < 50; i++) {
    assert.ok(restMs(rng, "sleepy") >= 15000);
    assert.ok(restMs(rng, "happy") <= 7000);
  }
});

test("lines are never empty, and the egg talks about hatching", () => {
  const rng = seeded(2);
  for (const stage of STAGES) {
    for (const mood of ["happy", "idle", "sleepy"]) {
      for (let i = 0; i < 20; i++) {
        assert.ok(petLine(rng, stage, mood, 5, stage.minLevel).length > 0);
      }
    }
    assert.ok(backLine(rng, stage).length > 0);
  }
  assert.match(evolveLine(byName("chick")), /hatched/);
  assert.match(evolveLine(byName("macaw")), /Macaw/);
});

test("spokenText reads the bubble the way Pip would say it", () => {
  assert.equal(spokenText("*tap tap* …still in here."), "tap tap, still in here.");
  assert.equal(spokenText("*wobble* +12 XP"), "wobble plus 12 X P");
  assert.equal(spokenText("+40 XP! Squawk!"), "plus 40 X P! Squawk!");
  assert.equal(spokenText("Zzz… oh! You're back."), "Zzz, oh! You're back.");
  assert.equal(spokenText("Level 7! Squawk!"), "Level 7! Squawk!");
});

test("voiceOf: every stage has a voice in iOS range, and it deepens as Pip grows", () => {
  let prev = Infinity;
  for (const stage of STAGES) {
    const v = voiceOf(stage);
    assert.ok(v.pitch >= 0.5 && v.pitch <= 2, `${stage.name} pitch ${v.pitch}`);
    assert.ok(v.rate > 0);
    assert.ok(v.pitch <= prev, `${stage.name} is higher than the stage before`);
    prev = v.pitch;
  }
});
