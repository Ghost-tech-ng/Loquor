// XP, derived from the record rather than kept in a ledger.
//
// Every number here is recomputed from history on demand. A ledger would need
// a backfill for the months of practice that predate it, and then would need
// to agree with that history forever — through restores, resets and deleted
// rows. Deriving it means it cannot disagree, and the backup carries it for free.

export const XP = {
  take: 50,
  /** Extra on a take, scaled by how clean it was. */
  takeCleanMax: 30,
  rewrite: 25,
  reading: 20,
  lexiconRep: 5,
  drill: 35,
  debrief: 60,
  valve: 30,
  badge: 25,
} as const;

// The bonus is full at 2 fillers a minute and gone by 8. Below 2 is past the
// point a listener can tell the difference, so paying more there would reward
// the transcriber's mood, not the speaker.
const CLEAN_FULL = 2;
const CLEAN_NONE = 8;

export function takeXp(fillerRate: number, isRewrite: boolean): number {
  if (isRewrite) return XP.rewrite;
  const t = (CLEAN_NONE - fillerRate) / (CLEAN_NONE - CLEAN_FULL);
  const clean = Math.min(1, Math.max(0, t));
  return XP.take + Math.round(XP.takeCleanMax * clean);
}

export type Ledger = {
  sessions: { filler_rate: number; is_rewrite: number }[];
  takes: number;
  lexiconReps: number;
  drills: number;
  debriefs: number;
  valveRuns: number;
  gameXp: number;
  questXp: number;
  badges: number;
};

export function totalXp(l: Ledger): number {
  let xp = 0;
  for (const s of l.sessions) xp += takeXp(s.filler_rate, s.is_rewrite === 1);
  xp += l.takes * XP.reading;
  xp += l.lexiconReps * XP.lexiconRep;
  xp += l.drills * XP.drill;
  xp += l.debriefs * XP.debrief;
  xp += l.valveRuns * XP.valve;
  xp += l.gameXp + l.questXp;
  xp += l.badges * XP.badge;
  return xp;
}

export type GameId = "blitz" | "bomb" | "pause" | "gauntlet" | "alive" | "span" | "nback" | "chain";

// Each game's score lives on its own scale (points, defuses, seconds), so XP
// maps each to roughly what a good run of the equivalent drill is worth. The
// caps stop a farmed game from out-earning real practice.
export function gameXp(game: GameId, score: number): number {
  const s = Math.max(0, score);
  switch (game) {
    case "blitz":
      return Math.min(80, Math.round(s / 40));
    case "bomb":
      return Math.min(75, Math.round(s) * 15);
    case "pause":
      return Math.min(80, Math.round(s / 125) * 8);
    case "gauntlet":
      return Math.min(80, Math.round(s / 4));
    case "alive":
      return Math.min(70, 20 + Math.round(s / 2));
    // Memory Gym scores are the level cleared, 0 for a miss. A miss still pays
    // a little: showing up is the habit being built, and the level it failed
    // at is where the training happens.
    case "span":
    case "nback":
    case "chain":
      return s > 0 ? Math.min(70, 20 + Math.round(s) * 5) : 10;
  }
}
