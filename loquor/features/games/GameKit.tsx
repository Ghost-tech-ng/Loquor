// The pieces every game screen shares: the start card, the result card, the
// timer bar, the hearts, and the shake. Each game owns its own middle.

import { useCallback, useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Glass } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { Glyph, type GlyphName } from "../../components/kit/Glyph";
import { AnimatedNumber, Rise } from "../../components/kit/motion";
import { Confetti } from "../../components/kit/Confetti";
import { AURORA, CHROME, RADIUS, SEMANTIC, SPACE, SPRING, TABULAR, TYPE, alpha } from "../../theme";
import type { RunResult } from "./runs";

type BoxStyle = ViewProps["style"];

export function GameIntro({
  icon,
  tint,
  title,
  tagline,
  rules,
  best,
  formatBest = (n) => String(n),
  startLabel = "Start",
  onStart,
  disabled = false,
  note,
  children,
}: {
  icon: GlyphName;
  tint: string;
  title: string;
  tagline: string;
  rules: string[];
  best: number | null;
  formatBest?: (n: number) => string;
  startLabel?: string;
  onStart: () => void;
  disabled?: boolean;
  /** Shown above the button, e.g. why it is disabled. */
  note?: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      <Rise index={0} style={s.hero}>
        <View style={[s.heroIcon, { borderColor: alpha(tint, 0.5), backgroundColor: alpha(tint, 0.12) }]}>
          <Glyph name={icon} size={34} strokeWidth={1.6} color={tint} />
        </View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.tagline}>{tagline}</Text>
      </Rise>
      <Rise index={1}>
        <Glass glow={tint} style={{ gap: SPACE.sm }}>
          <Text style={s.label}>HOW IT WORKS</Text>
          {rules.map((r, i) => (
            <View key={i} style={s.rule}>
              <Text style={[s.ruleN, { color: tint }]}>{i + 1}</Text>
              <Text style={s.ruleText}>{r}</Text>
            </View>
          ))}
          <View style={s.bestRow}>
            <Glyph name="trophy" size={16} color={best === null ? CHROME.dust : SEMANTIC.xp} />
            <Text style={s.bestText}>
              {best === null ? "No best yet. This run sets it." : `Your best: ${formatBest(best)}`}
            </Text>
          </View>
        </Glass>
      </Rise>
      {children}
      <Rise index={2} style={{ gap: SPACE.sm }}>
        {note ? <Text style={s.note}>{note}</Text> : null}
        <GlowButton label={startLabel} onPress={onStart} disabled={disabled} />
      </Rise>
    </>
  );
}

export type Stat = { label: string; value: string; tint?: string };

export function GameResult({
  title,
  score,
  unit,
  result,
  stats,
  verdict,
  onAgain,
  onDone,
  children,
}: {
  title: string;
  score: number;
  unit: string;
  /** Null while the save is in flight. */
  result: RunResult | null;
  stats: Stat[];
  verdict?: string;
  onAgain: () => void;
  onDone: () => void;
  children?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const best = result?.isBest ?? false;
  return (
    <>
      {best ? <Confetti burst={1} originX={width / 2} originY={180} count={60} /> : null}
      <Rise index={0} style={s.hero}>
        <Text style={s.label}>{title.toUpperCase()}</Text>
        <AnimatedNumber value={score} from={0} duration={1100} style={s.score} />
        <Text style={s.unit}>{unit}</Text>
        {best ? (
          <View style={s.bestBadge}>
            <Glyph name="trophy" size={14} color={CHROME.ink} strokeWidth={2.2} />
            <Text style={s.bestBadgeText}>NEW BEST</Text>
          </View>
        ) : result?.previousBest !== null && result?.previousBest !== undefined ? (
          <Text style={s.prev}>Best {result.previousBest}</Text>
        ) : null}
      </Rise>
      {verdict ? (
        <Rise index={1}>
          <Text style={s.verdict}>{verdict}</Text>
        </Rise>
      ) : null}
      <Rise index={2}>
        <Glass style={s.stats}>
          {stats.map((st) => (
            <View key={st.label} style={s.stat}>
              <Text style={[s.statValue, st.tint ? { color: st.tint } : null]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
          <View style={s.stat}>
            <Text style={[s.statValue, { color: SEMANTIC.xp }]}>{result ? `+${result.xp}` : "…"}</Text>
            <Text style={s.statLabel}>XP</Text>
          </View>
        </Glass>
      </Rise>
      {children}
      <Rise index={3} style={{ gap: SPACE.sm }}>
        <GlowButton label="Play again" onPress={onAgain} icon="replay" />
        <GlowButton label="Done" onPress={onDone} tone="ghost" />
      </Rise>
    </>
  );
}

export function TimerBar({ progress, tint = AURORA.emerald }: { progress: number; tint?: string }) {
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 120 });
  }, [progress, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  const low = progress < 0.2;
  return (
    <View style={s.track}>
      <Animated.View style={[s.fill, { backgroundColor: low ? AURORA.coral : tint }, fill]} />
    </View>
  );
}

export function Hearts({ left, total }: { left: number; total: number }) {
  return (
    <View style={s.hearts} accessibilityLabel={`${left} of ${total} hearts left`}>
      {Array.from({ length: total }, (_, i) => (
        <HeartPip key={i} on={i < left} />
      ))}
    </View>
  );
}

function HeartPip({ on }: { on: boolean }) {
  const k = useSharedValue(1);
  useEffect(() => {
    if (!on) k.value = withSequence(withSpring(1.5, SPRING.snappy), withSpring(1, SPRING.gentle));
  }, [on, k]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  return (
    <Animated.View style={st}>
      <Glyph
        name="heart"
        size={22}
        strokeWidth={2}
        color={on ? AURORA.coral : CHROME.dustDim}
        opacity={on ? 1 : 0.5}
      />
    </Animated.View>
  );
}

/** A horizontal shake, for a miss. */
export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = useCallback(() => {
    x.value = withSequence(
      withTiming(-12, { duration: 50 }),
      withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 50 })
    );
  }, [x]);
  return { style, shake };
}

/** A big number that pops on every change, for a live score or combo. */
export function PopNumber({ value, style, prefix = "" }: { value: number; style?: BoxStyle; prefix?: string }) {
  const k = useSharedValue(1);
  useEffect(() => {
    k.value = withSequence(withTiming(1.25, { duration: 70 }), withSpring(1, SPRING.snappy));
  }, [value, k]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  return (
    <Animated.View style={[style, st]}>
      <Text style={s.pop}>
        {prefix}
        {value}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", gap: 6, marginTop: SPACE.sm },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { color: CHROME.chalk, fontSize: 32, fontFamily: TYPE.display, letterSpacing: -0.8, textAlign: "center" },
  tagline: { color: CHROME.dust, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui, textAlign: "center" },
  label: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  rule: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  ruleN: { fontSize: 15, fontFamily: TYPE.monoMedium, width: 14, ...TABULAR },
  ruleText: { flex: 1, color: CHROME.chalk, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  bestText: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.uiMedium },
  note: { color: AURORA.coral, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui, textAlign: "center" },

  score: { fontSize: 72, letterSpacing: -2, color: CHROME.chalk },
  unit: { color: CHROME.dust, fontSize: 14, fontFamily: TYPE.uiMedium, marginTop: -6 },
  bestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: SEMANTIC.xp,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    marginTop: 8,
  },
  bestBadgeText: { color: CHROME.ink, fontSize: 11, letterSpacing: 1.4, fontFamily: TYPE.uiBold },
  prev: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.mono, marginTop: 6, ...TABULAR },
  verdict: { color: CHROME.chalk, fontSize: 17, lineHeight: 25, fontFamily: TYPE.displaySoft, textAlign: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: SPACE.md },
  stat: { alignItems: "center", gap: 2, minWidth: 72 },
  statValue: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.monoMedium, ...TABULAR },
  statLabel: { color: CHROME.dust, fontSize: 10.5, letterSpacing: 1.2, fontFamily: TYPE.uiBold },

  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  hearts: { flexDirection: "row", gap: 6 },
  pop: { color: CHROME.chalk, fontSize: 40, fontFamily: TYPE.monoMedium, letterSpacing: -1, ...TABULAR },
});
