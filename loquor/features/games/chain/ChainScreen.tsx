// Word Chain: a list of words goes by, one at a time. Rebuild it in order.
//
// Serial recall is the memory under "I had three points": keeping a few things
// in the order you meant to say them, and getting to the third one intact.

import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { GlowButton } from "../../../components/kit/GlowButton";
import { PressableScale, Rise } from "../../../components/kit/motion";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { AURORA, CHROME, RADIUS, SEMANTIC, SPACE, TABULAR, TYPE, alpha } from "../../../theme";
import { MAX_LEVEL, chainCorrect, chainLevel, chainRound, rng, runScore, unlockedLevel } from "../memory";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, useShake } from "../GameKit";
import { usePetAway } from "../../pet/petPresence";
import { LevelPicker, useTimers } from "../memory/shared";

const TINT = AURORA.mint;

type Stage = "intro" | "play" | "done";
type Phase = "study" | "recall" | "judged";

export default function ChainScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  usePetAway(stage === "play");
  const [best, setBest] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<Phase>("study");
  const [shown, setShown] = useState<number>(-1);
  const [list, setList] = useState<string[]>([]);
  const [board, setBoard] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const { style: shakeStyle, shake } = useShake();
  const { after, clear } = useTimers();

  const r = useRef(rng(Date.now()));
  const levelRef = useRef(1);

  useFocusEffect(
    useCallback(() => {
      void bestOf("chain").then((b) => {
        setBest(b);
        setLevel(unlockedLevel("chain", b));
      });
    }, [])
  );

  const lv = chainLevel(level);
  const needed = Math.ceil(lv.toPass * lv.words * lv.trials);

  const show = (words: string[], i: number) => {
    const rule = chainLevel(levelRef.current);
    if (i >= words.length) {
      setShown(-1);
      after(300, () => setPhase("recall"));
      return;
    }
    setShown(i);
    play("tick");
    after(rule.showMs, () => {
      setShown(-1);
      after(rule.gapMs, () => show(words, i + 1));
    });
  };

  const runTrial = () => {
    const round = chainRound(chainLevel(levelRef.current), r.current);
    setList(round.list);
    setBoard(round.board);
    setAnswer([]);
    setPhase("study");
    after(800, () => show(round.list, 0));
  };

  const finish = async (all: number[]) => {
    const l = levelRef.current;
    const rule = chainLevel(l);
    const total = all.reduce((a, b) => a + b, 0);
    const passed = total >= Math.ceil(rule.toPass * rule.words * rule.trials);
    setStage("done");
    if (passed) {
      play("win");
      feel.win();
    } else {
      feel.warn();
    }
    const res = await finishGame("chain", runScore(l, passed), {
      level: l,
      passed,
      correct: total,
      slots: rule.words * all.length,
    });
    setResult(res);
    if (passed) setBest((b) => Math.max(b ?? 0, l));
  };

  const pick = (word: string) => {
    if (phase !== "recall" || answer.length >= list.length || answer.includes(word)) return;
    feel.tap();
    setAnswer([...answer, word]);
  };

  const undo = () => {
    if (phase !== "recall" || answer.length === 0) return;
    feel.select();
    setAnswer(answer.slice(0, -1));
  };

  const check = () => {
    const right = chainCorrect(list, answer);
    const next = [...scores, right];
    setScores(next);
    setPhase("judged");
    if (right === list.length) {
      play("correct");
      feel.win();
    } else {
      play("wrong");
      feel.fail();
      shake();
    }
  };

  const advance = () => {
    const rule = chainLevel(levelRef.current);
    const total = scores.reduce((a, b) => a + b, 0);
    const left = (rule.trials - scores.length) * rule.words;
    const need = Math.ceil(rule.toPass * rule.words * rule.trials);
    // Stop as soon as the level can no longer be cleared: a list you cannot
    // pass on is a list you are just enduring.
    if (scores.length >= rule.trials || total + left < need) void finish(scores);
    else runTrial();
  };

  const start = (l: number) => {
    clear();
    levelRef.current = l;
    setLevel(l);
    r.current = rng(Date.now());
    setScores([]);
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
          icon="list-ordered"
          tint={TINT}
          title="Word Chain"
          tagline="Words go by one at a time. Rebuild the list in the order you saw it."
          rules={[
            "Watch the list once. There is no going back to it.",
            "Tap the words back in order. The board has decoys that were never on the list.",
            `Two lists a level. Put ${Math.round(lv.toPass * 100)}% of the words in the right place to clear it.`,
          ]}
          best={best}
          formatBest={(n) => (n > 0 ? `level ${n}` : "no level cleared yet")}
          startLabel={`Start level ${level}`}
          onStart={() => start(level)}
        >
          <Rise index={2}>
            <LevelPicker
              max={MAX_LEVEL.chain}
              unlocked={unlockedLevel("chain", best)}
              value={level}
              onChange={setLevel}
              tint={TINT}
              describe={(l) => {
                const x = chainLevel(l);
                return `${x.words} words, ${(x.showMs / 1000).toFixed(1)}s each`;
              }}
            />
          </Rise>
        </GameIntro>
      </Screen>
    );
  }

  if (stage === "done") {
    const total = scores.reduce((a, b) => a + b, 0);
    const slots = lv.words * scores.length;
    const passed = total >= needed;
    const top = level >= MAX_LEVEL.chain;
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="Word Chain"
          score={level}
          unit={passed ? "level cleared" : "level not cleared yet"}
          result={result}
          verdict={
            passed
              ? top
                ? "Thirteen words in order. That is the top of the chain."
                : `Level ${level + 1} is open: ${lv.words + 1} words to hold.`
              : "Try saying each new word with the last one as it goes by: the pair sticks better than the word."
          }
          stats={[
            { label: "In place", value: `${total}/${slots}`, tint: passed ? SEMANTIC.solid : undefined },
            { label: "Needed", value: String(needed) },
          ]}
          onAgain={() => start(passed && !top ? level + 1 : level)}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  const trial = phase === "judged" ? scores.length : scores.length + 1;

  return (
    <Screen scroll={phase !== "study"}>
      <Masthead close onClose={clear} right={`Level ${level} · list ${trial}/${lv.trials}`} />

      {phase === "study" ? (
        <View style={s.study}>
          <Text style={s.kicker}>
            {shown >= 0 ? `${shown + 1} of ${list.length}` : "Watch the list"}
          </Text>
          <Glass glow={TINT} style={s.studyCard}>
            <View style={s.studyInner}>
              {shown >= 0 ? (
                <Animated.Text key={shown} entering={FadeInDown.duration(160)} style={s.studyWord}>
                  {list[shown]}
                </Animated.Text>
              ) : (
                <Text style={[s.studyWord, s.blank]}>·</Text>
              )}
            </View>
          </Glass>
          <View style={s.pips}>
            {list.map((_, i) => (
              <View key={i} style={[s.pip, i <= shown && { backgroundColor: TINT }]} />
            ))}
          </View>
        </View>
      ) : (
        <>
          <Animated.View style={shakeStyle}>
            <Glass glow={phase === "judged" ? (scores[scores.length - 1] === list.length ? SEMANTIC.solid : AURORA.coral) : undefined}>
              <View style={s.slots}>
                {list.map((word, i) => {
                  const got = answer[i];
                  const judged = phase === "judged";
                  const ok = got === word;
                  return (
                    <View
                      key={i}
                      style={[
                        s.slot,
                        !judged && i === answer.length && { borderColor: alpha(TINT, 0.7) },
                        judged && { borderColor: ok ? alpha(SEMANTIC.solid, 0.7) : alpha(AURORA.coral, 0.7) },
                      ]}
                    >
                      <Text style={s.slotN}>{i + 1}</Text>
                      <Text style={[s.slotWord, !got && s.slotEmpty]} numberOfLines={1}>
                        {got ?? (judged ? "—" : "")}
                      </Text>
                      {judged && !ok ? (
                        <Animated.Text entering={FadeIn} style={s.slotFix} numberOfLines={1}>
                          {word}
                        </Animated.Text>
                      ) : null}
                      {judged ? (
                        <Text style={{ color: ok ? SEMANTIC.solid : AURORA.coral, fontFamily: TYPE.uiBold }}>
                          {ok ? "✓" : "✗"}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </Glass>
          </Animated.View>

          {phase === "recall" ? (
            <>
              <View style={s.board}>
                {board.map((word) => {
                  const used = answer.includes(word);
                  return (
                    <PressableScale
                      key={word}
                      onPress={() => pick(word)}
                      disabled={used}
                      haptic={false}
                      scaleTo={0.93}
                      accessibilityLabel={word}
                    >
                      <View style={[s.chip, used && s.chipUsed]}>
                        <Text style={[s.chipText, used && { color: CHROME.dustDim }]}>{word}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
              <View style={s.actions}>
                <GlowButton label="Undo" onPress={undo} tone="ghost" icon="replay" compact disabled={answer.length === 0} style={{ flex: 1 }} />
                <GlowButton
                  label="Check"
                  onPress={check}
                  compact
                  disabled={answer.length < list.length}
                  style={{ flex: 2 }}
                />
              </View>
            </>
          ) : (
            <View style={{ gap: SPACE.sm }}>
              <Text style={s.verdict}>
                {scores[scores.length - 1]} of {list.length} in place
              </Text>
              <GlowButton
                label={scores.length >= lv.trials ? "See result" : "Next list"}
                onPress={advance}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  study: { alignItems: "center", gap: SPACE.md, marginTop: SPACE.xl },
  kicker: { color: CHROME.dust, fontSize: 15, fontFamily: TYPE.uiSemi, ...TABULAR },
  studyCard: { width: "100%" },
  studyInner: { height: 140, alignItems: "center", justifyContent: "center" },
  studyWord: { color: CHROME.chalk, fontSize: 44, lineHeight: 54, fontFamily: TYPE.display, letterSpacing: -0.8 },
  blank: { color: CHROME.dustDim },
  pips: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  pip: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.16)" },
  slots: { gap: 6 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: RADIUS.soft - 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  slotN: { color: CHROME.dust, width: 18, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
  slotWord: { flex: 1, color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.uiSemi },
  slotEmpty: { color: CHROME.dustDim },
  slotFix: { color: SEMANTIC.solid, fontSize: 14, fontFamily: TYPE.uiMedium, maxWidth: "45%" },
  board: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  chip: {
    paddingHorizontal: 14,
    height: 42,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: alpha(TINT, 0.45),
    backgroundColor: alpha(TINT, 0.1),
  },
  chipUsed: { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "transparent" },
  chipText: { color: CHROME.chalk, fontSize: 15.5, fontFamily: TYPE.uiSemi },
  actions: { flexDirection: "row", gap: SPACE.sm },
  verdict: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.displaySoft, textAlign: "center" },
});
