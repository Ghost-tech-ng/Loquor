// The day streak, with freezes.
//
// A streak that one sick day destroys teaches you that the streak was never
// about you. So a week of practice in a row banks a freeze (two at most), and a
// missed day spends one automatically. Today never breaks anything: the day is
// not over until it is over.
//
// Simulated day by day from the first active day rather than counted backwards,
// because whether a freeze existed on a given missed day depends on everything
// before it.

export type Streak = {
  current: number;
  best: number;
  freezes: number;
  activeToday: boolean;
  /** Days a freeze was spent on, so the calendar can mark them. */
  frozen: number[];
};

export const FREEZE_EVERY = 7;
export const FREEZE_MAX = 2;

/** `days` are local day numbers (progress.dayOf), in any order, duplicates fine. */
export function streakOf(days: number[], today: number): Streak {
  const set = new Set(days.filter((d) => d <= today));
  const empty: Streak = { current: 0, best: 0, freezes: 0, activeToday: false, frozen: [] };
  if (set.size === 0) return empty;

  let run = 0;
  let best = 0;
  let consecutive = 0;
  let freezes = 0;
  const frozen: number[] = [];

  for (let d = Math.min(...set); d <= today; d++) {
    if (set.has(d)) {
      run++;
      consecutive++;
      best = Math.max(best, run);
      if (consecutive % FREEZE_EVERY === 0 && freezes < FREEZE_MAX) freezes++;
      continue;
    }
    if (d === today) break;
    consecutive = 0;
    if (run > 0 && freezes > 0) {
      freezes--;
      frozen.push(d);
    } else {
      run = 0;
    }
  }

  return { current: run, best, freezes, activeToday: set.has(today), frozen };
}
