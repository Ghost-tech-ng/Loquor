// The mascot for Bring It to Life: a grey box robot that turns into the Speek
// orb as your delivery comes alive. `morph` is 0 (robot) to 1 (orb).
//
// The robot rounds off and fades as the orb grows through it, so a middling
// take shows something halfway there rather than snapping between the two.

import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { CHROME, SPRING } from "../../theme";
import { VoiceOrb, type OrbMood } from "./VoiceOrb";

const STEEL = "#8A93A6";
const STEEL_DARK = "#596173";

export function RobotOrb({
  size = 160,
  morph,
  level,
  mood = "idle",
}: {
  size?: number;
  morph: number;
  level?: SharedValue<number>;
  mood?: OrbMood;
}) {
  const m = useSharedValue(morph);
  useEffect(() => {
    m.value = withSpring(Math.max(0, Math.min(1, morph)), SPRING.gentle);
  }, [morph, m]);

  const robot = useAnimatedStyle(() => ({
    opacity: interpolate(m.value, [0, 0.75], [1, 0], "clamp"),
    borderRadius: interpolate(m.value, [0, 1], [size * 0.14, size * 0.5]),
    transform: [{ scale: interpolate(m.value, [0, 1], [1, 0.82]) }],
  }));
  const eyes = useAnimatedStyle(() => ({
    height: interpolate(m.value, [0, 1], [size * 0.07, size * 0.12]),
    borderRadius: interpolate(m.value, [0, 1], [2, size * 0.06]),
  }));
  const voice = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + (level ? level.value : 0) * 3 }],
  }));
  const orb = useAnimatedStyle(() => ({
    opacity: interpolate(m.value, [0.2, 0.9], [0, 1], "clamp"),
    transform: [{ scale: interpolate(m.value, [0, 1], [0.6, 1]) }],
  }));

  const box = size * 0.78;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: box,
            height: box,
            backgroundColor: STEEL,
            borderWidth: 2,
            borderColor: STEEL_DARK,
            alignItems: "center",
            justifyContent: "center",
            gap: box * 0.16,
          },
          robot,
        ]}
      >
        <View style={{ position: "absolute", top: -size * 0.1, width: 3, height: size * 0.1, backgroundColor: STEEL_DARK }} />
        <View style={{ flexDirection: "row", gap: box * 0.2 }}>
          <Animated.View style={[{ width: box * 0.16, backgroundColor: CHROME.floor }, eyes]} />
          <Animated.View style={[{ width: box * 0.16, backgroundColor: CHROME.floor }, eyes]} />
        </View>
        <Animated.View style={[{ width: box * 0.42, height: 4, borderRadius: 2, backgroundColor: CHROME.floor }, voice]} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute" }, orb]}>
        <VoiceOrb size={size} level={level} mood={mood} />
      </Animated.View>
    </View>
  );
}
