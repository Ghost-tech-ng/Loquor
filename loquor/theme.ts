// Speek design tokens — Aurora Night.
//
// The old rule was "chrome is colourless, colour is data", and it produced an
// honest instrument nobody wanted to open. The ground is still dark so a
// measurement can still glow, but the chrome now has a light of its own: a slow
// aurora behind everything, glass in front of it, and a gradient on anything you
// are meant to press. Data keeps its own ramp (HEAT) so a filler rate never
// borrows a colour that means "tap me".
//
// The export names are the old ones on purpose. Every screen reads CHROME,
// SURFACE and TYPE, so remapping the values here re-skins the whole app at once.

export const AURORA = {
  violet: "#7C5CFF",
  teal: "#2EE6C5",
  coral: "#FF7A6B",
  gold: "#FFC857",
  pink: "#FF5FA2",
  sky: "#5CC8FF",
} as const;

export const CHROME = {
  floor: "#0B0A1A",     // night indigo
  strata: "#141230",    // recessed panels and inputs
  raised: "#1D1A40",    // the tab bar and sheets
  carve: "#2B2758",     // hairlines
  chalk: "#F4F1FF",     // primary text
  dust: "#A7A3C7",      // secondary text
  dustDim: "#6E6A91",   // labels
} as const;

// Vocal energy, silence → peak. Still the ramp every live meter samples, now
// drawn from the aurora so the meters belong to the same sky as the chrome.
export const HEAT = [
  "#1E2266",
  "#4B3FD1",
  "#9B5CFF",
  "#FF5FA2",
  "#FF9A5C",
  "#FFE3A3",
] as const;

export const SEMANTIC = {
  ember: AURORA.coral, // live, recording
  flaw: AURORA.pink,   // filler markers, hedges, over-threshold
  solid: AURORA.teal,  // owned, mastered, cleared
  xp: AURORA.gold,
} as const;

/** Gradient stops, as tuples so they drop straight into LinearGradient. */
export const GRADIENT = {
  primary: [AURORA.violet, AURORA.pink] as const,
  cool: [AURORA.violet, AURORA.teal] as const,
  warm: [AURORA.coral, AURORA.gold] as const,
  flame: ["#FF5A36", "#FF9A3C", AURORA.gold] as const,
  xp: [AURORA.gold, "#FF9A3C"] as const,
  good: [AURORA.teal, AURORA.sky] as const,
  brand: [AURORA.violet, AURORA.teal, AURORA.coral] as const,
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

/** Glass: translucent so it sits on the aurora. */
export const SURFACE = {
  sunk: "rgba(255, 255, 255, 0.055)",
  edge: "rgba(255, 255, 255, 0.10)",
  edgeLive: "rgba(255, 255, 255, 0.18)",
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
