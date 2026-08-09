// The recording surface, and the two states either side of it.
//
// Lifted out of the Arena when the fourth screen needed it. The aperture is the
// app's one piece of real motion — the bloom behind it is driven by live input
// level through the heat ramp, so the only thing on screen that moves is your
// own voice. That is the design rule the whole product is built on, and it is
// worth exactly one implementation.

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Display, Eyebrow, Meta, Screen, Masthead } from "./ui";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE, heat } from "../theme";

export function Aperture({
  level,
  seconds,
  ceilingS,
  onStop,
  hint,
}: {
  level: number;
  seconds: number;
  ceilingS: number;
  onStop: () => void;
  hint?: string;
}) {
  const over = seconds > ceilingS;
  return (
    <View style={s.center}>
      <View style={s.apertureWrap}>
        <View
          style={[
            s.bloom,
            {
              backgroundColor: heat(level),
              opacity: 0.08 + level * 0.5,
              transform: [{ scale: 0.8 + level * 1.1 }],
            },
          ]}
        />
        <Pressable onPress={onStop} style={s.aperture} hitSlop={20}>
          <View style={s.stopCore} />
        </Pressable>
      </View>

      <Text style={[s.clock, over && { color: SEMANTIC.flaw }]}>
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </Text>
      <Eyebrow>{over ? "OVER — LAND IT" : (hint ?? "TAP TO FINISH")}</Eyebrow>
    </View>
  );
}

export function Working({ right, step }: { right: string; step: string }) {
  return (
    <Screen scroll={false}>
      <Masthead right={right} />
      <View style={s.center}>
        <ActivityIndicator color={SEMANTIC.ember} />
        <Eyebrow style={{ marginTop: SPACE.md }}>{step.toUpperCase()}</Eyebrow>
        <Meta style={s.centerText}>
          Delivery is counted here on the phone. Only the words go out.
        </Meta>
      </View>
    </Screen>
  );
}

export function Failed({
  right,
  error,
  onRetry,
  onBack,
}: {
  right: string;
  error: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <Screen>
      <Masthead right={right} />
      <Eyebrow>THAT DIDN&rsquo;T WORK</Eyebrow>
      <Display>{error}</Display>
      <Button label="TRY AGAIN" onPress={onRetry} />
      <Button label="BACK TO TODAY" tone="ghost" onPress={onBack} />
    </Screen>
  );
}

/** A 0–4 score as a heat-tinted bar. The only chart primitive in the app. */
export function ScoreBar({ label, hint, score }: { label: string; hint?: string; score: number }) {
  const t = Math.max(0, Math.min(1, score / 4));
  return (
    <View style={s.barRow}>
      <View style={s.barHead}>
        <Text style={s.barLabel}>{label}</Text>
        <Text style={[s.barValue, { color: heat(t) }]}>{score.toFixed(1)}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${t * 100}%`, backgroundColor: heat(t) }]} />
      </View>
      {hint ? <Text style={s.barHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  centerText: { textAlign: "center", maxWidth: 260, marginTop: SPACE.xs },

  apertureWrap: { alignItems: "center", justifyContent: "center", height: 240, width: 240 },
  bloom: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  aperture: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    alignItems: "center",
    justifyContent: "center",
  },
  stopCore: { width: 30, height: 30, borderRadius: 10, backgroundColor: SEMANTIC.flaw },
  clock: { color: CHROME.chalk, fontSize: 34, fontFamily: TYPE.display, ...TABULAR },

  barRow: { gap: 5 },
  barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  barLabel: { color: CHROME.chalk, fontSize: 13, fontFamily: TYPE.uiMedium },
  barValue: { fontSize: 13, fontFamily: TYPE.uiSemi, ...TABULAR },
  barTrack: { height: 2, backgroundColor: CHROME.carve },
  barFill: { height: 2 },
  barHint: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },
});
