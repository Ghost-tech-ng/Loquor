// The end of every game run: score it, save it, and let progression catch up.
//
// The best is read *before* the save, so "new best" means beating every
// earlier run rather than tying the one just written.

import { gameBest, saveGameScore } from "../../lib/db";
import { celebrate } from "../progression/progressionStore";
import { gameXp, type GameId } from "../progression/xp";

export type RunResult = {
  score: number;
  xp: number;
  /** The best before this run, or null for a first run. */
  previousBest: number | null;
  isBest: boolean;
};

function newId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function finishGame(game: GameId, score: number, meta?: unknown): Promise<RunResult> {
  const clean = Math.max(0, Math.round(score));
  const xp = gameXp(game, clean);
  let previousBest: number | null = null;
  try {
    previousBest = await gameBest(game);
    await saveGameScore({ id: newId(), game, score: clean, xp, meta });
  } catch {
    // A failed save loses the record, not the run: the result still shows.
    return { score: clean, xp: 0, previousBest, isBest: false };
  }
  // Held so the result card lands first and the reward sheet slides over it.
  void celebrate({ holdMs: 1400 });
  return { score: clean, xp, previousBest, isBest: clean > 0 && (previousBest === null || clean > previousBest) };
}

export async function bestOf(game: GameId): Promise<number | null> {
  try {
    return await gameBest(game);
  } catch {
    return null;
  }
}
