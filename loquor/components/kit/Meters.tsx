// Progress you can watch fill: the XP bar and the ring.

import { useEffect, useId, useState, type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { GRADIENT, RADIUS, SPRING } from "../../theme";

type BoxStyle = ViewProps["style"];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A pill that springs to `progress` and shimmers while it is not full. */
export function XPBar({
  progress,
  height = 12,
  colors = GRADIENT.xp,
  delay = 0,
  style,
}: {
  progress: number;
  height?: number;
  colors?: readonly [string, string, ...string[]];
  delay?: number;
  style?: BoxStyle;
}) {
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(delay, withSpring(clamp01(progress), SPRING.gentle));
  }, [progress, delay, fill]);

  useEffect(() => {
    shine.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(1200, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }))
      ),
      -1
    );
  }, [shine]);

  const bar = useAnimatedStyle(() => ({ width: Math.max(height, fill.value * width) }));
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 + shine.value * (fill.value * width + 40) }],
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[s.track, { height, borderRadius: RADIUS.pill }, style]}
    >
      <Animated.View style={[s.fill, { borderRadius: RADIUS.pill }, bar]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[s.shine, sweep]}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A gradient ring that sweeps to `progress`, with anything in the middle. */
export function ProgressRing({
  progress,
  size = 72,
  stroke = 7,
  colors = GRADIENT.cool,
  children,
  style,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  colors?: readonly [string, string, ...string[]];
  children?: ReactNode;
  style?: BoxStyle;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    p.value = withSpring(clamp01(progress), SPRING.gentle);
  }, [progress, p]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));

  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {colors.map((col, i) => (
              <Stop key={col + i} offset={i / Math.max(1, colors.length - 1)} stopColor={col} />
            ))}
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  track: { backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill: { height: "100%", overflow: "hidden" },
  shine: { position: "absolute", top: 0, bottom: 0, width: 40 },
});
