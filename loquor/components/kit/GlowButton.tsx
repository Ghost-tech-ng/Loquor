// The call to action.
//
// One per screen at most: a gradient pill with a halo that breathes, and a
// sheen that sweeps across it every few seconds. The motion is what makes it the
// obvious next tap without it needing to be the biggest thing on the screen.

import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { CHROME, GRADIENT, RADIUS, SURFACE, TYPE } from "../../theme";
import { Halo } from "./Halo";
import { PressableScale } from "./motion";

type BoxStyle = ViewProps["style"];

export type GlowTone = "primary" | "good" | "warm" | "ghost" | "quiet";

const STOPS: Record<"primary" | "good" | "warm", readonly [string, string, ...string[]]> = {
  primary: GRADIENT.primary,
  good: GRADIENT.good,
  warm: GRADIENT.warm,
};

export function GlowButton({
  label,
  onPress,
  tone = "primary",
  disabled = false,
  icon,
  style,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  tone?: GlowTone;
  disabled?: boolean;
  icon?: string;
  style?: BoxStyle;
  compact?: boolean;
}) {
  const filled = tone === "primary" || tone === "good" || tone === "warm";
  const pulse = useSharedValue(0);
  const sweep = useSharedValue(-1);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!filled || disabled) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    sweep.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2400, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }))
      ),
      -1
    );
  }, [filled, disabled, pulse, sweep]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.4,
    transform: [{ scaleX: 1 + pulse.value * 0.04 }, { scaleY: 1 + pulse.value * 0.14 }],
  }));
  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * (width * 0.8) }, { skewX: "-20deg" }],
  }));

  const height = compact ? 44 : 56;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[{ alignSelf: "stretch" }, style]}
    >
      {filled ? (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <Animated.View pointerEvents="none" style={[s.halo, halo]}>
            <Halo color={STOPS[tone][0]} opacity={0.75} spread={16} />
          </Animated.View>
          <LinearGradient
            colors={STOPS[tone]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.pill, { height }]}
          >
            <Animated.View pointerEvents="none" style={[s.sheen, sheen]}>
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Text style={[s.label, compact && s.labelCompact]}>
              {icon ? `${icon}  ` : ""}
              {label}
            </Text>
          </LinearGradient>
        </View>
      ) : (
        <View style={[s.pill, { height }, tone === "ghost" ? s.ghost : null]}>
          <Text style={[s.label, compact && s.labelCompact, tone === "quiet" && s.quietLabel]}>
            {icon ? `${icon}  ` : ""}
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const s = StyleSheet.create({
  halo: {
    ...StyleSheet.absoluteFill,
    top: 6,
    bottom: -6,
    left: 10,
    right: 10,
  },
  pill: {
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  sheen: { position: "absolute", top: 0, bottom: 0, width: 60 },
  ghost: {
    backgroundColor: SURFACE.sunk,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: SURFACE.edgeLive,
  },
  label: { fontFamily: TYPE.uiBold, fontSize: 17, color: "#FFFFFF", letterSpacing: 0.2 },
  labelCompact: { fontSize: 15 },
  quietLabel: { color: CHROME.dust, fontFamily: TYPE.uiSemi },
});
