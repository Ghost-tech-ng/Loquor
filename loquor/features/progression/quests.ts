// Daily quests.
//
// Three a day, chosen once per day and then fixed — a quest list that reshuffles
// when you open the app again is a slot machine, not a plan. The first one aims
// at whatever is weakest right now; the other two rotate so the week covers the
// whole app rather than the one drill you already like.

export type DayFacts = {
  arenaTakes: number;
  bestFiller: number | null;
  readings: number;
  lexiconReviews: number;
  drills: number;
  valveRuns: number;
  debriefs: number;
  gameRuns: number;
};

export type Quest = {
  id: string;
  /** Quests in one family never share a day. */
  family: string;
  title: string;
  xp: number;
  goal: number;
  /** Where tapping the quest takes you. */
  route: string;
  value: (f: DayFacts) => number;
  /** Only offered when the feature behind it exists for this user. */
  needs?: "games" | "debrief";
};

const cleanUnder = (limit: number) => (f: DayFacts) =>
  f.bestFiller !== null && f.bestFiller < limit ? 1 : 0;

export const QUESTS: Quest[] = [
  { id: "arena-1", family: "arena", title: "Do one Arena take", xp: 50, goal: 1, route: "/stage", value: (f) => f.arenaTakes },
  { id: "arena-2", family: "arena", title: "Do two Arena takes", xp: 80, goal: 2, route: "/stage", value: (f) => f.arenaTakes },
  { id: "clean-5", family: "arena", title: "Land a take under 5 fillers a minute", xp: 80, goal: 1, route: "/stage", value: cleanUnder(5) },
  { id: "clean-3", family: "arena", title: "Land a take under 3 fillers a minute", xp: 100, goal: 1, route: "/stage", value: cleanUnder(3) },
  { id: "read-1", family: "read", title: "Read a section aloud", xp: 50, goal: 1, route: "/play", value: (f) => f.readings },
  { id: "read-2", family: "read", title: "Read two sections aloud", xp: 80, goal: 2, route: "/play", value: (f) => f.readings },
  { id: "lex-5", family: "lexicon", title: "Review 5 Lexicon words", xp: 40, goal: 5, route: "/lexicon", value: (f) => f.lexiconReviews },
  { id: "lex-10", family: "lexicon", title: "Review 10 Lexicon words", xp: 60, goal: 10, route: "/lexicon", value: (f) => f.lexiconReviews },
  { id: "drill-1", family: "drill", title: "Run a Playbook drill", xp: 60, goal: 1, route: "/playbook", value: (f) => f.drills },
  { id: "valve-1", family: "valve", title: "Climb the Valve ladder", xp: 50, goal: 1, route: "/valve", value: (f) => f.valveRuns },
  { id: "debrief-1", family: "rooms", title: "Debrief a room you were in", xp: 70, goal: 1, route: "/rooms", value: (f) => f.debriefs, needs: "debrief" },
  { id: "game-1", family: "games", title: "Play any game", xp: 40, goal: 1, route: "/play", value: (f) => f.gameRuns, needs: "games" },
  { id: "game-3", family: "games", title: "Play three games", xp: 70, goal: 3, route: "/play", value: (f) => f.gameRuns, needs: "games" },
];

export const QUESTS_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

export type QuestContext = {
  lexDue: number;
  /** Filler rate of the most recent take, if any. */
  lastFiller: number | null;
  gamesAvailable: boolean;
  debriefsPending: boolean;
};

/** Small deterministic PRNG so a day always draws the same quests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickQuests(day: number, ctx: QuestContext, count = 3): string[] {
  const offered = QUESTS.filter(
    (q) =>
      (q.needs !== "games" || ctx.gamesAvailable) && (q.needs !== "debrief" || ctx.debriefsPending)
  );

  const target =
    ctx.lexDue > 10
      ? "lex-10"
      : ctx.lastFiller !== null && ctx.lastFiller > 5
        ? "clean-5"
        : ctx.debriefsPending
          ? "debrief-1"
          : "arena-1";

  const picked: Quest[] = [QUESTS_BY_ID.get(target)!];
  const rand = mulberry32(day * 2654435761);
  const pool = offered.filter((q) => q.id !== target);
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(rand() * pool.length);
    const q = pool.splice(i, 1)[0]!;
    if (picked.some((p) => p.family === q.family)) continue;
    picked.push(q);
  }
  return picked.map((q) => q.id);
}

export type QuestState = {
  quest: Quest;
  value: number;
  done: boolean;
  claimed: boolean;
};

export function questStates(ids: string[], facts: DayFacts, claimed: Set<string>): QuestState[] {
  const out: QuestState[] = [];
  for (const id of ids) {
    const quest = QUESTS_BY_ID.get(id);
    if (!quest) continue;
    const value = Math.min(quest.goal, quest.value(facts));
    out.push({ quest, value, done: value >= quest.goal, claimed: claimed.has(id) });
  }
  return out;
}
