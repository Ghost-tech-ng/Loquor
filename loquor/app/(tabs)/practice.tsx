// Practice — every drill in one place, each explained.
//
// These five used to be stacked down the Today screen as equal-weight cards
// with two-line taglines, which asked a first-time user to choose between five
// things they had no way to distinguish. Today now hands out one instruction;
// this is where you come when you want to pick for yourself.
//
// So each card says what it *trains*, not what it is. "The Lab" means nothing
// to someone who has never opened it. "Five ways to make a case, and a stranger
// who won't tell you the interesting part until you earn it" means something.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Eyebrow, Hair, Masthead, Meta, Reveal, Screen, Tap } from "../../components/ui";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE } from "../../theme";
import { READINGS_BY_ID, pickReading, readingMinutes, type Reading } from "../../content/readings";
import { TOPICS_BY_ID, pickTopic, type Topic } from "../../content/topics";
import { coverage } from "../../lib/skillStore";
import {
  countToday,
  lexiconStats,
  recentSessions,
  recentTakes,
  sectionBests,
  usedReadingIds,
  usedTopicIds,
} from "../../lib/db";

type Drill = {
  key: string;
  name: string;
  /** What it trains. One line, in the second person, no feature names. */
  trains: string;
  /** How long it takes and what happens. */
  shape: string;
  /** Live state, right-aligned. Null while loading. */
  status: string | null;
  go: () => void;
};

export default function Practice() {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [nextSection, setNextSection] = useState(1);
  const [sectionsDone, setSectionsDone] = useState(0);
  const [takesToday, setTakesToday] = useState(0);
  const [lex, setLex] = useState<{ seen: number; dueNow: number; productionOwned: number } | null>(
    null
  );
  const [cover, setCover] = useState<{ tried: number; solid: number; total: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const [used, rows, readUsed, takes, stats, cov, today] = await Promise.all([
          usedTopicIds(),
          recentSessions(1),
          usedReadingIds(),
          recentTakes(1),
          lexiconStats(),
          coverage(),
          countToday(),
        ]);

        // A reading is a week's work, not a day's, so the piece already in
        // progress outranks whatever the rotation would have picked next.
        const inProgress = takes[0] ? READINGS_BY_ID.get(takes[0].reading_id) : undefined;
        const bests = inProgress ? await sectionBests(inProgress.id) : null;
        const unfinished =
          inProgress && bests && bests.size < inProgress.sections.length ? inProgress : null;
        const lastRead = takes[0] ? READINGS_BY_ID.get(takes[0].reading_id)?.domain : undefined;
        const chosen = unfinished ?? pickReading({ usedIds: readUsed, lastDomain: lastRead });
        const chosenBests = chosen === unfinished ? bests! : await sectionBests(chosen.id);
        const nextN = chosen.sections.find((sec) => !chosenBests.has(sec.n))?.n ?? 1;

        if (!live) return;
        setTopic(pickTopic({ usedIds: used, lastDomain: rows[0] ? TOPICS_BY_ID.get(rows[0].topic_id)?.domain : undefined }));
        setReading(chosen);
        setNextSection(nextN);
        setSectionsDone(chosenBests.size);
        setLex(stats);
        setCover(cov);
        setTakesToday(today);
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const drills: Drill[] = [
    {
      key: "arena",
      name: "The Arena",
      trains: "Saying something worth hearing when you had a minute to think, not a week.",
      shape:
        "A prompt you did not choose, sixty seconds to gather it, ninety to talk. You get back your filler rate, your pace, where you stalled, and one line you should have said better.",
      status: takesToday > 0 ? `${takesToday} today` : "not yet today",
      go: () =>
        router.push(topic ? { pathname: "/arena", params: { topicId: topic.id } } : "/arena"),
    },
    {
      key: "read",
      name: "Read aloud",
      trains: "Your mouth, on words you already understand but have never actually said.",
      shape: reading
        ? `"${reading.title}" — about ${Math.round(readingMinutes(reading))} minutes end to end, split into ${reading.sections.length} sittings of under two. It reads back what you mispronounced and what you rushed.`
        : "A long piece, read a section at a time. It reads back what you mispronounced and what you rushed.",
      status: reading ? `${sectionsDone}/${reading.sections.length}` : null,
      go: () =>
        router.push(
          reading
            ? { pathname: "/read", params: { readingId: reading.id, section: String(nextSection) } }
            : "/lexicon"
        ),
    },
    {
      key: "lexicon",
      name: "The Lexicon",
      trains: "The supply of words your mouth can reach for. Usually the real constraint.",
      shape:
        "Words like nuance, hindsight, consensus — ones you recognise but never produce. Recognition first, then you have to say one in a sentence of your own. A word is only yours once you have used it out loud in a real room.",
      status:
        lex === null
          ? null
          : lex.dueNow > 0
            ? `${lex.dueNow} due`
            : lex.seen === 0
              ? "not started"
              : `${lex.productionOwned} owned`,
      go: () => router.push("/lexicon"),
    },
    {
      key: "playbook",
      name: "The Playbook",
      trains: "Asking the question that changes the room, instead of the one that fills silence.",
      shape:
        "Thirty named moves — the assumption check, the second-order question, the disagreement that lands. One meeting snippet, one move, one question said out loud, and what the room would most likely say back.",
      status: cover === null ? null : `${cover.tried}/${cover.total} tried`,
      go: () => router.push("/playbook"),
    },
    {
      key: "lab",
      name: "The Lab",
      trains: "Making a case, and getting past small talk with someone you just met.",
      shape:
        "Five structures for arguing a position under pressure, and a stranger who will not hand you the interesting part of their work until you ask well enough to earn it.",
      status: null,
      go: () => router.push("/lab"),
    },
  ];

  return (
    <Screen>
      <Masthead right="PRACTICE" />

      <Reveal index={0} style={s.intro}>
        <Text style={s.introTitle}>Five drills. All of them end in you talking.</Text>
        <Text style={s.introBody}>
          Nothing here is a quiz. You speak, it transcribes what you actually said, and it counts
          the things you cannot hear yourself doing. Start anywhere — the Arena is the whole product
          in three minutes.
        </Text>
      </Reveal>

      <Hair />

      <View style={s.list}>
        {drills.map((d, i) => (
          <Reveal key={d.key} index={i + 1}>
            <Tap onPress={d.go} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.index}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={s.name}>{d.name}</Text>
                <View style={s.spacer} />
                {d.status ? <Text style={s.status}>{d.status}</Text> : null}
              </View>
              <Text style={s.trains}>{d.trains}</Text>
              <Text style={s.shape}>{d.shape}</Text>
            </Tap>
          </Reveal>
        ))}
      </View>

      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>IF YOU ONLY HAVE FIVE MINUTES</Eyebrow>
      <Meta>
        One Arena take. Everything else compounds slowly; that one is the measurement, and the
        record on Progress is built out of it.
      </Meta>
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { gap: 7 },
  introTitle: { color: CHROME.chalk, fontSize: 22, lineHeight: 28, fontFamily: TYPE.display },
  introBody: { color: CHROME.dust, fontSize: 13, lineHeight: 21, fontFamily: TYPE.ui },

  list: { gap: 10 },
  card: {
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 7,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  // The number is the reading order, not a ranking — it is there so the five
  // read as one set rather than five unrelated offers.
  index: { color: SEMANTIC.ember, fontSize: 9.5, fontFamily: TYPE.monoMedium, ...TABULAR },
  name: { color: CHROME.chalk, fontSize: 19, fontFamily: TYPE.display, letterSpacing: -0.3 },
  spacer: { flex: 1 },
  status: { color: CHROME.dustDim, fontSize: 9.5, fontFamily: TYPE.mono, ...TABULAR },
  trains: { color: CHROME.chalk, fontSize: 13, lineHeight: 20, fontFamily: TYPE.displayItalic },
  shape: { color: CHROME.dust, fontSize: 12, lineHeight: 19, fontFamily: TYPE.ui },
});
