// Bring It to Life: the robot-voice trainer.
//
// Each take is transcribed, then replayed out loud while its melody line draws,
// so you hear the flatness and see it at once. If this phone's player hands back
// no frames, Melody is switched off for the session and Liveliness falls back to
// Punch and Rhythm, which need only the meter and the word timings.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, useSharedValue, withTiming } from "react-native-reanimated";

import { Masthead, Screen } from "../../../components/kit/Screen";
import { Glass } from "../../../components/kit/Glass";
import { GlowButton } from "../../../components/kit/GlowButton";
import { Glyph, type GlyphName } from "../../../components/kit/Glyph";
import { MelodyLine } from "../../../components/kit/MelodyLine";
import { RobotOrb } from "../../../components/kit/RobotOrb";
import { PressableScale, Rise } from "../../../components/kit/motion";
import { feel } from "../../../components/kit/feel";
import { play } from "../../../components/kit/sfx";
import { LEVEL_STEP_S, discardAudio, useTake, type Take } from "../../../components/useTake";
import { useReplayMelody } from "../../../components/useReplayMelody";
import { AURORA, CHROME, SEMANTIC, SPACE, TABULAR, TYPE, alpha } from "../../../theme";
import type { PitchPoint } from "../pitch";
import { emphasis, liveliness, type Liveliness } from "../prosody";
import {
  DELIVERY_LINES,
  EMPHASIS_LINES,
  EMPHASIS_ROUNDS,
  INTENTS,
  PASSAGES,
  TALK_PROMPTS,
  deliveriesScore,
  emphasisScore,
  locate,
  morph,
  pick,
  retellScore,
  type AliveMode,
} from "../alive";
import { bestOf, finishGame, type RunResult } from "../runs";
import { GameResult } from "../GameKit";

const TINT = AURORA.plum;

const MODES: { key: AliveMode; title: string; blurb: string; icon: GlyphName }[] = [
  { key: "talk", title: "Just talk", blurb: "Thirty seconds on a prompt. See how alive you sound.", icon: "mic" },
  { key: "deliveries", title: "Three deliveries", blurb: "One line, three moods. Make them sound different.", icon: "sparkles" },
  { key: "retell", title: "Read, then retell", blurb: "Read a passage aloud, then tell it. Close the gap.", icon: "book" },
  { key: "emphasis", title: "Emphasis", blurb: "Make one word stand out in each line.", icon: "zap" },
];

/** Auto-stop, in seconds, per kind of step. */
const LIMIT = { talk: 30, delivery: 8, read: 45, retell: 45, emphasis: 8 } as const;

type Step =
  | { kind: "talk"; prompt: string }
  | { kind: "delivery"; line: string; intent: (typeof INTENTS)[number] }
  | { kind: "read"; passage: string }
  | { kind: "retell"; passage: string }
  | { kind: "emphasis"; text: string; target: string };

type StepResult = {
  live: Liveliness | null;
  points: PitchPoint[];
  heard: string;
  hit?: { louder: boolean; longer: boolean; higher: boolean; hit: boolean; said: boolean };
};

type Stage = "menu" | "ready" | "recording" | "analysing" | "step" | "done";

function plan(mode: AliveMode): Step[] {
  switch (mode) {
    case "talk":
      return [{ kind: "talk", prompt: pick(TALK_PROMPTS) }];
    case "deliveries": {
      const line = pick(DELIVERY_LINES);
      return INTENTS.map((intent) => ({ kind: "delivery", line, intent }));
    }
    case "retell": {
      const passage = pick(PASSAGES);
      return [
        { kind: "read", passage },
        { kind: "retell", passage },
      ];
    }
    case "emphasis": {
      const lines = [...EMPHASIS_LINES].sort(() => Math.random() - 0.5).slice(0, EMPHASIS_ROUNDS);
      return lines.map((l) => ({ kind: "emphasis", text: l.text, target: l.target }));
    }
  }
}

function scoreRun(mode: AliveMode, results: StepResult[]): { score: number; extra: string | null } {
  const lives = results.map((r) => r.live).filter((l): l is Liveliness => l !== null);
  switch (mode) {
    case "talk":
      return { score: lives[0]?.score ?? 0, extra: null };
    case "deliveries": {
      const d = deliveriesScore(lives);
      return { score: d.score, extra: `Contrast ${d.contrast} · average liveliness ${d.average}` };
    }
    case "retell": {
      const [read, retell] = results;
      if (!read?.live || !retell?.live) return { score: read?.live?.score ?? 0, extra: null };
      const r = retellScore(read.live, retell.live);
      return {
        score: r.score,
        extra:
          r.gap > 5
            ? `Your telling voice was ${r.gap} livelier than your reading voice. That gap is the reading voice.`
            : "Your reading sounded like your talking. That's the goal.",
      };
    }
    case "emphasis":
      return {
        score: emphasisScore(results.map((r) => ({ hit: r.hit?.hit ?? false, liveliness: r.live?.score ?? null }))),
        extra: `${results.filter((r) => r.hit?.hit).length} of ${results.length} words landed`,
      };
  }
}

export default function AliveScreen() {
  const router = useRouter();
  const [melodyOff, setMelodyOff] = useState(false);
  const step = useRef<Step | null>(null);
  const take = useTake({ keepAudio: !melodyOff });
  const replay = useReplayMelody();
  const [stage, setStage] = useState<Stage>("menu");
  const [mode, setMode] = useState<AliveMode>("talk");
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<StepResult[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [final, setFinal] = useState<{ score: number; extra: string | null }>({ score: 0, extra: null });
  const level = useSharedValue(0);
  const stopping = useRef(false);

  const current = steps[index] ?? null;
  step.current = current;
  const last = results[results.length - 1];
  const shownMorph = last?.live ? morph(last.live.score) : 0;

  useFocusEffect(
    useCallback(() => {
      void bestOf("alive").then(setBest);
    }, [])
  );

  useEffect(() => {
    level.value = withTiming(take.level, { duration: 100 });
  }, [take.level, level]);

  const begin = (m: AliveMode) => {
    feel.tap();
    setMode(m);
    setSteps(plan(m));
    setIndex(0);
    setResults([]);
    setResult(null);
    setNote(null);
    setStage("ready");
  };

  const record = async () => {
    setNote(null);
    play("go");
    await new Promise((r) => setTimeout(r, 250));
    stopping.current = false;
    if (await take.start()) setStage("recording");
  };

  const judge = useCallback(
    (t: Take, points: PitchPoint[], s: Step): StepResult => {
      const live = liveliness({ points: points.length ? points : undefined, levelsDb: t.levels, words: t.words });
      if (s.kind !== "emphasis") return { live, points, heard: t.text };
      const at = locate(t.words, s.target);
      if (at < 0) {
        return { live, points, heard: t.text, hit: { louder: false, longer: false, higher: false, hit: false, said: false } };
      }
      const e = emphasis({ words: t.words, target: at, levelsDb: t.levels, levelStep: LEVEL_STEP_S, points });
      return { live, points, heard: t.text, hit: { ...e, said: true } };
    },
    []
  );

  const finishTake = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    const s = step.current;
    setStage("analysing");
    const t = await take.stop();
    if (!t || !s) {
      setNote(take.error ?? "That take didn't come through. Try it again.");
      setStage("ready");
      return;
    }
    let points: PitchPoint[] = [];
    if (t.audioUri && !melodyOff) {
      const got = await replay.analyse(t.audioUri, t.metrics.durationS || LIMIT.read);
      if (got === null) setMelodyOff(true);
      else points = got;
    } else {
      discardAudio(t.audioUri);
    }
    const r = judge(t, points, s);
    if (!r.live) {
      setNote("Too short to judge. Say a little more this time.");
      setStage("ready");
      return;
    }
    if (r.live.score >= 75) feel.win();
    else feel.select();
    setResults((xs) => [...xs, r]);
    setStage("step");
  }, [take, replay, melodyOff, judge]);

  const limit = current ? LIMIT[current.kind] : LIMIT.talk;
  useEffect(() => {
    if (stage === "recording" && take.seconds >= limit) void finishTake();
  }, [stage, take.seconds, limit, finishTake]);

  const advance = async () => {
    if (index + 1 < steps.length) {
      setIndex(index + 1);
      setStage("ready");
      return;
    }
    const f = scoreRun(mode, results);
    setFinal(f);
    play("win");
    feel.win();
    setStage("done");
    setResult(await finishGame("alive", f.score, { mode, steps: results.map((r) => r.live?.score ?? null) }));
  };

  const quit = () => {
    stopping.current = true;
    void take.cancel();
    replay.cancel();
  };

  if (stage === "menu") {
    return (
      <Screen>
        <Masthead close />
        <Rise index={0} style={s.hero}>
          <RobotOrb size={150} morph={best === null ? 0 : morph(best)} />
          <Text style={s.title}>Bring It to Life</Text>
          <Text style={s.tagline}>
            A reading voice is flat: one pitch, one loudness, one speed. This trains the opposite.
          </Text>
          <Text style={s.best}>{best === null ? "No best yet." : `Your best: ${best}`}</Text>
        </Rise>
        {MODES.map((m, i) => (
          <Rise key={m.key} index={i + 1}>
            <PressableScale onPress={() => begin(m.key)} scaleTo={0.97} accessibilityLabel={m.title}>
              <Glass style={s.mode}>
                <View style={[s.modeIcon, { borderColor: alpha(TINT, 0.5), backgroundColor: alpha(TINT, 0.12) }]}>
                  <Glyph name={m.icon} size={22} color={TINT} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.modeTitle}>{m.title}</Text>
                  <Text style={s.modeBlurb}>{m.blurb}</Text>
                </View>
                <Glyph name="chevron" size={18} color={CHROME.dust} />
              </Glass>
            </PressableScale>
          </Rise>
        ))}
        {melodyOff ? (
          <Text style={s.fallback}>
            Melody isn't available on this phone, so Liveliness is scored on punch and rhythm.
          </Text>
        ) : null}
      </Screen>
    );
  }

  if (stage === "done") {
    const lives = results.map((r) => r.live?.score ?? 0);
    return (
      <Screen>
        <Masthead close />
        <View style={{ alignItems: "center" }}>
          <RobotOrb size={130} morph={morph(final.score)} mood={final.score >= 75 ? "happy" : "idle"} />
        </View>
        <GameResult
          title="Bring It to Life"
          score={final.score}
          unit="liveliness"
          result={result}
          verdict={final.extra ?? undefined}
          stats={lives.map((v, i) => ({ label: `TAKE ${i + 1}`, value: String(v), tint: v >= 75 ? SEMANTIC.solid : undefined }))}
          onAgain={() => begin(mode)}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  const listening = stage === "recording";
  return (
    <Screen>
      <Masthead
        close
        onClose={quit}
        right={steps.length > 1 ? `${index + 1} / ${steps.length}` : undefined}
      />

      <View style={s.center}>
        <RobotOrb
          size={stage === "step" ? 130 : 150}
          morph={stage === "step" && last?.live ? morph(last.live.score) : shownMorph}
          level={listening ? level : undefined}
          mood={listening ? "listening" : stage === "step" && (last?.live?.score ?? 0) >= 75 ? "happy" : "idle"}
        />
      </View>

      {stage === "ready" || stage === "recording" ? (
        <>
          {current ? <TaskCard step={current} /> : null}
          {note ? <Text style={s.note}>{note}</Text> : null}
          {listening ? (
            <View style={{ gap: SPACE.sm }}>
              <Text style={s.timer}>
                {Math.floor(take.seconds)}s <Text style={s.timerDim}>/ {limit}s</Text>
              </Text>
              <GlowButton label="Done" onPress={() => void finishTake()} icon="check" />
            </View>
          ) : (
            <GlowButton label="Start" onPress={() => void record()} icon="mic" disabled={!take.ready} />
          )}
        </>
      ) : null}

      {stage === "analysing" ? (
        <Animated.View entering={FadeIn} style={{ gap: SPACE.sm }}>
          <Text style={s.phase}>{replay.replaying ? "Listen to yourself…" : "Listening back…"}</Text>
          {!melodyOff ? (
            <Glass style={s.lineCard}>
              <MelodyLine points={replay.points} color={TINT} />
            </Glass>
          ) : null}
        </Animated.View>
      ) : null}

      {stage === "step" && last ? (
        <StepCard
          r={last}
          step={current}
          melodyOff={melodyOff}
          onNext={() => void advance()}
          onRetry={() => {
            setResults((xs) => xs.slice(0, -1));
            setStage("ready");
          }}
          final={index + 1 >= steps.length}
        />
      ) : null}
    </Screen>
  );
}

function TaskCard({ step }: { step: Step }) {
  switch (step.kind) {
    case "talk":
      return (
        <Glass glow={TINT} style={s.task}>
          <Text style={s.label}>TALK ABOUT</Text>
          <Text style={s.prompt}>{step.prompt}</Text>
          <Text style={s.cue}>Talk the way you would to a friend across the table.</Text>
        </Glass>
      );
    case "delivery":
      return (
        <Glass glow={TINT} style={s.task}>
          <Text style={s.label}>SAY IT AS · {step.intent.label.toUpperCase()}</Text>
          <Text style={s.line}>“{step.line}”</Text>
          <Text style={s.cue}>{step.intent.cue}</Text>
        </Glass>
      );
    case "read":
      return (
        <Glass glow={TINT} style={s.task}>
          <Text style={s.label}>READ THIS ALOUD</Text>
          <Text style={s.passage}>{step.passage}</Text>
          <Text style={s.cue}>Read it like you're telling it, not reading it.</Text>
        </Glass>
      );
    case "retell":
      return (
        <Glass glow={TINT} style={s.task}>
          <Text style={s.label}>NOW TELL IT</Text>
          <Text style={s.prompt}>Put the page away. Tell me what you just read, in your own words.</Text>
          <Text style={s.cue}>This is your talking voice. We'll compare the two.</Text>
        </Glass>
      );
    case "emphasis": {
      const words = step.text.split(" ");
      return (
        <Glass glow={TINT} style={s.task}>
          <Text style={s.label}>LEAN ON THE HIGHLIGHTED WORD</Text>
          <Text style={s.line}>
            {words.map((w, i) => {
              const on = w.replace(/[^a-z']/gi, "").toLowerCase() === step.target.toLowerCase();
              return (
                <Text key={i} style={on ? { color: TINT, textDecorationLine: "underline" } : null}>
                  {w}
                  {i < words.length - 1 ? " " : ""}
                </Text>
              );
            })}
          </Text>
          <Text style={s.cue}>Louder, longer or higher than the words around it.</Text>
        </Glass>
      );
    }
  }
}

function StepCard({
  r,
  step,
  melodyOff,
  onNext,
  onRetry,
  final,
}: {
  r: StepResult;
  step: Step | null;
  melodyOff: boolean;
  onNext: () => void;
  onRetry: () => void;
  final: boolean;
}) {
  const live = r.live!;
  const parts: { label: string; value: number | null; hint: string }[] = [
    { label: "MELODY", value: live.melody?.score ?? null, hint: live.melody ? `${live.melody.rangeSt.toFixed(1)} semitones` : melodyOff ? "off" : "too little" },
    { label: "PUNCH", value: live.punch?.score ?? null, hint: live.punch ? `${live.punch.spreadDb.toFixed(1)} dB` : "too little" },
    { label: "RHYTHM", value: live.rhythm?.score ?? null, hint: live.rhythm ? "" : "too few words" },
  ];
  return (
    <Animated.View entering={FadeInDown.springify().damping(20)} style={{ gap: SPACE.md }}>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Text style={[s.verdict, { color: live.score >= 75 ? SEMANTIC.solid : live.score >= 55 ? CHROME.chalk : AURORA.coral }]}>
          {live.label}
        </Text>
        <Text style={s.score}>{live.score}</Text>
      </View>

      {r.points.length ? (
        <Glass style={s.lineCard}>
          <MelodyLine points={r.points} color={TINT} />
        </Glass>
      ) : null}

      <Glass style={s.parts}>
        {parts.map((p) => (
          <View key={p.label} style={s.part}>
            <Text style={[s.partValue, p.value !== null && p.value >= 70 ? { color: SEMANTIC.solid } : null]}>
              {p.value === null ? "—" : p.value}
            </Text>
            <Text style={s.partLabel}>{p.label}</Text>
            {p.hint ? <Text style={s.partHint}>{p.hint}</Text> : null}
          </View>
        ))}
      </Glass>

      {r.hit && step?.kind === "emphasis" ? (
        <Glass style={{ gap: 6 }}>
          <Text style={s.label}>{r.hit.said ? (r.hit.hit ? "IT LANDED" : "IT BLENDED IN") : "DIDN'T HEAR IT"}</Text>
          <Text style={s.cue}>
            {r.hit.said
              ? [r.hit.louder && "louder", r.hit.longer && "longer", r.hit.higher && "higher"].filter(Boolean).join(", ") ||
                `“${step.target}” came out like every other word.`
              : `“${step.target}” wasn't in what I heard: “${r.heard}”`}
          </Text>
        </Glass>
      ) : null}

      <Text style={s.cue}>{coaching(live)}</Text>

      <View style={{ gap: SPACE.sm }}>
        <GlowButton label={final ? "See score" : "Next"} onPress={onNext} />
        <GlowButton label="Try that again" onPress={onRetry} tone="ghost" icon="replay" />
      </View>
    </Animated.View>
  );
}

function coaching(l: Liveliness): string {
  const weakest = [
    l.melody && { k: "melody", v: l.melody.score },
    l.punch && { k: "punch", v: l.punch.score },
    l.rhythm && { k: "rhythm", v: l.rhythm.score },
  ]
    .filter((x): x is { k: string; v: number } => Boolean(x))
    .sort((a, b) => a.v - b.v)[0];
  if (!weakest || weakest.v >= 70) return "That sounds like a person talking. Keep that voice.";
  switch (weakest.k) {
    case "melody":
      return "Your pitch stayed in one place. Let it rise on the interesting part and fall at the end of a thought.";
    case "punch":
      return "Everything came out at one volume. Hit the words that matter a little harder.";
    default:
      return "The pace was even, like a metronome. Slow down on what matters, rush the filler, pause after a point.";
  }
}

const s = StyleSheet.create({
  hero: { alignItems: "center", gap: 6, marginTop: SPACE.sm },
  title: { color: CHROME.chalk, fontSize: 32, fontFamily: TYPE.display, letterSpacing: -0.8, textAlign: "center" },
  tagline: { color: CHROME.dust, fontSize: 15, lineHeight: 22, fontFamily: TYPE.ui, textAlign: "center" },
  best: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.uiMedium, marginTop: 4 },
  mode: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  modeIcon: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modeTitle: { color: CHROME.chalk, fontSize: 17, fontFamily: TYPE.displaySoft },
  modeBlurb: { color: CHROME.dust, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui },
  fallback: { color: CHROME.dust, fontSize: 13, lineHeight: 19, fontFamily: TYPE.ui, textAlign: "center" },
  center: { alignItems: "center", paddingVertical: SPACE.sm },
  task: { gap: SPACE.sm },
  label: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  prompt: { color: CHROME.chalk, fontSize: 20, lineHeight: 28, fontFamily: TYPE.displaySoft },
  line: { color: CHROME.chalk, fontSize: 22, lineHeight: 31, fontFamily: TYPE.displaySoft },
  passage: { color: CHROME.chalk, fontSize: 18, lineHeight: 28, fontFamily: TYPE.displaySoft },
  cue: { color: CHROME.dust, fontSize: 14.5, lineHeight: 21, fontFamily: TYPE.ui },
  note: { color: AURORA.coral, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui, textAlign: "center" },
  timer: { color: CHROME.chalk, fontSize: 28, fontFamily: TYPE.monoMedium, textAlign: "center", ...TABULAR },
  timerDim: { color: CHROME.dust, fontSize: 16 },
  phase: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.displaySoft, textAlign: "center" },
  lineCard: { paddingVertical: 8 },
  verdict: { fontSize: 34, fontFamily: TYPE.display, letterSpacing: -0.8 },
  score: { color: CHROME.dust, fontSize: 18, fontFamily: TYPE.monoMedium, ...TABULAR },
  parts: { flexDirection: "row", justifyContent: "space-around" },
  part: { alignItems: "center", gap: 2, minWidth: 80 },
  partValue: { color: CHROME.chalk, fontSize: 24, fontFamily: TYPE.monoMedium, ...TABULAR },
  partLabel: { color: CHROME.dust, fontSize: 10.5, letterSpacing: 1.2, fontFamily: TYPE.uiBold },
  partHint: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono },
});
