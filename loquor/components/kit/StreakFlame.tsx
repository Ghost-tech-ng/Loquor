// The streak flame. It flickers while the streak is alive, burns hotter once
// today is done, and goes to grey ash at zero — the loss is meant to be visible.

import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Halo } from "./Halo";

const OUTER =
  "M12 1.5c.6 3.2 2.6 5 4.4 6.9 1.9 2 3.6 4.2 3.6 7.6A8 8 0 0 1 4 16c0-2.6 1-4.6 2.6-6.3.3 1.7 1.2 3 2.5 3.6C8.5 9 9.8 4.6 12 1.5Z";
const INNER =
  "M12 11c.4 1.7 1.5 2.7 2.4 3.7.9 1 1.6 2 1.6 3.4a4 4 0 0 1-8 0c0-1.3.6-2.3 1.4-3.1.2.8.7 1.4 1.3 1.6-.3-2 .3-4.1 1.3-5.6Z";

export function StreakFlame({
  size = 28,
  alive = true,
  hot = false,
}: {
  size?: number;
  alive?: boolean;
  /** Today already counted. */
  hot?: boolean;
}) {
  const flick = useSharedValue(0);

  useEffect(() => {
    if (!alive) return;
    flick.value = withRepeat(
      withSequence(
        withTiming(1, { duration: hot ? 260 : 420, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: hot ? 200 : 360, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.8, { duration: hot ? 240 : 380, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: hot ? 300 : 460, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [alive, hot, flick]);

  const outer = useAnimatedStyle(() => ({
    transform: [
      { translateY: size * 0.5 },
      { scaleY: 1 + flick.value * 0.07 },
      { scaleX: 1 - flick.value * 0.03 },
      { skewX: `${(flick.value - 0.5) * 4}deg` },
      { translateY: -size * 0.5 },
    ],
  }));
  const inner = useAnimatedStyle(() => ({
    transform: [
      { translateY: size * 0.5 },
      { scaleY: 1 + (1 - flick.value) * 0.12 },
      { translateY: -size * 0.5 },
    ],
  }));

  const top = alive ? "#F6DFA6" : "#3E4656";
  const mid = alive ? "#E8964A" : "#2F3644";
  const base = alive ? "#D9583A" : "#222834";

  return (
    <View style={{ width: size, height: size }}>
      {alive ? <Halo color="#E8964A" opacity={hot ? 0.6 : 0.38} spread={size * 0.4} /> : null}
      <Animated.View style={[{ position: "absolute", width: size, height: size }, outer]}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Defs>
            <LinearGradient id="flameOuter" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={base} />
              <Stop offset="0.6" stopColor={mid} />
              <Stop offset="1" stopColor={top} />
            </LinearGradient>
          </Defs>
          <Path d={OUTER} fill="url(#flameOuter)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", width: size, height: size }, inner]}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d={INNER} fill={alive ? "#FFF1CF" : "#4E5666"} opacity={alive ? 0.95 : 0.6} />
        </Svg>
      </Animated.View>
    </View>
  );
}
