// Speek design tokens — Midnight & Forest.
//
// A stage at night: a deep navy room, forest green on the things you press,
// ivory type and gold for anything you earn. The aurora still drifts behind
// everything, but in quiet colours — a green lamp, a little sage and
// terracotta — so the screen glows rather than flashes. Data keeps its own
// ramp (HEAT) so a filler rate never borrows the colour that means "tap me".
//
// The export names are the old ones on purpose. Every screen reads CHROME,
// SURFACE and TYPE, so remapping the values here re-skins the whole app at once.

export const AURORA = {
  forest: "#4E9C6E",     // primary: buttons, the active tab, the one thing to press
  sage: "#6FB7A4",       // good, cleared, owned
  terracotta: "#E07A5F", // alert: fillers, hedges, over the line
  gold: "#EFC984",       // XP and badges — warm against the green, so a reward reads as a reward
  plum: "#A0708F",       // a quiet counterweight in gradients and the sky
  steel: "#7FA3C2",      // cool accents: freezes, info
} as const;

export const CHROME = {
  floor: "#0B0F17",     // near-black navy
  strata: "#10151F",    // recessed panels and inputs
  raised: "#141A26",    // cards, the tab bar and sheets
  carve: "#252D3B",     // hairlines
  chalk: "#F2EEE6",     // primary text, ivory
  dust: "#ABA69A",      // secondary text
  dustDim: "#726E66",   // labels
  ink: "#141008",       // text on a light fill (gold, terracotta, mint)
} as const;

// Vocal energy, silence → peak: a cold dial warming to a hot lamp.
export const HEAT = [
  "#18233A",
  "#2F4C6B",
  "#4F8E86",
  "#D9A85B",
  "#E07A5F",
  "#F6E2B6",
] as const;

export const SEMANTIC = {
  ember: AURORA.forest,     // live, recording, the active choice
  flaw: AURORA.terracotta,  // filler markers, hedges, over-threshold
  solid: AURORA.sage,       // owned, mastered, cleared
  xp: AURORA.gold,
} as const;

/** Gradient stops, as tuples so they drop straight into LinearGradient. */
export const GRADIENT = {
  primary: ["#46966A", "#25603F"] as const,
  cool: [AURORA.steel, AURORA.sage] as const,
  warm: [AURORA.terracotta, AURORA.gold] as const,
  flame: ["#D9583A", "#E8964A", AURORA.gold] as const,
  xp: [AURORA.gold, "#C9963F"] as const,
  good: ["#86C7B5", "#4F9886"] as const,
  brand: [AURORA.forest, AURORA.gold, AURORA.terracotta] as const,
};

// Interpolate the heat ramp. `t` clamps to 0..1.
export function heat(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (HEAT.length - 1);
  const i = Math.floor(scaled);
  if (i >= HEAT.length - 1) return HEAT[HEAT.length - 1]!;

  const f = scaled - i;
  const a = hexToRgb(HEAT[i]!);
  const b = hexToRgb(HEAT[i + 1]!);

  const mix = (x: number, y: number) => Math.round(x + (y - x) * f);
  return rgbToHex(mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2]));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Any hex colour at an alpha, for glows and tints. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Translucent chalk, for scrims and pressed states. */
export function chalkA(a: number): string {
  return alpha(CHROME.chalk, a);
}

// Three voices.
//
// Fraunces is the reading face — a soft, old-style serif with ink traps and a
// little wobble, so headings feel spoken rather than printed and long passages
// are something you want to keep reading. Outfit does the UI: round, friendly,
// geometric, legible small. Space Mono holds every number and timer, because a
// score that changes width as it counts is a score you stop trusting.
export const TYPE = {
  display: "Fraunces_800ExtraBold",
  displaySoft: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_400Regular_Italic",
  passage: "Fraunces_400Regular",
  ui: "Outfit_400Regular",
  uiMedium: "Outfit_500Medium",
  uiSemi: "Outfit_600SemiBold",
  uiBold: "Outfit_700Bold",
  mono: "SpaceMono_400Regular",
  monoMedium: "SpaceMono_700Bold",
} as const;

/** Applied to any run of digits that sits in a column or updates in place. */
export const TABULAR = { fontVariant: ["tabular-nums" as const] };

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

export const RADIUS = {
  /** Rows, slots, inline fields. */
  soft: 14,
  /** Cards. */
  panel: 24,
  /** The floating tab bar. */
  bar: 30,
  pill: 999,
} as const;

/** Glass: slate cards, translucent enough to sit on the sky. */
export const SURFACE = {
  sunk: "rgba(242, 238, 230, 0.05)",
  edge: "rgba(242, 238, 230, 0.10)",
  edgeLive: "rgba(242, 238, 230, 0.18)",
} as const;

/** Clearance under every scrolling screen so the floating bar never covers the
 *  last line of content. */
export const TAB_CLEARANCE = 128;

export const MOTION = {
  tap: 110,
  enter: 420,
  stagger: 60,
  ambient: 1600,
} as const;

/** Spring presets for Reanimated's withSpring. */
export const SPRING = {
  snappy: { damping: 18, stiffness: 320, mass: 0.7 },
  bouncy: { damping: 9, stiffness: 180, mass: 0.8 },
  gentle: { damping: 20, stiffness: 90, mass: 1 },
} as const;
