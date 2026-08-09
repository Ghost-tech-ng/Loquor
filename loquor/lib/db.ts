// Local persistence. Phase 1 has no auth and no backend (PRD §9) — the phone is
// the source of truth. The schema deliberately mirrors the Postgres tables in
// §6.3 so Phase 3 is a sync layer rather than a migration.
//
// Provider is stored per utterance. Filler counts from Whisper and from Deepgram
// are not the same measurement, and a trend line that silently mixes them would
// show an improvement the day you change a setting.

import * as SQLite from "expo-sqlite";
import type { Metrics } from "./metrics.ts";
import type { Judgement } from "./judge.ts";
import type { ReadingScore } from "./reading.ts";

export type SessionRow = {
  id: string;
  topic_id: string;
  topic_title: string;
  started_at: number;
  duration_s: number;
  transcript: string;
  provider: string;
  filler_rate: number;
  wpm: number;
  hedge_density: number;
  dead_air_s: number;
  dead_air_count: number;
  rubric_total: number | null;
  judgement_json: string | null;
  metrics_json: string;
  is_rewrite: 0 | 1;
  parent_id: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("loquor.db").then(async (d) => {
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id             TEXT PRIMARY KEY NOT NULL,
          topic_id       TEXT NOT NULL,
          topic_title    TEXT NOT NULL,
          started_at     INTEGER NOT NULL,
          duration_s     REAL NOT NULL,
          transcript     TEXT NOT NULL,
          provider       TEXT NOT NULL,
          filler_rate    REAL NOT NULL,
          wpm            REAL NOT NULL,
          hedge_density  REAL NOT NULL,
          dead_air_s     REAL NOT NULL,
          dead_air_count INTEGER NOT NULL,
          rubric_total   INTEGER,
          judgement_json TEXT,
          metrics_json   TEXT NOT NULL,
          is_rewrite     INTEGER NOT NULL DEFAULT 0,
          parent_id      TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_topic ON sessions (topic_id);

        -- v0.1.1 stored one row per 130-word passage. Passages are gone; the unit
        -- is now a section of a long reading. Dropping rather than migrating is
        -- safe because nothing has shipped, and a migration here would carry a
        -- schema nobody will ever have data in.
        DROP TABLE IF EXISTS readings;

        CREATE TABLE IF NOT EXISTS read_takes (
          id           TEXT PRIMARY KEY NOT NULL,
          reading_id   TEXT NOT NULL,
          section_n    INTEGER NOT NULL,
          started_at   INTEGER NOT NULL,
          duration_s   REAL NOT NULL,
          provider     TEXT NOT NULL,
          accuracy     REAL NOT NULL,
          target_accuracy REAL,
          wpm          REAL NOT NULL,
          hesitations  INTEGER NOT NULL,
          phrasing_honoured INTEGER NOT NULL,
          phrasing_available INTEGER NOT NULL,
          score_json   TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_takes_started ON read_takes (started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_takes_reading ON read_takes (reading_id, section_n);

        -- The Lexicon. One row per (word, track): a word you can recognise on the
        -- page and a word you can produce under time pressure are two different
        -- memories with two different decay curves, so they get two schedules.
        CREATE TABLE IF NOT EXISTS lexicon (
          word        TEXT NOT NULL,
          track       TEXT NOT NULL,
          stability   REAL NOT NULL,
          difficulty  REAL NOT NULL,
          due_at      INTEGER NOT NULL,
          last_at     INTEGER NOT NULL,
          reps        INTEGER NOT NULL DEFAULT 0,
          lapses      INTEGER NOT NULL DEFAULT 0,
          real_use_at INTEGER,
          real_use_note TEXT,
          PRIMARY KEY (word, track)
        );
        CREATE INDEX IF NOT EXISTS idx_lexicon_due ON lexicon (track, due_at);

        -- Skill tracking for the Playbook and the Lab. Deliberately NOT FSRS:
        -- an archetype is not a memory that decays, it is a motion that gets
        -- better with reps. What matters is a recent average, so this stores an
        -- EWMA and the attempt count, not a schedule.
        CREATE TABLE IF NOT EXISTS skill (
          drill    TEXT NOT NULL,   -- 'archetype' | 'scaffold' | 'move'
          item_id  TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          ewma     REAL NOT NULL,   -- 0..4, the rubric range
          last_at  INTEGER NOT NULL,
          PRIMARY KEY (drill, item_id)
        );

        -- One row per spoken drill attempt: a Playbook question, a scaffold
        -- argument, a role-play. Separate from sessions for the same reason
        -- read_takes is: these are not comparable measurements and a table you
        -- can average across is a table someone will average across.
        CREATE TABLE IF NOT EXISTS drills (
          id         TEXT PRIMARY KEY NOT NULL,
          kind       TEXT NOT NULL,   -- 'playbook' | 'scaffold' | 'roleplay'
          item_id    TEXT NOT NULL,   -- archetype / scaffold / counterpart id
          context_id TEXT,            -- scenario or topic id
          started_at INTEGER NOT NULL,
          provider   TEXT NOT NULL,
          transcript TEXT NOT NULL,
          score      REAL NOT NULL,   -- 0..1, comparable within a kind only
          verdict_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_drills_started ON drills (started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_drills_kind ON drills (kind, item_id);

        -- Rooms. The one part of the product that touches a real meeting, and
        -- the only table holding anything about other people — so it holds as
        -- little as possible: a title, a decision, and what the user chose to
        -- say about it afterwards. No audio, no attendees, no recording, ever.
        CREATE TABLE IF NOT EXISTS rooms (
          id            TEXT PRIMARY KEY NOT NULL,
          title         TEXT NOT NULL,
          decision      TEXT NOT NULL,
          at            INTEGER NOT NULL,
          created_at    INTEGER NOT NULL,
          prep_json     TEXT NOT NULL,
          notification_id TEXT,
          debriefed_at  INTEGER,
          debrief_json  TEXT,
          spoke         INTEGER,
          questions_asked INTEGER,
          positions_taken INTEGER,
          turned        INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_rooms_at ON rooms (at DESC);

        -- The week-one baseline. Exactly one row, ever: id is pinned to 1 and
        -- the insert replaces. A baseline that could be re-measured whenever the
        -- number looked bad would not be a baseline, it would be a high score.
        CREATE TABLE IF NOT EXISTS baseline (
          id            INTEGER PRIMARY KEY CHECK (id = 1),
          at            INTEGER NOT NULL,
          filler_rate   REAL NOT NULL,
          wpm           REAL NOT NULL,
          hedge_density REAL NOT NULL,
          dead_air_s    REAL NOT NULL,
          self_rating   INTEGER NOT NULL,
          provider      TEXT NOT NULL,
          word_count    INTEGER NOT NULL,
          transcript    TEXT NOT NULL,
          metrics_json  TEXT NOT NULL
        );

        -- Weekly synthesis, cached by the Monday it covers. The aggregates are
        -- free to recompute; the paragraph costs an API call, so a finished week
        -- is written once and read forever. The current week is stored too and
        -- simply overwritten as it fills.
        --
        -- self_rating is the one number in the app the user reports themselves:
        -- "I said the thing I wanted to say", 1-5. It lives here rather than in
        -- its own table because it is a property of a week, and asking for it
        -- once a week is the most it can be asked without becoming noise.
        CREATE TABLE IF NOT EXISTS reports (
          week_key    INTEGER PRIMARY KEY NOT NULL,
          made_at     INTEGER NOT NULL,
          provider    TEXT NOT NULL,
          stats_json  TEXT NOT NULL,
          text_json   TEXT NOT NULL,
          self_rating INTEGER
        );
      `);
      return d;
    });
  }
  return dbPromise;
}

export async function saveSession(args: {
  id: string;
  topicId: string;
  topicTitle: string;
  transcript: string;
  provider: string;
  metrics: Metrics;
  judgement: Judgement | null;
  isRewrite?: boolean;
  parentId?: string | null;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR REPLACE INTO sessions
       (id, topic_id, topic_title, started_at, duration_s, transcript, provider,
        filler_rate, wpm, hedge_density, dead_air_s, dead_air_count,
        rubric_total, judgement_json, metrics_json, is_rewrite, parent_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args.id,
    args.topicId,
    args.topicTitle,
    Date.now(),
    args.metrics.durationS,
    args.transcript,
    args.provider,
    args.metrics.fillerRate,
    args.metrics.wpm,
    args.metrics.hedgeDensity,
    args.metrics.deadAirTotalS,
    args.metrics.deadAirCount,
    args.judgement
      ? args.judgement.rubric.clarity + args.judgement.rubric.specificity +
        args.judgement.rubric.structure + args.judgement.rubric.register +
        args.judgement.rubric.economy
      : null,
    args.judgement ? JSON.stringify(args.judgement) : null,
    JSON.stringify(args.metrics),
    args.isRewrite ? 1 : 0,
    args.parentId ?? null
  );
}

export async function recentSessions(limit = 30): Promise<SessionRow[]> {
  const d = await db();
  return d.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE is_rewrite = 0 ORDER BY started_at DESC LIMIT ?`,
    limit
  );
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const d = await db();
  return d.getFirstAsync<SessionRow>(`SELECT * FROM sessions WHERE id = ?`, id);
}

/** Topic ids already used, so Today does not serve the same prompt twice. */
export async function usedTopicIds(): Promise<string[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ topic_id: string }>(`SELECT DISTINCT topic_id FROM sessions`);
  return rows.map((r) => r.topic_id);
}

export async function countToday(): Promise<number> {
  const d = await db();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sessions WHERE is_rewrite = 0 AND started_at >= ?`,
    start.getTime()
  );
  return row?.n ?? 0;
}

/** Arena sessions ever. Today's ladder needs to tell a first-ever user from a
 *  user who has simply not spoken yet today; the two need different copy. */
export async function countSessions(): Promise<number> {
  const d = await db();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sessions WHERE is_rewrite = 0`
  );
  return row?.n ?? 0;
}

/**
 * Filler rate over the last `n` sessions, oldest first. Only sessions from the
 * same STT provider are compared — mixing Whisper and Deepgram counts would
 * produce a step change in the trend that reflects a settings toggle, not
 * anything about how the user speaks.
 */
export async function fillerTrend(provider: string, n = 30): Promise<number[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ filler_rate: number }>(
    `SELECT filler_rate FROM sessions
      WHERE is_rewrite = 0 AND provider = ?
      ORDER BY started_at DESC LIMIT ?`,
    provider,
    n
  );
  return rows.map((r) => r.filler_rate).reverse();
}

// ── The Reading ───────────────────────────────────────────────────────────────
// Read-aloud takes live in their own table rather than in `sessions`. They are
// not comparable: accuracy against a fixed text and filler rate in spontaneous
// speech measure different things, and putting them in one table would tempt a
// future query into averaging them.

export type TakeRow = {
  id: string;
  reading_id: string;
  section_n: number;
  started_at: number;
  duration_s: number;
  provider: string;
  accuracy: number;
  target_accuracy: number | null;
  wpm: number;
  hesitations: number;
  phrasing_honoured: number;
  phrasing_available: number;
  score_json: string;
};

export async function saveTake(args: {
  id: string;
  readingId: string;
  sectionN: number;
  provider: string;
  score: ReadingScore;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR REPLACE INTO read_takes
       (id, reading_id, section_n, started_at, duration_s, provider, accuracy,
        target_accuracy, wpm, hesitations, phrasing_honoured, phrasing_available, score_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args.id,
    args.readingId,
    args.sectionN,
    Date.now(),
    args.score.durationS,
    args.provider,
    args.score.accuracy,
    args.score.targetAccuracy,
    args.score.wpm,
    args.score.hesitations,
    args.score.phrasing.honoured,
    args.score.phrasing.available,
    JSON.stringify(args.score)
  );
}

export async function getTake(id: string): Promise<TakeRow | null> {
  const d = await db();
  return d.getFirstAsync<TakeRow>(`SELECT * FROM read_takes WHERE id = ?`, id);
}

export async function recentTakes(limit = 20): Promise<TakeRow[]> {
  const d = await db();
  return d.getAllAsync<TakeRow>(
    `SELECT * FROM read_takes ORDER BY started_at DESC LIMIT ?`,
    limit
  );
}

/** Readings already started, so Today does not serve the same one twice. */
export async function usedReadingIds(): Promise<string[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ reading_id: string }>(
    `SELECT DISTINCT reading_id FROM read_takes`
  );
  return rows.map((r) => r.reading_id);
}

/**
 * Best accuracy per section of one reading. A read-aloud drill is one you are
 * meant to repeat, so the useful number is your ceiling on this text, not your
 * last attempt at it — and the ceiling per section is what tells you which one
 * to go back to.
 */
export async function sectionBests(readingId: string): Promise<Map<number, number>> {
  const d = await db();
  const rows = await d.getAllAsync<{ section_n: number; best: number }>(
    `SELECT section_n, MAX(accuracy) AS best FROM read_takes
      WHERE reading_id = ? GROUP BY section_n`,
    readingId
  );
  return new Map(rows.map((r) => [r.section_n, r.best]));
}

// ── The Lexicon ───────────────────────────────────────────────────────────────

export type Track = "recognition" | "production";

export type LexiconRow = {
  word: string;
  track: Track;
  stability: number;
  difficulty: number;
  due_at: number;
  last_at: number;
  reps: number;
  lapses: number;
  real_use_at: number | null;
  real_use_note: string | null;
};

export async function getCard(word: string, track: Track): Promise<LexiconRow | null> {
  const d = await db();
  return d.getFirstAsync<LexiconRow>(
    `SELECT * FROM lexicon WHERE word = ? AND track = ?`,
    word,
    track
  );
}

export async function putCard(row: LexiconRow): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO lexicon (word, track, stability, difficulty, due_at, last_at, reps, lapses)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(word, track) DO UPDATE SET
       stability = excluded.stability, difficulty = excluded.difficulty,
       due_at = excluded.due_at, last_at = excluded.last_at,
       reps = excluded.reps, lapses = excluded.lapses`,
    row.word,
    row.track,
    row.stability,
    row.difficulty,
    row.due_at,
    row.last_at,
    row.reps,
    row.lapses
  );
}

/**
 * Words due for review on one track, soonest-overdue first. `known` is the
 * corpus, so a word that has never been seen is not returned here — introducing
 * new words is a separate decision from reviewing old ones, and mixing them
 * makes the queue length meaningless.
 */
export async function dueCards(track: Track, now = Date.now(), limit = 20): Promise<LexiconRow[]> {
  const d = await db();
  return d.getAllAsync<LexiconRow>(
    `SELECT * FROM lexicon WHERE track = ? AND due_at <= ? ORDER BY due_at ASC LIMIT ?`,
    track,
    now,
    limit
  );
}

export async function seenWords(track: Track): Promise<string[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ word: string }>(
    `SELECT word FROM lexicon WHERE track = ?`,
    track
  );
  return rows.map((r) => r.word);
}

/**
 * The strongest signal available, and the only one that comes from outside the
 * app: you used the word in a real conversation. Recorded on the production
 * track, since that is the thing it is evidence of.
 */
export async function markRealUse(word: string, note: string, at = Date.now()): Promise<void> {
  const d = await db();
  await d.runAsync(
    `UPDATE lexicon SET real_use_at = ?, real_use_note = ? WHERE word = ? AND track = 'production'`,
    at,
    note.slice(0, 400),
    word
  );
}

export async function lexiconStats(): Promise<{
  seen: number;
  productionOwned: number;
  realUses: number;
  dueNow: number;
}> {
  const d = await db();
  const row = await d.getFirstAsync<{
    seen: number;
    owned: number;
    real: number;
    due: number;
  }>(
    `SELECT
       (SELECT COUNT(DISTINCT word) FROM lexicon) AS seen,
       (SELECT COUNT(*) FROM lexicon WHERE track = 'production' AND stability >= 21) AS owned,
       (SELECT COUNT(*) FROM lexicon WHERE real_use_at IS NOT NULL) AS real,
       (SELECT COUNT(*) FROM lexicon WHERE due_at <= ?) AS due`,
    Date.now()
  );
  return {
    seen: row?.seen ?? 0,
    productionOwned: row?.owned ?? 0,
    realUses: row?.real ?? 0,
    dueNow: row?.due ?? 0,
  };
}

// ── Skill (Playbook, Lab) ─────────────────────────────────────────────────────

export type Drill = "archetype" | "scaffold" | "move";

export type SkillRow = {
  drill: Drill;
  item_id: string;
  attempts: number;
  ewma: number;
  last_at: number;
};

export async function skillStats(drill: Drill): Promise<SkillRow[]> {
  const d = await db();
  return d.getAllAsync<SkillRow>(`SELECT * FROM skill WHERE drill = ?`, drill);
}

export async function putSkill(row: SkillRow): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO skill (drill, item_id, attempts, ewma, last_at) VALUES (?,?,?,?,?)
     ON CONFLICT(drill, item_id) DO UPDATE SET
       attempts = excluded.attempts, ewma = excluded.ewma, last_at = excluded.last_at`,
    row.drill,
    row.item_id,
    row.attempts,
    row.ewma,
    row.last_at
  );
}

export type DrillRow = {
  id: string;
  kind: "playbook" | "scaffold" | "roleplay";
  item_id: string;
  context_id: string | null;
  started_at: number;
  provider: string;
  transcript: string;
  score: number;
  verdict_json: string;
};

export async function saveDrill(args: {
  id: string;
  kind: DrillRow["kind"];
  itemId: string;
  contextId?: string | null;
  provider: string;
  transcript: string;
  score: number;
  verdict: unknown;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR REPLACE INTO drills
       (id, kind, item_id, context_id, started_at, provider, transcript, score, verdict_json)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    args.id,
    args.kind,
    args.itemId,
    args.contextId ?? null,
    Date.now(),
    args.provider,
    args.transcript,
    args.score,
    JSON.stringify(args.verdict)
  );
}

export async function recentDrills(kind: DrillRow["kind"], limit = 20): Promise<DrillRow[]> {
  const d = await db();
  return d.getAllAsync<DrillRow>(
    `SELECT * FROM drills WHERE kind = ? ORDER BY started_at DESC LIMIT ?`,
    kind,
    limit
  );
}

/** Scenario ids already drilled, so the Playbook does not repeat one. */
export async function usedContextIds(kind: DrillRow["kind"]): Promise<string[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ context_id: string | null }>(
    `SELECT DISTINCT context_id FROM drills WHERE kind = ?`,
    kind
  );
  return rows.map((r) => r.context_id).filter((x): x is string => x !== null);
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export type RoomRow = {
  id: string;
  title: string;
  decision: string;
  at: number;
  created_at: number;
  prep_json: string;
  notification_id: string | null;
  debriefed_at: number | null;
  debrief_json: string | null;
  spoke: number | null;
  questions_asked: number | null;
  positions_taken: number | null;
  turned: number | null;
};

export async function createRoom(args: {
  id: string;
  title: string;
  decision: string;
  at: number;
  prep: unknown;
  notificationId?: string | null;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR REPLACE INTO rooms (id, title, decision, at, created_at, prep_json, notification_id)
     VALUES (?,?,?,?,?,?,?)`,
    args.id,
    args.title,
    args.decision,
    args.at,
    Date.now(),
    JSON.stringify(args.prep),
    args.notificationId ?? null
  );
}

export async function getRoom(id: string): Promise<RoomRow | null> {
  const d = await db();
  return d.getFirstAsync<RoomRow>(`SELECT * FROM rooms WHERE id = ?`, id);
}

export async function recentRooms(limit = 20): Promise<RoomRow[]> {
  const d = await db();
  return d.getAllAsync<RoomRow>(`SELECT * FROM rooms ORDER BY at DESC LIMIT ?`, limit);
}

/** Rooms that have happened and have no debrief. The nag list. */
export async function pendingDebriefs(now = Date.now()): Promise<RoomRow[]> {
  const d = await db();
  return d.getAllAsync<RoomRow>(
    `SELECT * FROM rooms WHERE debriefed_at IS NULL AND at <= ? ORDER BY at DESC`,
    now
  );
}

export async function saveDebrief(args: {
  id: string;
  debrief: unknown;
  spoke: boolean;
  questionsAsked: number;
  positionsTaken: number;
  turned: boolean;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `UPDATE rooms SET debriefed_at = ?, debrief_json = ?, spoke = ?,
       questions_asked = ?, positions_taken = ?, turned = ? WHERE id = ?`,
    Date.now(),
    JSON.stringify(args.debrief),
    args.spoke ? 1 : 0,
    args.questionsAsked,
    args.positionsTaken,
    args.turned ? 1 : 0,
    args.id
  );
}

/**
 * The Contribution funnel over a window. Rooms *entered* counts rooms that have
 * happened, not rooms you created — a Prep Card you never used is not a meeting
 * you attended, and counting it would let the headline metric be gamed by
 * planning rather than by speaking.
 */
export async function contributionRaw(sinceMs: number, now = Date.now()): Promise<{
  entered: number;
  spoke: number;
  questions: number;
  positions: number;
  turned: number;
}> {
  const d = await db();
  const row = await d.getFirstAsync<{
    entered: number;
    spoke: number;
    questions: number;
    positions: number;
    turned: number;
  }>(
    `SELECT
       COUNT(*) AS entered,
       COALESCE(SUM(spoke), 0) AS spoke,
       COALESCE(SUM(questions_asked), 0) AS questions,
       COALESCE(SUM(positions_taken), 0) AS positions,
       COALESCE(SUM(turned), 0) AS turned
     FROM rooms WHERE at >= ? AND at <= ? AND debriefed_at IS NOT NULL`,
    sinceMs,
    now
  );
  return {
    entered: row?.entered ?? 0,
    spoke: row?.spoke ?? 0,
    questions: row?.questions ?? 0,
    positions: row?.positions ?? 0,
    turned: row?.turned ?? 0,
  };
}

// ── Progress ──────────────────────────────────────────────────────────────────
//
// Every query here returns rows, not conclusions. Bucketing into local days and
// weeks happens in lib/progress.ts, in JavaScript, where it is testable — SQLite
// can do it with strftime('…','localtime') but that pushes the app's definition
// of "a day" into a string literal nobody will ever unit-test.

/** Every moment on which anything at all was recorded. Cheap: hundreds of rows. */
export async function activityTimes(sinceMs = 0): Promise<number[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ at: number }>(
    `SELECT started_at AS at FROM sessions   WHERE started_at >= ?1
     UNION ALL
     SELECT started_at AS at FROM read_takes WHERE started_at >= ?1
     UNION ALL
     SELECT started_at AS at FROM drills     WHERE started_at >= ?1
     UNION ALL
     SELECT debriefed_at AS at FROM rooms    WHERE debriefed_at >= ?1`,
    sinceMs
  );
  return rows.map((r) => r.at);
}

export async function sessionsBetween(a: number, b: number): Promise<SessionRow[]> {
  const d = await db();
  return d.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE is_rewrite = 0 AND started_at >= ? AND started_at < ?
      ORDER BY started_at ASC`,
    a,
    b
  );
}

export async function takesBetween(a: number, b: number): Promise<TakeRow[]> {
  const d = await db();
  return d.getAllAsync<TakeRow>(
    `SELECT * FROM read_takes WHERE started_at >= ? AND started_at < ? ORDER BY started_at ASC`,
    a,
    b
  );
}

export async function drillsBetween(a: number, b: number): Promise<DrillRow[]> {
  const d = await db();
  return d.getAllAsync<DrillRow>(
    `SELECT * FROM drills WHERE started_at >= ? AND started_at < ? ORDER BY started_at ASC`,
    a,
    b
  );
}

/** Debriefed rooms, keyed on when the meeting happened rather than when it was logged. */
export async function roomsBetween(a: number, b: number): Promise<RoomRow[]> {
  const d = await db();
  return d.getAllAsync<RoomRow>(
    `SELECT * FROM rooms WHERE debriefed_at IS NOT NULL AND at >= ? AND at < ? ORDER BY at ASC`,
    a,
    b
  );
}

/**
 * Words whose production track was last touched in this window and now clears
 * the ownership threshold. An approximation, and deliberately the conservative
 * one: a word that reached stability weeks ago and was not reviewed this week is
 * not counted again, so the weekly figure never double-counts the same word.
 */
export async function producedBetween(a: number, b: number): Promise<number> {
  const d = await db();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM lexicon
      WHERE track = 'production' AND stability >= 21 AND last_at >= ? AND last_at < ?`,
    a,
    b
  );
  return row?.n ?? 0;
}

// ── Baseline ──────────────────────────────────────────────────────────────────

export type BaselineRow = {
  id: 1;
  at: number;
  filler_rate: number;
  wpm: number;
  hedge_density: number;
  dead_air_s: number;
  self_rating: number;
  provider: string;
  word_count: number;
  transcript: string;
  metrics_json: string;
};

export async function getBaseline(): Promise<BaselineRow | null> {
  const d = await db();
  return d.getFirstAsync<BaselineRow>(`SELECT * FROM baseline WHERE id = 1`);
}

export async function saveBaseline(args: {
  transcript: string;
  provider: string;
  metrics: Metrics;
  selfRating: number;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR REPLACE INTO baseline
       (id, at, filler_rate, wpm, hedge_density, dead_air_s, self_rating, provider,
        word_count, transcript, metrics_json)
     VALUES (1,?,?,?,?,?,?,?,?,?,?)`,
    Date.now(),
    args.metrics.fillerRate,
    args.metrics.wpm,
    args.metrics.hedgeDensity,
    args.metrics.deadAirTotalS,
    args.selfRating,
    args.provider,
    args.metrics.wordCount,
    args.transcript,
    JSON.stringify(args.metrics)
  );
}

// ── Weekly reports ────────────────────────────────────────────────────────────

export type ReportRow = {
  week_key: number;
  made_at: number;
  provider: string;
  stats_json: string;
  text_json: string;
  self_rating: number | null;
};

export async function getReport(weekKey: number): Promise<ReportRow | null> {
  const d = await db();
  return d.getFirstAsync<ReportRow>(`SELECT * FROM reports WHERE week_key = ?`, weekKey);
}

export async function saveReport(args: {
  weekKey: number;
  provider: string;
  stats: unknown;
  text: unknown;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    // Upsert rather than REPLACE: a rating may already exist on this row, given
    // before the report was generated, and regenerating the text must not erase
    // the one number on the screen the user reported themselves.
    `INSERT INTO reports (week_key, made_at, provider, stats_json, text_json)
     VALUES (?,?,?,?,?)
     ON CONFLICT(week_key) DO UPDATE SET
       made_at = excluded.made_at, provider = excluded.provider,
       stats_json = excluded.stats_json, text_json = excluded.text_json`,
    args.weekKey,
    Date.now(),
    args.provider,
    JSON.stringify(args.stats),
    JSON.stringify(args.text)
  );
}

export async function recentReports(limit = 8): Promise<ReportRow[]> {
  const d = await db();
  return d.getAllAsync<ReportRow>(
    `SELECT * FROM reports ORDER BY week_key DESC LIMIT ?`,
    limit
  );
}

/**
 * The weekly self-rating. Upserts a bare row when no report has been generated
 * yet, so the rating can be given without spending an API call on a synthesis.
 */
export async function setWeekRating(weekKey: number, rating: number): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO reports (week_key, made_at, provider, stats_json, text_json, self_rating)
     VALUES (?,?,'','null','null',?)
     ON CONFLICT(week_key) DO UPDATE SET self_rating = excluded.self_rating`,
    weekKey,
    Date.now(),
    rating
  );
}

/** The most recent week that has a rating. Null until one has been given. */
export async function latestRating(): Promise<{ weekKey: number; rating: number } | null> {
  const d = await db();
  const row = await d.getFirstAsync<{ week_key: number; self_rating: number }>(
    `SELECT week_key, self_rating FROM reports
      WHERE self_rating IS NOT NULL ORDER BY week_key DESC LIMIT 1`
  );
  return row ? { weekKey: row.week_key, rating: row.self_rating } : null;
}

export async function resetAll(): Promise<void> {
  const d = await db();
  await d.execAsync(
    `DELETE FROM sessions; DELETE FROM read_takes; DELETE FROM lexicon;
     DELETE FROM skill; DELETE FROM drills; DELETE FROM rooms;
     DELETE FROM baseline; DELETE FROM reports;`
  );
}
