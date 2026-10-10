// Echo: letters arrive one at a time. Tap Match when this one is the letter
// from n steps back.
//
// n-back works the part of memory that has to keep updating: hold the last few
// things, drop the oldest, take the newest. In a conversation that is keeping
// track of what they said two turns ago while you answer what they just said.

import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { PressableScale, Rise } from "../../../components/kit/motion";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { AURORA, CHROME, RADIUS, SEMANTIC, SPACE, TABULAR, TYPE, alpha } from "../../../theme";
import {
  MAX_LEVEL,
  nbackAccuracy,
  nbackLevel,
  nbackStream,
  nbackTally,
  rng,
  runScore,
  unlockedLevel,
  type NbackTally,
} from "../memory";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, TimerBar, useShake } from "../GameKit";
import { usePetAway } from "../../pet/petPresence";
import { LevelPicker, useTimers } from "../memory/shared";

const TINT = AURORA.plum;

type Stage = "intro" | "play" | "done";
type Mark = "hit" | "false" | "miss" | null;

const back = (n: number) => (n === 1 ? "the one before" : `${n} letters back`);

export default function EchoScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  usePetAway(stage === "play");
  const [best, setBest] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [idx, setIdx] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [mark, setMark] = useState<Mark>(null);
  const [live, setLive] = useState({ hits: 0, falseAlarms: 0, misses: 0 });
  const [tally, setTally] = useState<NbackTally | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const { style: shakeStyle, shake } = useShake();
  const { after, clear } = useTimers();

  const letters = useRef<string[]>([]);
  const isTarget = useRef<boolean[]>([]);
  const pressed = useRef<boolean[]>([]);
  const idxRef = useRef(-1);
  const levelRef = useRef(1);

  useFocusEffect(
    useCallback(() => {
      void bestOf("nback").then((b) => {
        setBest(b);
        setLevel(unlockedLevel("nback", b));
      });
    }, [])
  );

  const lv = nbackLevel(level);

  const finish = async () => {
    const l = levelRef.current;
    const t = nbackTally(isTarget.current, pressed.current);
    const passed = nbackAccuracy(t) >= nbackLevel(l).toPass;
    setTally(t);
    setStage("done");
    if (passed) {
      play("win");
      feel.win();
    } else {
      feel.warn();
    }
    const res = await finishGame("nback", runScore(l, passed), {
      level: l,
      passed,
      ...t,
      accuracy: Math.round(nbackAccuracy(t) * 100),
    });
    setResult(res);
    if (passed) setBest((b) => Math.max(b ?? 0, l));
  };

  const step = (i: number) => {
    const rule = nbackLevel(levelRef.current);
    if (i >= letters.current.length) {
      idxRef.current = -1;
      setIdx(-1);
      after(400, () => void finish());
      return;
    }
    idxRef.current = i;
    setIdx(i);
    setVisible(true);
    setMark(null);
    play("tick");
    after(Math.round(rule.stepMs * 0.7), () => setVisible(false));
    after(rule.stepMs, () => {
      // A target that slid past unpressed is a miss: say so, quietly, so the
      // next one is not a surprise.
      if (isTarget.current[i] && !pressed.current[i]) {
        setLive((v) => ({ ...v, misses: v.misses + 1 }));
        feel.warn();
      }
      step(i + 1);
    });
  };

  const press = () => {
    const i = idxRef.current;
    const rule = nbackLevel(levelRef.current);
    if (i < rule.n || pressed.current[i]) return;
    pressed.current[i] = true;
    if (isTarget.current[i]) {
      setMark("hit");
      setLive((v) => ({ ...v, hits: v.hits + 1 }));
      play("correct");
      feel.select();
    } else {
      setMark("false");
      setLive((v) => ({ ...v, falseAlarms: v.falseAlarms + 1 }));
      play("wrong");
      feel.fail();
      shake();
    }
  };

  const start = (l: number) => {
    clear();
    levelRef.current = l;
    setLevel(l);
    const rule = nbackLevel(l);
    const stream = nbackStream(rule, rng(Date.now()));
    letters.current = stream.letters;
    isTarget.current = stream.isTarget;
    pressed.current = stream.letters.map(() => false);
    setLive({ hits: 0, falseAlarms: 0, misses: 0 });
    setTally(null);
    setResult(null);
    setIdx(-1);
    play("go");
    feel.thud();
    setStage("play");
    after(1200, () => step(0));
  };

  if (stage === "intro") {
    return (
      <Screen>
        <Masthead close />
        <GameIntro
          icon="radio"
          tint={TINT}
          title="Echo"
          tagline="Letters arrive one at a time. Tap Match when one repeats from n steps back."
          rules={[
            `At ${lv.n}-back, tap Match when the letter is the same as ${back(lv.n)}.`,
            `There are ${lv.targets} matches in ${lv.length} letters. Catch ${Math.round(lv.toPass * 100)}% to clear the level.`,
            "A wrong tap cancels a right one, so tapping on everything scores nothing.",
          ]}
          best={best}
          formatBest={(n) => (n > 0 ? `level ${n}` : "no level cleared yet")}
          startLabel={`Start level ${level}`}
          onStart={() => start(level)}
        >
          <Rise index={2}>
            <LevelPicker
              max={MAX_LEVEL.nback}
              unlocked={unlockedLevel("nback", best)}
              value={level}
              onChange={setLevel}
              tint={TINT}
              describe={(l) => {
                const x = nbackLevel(l);
                return `${x.n}-back, ${(x.stepMs / 1000).toFixed(1)}s a letter`;
              }}
            />
          </Rise>
        </GameIntro>
      </Screen>
    );
  }

  if (stage === "done") {
    const t = tally ?? { hits: 0, misses: 0, falseAlarms: 0, targets: lv.targets };
    const acc = nbackAccuracy(t);
    const passed = acc >= lv.toPass;
    const top = level >= MAX_LEVEL.nback;
    const next = nbackLevel(level + 1);
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="Echo"
          score={level}
          unit={passed ? "level cleared" : "level not cleared yet"}
          result={result}
          verdict={
            passed
              ? top
                ? "Five back at speed. That is as far as this goes."
                : next.n > lv.n
                  ? `Level ${level + 1} is open: ${next.n}-back. Hold one more letter.`
                  : `Level ${level + 1} is open: same ${lv.n}-back, faster.`
              : t.falseAlarms > t.misses
                ? "More wrong taps than misses. Wait until you are sure."
                : "The misses are the ones that slipped out of the window. Run it again."
          }
          stats={[
            { label: "Caught", value: `${t.hits}/${t.targets}`, tint: passed ? SEMANTIC.solid : undefined },
            { label: "Wrong taps", value: String(t.falseAlarms), tint: t.falseAlarms > 0 ? AURORA.coral : undefined },
            { label: "Score", value: `${Math.round(acc * 100)}%` },
          ]}
          onAgain={() => start(passed && !top ? level + 1 : level)}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  const letter = idx >= 0 ? letters.current[idx] : null;
  const canPress = idx >= lv.n;
  const ring = mark === "hit" ? SEMANTIC.solid : mark === "false" ? AURORA.coral : TINT;

  return (
    <Screen scroll={false}>
      <Masthead close onClose={clear} right={`Level ${level} · ${lv.n}-back`} />

      <View style={s.hud}>
        <Stat label="Caught" value={live.hits} tint={SEMANTIC.solid} />
        <Stat label="Missed" value={live.misses} />
        <Stat label="Wrong" value={live.falseAlarms} tint={AURORA.coral} />
      </View>
      <TimerBar progress={idx < 0 ? 0 : (idx + 1) / lv.length} tint={TINT} />

      <Animated.View style={[s.stageWrap, shakeStyle]}>
        <Glass glow={ring} style={s.card}>
          <View style={s.cardInner}>
            {letter && visible ? (
              <Animated.Text key={idx} entering={FadeIn.duration(120)} style={s.letter}>
                {letter}
              </Animated.Text>
            ) : (
              <Text style={[s.letter, s.blank]}>·</Text>
            )}
          </View>
        </Glass>
        <Text style={s.prompt}>
          {idx < 0 ? "Get ready" : `Same as ${back(lv.n)}?`}
        </Text>
      </Animated.View>

      <View style={s.footer}>
        <PressableScale
          onPress={press}
          disabled={!canPress}
          haptic={false}
          scaleTo={0.94}
          accessibilityLabel="Match"
          accessibilityRole="button"
        >
          <View
            style={[
              s.match,
              { borderColor: alpha(ring, 0.8), backgroundColor: alpha(ring, mark ? 0.32 : 0.16) },
              !canPress && { opacity: 0.4 },
            ]}
          >
            <Text style={[s.matchText, { color: mark ? ring : CHROME.chalk }]}>Match</Text>
          </View>
        </PressableScale>
        <Text style={s.hint}>
          {idx >= 0 && idx < lv.n ? `Nothing to match yet. Just hold the first ${lv.n}.` : "Stay quiet when it doesn't match."}
        </Text>
      </View>
    </Screen>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, tint && value > 0 ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hud: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm, marginBottom: SPACE.sm },
  stat: { alignItems: "center", flex: 1 },
  statValue: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.monoMedium, ...TABULAR },
  statLabel: { color: CHROME.dust, fontSize: 11.5, fontFamily: TYPE.uiSemi },
  stageWrap: { alignItems: "center", marginTop: SPACE.lg, gap: SPACE.md },
  card: { width: 200, height: 200 },
  cardInner: { height: 164, alignItems: "center", justifyContent: "center" },
  letter: { color: CHROME.chalk, fontSize: 104, lineHeight: 120, fontFamily: TYPE.display },
  blank: { color: CHROME.dustDim },
  prompt: { color: CHROME.dust, fontSize: 15, fontFamily: TYPE.uiMedium },
  footer: { marginTop: "auto", marginBottom: SPACE.xl, gap: SPACE.sm, alignItems: "stretch" },
  match: {
    height: 84,
    borderRadius: RADIUS.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  matchText: { fontSize: 26, fontFamily: TYPE.display, letterSpacing: -0.3 },
  hint: { color: CHROME.dustDim, fontSize: 12.5, fontFamily: TYPE.uiMedium, textAlign: "center" },
});
