// Word Bomb: five words, thirty seconds each. Say a sentence that uses the word
// before the fuse runs out.
//
// The Whisper prompt carries the target word. That biases the transcriber
// toward spelling a rare word right when you did say it, which matters more
// than the small chance it hears the word you did not say: a game that misses
// real uses teaches you the word does not work.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { GlowButton } from "../../../components/kit/GlowButton";
import { Glyph } from "../../../components/kit/Glyph";
import { Confetti } from "../../../components/kit/Confetti";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { useTake } from "../../../components/useTake";
import { AURORA, CHROME, SEMANTIC, SPACE, TABULAR, TYPE, alpha } from "../../../theme";
import { ALL_WORDS, gloss, type Gloss } from "../../lexicon/glossary";
import { gradeProduction } from "../../lexicon/lexiconStore";
import { seenWords } from "../../../lib/db";
import { rng, shuffle } from "../blitz";
import { findUse } from "../wordMatch";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameIntro, GameResult, TimerBar, useShake } from "../GameKit";

const TINT = AURORA.cyan;
const BOMBS = 5;
const FUSE_MS = 30_000;

type Stage = "intro" | "armed" | "checking" | "verdict" | "done";
type Verdict = { defused: boolean; heard: string; match: string | null };

export default function BombScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [stage, setStage] = useState<Stage>("intro");
  const [best, setBest] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [words, setWords] = useState<Gloss[]>([]);
  const [left, setLeft] = useState<number>(FUSE_MS);
  const [defused, setDefused] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [burst, setBurst] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const { style: shakeStyle, shake } = useShake();

  const word = words[round] ?? null;
  const take = useTake({ prompt: word?.word });
  const seen = useRef<Set<string>>(new Set());
  const endsAt = useRef(0);
  const lastTick = useRef(0);
  const settled = useRef(false);
  const hits = useRef<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      void bestOf("bomb").then(setBest);
    }, [])
  );

  const judge = useCallback(
    (heard: string, target: Gloss) => {
      const match = findUse(heard, target.word);
      const ok = match !== null;
      setVerdict({ defused: ok, heard, match });
      setStage("verdict");
      if (ok) {
        hits.current.push(target.word);
        setDefused((d) => d + 1);
        setBurst((b) => b + 1);
        play("defuse");
        feel.win();
        if (seen.current.has(target.word)) {
          gradeProduction(target.word, { sense: true, collocation: true, register: true }).catch(() => {});
        }
      } else {
        play("boom");
        feel.fail();
        shake();
      }
    },
    [shake]
  );

  const check = useCallback(async () => {
    if (!word || settled.current) return;
    settled.current = true;
    setStage("checking");
    const t = await take.stop();
    if (!t) {
      // The transcriber failed, not you: re-arm the same bomb with a fresh fuse.
      settled.current = false;
      endsAt.current = Date.now() + FUSE_MS;
      setLeft(FUSE_MS);
      setStage("armed");
      return;
    }
    judge(t.text, word);
  }, [judge, take, word]);

  // The take object changes on every meter reading; the fuse reads it through a
  // ref so the interval is not torn down ten times a second and starved.
  const latest = useRef({ recording: false, check, judge, word });
  latest.current = { recording: take.recording, check, judge, word };

  useEffect(() => {
    if (stage !== "armed") return;
    const id = setInterval(() => {
      const ms = Math.max(0, endsAt.current - Date.now());
      const now = latest.current;
      setLeft(ms);
      // Ticks only while the mic is closed: a recording would hear them.
      const sec = Math.ceil(ms / 1000);
      if (!now.recording && sec <= 5 && sec !== lastTick.current && ms > 0) {
        lastTick.current = sec;
        play("tick");
      }
      if (ms > 0 || settled.current || !now.word) return;
      if (now.recording) {
        void now.check();
      } else {
        settled.current = true;
        now.judge("", now.word);
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage]);

  const arm = (index: number) => {
    settled.current = false;
    lastTick.current = 0;
    take.clearError();
    setVerdict(null);
    setRound(index);
    endsAt.current = Date.now() + FUSE_MS;
    setLeft(FUSE_MS);
    setStage("armed");
  };

  const start = async () => {
    let met: string[] = [];
    try {
      met = await seenWords("recognition");
    } catch {
      met = [];
    }
    seen.current = new Set(met);
    const r = rng(Date.now());
    // Words you have met first; strangers only to fill a short deck.
    const pool = [...shuffle(met, r), ...shuffle(ALL_WORDS.filter((w) => !seen.current.has(w)), r)];
    const picked = pool
      .map((w) => gloss(w))
      .filter((g): g is Gloss => g !== undefined)
      .slice(0, BOMBS);
    hits.current = [];
    setWords(picked);
    setDefused(0);
    setResult(null);
    play("go");
    feel.thud();
    arm(0);
  };

  const advance = async () => {
    if (round + 1 < words.length) {
      arm(round + 1);
      return;
    }
    setStage("done");
    play("win");
    const res = await finishGame("bomb", hits.current.length, { words: words.map((w) => w.word), hits: hits.current });
    setResult(res);
  };

  const quit = () => {
    settled.current = true;
    void take.cancel();
  };

  if (stage === "intro") {
    return (
      <Screen>
        <Masthead close />
        <GameIntro
          icon="bomb"
          tint={TINT}
          title="Word Bomb"
          tagline="A word lands with a lit fuse. Use it in a sentence out loud before it blows."
          rules={[
            "You get the word, what it means, and a phrase it lives in.",
            "Tap Speak, say any sentence that uses it, then tap Defuse.",
            "Other forms count: contingency, mitigated, leveraging. Five bombs a round.",
          ]}
          best={best}
          formatBest={(n) => `${n}/${BOMBS} defused`}
          startLabel="Light the fuse"
          onStart={() => void start()}
          disabled={!take.ready}
          note={take.ready ? null : take.error ?? "Waiting for the microphone…"}
        />
      </Screen>
    );
  }

  if (stage === "done") {
    return (
      <Screen>
        <Masthead close />
        <GameResult
          title="Word Bomb"
          score={defused}
          unit={`of ${words.length} defused`}
          result={result}
          verdict={
            defused === words.length
              ? "Clean sweep. Every word came out when you needed it."
              : defused >= 3
                ? "Most of them came out under pressure. That is the skill."
                : "The ones that blew up are the ones to say out loud today."
          }
          stats={[
            { label: "Defused", value: String(defused), tint: SEMANTIC.solid },
            { label: "Blew up", value: String(words.length - defused), tint: defused < words.length ? AURORA.coral : undefined },
          ]}
          onAgain={() => void start()}
          onDone={() => router.back()}
        >
          <Glass style={{ gap: 8 }}>
            {words.map((w) => {
              const ok = hits.current.includes(w.word);
              return (
                <View key={w.word} style={s.recap}>
                  <Glyph name={ok ? "check" : "x"} size={16} color={ok ? SEMANTIC.solid : AURORA.coral} strokeWidth={2.4} />
                  <Text style={s.recapWord}>{w.word}</Text>
                  <Text style={s.recapHint} numberOfLines={1}>
                    {w.collocations[0]}
                  </Text>
                </View>
              );
            })}
          </Glass>
        </GameResult>
      </Screen>
    );
  }

  if (!word) return null;
  const busy = stage === "checking" || take.busy;

  return (
    <Screen>
      <Masthead close onClose={quit} right={`Bomb ${round + 1}/${words.length}`} />
      {verdict?.defused ? <Confetti burst={burst} originX={width / 2} originY={220} count={50} /> : null}

      {stage === "armed" || stage === "checking" ? (
        <View style={s.fuseRow}>
          <Fuse progress={left / FUSE_MS} />
          <Text style={[s.secs, left < 6000 && { color: AURORA.coral }]}>{Math.ceil(left / 1000)}s</Text>
        </View>
      ) : null}

      <Animated.View key={word.word} entering={FadeInDown.springify().damping(18)} style={shakeStyle}>
        <Glass glow={verdict ? (verdict.defused ? SEMANTIC.solid : AURORA.coral) : TINT} style={s.card}>
          <Text style={s.word}>{word.word}</Text>
          <Text style={s.say}>{word.say}</Text>
          <Text style={s.meaning}>{word.meaning}</Text>
          <View style={s.hint}>
            <Text style={s.hintLabel}>Try</Text>
            <Text style={s.hintText}>“{word.collocations[0]}”</Text>
          </View>
        </Glass>
      </Animated.View>

      {stage === "verdict" && verdict ? (
        <Animated.View entering={FadeInDown.springify()} style={{ gap: SPACE.sm }}>
          <Text style={[s.verdict, { color: verdict.defused ? SEMANTIC.solid : AURORA.coral }]}>
            {verdict.defused ? "Defused." : verdict.heard ? "Boom. The word never came out." : "Boom. The fuse ran out."}
          </Text>
          {verdict.heard ? (
            <Glass style={{ gap: 6 }}>
              <Text style={s.hintLabel}>What we heard</Text>
              <Heard text={verdict.heard} match={verdict.match} />
            </Glass>
          ) : null}
          <GlowButton
            label={round + 1 < words.length ? "Next bomb" : "See the damage"}
            onPress={() => void advance()}
            icon={round + 1 < words.length ? "bomb" : "trophy"}
          />
        </Animated.View>
      ) : (
        <View style={{ gap: SPACE.sm }}>
          {take.error ? <Text style={s.error}>{take.error}</Text> : null}
          {take.recording ? (
            <GlowButton label={`Defuse  ·  ${Math.floor(take.seconds)}s`} onPress={() => void check()} icon="check" tone="good" />
          ) : (
            <GlowButton
              label={busy ? "Checking…" : "Speak"}
              onPress={() => void take.start()}
              icon="mic"
              disabled={busy || !take.ready}
            />
          )}
          <Text style={s.foot}>
            {take.recording ? "Say your sentence, then tap Defuse." : busy ? "Listening back…" : "The fuse is already burning."}
          </Text>
        </View>
      )}
    </Screen>
  );
}

function Fuse({ progress }: { progress: number }) {
  const pulse = useSharedValue(1);
  const low = progress < 0.25;
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.25, { duration: low ? 180 : 420 }), withTiming(1, { duration: low ? 180 : 420 })),
      -1
    );
  }, [low, pulse]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <View style={s.fuse}>
      <Animated.View style={st}>
        <Glyph name="bomb" size={26} color={low ? AURORA.coral : CHROME.chalk} strokeWidth={1.8} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <TimerBar progress={progress} tint={TINT} />
      </View>
    </View>
  );
}

/** The transcript with the matching word lit up. */
function Heard({ text, match }: { text: string; match: string | null }) {
  if (!match) return <Text style={s.heard}>{text}</Text>;
  const at = text.toLowerCase().indexOf(match.split(" ")[0]!.toLowerCase());
  if (at < 0) return <Text style={s.heard}>{text}</Text>;
  const end = at + match.length;
  return (
    <Text style={s.heard}>
      {text.slice(0, at)}
      <Text style={{ color: SEMANTIC.solid, fontFamily: TYPE.uiBold }}>{text.slice(at, end)}</Text>
      {text.slice(end)}
    </Text>
  );
}

const s = StyleSheet.create({
  fuseRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  fuse: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  secs: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.monoMedium, minWidth: 40, textAlign: "right", ...TABULAR },
  card: { gap: 8 },
  word: { color: CHROME.chalk, fontSize: 38, fontFamily: TYPE.display, letterSpacing: -1 },
  say: { color: CHROME.dust, fontSize: 14, fontFamily: TYPE.mono, marginTop: -4 },
  meaning: { color: CHROME.chalk, fontSize: 17, lineHeight: 25, fontFamily: TYPE.displaySoft },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(CHROME.chalk, 0.15),
  },
  hintLabel: { color: CHROME.dust, fontSize: 11.5, fontFamily: TYPE.uiBold },
  hintText: { flex: 1, color: AURORA.mint, fontSize: 15, fontFamily: TYPE.uiMedium },
  verdict: { fontSize: 24, fontFamily: TYPE.display, textAlign: "center" },
  heard: { color: CHROME.chalk, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui },
  error: { color: AURORA.coral, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui, textAlign: "center" },
  foot: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.ui, textAlign: "center" },
  recap: { flexDirection: "row", alignItems: "center", gap: 10 },
  recapWord: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiSemi },
  recapHint: { flex: 1, color: CHROME.dust, fontSize: 13, fontFamily: TYPE.ui, textAlign: "right" },
});
