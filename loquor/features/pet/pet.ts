// Pip, the parrot that grows with you.
//
// Everything here is pure so it can be tested without a phone: which stage your
// level has earned, what mood your streak puts Pip in, where Pip wanders to
// next, and what Pip says. The host component only animates the answers.
//
// Pip never dies and never shrinks. Growth follows level, which only goes up;
// mood follows the streak, which can break, and a broken streak makes Pip
// sleepy rather than sick. A pet that punishes you is a pet you uninstall.

export type StageName = "egg" | "chick" | "fledgling" | "parrot" | "macaw";

export type Stage = {
  name: StageName;
  label: string;
  /** First level that reaches this stage. */
  minLevel: number;
  /** Side of the square Pip is drawn in, in points. */
  size: number;
  /** Fliers can perch on the screen edges; the rest stay on the ground. */
  flies: boolean;
};

export const STAGES: readonly [Stage, ...Stage[]] = [
  { name: "egg", label: "Egg", minLevel: 1, size: 34, flies: false },
  { name: "chick", label: "Chick", minLevel: 3, size: 40, flies: false },
  { name: "fledgling", label: "Fledgling", minLevel: 6, size: 46, flies: true },
  { name: "parrot", label: "Parrot", minLevel: 10, size: 54, flies: true },
  { name: "macaw", label: "Macaw", minLevel: 21, size: 64, flies: true },
];

export function stageOf(level: number): Stage {
  let found = STAGES[0];
  for (const s of STAGES) if (level >= s.minLevel) found = s;
  return found;
}

/** The stage after this level's, and the level it arrives at. Null at the top. */
export function nextStageOf(level: number): { stage: Stage; atLevel: number } | null {
  const next = STAGES.find((s) => s.minLevel > level);
  return next ? { stage: next, atLevel: next.minLevel } : null;
}

export type Mood = "happy" | "idle" | "sleepy";

/**
 * Happy once you have practised today. Sleepy when a streak you had is gone.
 * Anything else, including a brand-new user and a streak still alive but not
 * yet extended today, is idle: the day is not over until it is over.
 */
export function moodOf(streak: { current: number; best: number; activeToday: boolean }): Mood {
  if (streak.activeToday) return "happy";
  if (streak.current === 0 && streak.best > 0) return "sleepy";
  return "idle";
}

export type Perch = "ground" | "left" | "right";
export type Spot = { x: number; y: number; perch: Perch };

export type Bounds = {
  width: number;
  /** Top of the usable area (below the status bar). */
  top: number;
  /** The line Pip stands on: just above the tab bar. */
  ground: number;
};

const MARGIN = 12;
const MIN_STEP = 24;
const HOP_REACH = 150;
const EGG_REACH = 50;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Where Pip goes next. Mostly along the ground; a flier sometimes takes a side
 * perch instead, partly tucked off the edge so it covers as little as possible.
 * A sleepy Pip only shuffles along the ground.
 */
export function nextSpot(
  rng: () => number,
  bounds: Bounds,
  from: { x: number; y: number },
  stage: Stage,
  mood: Mood
): Spot {
  const size = stage.size;
  const groundY = bounds.ground - size;
  const sideLo = bounds.top + 90;
  const sideHi = groundY - 140;

  const canPerch = stage.flies && mood !== "sleepy" && sideHi > sideLo;
  if (canPerch && rng() < 0.4) {
    const left = rng() < 0.5;
    return {
      x: left ? -size * 0.12 : bounds.width - size * 0.88,
      y: sideLo + rng() * (sideHi - sideLo),
      perch: left ? "left" : "right",
    };
  }

  const lo = MARGIN;
  const hi = Math.max(lo, bounds.width - size - MARGIN);
  const reach = stage.name === "egg" ? EGG_REACH : stage.flies ? hi - lo : HOP_REACH;
  // Coming down off a side perch, start from the nearest point on the ground.
  const start = clamp(from.x, lo, hi);
  let dx = (rng() * 2 - 1) * reach;
  if (Math.abs(dx) < MIN_STEP) dx = dx < 0 ? -MIN_STEP : MIN_STEP;
  let x = start + dx;
  // Bounce off a wall rather than pinning to it, so Pip does not stick in a corner.
  if (x < lo || x > hi) x = start - dx;
  return { x: clamp(x, lo, hi), y: groundY, perch: "ground" };
}

/** How long Pip rests before moving again, in ms. */
export function restMs(rng: () => number, mood: Mood): number {
  if (mood === "sleepy") return 15000 + rng() * 10000;
  if (mood === "happy") return 3000 + rng() * 4000;
  return 4000 + rng() * 4000;
}

function pick<T>(rng: () => number, xs: readonly [T, ...T[]]): T {
  return xs[Math.floor(rng() * xs.length)] ?? xs[0];
}

const EGG_LINES: [string, ...string[]] = [
  "*tap tap* …still in here.",
  "Practise a bit and I'll hatch.",
  "It's warm in here. Keep talking.",
  "I can hear you. You sound great.",
];

const SLEEPY_LINES: [string, ...string[]] = [
  "Zzz… oh! You're back.",
  "I dozed off. Want to talk?",
  "One take and I'm wide awake.",
  "Yawn. Missed you yesterday.",
];

const HAPPY_LINES: [string, ...string[]] = [
  "Squawk! Good talk today.",
  "You said it, not um-said it.",
  "Pieces of eight! Er, pieces of great.",
  "Polly wants a pause. Nice ones.",
  "Look at you, all fluent.",
];

const IDLE_LINES: [string, ...string[]] = [
  "Squawk? Time for a take?",
  "Say something. I'll repeat it.",
  "No ums today, deal?",
  "I'm all ears. Well, feathers.",
];

/** What Pip says when tapped. */
export function petLine(
  rng: () => number,
  stage: Stage,
  mood: Mood,
  streak: number,
  level: number
): string {
  if (stage.name === "egg") {
    const next = nextStageOf(level);
    return rng() < 0.4 && next ? `I hatch at level ${next.atLevel}.` : pick(rng, EGG_LINES);
  }
  if (mood === "sleepy") return pick(rng, SLEEPY_LINES);
  if (mood === "happy" && streak >= 2 && rng() < 0.35) return `${streak}-day streak! Squawk!`;
  const next = nextStageOf(level);
  if (next && rng() < 0.2) return `Level ${next.atLevel} and I'm a ${next.stage.label.toLowerCase()}.`;
  return pick(rng, mood === "happy" ? HAPPY_LINES : IDLE_LINES);
}

const BACK_LINES: [string, ...string[]] = ["I'm back! How'd it go?", "Squawk! Did I miss anything?", "Nice one.", "Back again!"];

/** What Pip says on coming back after hiding for a take. */
export function backLine(rng: () => number, stage: Stage): string {
  return stage.name === "egg" ? "*wobble*" : pick(rng, BACK_LINES);
}

/** What Pip says on reaching a new stage. */
export function evolveLine(stage: Stage): string {
  if (stage.name === "chick") return "Pip hatched! Hi!";
  return `Pip grew into a ${stage.label}!`;
}

export type Chirp = "pip-peep" | "pip-chirp" | "pip-squawk";
export type Voice = { chirp: Chirp; pitch: number; rate: number };

/**
 * How Pip sounds at each stage. The phone's speech voice is pitched up to sound
 * like a bird, and comes down a little as Pip grows, so the macaw sounds like
 * the chick's older sibling rather than the same toy. iOS clamps pitch to 0.5–2.
 */
const VOICES: Record<StageName, Voice> = {
  egg: { chirp: "pip-peep", pitch: 2, rate: 0.85 },
  chick: { chirp: "pip-peep", pitch: 2, rate: 1.05 },
  fledgling: { chirp: "pip-chirp", pitch: 1.85, rate: 1.05 },
  parrot: { chirp: "pip-chirp", pitch: 1.7, rate: 1 },
  macaw: { chirp: "pip-squawk", pitch: 1.55, rate: 0.95 },
};

export function voiceOf(stage: Stage): Voice {
  return VOICES[stage.name];
}

/**
 * A bubble line as it should be read aloud. The bubble is written for eyes:
 * stage directions in asterisks, an ellipsis for a beat, "+12 XP". Read
 * literally those come out as "asterisk" and "ex-pee", so they are rewritten
 * into what Pip would actually say.
 */
export function spokenText(text: string): string {
  return text
    .replace(/\*/g, "")
    .replace(/…/g, ", ")
    .replace(/\+(\d+)/g, "plus $1")
    .replace(/\bXP\b/g, "X P")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/^[\s,.]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
