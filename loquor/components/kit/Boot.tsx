// The boot screen, and the app's one "working" animation.
//
// Fonts, the database migration and the first read all have to finish before
// anything can be drawn. That second is the first thing seen on every launch,
// so it is the logo arriving: the orb drops in on a spring, blinks at you, and
// the wordmark rises one letter at a time.
//
// No spinner. A spinner is the same animation in every app ever made.

import { useEffect, useRef } from "react";
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AURORA, CHROME, HEAT, alpha } from "../../theme";
import { VoiceOrb } from "./VoiceOrb";

const WORDMARK = ["S", "p", "e", "e", "k"];

/**
 * The ignition sweep: the heat ramp lighting left to right. The Arena, Reading,
 * Lexicon and Onboarding use it while they wait on a transcript.
 */
export function Ignition({ scale = 1 }: { scale?: number }) {
  // One driver. Each bar reads a different slice of it, so the sweep is a
  // single interpolation rather than six timers that can drift.
  const t = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(t, {
          toValue: 1,
          duration: 900,
          easing: RNEasing.out(RNEasing.cubic),
          useNativeDriver: true,
        }),
        RNAnimated.timing(t, {
          toValue: 0,
          duration: 700,
          easing: RNEasing.in(RNEasing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <View style={[s.ramp, { height: 40 * scale }]}>
      {HEAT.map((colour, i) => {
        const start = i / HEAT.length;
        const range = [start, Math.min(1, start + 0.45), 1];
        return (
          <RNAnimated.View
            key={colour}
            style={[
              s.bar,
              {
                height: 34 * scale,
                backgroundColor: colour,
                opacity: t.interpolate({
                  inputRange: range,
                  outputRange: [0.12, 1, 0.5],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    scaleY: t.interpolate({
                      inputRange: range,
                      outputRange: [0.28, 1, 0.62],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function Boot({ exiting = false }: { exiting?: boolean }) {
  const drop = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    drop.value = withDelay(80, withSpring(1, { damping: 9, stiffness: 140, mass: 0.8 }));
  }, [drop]);

  useEffect(() => {
    if (exiting) out.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) });
  }, [exiting, out]);

  const orb = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 2),
    transform: [{ translateY: (1 - drop.value) * -60 }, { scale: 0.5 + drop.value * 0.5 }],
  }));
  const fade = useAnimatedStyle(() => ({
    opacity: out.value,
    transform: [{ scale: 1 + (1 - out.value) * 0.06 }],
  }));

  return (
    <Animated.View style={[s.root, fade]}>
      <LinearGradient
        colors={[alpha(AURORA.emerald, 0.35), "rgba(0,0,0,0)", alpha(AURORA.mint, 0.14)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={orb}>
        <VoiceOrb size={132} />
      </Animated.View>

      {/* System font on purpose: this paints before useFonts resolves. */}
      <View style={s.word}>
        {WORDMARK.map((ch, i) => (
          <Animated.Text
            key={`${ch}-${i}`}
            entering={FadeInUp.delay(380 + i * 70).springify().damping(12)}
            style={s.letter}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
      <Animated.Text entering={FadeInUp.delay(820).duration(500)} style={s.credo}>
        say it like you mean it
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: CHROME.floor,
    alignItems: "center",
    justifyContent: "center",
  },

  ramp: { flexDirection: "row", alignItems: "center", gap: 5, height: 40 },
  bar: { width: 3, height: 34, borderRadius: 1.5 },

  word: { flexDirection: "row", marginTop: 22 },
  letter: { color: CHROME.chalk, fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  credo: { color: CHROME.dust, fontSize: 14, fontStyle: "italic", marginTop: 6, letterSpacing: 0.4 },
});
