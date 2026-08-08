// Progress arithmetic: consistency, the week, and the ninety-day table.
//
// Pure. No SQLite, no network, no hooks — the queries live in db.ts and hand
// their rows in here as plain objects, so every rule below is testable under
// `node --experimental-strip-types --test`.
//
// Three things this file is careful about.
//
// 1. A streak is a measurement, not a reward (PRD §12: no flames, no confetti).
//    So it is reported alongside the thing that actually matters — density over a
//    fixed window — and the window is what the screen leads with. A 40-day streak
//    and 40 days of practice in the last 42 are the same fact; a 1-day streak and
//    18 active days in the last 28 are not the failure the streak alone implies.
//    Counting only the streak would punish a missed Sunday harder than a missed
//    fortnight, which is exactly backwards.
//
// 2. Medians, not means, for delivery figures. One catastrophic take — a bad
//    connection, a transcript that came back as four words — moves a weekly mean
//    by more than a week of real improvement moves it back.
//
// 3. Where a number cannot honestly be computed yet, it is `null` and stays
//    `null`. The ninety-day table has rows that are undefined in week one, and
//    printing a 0 there would read as a measurement.

import { PACE_BAND_WPM } from "./metrics.ts";

// ── Days ──────────────────────────────────────────────────────────────────────
// Local days, not UTC. Practice at 23:40 on Tuesday is Tuesday's practice to the
// person doing it, whatever the timezone offset says.

export type Day = number;

export function dayOf(ms: number): Day {
  const d = new Date(ms);
  return Math.floor(
    (ms - d.getTimezoneOffset() * 60_000) / 86_400_000
  );
}

export function dayStartMs(day: Day): number {
  // Reconstruct from the local midnight of that day rather than day*86400000,
  // so a DST shift inside the window does not slide every later day by an hour.
  const approx = new Date(day * 86_400_000 + 12 * 3_600_000);
  approx.setHours(0, 0, 0, 0);
  return approx.getTime();
}

// ── Consistency ───────────────────────────────────────────────────────────────

export type Consistency = {
  /** Consecutive days up to and including today, or up to yesterday if today is still open. */
  current: number;
  longest: number;
  /** Days with at least one recorded thing, inside the window. */
  active: number;
  window: number;
  /** active / window, 0..1. The figure the screen leads with. */
  density: number;
  /** Oldest first, one cell per day in the window. */
  grid: boolean[];
};

/**
 * `days` may contain duplicates and any order — it is a raw list of "something
 * was recorded on this day".
 *
 * The current streak survives a day that has not finished yet: at 09:00 on
 * Wednesday, having practised Monday and Tuesday, the streak is 2 and not 0.
 * Breaking it at midnight would mean the number is wrong for most of the hours
 * a person might look at it.
 */
export function consistency(days: Day[], today: Day, window = 28): Consistency {
  const set = new Set(days);

  let current = 0;
  const anchor = set.has(today) ? today : set.has(today - 1) ? today - 1 : null;
  if (anchor !== null) {
    let d = anchor;
    while (set.has(d)) {
      current += 1;
      d -= 1;
    }
  }

  let longest = 0;
  let run = 0;
  const sorted = [...set].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i += 1) {
    const d = sorted[i]!;
    run = i > 0 && sorted[i - 1] === d - 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const grid: boolean[] = [];
  for (let i = window - 1; i >= 0; i -= 1) grid.push(set.has(today - i));
  const active = grid.filter(Boolean).length;

  return { current, longest, active, window, density: active / window, grid };
}

// ── The week ──────────────────────────────────────────────────────────────────

/** Local Monday 00:00 of the week containing `ms`. Weeks start on Monday. */
export function weekStartMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() + 6) % 7; // Sunday is 0 in JS; we want it to be 6
  d.setDate(d.getDate() - back);
  return d.getTime();
}

/** Stable identity for a week, safe as a primary key: the Monday's day number. */
export function weekKey(ms: number): number {
  return dayOf(weekStartMs(ms));
}

export type WeekInput = {
  sessions: { at: number; fillerRate: number; wpm: number; hedgeDensity: number; rubricTotal: number | null }[];
  drills: { at: number; kind: "playbook" | "scaffold" | "roleplay"; score: number }[];
  takes: { at: number; accuracy: number }[];
  /** Debriefed rooms only. A prepped room you never walked into is not a room. */
  rooms: { at: number; spoke: number; questions: number; positions: number; turned: number }[];
  /** Words that crossed into production this week. */
  wordsProduced: number;
  /** Every day on which anything at all was recorded, all-time. */
  activeDays: Day[];
};

export type Target = { key: string; label: string; value: number; target: number; met: boolean };

export type WeekStats = {
  startMs: number;
  key: number;
  sessions: number;
  /** Median filler rate across the week's Arena takes. Null with no takes. */
  fillerRate: number | null;
  wpm: number | null;
  hedgeDensity: number | null;
  /** Mean rubric total out of 20, over judged sessions. */
  rubric: number | null;
  readAccuracy: number | null;
  drills: { playbook: number; scaffold: number; roleplay: number };
  drillScore: number | null;
  rooms: number;
  spoke: number;
  questions: number;
  positions: number;
  turned: number;
  wordsProduced: number;
  daysActive: number;
  /** PRD §8 leading indicators. Behaviour, not outcome — the things you control. */
  targets: Target[];
  /** True once there is enough in the week to say anything at all. */
  substantial: boolean;
};

/** PRD §8, leading indicators. Weekly, behavioural, and deliberately small. */
export const LEADING = {
  sessions: 5,
  rooms: 3,
  words: 8,
} as const;

export function weekStats(input: WeekInput, startMs: number): WeekStats {
  const s = input.sessions;
  const rooms = input.rooms;

  const drills = {
    playbook: input.drills.filter((d) => d.kind === "playbook").length,
    scaffold: input.drills.filter((d) => d.kind === "scaffold").length,
    roleplay: input.drills.filter((d) => d.kind === "roleplay").length,
  };

  const judged = s.filter((x) => x.rubricTotal !== null).map((x) => x.rubricTotal!);
  const inWeek = new Set(
    input.activeDays.filter((d) => {
      const t = dayStartMs(d);
      return t >= startMs && t < startMs + 7 * 86_400_000;
    })
  );

  const targets: Target[] = [
    { key: "sessions", label: "Arena sessions", value: s.length, target: LEADING.sessions, met: s.length >= LEADING.sessions },
    { key: "rooms", label: "Rooms prepped", value: rooms.length, target: LEADING.rooms, met: rooms.length >= LEADING.rooms },
    { key: "words", label: "Words produced", value: input.wordsProduced, target: LEADING.words, met: input.wordsProduced >= LEADING.words },
  ];

  return {
    startMs,
    key: dayOf(startMs),
    sessions: s.length,
    fillerRate: median(s.map((x) => x.fillerRate)),
    wpm: median(s.map((x) => x.wpm)),
    hedgeDensity: median(s.map((x) => x.hedgeDensity)),
    rubric: mean(judged),
    readAccuracy: median(input.takes.map((t) => t.accuracy)),
    drills,
    drillScore: mean(input.drills.map((d) => d.score)),
    rooms: rooms.length,
    spoke: sum(rooms.map((r) => r.spoke)),
    questions: sum(rooms.map((r) => r.questions)),
    positions: sum(rooms.map((r) => r.positions)),
    turned: sum(rooms.map((r) => r.turned)),
    wordsProduced: input.wordsProduced,
    daysActive: inWeek.size,
    targets,
    substantial: s.length + input.drills.length + input.takes.length + rooms.length >= 3,
  };
}

// ── The ninety-day table ──────────────────────────────────────────────────────
//
// PRD §8 lagging metrics. Every row needs a baseline, which is why onboarding
// records one: without a week-one measurement, "filler rate 6.1/min" is a number
// with nothing to compare it to, and the app can only ever claim improvement it
// cannot show.

export type Baseline = {
  at: number;
  fillerRate: number;
  wpm: number;
  hedgeDensity: number;
  deadAirS: number;
  /** "I said the thing I wanted to say", 1–5, asked before any coaching happens. */
  selfRating: number;
  provider: string;
  wordCount: number;
};

export type Current = {
  fillerRate: number | null;
  hedgeDensity: number | null;
  productionOwned: number;
  /** Questions + positions per debriefed room, over the recent window. */
  contribution: number | null;
  selfRating: number | null;
};

export type LaggingRow = {
  key: string;
  label: string;
  baseline: number | null;
  now: number | null;
  target: number | null;
  /** Which way is better. */
  direction: "down" | "up";
  unit: string;
  /** 0..1 of the way from baseline to target, or null when it cannot be computed. */
  progress: number | null;
  note: string;
};

/**
 * Two of these rows have targets defined relative to the baseline (hedges halve,
 * contribution doubles) and one has an absolute target (filler rate ≤5/min, the
 * threshold below which listeners stop noticing). Contribution has no honest
 * baseline in week one — you cannot double a rate measured over zero rooms — so
 * it stays null until rooms exist, and says so rather than showing 0 → 0.
 */
export function lagging(baseline: Baseline | null, now: Current): LaggingRow[] {
  const rows: LaggingRow[] = [
    {
      key: "filler",
      label: "Filler rate",
      baseline: baseline?.fillerRate ?? null,
      now: now.fillerRate,
      target: 5,
      direction: "down",
      unit: "/min",
      progress: null,
      note: "Below five per minute, listeners stop hearing them.",
    },
    {
      key: "hedge",
      label: "Hedge density",
      baseline: baseline?.hedgeDensity ?? null,
      now: now.hedgeDensity,
      target: baseline ? baseline.hedgeDensity * 0.5 : null,
      direction: "down",
      unit: "%",
      progress: null,
      note: "Halved. Hedging is what conviction sounds like when it is missing.",
    },
    {
      key: "vocab",
      label: "Production vocabulary",
      baseline: baseline ? 0 : null,
      now: now.productionOwned,
      target: 150,
      direction: "up",
      unit: " words",
      progress: null,
      note: "Words you have said out loud, not words you have seen.",
    },
    {
      key: "contribution",
      label: "Contribution per room",
      baseline: null,
      now: now.contribution,
      target: null,
      direction: "up",
      unit: "",
      progress: null,
      note: "Questions and positions per room. Needs four weeks of rooms before it means anything.",
    },
    {
      key: "self",
      label: "Said what I meant",
      baseline: baseline?.selfRating ?? null,
      now: now.selfRating,
      target: 4,
      direction: "up",
      unit: "/5",
      progress: null,
      note: "The only number here you report yourself, and the one that decides whether the rest mattered.",
    },
  ];

  return rows.map((r) => ({ ...r, progress: progressOf(r) }));
}

function progressOf(r: LaggingRow): number | null {
  if (r.baseline === null || r.now === null || r.target === null) return null;
  const span = r.target - r.baseline;
  if (span === 0) return r.now === r.target ? 1 : 0;
  return clamp01((r.now - r.baseline) / span);
}

// ── Bands and shapes ──────────────────────────────────────────────────────────

export type Pace = "slow" | "measured" | "fast";

export function paceBand(wpm: number): Pace {
  if (wpm < PACE_BAND_WPM.low) return "slow";
  if (wpm > PACE_BAND_WPM.high) return "fast";
  return "measured";
}

export const PACE_LABELS: Record<Pace, string> = {
  slow: "Slower than the band — deliberate, or searching for the word",
  measured: "Inside the band people find easiest to follow",
  fast: "Above the band — clear to you, work for the room",
};

/**
 * Reduce a long series to `buckets` medians, oldest first, for a chart that has
 * fewer pixels than it has data. Averaging would let one ruined take define a
 * bucket; the median is the point of the exercise.
 */
export function condense(series: number[], buckets: number): number[] {
  if (series.length === 0 || buckets <= 0) return [];
  if (series.length <= buckets) return [...series];
  const size = series.length / buckets;
  const out: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const slice = series.slice(Math.floor(i * size), Math.max(Math.floor((i + 1) * size), Math.floor(i * size) + 1));
    const m = median(slice);
    if (m !== null) out.push(m);
  }
  return out;
}

/**
 * Change between the first and last third of a series, as a signed fraction.
 * Thirds rather than first-vs-last point: two endpoints is a comparison of two
 * takes, and calling that a trend is how a bad Tuesday becomes a regression.
 */
export function drift(series: number[]): number | null {
  if (series.length < 6) return null;
  const n = Math.floor(series.length / 3);
  const first = median(series.slice(0, n));
  const last = median(series.slice(-n));
  if (first === null || last === null || first === 0) return null;
  return (last - first) / first;
}

// ── Small arithmetic ──────────────────────────────────────────────────────────

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
