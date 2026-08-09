// The boot screen.
//
// Fonts, the database migration and the first read all have to finish before
// anything can be drawn, and until now that window was a bare aubergine
// rectangle — indistinguishable, for the second or two it lasts, from an app
// that has hung.
//
// What it draws is the heat ramp igniting left to right: the same six colours
// the strata wall and the record aperture use, in the same order. "Sound is the
// only source of light" (PRD §12), so the one moment the app has nothing to
// show is the one moment it shows the light source itself.
//
// No spinner. A spinner is the same animation in every app ever made, and this
// is the first thing seen on every launch.

import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { CHROME, HEAT } from "../theme";

export function Boot({ label }: { label?: string }) {
  // One driver for the whole sequence. Each bar reads a different slice of it,
  // so the ignition is a single interpolation rather than six timers that can
  // drift apart.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <View style={s.root}>
      <View style={s.center}>
        <View style={s.ramp}>
          {HEAT.map((colour, i) => {
            const start = i / HEAT.length;
            return (
              <Animated.View
                key={colour}
                style={[
                  s.bar,
                  {
                    backgroundColor: colour,
                    opacity: t.interpolate({
                      inputRange: [start, Math.min(1, start + 0.45), 1],
                      outputRange: [0.12, 1, 0.5],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        scaleY: t.interpolate({
                          inputRange: [start, Math.min(1, start + 0.45), 1],
                          outputRange: [0.3, 1, 0.65],
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

        <Text style={s.wordmark}>LOQVOR</Text>
        <Text style={s.credo}>I speak.</Text>
      </View>

      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.floor, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: 14 },

  ramp: { flexDirection: "row", alignItems: "center", gap: 5, height: 40 },
  bar: { width: 3, height: 34, borderRadius: 1 },

  // Geist, not Fraunces: the boot screen paints before useFonts resolves, so
  // anything set in a custom face would render in the system font and then jump.
  wordmark: { color: CHROME.chalk, fontSize: 13, letterSpacing: 7, marginTop: 6 },
  credo: { color: CHROME.dust, fontSize: 12, letterSpacing: 0.5, fontStyle: "italic" },

  label: { position: "absolute", bottom: 56, color: CHROME.dustDim, fontSize: 10, letterSpacing: 2.4 },
});
