// Pause, Don't Um: talk on a topic and go quiet when the gate says so.
//
// The game runs off the live mic level alone, ticked every 100 ms into the pure
// state machine in pauseGate.ts. Feedback during play is haptic only: a chime
// would land in the recording and read as you talking through the gate.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, useSharedValue, withTiming } from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { ProgressRing } from "../../../components/kit/Meters";
import { VoiceOrb } from "../../../components/kit/VoiceOrb";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { useTake } from "../../../components/useTake";
import { AURORA, CHROME, GRADIENT, SEMANTIC, SPACE, TABULAR, TYPE } from "../../../theme";
import { TOPICS, type Topic } from "../../arena/topics";
import { GATE, phaseProgress, startGate, tick, type GateOutcome, type GateState } from "../pauseGate";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, PopNumber, TimerBar } from "../GameKit";

const TINT = AURORA.mint;
/** Bonus for the transcript afterwards, by filler count: none, one, two. */
const FILLER_BONUS = [250, 150, 50] as const;
const TOTAL_MS = GATE.calibrateMs + GATE.lengthMs;

const OUTCOME: Record<GateOutcome, string> = {
  clean: "Clean pause",
  "talked-through": "Talked through it",
  "broke-hold": "Broke the silence early",
  stalled: "Stalled — come back sooner",
  "dead-air": "Dead air — keep it moving",
};

type Stage = "intro" | "play" | "scoring" | "done";

function randomTopic(): Topic {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)]!;
}

export default function PauseScreen() {
  const router = useRouter();
  const take = useTake();
  const [stage, setStage] = useState<Stage>("intro");
  const [best, setBest] = useState<number | null>(null);
  const [topic, setTopic] = useState<Topic>(randomTopic);
  const [gate, setGate] = useState<GateState>(() => startGate(1));
  const [bonus, setBonus] = useState<{ fillers: number | null; points: number }>({ fillers: null, points: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const level = useSharedValue(0);

  const state = useRef<GateState>(gate);
  const t0 = useRef(0);
  const db = useRef(-160);
  db.current = take.db;
  const quitting = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void bestOf("pause").then(setBest);
    }, [])
  );

  useEffect(() => {
    level.value = withTiming(take.level, { duration: 100 });
  }, [take.level, level]);

  const finish = useCallback(async () => {
    setStage("scoring");
    const s = state.current;
    const t = await take.stop();
    const fillers = t ? t.metrics.fillerCount : null;
    const points = fillers === null ? 0 : (FILLER_BONUS[fillers] ?? 0);
    setBonus({ fillers, points });
    const total = s.score + points;
    play("win");
    feel.win();
    setStage("done");
    const res = await finishGame("pause", total, {
      clean: s.clean,
      gates: s.gates,
      bestCombo: s.bestCombo,
      fillers,
      topic: topic.id,
    });
    setResult(res);
  }, [take, topic.id]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (stage !== "play") return;
    const id = setInterval(() => {
      if (quitting.current) {
        clearInterval(id);
        return;
      }
      const prev = state.current;
      const next = tick(prev, Date.now() - t0.current, db.current);
      state.current = next;
      if (next.phase !== prev.phase) {
        if (next.phase === "gate") feel.thud();
        if (next.phase === "resume") feel.select();
      }
      if (next.events.length > prev.events.length) {
        const e = next.events[next.events.length - 1]!;
        if (e.outcome === "clean") feel.win();
        else feel.fail();
      }
      setGate(next);
      if (next.phase === "done") {
        clearInterval(id);
        void finishRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage]);

  const start = async () => {
    quitting.current = false;
    setResult(null);
    setBonus({ fillers: null, points: 0 });
    const fresh = startGate(Date.now() >>> 0);
    state.current = fresh;
    setGate(fresh);
    play("go");
    // Let the chime finish before the mic opens, or calibration hears it.
    await new Promise((r) => setTimeout(r, 250));
    const ok = await take.start();
    if (!ok) return;
    t0.current = Date.now();
    setStage("play");
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
          icon="pause"
          tint={TINT}
          title="Pause, Don't Um"
          tagline="When you need a second to think, go quiet instead of filling the gap."
          rules={[
            "Talk about the topic below. The first three seconds tune the game to your voice and your room.",
            "When PAUSE flashes, go silent within a second and a half. Hold it until it says go, then pick the thread back up.",
            "Clean pauses in a row build a combo. Talking through a gate, stalling, or going silent on your own breaks it.",
          ]}
          best={best}
          formatBest={(n) => `${n.toLocaleString()} pts`}
          startLabel="Start talking"
          onStart={() => void start()}
          disabled={!take.ready}
          note={take.error ?? (take.ready ? null : "Waiting for the microphone…")}
        >
          <TopicCard topic={topic} onShuffle={() => setTopic(randomTopic())} />
        </GameIntro>
      </Screen>
    );
  }

  if (stage === "done") {
    const rate = gate.gates ? Math.round((gate.clean / gate.gates) * 100) : 0;
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="Pause, Don't Um"
          score={gate.score + bonus.points}
          unit="points"
          result={result}
          verdict={
            rate >= 80
              ? "You can stop on command and start again. That silence is what confidence sounds like."
              : rate >= 50
                ? "Half the gates were clean. The misses show where the habit still reaches for a sound."
                : "Stopping mid-thought is hard. It gets easier every run."
          }
          stats={[
            { label: "CLEAN", value: `${gate.clean}/${gate.gates}`, tint: rate >= 70 ? SEMANTIC.solid : undefined },
            { label: "BEST COMBO", value: String(gate.bestCombo) },
            {
              label: "FILLERS",
              value: bonus.fillers === null ? "—" : String(bonus.fillers),
              tint: bonus.fillers === 0 ? SEMANTIC.solid : undefined,
            },
          ]}
          onAgain={() => {
            setTopic(randomTopic());
            setStage("intro");
          }}
          onDone={() => router.back()}
        >
          {bonus.points > 0 ? (
            <Text style={s.bonus}>
              +{bonus.points} for {bonus.fillers === 0 ? "zero fillers" : `only ${bonus.fillers} filler${bonus.fillers === 1 ? "" : "s"}`}
            </Text>
          ) : null}
        </GameResult>
      </Screen>
    );
  }

  const elapsed = gate.now;
  const last = gate.events[gate.events.length - 1];
  const showLast = last && gate.now - last.at < 1600;
  const { headline, sub, color } = phaseCopy(gate);

  return (
    <Screen scroll={false}>
      <Masthead close onClose={quit} right={stage === "scoring" ? "SCORING" : `${Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000))}s`} />
      <TimerBar progress={1 - elapsed / TOTAL_MS} tint={TINT} />

      <View style={s.hud}>
        <PopNumber value={gate.score} />
        <Text style={s.combo}>{gate.combo > 1 ? `${gate.combo} in a row` : " "}</Text>
      </View>

      <View style={s.center}>
        <ProgressRing
          progress={gate.phase === "talk" ? 0 : phaseProgress(gate)}
          size={230}
          stroke={10}
          colors={gate.phase === "gate" || gate.phase === "hold" ? GRADIENT.warm : GRADIENT.cool}
        >
          <VoiceOrb size={120} level={level} mood={gate.phase === "resume" ? "happy" : "listening"} />
        </ProgressRing>
        <Animated.Text key={gate.phase} entering={FadeIn.duration(140)} style={[s.headline, { color }]}>
          {stage === "scoring" ? "Listening back…" : headline}
        </Animated.Text>
        <Text style={s.sub}>{stage === "scoring" ? "Counting fillers for the bonus." : sub}</Text>
        {showLast ? (
          <Animated.Text
            key={last.at}
            entering={FadeInDown.springify()}
            style={[s.event, { color: last.outcome === "clean" ? SEMANTIC.solid : AURORA.coral }]}
          >
            {OUTCOME[last.outcome]}
            {last.points ? `  +${last.points}` : ""}
          </Animated.Text>
        ) : null}
      </View>

      <Glass style={s.topicMini}>
        <Text style={s.label}>TOPIC</Text>
        <Text style={s.topicMiniText} numberOfLines={2}>
          {topic.title}
        </Text>
      </Glass>
    </Screen>
  );
}

function phaseCopy(g: GateState): { headline: string; sub: string; color: string } {
  switch (g.phase) {
    case "calibrate":
      return { headline: "Start talking", sub: "Tuning to your voice and your room.", color: CHROME.chalk };
    case "talk":
      return { headline: "Keep going", sub: "A pause is coming. You won't know when.", color: CHROME.chalk };
    case "gate":
      return { headline: "PAUSE", sub: "Go quiet now.", color: AURORA.coral };
    case "hold":
      return { headline: "Hold it…", sub: "Stay silent. Let the thought land.", color: AURORA.coral };
    case "resume":
      return { headline: "Go on", sub: "Pick the thread back up.", color: AURORA.mint };
    case "done":
      return { headline: "Time", sub: "", color: CHROME.chalk };
  }
}

function TopicCard({ topic, onShuffle }: { topic: Topic; onShuffle: () => void }) {
  return (
    <Glass style={{ gap: SPACE.sm }}>
      <View style={s.topicHead}>
        <Text style={s.label}>YOUR TOPIC</Text>
        <Text style={s.shuffle} onPress={onShuffle} accessibilityRole="button">
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
  );
}

const s = StyleSheet.create({
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  combo: { color: TINT, fontSize: 14, fontFamily: TYPE.uiSemi },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  headline: { fontSize: 40, fontFamily: TYPE.display, letterSpacing: -1, marginTop: SPACE.sm },
  sub: { color: CHROME.dust, fontSize: 15, fontFamily: TYPE.ui, textAlign: "center" },
  event: { fontSize: 16, fontFamily: TYPE.uiSemi, ...TABULAR },
  label: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  topicMini: { gap: 4, marginBottom: SPACE.lg },
  topicMiniText: { color: CHROME.chalk, fontSize: 15, lineHeight: 21, fontFamily: TYPE.uiMedium },
  topicHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  shuffle: { color: TINT, fontSize: 13, fontFamily: TYPE.uiSemi },
  topic: { color: CHROME.chalk, fontSize: 19, lineHeight: 26, fontFamily: TYPE.displaySoft },
  primer: { color: CHROME.dust, fontSize: 14, lineHeight: 20, fontFamily: TYPE.ui },
  bonus: { color: SEMANTIC.solid, fontSize: 15, fontFamily: TYPE.uiSemi, textAlign: "center" },
});
