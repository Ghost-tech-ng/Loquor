// How much hand-holding the Arena primer gives.
//
// Plain explanations get a newcomer talking, but they are also the opposite of
// what the Arena trains: a speaker who reaches for the precise word. So the
// support fades as takes pile up — the richer primer moves to the front, and the
// plain version moves behind a tap and then disappears into a single hint. The
// count alone would fade it on someone who is struggling, so weak recent
// judgements hold the level back one step.

export type Scaffold = 0 | 1 | 2 | 3;

export const SCAFFOLD_NAMES = ["GUIDED", "BRIDGED", "STRETCHED", "FLUENT"] as const;

/** Takes needed to reach each level. */
export const SCAFFOLD_AT = [0, 5, 15, 30] as const;

/** Mean rubric total (out of 20) under which the level eases back one step. */
export const STRUGGLING_BELOW = 9;

export function scaffoldLevel(takes: number, recentTotals: readonly (number | null)[]): Scaffold {
  let level = 0;
  for (let i = SCAFFOLD_AT.length - 1; i >= 0; i--) {
    if (takes >= SCAFFOLD_AT[i]!) {
      level = i;
      break;
    }
  }
  const scored = recentTotals.filter((n): n is number => typeof n === "number").slice(0, 3);
  if (level > 0 && scored.length === 3) {
    const mean = scored.reduce((a, b) => a + b, 0) / scored.length;
    if (mean < STRUGGLING_BELOW) level -= 1;
  }
  return level as Scaffold;
}

/** Takes until the next level, or null at the top. */
export function takesToNext(takes: number, level: Scaffold): number | null {
  const next = SCAFFOLD_AT[level + 1];
  return next === undefined ? null : Math.max(0, next - takes);
}
