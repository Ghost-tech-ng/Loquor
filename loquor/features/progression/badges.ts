// Badges. Each is a lifetime fact crossing a line, checked after any activity;
// once earned it is stored and never re-evaluated, so a later reset of the
// thing that earned it does not take it back.

export type LifetimeFacts = {
  arenaTakes: number;
  /** Best filler rate over a take of at least a minute. */
  bestFiller: number | null;
  readings: number;
  wordsOwned: number;
  drills: number;
  debriefs: number;
  valveRuns: number;
  valveClean: number;
  rubricBest: number | null;
  streakBest: number;
  level: number;
};

export type Badge = {
  id: string;
  name: string;
  how: string;
  emoji: string;
  earned: (f: LifetimeFacts) => boolean;
};

export const BADGES: Badge[] = [
  { id: "first-words", name: "First Words", how: "Record your first Arena take", emoji: "🎤", earned: (f) => f.arenaTakes >= 1 },
  { id: "regular", name: "Regular", how: "Ten Arena takes", emoji: "🎙️", earned: (f) => f.arenaTakes >= 10 },
  { id: "veteran", name: "Mic Veteran", how: "Fifty Arena takes", emoji: "🏟️", earned: (f) => f.arenaTakes >= 50 },
  { id: "smooth", name: "Smooth Operator", how: "A full minute under 5 fillers a minute", emoji: "🧈", earned: (f) => f.bestFiller !== null && f.bestFiller < 5 },
  { id: "clean-minute", name: "Clean Minute", how: "A full minute with no fillers at all", emoji: "💎", earned: (f) => f.bestFiller === 0 },
  { id: "sharp", name: "Sharp", how: "Score 16/20 or more on substance", emoji: "🗡️", earned: (f) => f.rubricBest !== null && f.rubricBest >= 16 },
  { id: "warming-up", name: "Warming Up", how: "A 3-day streak", emoji: "🔥", earned: (f) => f.streakBest >= 3 },
  { id: "on-fire", name: "On Fire", how: "A 7-day streak", emoji: "☄️", earned: (f) => f.streakBest >= 7 },
  { id: "unstoppable", name: "Unstoppable", how: "A 30-day streak", emoji: "🌋", earned: (f) => f.streakBest >= 30 },
  { id: "bookworm", name: "Bookworm", how: "Read five sections aloud", emoji: "📖", earned: (f) => f.readings >= 5 },
  { id: "wordsmith", name: "Wordsmith", how: "Own five words in production", emoji: "🪶", earned: (f) => f.wordsOwned >= 5 },
  { id: "lexicographer", name: "Lexicographer", how: "Own twenty-five words", emoji: "📚", earned: (f) => f.wordsOwned >= 25 },
  { id: "tactician", name: "Tactician", how: "Five Playbook or Lab drills", emoji: "♟️", earned: (f) => f.drills >= 5 },
  { id: "in-the-room", name: "In the Room", how: "Debrief a real meeting", emoji: "🚪", earned: (f) => f.debriefs >= 1 },
  { id: "open-throat", name: "Open Throat", how: "Hold the whole Valve ladder clean", emoji: "🌬️", earned: (f) => f.valveClean >= 1 },
  { id: "rising", name: "Rising", how: "Reach level 5", emoji: "🚀", earned: (f) => f.level >= 5 },
  { id: "speaker", name: "Speaker", how: "Reach level 10", emoji: "👑", earned: (f) => f.level >= 10 },
];

export const BADGES_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export function newlyEarned(facts: LifetimeFacts, have: Set<string>): Badge[] {
  return BADGES.filter((b) => !have.has(b.id) && b.earned(facts));
}
