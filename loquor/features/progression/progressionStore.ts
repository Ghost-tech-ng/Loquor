// The progression store: reads the record, and settles what it has earned.
//
// `snapshot` is a pure read for screens. `settle` is the one place that writes:
// it claims finished quests, awards crossed badges and compares the total with
// the last total the user was shown, so the reward sheet can count up the gap.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  awardBadge,
  claimQuest,
  dayFacts,
  earnedBadges,
  lexiconStats,
  lifetimeFacts,
  pendingDebriefs,
  questClaims,
  recentSessions,
  streakTimes,
  xpLedger,
} from "../../lib/db";
import { dayOf, dayStartMs } from "../progress/progress";
import { BADGES_BY_ID, newlyEarned, type Badge } from "./badges";
import { levelOf, type LevelInfo } from "./levels";
import { pickQuests, questStates, type Quest, type QuestState } from "./quests";
import { streakOf, type Streak } from "./streak";
import { totalXp } from "./xp";

/** Flipped when the Play games land; until then their quests stay out of the pool. */
export const GAMES_LIVE = false;

const SEEN_XP_KEY = "speek.seenXp";
const questsKey = (day: number) => `speek.quests.${day}`;

export type EarnedBadge = { badge: Badge; at: number };

export type Progress = {
  xp: number;
  level: LevelInfo;
  streak: Streak;
  quests: QuestState[];
  badges: EarnedBadge[];
};

export type Reward = {
  from: number;
  to: number;
  levelFrom: LevelInfo;
  levelTo: LevelInfo;
  quests: Quest[];
  badges: Badge[];
  /** First settle ever: the XP is the history that predates progression. */
  welcome: boolean;
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The worst case is the same reward shown twice or the day's quests redrawn.
  }
}

/** The day's quest ids, drawn once and then kept so they do not move under you. */
async function todaysQuestIds(day: number): Promise<string[]> {
  const kept = await readJson<string[]>(questsKey(day));
  if (kept && kept.length > 0) return kept;
  const [lex, last, debriefs] = await Promise.all([
    lexiconStats(),
    recentSessions(1),
    pendingDebriefs(),
  ]);
  const ids = pickQuests(day, {
    lexDue: lex.dueNow,
    lastFiller: last[0]?.filler_rate ?? null,
    gamesAvailable: GAMES_LIVE,
    debriefsPending: debriefs.length > 0,
  });
  await writeJson(questsKey(day), ids);
  return ids;
}

async function questsToday(day: number): Promise<QuestState[]> {
  const [ids, facts, claims] = await Promise.all([
    todaysQuestIds(day),
    dayFacts(dayStartMs(day), dayStartMs(day + 1)),
    questClaims(day),
  ]);
  return questStates(ids, facts, new Set(claims.map((c) => c.quest_id)));
}

export async function snapshot(now = Date.now()): Promise<Progress> {
  const today = dayOf(now);
  const [ledger, times, quests, earned] = await Promise.all([
    xpLedger(),
    streakTimes(),
    questsToday(today),
    earnedBadges(),
  ]);
  const xp = totalXp(ledger);
  const badges: EarnedBadge[] = [];
  for (const e of earned) {
    const badge = BADGES_BY_ID.get(e.badge);
    if (badge) badges.push({ badge, at: e.at });
  }
  return {
    xp,
    level: levelOf(xp),
    streak: streakOf(times.map(dayOf), today),
    quests,
    badges,
  };
}

/** Claim, award, and report what changed since the user last looked. Null when nothing did. */
export async function settle(now = Date.now()): Promise<Reward | null> {
  const today = dayOf(now);

  const claimed: Quest[] = [];
  for (const q of await questsToday(today)) {
    if (q.done && !q.claimed) {
      await claimQuest(today, q.quest.id, q.quest.xp);
      claimed.push(q.quest);
    }
  }

  const [facts, times, earned] = await Promise.all([lifetimeFacts(), streakTimes(), earnedBadges()]);
  const have = new Set(earned.map((e) => e.badge));
  const streakBest = streakOf(times.map(dayOf), today).best;

  // Badges pay XP, which can lift the level past a level badge's line, so award
  // until nothing new crosses. Level badges are the only ones that can chain.
  const awarded: Badge[] = [];
  let xp = totalXp(await xpLedger());
  for (let pass = 0; pass < 3; pass++) {
    const fresh = newlyEarned({ ...facts, streakBest, level: levelOf(xp).level }, have);
    if (fresh.length === 0) break;
    for (const b of fresh) {
      await awardBadge(b.id);
      have.add(b.id);
      awarded.push(b);
    }
    xp = totalXp(await xpLedger());
  }

  const seen = await readJson<number>(SEEN_XP_KEY);
  await writeJson(SEEN_XP_KEY, xp);
  const from = seen ?? 0;
  if (xp <= from && claimed.length === 0 && awarded.length === 0) return null;
  // A restore or reset can drop the total below what was seen; say nothing then.
  if (xp < from) return null;

  return {
    from,
    to: xp,
    levelFrom: levelOf(from),
    levelTo: levelOf(xp),
    quests: claimed,
    badges: awarded,
    welcome: seen === null,
  };
}

// ── Celebrate ────────────────────────────────────────────────────────────────
// Screens call celebrate() after anything that might have earned something; the
// RewardHost at the root listens and shows the sheet. One settle at a time, so
// a focus event and a save landing together cannot both claim the same quest.

type Listener = (r: Reward) => void;
const listeners = new Set<Listener>();
let inFlight: Promise<Reward | null> | null = null;

export function onReward(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * `holdMs` settles now but shows the sheet later — for a screen that is about
 * to draw itself, so the sheet arrives over still content rather than over a
 * layout that is still moving.
 */
export function celebrate({ holdMs = 0 }: { holdMs?: number } = {}): Promise<Reward | null> {
  if (inFlight) return inFlight;
  inFlight = settle()
    .then((r) => {
      if (r) {
        const show = () => {
          for (const fn of listeners) fn(r);
        };
        if (holdMs > 0) setTimeout(show, holdMs);
        else show();
      }
      return r;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
