// Pip Says: tiles light up one at a time, then you tap them back in order.
//
// A spatial span (the Corsi block task). It is the plainest measure of how much
// you can hold at once, which is the thing that runs out when you lose your
// point halfway through a sentence.

import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { PressableScale, Rise } from "../../../components/kit/motion";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { AURORA, CHROME, RADIUS, SEMANTIC, SPACE, TYPE, alpha } from "../../../theme";
import { MAX_LEVEL, firstSlip, rng, runScore, spanLevel, spanSequence, unlockedLevel } from "../memory";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, useShake } from "../GameKit";
import { usePetAway } from "../../pet/petPresence";
import { LevelPicker, useTimers } from "../memory/shared";

const TINT = AURORA.cyan;

type Stage = "intro" | "play" | "done";
type Phase = "watch" | "recall" | "judged";
type Flash = { tile: number; ok: boolean } | null;

export default function SpanScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [stage, setStage] = useState<Stage>("intro");
  usePetAway(stage === "play");
  const [best, setBest] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<Phase>("watch");
  const [lit, setLit] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [tapped, setTapped] = useState(0);
  const [trials, setTrials] = useState<boolean[]>([]);
  const [reveal, setReveal] = useState<number[] | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const { style: shakeStyle, shake } = useShake();
  const { after, clear } = useTimers();

  const r = useRef(rng(Date.now()));
  const seq = useRef<number[]>([]);
  const taps = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("watch");
  const results = useRef<boolean[]>([]);
  const levelRef = useRef(1);

  useFocusEffect(
    useCallback(() => {
      void bestOf("span").then((b) => {
        setBest(b);
        setLevel(unlockedLevel("span", b));
      });
    }, [])
  );

  const lv = spanLevel(level);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const finish = async () => {
    const l = levelRef.current;
    const rule = spanLevel(l);
    const passes = results.current.filter(Boolean).length;
    const passed = passes >= rule.toPass;
    setStage("done");
    if (passed) {
      play("win");
      feel.win();
    } else {
      feel.warn();
    }
    const res = await finishGame("span", runScore(l, passed), {
      level: l,
      passed,
      correct: passes,
      trials: results.current.length,
    });
    setResult(res);
    if (passed) setBest((b) => Math.max(b ?? 0, l));
  };

  const show = (i: number) => {
    const rule = spanLevel(levelRef.current);
    if (i >= seq.current.length) {
      setLit(null);
      after(220, () => setPhaseBoth("recall"));
      return;
    }
    setLit(seq.current[i]!);
    play("tick");
    after(rule.onMs, () => {
      setLit(null);
      after(rule.offMs, () => show(i + 1));
    });
  };

  const runTrial = () => {
    const rule = spanLevel(levelRef.current);
    seq.current = spanSequence(rule, r.current);
    taps.current = [];
    setTapped(0);
    setReveal(null);
    setPhaseBoth("watch");
    after(700, () => show(0));
  };

  const judge = (ok: boolean) => {
    const rule = spanLevel(levelRef.current);
    setPhaseBoth("judged");
    results.current = [...results.current, ok];
    setTrials(results.current);
    const passes = results.current.filter(Boolean).length;
    const misses = results.current.length - passes;
    const decided = passes >= rule.toPass || misses > rule.trials - rule.toPass;
    if (!ok) setReveal(seq.current);
    if (decided || results.current.length >= rule.trials) after(ok ? 900 : 1600, () => void finish());
    else after(ok ? 1000 : 1800, runTrial);
  };

  const tap = (tile: number) => {
    if (phaseRef.current !== "recall") return;
    const next = [...taps.current, tile];
    taps.current = next;
    setTapped(next.length);
    const slip = firstSlip(seq.current, next);
    setFlash({ tile, ok: slip < 0 });
    after(200, () => setFlash(null));
    if (slip >= 0) {
      play("wrong");
      feel.fail();
      shake();
      judge(false);
    } else if (next.length === seq.current.length) {
      play("correct");
      feel.win();
      judge(true);
    } else {
      feel.tap();
    }
  };

  const start = (l: number) => {
    clear();
    levelRef.current = l;
    setLevel(l);
    r.current = rng(Date.now());
    results.current = [];
    setTrials([]);
    setResult(null);
    play("go");
    feel.thud();
    setStage("play");
    runTrial();
  };

  if (stage === "intro") {
    return (
      <Screen>
        <Masthead close />
        <GameIntro
          icon="grid"
          tint={TINT}
          title="Pip Says"
          tagline="Tiles light up one by one. Tap them back in the same order."
          rules={[
            "Watch the whole sequence before you tap. Nothing moves until it has finished.",
            `Each level is ${lv.trials} sequences. Get ${lv.toPass} perfect to clear it.`,
            "Every level adds a tile. From level 6 the board grows to 4×4.",
          ]}
          best={best}
          formatBest={(n) => (n > 0 ? `level ${n}` : "no level cleared yet")}
          startLabel={`Start level ${level}`}
          onStart={() => start(level)}
        >
          <Rise index={2}>
            <LevelPicker
              max={MAX_LEVEL.span}
              unlocked={unlockedLevel("span", best)}
              value={level}
              onChange={setLevel}
              tint={TINT}
              describe={(l) => {
                const x = spanLevel(l);
                return `${x.length} tiles on ${x.side}×${x.side}`;
              }}
            />
          </Rise>
        </GameIntro>
      </Screen>
    );
  }

  if (stage === "done") {
    const passes = trials.filter(Boolean).length;
    const passed = passes >= lv.toPass;
    const top = level >= MAX_LEVEL.span;
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="Pip Says"
          score={level}
          unit={passed ? "level cleared" : "level not cleared yet"}
          result={result}
          verdict={
            passed
              ? top
                ? "That's the top of the board. Hold it there."
                : `Level ${level + 1} is open: one more tile to hold.`
              : "Missed sequences are where the training happens. Run it again."
          }
          stats={[
            { label: "Perfect", value: `${passes}/${trials.length}`, tint: passed ? SEMANTIC.solid : undefined },
            { label: "Tiles", value: String(lv.length) },
          ]}
          onAgain={() => start(passed && !top ? level + 1 : level)}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  const board = Math.min(width - SPACE.md * 2, 380);
  const gap = lv.side === 3 ? 12 : 10;
  const size = (board - gap * (lv.side - 1)) / lv.side;
  const status =
    phase === "watch"
      ? "Watch"
      : phase === "recall"
        ? `Your turn · ${tapped} of ${lv.length}`
        : trials[trials.length - 1]
          ? "Perfect"
          : "Not quite. Here's the order";

  return (
    <Screen scroll={false}>
      <Masthead close onClose={clear} right={`Level ${level}`} />

      <View style={s.hud}>
        <View style={s.dots}>
          {Array.from({ length: lv.trials }, (_, i) => {
            const t = trials[i];
            const color = t === undefined ? "rgba(255,255,255,0.18)" : t ? SEMANTIC.solid : AURORA.coral;
            return <View key={i} style={[s.dot, { backgroundColor: color }]} />;
          })}
        </View>
        <Text style={[s.status, phase === "recall" && { color: TINT }]}>{status}</Text>
      </View>

      <Animated.View style={[s.boardWrap, shakeStyle]}>
        <Glass padded={false} glow={phase === "watch" ? TINT : undefined} style={[s.board, { width: board + 24 }]}>
          <View style={[s.grid, { width: board, gap }]}>
            {Array.from({ length: lv.side * lv.side }, (_, tile) => {
              const on = lit === tile;
              const f = flash?.tile === tile ? flash : null;
              const tone = f ? (f.ok ? TINT : AURORA.coral) : on ? TINT : null;
              const order = reveal
                ? reveal.flatMap((t, i) => (t === tile ? [i + 1] : [])).join("·")
                : "";
              return (
                <PressableScale
                  key={tile}
                  onPress={() => tap(tile)}
                  haptic={false}
                  scaleTo={0.92}
                  disabled={phase !== "recall"}
                  accessibilityLabel={`Tile ${tile + 1}`}
                >
                  <View
                    style={[
                      s.tile,
                      { width: size, height: size },
                      tone ? { backgroundColor: tone, borderColor: tone } : null,
                      order ? { borderColor: alpha(TINT, 0.7) } : null,
                    ]}
                  >
                    {order ? <Text style={s.order}>{order}</Text> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </Glass>
      </Animated.View>

      <Text style={s.hint}>
        {lv.length} tiles · {lv.toPass} of {lv.trials} perfect to clear
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE.sm },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  status: { color: CHROME.chalk, fontSize: 17, fontFamily: TYPE.uiSemi },
  boardWrap: { alignItems: "center", marginTop: SPACE.lg },
  board: { padding: 12, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: {
    borderRadius: RADIUS.soft + 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  order: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.monoMedium },
  hint: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.uiMedium, textAlign: "center", marginTop: SPACE.md },
});
