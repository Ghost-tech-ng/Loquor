// The Lexicon.
//
// Words you can define are not words you can use. So every word here carries two
// separate memories — recognition and production — scheduled independently by
// FSRS, and the second one can only be moved by saying the word out loud in a
// sentence you invented, judged on sense, collocation and register.
//
// The queue is short on purpose. Four new words a day and whatever is genuinely
// due, then it ends and tells you so. A vocabulary app that always has more work
// is a vocabulary app you stop opening.

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { File } from "expo-file-system";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { Body, Button, Display, Eyebrow, Hair, Masthead, Meta, Panel, Reveal, Screen } from "../components/ui";
import { Ignition } from "../components/boot";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE, heat } from "../theme";
import type { Gloss } from "../content/glossary";
import { describeInterval, type Grade } from "../lib/fsrs";
import {
  buildQueue,
  confirmRealUse,
  grade,
  gradeProduction,
  wordOfTheDay,
  type QueueItem,
} from "../lib/lexiconStore";
import { GATE_LABELS, judgeUse, type WordVerdict } from "../lib/lexiconJudge";
import { transcribe } from "../lib/stt";
import { getKey, loadSettings, resolve } from "../lib/settings";

type Stage =
  | "loading"
  | "queue"       // the card face — meaning hidden on recognition, prompt on production
  | "revealed"    // recognition only: meaning shown, waiting for a self-grade
  | "speaking"    // production only: recording
  | "working"
  | "verdict"
  | "done"
  | "error";

export default function Lexicon() {
  const router = useRouter();

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [stage, setStage] = useState<Stage>("loading");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [at, setAt] = useState(0);
  const [wotd, setWotd] = useState<Gloss | null>(null);
  const [verdict, setVerdict] = useState<WordVerdict | null>(null);
  const [nextIn, setNextIn] = useState<string | null>(null);
  const [useNote, setUseNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const granted = useRef(false);

  const load = useCallback(async () => {
    const [q, w] = await Promise.all([buildQueue(), wordOfTheDay()]);
    setQueue(q);
    setWotd(w);
    setAt(0);
    setStage(q.length > 0 ? "queue" : "done");
  }, []);

  useEffect(() => {
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      granted.current = perm.granted;
      if (perm.granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await load();
    })();
  }, [load]);

  const item = queue[at];

  const advance = () => {
    setVerdict(null);
    setNextIn(null);
    if (at + 1 >= queue.length) setStage("done");
    else {
      setAt(at + 1);
      setStage("queue");
    }
  };

  // ── recognition: self-graded ───────────────────────────────────────────────
  // Self-grading is honest here and nowhere else in the app. Recognition is a
  // question only you can answer — either the meaning was there when the word
  // appeared or it was not, and no model can observe that. Production is never
  // self-graded, which is the whole reason the tracks are separate.
  const gradeRecall = async (g: Grade) => {
    if (!item) return;
    Haptics.selectionAsync();
    const card = await grade(item.gloss.word, "recognition", g);
    setNextIn(describeInterval(Math.max(0, card.dueAt - Date.now())));
    setTimeout(advance, 450);
  };

  const startSpeaking = async () => {
    if (!granted.current) {
      setError("Loquor needs the microphone. Enable it in iOS Settings → Loquor.");
      setStage("error");
      return;
    }
    setError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage("speaking");
  };

  const stopSpeaking = async () => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    const uri = recorder.uri;
    setStage("working");

    try {
      if (!uri) throw new Error("The recorder produced no file. Try once more.");
      if ((new File(uri).size ?? 0) === 0) throw new Error("The recording came back empty. Try once more.");

      const settings = await loadSettings();
      const { stt, judge } = resolve(settings);
      const [sttKey, judgeKey] = await Promise.all([getKey(stt), getKey(judge)]);

      // No prompt override. Unlike the Reading, we must not tell the transcriber
      // which word to expect — half of what is being tested is whether the word
      // actually left your mouth.
      const t = await transcribe(uri, stt, sttKey ?? "");
      if (t.text.trim().length === 0) throw new Error("Nothing was picked up. Check the mic and try again.");

      const v = await judgeUse({ gloss: item.gloss, transcript: t.text }, judge, judgeKey ?? "");
      const card = await gradeProduction(item.gloss.word, v.gates);

      try {
        new File(uri).delete();
      } catch {
        /* a leftover temp file is not worth failing the drill over */
      }

      setVerdict(v);
      setNextIn(describeInterval(Math.max(0, card.dueAt - Date.now())));
      setStage("verdict");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  // ── loading / working ──────────────────────────────────────────────────────
  if (stage === "loading" || stage === "working") {
    return (
      <Screen scroll={false}>
        <Masthead right="LEXICON" />
        <View style={s.center}>
          <Ignition />
          <Eyebrow style={{ marginTop: SPACE.md }}>
            {stage === "loading" ? "BUILDING THE QUEUE" : "LISTENING BACK"}
          </Eyebrow>
          {stage === "working" ? (
            <Meta style={s.centerText}>
              Checking the sense, the words either side of it, and whether it belongs in the room.
            </Meta>
          ) : null}
        </View>
      </Screen>
    );
  }

  if (stage === "error") {
    return (
      <Screen>
        <Masthead right="LEXICON" />
        <Eyebrow>THAT DIDN&rsquo;T WORK</Eyebrow>
        <Display>{error}</Display>
        <Button label="TRY AGAIN" onPress={() => { setError(null); setStage("queue"); }} />
        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  // ── speaking ───────────────────────────────────────────────────────────────
  if (stage === "speaking" && item) {
    const level =
      typeof state.metering === "number" ? Math.max(0, Math.min(1, (state.metering + 60) / 60)) : 0;
    const seconds = Math.floor((state.durationMillis ?? 0) / 1000);

    return (
      <Screen scroll={false}>
        <Masthead right="SPEAKING" />
        <View style={s.center}>
          <Text style={s.bigWord}>{item.gloss.word}</Text>
          <Meta style={s.centerText}>One sentence. About your own work, not about the word.</Meta>
        </View>

        <View style={s.readFoot}>
          <Text style={s.clockSmall}>
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </Text>
          <Pressable onPress={stopSpeaking} style={s.stopBar} hitSlop={16}>
            <View
              style={[s.stopBloom, { backgroundColor: heat(level), opacity: 0.08 + level * 0.45 }]}
            />
            <Text style={s.stopLabel}>THAT&rsquo;S THE SENTENCE</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── verdict ────────────────────────────────────────────────────────────────
  if (stage === "verdict" && verdict && item) {
    return (
      <Screen>
        <Masthead right="LEXICON" />

        <Eyebrow>{verdict.unlocked ? "UNLOCKED" : "NOT YET"}</Eyebrow>
        <Display>{item.gloss.word}</Display>

        <Panel>
          <Text style={s.fieldLabel}>WHAT YOU SAID</Text>
          <Body style={s.quote}>&ldquo;{verdict.heard}&rdquo;</Body>
        </Panel>

        {/* The gates check in one at a time, in the order they are judged. */}
        <View style={s.gates}>
          {GATE_LABELS.map((g, i) => {
            const pass = verdict.gates[g.key];
            return (
              <Reveal key={g.key} index={i}>
                <View style={[s.gate, pass ? s.gatePass : s.gateFail]}>
                  <Text style={[s.gateMark, pass ? s.gateMarkPass : s.gateMarkFail]}>
                    {pass ? "✓" : "✕"}
                  </Text>
                  <Text style={s.gateLabel}>{g.label.toUpperCase()}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Body>{verdict.verdict}</Body>

        <Hair />
        <Eyebrow>SAID THE WAY IT LANDS</Eyebrow>
        <Body style={s.model}>{verdict.model_sentence}</Body>

        {nextIn ? <Meta>Back in {nextIn}.</Meta> : null}

        <Button label="SAY IT AGAIN" tone="ghost" onPress={startSpeaking} />
        <Button label={at + 1 >= queue.length ? "FINISH" : "NEXT WORD"} onPress={advance} />
      </Screen>
    );
  }

  // ── done ───────────────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <Screen>
        <Masthead right="LEXICON" />
        <Eyebrow>QUEUE CLEAR</Eyebrow>
        <Display>
          {queue.length === 0
            ? "Nothing is due. That is the system working, not a gap in it."
            : `${queue.length} done. Nothing else is due today.`}
        </Display>

        {wotd ? (
          <>
            <Hair />
            <Eyebrow>CARRY THIS ONE OUT WITH YOU</Eyebrow>
            <Display>{wotd.word}</Display>
            <Meta>{wotd.say}</Meta>
            <Body>{wotd.meaning}</Body>
            <Text style={s.fieldLabel}>USE IT WHEN</Text>
            <Meta>{wotd.slot}</Meta>

            <Hair />
            <Eyebrow>DID YOU ACTUALLY SAY IT TO SOMEONE?</Eyebrow>
            <Meta>
              One line on where and to whom. This is the only evidence the app collects from
              outside itself, and it counts for more than any drill — so it has to be true.
            </Meta>
            <TextInput
              value={useNote}
              onChangeText={(t) => { setUseNote(t); setNoteSaved(false); }}
              placeholder="e.g. standup — called the retry logic brittle"
              placeholderTextColor={CHROME.dustDim}
              style={s.input}
              multiline
            />
            <Button
              label={noteSaved ? "LOGGED" : "I USED IT"}
              tone={noteSaved ? "quiet" : "primary"}
              disabled={useNote.trim().length === 0 || noteSaved}
              onPress={async () => {
                await confirmRealUse(wotd.word, useNote.trim());
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setNoteSaved(true);
              }}
            />
          </>
        ) : null}

        <Hair />
        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <Masthead right="LEXICON" />
        <Display>Nothing is due.</Display>
        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  // ── the card ───────────────────────────────────────────────────────────────
  const g = item.gloss;
  const production = item.track === "production";
  const revealed = stage === "revealed";

  return (
    <Screen>
      <Masthead right={`${at + 1} OF ${queue.length}`} />

      <Eyebrow>
        {production ? "PRODUCTION — SAY IT" : item.fresh ? "NEW WORD" : "RECOGNITION"}
      </Eyebrow>
      <Display>{g.word}</Display>
      <Text style={s.say}>{g.say}</Text>

      {production ? (
        <>
          <Meta>
            You have read this one enough times. Now use it: one sentence, out loud, about
            something you are actually working on. Do not define it and do not explain it.
          </Meta>
          <Hair />
          <Text style={s.fieldLabel}>IT SHOULD LAND LIKE</Text>
          <Text style={s.colloc}>{g.collocations.join("  ·  ")}</Text>
          <Button label="SAY A SENTENCE" onPress={startSpeaking} />
          <Button label="NOT THIS ONE" tone="quiet" onPress={advance} />
        </>
      ) : item.fresh || revealed ? (
        <>
          <Body>{g.meaning}</Body>

          <Text style={s.fieldLabel}>SEEN AS</Text>
          <Text style={s.colloc}>{g.collocations.join("  ·  ")}</Text>

          <Text style={s.fieldLabel}>USE IT WHEN</Text>
          <Meta>{g.slot}</Meta>

          <Text style={s.fieldLabel}>NOT THAT</Text>
          <Meta style={{ color: CHROME.dust }}>{g.antiPattern}</Meta>

          <Hair />
          {nextIn ? <Meta>Back in {nextIn}.</Meta> : null}
          {item.fresh ? (
            <Button label="GOT IT — NEXT" onPress={() => gradeRecall(3)} />
          ) : (
            <View style={s.grades}>
              {([
                { g: 1 as Grade, label: "GONE" },
                { g: 2 as Grade, label: "HARD" },
                { g: 3 as Grade, label: "GOOD" },
                { g: 4 as Grade, label: "EASY" },
              ]).map((b) => (
                <Pressable key={b.g} onPress={() => gradeRecall(b.g)} style={s.gradeBtn}>
                  <Text style={s.gradeLabel}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <Meta>
            Before you tap: say the meaning to yourself, then a sentence you would actually use it
            in. Recalling it is the rep. Reading it is not.
          </Meta>
          <Button label="SHOW THE ENTRY" onPress={() => setStage("revealed")} />
          <Button label="BACK TO TODAY" tone="quiet" onPress={() => router.replace("/")} />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  centerText: { textAlign: "center", maxWidth: 300, marginTop: SPACE.xs },

  bigWord: { color: CHROME.chalk, fontSize: 38, fontFamily: TYPE.display, textAlign: "center" },
  say: { color: SEMANTIC.ember, fontSize: 12, fontFamily: TYPE.ui, letterSpacing: 0.6 },

  fieldLabel: {
    color: CHROME.dustDim,
    fontSize: 9,
    letterSpacing: 2.2,
    fontFamily: TYPE.uiMedium,
    marginTop: 2,
  },
  colloc: { color: "#C3D0D2", fontSize: 13, lineHeight: 20, fontFamily: TYPE.displayItalic },
  quote: { fontFamily: TYPE.displayItalic },
  model: { fontSize: 17, lineHeight: 27, fontFamily: TYPE.displayItalic },

  grades: { flexDirection: "row", gap: 8 },
  gradeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: CHROME.carve,
    backgroundColor: CHROME.strata,
  },
  gradeLabel: { color: CHROME.chalk, fontSize: 11, letterSpacing: 1.4, fontFamily: TYPE.uiSemi },

  gates: { flexDirection: "row", gap: 8 },
  gate: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    borderWidth: 1,
    backgroundColor: CHROME.strata,
  },
  gatePass: { borderColor: SEMANTIC.ember },
  gateFail: { borderColor: CHROME.carve },
  gateMark: { fontSize: 16, fontFamily: TYPE.uiSemi },
  gateMarkPass: { color: SEMANTIC.ember },
  gateMarkFail: { color: SEMANTIC.flaw },
  gateLabel: { color: CHROME.dustDim, fontSize: 9, letterSpacing: 1.6, fontFamily: TYPE.uiMedium },

  input: {
    color: CHROME.chalk,
    fontSize: 15,
    fontFamily: TYPE.ui,
    minHeight: 64,
    padding: 12,
    borderWidth: 1,
    borderColor: CHROME.carve,
    backgroundColor: CHROME.strata,
    textAlignVertical: "top",
  },

  readFoot: { gap: SPACE.sm, paddingBottom: SPACE.md, alignItems: "center" },
  clockSmall: { color: CHROME.dustDim, fontSize: 14, fontFamily: TYPE.monoMedium, ...TABULAR },
  stopBar: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    overflow: "hidden",
  },
  stopBloom: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  stopLabel: { color: CHROME.chalk, fontSize: 13, letterSpacing: 1.6, fontFamily: TYPE.uiSemi },
});
