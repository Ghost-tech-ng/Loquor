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

import { Masthead, Screen } from "../../components/kit/Screen";
import { Glass } from "../../components/kit/Glass";
import { PressableScale, Rise } from "../../components/kit/motion";
import { feel } from "../../components/kit/feel";
import { Glyph, type GlyphName } from "../../components/kit/Glyph";
import { AURORA, CHROME, RADIUS, SPACE, SURFACE, TABULAR, TYPE, alpha } from "../../theme";
import { READINGS_BY_ID, pickReading, readingMinutes, type Reading } from "../reading/readings";
import { bestOf } from "../games/runs";
import type { GameId } from "../progression/xp";
import { coverage } from "../../lib/skillStore";
import { ALL_WORDS, gloss } from "../lexicon/glossary";
import { dayOf } from "../progress/progress";
import {
  lexiconStats,
  recentTakes,
  sectionBests,
  usedReadingIds,
  valveThresholds,
} from "../../lib/db";

type Game = {
  key: GameId;
  name: string;
  icon: GlyphName;
  hook: string;
  /** Two stops: the card's own colour, so the five never blur into one. */
  tint: readonly [string, string];
  tag: string;
  /** How a best reads on the card. */
  unit: (n: number) => string;
};

const GAMES: Game[] = [
  {
    key: "alive",
    name: "Bring It to Life",
    icon: "bot",
    hook: "Start as a robot. Your melody, punch and rhythm turn it back into you.",
    tint: [AURORA.plum, AURORA.emerald],
    tag: "Voice",
    unit: (n) => `${n} liveliness`,
  },
  {
    key: "gauntlet",
    name: "No-Um Gauntlet",
    icon: "shield",
    hook: "Rounds from 20 seconds to 90. Three hearts. Every um costs one.",
    tint: [AURORA.coral, AURORA.cyan],
    tag: "Focus",
    unit: (n) => `${n}s survived`,
  },
  {
    key: "pause",
    name: "Pause, Don't Um",
    icon: "pause",
    hook: "Talk until the gate flashes, then hold a clean silence. Live, no waiting.",
    tint: [AURORA.mint, AURORA.steel],
    tag: "Live",
    unit: (n) => `${n.toLocaleString()} pts`,
  },
  {
    key: "bomb",
    name: "Word Bomb",
    icon: "bomb",
    hook: "A word drops with a lit fuse. Use it in a sentence out loud before it blows.",
    tint: [AURORA.cyan, AURORA.coral],
    tag: "Speak",
    unit: (n) => `${n}/5 defused`,
  },
  {
    key: "blitz",
    name: "Lexicon Blitz",
    icon: "zap",
    hook: "Sixty seconds, a definition, four words. Combos stack, and it counts as review.",
    tint: [AURORA.emerald, AURORA.mint],
    tag: "Tap",
    unit: (n) => `${n.toLocaleString()} pts`,
  },
];

type Drill = {
  key: string;
  name: string;
  icon: GlyphName;
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
  const [bests, setBests] = useState<Partial<Record<GameId, number>>>({});

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void Promise.all(GAMES.map(async (g) => [g.key, await bestOf(g.key)] as const)).then((pairs) => {
        if (!live) return;
        const next: Partial<Record<GameId, number>> = {};
        for (const [k, v] of pairs) if (v !== null) next[k] = v;
        setBests(next);
      });
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
      icon: "book",
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
      icon: "feather",
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
      icon: "knight",
      trains: "Asking the question that changes the room, instead of the one that fills silence.",
      status: cover === null ? null : `${cover.tried}/${cover.total}`,
      go: () => router.push("/playbook"),
    },
    {
      key: "lab",
      name: "The Lab",
      icon: "flask",
      trains: "Making a case under pressure, and getting past small talk with someone you just met.",
      status: null,
      go: () => router.push("/lab"),
    },
    {
      key: "valve",
      name: "The Valve",
      icon: "wind",
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

  const word = gloss(ALL_WORDS[dayOf(Date.now()) % ALL_WORDS.length] ?? "");

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
        <Text style={s.soon}>Five games</Text>
      </Rise>

      {GAMES.map((g, i) => (
        <Rise key={g.key} index={i + 2}>
          <PressableScale
            onPress={() => {
              feel.tap();
              router.push(`/play/${g.key}`);
            }}
            scaleTo={0.97}
            accessibilityLabel={g.name}
          >
            <View style={s.game}>
              <LinearGradient
                colors={[alpha(g.tint[0], 0.42), alpha(g.tint[1], 0.16)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.panel }]}
              />
              <View style={[s.gameIconWrap, { borderColor: alpha(g.tint[0], 0.45) }]}>
                <Glyph name={g.icon} size={26} strokeWidth={1.7} color={g.tint[0]} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.gameHead}>
                  <Text style={s.gameName}>{g.name}</Text>
                  <View style={[s.tag, { borderColor: alpha(g.tint[0], 0.7) }]}>
                    <Text style={[s.tagText, { color: g.tint[0] }]}>{g.tag}</Text>
                  </View>
                </View>
                <Text style={s.gameHook}>{g.hook}</Text>
                {bests[g.key] !== undefined ? (
                  <View style={s.bestRow}>
                    <Glyph name="trophy" size={12} color={AURORA.cyan} strokeWidth={2} />
                    <Text style={s.bestText}>{g.unit(bests[g.key]!)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </PressableScale>
        </Rise>
      ))}

      <Rise index={8} style={[s.sectionHead, { marginTop: SPACE.md }]}>
        <Text style={s.sectionTitle}>Training</Text>
        <Text style={s.soon}>The slow gains</Text>
      </Rise>

      {drills.map((d, i) => (
        <Rise key={d.key} index={i + 9}>
          <PressableScale onPress={d.go} scaleTo={0.97} accessibilityLabel={d.name}>
            <Glass style={s.drill} radius={RADIUS.soft + 6}>
              <View style={s.drillIcon}>
                <Glyph name={d.icon} size={22} strokeWidth={1.7} color={AURORA.emerald} />
              </View>
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

      {/* One word a day from the glossary, and a way into the Lexicon. It moved
          here from Home, which now holds only the one thing to do next. */}
      {word ? (
        <Rise index={9 + drills.length} style={{ marginTop: SPACE.md }}>
          <PressableScale onPress={() => router.push("/lexicon")} scaleTo={0.98} accessibilityLabel="Word of the day">
            <Glass glow={AURORA.mint} style={s.word}>
              <Text style={s.wordKicker}>Word of the day</Text>
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
    </Screen>
  );
}

const s = StyleSheet.create({
  word: { gap: 8 },
  wordKicker: { color: AURORA.mint, fontSize: 13, fontFamily: TYPE.uiSemi },
  wordHead: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  wordText: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.display, letterSpacing: -0.5 },
  wordSay: { color: AURORA.mint, fontSize: 13, fontFamily: TYPE.mono },
  wordMeaning: { color: CHROME.chalk, fontSize: 17, lineHeight: 26, fontFamily: TYPE.passage },
  wordUse: { color: CHROME.dust, fontSize: 12.5, fontFamily: TYPE.uiMedium },

  intro: { gap: 4, marginTop: SPACE.xs },
  title: { color: CHROME.chalk, fontSize: 40, lineHeight: 46, fontFamily: TYPE.display, letterSpacing: -1 },
  lede: { color: CHROME.dust, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.displaySoft },
  soon: { color: AURORA.cyan, fontSize: 12.5, fontFamily: TYPE.uiSemi },

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
  gameIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(11, 15, 23, 0.45)",
  },
  gameHead: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" },
  gameName: { color: CHROME.chalk, fontSize: 19, fontFamily: TYPE.display, letterSpacing: -0.3, flexShrink: 1 },
  gameHook: { color: CHROME.chalk, opacity: 0.86, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11.5, fontFamily: TYPE.uiBold },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  bestText: { color: AURORA.cyan, fontSize: 12, fontFamily: TYPE.monoMedium, ...TABULAR },

  drill: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  drillIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(AURORA.emerald, 0.1),
  },
  drillName: { color: CHROME.chalk, fontSize: 17, fontFamily: TYPE.displaySoft },
  drillTrains: { color: CHROME.dust, fontSize: 13, lineHeight: 19, fontFamily: TYPE.ui },
  status: { color: AURORA.mint, fontSize: 11, fontFamily: TYPE.monoMedium, ...TABULAR },
});
