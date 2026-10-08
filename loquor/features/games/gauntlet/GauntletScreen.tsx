// No-Um Gauntlet: talk for longer each round without a filler or a stall.
//
// Rounds stop themselves at their length, so the only way to clear one is to
// keep going. Hearts carry across rounds; the run ends when they are gone, a
// round is cut short, or all six are cleared. Sounds play only between rounds,
// never while the mic is open.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown, useSharedValue, withTiming } from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { GlowButton } from "../../../components/kit/GlowButton";
import { Glyph } from "../../../components/kit/Glyph";
import { ProgressRing } from "../../../components/kit/Meters";
import { VoiceOrb } from "../../../components/kit/VoiceOrb";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { useTake } from "../../../components/useTake";
import { AURORA, CHROME, GRADIENT, SEMANTIC, SPACE, TABULAR, TYPE } from "../../../theme";
import { TOPICS, type Topic } from "../../arena/topics";
import { HEARTS, ROUNDS_S, judgeRound, totalSurvived, type RoundResult } from "../gauntlet";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, Hearts, useShake } from "../GameKit";

const TINT = AURORA.coral;

type Stage = "intro" | "ready" | "talking" | "judging" | "between" | "done";

function randomTopic(): Topic {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)]!;
}

function fmt(s: number): string {
  return `${Math.round(s)}s`;
}

export default function GauntletScreen() {
  const router = useRouter();
  const take = useTake();
  const [stage, setStage] = useState<Stage>("intro");
  const [best, setBest] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [hearts, setHearts] = useState(HEARTS);
  const [topic, setTopic] = useState<Topic>(randomTopic);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const level = useSharedValue(0);
  const { style: shakeStyle, shake } = useShake();
  const stopping = useRef(false);
  const quitting = useRef(false);

  const length = ROUNDS_S[round] ?? ROUNDS_S[ROUNDS_S.length - 1]!;
  const last = results[results.length - 1] ?? null;

  useFocusEffect(
    useCallback(() => {
      void bestOf("gauntlet").then(setBest);
    }, [])
  );

  useEffect(() => {
    level.value = withTiming(take.level, { duration: 100 });
  }, [take.level, level]);

  const endRun = useCallback(async (all: RoundResult[]) => {
    setStage("done");
    play("win");
    feel.win();
    const score = totalSurvived(all);
    const res = await finishGame("gauntlet", score, {
      rounds: all.length,
      cleared: all.filter((r) => r.cleared).length,
      focus: Math.round(Math.max(0, ...all.map((r) => r.focus))),
    });
    setResult(res);
  }, []);

  const endRound = useCallback(async () => {
    if (stopping.current || quitting.current) return;
    stopping.current = true;
    setStage("judging");
    const t = await take.stop();
    stopping.current = false;
    if (quitting.current) return;
    if (!t) {
      // The transcriber failed, not you: the round can be run again.
      setStage("ready");
      return;
    }
    const r = judgeRound(round, hearts, t.metrics);
    const lost = hearts - r.heartsLeft;
    const all = [...results, r];
    setResults(all);
    setHearts(r.heartsLeft);
    if (lost > 0) {
      play("heart");
      feel.fail();
      shake();
    } else {
      play("correct");
      feel.win();
    }
    const over = !r.cleared || r.heartsLeft <= 0 || round + 1 >= ROUNDS_S.length;
    setStage("between");
    if (over) {
      // A beat on the round card before the result replaces it.
      setTimeout(() => void endRun(all), 1600);
    }
  }, [take, round, hearts, results, shake, endRun]);

  const endRef = useRef(endRound);
  endRef.current = endRound;

  // Auto-stop at the round's length, plus a hair so Whisper's duration reaches it.
  useEffect(() => {
    if (stage === "talking" && take.recording && take.seconds >= length + 0.3) void endRef.current();
  }, [stage, take.recording, take.seconds, length]);

  const go = async () => {
    play("go");
    await new Promise((r) => setTimeout(r, 250));
    const ok = await take.start();
    if (ok) setStage("talking");
  };

  const begin = () => {
    quitting.current = false;
    setRound(0);
    setHearts(HEARTS);
    setResults([]);
    setResult(null);
    setStage("ready");
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    setTopic(randomTopic());
    setStage("ready");
  };

  const quit = () => {
    quitting.current = true;
    void take.cancel();
  };

  if (stage === "intro") {
    return (
      <Screen>
        <Masthead close />
        <GameIntro
          icon="shield"
          tint={TINT}
          title="No-Um Gauntlet"
          tagline="Talk without a single um. Each round runs longer. Three hearts for the whole run."
          rules={[
            `Rounds run ${ROUNDS_S.join(" → ")} seconds and stop on their own. You have to talk all the way through.`,
            "Each filler (um, uh, like, you know) costs a heart. So does going silent for more than two and a half seconds.",
            "Your score is total seconds survived. Your longest clean stretch is your focus span.",
          ]}
          best={best}
          formatBest={(n) => `${n}s survived`}
          startLabel="Enter the gauntlet"
          onStart={begin}
          disabled={!take.ready}
          note={take.error ?? (take.ready ? null : "Waiting for the microphone…")}
        />
      </Screen>
    );
  }

  if (stage === "done") {
    const score = totalSurvived(results);
    const focus = Math.max(0, ...results.map((r) => r.focus));
    const cleared = results.filter((r) => r.cleared).length;
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="No-Um Gauntlet"
          score={score}
          unit="seconds survived"
          result={result}
          verdict={
            cleared === ROUNDS_S.length
              ? "All six rounds. Ninety seconds clean at the end. That is a held thought."
              : cleared >= 3
                ? `Through round ${cleared}. Your focus is outlasting the habit.`
                : "The early rounds are the hardest to stay clean in. You are building the stretch."
          }
          stats={[
            { label: "ROUNDS", value: `${cleared}/${ROUNDS_S.length}` },
            { label: "FOCUS SPAN", value: fmt(focus), tint: SEMANTIC.xp },
            { label: "HEARTS", value: String(hearts), tint: hearts > 0 ? AURORA.coral : undefined },
          ]}
          onAgain={begin}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={stage !== "talking"}>
      <Masthead close onClose={quit} right={`ROUND ${round + 1}/${ROUNDS_S.length}`} />
      <View style={s.top}>
        <Hearts left={hearts} total={HEARTS} />
        <Text style={s.total}>{fmt(totalSurvived(results))} banked</Text>
      </View>

      {stage === "ready" ? (
        <Animated.View key={`r${round}`} entering={FadeInDown.springify()} style={{ gap: SPACE.md }}>
          <View style={s.roundHead}>
            <Text style={s.roundLabel}>ROUND {round + 1}</Text>
            <Text style={s.roundLen}>{length} seconds</Text>
          </View>
          <Glass glow={TINT} style={{ gap: SPACE.sm }}>
            <View style={s.topicHead}>
              <Text style={s.label}>TALK ABOUT</Text>
              <Text style={s.shuffle} onPress={() => setTopic(randomTopic())} accessibilityRole="button">
                Another one
              </Text>
            </View>
            <Text style={s.topic}>{topic.title}</Text>
            {topic.primer.slice(0, 2).map((p, i) => (
              <Text key={i} style={s.primer}>
                · {p}
              </Text>
            ))}
          </Glass>
          {take.error ? <Text style={s.error}>{take.error}</Text> : null}
          <GlowButton label={`Go · ${length}s`} onPress={() => void go()} icon="mic" disabled={!take.ready} />
        </Animated.View>
      ) : null}

      {stage === "talking" || stage === "judging" ? (
        <View style={s.center}>
          <ProgressRing progress={take.seconds / length} size={240} stroke={10} colors={GRADIENT.cool}>
            <VoiceOrb size={120} level={level} mood="listening" />
          </ProgressRing>
          <Text style={s.count}>
            {stage === "judging" ? "Checking…" : `${Math.max(0, Math.ceil(length - take.seconds))}`}
          </Text>
          <Text style={s.sub} numberOfLines={2}>
            {stage === "judging" ? "Listening for fillers and stalls." : topic.title}
          </Text>
        </View>
      ) : null}

      {stage === "between" && last ? (
        <Animated.View entering={FadeInDown.springify()} style={[{ gap: SPACE.md }, shakeStyle]}>
          <Text style={[s.verdict, { color: last.cleared ? SEMANTIC.solid : AURORA.coral }]}>
            {last.cleared
              ? last.slips.length
                ? `Survived, with ${last.slips.length} slip${last.slips.length === 1 ? "" : "s"}.`
                : "Clean round."
              : last.heartsLeft <= 0
                ? "Out of hearts."
                : "Stopped short. The round has to be talked through."}
          </Text>
          <Glass style={{ gap: 10 }}>
            <Row label="Survived" value={`${fmt(last.survived)} of ${length}s`} />
            <Row label="Longest clean stretch" value={fmt(last.focus)} tint={SEMANTIC.xp} />
            {last.slips.map((sl, i) => (
              <View key={i} style={s.slip}>
                <Glyph name="heart" size={14} color={AURORA.coral} strokeWidth={2.2} />
                <Text style={s.slipText}>
                  {sl.kind === "filler" ? "Filler" : "Dead air"} at {fmt(sl.at)}
                </Text>
              </View>
            ))}
          </Glass>
          {last.cleared && last.heartsLeft > 0 && round + 1 < ROUNDS_S.length ? (
            <GlowButton label={`Round ${round + 2} · ${ROUNDS_S[round + 1]}s`} onPress={nextRound} icon="chevron" />
          ) : (
            <Text style={s.sub}>Tallying the run…</Text>
          )}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  total: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.mono, ...TABULAR },
  roundHead: { alignItems: "center", gap: 2, marginTop: SPACE.sm },
  roundLabel: { color: TINT, fontSize: 12, letterSpacing: 2, fontFamily: TYPE.uiBold },
  roundLen: { color: CHROME.chalk, fontSize: 36, fontFamily: TYPE.display, letterSpacing: -1 },
  label: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  topicHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  shuffle: { color: TINT, fontSize: 13, fontFamily: TYPE.uiSemi },
  topic: { color: CHROME.chalk, fontSize: 19, lineHeight: 26, fontFamily: TYPE.displaySoft },
  primer: { color: CHROME.dust, fontSize: 14, lineHeight: 20, fontFamily: TYPE.ui },
  error: { color: AURORA.coral, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  count: { color: CHROME.chalk, fontSize: 44, fontFamily: TYPE.monoMedium, marginTop: SPACE.sm, ...TABULAR },
  sub: { color: CHROME.dust, fontSize: 15, lineHeight: 21, fontFamily: TYPE.ui, textAlign: "center" },
  verdict: { fontSize: 24, lineHeight: 30, fontFamily: TYPE.display, textAlign: "center", marginTop: SPACE.sm },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: CHROME.dust, fontSize: 14, fontFamily: TYPE.ui },
  rowValue: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.monoMedium, ...TABULAR },
  slip: { flexDirection: "row", alignItems: "center", gap: 8 },
  slipText: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
});
