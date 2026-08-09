// The boot screen.
//
// Fonts, the database migration and the first read all have to finish before
// anything can be drawn, and until now that window was a bare rectangle —
// indistinguishable, for the second or two it lasts, from an app that has hung.
//
// What it draws is the heat ramp igniting left to right: the same six colours
// the strata wall and the record aperture use, in the same order. "Sound is the
// only source of light" (PRD §12), so the one moment the app has nothing to
// show is the one moment it shows the light source itself. The wordmark then
// sets one letter at a time, left to right, at speaking pace.
//
// No spinner. A spinner is the same animation in every app ever made, and this
// is the first thing seen on every launch.

import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { CHROME, HEAT } from "../theme";

const WORDMARK = ["L", "O", "Q", "V", "O", "R"];

/**
 * The ignition sweep on its own. Also used as the Arena's working indicator,
 * because the app already has a "wait" animation and inventing a second one is
 * how a product starts feeling like two products.
 */
export function Ignition({ scale = 1 }: { scale?: number }) {
  // One driver. Each bar reads a different slice of it, so the sweep is a
  // single interpolation rather than six timers that can drift.
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
    <View style={[s.ramp, { height: 40 * scale }]}>
      {HEAT.map((colour, i) => {
        const start = i / HEAT.length;
        const range = [start, Math.min(1, start + 0.45), 1];
        return (
          <Animated.View
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
  // A one-shot for the wordmark, which sets once and stays.
  const set = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const type = Animated.timing(set, {
      toValue: 1,
      duration: 620,
      delay: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    type.start();
    return () => type.stop();
  }, [set]);

  useEffect(() => {
    if (!exiting) return;
    Animated.timing(out, {
      toValue: 0,
      duration: 260,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [exiting, out]);

  return (
    <Animated.View style={[s.root, { opacity: out }]}>
      <View style={s.center}>
        <Ignition />

        <View style={s.word}>
          {WORDMARK.map((ch, i) => {
            const start = i / (WORDMARK.length + 1);
            const range = [start, start + 1 / (WORDMARK.length + 1)];
            return (
              <Animated.Text
                key={`${ch}-${i}`}
                style={[
                  s.letter,
                  {
                    opacity: set.interpolate({
                      inputRange: range,
                      outputRange: [0, 1],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        translateY: set.interpolate({
                          inputRange: range,
                          outputRange: [5, 0],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  },
                ]}
              >
                {ch}
              </Animated.Text>
            );
          })}
        </View>

        <Animated.Text style={[s.credo, { opacity: set }]}>I speak.</Animated.Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CHROME.floor,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", gap: 15 },

  ramp: { flexDirection: "row", alignItems: "center", gap: 5, height: 40 },
  bar: { width: 3, height: 34, borderRadius: 1.5 },

  // No custom family: the boot screen paints before useFonts resolves, so
  // anything set in a loaded face would render in the system font and then jump.
  word: { flexDirection: "row", marginTop: 8 },
  letter: { color: CHROME.chalk, fontSize: 13, letterSpacing: 7, fontWeight: "500" },
  credo: { color: CHROME.dust, fontSize: 12, fontStyle: "italic" },
});
