// The seam between SQLite and the pure arithmetic in progress.ts.
//
// Same shape as skillStore: db.ts returns rows, progress.ts turns rows into
// meaning, and this file is the only place that knows both. Nothing here decides
// anything — if a rule is being applied, it belongs one file over, where it can
// be tested without a device.

import {
  activityTimes,
  contributionRaw,
  drillsBetween,
  getBaseline,
  latestRating,
  lexiconStats,
  producedBetween,
  roomsBetween,
  sessionsBetween,
  takesBetween,
  fillerTrend,
  recentSessions,
} from "./db.ts";
import {
  consistency,
  dayOf,
  lagging,
  weekStartMs,
  weekStats,
  type Baseline,
  type Consistency,
  type Day,
  type LaggingRow,
  type WeekStats,
} from "./progress.ts";

const WEEK_MS = 7 * 86_400_000;

export async function activeDays(): Promise<Day[]> {
  const times = await activityTimes(0);
  return [...new Set(times.map(dayOf))].sort((a, b) => a - b);
}

export async function baseline(): Promise<Baseline | null> {
  const row = await getBaseline();
  if (!row) return null;
  return {
    at: row.at,
    fillerRate: row.filler_rate,
    wpm: row.wpm,
    hedgeDensity: row.hedge_density,
    deadAirS: row.dead_air_s,
    selfRating: row.self_rating,
    provider: row.provider,
    wordCount: row.word_count,
  };
}

/** Stats for the week containing `at`. Defaults to the week in progress. */
export async function week(at = Date.now(), days?: Day[]): Promise<WeekStats> {
  const start = weekStartMs(at);
  const end = start + WEEK_MS;
  const [sessions, takes, drills, rooms, produced, all] = await Promise.all([
    sessionsBetween(start, end),
    takesBetween(start, end),
    drillsBetween(start, end),
    roomsBetween(start, end),
    producedBetween(start, end),
    days ? Promise.resolve(days) : activeDays(),
  ]);

  return weekStats(
    {
      sessions: sessions.map((r) => ({
        at: r.started_at,
        fillerRate: r.filler_rate,
        wpm: r.wpm,
        hedgeDensity: r.hedge_density,
        rubricTotal: r.rubric_total,
      })),
      takes: takes.map((t) => ({ at: t.started_at, accuracy: t.accuracy })),
      drills: drills.map((d) => ({ at: d.started_at, kind: d.kind, score: d.score })),
      rooms: rooms.map((r) => ({
        at: r.at,
        spoke: r.spoke ?? 0,
        questions: r.questions_asked ?? 0,
        positions: r.positions_taken ?? 0,
        turned: r.turned ?? 0,
      })),
      wordsProduced: produced,
      activeDays: all,
    },
    start
  );
}

export type Overview = {
  /** The most recent week that carries a self-rating, or null. */
  rating: { weekKey: number; rating: number } | null;
  consistency: Consistency;
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  lagging: LaggingRow[];
  baseline: Baseline | null;
  /** Filler rate per session, oldest first, one provider only. */
  fillerSeries: number[];
  /** Words per minute per session, oldest first. */
  wpmSeries: number[];
  totalSessions: number;
};

/**
 * Everything the Progress screen shows, in one round trip.
 *
 * `sttProvider` is required rather than optional: a filler trend that silently
 * mixes Whisper and Deepgram counts shows a step change on the day a setting was
 * toggled, and there is no way to tell that apart from an improvement.
 */
export async function overview(sttProvider: string, now = Date.now()): Promise<Overview> {
  const days = await activeDays();
  const [thisWeek, lastWeek, base, fillerSeries, sessions, lex, contrib, rated] =
    await Promise.all([
      week(now, days),
      week(weekStartMs(now) - 1, days),
      baseline(),
      fillerTrend(sttProvider, 60),
      recentSessions(60),
      lexiconStats(),
      contributionRaw(now - 28 * 86_400_000, now),
      latestRating(),
    ]);
  const con = consistency(days, dayOf(now));

  return {
    rating: rated,
    consistency: con,
    thisWeek,
    lastWeek,
    lagging: lagging(base, {
      fillerRate: thisWeek.fillerRate ?? lastWeek.fillerRate,
      hedgeDensity: thisWeek.hedgeDensity ?? lastWeek.hedgeDensity,
      productionOwned: lex.productionOwned,
      // Questions and positions per debriefed room over the last four weeks.
      contribution:
        contrib.entered > 0 ? (contrib.questions + contrib.positions) / contrib.entered : null,
      selfRating: rated?.rating ?? null,
    }),
    baseline: base,
    fillerSeries,
    wpmSeries: sessions
      .filter((s) => s.is_rewrite === 0 && s.provider === sttProvider)
      .map((s) => s.wpm)
      .reverse(),
    totalSessions: sessions.filter((s) => s.is_rewrite === 0).length,
  };
}
