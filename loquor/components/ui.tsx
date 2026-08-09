// Shared primitives. Everything on screen is built from these so the three
// design rules from PRD §12 hold without being restated on every screen:
// sound is the only source of light, colour is data and chrome is colourless,
// light is clarity and heat is flaw.
//
// Motion lives here too, for the same reason the colours do. Every animation in
// the app comes from `Reveal`, `Tap`, `Pulse` or `Counter`, all of them on the
// native driver, all of them reading their durations from MOTION. An app where
// each screen invents its own easing is an app that feels assembled.

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
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CHROME,
  MOTION,
  RADIUS,
  SEMANTIC,
  SPACE,
  SURFACE,
  TABULAR,
  TAB_CLEARANCE,
  TYPE,
} from "../theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.scroll, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- motion

/**
 * Content arriving. Pass `delay` — or better, `index`, which spaces siblings by
 * MOTION.stagger so a list assembles itself instead of appearing all at once.
 *
 * The rise is 14px and the fade is the full duration: any further and it reads
 * as a transition between screens rather than a screen settling.
 */
export function Reveal({
  children,
  index = 0,
  delay,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const wait = delay ?? index * MOTION.stagger;

  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: MOTION.enter,
      delay: wait,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, wait]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A pressable that acknowledges the press physically. Every tappable surface in
 * the app uses this rather than a bare opacity flip — the 2.5% squeeze is the
 * difference between a screen that responds and a screen that merely reacts.
 */
export function Tap({
  children,
  onPress,
  style,
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const p = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.timing(p, { toValue: v, duration: MOTION.tap, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      disabled={disabled}
    >
      <Animated.View
        style={[
          style,
          {
            opacity: disabled
              ? 0.35
              : p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }),
            transform: [
              { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
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
  style?: StyleProp<ViewStyle>;
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
 *
 * Runs off the native driver by necessity: there is no way to interpolate into
 * a string on the UI thread. It is one listener on one screen, so the cost is
 * a few frames of JS, not a scroll jank problem.
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

/** The wordmark uses a V because the Latin alphabet Loquor comes from had no U. */
export function Masthead({ right }: { right?: string }) {
  return (
    <>
      <View style={s.masthead}>
        <Text style={s.wordmark}>LOQVOR</Text>
        {right ? <Text style={s.mastheadRight}>{right}</Text> : null}
      </View>
      <Hair />
    </>
  );
}

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

export function Hair({ style }: { style?: StyleProp<ViewStyle> }) {
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
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        tone === "primary" && s.btnPrimary,
        tone === "ghost" && s.btnGhost,
        tone === "quiet" && s.btnQuiet,
      ]}
    >
      <Text style={[s.btnLabel, tone === "primary" && s.btnLabelPrimary]}>{label}</Text>
    </Tap>
  );
}

/** The only container in the app. A recessed surface, not an outlined box —
 *  no shadow, no fill of its own colour, nothing that reads as a card. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.floor },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: SPACE.md,
    paddingBottom: TAB_CLEARANCE,
    gap: SPACE.md,
  },

  masthead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  wordmark: { color: CHROME.dust, fontSize: 10, letterSpacing: 4.5, fontFamily: TYPE.monoMedium },
  mastheadRight: {
    color: CHROME.dustDim,
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: TYPE.mono,
    ...TABULAR,
  },

  // Mono, so labels sit on the same grid as the numbers they caption. Martian
  // Mono is wide, so the tracking that a grotesk needed at this size comes off.
  eyebrow: { color: CHROME.dustDim, fontSize: 9, letterSpacing: 1.3, fontFamily: TYPE.monoMedium },
  display: { color: CHROME.chalk, fontSize: 27, lineHeight: 32, fontFamily: TYPE.display, letterSpacing: -0.5 },
  body: { color: "#C3D0D2", fontSize: 15, lineHeight: 23, fontFamily: TYPE.ui },
  meta: { color: CHROME.dust, fontSize: 12.5, lineHeight: 19, fontFamily: TYPE.ui },
  hair: { height: 1, backgroundColor: SURFACE.edge },

  figureRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  figure: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.display, letterSpacing: -1, ...TABULAR },
  figureUnit: { color: CHROME.dustDim, fontSize: 10, fontFamily: TYPE.mono },

  // Full-width and pill-ended. A button the width of the column with square
  // corners is a bar; the same button with its ends closed is a control.
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    borderWidth: 1,
  },
  btnPrimary: { backgroundColor: SEMANTIC.ember, borderColor: SEMANTIC.ember },
  btnGhost: { backgroundColor: SURFACE.sunk, borderColor: SURFACE.edgeLive },
  btnQuiet: { backgroundColor: "transparent", borderColor: "transparent", paddingVertical: 11 },
  btnLabel: { color: CHROME.chalk, fontSize: 11, letterSpacing: 1.1, fontFamily: TYPE.monoMedium },
  btnLabelPrimary: { color: CHROME.floor },

  // The border is still here so a caller can tint it — `borderColor: ember` on
  // a Panel is how the app marks the one thing on a screen that is live. At rest
  // it is a translucent edge rather than a drawn rectangle.
  panel: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    borderRadius: RADIUS.panel,
    padding: 18,
    gap: SPACE.sm,
  },
});
