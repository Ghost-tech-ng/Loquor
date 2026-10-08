// Lexicon Blitz: sixty seconds, a definition, four words.
//
// Answers on words you have already met are graded into the recognition track,
// so a run is real spaced review. Words you have never met are asked but not
// graded: a lucky tap on a stranger is not evidence you know it, and creating
// cards here would jump the Lexicon's four-new-a-day pacing.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { PressableScale } from "../../../components/kit/motion";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { AURORA, CHROME, RADIUS, SEMANTIC, SPACE, TABULAR, TYPE, alpha } from "../../../theme";
import { ALL_WORDS, GLOSSARY } from "../../lexicon/glossary";
import { grade } from "../../lexicon/lexiconStore";
import { dueCards, seenWords } from "../../../lib/db";
import {
  BLITZ,
  answerPoints,
  deck as buildDeck,
  makeQuestion,
  multiplier,
  recognitionGrade,
  rng,
  type BlitzQuestion,
} from "../blitz";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, PopNumber, TimerBar, useShake } from "../GameKit";

const TINT = AURORA.emerald;
const ENTRIES = ALL_WORDS.map((w) => ({ word: w, meaning: GLOSSARY.get(w)!.meaning }));

type Stage = "intro" | "play" | "done";
type Pick = { option: string; correct: boolean } | null;

export default function BlitzScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [best, setBest] = useState<number | null>(null);
  const [q, setQ] = useState<BlitzQuestion | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState<number>(BLITZ.lengthMs);
  const [result, setResult] = useState<RunResult | null>(null);
  const [tally, setTally] = useState({ answered: 0, correct: 0, bestCombo: 0 });
  const { style: shakeStyle, shake } = useShake();

  const deck = useRef<string[]>([]);
  const cursor = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const r = useRef(rng(Date.now()));
  const askedAt = useRef(0);
  const endsAt = useRef(0);
  const locked = useRef(false);
  const run = useRef({ score: 0, combo: 0, answered: 0, correct: 0, bestCombo: 0 });

  useFocusEffect(
    useCallback(() => {
      void bestOf("blitz").then(setBest);
    }, [])
  );

  const next = useCallback(() => {
    for (let tries = 0; tries < deck.current.length; tries++) {
      const w = deck.current[cursor.current % deck.current.length]!;
      cursor.current++;
      const made = makeQuestion(w, ENTRIES, r.current);
      if (made) {
        setQ(made);
        setPick(null);
        askedAt.current = Date.now();
        locked.current = false;
        return;
      }
    }
  }, []);

  const finish = useCallback(async () => {
    locked.current = true;
    const t = run.current;
    setTally({ answered: t.answered, correct: t.correct, bestCombo: t.bestCombo });
    setStage("done");
    play("win");
    feel.win();
    const res = await finishGame("blitz", t.score, {
      answered: t.answered,
      correct: t.correct,
      bestCombo: t.bestCombo,
    });
    setResult(res);
  }, []);

  useEffect(() => {
    if (stage !== "play") return;
    const id = setInterval(() => {
      const ms = Math.max(0, endsAt.current - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        void finish();
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage, finish]);

  const start = async () => {
    let preferred: string[] = [];
    try {
      const [due, met] = await Promise.all([dueCards("recognition", Date.now(), 40), seenWords("recognition")]);
      preferred = [...due.map((d) => d.word), ...met];
      seen.current = new Set(met);
    } catch {
      seen.current = new Set();
    }
    r.current = rng(Date.now());
    deck.current = buildDeck(preferred, ALL_WORDS, r.current);
    cursor.current = 0;
    run.current = { score: 0, combo: 0, answered: 0, correct: 0, bestCombo: 0 };
    setScore(0);
    setCombo(0);
    setResult(null);
    endsAt.current = Date.now() + BLITZ.lengthMs;
    setLeft(BLITZ.lengthMs);
    play("go");
    feel.thud();
    next();
    setStage("play");
  };

  const answer = (option: string) => {
    if (!q || locked.current) return;
    locked.current = true;
    const ms = Date.now() - askedAt.current;
    const correct = option === q.word;
    const t = run.current;
    t.answered++;
    if (correct) {
      const before = multiplier(t.combo);
      t.combo++;
      t.correct++;
      t.bestCombo = Math.max(t.bestCombo, t.combo);
      t.score += answerPoints(true, ms, t.combo);
      if (multiplier(t.combo) > before) {
        play("combo");
        feel.win();
      } else {
        play("correct");
        feel.select();
      }
    } else {
      t.combo = 0;
      play("wrong");
      feel.fail();
      shake();
    }
    setScore(t.score);
    setCombo(t.combo);
    setPick({ option, correct });

    if (seen.current.has(q.word)) {
      grade(q.word, "recognition", recognitionGrade(correct, ms)).catch(() => {});
    }
    setTimeout(() => {
      if (endsAt.current > Date.now()) next();
    }, correct ? 320 : 950);
  };

  if (stage === "intro") {
    return (
      <Screen>
        <Masthead close />
        <GameIntro
          icon="zap"
          tint={TINT}
          title="Lexicon Blitz"
          tagline="Sixty seconds. A meaning, four words. Pick the one it describes."
          rules={[
            "Tap the word that matches the meaning.",
            "Fast answers score more. Three in a row lifts your multiplier, up to ×3.",
            "A wrong answer resets the multiplier. Words you already know count as review.",
          ]}
          best={best}
          formatBest={(n) => `${n.toLocaleString()} pts`}
          startLabel="Go"
          onStart={() => void start()}
        />
      </Screen>
    );
  }

  if (stage === "done") {
    const acc = tally.answered ? Math.round((tally.correct / tally.answered) * 100) : 0;
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="Lexicon Blitz"
          score={score}
          unit="points"
          result={result}
          verdict={
            acc >= 90
              ? "Sharp. You knew these on sight."
              : acc >= 70
                ? "Solid. The misses are your next review."
                : "The misses are the useful part. They come back in the Lexicon."
          }
          stats={[
            { label: "CORRECT", value: `${tally.correct}/${tally.answered}` },
            { label: "ACCURACY", value: `${acc}%`, tint: acc >= 80 ? SEMANTIC.solid : undefined },
            { label: "BEST COMBO", value: String(tally.bestCombo) },
          ]}
          onAgain={() => void start()}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  const mult = multiplier(combo);
  return (
    <Screen scroll={false}>
      <Masthead close onClose={() => (locked.current = true)} right={`${Math.ceil(left / 1000)}s`} />
      <TimerBar progress={left / BLITZ.lengthMs} tint={TINT} />

      <View style={s.hud}>
        <PopNumber value={score} />
        <View style={[s.mult, mult > 1 && { backgroundColor: alpha(TINT, 0.2), borderColor: TINT }]}>
          <Text style={[s.multText, mult > 1 && { color: TINT }]}>×{mult}</Text>
        </View>
      </View>

      {q ? (
        <Animated.View key={q.word} entering={FadeInDown.springify().damping(20)} style={shakeStyle}>
          <Glass glow={TINT} style={s.meaningCard}>
            <Text style={s.label}>WHICH WORD MEANS</Text>
            <Text style={s.meaning}>{q.meaning}</Text>
          </Glass>
        </Animated.View>
      ) : null}

      {q ? (
        <Animated.View key={`o-${q.word}`} entering={FadeIn.duration(180)} style={s.grid}>
          {q.options.map((o) => {
            const chosen = pick?.option === o;
            const isAnswer = pick !== null && o === q.word;
            const tone = isAnswer ? SEMANTIC.solid : chosen ? AURORA.coral : null;
            return (
              <PressableScale
                key={o}
                onPress={() => answer(o)}
                haptic={false}
                style={s.optionWrap}
                accessibilityLabel={o}
              >
                <View
                  style={[
                    s.option,
                    tone ? { borderColor: tone, backgroundColor: alpha(tone, 0.18) } : null,
                  ]}
                >
                  <Text style={[s.optionText, tone ? { color: tone } : null]}>{o}</Text>
                </View>
              </PressableScale>
            );
          })}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mult: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  multText: { color: CHROME.dust, fontSize: 18, fontFamily: TYPE.monoMedium, ...TABULAR },
  meaningCard: { gap: SPACE.sm, minHeight: 150, justifyContent: "center" },
  label: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  meaning: { color: CHROME.chalk, fontSize: 21, lineHeight: 30, fontFamily: TYPE.displaySoft },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  optionWrap: { width: "47.5%" },
  option: {
    minHeight: 76,
    borderRadius: RADIUS.soft + 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  optionText: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.uiSemi, textAlign: "center" },
});
