// Data visuals.
//
// No charting library and no canvas — Expo Go rules out Skia, and everything
// here is a rectangle anyway. That constraint is doing the design a favour: the
// language is strata, flecks, and voids, which is what a spectrogram already is.
//
// The governing inversion (PRD §12): light is clarity, heat is flaw. A clean
// take reads as pale limestone; a take full of fillers glows.

import { StyleSheet, Text, View } from "react-native";

import { CHROME, SEMANTIC, TABULAR, TYPE } from "../theme";
import { FILLER_TARGET_PER_MIN } from "../lib/metrics.ts";

/** Chalk → flaw. `t` is 0 (clean) to 1 (bad). */
export function strain(t: number): string {
  const c = Math.min(1, Math.max(0, t));
  const from = [0xed, 0xf3, 0xf2];
  const to = [0xff, 0x4f, 0x6b];
  const mix = from.map((v, i) => Math.round(v + (to[i]! - v) * c));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Filler rate mapped onto strain. 0/min is pristine; 15/min is saturated. */
export function fillerStrain(rate: number): number {
  return rate / 15;
}

/**
 * One take, laid out in time. Dead air is drawn as an absence rather than a
 * colour — the band simply stops — because a pause is not a thing you did, it
 * is a thing that failed to happen.
 */
export function Timeline({
  fillerMarks,
  deadAirSpans,
  height = 44,
}: {
  fillerMarks: number[];
  deadAirSpans: [number, number][];
  height?: number;
}) {
  return (
    <View style={[v.timeline, { height }]}>
      <View style={v.band} />
      {deadAirSpans.map(([a, b], i) => (
        <View
          key={`void-${i}`}
          style={[v.void_, { left: `${a * 100}%`, width: `${Math.max(0.4, b - a) * 100}%` }]}
        />
      ))}
      {fillerMarks.map((m, i) => (
        <View key={`fleck-${i}`} style={[v.fleck, { left: `${m * 100}%` }]} />
      ))}
    </View>
  );
}

/**
 * The strata wall: one column per past session, oldest at the left. This is the
 * only place in the app where progress is visible as a shape rather than a
 * number, and it is deliberately not a line chart — a line invites reading noise
 * as trend.
 */
export function StrataWall({ rates, height = 92 }: { rates: number[]; height?: number }) {
  if (rates.length === 0) {
    return (
      <View style={[v.wall, { height }]}>
        <Text style={v.wallEmpty}>Sessions accumulate here.</Text>
      </View>
    );
  }

  const ceiling = Math.max(FILLER_TARGET_PER_MIN * 2, ...rates);

  return (
    <View style={[v.wall, { height }]}>
      <View style={[v.target, { bottom: (FILLER_TARGET_PER_MIN / ceiling) * height }]} />
      <View style={v.wallRow}>
        {rates.map((r, i) => (
          <View
            key={i}
            style={[
              v.stratum,
              {
                height: Math.max(2, (r / ceiling) * height),
                backgroundColor: strain(fillerStrain(r)),
                opacity: 0.35 + (0.65 * (i + 1)) / rates.length,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A measurement with its target band. The marker shows position, never a grade —
 * pace of 172 is not a failure, it is fast, and the user decides what that means
 * for the room they were in.
 */
export function Rail({
  label,
  value,
  unit,
  position,
  bandLabel,
  tint,
  approximate,
}: {
  label: string;
  value: string;
  unit?: string;
  position: number;
  bandLabel: string;
  tint?: string;
  approximate?: boolean;
}) {
  return (
    <View style={v.rail}>
      <View style={v.railHead}>
        <Text style={v.railLabel}>{label}</Text>
        <View style={v.railValue}>
          {approximate ? <Text style={v.approx}>≈</Text> : null}
          <Text style={[v.railNumber, tint ? { color: tint } : null]}>{value}</Text>
          {unit ? <Text style={v.railUnit}>{unit}</Text> : null}
        </View>
      </View>
      <View style={v.track}>
        <View style={v.trackBand} />
        <View
          style={[
            v.marker,
            { left: `${Math.min(99, Math.max(0, position * 100))}%` },
            tint ? { backgroundColor: tint } : null,
          ]}
        />
      </View>
      <Text style={v.railBand}>{bandLabel}</Text>
    </View>
  );
}

/** 0–4 rubric dimension. Filled cells are chalk; the rest are carve. */
export function Score({ label, score }: { label: string; score: number }) {
  return (
    <View style={v.scoreRow}>
      <Text style={v.scoreLabel}>{label}</Text>
      <View style={v.pips}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[v.pip, i < score && v.pipOn]} />
        ))}
      </View>
      <Text style={v.scoreNum}>{score}</Text>
    </View>
  );
}

const v = StyleSheet.create({
  timeline: { justifyContent: "center", overflow: "hidden" },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 10,
    top: "50%",
    marginTop: -5,
    backgroundColor: CHROME.carve,
  },
  void_: { position: "absolute", top: 0, bottom: 0, backgroundColor: CHROME.floor },
  fleck: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: SEMANTIC.flaw,
  },

  wall: { justifyContent: "flex-end" },
  wallRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  stratum: { flex: 1, minWidth: 2 },
  target: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: CHROME.carve,
  },
  wallEmpty: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui },

  rail: { gap: 7 },
  railHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  railLabel: { color: CHROME.dustDim, fontSize: 10, letterSpacing: 2.2, fontFamily: TYPE.uiMedium },
  railValue: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  approx: { color: CHROME.dustDim, fontSize: 15, fontFamily: TYPE.ui },
  railNumber: { color: CHROME.chalk, fontSize: 19, fontFamily: TYPE.display, ...TABULAR },
  railUnit: { color: CHROME.dustDim, fontSize: 10, fontFamily: TYPE.ui },
  track: { height: 3, backgroundColor: CHROME.strata, justifyContent: "center" },
  trackBand: {
    position: "absolute",
    left: "30%",
    right: "30%",
    height: 3,
    backgroundColor: CHROME.carve,
  },
  marker: { position: "absolute", width: 2, height: 11, marginLeft: -1, backgroundColor: CHROME.chalk },
  railBand: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scoreLabel: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.ui, width: 92 },
  pips: { flexDirection: "row", gap: 4, flex: 1 },
  pip: { flex: 1, height: 3, backgroundColor: CHROME.carve },
  pipOn: { backgroundColor: CHROME.chalk },
  scoreNum: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui, ...TABULAR },
});
