// The Speek orb: the logo, alive.
//
// The bubble is static SVG; the face is laid over it as views positioned in the
// logo's own 100-unit space, so the eyes can blink and the mouth bars can move
// with a voice without redrawing the path. It breathes when idle, bounces when
// happy, and its mouth follows `level` (0..1) when it is listening to you.

import { useEffect } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { CHROME, SPRING } from "../../theme";
import { Halo } from "./Halo";

type BoxStyle = ViewProps["style"];

const BUBBLE =
  "M50 12 C71 12 86 26 86 45 C86 64 71 78 50 78 C45 78 40.5 77.2 36.4 75.6 L22 86 L25.6 70.2 C18.4 64 14 55.2 14 45 C14 26 29 12 50 12 Z";

// x, resting height, and how much of the voice each bar takes — the middle one
// moves most, like a mouth rather than an equaliser.
const BARS = [
  { x: 34.6, y: 48.6, h: 5.2, gain: 0.6 },
  { x: 41.2, y: 51.2, h: 6.8, gain: 0.85 },
  { x: 48.1, y: 52.4, h: 7.6, gain: 1 },
  { x: 55, y: 51.2, h: 6.8, gain: 0.85 },
  { x: 61.6, y: 48.6, h: 5.2, gain: 0.6 },
];

export type OrbMood = "idle" | "happy" | "listening";

function Bar({
  bar,
  i,
  unit,
  level,
  mood,
}: {
  bar: (typeof BARS)[number];
  i: number;
  unit: number;
  level?: SharedValue<number>;
  mood: OrbMood;
}) {
  const idle = useSharedValue(0);

  useEffect(() => {
    if (mood === "listening") return;
    idle.value = withDelay(
      i * 90,
      withRepeat(
        withTiming(1, { duration: mood === "happy" ? 260 : 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
  }, [mood, i, idle]);

  const style = useAnimatedStyle(() => {
    const voice = level ? level.value : 0;
    const lift =
      mood === "listening"
        ? 1 + voice * 2.4 * bar.gain
        : mood === "happy"
          ? 1 + idle.value * 0.9 * bar.gain
          : 1 + idle.value * 0.18 * bar.gain;
    return { transform: [{ scaleY: lift }] };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: bar.x * unit,
          top: bar.y * unit,
          width: 3.8 * unit,
          height: bar.h * unit,
          borderRadius: 1.9 * unit,
          backgroundColor: CHROME.floor,
        },
        style,
      ]}
    />
  );
}

function Eye({ cx, unit, mood }: { cx: number; unit: number; mood: OrbMood }) {
  const blink = useSharedValue(1);

  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withDelay(2600 + Math.random() * 1800, withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 110 })
      ),
      -1
    );
  }, [blink]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const w = 8.8 * unit;
  const h = (mood === "happy" ? 5.6 : 12.4) * unit;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: (cx - 4.4) * unit,
          top: (mood === "happy" ? 35 : 31.8) * unit,
          width: w,
          height: h,
          borderRadius: w,
          backgroundColor: CHROME.floor,
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: 4.3 * unit,
          top: mood === "happy" ? 0.6 * unit : 2.2 * unit,
          width: 3.2 * unit,
          height: 3.2 * unit,
          borderRadius: 1.6 * unit,
          backgroundColor: "#FFFFFF",
        }}
      />
    </Animated.View>
  );
}

export function VoiceOrb({
  size = 96,
  mood = "idle",
  level,
  glow = true,
  style,
}: {
  size?: number;
  mood?: OrbMood;
  level?: SharedValue<number>;
  glow?: boolean;
  style?: BoxStyle;
}) {
  const unit = size / 100;
  const breathe = useSharedValue(0);
  const hop = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breathe]);

  useEffect(() => {
    if (mood !== "happy") {
      hop.value = withSpring(0, SPRING.gentle);
      return;
    }
    hop.value = withRepeat(
      withSequence(withSpring(1, SPRING.bouncy), withTiming(0, { duration: 320 })),
      3
    );
  }, [mood, hop]);

  const body = useAnimatedStyle(() => {
    const voice = level ? level.value : 0;
    const s = 1 + breathe.value * 0.035 + voice * 0.08;
    return {
      transform: [{ translateY: -hop.value * size * 0.12 }, { scale: s }, { rotate: `${hop.value * -6}deg` }],
    };
  });

  return (
    <Animated.View
      style={[{ width: size, height: size }, body, style]}
    >
      {glow ? <Halo color="#4E9C6E" opacity={0.4} spread={size * 0.22} style={{ top: -size * 0.16, bottom: -size * 0.28 }} /> : null}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="orbFill" x1="14" y1="12" x2="86" y2="90" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#8FD1A6" />
            <Stop offset="0.55" stopColor="#4E9C6E" />
            <Stop offset="1" stopColor="#2A6845" />
          </LinearGradient>
          <RadialGradient id="orbGloss" cx="36" cy="28" r="30" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={BUBBLE} fill="url(#orbFill)" />
        <Path d={BUBBLE} fill="url(#orbGloss)" />
      </Svg>
      <Eye cx={39.5} unit={unit} mood={mood} />
      <Eye cx={60.5} unit={unit} mood={mood} />
      {BARS.map((b, i) => (
        <Bar key={b.x} bar={b} i={i} unit={unit} level={level} mood={mood} />
      ))}
    </Animated.View>
  );
}
