// Today.
//
// One prompt, chosen for you. The topic is deterministic per day so opening the
// app twice does not reroll it — a rerollable prompt turns a commitment into a
// slot machine, and the whole point is speaking on something you did not pick.

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";

import { Body, Button, Display, Eyebrow, Hair, Masthead, Meta, Screen } from "../components/ui";
import { StrataWall, fillerStrain, strain } from "../components/viz";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE } from "../theme";
import { TOPICS, TOPICS_BY_ID, pickTopic, type Topic } from "../content/topics";
import {
  READINGS_BY_ID,
  pickReading,
  readingMinutes,
  type Reading,
} from "../content/readings";
import { coverage } from "../lib/skillStore";
import { activeDays } from "../lib/progressStore";
import { consistency, dayOf } from "../lib/progress";
import {
  countToday,
  getBaseline,
  fillerTrend,
  lexiconStats,
  pendingDebriefs,
  recentRooms,
  recentSessions,
  recentTakes,
  sectionBests,
  usedReadingIds,
  usedTopicIds,
  type SessionRow,
} from "../lib/db";
import { fillerCountIsApproximate, loadSettings, resolve } from "../lib/settings";

export default function Today() {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState(0);
  const [trend, setTrend] = useState<number[]>([]);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [approx, setApprox] = useState(true);
  const [reading, setReading] = useState<Reading | null>(null);
  const [nextSection, setNextSection] = useState(1);
  const [sectionsDone, setSectionsDone] = useState(0);
  const [lex, setLex] = useState<{ seen: number; dueNow: number; productionOwned: number } | null>(
    null
  );
  const [duePreps, setDuePreps] = useState(0);
  const [roomCount, setRoomCount] = useState(0);
  const [cover, setCover] = useState<{ tried: number; solid: number; total: number } | null>(null);
  const [baselined, setBaselined] = useState(true);
  const [days, setDays] = useState<{ active: number; window: number } | null>(null);

  // Refetch on focus rather than on mount: coming back from a scorecard should
  // show the session that was just recorded.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const settings = await loadSettings();
        const { stt } = resolve(settings);
        const [used, todayCount, rows, readUsed, takes, stats, due, roomRows, cov, base, active] =
          await Promise.all([
            usedTopicIds(),
            countToday(),
            recentSessions(8),
            usedReadingIds(),
            recentTakes(1),
            lexiconStats(),
            pendingDebriefs(),
            recentRooms(30),
            coverage(),
            getBaseline(),
            activeDays(),
          ]);
        const lastDomain = rows[0] ? TOPICS_BY_ID.get(rows[0].topic_id)?.domain : undefined;
        const lastRead = takes[0] ? READINGS_BY_ID.get(takes[0].reading_id)?.domain : undefined;

        // A reading is a week's work, not a day's, so the one already in progress
        // outranks whatever today's rotation would have chosen. You finish a
        // piece before you start another one.
        const inProgress = takes[0] ? READINGS_BY_ID.get(takes[0].reading_id) : undefined;
        const bests = inProgress ? await sectionBests(inProgress.id) : null;
        const unfinished =
          inProgress && bests && bests.size < inProgress.sections.length ? inProgress : null;
        const chosen = unfinished ?? pickReading({ usedIds: readUsed, lastDomain: lastRead });
        const chosenBests = chosen === unfinished ? bests! : await sectionBests(chosen.id);
        const nextN = chosen.sections.find((sec) => !chosenBests.has(sec.n))?.n ?? 1;

        const rates = await fillerTrend(stt, 30);
        if (!live) return;
        setApprox(fillerCountIsApproximate(stt));
        setTopic(pickTopic({ usedIds: used, lastDomain }));
        setReading(chosen);
        setNextSection(nextN);
        setSectionsDone(chosenBests.size);
        setLex(stats);
        setDuePreps(due.length);
        setRoomCount(roomRows.filter((r) => r.debriefed_at !== null).length);
        setCover(cov);
        setBaselined(base !== null);
        const con = consistency(active, dayOf(Date.now()));
        setDays({ active: con.active, window: con.window });
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

  return (
    <Screen>
      <Masthead right={new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toUpperCase()} />

      {/* The baseline outranks today's prompt exactly once, and then never
          appears again — every figure on Progress is measured against it, so
          taking it after a fortnight of practice would measure the practice. */}
      {!baselined ? (
        <Pressable
          onPress={() => router.push("/onboarding")}
          style={({ pressed }) => [s.passage, s.due, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.passageTitle}>Record your baseline first</Text>
          <Text style={s.passageWords} numberOfLines={2}>
            Ninety seconds, once, before any of this coaches you. Nothing else measures anything
            until it exists.
          </Text>
        </Pressable>
      ) : null}

      <View style={s.head}>
        <Eyebrow>{done > 0 ? "DONE TODAY" : "TODAY"}</Eyebrow>
        {topic ? <Eyebrow style={s.domain}>{topic.domain === "field" ? "YOUR FIELD" : "OFF-PISTE"}</Eyebrow> : null}
      </View>

      <Display>{topic?.title ?? " "}</Display>

      {done > 0 ? (
        <Meta>
          {done} {done === 1 ? "take" : "takes"} today. Going again is free — the second one is
          usually the one worth keeping.
        </Meta>
      ) : (
        <Meta>Sixty seconds of primer, ninety seconds of talking. That is the whole thing.</Meta>
      )}

      <Button
        label={done > 0 ? "GO AGAIN" : "ENTER THE ARENA"}
        tone={done > 0 ? "ghost" : "primary"}
        onPress={() => topic && router.push({ pathname: "/arena", params: { topicId: topic.id } })}
        disabled={!topic}
      />

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* The Arena has you invent language. This has you execute it. Both are
          speaking practice and they train opposite halves of the same skill, so
          the second one is not buried behind a menu. */}
      <View style={s.head}>
        <Eyebrow>ALSO TODAY · READ ALOUD</Eyebrow>
        {reading ? (
          <Text style={s.lastRate}>
            {sectionsDone}/{reading.sections.length}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() =>
          reading &&
          router.push({
            pathname: "/read",
            params: { readingId: reading.id, section: String(nextSection) },
          })
        }
        style={({ pressed }) => [s.passage, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.passageTitle}>{reading?.title ?? " "}</Text>
        <Text style={s.passageWords} numberOfLines={2}>
          {reading
            ? `${sectionsDone > 0 ? "Next up" : "Section 1"} — ${reading.sections[nextSection - 1]?.heading ?? ""}`
            : " "}
        </Text>
      </Pressable>
      <Meta>
        {reading
          ? `About ${Math.round(readingMinutes(reading))} minutes end to end, in ${reading.sections.length} sittings. One section is under two.`
          : " "}
      </Meta>

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* The two speaking drills train the mouth. This trains the supply of words
          it has to reach for, which is the constraint most of the time. */}
      <View style={s.head}>
        <Eyebrow>THE LEXICON</Eyebrow>
        {lex ? (
          <Text style={s.lastRate}>
            {lex.productionOwned} owned
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => router.push("/lexicon")}
        style={({ pressed }) => [s.passage, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.passageTitle}>
          {lex === null
            ? " "
            : lex.dueNow > 0
              ? `${lex.dueNow} due`
              : lex.seen === 0
                ? "Start the corpus"
                : "Nothing due"}
        </Text>
        <Text style={s.passageWords} numberOfLines={2}>
          {lex === null
            ? " "
            : lex.seen === 0
              ? "Four words to begin with. Recognition first, then you have to say them."
              : `${lex.seen} words in play · a word counts as yours only once you have used it out loud`}
        </Text>
      </Pressable>

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* Everything above trains the voice on your own time. These three are
          about the rooms with other people in them, which is where the point of
          all of it actually lands. A waiting debrief outranks them both — the
          window in which you still remember what you did not say is short. */}
      {duePreps > 0 ? (
        <Pressable
          onPress={() => router.push("/rooms")}
          style={({ pressed }) => [s.passage, s.due, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.passageTitle}>
            {duePreps} {duePreps === 1 ? "debrief" : "debriefs"} waiting
          </Text>
          <Text style={s.passageWords} numberOfLines={2}>
            Ninety seconds, while you still remember what you nearly said.
          </Text>
        </Pressable>
      ) : null}

      <View style={s.head}>
        <Eyebrow>ROOMS</Eyebrow>
        <Text style={s.lastRate}>{roomCount > 0 ? `${roomCount} logged` : "none yet"}</Text>
      </View>
      <Pressable
        onPress={() => router.push("/rooms")}
        style={({ pressed }) => [s.passage, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.passageTitle}>Prep a real meeting</Text>
        <Text style={s.passageWords} numberOfLines={2}>
          Three questions and one intention before you walk in. Nothing is ever recorded in the
          room.
        </Text>
      </Pressable>

      <View style={s.head}>
        <Eyebrow>THE PLAYBOOK</Eyebrow>
        {cover ? (
          <Text style={s.lastRate}>
            {cover.tried}/{cover.total}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => router.push("/playbook")}
        style={({ pressed }) => [s.passage, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.passageTitle}>
          {cover === null ? " " : cover.tried === 0 ? "Thirty questions to own" : "Drill the weakest one"}
        </Text>
        <Text style={s.passageWords} numberOfLines={2}>
          {cover === null
            ? " "
            : `${cover.solid} solid · one snippet, one move, one question out loud`}
        </Text>
      </Pressable>

      <View style={s.head}>
        <Eyebrow>THE LAB</Eyebrow>
      </View>
      <Pressable
        onPress={() => router.push("/lab")}
        style={({ pressed }) => [s.passage, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.passageTitle}>Argue it, or meet someone</Text>
        <Text style={s.passageWords} numberOfLines={2}>
          Five structures for making a case, and a stranger who will not tell you the interesting
          part until you earn it.
        </Text>
      </Pressable>

      <Hair style={{ marginTop: SPACE.sm }} />

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

      {recent.length > 0 ? (
        <>
          <Hair style={{ marginTop: SPACE.sm }} />
          <Eyebrow>RECENT</Eyebrow>
          <View style={s.list}>
            {recent.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push({ pathname: "/scorecard", params: { id: r.id } })}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
              >
                <View
                  style={[s.rowTick, { backgroundColor: strain(fillerStrain(r.filler_rate)) }]}
                />
                <View style={s.rowText}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {r.topic_title}
                  </Text>
                  <Text style={s.rowMeta}>
                    {new Date(r.started_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    {"  ·  "}
                    {Math.round(r.duration_s)}s
                    {"  ·  "}
                    {r.wpm} wpm
                    {r.rubric_total !== null ? `  ·  ${r.rubric_total}/20` : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Hair style={{ marginTop: SPACE.sm }} />
      <View style={s.head}>
        <Eyebrow>THE RECORD</Eyebrow>
        {days ? (
          <Text style={s.lastRate}>
            {days.active}/{days.window} days
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => router.push("/progress")}
        style={({ pressed }) => [s.passage, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.passageTitle}>What the last four weeks say</Text>
        <Text style={s.passageWords} numberOfLines={2}>
          Consistency, delivery, the ninety-day table, and one paragraph on the week that just
          ended.
        </Text>
      </Pressable>

      <Hair style={{ marginTop: SPACE.sm }} />
      <View style={s.foot}>
        <Link href="/settings" asChild>
          <Pressable hitSlop={10}>
            <Text style={s.footLink}>SETTINGS</Text>
          </Pressable>
        </Link>
        <Text style={s.footMeta}>
          {TOPICS.length} topics · {recent.length > 0 ? `${trend.length} recorded` : "none recorded"}
        </Text>
      </View>
      <Body style={s.credo}>
        Loquor — <Text style={s.credoIt}>I speak.</Text>
      </Body>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  domain: { color: CHROME.dust },
  lastRate: { fontSize: 13, fontFamily: TYPE.uiMedium, ...TABULAR },
  passage: {
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 5,
  },
  due: { borderColor: SEMANTIC.ember },
  passageTitle: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.display },
  passageWords: { color: CHROME.dust, fontSize: 12, lineHeight: 19, fontFamily: TYPE.displayItalic },
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowTick: { width: 3, alignSelf: "stretch", minHeight: 26 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
  rowMeta: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui, ...TABULAR },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footLink: { color: CHROME.dust, fontSize: 10, letterSpacing: 2.4, fontFamily: TYPE.uiMedium },
  footMeta: { color: CHROME.dustDim, fontSize: 10, fontFamily: TYPE.ui },
  credo: { color: CHROME.dustDim, fontSize: 12, marginTop: SPACE.lg, textAlign: "center" },
  credoIt: { fontFamily: TYPE.displayItalic },
});
