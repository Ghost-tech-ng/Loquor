// Confetti. A burst of aurora-coloured paper from one point, under gravity.
// Each piece is one shared value driven 0→1; the arc is computed in the worklet,
// so forty pieces cost forty timers on the UI thread and nothing on JS.

import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AURORA } from "../../theme";

const COLOURS = [AURORA.emerald, AURORA.mint, AURORA.coral, AURORA.cyan, AURORA.plum, AURORA.steel];

type Piece = {
  vx: number;
  vy: number;
  spin: number;
  w: number;
  h: number;
  colour: string;
  delay: number;
  round: boolean;
};

function Bit({ p, originX, originY }: { p: Piece; originX: number; originY: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: 1800, easing: Easing.linear }));
  }, [t, p.delay]);

  const style = useAnimatedStyle(() => {
    const k = t.value;
    // Drag slows the throw; gravity wins by the end.
    const drag = 1 - Math.exp(-3 * k);
    return {
      opacity: k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2,
      transform: [
        { translateX: originX + p.vx * drag },
        { translateY: originY + p.vy * drag + 620 * k * k },
        { rotate: `${p.spin * k}deg` },
        { rotateX: `${p.spin * 1.6 * k}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        s.bit,
        { width: p.w, height: p.h, backgroundColor: p.colour, borderRadius: p.round ? p.w : 2 },
        style,
      ]}
    />
  );
}

/** Mount with a new `burst` key to fire again. */
export function Confetti({
  burst,
  originX,
  originY,
  count = 44,
}: {
  burst: number;
  originX: number;
  originY: number;
  count?: number;
}) {
  const pieces = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 160 + Math.random() * 260;
      out.push({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 1080,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        colour: COLOURS[i % COLOURS.length]!,
        delay: Math.random() * 120,
        round: Math.random() < 0.3,
      });
    }
    return out;
    // `burst` is the trigger: a new value is a new throw.
  }, [burst, count]);

  if (burst === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Bit key={`${burst}-${i}`} p={p} originX={originX} originY={originY} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bit: { position: "absolute", left: 0, top: 0 },
});
