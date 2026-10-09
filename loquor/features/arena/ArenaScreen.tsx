// The Arena.
//
// Primer, then talk, then the machine has its say. Three stages, no tabs, no
// back button during the take — the whole design intent is that once you start
// speaking there is nothing on screen to fiddle with.
//
// The primer is timed but the timer does not block. Pressure is the training
// stimulus; a locked button is just an obstacle.

import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { File } from "expo-file-system";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { Ignition } from "../../components/kit/Boot";
import { Panel } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { Masthead, Screen } from "../../components/kit/Screen";
import { Body, Display, Eyebrow, Hair, Meta } from "../../components/kit/Text";
import { Reveal } from "../../components/kit/motion";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE, heat } from "../../theme";
import { TOPICS_BY_ID } from "./topics";
import { ANSWER_SHAPE, EXPLAIN } from "./explain";
import { SCAFFOLD_NAMES, scaffoldLevel, takesToNext, type Scaffold } from "./scaffold";
import { computeMetrics } from "../../lib/metrics";
import { transcribe } from "../../lib/stt";
import { judge } from "./judge";
import { countSessions, getSession, recentSessions, saveSession } from "../../lib/db";
import { getKey, loadSettings, resolve, softFillers } from "../../lib/settings";
import { liveliness } from "../games/prosody";

const PRIMER_SECONDS = 90;
const SOFT_CEILING_S = 120;

type Stage = "primer" | "recording" | "working" | "error";

/** A failure message the user can act on, with the step it happened in. */
function explainFailure(step: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const where = step ? `While ${step.toLowerCase()}: ` : "";
  if (/network request failed|failed to fetch|network/i.test(raw)) {
    return `${where}couldn't reach the server. Check your internet connection and try again.`;
  }
  return `${where}${raw}`;
}

/**
 * A ring leaving the aperture once every two seconds, at roughly the cadence of
 * an unhurried breath. It is not driven by the mic — the bloom behind it already
 * is, and a second level-reactive element would just double the same signal.
 * This one is a metronome: something on screen that keeps time while you talk.
 */
function Halo() {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.halo,
        {
          opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.42, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.85] }) }],
        },
      ]}
    />
  );
}

export default function Arena() {
  const router = useRouter();
  const params = useLocalSearchParams<{ topicId?: string; rewriteOf?: string }>();
  const topic = TOPICS_BY_ID.get(params.topicId ?? "");

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [stage, setStage] = useState<Stage>("primer");
  const [left, setLeft] = useState(PRIMER_SECONDS);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const granted = useRef(false);
  const stopping = useRef(false);
  const [scaffold, setScaffold] = useState<Scaffold>(0);
  const [takes, setTakes] = useState(0);
  const [hint, setHint] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const levels = useRef<number[]>([]);

  const isRewrite = Boolean(params.rewriteOf);

  useEffect(() => {
    (async () => {
      try {
        const [n, rows] = await Promise.all([countSessions(), recentSessions(3)]);
        setTakes(n);
        setScaffold(scaffoldLevel(n, rows.map((r) => r.rubric_total)));
      } catch {
        // Without history the primer stays fully guided, which is the safe default.
      }
    })();
  }, []);

  const toggleTerm = (w: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });

  useEffect(() => {
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      granted.current = perm.granted;
      if (perm.granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      else {
        setError("PipeUp needs the microphone. Enable it in iOS Settings → Expo Go → Microphone.");
        setStage("error");
      }
    })();
  }, []);

  // A rewrite re-records one sentence, so the primer is that sentence and the
  // model answer the judge already gave for it.
  useEffect(() => {
    if (!params.rewriteOf) return;
    (async () => {
      const parent = await getSession(params.rewriteOf!);
      if (!parent?.judgement_json) return;
      const j = JSON.parse(parent.judgement_json) as { suggested_rewrite?: string };
      setTarget(j.suggested_rewrite ?? null);
    })();
  }, [params.rewriteOf]);

  // One reading per meter tick, for the punch half of liveliness.
  useEffect(() => {
    if (stage !== "recording") return;
    levels.current.push(typeof state.metering === "number" ? state.metering : -160);
  }, [stage, state.durationMillis, state.metering]);

  useEffect(() => {
    if (stage !== "primer" || left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, left]);

  if (!topic) {
    return (
      <Screen>
        <Masthead />
        <Display>That topic no longer exists.</Display>
        <GlowButton label="Back" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const start = async () => {
    if (!granted.current) return;
    setError(null);
    stopping.current = false;
    try {
      // Another screen may have left the session in playback-only mode.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      levels.current = [];
      recorder.record();
    } catch (err) {
      setError(explainFailure("Starting the mic", err));
      setStage("error");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage("recording");
  };

  const stop = async () => {
    // A second tap while the recorder is still stopping would run the whole
    // pipeline twice.
    if (stopping.current) return;
    stopping.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const seconds = (state.durationMillis ?? 0) / 1000;
    let current = "Saving the recording";
    setStep(current);
    setStage("working");

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("The recorder produced no file. Try once more.");
      if ((new File(uri).size ?? 0) === 0) throw new Error("The recording came back empty. Try once more.");

      const settings = await loadSettings();
      const { stt, judge: judgeProvider } = resolve(settings);

      current = "Transcribing";
      setStep(current);
      const sttKey = (await getKey(stt)) ?? "";
      const t = await transcribe(uri, stt, sttKey);

      const metrics = computeMetrics(t.words, t.durationS ?? seconds, softFillers(settings));
      if (metrics.wordCount === 0) throw new Error("Nothing was picked up. Check the mic and try again.");

      current = "Judging";
      setStep(current);
      const judgeKey = (await getKey(judgeProvider)) ?? "";
      const verdict = await judge(
        { topic: target ? `Re-say this well: ${target}` : topic.title, transcript: t.text, metrics },
        judgeProvider,
        judgeKey
      );

      current = "Saving the session";
      const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      await saveSession({
        id,
        topicId: topic.id,
        topicTitle: topic.title,
        transcript: t.text,
        provider: stt,
        metrics,
        judgement: verdict,
        isRewrite,
        parentId: params.rewriteOf ?? null,
      });

      // Audio is deleted the moment the transcript exists. Nothing keeps a
      // recording of the user's voice on disk (PRD §11).
      try {
        new File(uri).delete();
      } catch {
        /* a leftover temp file is not worth failing the session over */
      }

      // Not stored with the session: the reading is a coaching hint for this
      // take, and the sessions table has no column for it.
      const live = liveliness({ levelsDb: levels.current, words: t.words });
      router.replace({ pathname: "/scorecard", params: live ? { id, live: String(live.score) } : { id } });
    } catch (err) {
      setError(explainFailure(current, err));
      setStage("error");
    }
  };

  const level =
    typeof state.metering === "number" ? Math.max(0, Math.min(1, (state.metering + 60) / 60)) : 0;
  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);
  const over = seconds > SOFT_CEILING_S;

  if (stage === "working") {
    return (
      <Screen scroll={false}>
        <Masthead right={isRewrite ? "Rewrite" : "Arena"} />
        <View style={s.center}>
          <Ignition />
          <Eyebrow style={{ marginTop: SPACE.md }}>{step.toUpperCase()}</Eyebrow>
          <Meta style={s.centerText}>
            Delivery is counted here on the phone. Only the words go out.
          </Meta>
        </View>
      </Screen>
    );
  }

  if (stage === "error") {
    return (
      <Screen>
        <Masthead right="Arena" />
        <Eyebrow>That didn&rsquo;t work</Eyebrow>
        <Display>{error}</Display>
        <GlowButton label="Try again" onPress={() => { setStage("primer"); setError(null); }} />
        <GlowButton label="Back home" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead right={isRewrite ? "Rewrite" : "Arena"} />
        <Display style={s.liveTopic} numberOfLines={3}>
          {target ?? topic.title}
        </Display>

        <View style={s.center}>
          <View style={s.apertureWrap}>
            <Halo />
            <View
              style={[
                s.bloom,
                {
                  backgroundColor: heat(level),
                  opacity: 0.08 + level * 0.5,
                  transform: [{ scale: 0.8 + level * 1.1 }],
                },
              ]}
            />
            <Pressable onPress={stop} style={s.aperture} hitSlop={20}>
              <View style={s.stopCore} />
            </Pressable>
          </View>

          <Text style={[s.clock, over && { color: SEMANTIC.flaw }]}>
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </Text>
          <Eyebrow>{over ? "Past ninety — land it" : "Tap to finish"}</Eyebrow>
        </View>

        <Meta style={s.centerText}>Side → reason → example → land it</Meta>
        <View style={s.termsLive}>
          {topic.loadedTerms.map((w) => (
            <Text key={w} style={s.termLive}>
              {w}
            </Text>
          ))}
        </View>
      </Screen>
    );
  }

  // primer
  const plain = EXPLAIN[topic.id];
  const nextIn = takesToNext(takes, scaffold);

  const askPanel = plain ? (
    <Reveal index={2}>
      <Panel>
        <Eyebrow>In plain words</Eyebrow>
        <Body>{plain.ask}</Body>
      </Panel>
    </Reveal>
  ) : null;

  const sidesBlock = plain ? (
    <Reveal index={3} style={s.block}>
      <Eyebrow>Pick a side</Eyebrow>
      {plain.sides.map((side, i) => (
        <View key={i} style={s.side}>
          <Text style={s.sideMark}>{i === 0 ? "A" : "B"}</Text>
          <Body style={s.flex}>{side}</Body>
        </View>
      ))}
    </Reveal>
  ) : null;

  // The primer lands a point at a time. A wall of bullets appearing at once is
  // read as one block and retained as none of it.
  const primerBlock = (
    <>
      <Eyebrow>Worth knowing</Eyebrow>
      <View style={s.bullets}>
        {topic.primer.map((b, i) => (
          <Reveal key={i} index={i + 4}>
            <View style={s.bullet}>
              <View style={s.bulletTick} />
              <Body style={s.flex}>{b}</Body>
            </View>
          </Reveal>
        ))}
      </View>
    </>
  );

  return (
    <Screen>
      <Masthead right={isRewrite ? "Rewrite" : "Arena"} />

      <View style={s.headRow}>
        <Eyebrow>{isRewrite ? "Say it better" : "Primer"}</Eyebrow>
        <Text style={[s.countdown, left <= 10 && { color: SEMANTIC.ember }]}>
          {left > 0 ? `${left}s` : "Time"}
        </Text>
      </View>

      <Reveal index={0}>
        <Display>{topic.title}</Display>
      </Reveal>

      {target ? (
        <Panel>
          <Eyebrow>The model answer</Eyebrow>
          <Body>{target}</Body>
          <Meta>Read it once, then close your eyes and say it in your own words.</Meta>
        </Panel>
      ) : (
        <>
          <Reveal index={1}>
            <Meta style={s.levelLine}>
              {SCAFFOLD_NAMES[scaffold]}
              {nextIn !== null ? ` · ${nextIn} ${nextIn === 1 ? "take" : "takes"} to ${SCAFFOLD_NAMES[scaffold + 1]}` : " · no training wheels"}
            </Meta>
          </Reveal>

          {/* Guided starts with the plain version; from Bridged on, the topic's own
              wording leads and the plain version has to be asked for. Reading the
              richer register first is the point — the plain one is a fallback. */}
          {scaffold === 0 ? (
            <>
              {askPanel}
              {sidesBlock}
              <Hair />
              {primerBlock}
            </>
          ) : (
            <>
              {primerBlock}
              {scaffold === 1 && sidesBlock}
              {plain && (
                <Pressable onPress={() => setHint((h) => !h)} hitSlop={8}>
                  <Text style={s.hintToggle}>
                    {hint ? "Hide it" : scaffold === 1 ? "Say it simpler" : "Need a hint?"}
                  </Text>
                </Pressable>
              )}
              {hint && askPanel}
              {hint && scaffold >= 2 && sidesBlock}
            </>
          )}

          <Hair />
          <Eyebrow>Words to use</Eyebrow>
          {scaffold === 2 && !hint && <Meta>Tap a word if you&rsquo;re not sure what it means.</Meta>}
          <Reveal index={topic.primer.length + 4} style={scaffold >= 2 ? s.termWrap : s.block}>
            {topic.loadedTerms.map((w) => {
              const meaning = plain?.terms[w];
              const show = Boolean(meaning) && (scaffold <= 1 || hint || (scaffold === 2 && opened.has(w)));
              const chip = <Text style={[s.term, scaffold === 2 && opened.has(w) && s.termOpen]}>{w}</Text>;
              return (
                <View key={w} style={show && scaffold >= 2 ? s.termFull : s.termRow}>
                  {scaffold === 2 ? (
                    <Pressable onPress={() => toggleTerm(w)} hitSlop={4}>
                      {chip}
                    </Pressable>
                  ) : (
                    chip
                  )}
                  {show ? <Meta style={s.flex}>{meaning}</Meta> : null}
                </View>
              );
            })}
          </Reveal>

          <Hair />
          <Eyebrow>How to answer</Eyebrow>
          <Reveal index={topic.primer.length + 5} style={s.block}>
            {scaffold <= 1 ? (
              ANSWER_SHAPE.map((line, i) => (
                <View key={i} style={s.side}>
                  <Text style={s.stepNum}>{i + 1}</Text>
                  <Body style={s.flex}>{line}</Body>
                </View>
              ))
            ) : (
              <Body>Position, reason, evidence, concession, close.</Body>
            )}
          </Reveal>
        </>
      )}

      <Hair />
      <Meta>
        About ninety seconds. Use the facts above as ammunition — don&rsquo;t read them back.
      </Meta>

      <GlowButton label="Start" onPress={start} />
      <GlowButton label="Not now" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  countdown: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.monoMedium, ...TABULAR },

  flex: { flex: 1 },
  block: { gap: SPACE.sm },
  bullets: { gap: SPACE.md, marginTop: SPACE.xs },
  bullet: { flexDirection: "row", gap: 12 },
  bulletTick: { width: 1, alignSelf: "stretch", backgroundColor: CHROME.carve },

  side: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sideMark: {
    color: SEMANTIC.ember,
    fontFamily: TYPE.monoMedium,
    fontSize: 13,
    width: 22,
    height: 22,
    lineHeight: 22,
    textAlign: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    marginTop: 1,
  },
  stepNum: { color: SEMANTIC.xp, fontFamily: TYPE.monoMedium, fontSize: 13, width: 22, textAlign: "center", marginTop: 2 },

  termRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  termWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  termFull: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%" },
  termOpen: { borderColor: SEMANTIC.ember },
  levelLine: { color: SEMANTIC.xp, fontFamily: TYPE.monoMedium, letterSpacing: 1 },
  hintToggle: { color: SEMANTIC.ember, fontFamily: TYPE.monoMedium, fontSize: 12, letterSpacing: 1 },
  term: {
    color: CHROME.chalk,
    fontSize: 13,
    fontFamily: TYPE.displayItalic,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  centerText: { textAlign: "center", maxWidth: 260, marginTop: SPACE.xs },

  liveTopic: { fontSize: 20, lineHeight: 26, color: CHROME.dust },
  apertureWrap: { alignItems: "center", justifyContent: "center", height: 240, width: 240 },
  bloom: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  halo: {
    position: "absolute",
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
  },
  aperture: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    alignItems: "center",
    justifyContent: "center",
  },
  stopCore: { width: 30, height: 30, borderRadius: 10, backgroundColor: SEMANTIC.flaw },
  clock: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.monoMedium, letterSpacing: -1, ...TABULAR },

  termsLive: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", paddingBottom: SPACE.lg },
  termLive: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.displayItalic },
});
