// Play — the games, then the training drills.
//
// Games go first because they are the reason to open this tab when you have
// four minutes and no plan. The drills underneath are the same five that lived
// on Practice, still described by what they *train* rather than what they are:
// "The Lab" means nothing to someone who has never opened it.
//
// The Arena is not here. It is the measurement the rest of the app exists to
// move, so it keeps its own tab rather than reading as one option among equals.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { Masthead, Screen } from "../../components/ui";
import { Glass } from "../../components/kit/Glass";
import { PressableScale, Rise } from "../../components/kit/motion";
import { feel } from "../../components/kit/feel";
import { AURORA, CHROME, RADIUS, SPACE, SURFACE, TABULAR, TYPE, alpha } from "../../theme";
import { READINGS_BY_ID, pickReading, readingMinutes, type Reading } from "../reading/readings";
import { GAMES_LIVE } from "../progression/progressionStore";
import { coverage } from "../../lib/skillStore";
import {
  lexiconStats,
  recentTakes,
  sectionBests,
  usedReadingIds,
  valveThresholds,
} from "../../lib/db";

type Game = {
  key: string;
  name: string;
  emoji: string;
  hook: string;
  /** Two stops: the card's own colour, so the five never blur into one. */
  tint: readonly [string, string];
  tag: string;
};

const GAMES: Game[] = [
  {
    key: "alive",
    name: "Bring It to Life",
    emoji: "🤖",
    hook: "Start as a robot. Your melody, punch and rhythm turn it back into you.",
    tint: [AURORA.pink, AURORA.violet],
    tag: "VOICE",
  },
  {
    key: "gauntlet",
    name: "No-Um Gauntlet",
    emoji: "🛡️",
    hook: "Rounds from 20 seconds to 90. Three hearts. Every um costs one.",
    tint: [AURORA.coral, AURORA.gold],
    tag: "FOCUS",
  },
  {
    key: "pause",
    name: "Pause, Don't Um",
    emoji: "⏸️",
    hook: "Talk until the gate flashes, then hold a clean silence. Live, no waiting.",
    tint: [AURORA.teal, AURORA.sky],
    tag: "LIVE",
  },
  {
    key: "bomb",
    name: "Word Bomb",
    emoji: "💣",
    hook: "A word drops with a lit fuse. Use it in a sentence out loud before it blows.",
    tint: [AURORA.gold, AURORA.coral],
    tag: "SPEAK",
  },
  {
    key: "blitz",
    name: "Lexicon Blitz",
    emoji: "⚡",
    hook: "Sixty seconds, a definition, four words. Combos stack, and it counts as review.",
    tint: [AURORA.violet, AURORA.teal],
    tag: "TAP",
  },
];

type Drill = {
  key: string;
  name: string;
  emoji: string;
  /** What it trains. One line, in the second person, no feature names. */
  trains: string;
  /** Live state, right-aligned. Null while loading. */
  status: string | null;
  go: () => void;
};

export default function Play() {
  const router = useRouter();
  const [reading, setReading] = useState<Reading | null>(null);
  const [nextSection, setNextSection] = useState(1);
  const [sectionsDone, setSectionsDone] = useState(0);
  const [lex, setLex] = useState<{ seen: number; dueNow: number; productionOwned: number } | null>(
    null
  );
  const [cover, setCover] = useState<{ tried: number; solid: number; total: number } | null>(null);
  const [valveThreshold, setValveThreshold] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const [readUsed, takes, stats, cov, valve] = await Promise.all([
          usedReadingIds(),
          recentTakes(1),
          lexiconStats(),
          coverage(),
          valveThresholds(1),
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
        setReading(chosen);
        setNextSection(nextN);
        setSectionsDone(chosenBests.size);
        setLex(stats);
        setCover(cov);
        setValveThreshold(valve[0] ?? null);
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const drills: Drill[] = [
    {
      key: "read",
      name: "Read aloud",
      emoji: "📖",
      trains: reading
        ? `“${reading.title}”, about ${Math.round(readingMinutes(reading))} min in ${reading.sections.length} sittings. Your mouth, on words you understand but never say.`
        : "Your mouth, on words you already understand but have never actually said.",
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
      emoji: "🪶",
      trains: "The supply of words your mouth can reach for. A word is only yours once you have said it in a real room.",
      status:
        lex === null
          ? null
          : lex.dueNow > 0
            ? `${lex.dueNow} due`
            : lex.seen === 0
              ? "new"
              : `${lex.productionOwned} owned`,
      go: () => router.push("/lexicon"),
    },
    {
      key: "playbook",
      name: "The Playbook",
      emoji: "♟️",
      trains: "Asking the question that changes the room, instead of the one that fills silence.",
      status: cover === null ? null : `${cover.tried}/${cover.total}`,
      go: () => router.push("/playbook"),
    },
    {
      key: "lab",
      name: "The Lab",
      emoji: "🧪",
      trains: "Making a case under pressure, and getting past small talk with someone you just met.",
      status: null,
      go: () => router.push("/lab"),
    },
    {
      key: "valve",
      name: "The Valve",
      emoji: "🌬️",
      trains: "Getting loud without squeezing, so the sound comes out of your mouth and not your nose.",
      status:
        valveThreshold === null
          ? null
          : valveThreshold > 5
            ? "clean"
            : `holds to ${valveThreshold - 1}`,
      go: () => router.push("/valve"),
    },
  ];

  return (
    <Screen>
      <Masthead setup />

      <Rise index={0} style={s.intro}>
        <Text style={s.title}>Play</Text>
        <Text style={s.lede}>
          Short, loud, and scored. Every game here ends with you talking.
        </Text>
      </Rise>

      <Rise index={1} style={s.sectionHead}>
        <Text style={s.sectionTitle}>Games</Text>
        {!GAMES_LIVE ? <Text style={s.soon}>ARRIVING NEXT UPDATE</Text> : null}
      </Rise>

      {GAMES.map((g, i) => (
        <Rise key={g.key} index={i + 2}>
          <PressableScale
            onPress={() => feel.warn()}
            scaleTo={0.97}
            accessibilityLabel={`${g.name}, coming next`}
          >
            <View style={s.game}>
              <LinearGradient
                colors={[alpha(g.tint[0], 0.42), alpha(g.tint[1], 0.16)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.panel }]}
              />
              <View style={s.gameEmojiWrap}>
                <Text style={s.gameEmoji}>{g.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.gameHead}>
                  <Text style={s.gameName}>{g.name}</Text>
                  <View style={[s.tag, { borderColor: alpha(g.tint[0], 0.7) }]}>
                    <Text style={[s.tagText, { color: g.tint[0] }]}>{g.tag}</Text>
                  </View>
                </View>
                <Text style={s.gameHook}>{g.hook}</Text>
              </View>
              {!GAMES_LIVE ? (
                <View style={s.lock}>
                  <Text style={s.lockText}>🔒</Text>
                </View>
              ) : null}
            </View>
          </PressableScale>
        </Rise>
      ))}

      <Rise index={8} style={[s.sectionHead, { marginTop: SPACE.md }]}>
        <Text style={s.sectionTitle}>Training</Text>
        <Text style={s.soon}>THE SLOW GAINS</Text>
      </Rise>

      {drills.map((d, i) => (
        <Rise key={d.key} index={i + 9}>
          <PressableScale onPress={d.go} scaleTo={0.97} accessibilityLabel={d.name}>
            <Glass style={s.drill} radius={RADIUS.soft + 6}>
              <Text style={s.drillEmoji}>{d.emoji}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={s.gameHead}>
                  <Text style={s.drillName}>{d.name}</Text>
                  {d.status ? <Text style={s.status}>{d.status}</Text> : null}
                </View>
                <Text style={s.drillTrains}>{d.trains}</Text>
              </View>
            </Glass>
          </PressableScale>
        </Rise>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { gap: 4, marginTop: SPACE.xs },
  title: { color: CHROME.chalk, fontSize: 40, lineHeight: 46, fontFamily: TYPE.display, letterSpacing: -1 },
  lede: { color: CHROME.dust, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.displaySoft },
  soon: { color: AURORA.gold, fontSize: 10.5, letterSpacing: 1.4, fontFamily: TYPE.uiBold },

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
  gameEmojiWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  gameEmoji: { fontSize: 28 },
  gameHead: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" },
  gameName: { color: CHROME.chalk, fontSize: 19, fontFamily: TYPE.display, letterSpacing: -0.3, flexShrink: 1 },
  gameHook: { color: "#E6E2FA", fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 9.5, letterSpacing: 1.2, fontFamily: TYPE.uiBold },
  lock: { position: "absolute", top: 10, right: 12, opacity: 0.8 },
  lockText: { fontSize: 12 },

  drill: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  drillEmoji: { fontSize: 26 },
  drillName: { color: CHROME.chalk, fontSize: 17, fontFamily: TYPE.displaySoft },
  drillTrains: { color: CHROME.dust, fontSize: 13, lineHeight: 19, fontFamily: TYPE.ui },
  status: { color: AURORA.teal, fontSize: 11, fontFamily: TYPE.monoMedium, ...TABULAR },
});
