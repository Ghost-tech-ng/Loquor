// The Arena.
//
// Primer, then talk, then the machine has its say. Three stages, no tabs, no
// back button during the take — the whole design intent is that once you start
// speaking there is nothing on screen to fiddle with.
//
// The primer is timed but the timer does not block. Pressure is the training
// stimulus; a locked button is just an obstacle.

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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

import { Body, Button, Display, Eyebrow, Hair, Masthead, Meta, Panel, Screen } from "../components/ui";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE, heat } from "../theme";
import { TOPICS_BY_ID } from "../content/topics";
import { computeMetrics } from "../lib/metrics";
import { transcribe } from "../lib/stt";
import { judge } from "../lib/judge";
import { getSession, saveSession } from "../lib/db";
import { getKey, loadSettings, resolve } from "../lib/settings";

const PRIMER_SECONDS = 60;
const SOFT_CEILING_S = 120;

type Stage = "primer" | "recording" | "working" | "error";

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

  const isRewrite = Boolean(params.rewriteOf);

  useEffect(() => {
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      granted.current = perm.granted;
      if (perm.granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      else {
        setError("Loquor needs the microphone. Enable it in iOS Settings → Loquor.");
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
        <Button label="BACK" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const start = async () => {
    if (!granted.current) return;
    setError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage("recording");
  };

  const stop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    const uri = recorder.uri;
    const seconds = (state.durationMillis ?? 0) / 1000;
    setStage("working");

    try {
      if (!uri) throw new Error("The recorder produced no file. Try once more.");
      if ((new File(uri).size ?? 0) === 0) throw new Error("The recording came back empty. Try once more.");

      const settings = await loadSettings();
      const { stt, judge: judgeProvider } = resolve(settings);

      setStep("Transcribing");
      const sttKey = (await getKey(stt)) ?? "";
      const t = await transcribe(uri, stt, sttKey);

      const metrics = computeMetrics(t.words, t.durationS ?? seconds);
      if (metrics.wordCount === 0) throw new Error("Nothing was picked up. Check the mic and try again.");

      setStep("Judging");
      const judgeKey = (await getKey(judgeProvider)) ?? "";
      const verdict = await judge(
        { topic: target ? `Re-say this well: ${target}` : topic.title, transcript: t.text, metrics },
        judgeProvider,
        judgeKey
      );

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

      router.replace({ pathname: "/scorecard", params: { id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        <Masthead right={isRewrite ? "REWRITE" : "ARENA"} />
        <View style={s.center}>
          <ActivityIndicator color={SEMANTIC.ember} />
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
        <Masthead right="ARENA" />
        <Eyebrow>THAT DIDN&rsquo;T WORK</Eyebrow>
        <Display>{error}</Display>
        <Button label="TRY AGAIN" onPress={() => { setStage("primer"); setError(null); }} />
        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead right={isRewrite ? "REWRITE" : "ARENA"} />
        <Display style={s.liveTopic} numberOfLines={3}>
          {target ?? topic.title}
        </Display>

        <View style={s.center}>
          <View style={s.apertureWrap}>
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
          <Eyebrow>{over ? "PAST NINETY — LAND IT" : "TAP TO FINISH"}</Eyebrow>
        </View>

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
  return (
    <Screen>
      <Masthead right={isRewrite ? "REWRITE" : "ARENA"} />

      <View style={s.headRow}>
        <Eyebrow>{isRewrite ? "SAY IT BETTER" : "PRIMER"}</Eyebrow>
        <Text style={[s.countdown, left <= 10 && { color: SEMANTIC.ember }]}>
          {left > 0 ? `${left}s` : "TIME"}
        </Text>
      </View>

      <Display>{topic.title}</Display>

      {target ? (
        <Panel>
          <Eyebrow>THE MODEL ANSWER</Eyebrow>
          <Body>{target}</Body>
          <Meta>Read it once, then close your eyes and say it in your own words.</Meta>
        </Panel>
      ) : (
        <>
          <View style={s.bullets}>
            {topic.primer.map((b, i) => (
              <View key={i} style={s.bullet}>
                <View style={s.bulletTick} />
                <Body style={s.bulletText}>{b}</Body>
              </View>
            ))}
          </View>

          <Hair />
          <Eyebrow>DEPLOY THESE</Eyebrow>
          <View style={s.terms}>
            {topic.loadedTerms.map((w) => (
              <Text key={w} style={s.term}>
                {w}
              </Text>
            ))}
          </View>
        </>
      )}

      <Hair />
      <Meta>
        Ninety seconds. Take a position in the first sentence, then defend it. You are not
        summarising the primer — you are using it.
      </Meta>

      <Button label="START" onPress={start} />
      <Button label="NOT NOW" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  countdown: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.uiMedium, ...TABULAR },

  bullets: { gap: SPACE.md, marginTop: SPACE.xs },
  bullet: { flexDirection: "row", gap: 12 },
  bulletTick: { width: 1, alignSelf: "stretch", backgroundColor: CHROME.carve },
  bulletText: { flex: 1 },

  terms: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  term: {
    color: CHROME.chalk,
    fontSize: 13,
    fontFamily: TYPE.displayItalic,
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  centerText: { textAlign: "center", maxWidth: 260, marginTop: SPACE.xs },

  liveTopic: { fontSize: 20, lineHeight: 26, color: CHROME.dust },
  apertureWrap: { alignItems: "center", justifyContent: "center", height: 240, width: 240 },
  bloom: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  aperture: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    alignItems: "center",
    justifyContent: "center",
  },
  stopCore: { width: 30, height: 30, borderRadius: 3, backgroundColor: SEMANTIC.flaw },
  clock: { color: CHROME.chalk, fontSize: 34, fontFamily: TYPE.display, ...TABULAR },

  termsLive: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", paddingBottom: SPACE.lg },
  termLive: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.displayItalic },
});
