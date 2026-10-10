// Memory Gym: the three memory games, and the daily workout that ties them.
//
// The workout is the reason to come back: one run of each, a few minutes, with
// its own streak. Levels make the next visit a step up rather than a repeat.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { Glyph, type GlyphName } from "../../../components/kit/Glyph";
import { PressableScale, Rise } from "../../../components/kit/motion";
import { StreakFlame } from "../../../components/kit/StreakFlame";
import { feel } from "../../../components/kit/feel";
import { AURORA, CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE, alpha } from "../../../theme";
import { MAX_LEVEL, MEMORY_GAMES, type MemoryGameId, type MemorySummary } from "../memory";
import { memorySnapshot } from "./shared";

type Card = {
  name: string;
  icon: GlyphName;
  tint: string;
  /** What it trains, in terms of talking. */
  trains: string;
};

const CARDS: Record<MemoryGameId, Card> = {
  span: {
    name: "Pip Says",
    icon: "grid",
    tint: AURORA.cyan,
    trains: "Tiles light up, you tap them back. How much you can hold at once.",
  },
  nback: {
    name: "Echo",
    icon: "radio",
    tint: AURORA.plum,
    trains: "Spot the letter from n steps back. Keeping up while things keep changing.",
  },
  chain: {
    name: "Word Chain",
    icon: "list-ordered",
    tint: AURORA.mint,
    trains: "Rebuild a word list in order. Getting to your third point intact.",
  },
};

export default function MemoryScreen() {
  const router = useRouter();
  const [sum, setSum] = useState<MemorySummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void memorySnapshot().then((x) => {
        if (live) setSum(x);
      });
      return () => {
        live = false;
      };
    }, [])
  );

  const done = sum?.workout.done;
  const count = sum?.workout.count ?? 0;
  const streak = sum?.streak.current ?? 0;
  const nextUp = MEMORY_GAMES.find((g) => !done?.[g]);

  return (
    <Screen>
      <Masthead close />

      <Rise index={0} style={s.intro}>
        <Text style={s.title}>Memory Gym</Text>
        <Text style={s.lede}>
          Losing your point mid-sentence is a memory problem before it is a speaking one. Three games, one run each,
          a few minutes a day.
        </Text>
      </Rise>

      <Rise index={1}>
        <Glass glow={sum?.workout.complete ? SEMANTIC.solid : AURORA.cyan}>
          <View style={{ gap: SPACE.md }}>
            <View style={s.workHead}>
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={s.kicker}>Today's workout</Text>
                <Text style={s.workTitle}>
                  {sum?.workout.complete ? "Done for today" : `${count} of ${MEMORY_GAMES.length} played`}
                </Text>
              </View>
              <View style={s.flame}>
                <StreakFlame size={30} alive={streak > 0} hot={sum?.streak.activeToday ?? false} />
                <Text style={s.flameN}>{streak}</Text>
              </View>
            </View>

            <View style={s.rings}>
              {MEMORY_GAMES.map((g) => {
                const c = CARDS[g];
                const on = done?.[g] ?? false;
                return (
                  <View key={g} style={s.ringItem}>
                    <View
                      style={[
                        s.ring,
                        { borderColor: on ? c.tint : alpha(c.tint, 0.35) },
                        on && { backgroundColor: alpha(c.tint, 0.22) },
                      ]}
                    >
                      <Glyph name={on ? "check" : c.icon} size={20} strokeWidth={on ? 2.6 : 1.8} color={on ? c.tint : alpha(c.tint, 0.7)} />
                    </View>
                    <Text style={[s.ringLabel, on && { color: CHROME.chalk }]}>{c.name}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={s.workNote}>
              {streak > 0
                ? `${streak}-day memory streak. Any one game keeps it alive; all three is the full workout.`
                : "Play any one game to start a memory streak. All three is the full workout."}
              {sum && sum.fullDays > 0 ? ` Full workouts so far: ${sum.fullDays}.` : ""}
            </Text>

            {nextUp ? (
              <PressableScale
                onPress={() => {
                  feel.tap();
                  router.push(`/play/${nextUp}`);
                }}
                scaleTo={0.97}
                accessibilityLabel={`Next: ${CARDS[nextUp].name}`}
              >
                <View style={[s.next, { borderColor: alpha(CARDS[nextUp].tint, 0.6) }]}>
                  <Text style={s.nextText}>
                    Next: {CARDS[nextUp].name}, level {sum?.next[nextUp] ?? 1}
                  </Text>
                  <Glyph name="chevron" size={18} color={CARDS[nextUp].tint} />
                </View>
              </PressableScale>
            ) : null}
          </View>
        </Glass>
      </Rise>

      {MEMORY_GAMES.map((g, i) => {
        const c = CARDS[g];
        const best = sum?.best[g] ?? 0;
        const next = sum?.next[g] ?? 1;
        const on = done?.[g] ?? false;
        return (
          <Rise key={g} index={i + 2}>
            <PressableScale
              onPress={() => {
                feel.tap();
                router.push(`/play/${g}`);
              }}
              scaleTo={0.97}
              accessibilityLabel={c.name}
            >
              <View style={s.game}>
                <LinearGradient
                  colors={[alpha(c.tint, 0.34), alpha(c.tint, 0.06)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.panel }]}
                />
                <View style={[s.iconWrap, { borderColor: alpha(c.tint, 0.45) }]}>
                  <Glyph name={c.icon} size={24} strokeWidth={1.7} color={c.tint} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={s.gameHead}>
                    <Text style={s.gameName}>{c.name}</Text>
                    {on ? (
                      <View style={[s.tag, { borderColor: alpha(SEMANTIC.solid, 0.7) }]}>
                        <Text style={[s.tagText, { color: SEMANTIC.solid }]}>Done today</Text>
                      </View>
                    ) : (
                      <Text style={[s.level, { color: c.tint }]}>Level {next}</Text>
                    )}
                  </View>
                  <Text style={s.trains}>{c.trains}</Text>
                  <View style={s.barRow}>
                    <View style={s.bar}>
                      <View
                        style={[s.barFill, { width: `${(best / MAX_LEVEL[g]) * 100}%`, backgroundColor: c.tint }]}
                      />
                    </View>
                    <Text style={s.barText}>
                      {best}/{MAX_LEVEL[g]}
                    </Text>
                  </View>
                </View>
              </View>
            </PressableScale>
          </Rise>
        );
      })}

      <Rise index={5}>
        <Text style={s.foot}>
          Each level is a step you have to clear before the next one opens. Missing a level still counts for the
          streak: showing up is the habit, clearing is the progress.
        </Text>
      </Rise>
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { gap: 6, marginTop: SPACE.xs },
  title: { color: CHROME.chalk, fontSize: 38, lineHeight: 44, fontFamily: TYPE.display, letterSpacing: -1 },
  lede: { color: CHROME.dust, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui },

  workHead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  kicker: { color: AURORA.cyan, fontSize: 13, fontFamily: TYPE.uiSemi },
  workTitle: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.displaySoft },
  flame: { alignItems: "center" },
  flameN: { color: SEMANTIC.ember, fontSize: 15, fontFamily: TYPE.monoMedium, ...TABULAR },
  rings: { flexDirection: "row", justifyContent: "space-around" },
  ringItem: { alignItems: "center", gap: 6 },
  ring: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringLabel: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.uiSemi },
  workNote: { color: CHROME.dust, fontSize: 13, lineHeight: 19, fontFamily: TYPE.ui },
  next: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    height: 46,
    borderRadius: RADIUS.soft,
    borderWidth: 1,
    backgroundColor: SURFACE.sunk,
  },
  nextText: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiSemi },

  game: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: RADIUS.panel,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: SURFACE.sunk,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(11, 15, 23, 0.45)",
  },
  gameHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  gameName: { color: CHROME.chalk, fontSize: 19, fontFamily: TYPE.display, letterSpacing: -0.3, flexShrink: 1 },
  level: { fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11.5, fontFamily: TYPE.uiBold },
  trains: { color: CHROME.chalk, opacity: 0.86, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },
  barText: { color: CHROME.dust, fontSize: 11.5, fontFamily: TYPE.monoMedium, ...TABULAR },

  foot: { color: CHROME.dustDim, fontSize: 12.5, lineHeight: 18, fontFamily: TYPE.uiMedium, textAlign: "center" },
});
