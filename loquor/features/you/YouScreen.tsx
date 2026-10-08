// You — who you are becoming, then the evidence.
//
// The top is the game layer: level, rank, streak and freezes, and the badges
// wall with the locked ones still visible, because a goal you can see is one
// you start steering towards. Underneath, the Progress record unchanged — the
// numbers the game layer is built on, so the XP never floats free of them.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Masthead } from "../../components/ui";
import { Glass } from "../../components/kit/Glass";
import { ProgressRing, XPBar } from "../../components/kit/Meters";
import { PressableScale, Rise } from "../../components/kit/motion";
import { StreakFlame } from "../../components/kit/StreakFlame";
import { feel } from "../../components/kit/feel";
import { Glyph } from "../../components/kit/Glyph";
import { AURORA, CHROME, GRADIENT, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE, alpha } from "../../theme";
import { BADGES, type Badge } from "../progression/badges";
import { RANKS } from "../progression/levels";
import { snapshot, type Progress as Snapshot } from "../progression/progressionStore";
import Progress from "../progress/ProgressScreen";

function nextRank(level: number): { name: string; at: number } | null {
  const next = RANKS.find((r) => r.from > level);
  return next ? { name: next.name, at: next.from } : null;
}

function Header() {
  const router = useRouter();
  const [p, setP] = useState<Snapshot | null>(null);
  const [picked, setPicked] = useState<Badge | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      snapshot()
        .then((next) => {
          if (live) setP(next);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [])
  );

  const earned = new Map((p?.badges ?? []).map((b) => [b.badge.id, b.at]));
  const upcoming = p ? nextRank(p.level.level) : null;
  const streak = p?.streak;

  return (
    <View style={s.wrap}>
      <Masthead
        right={p ? `${earned.size}/${BADGES.length} BADGES` : undefined}
        setup
      />

      <Rise index={0}>
        <Glass glow={AURORA.brass} style={s.hero}>
          <ProgressRing progress={p?.level.progress ?? 0} size={128} stroke={10} colors={GRADIENT.xp}>
            <Text style={s.lvlLabel}>LEVEL</Text>
            <Text style={s.lvl}>{p?.level.level ?? 1}</Text>
          </ProgressRing>
          <Text style={s.rank}>{p?.level.rank ?? " "}</Text>
          <View style={{ alignSelf: "stretch", gap: 6 }}>
            <XPBar progress={p?.level.progress ?? 0} height={12} delay={250} />
            <View style={s.xpRow}>
              <Text style={s.xpText}>{p ? `${p.level.into} / ${p.level.span} XP` : " "}</Text>
              <Text style={s.xpText}>{p ? `${p.xp} total` : " "}</Text>
            </View>
          </View>
          {upcoming ? (
            <Text style={s.nextRank}>
              <Text style={{ color: AURORA.gold }}>{upcoming.name}</Text> at level {upcoming.at}
            </Text>
          ) : null}
        </Glass>
      </Rise>

      <Rise index={1} style={s.statRow}>
        <Glass style={s.stat}>
          <StreakFlame size={34} alive={(streak?.current ?? 0) > 0} hot={streak?.activeToday ?? false} />
          <Text style={s.statNum}>{streak?.current ?? 0}</Text>
          <Text style={s.statLabel}>day streak</Text>
        </Glass>
        <Glass style={s.stat}>
          <View style={s.statIcon}>
            <Glyph name="trophy" size={28} strokeWidth={1.7} color={AURORA.gold} />
          </View>
          <Text style={s.statNum}>{streak?.best ?? 0}</Text>
          <Text style={s.statLabel}>best run</Text>
        </Glass>
        <Glass style={s.stat}>
          <View style={s.statIcon}>
            <Glyph name="snowflake" size={28} strokeWidth={1.7} color={AURORA.steel} />
          </View>
          <Text style={s.statNum}>{streak?.freezes ?? 0}</Text>
          <Text style={s.statLabel}>freezes</Text>
        </Glass>
      </Rise>
      <Text style={s.freezeNote}>
        Every 7-day run banks a freeze, up to two. Miss a day and one is spent for you.
      </Text>

      <Rise index={2} style={{ gap: 10 }}>
        <View style={s.head}>
          <Text style={s.title}>Badges</Text>
          <Text style={s.meta}>
            {earned.size}/{BADGES.length}
          </Text>
        </View>
        <View style={s.grid}>
          {BADGES.map((b, i) => {
            const got = earned.has(b.id);
            return (
              <Animated.View key={b.id} entering={ZoomIn.delay(120 + i * 35).springify()} style={s.cell}>
                <PressableScale
                  onPress={() => {
                    feel.select();
                    setPicked((cur) => (cur?.id === b.id ? null : b));
                  }}
                  scaleTo={0.9}
                  style={[s.badge, got ? s.badgeOn : s.badgeOff, picked?.id === b.id && s.badgePicked]}
                  accessibilityLabel={`${b.name}${got ? ", earned" : ", locked"}`}
                >
                  <Glyph
                    name={b.icon}
                    size={28}
                    strokeWidth={1.7}
                    color={got ? AURORA.gold : CHROME.dustDim}
                    opacity={got ? 1 : 0.45}
                  />
                  <Text style={[s.badgeName, !got && { color: CHROME.dustDim }]} numberOfLines={2}>
                    {b.name}
                  </Text>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
        {picked ? (
          <Glass glow={earned.has(picked.id) ? AURORA.gold : undefined} style={s.detail}>
            <View style={s.detailHead}>
              <Glyph
                name={picked.icon}
                size={20}
                color={earned.has(picked.id) ? AURORA.gold : CHROME.dust}
              />
              <Text style={s.detailName}>{picked.name}</Text>
            </View>
            <Text style={s.detailHow}>{picked.how}</Text>
            <Text style={[s.detailWhen, earned.has(picked.id) && { color: SEMANTIC.solid }]}>
              {earned.has(picked.id)
                ? `Earned ${new Date(earned.get(picked.id) ?? 0).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`
                : "Not yet."}
            </Text>
          </Glass>
        ) : (
          <Text style={s.freezeNote}>Tap a badge to see how it is earned.</Text>
        )}
      </Rise>

      <Rise index={3} style={[s.head, { marginTop: SPACE.md }]}>
        <Text style={s.title}>The record</Text>
        <PressableScale onPress={() => router.push("/settings")} style={s.settings} accessibilityLabel="Settings">
          <Text style={s.settingsText}>Settings ›</Text>
        </PressableScale>
      </Rise>
    </View>
  );
}

export default function You() {
  return <Progress header={<Header />} />;
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.md },
  hero: { alignItems: "center", gap: 12, paddingVertical: 24 },
  lvlLabel: { color: CHROME.dust, fontSize: 10, letterSpacing: 2, fontFamily: TYPE.uiBold },
  lvl: { color: CHROME.chalk, fontSize: 44, lineHeight: 50, fontFamily: TYPE.monoMedium, ...TABULAR },
  rank: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.display, letterSpacing: -0.6 },
  xpRow: { flexDirection: "row", justifyContent: "space-between" },
  xpText: { color: SEMANTIC.xp, fontSize: 12, fontFamily: TYPE.monoMedium, ...TABULAR },
  nextRank: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.uiMedium },

  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 14, paddingHorizontal: 8 },
  statIcon: { height: 36, justifyContent: "center" },
  statNum: { color: CHROME.chalk, fontSize: 24, fontFamily: TYPE.monoMedium, ...TABULAR },
  statLabel: { color: CHROME.dust, fontSize: 11.5, fontFamily: TYPE.uiMedium },
  freezeNote: { color: CHROME.dustDim, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui, textAlign: "center" },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.displaySoft },
  meta: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },

  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "25%", padding: 5 },
  badge: {
    aspectRatio: 0.86,
    borderRadius: RADIUS.soft + 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 6,
    borderWidth: 1,
  },
  badgeOn: { backgroundColor: alpha(AURORA.gold, 0.12), borderColor: alpha(AURORA.gold, 0.45) },
  badgeOff: { backgroundColor: SURFACE.sunk, borderColor: SURFACE.edge },
  badgePicked: { borderColor: AURORA.brass, borderWidth: 1.5 },
  badgeName: { color: CHROME.chalk, fontSize: 10.5, lineHeight: 13, fontFamily: TYPE.uiSemi, textAlign: "center" },

  detail: { gap: 4 },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailName: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.displaySoft },
  detailHow: { color: CHROME.dust, fontSize: 14, lineHeight: 20, fontFamily: TYPE.ui },
  detailWhen: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.mono },

  settings: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  settingsText: { color: CHROME.chalk, fontSize: 12.5, fontFamily: TYPE.uiSemi },
});
