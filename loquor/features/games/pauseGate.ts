// Pause, Don't Um — the state machine.
//
// The habit it trains: when you need a second to think, go quiet instead of
// filling the gap. So the game asks for silence at moments you did not choose,
// mid-thought, and scores whether you can stop cleanly, hold it, and pick the
// thread back up.
//
// Everything runs off the mic level alone, because that is the only signal that
// exists live. A gate is clean when you drop under the quiet line within the
// reaction window, hold under it, and come back above the talk line in time.
// Pure and clock-driven: the screen feeds it ticks, tests feed it scripts.

export type GatePhase = "calibrate" | "talk" | "gate" | "hold" | "resume" | "done";

export type GateOutcome = "clean" | "talked-through" | "broke-hold" | "stalled" | "dead-air";

export type GateEvent = { at: number; outcome: GateOutcome; points: number; combo: number };

export type GateState = {
  phase: GatePhase;
  /** Milliseconds since the game started. */
  now: number;
  phaseAt: number;
  calib: number[];
  quietDb: number;
  talkDb: number;
  /** When the next gate opens, once talking. */
  nextGateAt: number;
  holdMs: number;
  quietSince: number | null;
  lastVoiceAt: number;
  combo: number;
  bestCombo: number;
  score: number;
  clean: number;
  gates: number;
  events: GateEvent[];
  seed: number;
};

export const GATE = {
  calibrateMs: 3000,
  lengthMs: 90_000,
  reactMs: 1500,
  resumeMs: 2000,
  gapMin: 6000,
  gapMax: 12000,
  holdMin: 700,
  holdMax: 1500,
  /** Silence this long while you are meant to be talking is dead air. */
  deadAirMs: 2500,
} as const;

// mulberry32: deterministic, so a test can replay a whole game.
function rand(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (seed + 0x6d2b79f5) >>> 0];
}

export function startGate(seed: number): GateState {
  return {
    phase: "calibrate",
    now: 0,
    phaseAt: 0,
    calib: [],
    quietDb: -45,
    talkDb: -30,
    nextGateAt: 0,
    holdMs: GATE.holdMin,
    quietSince: null,
    lastVoiceAt: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    clean: 0,
    gates: 0,
    events: [],
    seed,
  };
}

/** Points for a clean gate: grows with the combo, capped so one run cannot run away. */
export function gatePoints(combo: number): number {
  return 100 + 25 * Math.min(combo - 1, 8);
}

function scheduleNext(s: GateState, from: number): GateState {
  const [a, seed1] = rand(s.seed);
  const [b, seed2] = rand(seed1);
  return {
    ...s,
    seed: seed2,
    nextGateAt: from + GATE.gapMin + a * (GATE.gapMax - GATE.gapMin),
    holdMs: Math.round(GATE.holdMin + b * (GATE.holdMax - GATE.holdMin)),
  };
}

function settle(s: GateState, outcome: GateOutcome): GateState {
  const isClean = outcome === "clean";
  const combo = isClean ? s.combo + 1 : 0;
  const points = isClean ? gatePoints(combo) : 0;
  const counted = outcome !== "dead-air";
  return scheduleNext(
    {
      ...s,
      phase: "talk",
      phaseAt: s.now,
      quietSince: null,
      lastVoiceAt: s.now,
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      score: s.score + points,
      clean: s.clean + (isClean ? 1 : 0),
      gates: s.gates + (counted ? 1 : 0),
      events: [...s.events, { at: s.now, outcome, points, combo }],
    },
    s.now
  );
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : -160;
}

/** Advance to `now` with the current level in dBFS. */
export function tick(prev: GateState, now: number, db: number): GateState {
  let s: GateState = { ...prev, now };
  if (s.phase === "done") return s;
  if (now >= GATE.lengthMs + GATE.calibrateMs && s.phase !== "hold" && s.phase !== "resume" && s.phase !== "gate") {
    return { ...s, phase: "done", phaseAt: now };
  }

  if (s.phase === "calibrate") {
    s = { ...s, calib: [...s.calib, db] };
    if (now - s.phaseAt < GATE.calibrateMs) return s;
    // The room in the quietest fifth, your voice in the loudest.
    const sorted = [...s.calib].sort((a, b) => a - b);
    const floor = median(sorted.slice(0, Math.max(1, Math.floor(sorted.length / 5))));
    const voice = median(sorted.slice(Math.floor((sorted.length * 4) / 5)));
    const span = Math.max(8, voice - floor);
    return scheduleNext(
      {
        ...s,
        phase: "talk",
        phaseAt: now,
        quietDb: floor + span * 0.3,
        talkDb: floor + span * 0.55,
        lastVoiceAt: now,
      },
      now
    );
  }

  const quiet = db < s.quietDb;
  const talking = db >= s.talkDb;
  if (talking) s.lastVoiceAt = now;

  switch (s.phase) {
    case "talk":
      if (now - s.lastVoiceAt >= GATE.deadAirMs) return settle(s, "dead-air");
      if (now >= s.nextGateAt) return { ...s, phase: "gate", phaseAt: now, quietSince: null };
      return s;
    case "gate":
      if (quiet) return { ...s, phase: "hold", phaseAt: now, quietSince: now };
      if (now - s.phaseAt >= GATE.reactMs) return settle(s, "talked-through");
      return s;
    case "hold":
      if (talking) return settle(s, "broke-hold");
      if (now - s.phaseAt >= s.holdMs) return { ...s, phase: "resume", phaseAt: now };
      return s;
    case "resume":
      if (talking) return settle(s, "clean");
      if (now - s.phaseAt >= GATE.resumeMs) return settle(s, "stalled");
      return s;
    default:
      return s;
  }
}

/** 0..1 through the current countdown, for the ring on screen. */
export function phaseProgress(s: GateState): number {
  const elapsed = s.now - s.phaseAt;
  switch (s.phase) {
    case "calibrate":
      return elapsed / GATE.calibrateMs;
    case "gate":
      return elapsed / GATE.reactMs;
    case "hold":
      return elapsed / s.holdMs;
    case "resume":
      return elapsed / GATE.resumeMs;
    default:
      return 0;
  }
}
