// The arithmetic behind the Valve. Pure, so it runs under `node --test`.
//
// One number comes out of this drill: the rung of a five-step volume ladder at
// which the soft palate stops sealing. Everything here exists to make that
// number mean the same thing on Tuesday as it did last month.
//
// The hard part is that a phone microphone reports dBFS, which is a number about
// the recording, not about you. iOS applies gain control that nobody can switch
// off from inside Expo Go, so an absolute level is worthless: speak quietly for
// long enough and the OS simply turns you up. The way around it is to refuse to
// use absolute levels at all. Every session begins by measuring the speaker's
// own quiet and own loud, seconds apart, under whatever gain the OS has settled
// on, and the five rungs are interpolated between those two anchors. Gain
// control can compress the range - it cannot reorder it. Rung 4 stays above
// rung 2 no matter what the OS does, and "above rung 2" is the entire claim.
//
// When the range comes back too narrow to divide honestly, the drill says so
// and refuses to score rather than printing five rungs that are really one.

export const RUNGS = 5;
export type Rung = 1 | 2 | 3 | 4 | 5;
export const ALL_RUNGS: readonly Rung[] = [1, 2, 3, 4, 5];

/** Silence, as the iOS meter reports it. Anything at or under this is no one
 *  speaking, not someone speaking very quietly. */
export const FLOOR_DB = -55;

/**
 * Narrower than this between quiet and loud and the ladder is a fiction.
 *
 * A real speaker moving from a near-whisper to a comfortable projected level
 * covers well over 20 dB. Seven is already generous - it is set low enough to
 * pass a badly gain-controlled recording that still has usable ordering, and
 * high enough to catch a phone that has flattened everything to one level, or a
 * user who did the loud take at the same volume as the quiet one.
 */
export const MIN_SPREAD_DB = 7;

export type Calibration = { quietDb: number; loudDb: number };

export function spreadDb(c: Calibration): number {
  return c.loudDb - c.quietDb;
}

export function calibrationUsable(c: Calibration): boolean {
  return c.loudDb > FLOOR_DB && spreadDb(c) >= MIN_SPREAD_DB;
}

/** Why a calibration was rejected, in the words the screen will use. */
export function calibrationFault(c: Calibration): string | null {
  if (c.loudDb <= FLOOR_DB) return "Nothing was picked up. Check the microphone is not covered.";
  if (spreadDb(c) < MIN_SPREAD_DB)
    return "Those two were nearly the same level. Make the quiet one genuinely quiet and the loud one genuinely loud, then set the range again.";
  return null;
}

/** The dB window a rung covers. Rung 1 sits at the quiet anchor, rung 5 at the
 *  loud one, and the three between are evenly spaced. */
export function rungBand(rung: Rung, c: Calibration): { lowDb: number; highDb: number } {
  const step = spreadDb(c) / RUNGS;
  const low = c.quietDb + (rung - 1) * step;
  return { lowDb: low, highDb: low + step };
}

export function rungCentreDb(rung: Rung, c: Calibration): number {
  const { lowDb, highDb } = rungBand(rung, c);
  return (lowDb + highDb) / 2;
}

/**
 * Where a level sits on the ladder, as a continuous number - 1.0 is the bottom
 * of rung 1, 6.0 the top of rung 5. Drives the live meter, which needs to move
 * smoothly rather than snap between five states.
 */
export function rungPosition(db: number, c: Calibration): number {
  const step = spreadDb(c) / RUNGS;
  if (step <= 0) return 1;
  const raw = 1 + (db - c.quietDb) / step;
  return Math.max(0, Math.min(RUNGS + 1, raw));
}

/**
 * Hitting a rung is judged with a band and a half of tolerance, not the band
 * itself. Asking someone to land inside a 4 dB window by ear is asking them to
 * concentrate on the meter instead of on their throat, which defeats the drill -
 * the ladder needs him roughly at a level, reliably, not precisely at one.
 */
export const RUNG_TOLERANCE = 0.75;

export function hitRung(db: number, rung: Rung, c: Calibration): boolean {
  return Math.abs(rungPosition(db, c) - (rung + 0.5)) <= RUNG_TOLERANCE;
}

// ------------------------------------------------------------------- ladder

export type RungOutcome = {
  rung: Rung;
  /** Loudest level held during the phrase. */
  peakDb: number;
  /** Whether the speaker actually got to the level they were asked for. */
  reached: boolean;
  /** The speaker's own call, made against the mirror or the pinch. */
  leaked: boolean;
};

export type LadderResult = {
  /**
   * The lowest rung that leaked. RUNGS + 1 means the seal held everywhere the
   * ladder could reach, which is the target state and not a bug.
   */
  threshold: number;
  /** The loudest rung actually reached with no leak. 0 when even rung 1 leaks. */
  topClean: number;
  /**
   * False when the ladder stopped early without a leak - the speaker never got
   * loud enough to find their limit, so the threshold is a floor, not a reading.
   */
  complete: boolean;
};

/**
 * A rung the speaker never reached tells you nothing. Marking it clean would
 * quietly inflate the threshold every time someone was too self-conscious to
 * get loud in a quiet house, which is precisely the person this drill is for.
 */
export function ladderResult(outcomes: readonly RungOutcome[]): LadderResult {
  const leaks = outcomes.filter((o) => o.reached && o.leaked).map((o) => o.rung);
  const threshold = leaks.length > 0 ? Math.min(...leaks) : RUNGS + 1;

  const cleans = outcomes.filter((o) => o.reached && !o.leaked && o.rung < threshold);
  const topClean = cleans.length > 0 ? Math.max(...cleans.map((o) => o.rung)) : 0;

  // Either a leak was found, or every rung was genuinely reached and held.
  const reachedAll = ALL_RUNGS.every((r) => outcomes.some((o) => o.rung === r && o.reached));
  return { threshold, topClean, complete: leaks.length > 0 || reachedAll };
}

/** The rung to spend the carry-over step at: the loudest one that held. Working
 *  above it trains failure, working below it trains nothing. */
export function workingRung(r: LadderResult): Rung {
  return Math.max(1, Math.min(RUNGS, r.topClean || 1)) as Rung;
}

export function ladderVerdict(r: LadderResult): string {
  if (r.threshold > RUNGS && r.complete)
    return "The seal held at every level you reached. That is the target - keep it there and start pushing the range wider.";
  if (r.threshold > RUNGS)
    return "No leak found, but you never got to the top of the ladder. The number below is a floor, not a limit.";
  if (r.threshold === 1)
    return "Air is escaping even at your quietest. Spend a week on the valve wake-up before pushing volume at all.";
  return `Your seal holds to level ${r.threshold - 1} and goes at ${r.threshold}. That gap is the drill.`;
}

// -------------------------------------------------------------------- trend

export type Direction = "better" | "flat" | "worse";

/**
 * Newest first, as the database returns them.
 *
 * A single session is noise - mood, hydration, time of day and how honestly the
 * mirror was read all move it by a rung. Three either side is the shortest
 * window that survives that, which is why nothing is reported before six.
 */
export const TREND_WINDOW = 3;

export function thresholdTrend(historyNewestFirst: readonly number[]): {
  direction: Direction;
  delta: number;
  ready: boolean;
} {
  if (historyNewestFirst.length < TREND_WINDOW * 2)
    return { direction: "flat", delta: 0, ready: false };

  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const recent = mean(historyNewestFirst.slice(0, TREND_WINDOW));
  const older = mean(historyNewestFirst.slice(TREND_WINDOW, TREND_WINDOW * 2));
  const delta = recent - older;

  // Half a rung. Below that it is the same reading twice.
  if (Math.abs(delta) < 0.5) return { direction: "flat", delta, ready: true };
  return { direction: delta > 0 ? "better" : "worse", delta, ready: true };
}

// -------------------------------------------------------------------- level

/**
 * A running peak that decays, for the live readout.
 *
 * A bare instantaneous meter reads the gaps between words as silence, so the
 * number collapses several times a second and the speaker chases it upward -
 * which trains exactly the pushing this drill exists to remove. Holding the peak
 * and letting it fall slowly reports the level of the phrase rather than the
 * level of the current syllable.
 */
export function decayPeak(previous: number, sample: number, decayDbPerTick = 1.2): number {
  if (sample > previous) return sample;
  return Math.max(FLOOR_DB, previous - decayDbPerTick);
}

/** The loudest sustained level in a take, ignoring single-tick spikes: a cough
 *  or a knock should not certify a rung the voice never held. */
export function sustainedPeak(samples: readonly number[], holdTicks = 3): number {
  if (samples.length === 0) return FLOOR_DB;
  const sorted = [...samples].sort((a, b) => b - a);
  const i = Math.min(holdTicks - 1, sorted.length - 1);
  return sorted[i] ?? FLOOR_DB;
}
