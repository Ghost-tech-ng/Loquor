// Motion primitives: the press, the entrance, and the count.
//
// Every tappable thing in Speek squashes on touch and springs back with a light
// haptic. It is the single cheapest way to make an interface feel physical, and
// doing it in one component means no screen can forget to.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, type StyleProp, type TextStyle, type ViewProps } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { MOTION, SPRING, TABULAR, TYPE, CHROME } from "../../theme";
import { feel } from "./feel";

type BoxStyle = ViewProps["style"];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  scaleTo = 0.95,
  haptic = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: BoxStyle;
  scaleTo?: number;
  haptic?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, SPRING.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING.bouncy);
      }}
      onPress={() => {
        if (haptic) feel.tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={[style, anim, disabled && { opacity: 0.4 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Rises into place on mount, staggered by `index`. */
export function Rise({
  children,
  index = 0,
  delay = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: BoxStyle;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay + index * MOTION.stagger)
        .springify()
        // Critically damped: sections settle into place without overshooting.
        // A bounce here made the whole screen wobble whenever content above
        // shifted while the sections below were still mid-spring.
        .damping(26)
        .stiffness(160)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that counts to its value instead of jumping. JS-driven on purpose:
 * the text has to re-render per frame anyway, and a count of a second or two
 * is well inside what the JS thread does without a stutter.
 */
export function useCountUp(value: number, duration = 900, from?: number): number {
  const [shown, setShown] = useState(from ?? value);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const start = shownRef.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      setShown(start + (value - start) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}

export function AnimatedNumber({
  value,
  from,
  decimals = 0,
  duration,
  prefix = "",
  suffix = "",
  style,
}: {
  value: number;
  from?: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle | TextStyle[];
}) {
  const n = useCountUp(value, duration, from);
  return (
    <Text style={[{ fontFamily: TYPE.monoMedium, color: CHROME.chalk }, TABULAR, style]}>
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </Text>
  );
}

/** Rise, addressed by an absolute `delay` or by stagger `index`; delay wins. */
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

/** PressableScale with a gentler squash, for rows and list cards. */
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
 * Slow breathing, for anything live or waiting on the user. One per screen:
 * a second pulsing thing is a screen with a fault light.
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
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: MOTION.ambient, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, active]);

  const breathe = useAnimatedStyle(() => ({ opacity: 1 - t.value * 0.55 }));
  return <Animated.View style={[style, breathe]}>{children}</Animated.View>;
}

/** A measurement that counts up from zero, in whatever type the caller sets. */
export function Counter({
  value,
  decimals = 0,
  style,
}: {
  value: number;
  decimals?: number;
  style?: StyleProp<TextStyle>;
}) {
  const n = useCountUp(value, MOTION.enter + 260, 0);
  return <Text style={style}>{n.toFixed(decimals)}</Text>;
}
