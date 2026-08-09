// The Reading.
//
// The one drill where the words are supplied. A reading is ~1,400 words of real
// prose — a history, an argument, an explanation — split into six sections of
// about 220. You study four words, read one section aloud, and get back a
// marked-up copy of what you actually said. Then the next section.
//
// Sections rather than one ten-minute take, for reasons that are in
// lib/reading.ts next to the alignment code: a bad take is cheap to redo, the
// upload is small, the DP table stays trivial, and the feedback arrives while
// you still remember saying the words.
//
// Note what is missing: there is no LLM anywhere in this screen. Transcription
// happens, and then everything after it is arithmetic against a text we already
// have. That makes this the cheapest drill in the app and the only one whose
// result would be byte-identical if you ran it again in two years.

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

import { Body, Button, Display, Eyebrow, Hair, Masthead, Meta, Panel, Reveal, Screen } from "../components/ui";
import { Ignition } from "../components/boot";
import { Rail, strain } from "../components/viz";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE, heat } from "../theme";
import {
  READINGS_BY_ID,
  READ_WPM,
  sectionGlosses,
  targetIndices,
  wordCount,
  type Section,
} from "../content/readings";
import type { Gloss } from "../content/glossary";
import {
  READ_BAND_WPM,
  scoreReading,
  targetVerdicts,
  type ReadingScore,
} from "../lib/reading";
import { bandPosition } from "../lib/metrics";
import { transcribe } from "../lib/stt";
import { saveTake, sectionBests } from "../lib/db";
import { gradeRecognition } from "../lib/lexiconStore";
import { getKey, loadSettings, resolve } from "../lib/settings";

type Stage = "contents" | "study" | "reading" | "working" | "result" | "error";

export default function Read() {
  const router = useRouter();
  const params = useLocalSearchParams<{ readingId?: string; section?: string }>();
  const reading = READINGS_BY_ID.get(params.readingId ?? "");

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [stage, setStage] = useState<Stage>("contents");
  const [sectionN, setSectionN] = useState(Number(params.section ?? 1) || 1);
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [score, setScore] = useState<ReadingScore | null>(null);
  const [bests, setBests] = useState<Map<number, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const granted = useRef(false);

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

  const refreshBests = useCallback(() => {
    if (reading) sectionBests(reading.id).then(setBests);
  }, [reading?.id]);

  useEffect(refreshBests, [refreshBests]);

  if (!reading) {
    return (
      <Screen>
        <Masthead />
        <Display>That reading no longer exists.</Display>
        <Button label="BACK" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const section: Section = reading.sections[sectionN - 1] ?? reading.sections[0]!;
  const glosses = sectionGlosses(section);
  const isLast = sectionN >= reading.sections.length;

  const start = async () => {
    if (!granted.current) return;
    setError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage("reading");
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
      const { stt } = resolve(settings);
      const key = (await getKey(stt)) ?? "";

      // The section text is sent as the transcription prompt. Whisper conditions
      // on it, which biases decoding toward the words we expect — the opposite of
      // what we want for the Arena, and exactly right here: we are asking whether
      // the audio supports these words, not what the audio might be.
      const t = await transcribe(uri, stt, key, { prompt: section.text });

      const result = scoreReading(section.text, t.words, {
        targets: targetIndices(section),
        fallbackDurationS: t.durationS ?? seconds,
      });
      if (result.tokens.every((x) => x.status === "missed")) {
        throw new Error("Nothing was picked up. Check the mic and try again.");
      }

      await saveTake({
        id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        readingId: reading.id,
        sectionN: section.n,
        provider: stt,
        score: result,
      });

      // Reading a target word aloud cleanly is evidence on the recognition track
      // and nothing else. It says you can decode the word on sight and get your
      // mouth around it; it says nothing about whether it would arrive unprompted
      // in a meeting. Only the Arena judge can move the production track.
      await gradeRecognition(targetVerdicts(result));

      try {
        new File(uri).delete();
      } catch {
        /* a leftover temp file is not worth failing the drill over */
      }

      setScore(result);
      setBests((m) => {
        const next = new Map(m);
        const prev = next.get(section.n);
        next.set(section.n, prev === undefined ? result.accuracy : Math.max(prev, result.accuracy));
        return next;
      });
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  // ── working ────────────────────────────────────────────────────────────────
  if (stage === "working") {
    return (
      <Screen scroll={false}>
        <Masthead right="READING" />
        <View style={s.center}>
          <Ignition />
          <Eyebrow style={{ marginTop: SPACE.md }}>ALIGNING</Eyebrow>
          <Meta style={s.centerText}>
            Comparing what you said against what was on the page. No model is grading this.
          </Meta>
        </View>
      </Screen>
    );
  }

  if (stage === "error") {
    return (
      <Screen>
        <Masthead right="READING" />
        <Eyebrow>THAT DIDN&rsquo;T WORK</Eyebrow>
        <Display>{error}</Display>
        <Button label="TRY AGAIN" onPress={() => { setStage("study"); setError(null); }} />
        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  // ── reading ────────────────────────────────────────────────────────────────
  if (stage === "reading") {
    const level =
      typeof state.metering === "number" ? Math.max(0, Math.min(1, (state.metering + 60) / 60)) : 0;
    const seconds = Math.floor((state.durationMillis ?? 0) / 1000);

    return (
      <Screen scroll={false}>
        <Masthead right={`${section.n} OF ${reading.sections.length}`} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.readPad}>
          <Text style={s.readHeading}>{section.heading}</Text>
          <Text style={s.readText}>{section.text}</Text>
        </ScrollView>

        <View style={s.readFoot}>
          <Text style={s.clockSmall}>
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </Text>
          <Pressable onPress={stop} style={s.stopBar} hitSlop={16}>
            <View
              style={[
                s.stopBloom,
                { backgroundColor: heat(level), opacity: 0.08 + level * 0.45 },
              ]}
            />
            <Text style={s.stopLabel}>END OF SECTION</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── result ─────────────────────────────────────────────────────────────────
  if (stage === "result" && score) {
    const verdicts = targetVerdicts(score);
    const cleanTargets = verdicts.filter((v) => v.clean).length;
    const best = bests.get(section.n);

    return (
      <Screen>
        <Masthead right={`${section.n} OF ${reading.sections.length}`} />

        <Eyebrow>WHAT CAME BACK</Eyebrow>
        <Marked score={score} />

        <Meta>
          Pale is intact. Red is what the transcript heard instead of the word on the page. Faded
          is a word that never arrived.
        </Meta>

        <Hair />

        <Rail
          label="TARGET WORDS"
          value={`${cleanTargets}/${verdicts.length}`}
          position={verdicts.length === 0 ? 0.5 : cleanTargets / verdicts.length}
          bandLabel={
            cleanTargets === verdicts.length
              ? "All four survived the journey to your mouth."
              : "The ones below are the ones to say again."
          }
          tint={strain(1 - (verdicts.length === 0 ? 1 : cleanTargets / verdicts.length))}
        />

        <Rail
          label="ACCURACY"
          value={score.accuracy.toFixed(1)}
          unit="%"
          position={score.accuracy / 100}
          bandLabel={
            best !== undefined && best > score.accuracy
              ? `Your best on this section: ${best.toFixed(1)}%`
              : "Your best on this section."
          }
        />

        <Rail
          label="PACE"
          value={String(score.wpm)}
          unit="wpm"
          position={bandPosition(score.wpm, READ_BAND_WPM.low, READ_BAND_WPM.high)}
          bandLabel={`Reading aloud sits well at ${READ_BAND_WPM.low}–${READ_BAND_WPM.high}. Speaking is faster.`}
        />

        <Rail
          label="PHRASING"
          value={`${score.phrasing.honoured}/${score.phrasing.available}`}
          position={
            score.phrasing.available === 0 ? 0.5 : score.phrasing.honoured / score.phrasing.available
          }
          bandLabel="Commas and full stops you actually breathed at. Most people read straight through them."
        />

        <Rail
          label="HESITATION"
          value={String(score.hesitations)}
          position={Math.min(1, score.hesitations / 8)}
          bandLabel="Long stops in the middle of a clause — searching, not phrasing."
          tint={strain(Math.min(1, score.hesitations / 8))}
        />

        {score.stumbles.length > 0 ? (
          <>
            <Hair />
            <Eyebrow>SAY THESE AGAIN</Eyebrow>
            {score.stumbles.slice(0, 8).map((t) => {
              const g = glosses.find((x) => x.word === t.target);
              return (
                <View key={t.index} style={s.stumble}>
                  <Text style={s.stumbleRef}>{t.ref}</Text>
                  <Text style={s.stumbleArrow}>{t.status === "missed" ? "not said" : `heard "${t.heard}"`}</Text>
                  {g ? <Text style={s.stumbleSay}>{g.say}</Text> : null}
                </View>
              );
            })}
          </>
        ) : null}

        <Hair />
        <Meta>
          A word that comes back correct is not proof you said it well — Whisper is built to
          forgive accents and will often repair a word from context. A word that comes back
          <Text style={{ fontFamily: TYPE.uiSemi }}> wrong</Text>, though, is real. Treat this as a
          stumble detector, not a pronunciation grade.
        </Meta>

        {!isLast ? (
          <Button
            label={`NEXT — ${reading.sections[sectionN]!.heading.toUpperCase()}`}
            onPress={() => {
              setScore(null);
              setOpenWord(null);
              setSectionN(sectionN + 1);
              setStage("study");
            }}
          />
        ) : null}
        <Button
          label="READ THIS SECTION AGAIN"
          tone={isLast ? "primary" : "ghost"}
          onPress={() => { setScore(null); setStage("study"); }}
        />
        <Button label="ALL SECTIONS" tone="quiet" onPress={() => { setScore(null); setStage("contents"); }} />
      </Screen>
    );
  }

  // ── contents ───────────────────────────────────────────────────────────────
  if (stage === "contents") {
    const done = [...bests.keys()].length;
    return (
      <Screen>
        <Masthead right="READING" />

        <Eyebrow>{reading.domain === "field" ? "YOUR FIELD" : "OFF-PISTE"}</Eyebrow>
        <Display>{reading.title}</Display>
        <Meta>{reading.standfirst}</Meta>

        <Hair />
        <Eyebrow>
          {`${reading.sections.length} SECTIONS · ${done} RECORDED`}
        </Eyebrow>

        {reading.sections.map((sec, i) => {
          const b = bests.get(sec.n);
          const mins = wordCount(sec) / READ_WPM;
          return (
            <Reveal key={sec.n} index={i}>
              <Pressable
                onPress={() => { setSectionN(sec.n); setOpenWord(null); setStage("study"); }}
                style={[s.tocRow, sectionN === sec.n && s.tocRowHere]}
              >
                <Text style={s.tocN}>{String(sec.n).padStart(2, "0")}</Text>
                <View style={s.tocBody}>
                  <Text style={s.tocHeading}>{sec.heading}</Text>
                  <Text style={s.tocMeta}>
                    {`${Math.round(mins * 60)}s · ${sec.targets.join(", ")}`}
                  </Text>
                </View>
                <Text style={[s.tocBest, b === undefined && s.tocBestNone]}>
                  {b === undefined ? "—" : `${b.toFixed(0)}%`}
                </Text>
              </Pressable>
            </Reveal>
          );
        })}

        <Hair />
        <Meta>
          The whole piece runs about ten minutes aloud. You are not meant to do it in one sitting
          and you are not meant to do it once — a section you have read three times is worth more
          than three sections read once.
        </Meta>

        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  // ── study ──────────────────────────────────────────────────────────────────
  const best = bests.get(section.n);
  return (
    <Screen>
      <Masthead right={`${section.n} OF ${reading.sections.length}`} />

      <Eyebrow>{reading.title.toUpperCase()}</Eyebrow>
      <Display>{section.heading}</Display>

      <Hair />
      <Eyebrow>FOUR WORDS — TAP FOR THE FULL ENTRY</Eyebrow>
      <View style={s.chips}>
        {glosses.map((g) => (
          <Pressable
            key={g.word}
            onPress={() => setOpenWord((w) => (w === g.word ? null : g.word))}
            style={[s.chip, openWord === g.word && s.chipOpen]}
          >
            <Text style={s.chipWord}>{g.word}</Text>
            <Text style={s.chipSay}>{g.say}</Text>
          </Pressable>
        ))}
      </View>

      {openWord ? <Entry gloss={glosses.find((g) => g.word === openWord)!} /> : null}

      <Hair />
      <Eyebrow>THE TEXT</Eyebrow>
      <Body style={s.studyText}>{section.text}</Body>

      <Hair />
      <Meta>
        Read it once silently, then aloud at the pace you would use in a room — not a performance,
        not a mumble. Slow down at the commas. That is half the drill.
        {best !== undefined ? ` Your best on this section so far: ${best.toFixed(1)}%.` : ""}
      </Meta>

      <Button label="READ IT ALOUD" onPress={start} />
      <Button label="ALL SECTIONS" tone="quiet" onPress={() => setStage("contents")} />
    </Screen>
  );
}

/** The four fields from PRD §5.1, plus the respelling this drill adds. */
function Entry({ gloss }: { gloss: Gloss }) {
  return (
    <Panel>
      <View style={s.entryHead}>
        <Text style={s.entryWord}>{gloss.word}</Text>
        <Text style={s.entrySay}>{gloss.say}</Text>
      </View>
      <Body>{gloss.meaning}</Body>

      <Text style={s.fieldLabel}>SEEN AS</Text>
      <Text style={s.colloc}>{gloss.collocations.join("  ·  ")}</Text>

      <Text style={s.fieldLabel}>USE IT WHEN</Text>
      <Meta>{gloss.slot}</Meta>

      <Text style={s.fieldLabel}>NOT THAT</Text>
      <Meta style={{ color: CHROME.dust }}>{gloss.antiPattern}</Meta>
    </Panel>
  );
}

/**
 * The section as spoken, word by word. This is the whole payoff of the drill —
 * seeing exactly where the text and your mouth diverged, on the page you just
 * read, rather than a percentage.
 */
function Marked({ score }: { score: ReadingScore }) {
  return (
    <View style={s.marked}>
      {score.tokens.map((t) => (
        <Text
          key={t.index}
          style={[
            s.markedWord,
            t.target !== undefined && s.markedTarget,
            t.status === "altered" && s.markedAltered,
            t.status === "missed" && s.markedMissed,
          ]}
        >
          {t.ref}
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  centerText: { textAlign: "center", maxWidth: 280, marginTop: SPACE.xs },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
    borderRadius: RADIUS.soft,
    paddingHorizontal: 13,
    paddingVertical: 7,
    gap: 1,
  },
  chipOpen: { borderColor: SEMANTIC.ember, backgroundColor: "rgba(224, 85, 63, 0.1)" },
  chipWord: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.displayItalic },
  chipSay: { color: CHROME.dustDim, fontSize: 10, fontFamily: TYPE.ui, letterSpacing: 0.4 },

  entryHead: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  entryWord: { color: CHROME.chalk, fontSize: 21, fontFamily: TYPE.display },
  entrySay: { color: SEMANTIC.ember, fontSize: 12, fontFamily: TYPE.ui, letterSpacing: 0.6 },
  fieldLabel: {
    color: CHROME.dustDim,
    fontSize: 9,
    letterSpacing: 2.2,
    fontFamily: TYPE.uiMedium,
    marginTop: 2,
  },
  colloc: { color: "#C3D0D2", fontSize: 13, lineHeight: 20, fontFamily: TYPE.displayItalic },

  tocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE.edge,
  },
  tocRowHere: { borderBottomColor: SEMANTIC.ember },
  tocN: { color: CHROME.dustDim, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
  tocBody: { flex: 1, gap: 2 },
  tocHeading: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium },
  tocMeta: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },
  tocBest: { color: SEMANTIC.ember, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
  tocBestNone: { color: CHROME.dustDim },

  studyText: { fontSize: 16, lineHeight: 26 },

  readPad: { paddingVertical: SPACE.md, gap: SPACE.sm },
  readHeading: { color: CHROME.dustDim, fontSize: 12, letterSpacing: 2, fontFamily: TYPE.uiMedium },
  readText: { color: CHROME.chalk, fontSize: 21, lineHeight: 34, fontFamily: TYPE.ui },
  readFoot: { gap: SPACE.sm, paddingBottom: SPACE.md, alignItems: "center" },
  clockSmall: { color: CHROME.dustDim, fontSize: 14, fontFamily: TYPE.monoMedium, ...TABULAR },
  stopBar: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    overflow: "hidden",
  },
  stopBloom: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  stopLabel: { color: CHROME.chalk, fontSize: 13, letterSpacing: 1.6, fontFamily: TYPE.uiSemi },

  marked: { flexDirection: "row", flexWrap: "wrap" },
  markedWord: {
    color: CHROME.dust,
    fontSize: 16,
    lineHeight: 27,
    fontFamily: TYPE.ui,
    marginRight: 6,
  },
  markedTarget: { color: CHROME.chalk, fontFamily: TYPE.uiSemi },
  markedAltered: { color: SEMANTIC.flaw, textDecorationLine: "underline" },
  markedMissed: { color: CHROME.dustDim, opacity: 0.45 },

  stumble: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  stumbleRef: { color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.display },
  stumbleArrow: { color: SEMANTIC.flaw, fontSize: 12, fontFamily: TYPE.ui },
  stumbleSay: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui },
});
