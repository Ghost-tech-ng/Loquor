// The recording surface, and the two states either side of it, shared by the
// Arena, Rooms, Lab and Playbook.
//
// While you talk the orb listens: its mouth and swell follow your live level,
// so the only thing on screen that moves is your own voice. Tapping it stops.

import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE, alpha } from "../../theme";
import { Ignition } from "./Boot";
import { Glass } from "./Glass";
import { GlowButton } from "./GlowButton";
import { Glyph } from "./Glyph";
import { PressableScale } from "./motion";
import { Masthead, Screen } from "./Screen";
import { Display, Eyebrow, Meta } from "./Text";
import { VoiceOrb } from "./VoiceOrb";

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
  const voice = useSharedValue(0);
  useEffect(() => {
    voice.value = withTiming(level, { duration: 100 });
  }, [level, voice]);

  return (
    <View style={s.center}>
      <PressableScale onPress={onStop} style={s.orb} accessibilityLabel="Finish the take">
        <VoiceOrb size={156} level={voice} mood="listening" />
      </PressableScale>

      <PressableScale onPress={onStop} style={[s.stop, over && s.stopOver]}>
        <View style={s.stopCore} />
        <Text style={[s.clock, over && { color: SEMANTIC.flaw }]}>
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
        </Text>
      </PressableScale>
      <Eyebrow>{over ? "OVER — LAND IT" : (hint ?? "TAP TO FINISH")}</Eyebrow>
    </View>
  );
}

export function Working({ right, step }: { right: string; step: string }) {
  return (
    <Screen scroll={false}>
      <Masthead right={right} />
      <View style={s.center}>
        <VoiceOrb size={96} />
        <Ignition scale={0.8} />
        <Eyebrow style={{ marginTop: SPACE.xs }}>{step.toUpperCase()}</Eyebrow>
        <Meta style={s.centerText}>Delivery is counted here on the phone. Only the words go out.</Meta>
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
      <Glass glow={SEMANTIC.flaw}>
        <View style={s.failHead}>
          <View style={s.failIcon}>
            <Glyph name="x" size={16} color={SEMANTIC.flaw} strokeWidth={2.4} />
          </View>
          <Eyebrow style={{ color: SEMANTIC.flaw }}>THAT DIDN&rsquo;T WORK</Eyebrow>
        </View>
        <Display style={s.failText}>{error}</Display>
      </Glass>
      <GlowButton label="Try again" icon="replay" onPress={onRetry} />
      <GlowButton label="Back" tone="ghost" onPress={onBack} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.md },
  centerText: { textAlign: "center", maxWidth: 260 },

  orb: { padding: 24 },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(20, 26, 38, 0.74)",
    borderWidth: 1,
    borderColor: alpha(SEMANTIC.flaw, 0.45),
  },
  stopOver: { backgroundColor: alpha(SEMANTIC.flaw, 0.16), borderColor: SEMANTIC.flaw },
  stopCore: { width: 14, height: 14, borderRadius: 4, backgroundColor: SEMANTIC.flaw },
  clock: { color: CHROME.chalk, fontSize: 24, fontFamily: TYPE.monoMedium, ...TABULAR },

  failHead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm },
  failIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(SEMANTIC.flaw, 0.16),
  },
  failText: { fontSize: 22, lineHeight: 29 },
});
