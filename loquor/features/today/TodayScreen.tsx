// Home.
//
// The top is the reason to open the app today: your streak, your level, three
// quests that refill at midnight. Under it, one instruction chosen by
// nextAction — a list of nine equal cards asks a person to choose before they
// know what anything is for, so the hero is still a single answer. Everything
// below that is the record.
//
// The prompt stays deterministic per day: opening the app twice does not reroll
// it. A rerollable prompt turns a commitment into a slot machine, and the point
// is speaking on something you did not pick.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { Masthead, Screen } from "../../components/ui";
import { StrataWall, fillerStrain, strain } from "../../components/viz";
import { Glass } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { Glyph } from "../../components/kit/Glyph";
import { ProgressRing, XPBar } from "../../components/kit/Meters";
import { PressableScale, Rise } from "../../components/kit/motion";
import { StreakFlame } from "../../components/kit/StreakFlame";
import {
  AURORA,
  CHROME,
  GRADIENT,
  RADIUS,
  SEMANTIC,
  SPACE,
  SURFACE,
  TABULAR,
  TYPE,
  alpha,
} from "../../theme";
import { TOPICS_BY_ID, pickTopic, type Topic } from "../arena/topics";
import { READINGS_BY_ID } from "../reading/readings";
import { ALL_WORDS, gloss } from "../lexicon/glossary";
import { dayOf } from "../progress/progress";
import { celebrate, snapshot, type Progress } from "../progression/progressionStore";
import { nextAction, type Action } from "./nextAction";
import {
  countSessions,
  countToday,
  fillerTrend,
  getBaseline,
  lexiconStats,
  pendingDebriefs,
  recentRooms,
  recentSessions,
  recentTakes,
  sectionBests,
  usedTopicIds,
  type SessionRow,
} from "../../lib/db";
import { fillerCountIsApproximate, getKey, loadSettings, resolve } from "../../lib/settings";

function greeting(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState(0);
  const [trend, setTrend] = useState<number[]>([]);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [approx, setApprox] = useState(true);
  const [ever, setEver] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ready, setReady] = useState(false);

  // Refetch on focus rather than on mount: coming back from a scorecard should
  // move the ladder on, not show the instruction you have just completed.
  //
  // Everything loads first and lands in one render. Drawing it in stages —
  // level, then quests, then the hero swapping its placeholder for the real
  // instruction — shifted the layout under sections that were still rising,
  // which read as the whole screen shaking.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        // Settle first so the quests and level drawn below already include
        // whatever was just earned. The sheet waits until the screen has
        // finished rising.
        let p: Progress | null = null;
        try {
          await celebrate({ holdMs: 900 });
          p = await snapshot();
        } catch {
          // Progression is decoration on top of the record. A failure here must
          // not take the instruction or the record down with it.
        }

        try {
          const settings = await loadSettings();
          const { stt } = resolve(settings);
          const [key, used, todayCount, rows, takes, stats, due, roomRows, base, total] =
            await Promise.all([
              getKey(stt),
              usedTopicIds(),
              countToday(),
              recentSessions(5),
              recentTakes(1),
              lexiconStats(),
              pendingDebriefs(),
              recentRooms(50),
              getBaseline(),
              countSessions(),
            ]);

          // Sections left in the piece already in progress — zero if the last one
          // was finished, which reads as "nothing to pick back up" on the ladder.
          const inProgress = takes[0] ? READINGS_BY_ID.get(takes[0].reading_id) : undefined;
          const bests = inProgress ? await sectionBests(inProgress.id) : null;
          const sectionsLeft =
            inProgress && bests ? Math.max(0, inProgress.sections.length - bests.size) : 0;

          const now = Date.now();
          const rates = await fillerTrend(stt, 30);
          if (!live) return;

          if (p) setProgress(p);
          setAction(
            nextAction({
              hasKey: key !== null,
              hasBaseline: base !== null,
              dueDebriefs: due.length,
              takesToday: todayCount,
              lexDue: stats.dueNow,
              sectionsLeft,
              roomsLogged: roomRows.filter((r) => r.debriefed_at !== null).length,
              roomsUpcoming: roomRows.filter((r) => r.debriefed_at === null && r.at > now).length,
              sessionsEver: total,
            })
          );

          const lastDomain = rows[0] ? TOPICS_BY_ID.get(rows[0].topic_id)?.domain : undefined;
          setTopic(pickTopic({ usedIds: used, lastDomain }));
          setApprox(fillerCountIsApproximate(stt));
          setEver(total);
          setDone(todayCount);
          setRecent(rows);
          setTrend(rates);
        } finally {
          if (live) setReady(true);
        }
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const now = new Date();
  const today = dayOf(now.getTime());
  const word = gloss(ALL_WORDS[today % ALL_WORDS.length] ?? "");
  const last = trend[trend.length - 1];
  // The Arena rungs are the only ones where today's prompt is the thing being
  // pointed at, so it is the only place the prompt is worth showing up top.
  const arena = action?.route === "/arena";
  const streak = progress?.streak;
  const questsDone = progress?.quests.filter((q) => q.done).length ?? 0;

  const go = () => {
    if (!action) return;
    if (arena && topic) {
      router.push({ pathname: "/arena", params: { topicId: topic.id } });
      return;
    }
    router.push(action.route as never);
  };

  return (
    <Screen>
      <Masthead setup />

      {ready ? (
        <>
          <Rise index={0} style={s.hello}>
            <View style={{ flex: 1 }}>
              <Text style={s.helloSmall}>
                {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              <Text style={s.helloBig}>{greeting(now.getHours())}</Text>
            </View>
            <PressableScale onPress={() => router.push("/you")} style={s.streakPill} accessibilityLabel="Streak">
              <StreakFlame size={26} alive={(streak?.current ?? 0) > 0} hot={streak?.activeToday ?? false} />
              <Text style={[s.streakNum, !streak?.current && { color: CHROME.dust }]}>
                {streak?.current ?? 0}
              </Text>
            </PressableScale>
          </Rise>

          {/* Level. Tapping through to You is where the badges and the full record live. */}
          <Rise index={1}>
            <PressableScale onPress={() => router.push("/you")} scaleTo={0.98} accessibilityLabel="Your level">
              <Glass style={s.level}>
                <View style={s.levelRow}>
                  <ProgressRing progress={progress?.level.progress ?? 0} size={64} stroke={6} colors={GRADIENT.xp}>
                    <Text style={s.levelNum}>{progress?.level.level ?? 1}</Text>
                  </ProgressRing>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={s.levelHead}>
                      <Text style={s.rank}>{progress?.level.rank ?? " "}</Text>
                      <Text style={s.levelXp}>
                        {progress ? `${progress.level.into}/${progress.level.span} XP` : " "}
                      </Text>
                    </View>
                    <XPBar progress={progress?.level.progress ?? 0} height={10} delay={200} />
                    <Text style={s.levelMeta}>
                      {streak && streak.freezes > 0
                        ? `${streak.freezes} streak ${streak.freezes === 1 ? "freeze" : "freezes"} banked`
                        : streak && !streak.activeToday && streak.current > 0
                          ? "Practise today to keep the streak"
                          : `${progress?.xp ?? 0} XP all time`}
                    </Text>
                  </View>
                </View>
              </Glass>
            </PressableScale>
          </Rise>

          {/* The hero. Re-keyed on the action id so it re-enters when the ladder
              moves on, which is the feedback that completing something counted. */}
          <Rise key={action?.id ?? "none"} index={2}>
            <Glass glow={action?.urgent ? AURORA.coral : AURORA.emerald} style={s.hero}>
              <Text style={[s.kicker, action?.urgent && { color: AURORA.coral }]}>
                {action?.eyebrow ?? " "}
              </Text>
              <Text style={s.heroTitle}>{action?.title ?? " "}</Text>
              {arena && topic ? <Text style={s.heroPrompt}>“{topic.title}”</Text> : null}
              <Text style={s.heroWhy}>{action?.why ?? " "}</Text>
              <GlowButton
                label={action?.cta ?? " "}
                onPress={go}
                disabled={!action || (arena && !topic)}
                style={{ marginTop: 6 }}
              />
              {done > 0 && !arena ? (
                <Text style={s.again}>
                  {done} {done === 1 ? "take" : "takes"} today. Going again is free — the second one is
                  usually the one worth keeping.
                </Text>
              ) : null}
            </Glass>
          </Rise>

          {/* Quests. */}
          {progress && progress.quests.length > 0 ? (
            <Rise index={3} style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Today's quests</Text>
                <Text style={s.sectionMeta}>
                  {questsDone}/{progress.quests.length}
                </Text>
              </View>
              {progress.quests.map((q, i) => (
                <Animated.View key={q.quest.id} entering={FadeIn.delay(300 + i * 90)}>
                  <PressableScale
                    onPress={() => router.push(q.quest.route as never)}
                    scaleTo={0.97}
                    style={[s.quest, q.done && s.questDone]}
                    accessibilityLabel={q.quest.title}
                  >
                    <View style={[s.questTick, q.done && s.questTickDone]}>
                      {q.done ? (
                        <Glyph name="check" size={15} strokeWidth={2.8} color={CHROME.floor} />
                      ) : (
                        <Text style={s.questTickMark}>{i + 1}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={[s.questTitle, q.done && s.questTitleDone]} numberOfLines={2}>
                        {q.quest.title}
                      </Text>
                      {q.quest.goal > 1 && !q.done ? (
                        <View style={s.questTrack}>
                          <View style={s.questTrackRow}>
                            <XPBar progress={q.value / q.quest.goal} height={6} colors={GRADIENT.cool} style={{ flex: 1 }} />
                            <Text style={s.questCount}>
                              {q.value}/{q.quest.goal}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.questXp, q.done && { color: SEMANTIC.solid }]}>+{q.quest.xp}</Text>
                  </PressableScale>
                </Animated.View>
              ))}
            </Rise>
          ) : null}

          {/* Shown once, to the person who has never recorded anything. */}
          {ever === 0 ? (
            <Rise index={4}>
              <Glass style={s.explain}>
                <Text style={s.explainTitle}>What this actually is</Text>
                <Text style={s.explainBody}>
                  You speak for ninety seconds. Speek transcribes it, counts the fillers, the pace and
                  the dead air, and judges the substance separately. Do that most days and the wall
                  below fills in.
                </Text>
                <Text style={s.explainBody}>
                  <Text style={s.explainKey}>Arena</Text> is those ninety seconds.{" "}
                  <Text style={s.explainKey}>Play</Text> is the games and the drills.{" "}
                  <Text style={s.explainKey}>Rooms</Text> is for real meetings — nothing is recorded in
                  one. <Text style={s.explainKey}>You</Text> is your level, badges and the evidence.{" "}
                  <Text style={s.explainKey}>Setup</Text>, top right, is your API key.
                </Text>
              </Glass>
            </Rise>
          ) : null}

          {/* Word of the day. One per day from the glossary, and a way into the Lexicon. */}
          {word ? (
            <Rise index={5}>
              <PressableScale onPress={() => router.push("/lexicon")} scaleTo={0.98} accessibilityLabel="Word of the day">
                <Glass glow={AURORA.mint} style={s.word}>
                  <Text style={[s.kicker, { color: AURORA.mint }]}>WORD OF THE DAY</Text>
                  <View style={s.wordHead}>
                    <Text style={s.wordText}>{word.word}</Text>
                    <Text style={s.wordSay}>{word.say}</Text>
                  </View>
                  <Text style={s.wordMeaning}>{word.meaning}</Text>
                  <Text style={s.wordUse}>Use it out loud once today.</Text>
                </Glass>
              </PressableScale>
            </Rise>
          ) : null}

          {/* The record. */}
          <Rise index={6}>
            <Glass style={s.trend}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Filler rate</Text>
                {last !== undefined ? (
                  <Text style={[s.lastRate, { color: strain(fillerStrain(last)) }]}>
                    {approx ? "≈" : ""}
                    {last.toFixed(1)}/min
                  </Text>
                ) : null}
              </View>
              <StrataWall rates={trend} />
              <Text style={s.trendMeta}>
                {trend.length < 3
                  ? "Three sessions before this means anything."
                  : "The line is five per minute — below it, listeners stop noticing."}
              </Text>
            </Glass>
          </Rise>

          {recent.length > 0 ? (
            <Rise index={7} style={s.section}>
              <Text style={s.sectionTitle}>Recent takes</Text>
              {recent.map((r) => (
                <PressableScale
                  key={r.id}
                  onPress={() => router.push({ pathname: "/scorecard", params: { id: r.id } })}
                  scaleTo={0.98}
                  style={s.row}
                  accessibilityLabel={r.topic_title}
                >
                  <View style={[s.rowDot, { backgroundColor: strain(fillerStrain(r.filler_rate)) }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {r.topic_title}
                    </Text>
                    <Text style={s.rowMeta}>
                      {new Date(r.started_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                      {"  ·  "}
                      {Math.round(r.duration_s)}s{"  ·  "}
                      {r.wpm} wpm
                      {r.rubric_total !== null ? `  ·  ${r.rubric_total}/20` : ""}
                    </Text>
                  </View>
                  <Text style={s.rowRate}>{r.filler_rate.toFixed(1)}</Text>
                </PressableScale>
              ))}
            </Rise>
          ) : null}

          <Text style={s.credo}>
            Speek — <Text style={s.credoIt}>say it like you mean it.</Text>
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hello: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginTop: SPACE.xs },
  helloSmall: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.uiMedium },
  helloBig: { color: CHROME.chalk, fontSize: 34, lineHeight: 40, fontFamily: TYPE.display, letterSpacing: -0.8 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: alpha(AURORA.coral, 0.14),
    borderWidth: 1,
    borderColor: alpha(AURORA.coral, 0.35),
  },
  streakNum: { color: CHROME.chalk, fontSize: 20, fontFamily: TYPE.monoMedium, ...TABULAR },

  level: { paddingVertical: 16 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  levelNum: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.monoMedium, ...TABULAR },
  levelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rank: { color: CHROME.chalk, fontSize: 20, fontFamily: TYPE.displaySoft },
  levelXp: { color: SEMANTIC.xp, fontSize: 12, fontFamily: TYPE.monoMedium, ...TABULAR },
  levelMeta: { color: CHROME.dust, fontSize: 12.5, fontFamily: TYPE.uiMedium },

  hero: { gap: 10 },
  kicker: { color: AURORA.emerald, fontSize: 11.5, letterSpacing: 1.8, fontFamily: TYPE.uiBold },
  heroTitle: { color: CHROME.chalk, fontSize: 28, lineHeight: 34, fontFamily: TYPE.display, letterSpacing: -0.5 },
  heroPrompt: {
    color: CHROME.chalk,
    fontSize: 18,
    lineHeight: 27,
    fontFamily: TYPE.displayItalic,
    borderLeftWidth: 3,
    borderLeftColor: AURORA.plum,
    paddingLeft: 12,
  },
  heroWhy: { color: CHROME.dust, fontSize: 14.5, lineHeight: 22, fontFamily: TYPE.ui },
  again: { color: CHROME.dust, fontSize: 12.5, lineHeight: 19, fontFamily: TYPE.ui, textAlign: "center" },

  section: { gap: 10 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: CHROME.chalk, fontSize: 20, fontFamily: TYPE.displaySoft },
  sectionMeta: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },

  quest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.soft + 4,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  questDone: { backgroundColor: alpha(AURORA.mint, 0.08), borderColor: alpha(AURORA.mint, 0.3) },
  questTick: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: alpha(AURORA.emerald, 0.7),
  },
  questTickDone: { backgroundColor: AURORA.mint, borderColor: AURORA.mint },
  questTickMark: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.uiBold },
  questTitle: { color: CHROME.chalk, fontSize: 15, lineHeight: 20, fontFamily: TYPE.uiMedium },
  questTitleDone: { color: CHROME.dust, textDecorationLine: "line-through" },
  questTrack: { gap: 4 },
  questTrackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  questCount: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  questXp: { color: SEMANTIC.xp, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },

  explain: { gap: 8 },
  explainTitle: { color: CHROME.chalk, fontSize: 19, fontFamily: TYPE.displaySoft },
  explainBody: { color: CHROME.dust, fontSize: 14, lineHeight: 22, fontFamily: TYPE.ui },
  explainKey: { color: CHROME.chalk, fontFamily: TYPE.uiSemi },

  word: { gap: 8 },
  wordHead: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  wordText: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.display, letterSpacing: -0.5 },
  wordSay: { color: AURORA.mint, fontSize: 13, fontFamily: TYPE.mono },
  wordMeaning: { color: CHROME.chalk, fontSize: 17, lineHeight: 26, fontFamily: TYPE.passage },
  wordUse: { color: CHROME.dust, fontSize: 12.5, fontFamily: TYPE.uiMedium },

  trend: { gap: SPACE.md },
  lastRate: { fontSize: 13, fontFamily: TYPE.monoMedium, color: CHROME.dust, ...TABULAR },
  trendMeta: { color: CHROME.dust, fontSize: 12.5, lineHeight: 19, fontFamily: TYPE.ui },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.soft,
    backgroundColor: SURFACE.sunk,
  },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium },
  rowMeta: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  rowRate: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.monoMedium, ...TABULAR },
  credo: { color: CHROME.dustDim, fontSize: 13, marginTop: SPACE.lg, textAlign: "center", fontFamily: TYPE.ui },
  credoIt: { fontFamily: TYPE.displayItalic },
});
