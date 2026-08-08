// node --experimental-strip-types --test lib/progress.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  dayOf,
  dayStartMs,
  consistency,
  weekStartMs,
  weekKey,
  weekStats,
  LEADING,
  lagging,
  paceBand,
  condense,
  drift,
  median,
  mean,
} from "./progress.ts";

// A Wednesday, mid-afternoon local time.
const NOW = new Date(2026, 6, 15, 14, 30, 0).getTime();
const TODAY = dayOf(NOW);

// ── Days ──────────────────────────────────────────────────────────────────────

test("dayOf is local, not UTC", () => {
  const lateNight = new Date(2026, 6, 15, 23, 40, 0).getTime();
  const earlyMorning = new Date(2026, 6, 15, 0, 20, 0).getTime();
  assert.equal(dayOf(lateNight), dayOf(earlyMorning));
  assert.equal(dayOf(new Date(2026, 6, 16, 0, 20, 0).getTime()), dayOf(lateNight) + 1);
});

test("dayStartMs round-trips through dayOf", () => {
  for (let i = 0; i < 40; i += 1) {
    const d = TODAY - i;
    assert.equal(dayOf(dayStartMs(d)), d);
  }
});

test("dayStartMs is local midnight", () => {
  const d = new Date(dayStartMs(TODAY));
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

// ── Consistency ───────────────────────────────────────────────────────────────

test("an unfinished today does not break a live streak", () => {
  // Practised Monday and Tuesday, nothing yet today.
  const c = consistency([TODAY - 2, TODAY - 1], TODAY);
  assert.equal(c.current, 2);
});

test("a gap of two days ends the streak", () => {
  const c = consistency([TODAY - 4, TODAY - 3], TODAY);
  assert.equal(c.current, 0);
  assert.equal(c.longest, 2);
});

test("duplicates within a day count once", () => {
  const c = consistency([TODAY, TODAY, TODAY, TODAY - 1], TODAY);
  assert.equal(c.current, 2);
  assert.equal(c.active, 2);
});

test("density is over the window, not over the streak", () => {
  // Eighteen of the last twenty-eight days, but yesterday and today missed.
  const days = [];
  for (let i = 2; i < 20; i += 1) days.push(TODAY - i);
  const c = consistency(days, TODAY, 28);
  assert.equal(c.current, 0);
  assert.equal(c.active, 18);
  assert.equal(c.window, 28);
  assert.ok(Math.abs(c.density - 18 / 28) < 1e-9);
});

test("grid is oldest first and ends on today", () => {
  const c = consistency([TODAY, TODAY - 6], TODAY, 7);
  assert.equal(c.grid.length, 7);
  assert.equal(c.grid[0], true); // today - 6
  assert.equal(c.grid[6], true); // today
  assert.equal(c.grid[3], false);
});

test("days outside the window still count toward longest", () => {
  const days = [];
  for (let i = 60; i < 90; i += 1) days.push(TODAY - i);
  const c = consistency(days, TODAY, 28);
  assert.equal(c.active, 0);
  assert.equal(c.longest, 30);
});

test("no history is all zeroes, not NaN", () => {
  const c = consistency([], TODAY);
  assert.equal(c.current, 0);
  assert.equal(c.longest, 0);
  assert.equal(c.density, 0);
});

// ── Weeks ─────────────────────────────────────────────────────────────────────

test("weeks start on Monday", () => {
  const start = new Date(weekStartMs(NOW)); // NOW is a Wednesday
  assert.equal(start.getDay(), 1);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 13);
});

test("Sunday belongs to the week that just ended, not the one starting", () => {
  const sunday = new Date(2026, 6, 19, 20, 0, 0).getTime();
  assert.equal(weekStartMs(sunday), weekStartMs(NOW));
  const monday = new Date(2026, 6, 20, 0, 5, 0).getTime();
  assert.notEqual(weekStartMs(monday), weekStartMs(NOW));
});

test("weekKey is stable across the week and moves once per week", () => {
  const mon = new Date(2026, 6, 13, 9, 0, 0).getTime();
  const sun = new Date(2026, 6, 19, 23, 0, 0).getTime();
  assert.equal(weekKey(mon), weekKey(sun));
  assert.equal(weekKey(new Date(2026, 6, 20, 9, 0, 0).getTime()), weekKey(mon) + 7);
});

// ── Week stats ────────────────────────────────────────────────────────────────

function session(at, fillerRate, wpm = 150, hedgeDensity = 3, rubricTotal = null) {
  return { at, fillerRate, wpm, hedgeDensity, rubricTotal };
}

const EMPTY = {
  sessions: [],
  drills: [],
  takes: [],
  rooms: [],
  wordsProduced: 0,
  activeDays: [],
};

test("an empty week is nulls and zeroes, never zeroes pretending to be measurements", () => {
  const w = weekStats(EMPTY, weekStartMs(NOW));
  assert.equal(w.sessions, 0);
  assert.equal(w.fillerRate, null);
  assert.equal(w.wpm, null);
  assert.equal(w.rubric, null);
  assert.equal(w.drillScore, null);
  assert.equal(w.substantial, false);
});

test("filler rate is a median, so one ruined take cannot define the week", () => {
  const start = weekStartMs(NOW);
  const w = weekStats(
    { ...EMPTY, sessions: [session(NOW, 4), session(NOW, 5), session(NOW, 4.5), session(NOW, 61)] },
    start
  );
  assert.equal(w.fillerRate, 4.75);
  assert.ok(w.fillerRate < 6);
});

test("rubric is a mean over judged sessions only", () => {
  const w = weekStats(
    {
      ...EMPTY,
      sessions: [session(NOW, 4, 150, 3, 12), session(NOW, 4, 150, 3, 16), session(NOW, 4)],
    },
    weekStartMs(NOW)
  );
  assert.equal(w.rubric, 14);
});

test("leading targets follow PRD §8 and are met on equality", () => {
  const w = weekStats(
    {
      ...EMPTY,
      sessions: Array.from({ length: LEADING.sessions }, () => session(NOW, 4)),
      rooms: Array.from({ length: LEADING.rooms }, () => ({
        at: NOW,
        spoke: 1,
        questions: 2,
        positions: 1,
        turned: 0,
      })),
      wordsProduced: LEADING.words,
    },
    weekStartMs(NOW)
  );
  assert.deepEqual(
    w.targets.map((t) => t.met),
    [true, true, true]
  );
  assert.equal(w.questions, 6);
  assert.equal(w.spoke, 3);
  assert.equal(w.turned, 0);
});

test("one short of a target is not met", () => {
  const w = weekStats(
    { ...EMPTY, sessions: Array.from({ length: LEADING.sessions - 1 }, () => session(NOW, 4)) },
    weekStartMs(NOW)
  );
  assert.equal(w.targets.find((t) => t.key === "sessions").met, false);
});

test("daysActive counts only days inside the week", () => {
  const start = weekStartMs(NOW);
  const monday = dayOf(start);
  const w = weekStats(
    { ...EMPTY, activeDays: [monday, monday + 1, monday + 2, monday - 3, monday + 9] },
    start
  );
  assert.equal(w.daysActive, 3);
});

test("drills are counted by kind and scored across kinds", () => {
  const w = weekStats(
    {
      ...EMPTY,
      drills: [
        { at: NOW, kind: "playbook", score: 2 },
        { at: NOW, kind: "playbook", score: 4 },
        { at: NOW, kind: "scaffold", score: 3 },
      ],
    },
    weekStartMs(NOW)
  );
  assert.equal(w.drills.playbook, 2);
  assert.equal(w.drills.scaffold, 1);
  assert.equal(w.drills.roleplay, 0);
  assert.equal(w.drillScore, 3);
});

// ── The ninety-day table ──────────────────────────────────────────────────────

const BASELINE = {
  at: NOW - 60 * 86_400_000,
  fillerRate: 11,
  wpm: 172,
  hedgeDensity: 6,
  deadAirS: 9,
  selfRating: 2,
  provider: "groq",
  wordCount: 220,
};

test("with no baseline every row is unmeasurable rather than zero", () => {
  const rows = lagging(null, {
    fillerRate: 6,
    hedgeDensity: 4,
    productionOwned: 30,
    contribution: 1.5,
    selfRating: 3,
  });
  for (const r of rows) {
    assert.equal(r.baseline, null, r.key);
    assert.equal(r.progress, null, r.key);
  }
});

test("filler rate progresses from the baseline toward an absolute five", () => {
  const rows = lagging(BASELINE, {
    fillerRate: 8,
    hedgeDensity: null,
    productionOwned: 0,
    contribution: null,
    selfRating: null,
  });
  const filler = rows.find((r) => r.key === "filler");
  assert.equal(filler.target, 5);
  // 11 → 8 of the way to 5 is half.
  assert.equal(filler.progress, 0.5);
});

test("the hedge target is half the baseline, not a constant", () => {
  const rows = lagging(BASELINE, {
    fillerRate: null,
    hedgeDensity: 3,
    productionOwned: 0,
    contribution: null,
    selfRating: null,
  });
  const hedge = rows.find((r) => r.key === "hedge");
  assert.equal(hedge.target, 3);
  assert.equal(hedge.progress, 1);
});

test("progress clamps rather than reporting 140% of a goal", () => {
  const rows = lagging(BASELINE, {
    fillerRate: 2,
    hedgeDensity: 0,
    productionOwned: 400,
    contribution: null,
    selfRating: 5,
  });
  for (const r of rows) {
    if (r.progress !== null) assert.ok(r.progress <= 1 && r.progress >= 0, r.key);
  }
});

test("contribution stays unmeasurable even with a baseline — you cannot double zero rooms", () => {
  const rows = lagging(BASELINE, {
    fillerRate: null,
    hedgeDensity: null,
    productionOwned: 0,
    contribution: 2.4,
    selfRating: null,
  });
  const c = rows.find((r) => r.key === "contribution");
  assert.equal(c.now, 2.4);
  assert.equal(c.baseline, null);
  assert.equal(c.progress, null);
});

test("production vocabulary starts from zero by definition", () => {
  const rows = lagging(BASELINE, {
    fillerRate: null,
    hedgeDensity: null,
    productionOwned: 75,
    contribution: null,
    selfRating: null,
  });
  const v = rows.find((r) => r.key === "vocab");
  assert.equal(v.baseline, 0);
  assert.equal(v.target, 150);
  assert.equal(v.progress, 0.5);
});

// ── Bands and shapes ──────────────────────────────────────────────────────────

test("pace bands sit either side of the comfortable range", () => {
  assert.equal(paceBand(120), "slow");
  assert.equal(paceBand(150), "measured");
  assert.equal(paceBand(190), "fast");
  assert.equal(paceBand(130), "measured");
  assert.equal(paceBand(165), "measured");
});

test("condense never returns more buckets than asked for", () => {
  const series = Array.from({ length: 97 }, (_, i) => i);
  assert.equal(condense(series, 12).length, 12);
  assert.equal(condense(series, 1).length, 1);
});

test("condense passes short series through untouched", () => {
  assert.deepEqual(condense([1, 2, 3], 12), [1, 2, 3]);
  assert.deepEqual(condense([], 12), []);
});

test("condense is monotone on a monotone series", () => {
  const out = condense(Array.from({ length: 60 }, (_, i) => i), 6);
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i] > out[i - 1]);
});

test("drift needs six points before it will call anything a trend", () => {
  assert.equal(drift([10, 9, 8, 7, 6]), null);
  assert.notEqual(drift([10, 10, 10, 5, 5, 5]), null);
});

test("drift compares thirds, so one bad take is not a regression", () => {
  const improving = [10, 10, 10, 9, 9, 9, 5, 5, 30];
  const d = drift(improving);
  assert.ok(d < 0, `expected improvement, got ${d}`);
});

test("drift on a flat series is zero, not null", () => {
  assert.equal(drift([4, 4, 4, 4, 4, 4]), 0);
});

// ── Arithmetic ────────────────────────────────────────────────────────────────

test("median and mean are null on nothing, never 0 and never NaN", () => {
  assert.equal(median([]), null);
  assert.equal(mean([]), null);
  assert.equal(median([3]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(mean([1, 2, 3, 4]), 2.5);
});
