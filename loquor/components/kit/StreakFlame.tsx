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

  const top = alive ? "#FFE08A" : "#4A4766";
  const mid = alive ? "#FF9A3C" : "#3A3757";
  const base = alive ? "#FF4D2E" : "#2B2848";

  return (
    <View
      style={{
        width: size,
        height: size,
        shadowColor: "#FF7A2E",
        shadowOpacity: alive ? (hot ? 0.9 : 0.55) : 0,
        shadowRadius: size * 0.35,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
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
          <Path d={INNER} fill={alive ? "#FFF3C4" : "#5A5778"} opacity={alive ? 0.95 : 0.6} />
        </Svg>
      </Animated.View>
    </View>
  );
}
