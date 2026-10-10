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
  gameRuns: number;
  blitzCorrect: number;
  bombBest: number;
  pauseClean: number;
  gauntletCleared: number;
  focusBest: number;
  aliveBest: number;
  spanBest: number;
  nbackBest: number;
  chainBest: number;
  memoryDone: number;
  memoryCleared: number;
  memoryFullDays: number;
};

export type BadgeIcon =
  | "mic"
  | "mic-vocal"
  | "medal"
  | "waveform"
  | "gem"
  | "sword"
  | "flame"
  | "zap"
  | "mountain"
  | "book"
  | "feather"
  | "library"
  | "knight"
  | "door"
  | "wind"
  | "rocket"
  | "crown"
  | "gamepad"
  | "timer"
  | "bomb"
  | "pause"
  | "shield"
  | "sparkles"
  | "brain"
  | "grid"
  | "list-ordered"
  | "radio";

export type Badge = {
  id: string;
  name: string;
  how: string;
  icon: BadgeIcon;
  earned: (f: LifetimeFacts) => boolean;
};

export const BADGES: Badge[] = [
  { id: "first-words", name: "First Words", how: "Record your first Arena take", icon: "mic", earned: (f) => f.arenaTakes >= 1 },
  { id: "regular", name: "Regular", how: "Ten Arena takes", icon: "mic-vocal", earned: (f) => f.arenaTakes >= 10 },
  { id: "veteran", name: "Mic Veteran", how: "Fifty Arena takes", icon: "medal", earned: (f) => f.arenaTakes >= 50 },
  { id: "smooth", name: "Smooth Operator", how: "A full minute under 5 fillers a minute", icon: "waveform", earned: (f) => f.bestFiller !== null && f.bestFiller < 5 },
  { id: "clean-minute", name: "Clean Minute", how: "A full minute with no fillers at all", icon: "gem", earned: (f) => f.bestFiller === 0 },
  { id: "sharp", name: "Sharp", how: "Score 16/20 or more on substance", icon: "sword", earned: (f) => f.rubricBest !== null && f.rubricBest >= 16 },
  { id: "warming-up", name: "Warming Up", how: "A 3-day streak", icon: "flame", earned: (f) => f.streakBest >= 3 },
  { id: "on-fire", name: "On Fire", how: "A 7-day streak", icon: "zap", earned: (f) => f.streakBest >= 7 },
  { id: "unstoppable", name: "Unstoppable", how: "A 30-day streak", icon: "mountain", earned: (f) => f.streakBest >= 30 },
  { id: "bookworm", name: "Bookworm", how: "Read five sections aloud", icon: "book", earned: (f) => f.readings >= 5 },
  { id: "wordsmith", name: "Wordsmith", how: "Own five words in production", icon: "feather", earned: (f) => f.wordsOwned >= 5 },
  { id: "lexicographer", name: "Lexicographer", how: "Own twenty-five words", icon: "library", earned: (f) => f.wordsOwned >= 25 },
  { id: "tactician", name: "Tactician", how: "Five Playbook or Lab drills", icon: "knight", earned: (f) => f.drills >= 5 },
  { id: "in-the-room", name: "In the Room", how: "Debrief a real meeting", icon: "door", earned: (f) => f.debriefs >= 1 },
  { id: "open-throat", name: "Open Throat", how: "Hold the whole Valve ladder clean", icon: "wind", earned: (f) => f.valveClean >= 1 },
  { id: "player-one", name: "Player One", how: "Play your first game", icon: "gamepad", earned: (f) => f.gameRuns >= 1 },
  { id: "blitz-master", name: "Blitz Master", how: "Twenty right in one Lexicon Blitz", icon: "timer", earned: (f) => f.blitzCorrect >= 20 },
  { id: "bomb-squad", name: "Bomb Squad", how: "Defuse all five bombs in one round", icon: "bomb", earned: (f) => f.bombBest >= 5 },
  { id: "golden-silence", name: "Golden Silence", how: "Ten clean pauses in one round of Pause, Don't Um", icon: "pause", earned: (f) => f.pauseClean >= 10 },
  { id: "iron-focus", name: "Iron Focus", how: "Clear every round of the Gauntlet", icon: "shield", earned: (f) => f.gauntletCleared >= 6 },
  { id: "human", name: "Human After All", how: "Score 90 or more in Bring It to Life", icon: "sparkles", earned: (f) => f.aliveBest >= 90 },
  { id: "pattern-keeper", name: "Pattern Keeper", how: "Clear level 7 of Pip Says", icon: "grid", earned: (f) => f.spanBest >= 7 },
  { id: "echo-chamber", name: "Echo Chamber", how: "Clear 3-back in Echo", icon: "radio", earned: (f) => f.nbackBest >= 5 },
  { id: "total-recall", name: "Total Recall", how: "Clear level 8 of Word Chain", icon: "list-ordered", earned: (f) => f.chainBest >= 8 },
  { id: "mind-gym", name: "Mind Gym", how: "Finish the Memory Gym workout on seven days", icon: "brain", earned: (f) => f.memoryFullDays >= 7 },
  { id: "rising", name: "Rising", how: "Reach level 5", icon: "rocket", earned: (f) => f.level >= 5 },
  { id: "speaker", name: "Speaker", how: "Reach level 10", icon: "crown", earned: (f) => f.level >= 10 },
];

export const BADGES_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export function newlyEarned(facts: LifetimeFacts, have: Set<string>): Badge[] {
  return BADGES.filter((b) => !have.has(b.id) && b.earned(facts));
}
