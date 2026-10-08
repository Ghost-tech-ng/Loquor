// Levels and ranks.
//
// The curve is quadratic but gentle: level 2 is two Arena takes away, level 10
// is a few weeks of most-days practice, and the top rank is a year. Early levels
// come fast on purpose — the first week is when a habit is decided.

/** Cumulative XP needed to reach level `n` (level 1 is free). */
export function xpForLevel(n: number): number {
  if (n <= 1) return 0;
  return 100 * (n - 1) + 20 * (n - 1) * (n - 2);
}

export const RANKS = [
  { from: 1, name: "Mumbler" },
  { from: 3, name: "Murmurer" },
  { from: 6, name: "Talker" },
  { from: 10, name: "Speaker" },
  { from: 15, name: "Storyteller" },
  { from: 21, name: "Orator" },
  { from: 28, name: "Silver Tongue" },
  { from: 36, name: "Legend" },
] as const;

export function rankOf(level: number): string {
  let name: string = RANKS[0].name;
  for (const r of RANKS) if (level >= r.from) name = r.name;
  return name;
}

export type LevelInfo = {
  level: number;
  rank: string;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  /** 0..1 through the current level. */
  progress: number;
};

export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  const span = xpForLevel(level + 1) - base;
  const into = xp - base;
  return { level, rank: rankOf(level), into, span, progress: into / span };
}
