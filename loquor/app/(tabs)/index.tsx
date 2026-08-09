// Today.
//
// One instruction, chosen by lib/nextAction. The screen used to open with nine
// unranked cards, which is legible only if you already know what the app is
// for; a first-time user's honest reaction to it was "what am I supposed to do
// here." So the top of this screen is now a single answer, and everything below
// it is the record — evidence, not choices. The choices live under Practice.
//
// The prompt itself stays deterministic per day: opening the app twice does not
// reroll it. A rerollable prompt turns a commitment into a slot machine, and
// the point is speaking on something you did not pick.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import {
  Body,
  Button,
  Eyebrow,
  Hair,
  Masthead,
  Meta,
  Pulse,
  Reveal,
  Screen,
  Tap,
} from "../../components/ui";
import { StrataWall, fillerStrain, strain } from "../../components/viz";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE } from "../../theme";
import { TOPICS_BY_ID, pickTopic, type Topic } from "../../content/topics";
import { READINGS_BY_ID } from "../../content/readings";
import { activeDays } from "../../lib/progressStore";
import { consistency, dayOf } from "../../lib/progress";
import { nextAction, type Action } from "../../lib/nextAction";
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

export default function Today() {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState(0);
  const [trend, setTrend] = useState<number[]>([]);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [approx, setApprox] = useState(true);
  const [days, setDays] = useState<{ active: number; window: number } | null>(null);
  const [ever, setEver] = useState<number | null>(null);

  // Refetch on focus rather than on mount: coming back from a scorecard should
  // move the ladder on, not show the instruction you have just completed.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const settings = await loadSettings();
        const { stt } = resolve(settings);
        const [key, used, todayCount, rows, takes, stats, due, roomRows, base, active, total] =
          await Promise.all([
            getKey(stt),
            usedTopicIds(),
            countToday(),
            recentSessions(6),
            recentTakes(1),
            lexiconStats(),
            pendingDebriefs(),
            recentRooms(50),
            getBaseline(),
            activeDays(),
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
        const con = consistency(active, dayOf(now));
        setDays({ active: con.active, window: con.window });
        setEver(total);
        setDone(todayCount);
        setRecent(rows);
        setTrend(rates);
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const last = trend[trend.length - 1];
  // The Arena rungs are the only ones where today's prompt is the thing being
  // pointed at, so it is the only place the prompt is worth showing up top.
  const arena = action?.route === "/arena";

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
      <Masthead
        right={new Date()
          .toLocaleDateString(undefined, { day: "2-digit", month: "short" })
          .toUpperCase()}
      />

      {/* The hero. One instruction, and the reason it is the one. Re-keyed on
          the action id so it re-enters when the ladder moves on, which is the
          only feedback that completing something changed anything. */}
      <Reveal key={action?.id ?? "loading"} index={0}>
        <View style={[s.hero, action?.urgent && s.heroUrgent]}>
          <Pulse active={action?.urgent === true} style={s.heroBar}>
            <View style={s.heroBarFill} />
          </Pulse>
          <View style={s.heroBody}>
            <Eyebrow style={action?.urgent ? s.eyebrowUrgent : undefined}>
              {action?.eyebrow ?? " "}
            </Eyebrow>
            <Text style={s.heroTitle}>{action?.title ?? " "}</Text>
            {arena && topic ? <Text style={s.heroPrompt}>{topic.title}</Text> : null}
            <Text style={s.heroWhy}>{action?.why ?? " "}</Text>
            <Button
              label={action?.cta ?? " "}
              onPress={go}
              disabled={!action || (arena && !topic)}
            />
          </View>
        </View>
      </Reveal>

      {/* Shown once, to the person who has never recorded anything. After the
          first take the app has real numbers to talk about and does not need
          to explain itself. */}
      {ever === 0 ? (
        <Reveal index={1} style={s.explain}>
          <Text style={s.explainTitle}>What this actually is</Text>
          <Text style={s.explainBody}>
            You speak for ninety seconds. It transcribes what you said, counts the fillers, the
            pace and the dead air, and judges the substance separately. Do that most days and the
            wall below fills in.
          </Text>
          <Text style={s.explainBody}>
            <Text style={s.explainKey}>Practice</Text> holds the five drills.{" "}
            <Text style={s.explainKey}>Rooms</Text> is for real meetings — nothing is ever recorded
            in one. <Text style={s.explainKey}>Progress</Text> is the evidence.{" "}
            <Text style={s.explainKey}>Setup</Text> is your API key.
          </Text>
        </Reveal>
      ) : null}

      {/* Secondary offer: a second take is never an obligation, so it is a
          quiet line rather than a card competing with the hero. */}
      {done > 0 && !arena ? (
        <Meta>
          {done} {done === 1 ? "take" : "takes"} today. Going again is free — the second one is
          usually the one worth keeping.
        </Meta>
      ) : null}

      <Hair style={{ marginTop: SPACE.sm }} />

      <Reveal index={2} style={s.block}>
        <View style={s.head}>
          <Eyebrow>FILLER RATE · LAST {Math.min(30, trend.length) || 30}</Eyebrow>
          {last !== undefined ? (
            <Text style={[s.lastRate, { color: strain(fillerStrain(last)) }]}>
              {approx ? "≈" : ""}
              {last.toFixed(1)}/min
            </Text>
          ) : null}
        </View>
        <StrataWall rates={trend} />
        <Meta>
          {trend.length < 3
            ? "Three sessions before this means anything."
            : "The hairline is five per minute — the point below which listeners stop noticing."}
        </Meta>
      </Reveal>

      {recent.length > 0 ? (
        <>
          <Hair style={{ marginTop: SPACE.sm }} />
          <View style={s.head}>
            <Eyebrow>RECENT</Eyebrow>
            {days ? (
              <Text style={s.lastRate}>
                {days.active}/{days.window} days
              </Text>
            ) : null}
          </View>
          <View style={s.list}>
            {recent.map((r, i) => (
              <Reveal key={r.id} index={4 + i}>
                <Tap
                  onPress={() => router.push({ pathname: "/scorecard", params: { id: r.id } })}
                  style={s.row}
                >
                  <View
                    style={[s.rowTick, { backgroundColor: strain(fillerStrain(r.filler_rate)) }]}
                  />
                  <View style={s.rowText}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {r.topic_title}
                    </Text>
                    <Text style={s.rowMeta}>
                      {new Date(r.started_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                      {"  ·  "}
                      {Math.round(r.duration_s)}s
                      {"  ·  "}
                      {r.wpm} wpm
                      {r.rubric_total !== null ? `  ·  ${r.rubric_total}/20` : ""}
                    </Text>
                  </View>
                </Tap>
              </Reveal>
            ))}
          </View>
        </>
      ) : null}

      <Body style={s.credo}>
        Loquor — <Text style={s.credoIt}>I speak.</Text>
      </Body>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: {
    flexDirection: "row",
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    borderRadius: RADIUS.panel,
    overflow: "hidden",
  },
  heroUrgent: { borderColor: SEMANTIC.ember },
  // The one bar of colour on the screen that is not data. It earns its place by
  // being the thing your eye lands on before you have read a word, and it
  // breathes only when the thing it marks is blocking or expiring.
  heroBar: { width: 3 },
  heroBarFill: { flex: 1, backgroundColor: SEMANTIC.ember },
  heroBody: { flex: 1, paddingHorizontal: 18, paddingVertical: 18, gap: 9 },
  eyebrowUrgent: { color: SEMANTIC.ember },
  heroTitle: { color: CHROME.chalk, fontSize: 27, lineHeight: 33, fontFamily: TYPE.display },
  heroPrompt: {
    color: CHROME.dust,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: TYPE.displayItalic,
    borderLeftWidth: 1,
    borderLeftColor: SURFACE.edgeLive,
    paddingLeft: 12,
  },
  heroWhy: { color: CHROME.dust, fontSize: 13, lineHeight: 21, fontFamily: TYPE.ui, marginBottom: 2 },

  explain: { gap: 8, paddingTop: SPACE.xs },
  explainTitle: { color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.display },
  explainBody: { color: CHROME.dust, fontSize: 12.5, lineHeight: 20, fontFamily: TYPE.ui },
  explainKey: { color: CHROME.chalk, fontFamily: TYPE.uiMedium },

  block: { gap: SPACE.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastRate: { fontSize: 12, fontFamily: TYPE.monoMedium, color: CHROME.dust, ...TABULAR },
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowTick: { width: 3, alignSelf: "stretch", minHeight: 26 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
  rowMeta: { color: CHROME.dustDim, fontSize: 9.5, fontFamily: TYPE.mono, ...TABULAR },
  credo: { color: CHROME.dustDim, fontSize: 12, marginTop: SPACE.lg, textAlign: "center" },
  credoIt: { fontFamily: TYPE.displayItalic },
});
