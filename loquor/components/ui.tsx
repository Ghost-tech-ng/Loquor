// Shared primitives, on the Aurora Night skin.
//
// Every screen that predates the kit is built from these, so they keep their
// old names and props and borrow the kit underneath: Tap and Reveal are the
// kit's springs, Button is the GlowButton, the type is Fraunces and Outfit.
// New screens should reach for components/kit directly.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  AURORA,
  CHROME,
  MOTION,
  RADIUS,
  SPACE,
  SURFACE,
  TABULAR,
  TAB_CLEARANCE,
  TYPE,
} from "../theme";
import { GlowButton } from "./kit/GlowButton";
import { Glyph } from "./kit/Glyph";
import { PressableScale, Rise } from "./kit/motion";

// What <View> actually accepts. Not StyleProp<ViewStyle>: Expo's web typings
// widen ViewStyle with position "fixed" | "sticky", which the native View
// props do not accept, so the exported interface does not fit.
type BoxStyle = ViewProps["style"];

export { Masthead, Screen } from "./kit/Screen";

// ---------------------------------------------------------------- motion

/** Content arriving on a spring. `delay` wins over `index` when both are set. */
export function Reveal({
  children,
  index = 0,
  delay,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: BoxStyle;
}) {
  return (
    <Rise index={delay === undefined ? index : 0} delay={delay ?? 0} style={style}>
      {children}
    </Rise>
  );
}

/** A pressable that squashes and springs back, with a light haptic. */
export function Tap({
  children,
  onPress,
  style,
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: BoxStyle;
  disabled?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={style} scaleTo={0.97}>
      {children}
    </PressableScale>
  );
}

/**
 * Slow breathing, for anything live or waiting on the user. Reserved for one
 * element per screen — a second pulsing thing is a screen with a fault light.
 */
export function Pulse({
  children,
  active = true,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  style?: BoxStyle;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      t.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: MOTION.ambient,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: MOTION.ambient,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, active]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A number that arrives at its value instead of appearing at it. Used only for
 * measurements — a filler rate that counts up is the app doing the counting in
 * front of you, which is the whole claim it makes.
 */
export function Counter({
  value,
  decimals = 0,
  style,
}: {
  value: number;
  decimals?: number;
  style?: StyleProp<TextStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    t.setValue(0);
    const id = t.addListener(({ value: v }) => setShown(v * value));
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: MOTION.enter + 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
      t.removeListener(id);
    };
  }, [t, value]);

  return <Text style={style}>{shown.toFixed(decimals)}</Text>;
}

// ---------------------------------------------------------------- type

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function Display({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[s.display, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}

export function Meta({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.meta, style]}>{children}</Text>;
}

export function Hair({ style }: { style?: BoxStyle }) {
  return <View style={[s.hair, style]} />;
}

export function Figure({ value, unit, tint }: { value: string; unit?: string; tint?: string }) {
  return (
    <View style={s.figureRow}>
      <Text style={[s.figure, tint ? { color: tint } : null]}>{value}</Text>
      {unit ? <Text style={s.figureUnit}>{unit}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "ghost" | "quiet";
  disabled?: boolean;
}) {
  return <GlowButton label={label} onPress={onPress} tone={tone} disabled={disabled} />;
}

/**
 * A card. Not blurred: these stack a dozen deep on the older screens, and a
 * translucent fill reads as glass over the aurora at a fraction of the cost.
 * A caller tinting `borderColor` is how a screen marks the one live thing.
 */
export function Panel({ children, style }: { children: ReactNode; style?: BoxStyle }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

const s = StyleSheet.create({
  eyebrow: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  display: { color: CHROME.chalk, fontSize: 30, lineHeight: 36, fontFamily: TYPE.display, letterSpacing: -0.6 },
  body: { color: "#E4DFD4", fontSize: 16, lineHeight: 25, fontFamily: TYPE.ui },
  meta: { color: CHROME.dust, fontSize: 13.5, lineHeight: 20, fontFamily: TYPE.ui },
  hair: { height: 1, backgroundColor: SURFACE.edge },

  figureRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  figure: { color: CHROME.chalk, fontSize: 32, fontFamily: TYPE.monoMedium, letterSpacing: -1, ...TABULAR },
  figureUnit: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.uiMedium },

  panel: {
    backgroundColor: "rgba(255, 255, 255, 0.065)",
    borderWidth: 1,
    borderColor: SURFACE.edge,
    borderRadius: RADIUS.panel,
    padding: 18,
    gap: SPACE.sm,
  },
});
