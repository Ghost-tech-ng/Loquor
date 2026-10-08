// The reward sheet, hosted once at the root.
//
// Anything that might have earned something calls celebrate(); if it did, this
// slides up: XP counting into the bar, the bar rolling over into a new level if
// it crossed one, quests ticking off, badges popping in, confetti for anything
// bigger than a plain take. Tapping anywhere outside or "Keep going" closes it.

import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { onReward, type Reward } from "../../features/progression/progressionStore";
import { AURORA, CHROME, GRADIENT, SEMANTIC, TYPE, alpha } from "../../theme";
import { Confetti } from "./Confetti";
import { feel } from "./feel";
import { GlowButton } from "./GlowButton";
import { Glass } from "./Glass";
import { XPBar } from "./Meters";
import { AnimatedNumber } from "./motion";
import { VoiceOrb } from "./VoiceOrb";

export function RewardHost() {
  const [reward, setReward] = useState<Reward | null>(null);
  const [burst, setBurst] = useState(0);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(
    () =>
      onReward((r) => {
        setReward(r);
        const big = r.levelTo.level > r.levelFrom.level || r.badges.length > 0 || r.quests.length > 0 || r.welcome;
        if (big) {
          feel.win();
          setTimeout(() => setBurst((b) => b + 1), 450);
        } else {
          feel.tap();
        }
      }),
    []
  );

  if (!reward) return null;

  const gained = reward.to - reward.from;
  const levelled = reward.levelTo.level > reward.levelFrom.level;
  const close = () => {
    setReward(null);
    setBurst(0);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6,5,16,0.78)" }]} />
        </Pressable>
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(24).stiffness(170)}
        exiting={SlideOutDown.duration(220)}
        style={[s.sheetWrap, { paddingBottom: insets.bottom + 16 }]}
        pointerEvents="box-none"
      >
        <Glass glow={levelled ? AURORA.gold : AURORA.violet} style={s.sheet}>
          <View style={s.orb}>
            <VoiceOrb size={88} mood="happy" />
          </View>

          <Text style={s.kicker}>
            {reward.welcome ? "WELCOME TO SPEEK" : levelled ? "LEVEL UP" : "NICE WORK"}
          </Text>
          <Text style={s.title}>
            {reward.welcome
              ? "Your practice so far, counted."
              : levelled
                ? `Level ${reward.levelTo.level} — ${reward.levelTo.rank}`
                : gained > 0
                  ? "That counted."
                  : "Progress made."}
          </Text>

          {gained > 0 ? (
            <AnimatedNumber
              value={gained}
              from={0}
              prefix="+"
              suffix=" XP"
              duration={reward.welcome ? 1600 : 1000}
              style={s.xp}
            />
          ) : null}

          <View style={s.levelRow}>
            <Text style={s.levelLabel}>LV {reward.levelTo.level}</Text>
            <Text style={s.levelLabel}>
              {reward.levelTo.into} / {reward.levelTo.span}
            </Text>
          </View>
          <XPBar progress={reward.levelTo.progress} delay={350} height={14} />

          {reward.quests.length > 0 ? (
            <View style={s.list}>
              {reward.quests.map((q, i) => (
                <Animated.View key={q.id} entering={ZoomIn.delay(600 + i * 140).springify()} style={s.item}>
                  <View style={[s.tick, { backgroundColor: alpha(SEMANTIC.solid, 0.18) }]}>
                    <Text style={[s.tickMark, { color: SEMANTIC.solid }]}>✓</Text>
                  </View>
                  <Text style={s.itemText} numberOfLines={2}>
                    {q.title}
                  </Text>
                  <Text style={s.itemXp}>+{q.xp}</Text>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {reward.badges.length > 0 ? (
            <View style={s.badges}>
              {reward.badges.map((b, i) => (
                <Animated.View
                  key={b.id}
                  entering={ZoomIn.delay(900 + i * 180).springify().damping(8)}
                  style={s.badge}
                >
                  <Text style={s.badgeEmoji}>{b.emoji}</Text>
                  <Text style={s.badgeName} numberOfLines={1}>
                    {b.name}
                  </Text>
                </Animated.View>
              ))}
            </View>
          ) : null}

          <GlowButton label="Keep going" onPress={close} tone="primary" style={{ marginTop: 18 }} />
        </Glass>
      </Animated.View>

      <Confetti burst={burst} originX={width / 2} originY={height * 0.42} />
    </Modal>
  );
}

const s = StyleSheet.create({
  sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  sheet: { paddingTop: 52 },
  // Straddles the rim: the sheet pads 52 + 18 above the content, the orb is 88 tall.
  orb: { position: "absolute", top: -114, alignSelf: "center" },
  kicker: {
    fontFamily: TYPE.uiBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: AURORA.gold,
    textAlign: "center",
  },
  title: {
    fontFamily: TYPE.display,
    fontSize: 26,
    lineHeight: 32,
    color: CHROME.chalk,
    textAlign: "center",
    marginTop: 6,
  },
  xp: { fontSize: 40, textAlign: "center", color: SEMANTIC.xp, marginTop: 10 },
  levelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  levelLabel: { fontFamily: TYPE.monoMedium, fontSize: 12, color: CHROME.dust },
  list: { marginTop: 16, gap: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tick: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  tickMark: { fontFamily: TYPE.uiBold, fontSize: 15 },
  itemText: { flex: 1, fontFamily: TYPE.uiMedium, fontSize: 15, color: CHROME.chalk },
  itemXp: { fontFamily: TYPE.monoMedium, fontSize: 13, color: SEMANTIC.xp },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 16 },
  badge: {
    alignItems: "center",
    width: 96,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: alpha(GRADIENT.primary[0], 0.16),
    borderWidth: 1,
    borderColor: alpha(GRADIENT.primary[1], 0.4),
  },
  badgeEmoji: { fontSize: 32 },
  badgeName: { fontFamily: TYPE.uiSemi, fontSize: 12, color: CHROME.chalk, marginTop: 4 },
});
