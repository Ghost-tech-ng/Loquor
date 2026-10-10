import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_LEVEL,
  chainCorrect,
  chainLevel,
  chainRound,
  firstSlip,
  nbackAccuracy,
  nbackLevel,
  nbackStream,
  nbackTally,
  rng,
  runScore,
  spanLevel,
  spanSequence,
  unlockedLevel,
  workoutOf,
  memorySummary,
} from "./memory.ts";
import { gameXp } from "../progression/xp.ts";

test("the next level unlocks after the best cleared, capped at the top", () => {
  assert.equal(unlockedLevel("span", null), 1);
  assert.equal(unlockedLevel("span", 0), 1);
  assert.equal(unlockedLevel("span", 4), 5);
  assert.equal(unlockedLevel("nback", 10), MAX_LEVEL.nback);
  assert.equal(unlockedLevel("chain", 99), MAX_LEVEL.chain);
});

test("Pip Says grows the sequence and the board with the level", () => {
  assert.equal(spanLevel(1).length, 3);
  assert.equal(spanLevel(1).side, 3);
  assert.equal(spanLevel(6).side, 4);
  assert.equal(spanLevel(12).length, 14);
  assert.ok(spanLevel(12).onMs < spanLevel(1).onMs);
  assert.equal(spanLevel(50).length, spanLevel(12).length);
});

test("Pip Says never lights the same tile twice in a row", () => {
  const r = rng(7);
  for (let l = 1; l <= MAX_LEVEL.span; l++) {
    const lv = spanLevel(l);
    for (let k = 0; k < 50; k++) {
      const seq = spanSequence(lv, r);
      assert.equal(seq.length, lv.length);
      for (let i = 0; i < seq.length; i++) {
        assert.ok(seq[i] >= 0 && seq[i] < lv.side * lv.side);
        if (i > 0) assert.notEqual(seq[i], seq[i - 1]);
      }
    }
  }
});

test("firstSlip finds the first wrong tap", () => {
  assert.equal(firstSlip([1, 2, 3], [1, 2]), -1);
  assert.equal(firstSlip([1, 2, 3], [1, 2, 3]), -1);
  assert.equal(firstSlip([1, 2, 3], [1, 4]), 1);
});

test("Echo steps n up every two levels, faster on the even one", () => {
  assert.deepEqual([1, 2, 3, 4, 9, 10].map((l) => nbackLevel(l).n), [1, 1, 2, 2, 5, 5]);
  assert.ok(nbackLevel(2).stepMs < nbackLevel(1).stepMs);
  assert.equal(nbackLevel(3).length, 22);
});

test("Echo streams hold exactly the planned targets and no accidental ones", () => {
  const r = rng(11);
  for (let l = 1; l <= MAX_LEVEL.nback; l++) {
    const lv = nbackLevel(l);
    for (let k = 0; k < 40; k++) {
      const { letters, isTarget } = nbackStream(lv, r);
      assert.equal(letters.length, lv.length);
      let targets = 0;
      for (let i = 0; i < letters.length; i++) {
        const matches = i >= lv.n && letters[i] === letters[i - lv.n];
        assert.equal(matches, isTarget[i], `level ${l} at ${i}`);
        if (isTarget[i]) targets++;
      }
      assert.equal(targets, lv.targets);
    }
  }
});

test("Echo accuracy takes off a target for every false alarm", () => {
  const isTarget = [false, true, false, true, false, true];
  const all = nbackTally(isTarget, [true, true, true, true, true, true]);
  assert.deepEqual(all, { hits: 3, misses: 0, falseAlarms: 3, targets: 3 });
  assert.equal(nbackAccuracy(all), 0);
  const good = nbackTally(isTarget, [false, true, false, true, false, false]);
  assert.equal(nbackAccuracy(good), 2 / 3);
  assert.equal(nbackAccuracy(nbackTally([false], [false])), 0);
});

test("Word Chain lists are distinct words drawn from the board", () => {
  const r = rng(3);
  for (let l = 1; l <= MAX_LEVEL.chain; l++) {
    const lv = chainLevel(l);
    const { list, board } = chainRound(lv, r);
    assert.equal(list.length, l + 3);
    assert.equal(board.length, lv.board);
    assert.ok(board.length > list.length);
    assert.equal(new Set(board).size, board.length);
    for (const w of list) assert.ok(board.includes(w));
  }
});

test("Word Chain scores only words in the right slot", () => {
  assert.equal(chainCorrect(["a", "b", "c"], ["a", "b", "c"]), 3);
  assert.equal(chainCorrect(["a", "b", "c"], ["b", "a", "c"]), 1);
  assert.equal(chainCorrect(["a", "b", "c"], ["a"]), 1);
});

test("a run saves its level only when cleared, and always pays something", () => {
  assert.equal(runScore(4, true), 4);
  assert.equal(runScore(4, false), 0);
  assert.equal(gameXp("span", 0), 10);
  assert.equal(gameXp("nback", 1), 25);
  assert.equal(gameXp("chain", 10), 70);
  assert.equal(gameXp("span", 12), 70);
});

test("the workout counts each game once", () => {
  assert.deepEqual(workoutOf([]), { done: { span: false, nback: false, chain: false }, count: 0, complete: false });
  const w = workoutOf(["span", "span", "chain", "blitz"]);
  assert.equal(w.count, 2);
  assert.equal(w.complete, false);
  assert.equal(workoutOf(["chain", "nback", "span"]).complete, true);
});

test("the hub summary reads levels, today and the streak from runs", () => {
  const runs = [
    { game: "span", day: 98, score: 3 },
    { game: "nback", day: 98, score: 0 },
    { game: "chain", day: 98, score: 2 },
    { game: "span", day: 99, score: 0 },
    { game: "span", day: 100, score: 4 },
    { game: "chain", day: 100, score: 1 },
    { game: "blitz", day: 100, score: 900 },
  ];
  const m = memorySummary(runs, 100);
  assert.deepEqual(m.best, { span: 4, nback: 0, chain: 2 });
  assert.deepEqual(m.next, { span: 5, nback: 1, chain: 3 });
  assert.equal(m.workout.count, 2);
  assert.equal(m.workout.done.nback, false);
  assert.equal(m.streak.current, 3);
  assert.equal(m.streak.activeToday, true);
  assert.equal(m.fullDays, 1);
  assert.equal(memorySummary([], 5).streak.current, 0);
});
