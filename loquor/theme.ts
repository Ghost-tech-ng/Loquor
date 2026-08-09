// Loquor design tokens. See PRD.md §12.
//
// The governing rule: chrome is colourless, colour is data. Nothing in this file
// outside HEAT should be used to decorate — if a colour appears on screen and
// isn't encoding a measurement, it comes from CHROME.
//
// The ground moved from aubergine to petrol ink. The aubergine was a colour, and
// a coloured ground competes with the only thing on screen allowed to be
// coloured: the measurements. Ink at the bottom of a well is close enough to
// black to disappear, and it makes the heat ramp read as the light source it is
// meant to be. The residual blue-green bias is what keeps it from looking like a
// terminal.

export const CHROME = {
  floor: "#070C0F",     // page ground — petrol ink, effectively the dark
  strata: "#0E161A",    // recessed panels and inputs
  raised: "#141F25",    // the floating tab bar, and only the tab bar
  carve: "#1E2C33",     // 1px hairlines — the only separator in the app
  chalk: "#EDF3F2",     // primary text and mastery — cool limestone, never #FFF
  dust: "#7C9199",      // secondary text — petrol-biased grey
  dustDim: "#4C5C63",   // tertiary, labels
} as const;

// Vocal energy, silence → peak. Sampled for every accent in the product.
// Dark and cold at rest, white-hot at the top, so a loud moment genuinely looks
// like one. Rooted in blue rather than violet now that the ground is petrol —
// a violet base against an aubergine floor was the reason neither read as light.
export const HEAT = [
  "#0F3550",
  "#2F4A8C",
  "#8B3E8F",
  "#E0553F",
  "#FFA23C",
  "#FFEBC6",
] as const;

export const SEMANTIC = {
  ember: HEAT[3],   // live, recording, primary action
  flaw: "#FF4F6B",  // filler markers, hedges, over-threshold
  solid: "#33BCA3", // owned, mastered, cleared — the only cool signal
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

/** Translucent chalk, for scrims and pressed states. */
export function chalkA(alpha: number): string {
  return `rgba(237, 243, 242, ${alpha})`;
}

// Three voices, deliberately unrelated to each other.
//
// Bricolage Grotesque speaks. It is a grotesk with the proportions slightly
// wrong on purpose — tight apertures, a flat-sided g, terminals that do not
// match — which is exactly the register for a headline in an app about not
// sounding like everybody else. Set large; it is not a body face.
//
// Instrument Serif Italic is the aside. High contrast, very fast, and it does
// the one job a grotesk cannot: sounding like a human voice rather than a label.
//
// Schibsted Grotesk does the work — a Norwegian newspaper face built for small
// sizes on screen, which is the entire body copy of this app.
//
// Martian Mono holds every number and every label. Monospace is not a style
// choice here: a filler rate that changes between sessions must not also change
// width, and a readout that jitters is a readout you stop trusting.
export const TYPE = {
  display: "BricolageGrotesque_700Bold",
  displaySoft: "BricolageGrotesque_600SemiBold",
  displayItalic: "InstrumentSerif_400Regular_Italic",
  ui: "SchibstedGrotesk_400Regular",
  uiMedium: "SchibstedGrotesk_500Medium",
  uiSemi: "SchibstedGrotesk_600SemiBold",
  mono: "MartianMono_400Regular",
  monoMedium: "MartianMono_500Medium",
} as const;

/** Applied to any run of digits that sits in a column or updates in place. */
export const TABULAR = { fontVariant: ["tabular-nums" as const] };

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

/** Clearance under every scrolling screen so the floating bar never covers the
 *  last line of content. The bar is 62 tall and sits 22 off the safe area. */
export const TAB_CLEARANCE = 118;

/** One timing vocabulary, so nothing in the app moves at a speed of its own. */
export const MOTION = {
  /** Press feedback. Must be under a frame budget you can feel. */
  tap: 110,
  /** Content arriving. */
  enter: 380,
  /** Stagger between siblings in an arriving group. */
  stagger: 55,
  /** Ambient loops — breathing, pulsing, the boot ramp. */
  ambient: 1600,
} as const;
