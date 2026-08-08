// Loquor design tokens. See PRD.md §12.
//
// The governing rule: chrome is colourless, colour is data. Nothing in this file
// outside HEAT should be used to decorate — if a colour appears on screen and
// isn't encoding a measurement, it comes from CHROME.

export const CHROME = {
  floor: "#150F1C",     // page ground — aubergine, the spectrogram's silence
  strata: "#1E1628",    // recessed panels and inputs
  carve: "#2E2338",     // 1px hairlines — the only separator in the app
  chalk: "#F0E9E4",     // primary text and mastery — warm limestone, never #FFF
  dust: "#8B7F94",      // secondary text — violet-biased grey
  dustDim: "#5F566B",   // tertiary, labels
} as const;

// Vocal energy, silence → peak. Sampled for every accent in the product.
export const HEAT = [
  "#3B2A6B",
  "#8B2F8F",
  "#D1436B",
  "#F5793B",
  "#FFC96B",
  "#FFF3D4",
] as const;

export const SEMANTIC = {
  ember: HEAT[3],   // live, recording, primary action
  flaw: "#FF4D6D",  // filler markers, hedges, over-threshold
} as const;

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

// Fraunces carries the voice — a serif with genuine wonk, set large for topics
// and figures. Geist does the work: neutral, tight, legible at 11px labels.
// Readouts use Geist with tabular figures rather than a third face, so a number
// that changes between sessions does not also change width.
export const TYPE = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_400Regular_Italic",
  ui: "Geist_400Regular",
  uiMedium: "Geist_500Medium",
  uiSemi: "Geist_600SemiBold",
} as const;

/** Applied to any run of digits that sits in a column or updates in place. */
export const TABULAR = { fontVariant: ["tabular-nums" as const] };

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;
