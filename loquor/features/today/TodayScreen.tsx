// Home.
//
// The orb, one line and one button. The button is whatever nextAction says
// matters most right now — usually today's prompt, so the line is the prompt
// itself. Everything else is one tap away: the quests behind a single row, the
// level and streak behind the top line, the record on You. Home used to stack
// eight cards; a screen that asks for eight decisions gets none of them.
//
// The prompt stays deterministic per day: opening the app twice does not reroll
// it. A rerollable prompt turns a commitment into a slot machine, and the point
// is speaking on something you did not pick.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Masthead, Screen } from "../../components/kit/Screen";
import { GlowButton } from "../../components/kit/GlowButton";
import { Glyph } from "../../components/kit/Glyph";
import { PressableScale, Rise } from "../../components/kit/motion";
import { StreakFlame } from "../../components/kit/StreakFlame";
import { VoiceOrb } from "../../components/kit/VoiceOrb";
import { AURORA, CHROME, RADIUS, SPACE, SURFACE, TABULAR, TYPE, alpha } from "../../theme";
import { TOPICS_BY_ID, pickTopic, type Topic } from "../arena/topics";
import { READINGS_BY_ID } from "../reading/readings";
import { celebrate, snapshot, type Progress } from "../progression/progressionStore";
import { nextAction, type Action } from "./nextAction";
import { QuestSheet } from "./QuestSheet";
import {
  countSessions,
  countToday,
  getBaseline,
  lexiconStats,
  pendingDebriefs,
  recentRooms,
  recentSessions,
  recentTakes,
  sectionBests,
  usedTopicIds,
} from "../../lib/db";
import { getKey, loadSettings, resolve } from "../../lib/settings";

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
  const [sheet, setSheet] = useState(false);
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
              recentSessions(1),
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
          setEver(total);
          setDone(todayCount);
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
  // The Arena rungs are the only ones where today's prompt is the thing being
  // pointed at, so it is the only time the prompt is the headline.
  const arena = action?.route === "/arena";
  const streak = progress?.streak;
  const quests = progress?.quests ?? [];
  const questsDone = quests.filter((q) => q.done).length;

  const open = (route: string) => {
    if (route === "/arena") {
      if (topic) router.push({ pathname: "/arena", params: { topicId: topic.id } });
      return;
    }
    router.push(route as never);
  };

  const openQuest = (route: string) => {
    setSheet(false);
    open(route);
  };

  return (
    <Screen>
      <Masthead setup />

      {ready ? (
        <>
          {/* One thin line: who, the streak, the level. All of it taps through
              to You, where the detail lives. */}
          <Rise index={0}>
            <PressableScale onPress={() => router.push("/you")} scaleTo={0.98} style={s.top} accessibilityLabel="Your streak and level">
              <Text style={s.hello} numberOfLines={1}>
                {greeting(now.getHours())}
              </Text>
              <View style={s.topRight}>
                <View style={s.chip}>
                  <StreakFlame size={18} alive={(streak?.current ?? 0) > 0} hot={streak?.activeToday ?? false} />
                  <Text style={[s.chipNum, !streak?.current && { color: CHROME.dust }]}>{streak?.current ?? 0}</Text>
                </View>
                <View style={s.chip}>
                  <Text style={s.chipText}>
                    Level {progress?.level.level ?? 1}
                    {progress ? ` · ${progress.level.rank}` : ""}
                  </Text>
                </View>
              </View>
            </PressableScale>
          </Rise>

          {/* The orb, one line and one button. Re-keyed on the action id so it
              re-enters when the ladder moves on, which is the feedback that
              finishing something counted. */}
          <Rise key={action?.id ?? "none"} index={1} style={s.stage}>
            <VoiceOrb size={200} mood={questsDone > 0 && questsDone === quests.length ? "happy" : "idle"} />
            <Text style={[s.kicker, action?.urgent && { color: AURORA.coral }]}>{action?.eyebrow ?? " "}</Text>
            <Text style={s.line}>{arena && topic ? topic.title : (action?.title ?? " ")}</Text>
            {!arena && action ? <Text style={s.why}>{action.why}</Text> : null}
            <GlowButton
              label={action?.cta ?? " "}
              onPress={() => action && open(action.route)}
              disabled={!action || (arena && !topic)}
              style={s.cta}
            />
            {done > 0 && arena ? (
              <Text style={s.again}>
                {done} {done === 1 ? "take" : "takes"} today. The second is usually the keeper.
              </Text>
            ) : null}
          </Rise>

          {quests.length > 0 ? (
            <Rise index={2}>
              <PressableScale onPress={() => setSheet(true)} scaleTo={0.98} style={s.questRow} accessibilityLabel="Today's quests">
                <View style={s.questDots}>
                  {quests.map((q) => (
                    <View key={q.quest.id} style={[s.questDot, q.done && s.questDotDone]} />
                  ))}
                </View>
                <Text style={s.questText}>
                  {questsDone} of {quests.length} quests done
                </Text>
                <Glyph name="chevron" size={16} color={CHROME.dust} />
              </PressableScale>
            </Rise>
          ) : null}

          <Rise index={3}>
            <PressableScale onPress={() => router.push("/voicenote")} scaleTo={0.97} style={s.voiceNote} accessibilityLabel="Record a voice note">
              <Glyph name="mic" size={16} color={AURORA.mint} />
              <Text style={s.voiceNoteText}>Record a voice note, check it, then send it</Text>
            </PressableScale>
          </Rise>

          {/* Shown once, to the person who has never recorded anything. */}
          {ever === 0 ? (
            <Rise index={4}>
              <Text style={s.explain}>
                You talk for ninety seconds. PipeUp counts your fillers, pace and pauses, and tells
                you one thing to say better. That is the whole loop.
              </Text>
            </Rise>
          ) : null}

          <QuestSheet quests={quests} visible={sheet} onClose={() => setSheet(false)} onOpen={openQuest} />
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm, marginTop: SPACE.xs },
  hello: { flex: 1, color: CHROME.dust, fontSize: 15, fontFamily: TYPE.uiMedium },
  topRight: { flexDirection: "row", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  chipNum: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.monoMedium, ...TABULAR },
  chipText: { color: CHROME.chalk, fontSize: 12.5, fontFamily: TYPE.uiSemi },

  stage: { alignItems: "center", gap: 12, marginTop: SPACE.lg },
  kicker: { color: AURORA.emerald, fontSize: 13, fontFamily: TYPE.uiSemi, marginTop: SPACE.sm },
  line: {
    color: CHROME.chalk,
    fontSize: 26,
    lineHeight: 33,
    fontFamily: TYPE.display,
    letterSpacing: -0.4,
    textAlign: "center",
    paddingHorizontal: SPACE.sm,
  },
  why: { color: CHROME.dust, fontSize: 14, lineHeight: 21, fontFamily: TYPE.ui, textAlign: "center", paddingHorizontal: SPACE.md },
  cta: { alignSelf: "stretch", marginTop: SPACE.xs },
  again: { color: CHROME.dust, fontSize: 12.5, fontFamily: TYPE.ui, textAlign: "center" },

  questRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.soft + 4,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    marginTop: SPACE.sm,
  },
  questDots: { flexDirection: "row", gap: 4 },
  questDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: alpha(AURORA.emerald, 0.7) },
  questDotDone: { backgroundColor: AURORA.mint, borderColor: AURORA.mint },
  questText: { flex: 1, color: CHROME.chalk, fontSize: 14.5, fontFamily: TYPE.uiMedium },

  voiceNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  voiceNoteText: { color: AURORA.mint, fontSize: 14, fontFamily: TYPE.uiMedium },

  explain: { color: CHROME.dust, fontSize: 13.5, lineHeight: 21, fontFamily: TYPE.ui, textAlign: "center", paddingHorizontal: SPACE.md },
});
