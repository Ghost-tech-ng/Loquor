// Data visuals: a take laid out in time, the wall of past sessions, the rail a
// measurement sits on, and the 0–4 rubric pips.
//
// Heat is flaw throughout. A clean take reads mint; one full of fillers burns
// coral. Dead air is drawn as an absence — the band stops — because a pause is
// not a thing you did, it is a thing that failed to happen.

import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AURORA, CHROME, GRADIENT, SEMANTIC, TABULAR, TYPE, alpha, heat } from "../../theme";
import { FILLER_TARGET_PER_MIN } from "../../lib/metrics.ts";

const STRAIN_STOPS: [number, number, number][] = [
  [0x7c, 0xf2, 0xb8],
  [0xff, 0xc2, 0x4b],
  [0xff, 0x6b, 0x6b],
];

/** Mint → amber → coral. `t` is 0 (clean) to 1 (bad). */
export function strain(t: number): string {
  const c = Math.min(1, Math.max(0, t)) * (STRAIN_STOPS.length - 1);
  const i = Math.min(STRAIN_STOPS.length - 2, Math.floor(c));
  const f = c - i;
  const a = STRAIN_STOPS[i]!;
  const b = STRAIN_STOPS[i + 1]!;
  const mix = a.map((v, k) => Math.round(v + (b[k]! - v) * f));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Filler rate mapped onto strain. 0/min is pristine; 15/min is saturated. */
export function fillerStrain(rate: number): number {
  return rate / 15;
}

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
      <LinearGradient
        colors={[alpha(AURORA.emerald, 0.55), alpha(AURORA.cyan, 0.45)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={v.band}
      />
      {deadAirSpans.map(([a, b], i) => (
        <View
          key={`void-${i}`}
          style={[v.void_, { left: `${a * 100}%`, width: `${Math.max(0.4, b - a) * 100}%` }]}
        />
      ))}
      {fillerMarks.map((m, i) => (
        <View key={`fleck-${i}`} style={[v.fleck, { left: `${m * 100}%` }]}>
          <View style={v.fleckDot} />
        </View>
      ))}
    </View>
  );
}

/**
 * One column per past session, oldest at the left. Deliberately not a line
 * chart: a line invites reading noise as trend.
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
                height: Math.max(3, (r / ceiling) * height),
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
 * A measurement with its target band. The marker shows position, never a grade:
 * a pace of 172 is not a failure, it is fast, and you decide what that means for
 * the room you were in.
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
  const colour = tint ?? CHROME.chalk;
  return (
    <View style={v.rail}>
      <View style={v.railHead}>
        <Text style={v.railLabel}>{label}</Text>
        <View style={v.railValue}>
          {approximate ? <Text style={v.approx}>≈</Text> : null}
          <Text style={[v.railNumber, { color: colour }]}>{value}</Text>
          {unit ? <Text style={v.railUnit}>{unit}</Text> : null}
        </View>
      </View>
      <View style={v.track}>
        <View style={v.trackBand} />
        <View
          style={[
            v.marker,
            {
              left: `${Math.min(99, Math.max(0, position * 100))}%`,
              backgroundColor: colour,
              shadowColor: colour,
            },
          ]}
        />
      </View>
      <Text style={v.railBand}>{bandLabel}</Text>
    </View>
  );
}

/** A 0–4 rubric dimension as four pips. */
export function Score({ label, score }: { label: string; score: number }) {
  return (
    <View style={v.scoreRow}>
      <Text style={v.scoreLabel}>{label}</Text>
      <View style={v.pips}>
        {[0, 1, 2, 3].map((i) =>
          i < score ? (
            <LinearGradient
              key={i}
              colors={GRADIENT.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={v.pip}
            />
          ) : (
            <View key={i} style={[v.pip, v.pipOff]} />
          )
        )}
      </View>
      <Text style={v.scoreNum}>{score}</Text>
    </View>
  );
}

/** A 0–4 score as a heat-tinted bar, with an optional line on what it measures. */
export function ScoreBar({ label, hint, score }: { label: string; hint?: string; score: number }) {
  const t = Math.max(0, Math.min(1, score / 4));
  return (
    <View style={v.barRow}>
      <View style={v.barHead}>
        <Text style={v.barLabel}>{label}</Text>
        <Text style={[v.barValue, { color: heat(t) }]}>{score.toFixed(1)}</Text>
      </View>
      <View style={v.barTrack}>
        <View style={[v.barFill, { width: `${t * 100}%`, backgroundColor: heat(t) }]} />
      </View>
      {hint ? <Text style={v.barHint}>{hint}</Text> : null}
    </View>
  );
}

const v = StyleSheet.create({
  timeline: { justifyContent: "center", overflow: "hidden", borderRadius: 8 },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 12,
    top: "50%",
    marginTop: -6,
    borderRadius: 6,
  },
  void_: { position: "absolute", top: 0, bottom: 0, backgroundColor: "rgba(11, 15, 23, 0.92)" },
  fleck: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: SEMANTIC.flaw,
    alignItems: "center",
  },
  fleckDot: {
    position: "absolute",
    top: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SEMANTIC.flaw,
  },

  wall: { justifyContent: "flex-end" },
  wallRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  stratum: { flex: 1, minWidth: 3, borderRadius: 3 },
  target: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: alpha(AURORA.mint, 0.35),
  },
  wallEmpty: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui },

  rail: { gap: 8 },
  railHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  railLabel: { color: CHROME.dust, fontSize: 10.5, letterSpacing: 1.8, fontFamily: TYPE.uiBold },
  railValue: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  approx: { color: CHROME.dustDim, fontSize: 15, fontFamily: TYPE.ui },
  railNumber: { fontSize: 19, fontFamily: TYPE.monoMedium, ...TABULAR },
  railUnit: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },
  track: { height: 6, borderRadius: 3, backgroundColor: CHROME.strata, justifyContent: "center" },
  trackBand: {
    position: "absolute",
    left: "30%",
    right: "30%",
    height: 6,
    borderRadius: 3,
    backgroundColor: alpha(AURORA.emerald, 0.28),
  },
  marker: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: CHROME.floor,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  railBand: { color: CHROME.dustDim, fontSize: 11.5, lineHeight: 16, fontFamily: TYPE.ui },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scoreLabel: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.ui, width: 92 },
  pips: { flexDirection: "row", gap: 4, flex: 1 },
  pip: { flex: 1, height: 6, borderRadius: 3 },
  pipOff: { backgroundColor: CHROME.carve },
  scoreNum: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.mono, ...TABULAR },

  barRow: { gap: 6 },
  barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  barLabel: { color: CHROME.chalk, fontSize: 13.5, fontFamily: TYPE.uiMedium },
  barValue: { fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: CHROME.carve, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barHint: { color: CHROME.dustDim, fontSize: 11.5, lineHeight: 16, fontFamily: TYPE.ui },
});
