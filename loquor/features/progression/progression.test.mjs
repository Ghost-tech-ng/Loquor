import { test } from "node:test";
import assert from "node:assert/strict";
import { XP, takeXp, totalXp } from "./xp.ts";
import { xpForLevel, levelOf, rankOf } from "./levels.ts";
import { streakOf, FREEZE_MAX } from "./streak.ts";
import { pickQuests, questStates, QUESTS_BY_ID } from "./quests.ts";
import { BADGES, newlyEarned } from "./badges.ts";

test("takeXp pays the full clean bonus at 2/min and none at 8/min", () => {
  assert.equal(takeXp(0, false), XP.take + XP.takeCleanMax);
  assert.equal(takeXp(2, false), XP.take + XP.takeCleanMax);
  assert.equal(takeXp(5, false), XP.take + 15);
  assert.equal(takeXp(8, false), XP.take);
  assert.equal(takeXp(20, false), XP.take);
});

test("a rewrite earns the flat rewrite amount", () => {
  assert.equal(takeXp(0, true), XP.rewrite);
});

test("totalXp sums every source", () => {
  const xp = totalXp({
    sessions: [
      { filler_rate: 2, is_rewrite: 0 },
      { filler_rate: 9, is_rewrite: 1 },
    ],
    takes: 2,
    lexiconReps: 4,
    drills: 1,
    debriefs: 1,
    valveRuns: 1,
    gameXp: 33,
    questXp: 50,
    badges: 2,
  });
  const expected =
    80 + XP.rewrite + 2 * XP.reading + 4 * XP.lexiconRep + XP.drill + XP.debrief + XP.valve + 33 + 50 + 2 * XP.badge;
  assert.equal(xp, expected);
});

test("level curve starts free and grows", () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 100);
  assert.equal(xpForLevel(3), 240);
  for (let n = 2; n < 40; n++) {
    assert.ok(xpForLevel(n + 1) - xpForLevel(n) > xpForLevel(n) - xpForLevel(n - 1));
  }
});

test("levelOf lands on exact boundaries", () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(99).level, 1);
  assert.equal(levelOf(100).level, 2);
  assert.equal(levelOf(100).into, 0);
  assert.equal(levelOf(239).level, 2);
  assert.equal(levelOf(240).level, 3);
  const mid = levelOf(170);
  assert.equal(mid.span, 140);
  assert.equal(mid.into, 70);
  assert.equal(mid.progress, 0.5);
});

test("ranks change at their thresholds", () => {
  assert.equal(rankOf(1), "Mumbler");
  assert.equal(rankOf(2), "Mumbler");
  assert.equal(rankOf(3), "Murmurer");
  assert.equal(rankOf(10), "Speaker");
  assert.equal(rankOf(99), "Legend");
});

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("no activity is no streak", () => {
  assert.deepEqual(streakOf([], 100), { current: 0, best: 0, freezes: 0, activeToday: false, frozen: [] });
});

test("today not yet practised does not break the streak", () => {
  const s = streakOf(range(95, 99), 100);
  assert.equal(s.current, 5);
  assert.equal(s.activeToday, false);
});

test("a missed day without a freeze resets", () => {
  const s = streakOf([...range(90, 94), ...range(96, 100)], 100);
  assert.equal(s.current, 5);
  assert.equal(s.best, 5);
  assert.deepEqual(s.frozen, []);
});

test("a 7-day run banks a freeze that a missed day spends", () => {
  const s = streakOf([...range(80, 86), ...range(88, 100)], 100);
  assert.deepEqual(s.frozen, [87]);
  assert.equal(s.current, 20);
  assert.equal(s.best, 20);
});

test("freezes cap and two misses in a row need two freezes", () => {
  const long = streakOf(range(1, 40), 40);
  assert.equal(long.freezes, FREEZE_MAX);

  const s = streakOf([...range(1, 14), ...range(17, 20)], 20);
  assert.deepEqual(s.frozen, [15, 16]);
  assert.equal(s.current, 18);
  assert.equal(s.freezes, 0);
});

const ctx = { lexDue: 0, lastFiller: null, gamesAvailable: false, debriefsPending: false };

test("the same day always draws the same quests", () => {
  assert.deepEqual(pickQuests(20000, ctx), pickQuests(20000, ctx));
});

test("quests come three a day from different families", () => {
  for (let day = 19000; day < 19060; day++) {
    const ids = pickQuests(day, ctx);
    assert.equal(ids.length, 3);
    const families = ids.map((id) => QUESTS_BY_ID.get(id).family);
    assert.equal(new Set(families).size, 3);
  }
});

test("the first quest targets the weak spot", () => {
  assert.equal(pickQuests(1, { ...ctx, lexDue: 30 })[0], "lex-10");
  assert.equal(pickQuests(1, { ...ctx, lastFiller: 7 })[0], "clean-5");
  assert.equal(pickQuests(1, { ...ctx, debriefsPending: true })[0], "debrief-1");
  assert.equal(pickQuests(1, ctx)[0], "arena-1");
});

test("quests behind unavailable features are never offered", () => {
  for (let day = 0; day < 200; day++) {
    for (const id of pickQuests(day, ctx)) {
      assert.notEqual(QUESTS_BY_ID.get(id).needs, "games", id);
      assert.notEqual(id, "debrief-1");
    }
  }
});

const noGames = {
  gameRuns: 0,
  blitzCorrect: 0,
  bombBest: 0,
  pauseClean: 0,
  gauntletCleared: 0,
  focusBest: 0,
  aliveBest: 0,
};

test("game quests read the day's bests", () => {
  const facts = {
    arenaTakes: 0,
    bestFiller: null,
    readings: 0,
    lexiconReviews: 0,
    drills: 0,
    valveRuns: 0,
    debriefs: 0,
    ...noGames,
    gameRuns: 2,
    blitzCorrect: 12,
    gauntletCleared: 2,
    focusBest: 50,
    aliveBest: 64,
  };
  const states = questStates(["blitz-10", "gauntlet-3", "focus-45", "alive-70"], facts, new Set());
  assert.deepEqual(
    states.map((s) => [s.quest.id, s.value, s.done]),
    [
      ["blitz-10", 10, true],
      ["gauntlet-3", 2, false],
      ["focus-45", 45, true],
      ["alive-70", 0, false],
    ]
  );
});

test("game quests appear once games are live, never two from one family", () => {
  const live = { ...ctx, gamesAvailable: true };
  let seen = 0;
  for (let day = 0; day < 200; day++) {
    const picked = pickQuests(day, live).map((id) => QUESTS_BY_ID.get(id));
    seen += picked.filter((q) => q.needs === "games").length;
    assert.equal(new Set(picked.map((q) => q.family)).size, picked.length);
  }
  assert.ok(seen > 50);
});

test("questStates caps progress at the goal and marks done", () => {
  const facts = {
    arenaTakes: 3,
    bestFiller: 4.2,
    readings: 0,
    lexiconReviews: 6,
    drills: 0,
    valveRuns: 0,
    debriefs: 0,
    ...noGames,
  };
  const states = questStates(["arena-2", "clean-3", "lex-10", "gone"], facts, new Set(["arena-2"]));
  assert.equal(states.length, 3);
  assert.deepEqual(
    states.map((s) => [s.quest.id, s.value, s.done, s.claimed]),
    [
      ["arena-2", 2, true, true],
      ["clean-3", 0, false, false],
      ["lex-10", 6, false, false],
    ]
  );
});

const blank = {
  arenaTakes: 0,
  bestFiller: null,
  readings: 0,
  wordsOwned: 0,
  drills: 0,
  debriefs: 0,
  valveRuns: 0,
  valveClean: 0,
  rubricBest: null,
  streakBest: 0,
  level: 1,
  ...noGames,
};

test("game badges unlock at their lines", () => {
  const ids = (f) => newlyEarned({ ...blank, ...f }, new Set()).map((b) => b.id);
  assert.deepEqual(ids({ gameRuns: 1 }), ["player-one"]);
  assert.ok(ids({ gameRuns: 1, bombBest: 5 }).includes("bomb-squad"));
  assert.ok(!ids({ gameRuns: 1, bombBest: 4 }).includes("bomb-squad"));
  assert.ok(ids({ gameRuns: 1, gauntletCleared: 6 }).includes("iron-focus"));
  assert.ok(ids({ gameRuns: 1, aliveBest: 90 }).includes("human"));
  assert.ok(!ids({ gameRuns: 1, aliveBest: 89 }).includes("human"));
  assert.ok(ids({ gameRuns: 1, blitzCorrect: 20, pauseClean: 10 }).includes("golden-silence"));
});

test("a new user has no badges", () => {
  assert.deepEqual(newlyEarned(blank, new Set()), []);
});

test("badges unlock at their lines and are not re-awarded", () => {
  const facts = { ...blank, arenaTakes: 10, bestFiller: 0, streakBest: 7 };
  const ids = newlyEarned(facts, new Set()).map((b) => b.id);
  for (const id of ["first-words", "regular", "smooth", "clean-minute", "warming-up", "on-fire"]) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(!ids.includes("veteran"));
  assert.deepEqual(newlyEarned(facts, new Set(ids)), []);
});

test("badge ids are unique", () => {
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});
