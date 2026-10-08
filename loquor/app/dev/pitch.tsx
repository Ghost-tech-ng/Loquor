// Phase 2 spike: can this phone, inside Expo Go, produce a melody line?
//
// Bring It to Life depends on raw audio samples, which Expo Go may or may not
// deliver. There are two routes, and this screen tries both so the answer comes
// from the phone rather than from the docs:
//
//   1. Live mic stream (expo-audio useAudioStream) — pitch while you talk.
//   2. Playback sampling — record, then replay the file through a sample tap.
//
// It also checks whether the stream and the recorder can run at once, because
// the games want a live melody *and* a file for Whisper from the same take.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { File } from "expo-file-system";
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioSampleListener,
  useAudioStream,
  type AudioSample,
  type AudioStreamBuffer,
} from "expo-audio";

import { Masthead, Screen } from "../../components/ui";
import { Glass } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { AURORA, CHROME, SEMANTIC, SPACE, TABULAR, TYPE } from "../../theme";
import { PitchTracker, monoFloat, semitones, type PitchPoint } from "../../features/games/pitch";
import { melody } from "../../features/games/prosody";

type Verdict = "untested" | "running" | "works" | "fails";

const LINE_W = 320;
const LINE_H = 120;
const SHOW_S = 5;
const ST_LO = semitones(70);
const ST_HI = semitones(400);

function MelodyLine({ points, until }: { points: readonly PitchPoint[]; until: number }) {
  const from = Math.max(0, until - SHOW_S);
  const visible = points.filter((p) => p.t >= from && p.clarity >= 0.7);
  // Break the line wherever a gap means a new phrase, so silence reads as silence.
  const runs: string[] = [];
  let run: string[] = [];
  visible.forEach((p, i) => {
    if (i > 0 && p.t - visible[i - 1]!.t > 0.12) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
    }
    const x = ((p.t - from) / SHOW_S) * LINE_W;
    const y = LINE_H - ((semitones(p.hz) - ST_LO) / (ST_HI - ST_LO)) * LINE_H;
    run.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));
  return (
    <Svg width="100%" height={LINE_H} viewBox={`0 0 ${LINE_W} ${LINE_H}`}>
      {[110, 165, 220].map((hz) => {
        const y = LINE_H - ((semitones(hz) - ST_LO) / (ST_HI - ST_LO)) * LINE_H;
        return <Line key={hz} x1={0} x2={LINE_W} y1={y} y2={y} stroke={CHROME.carve} strokeWidth={0.5} />;
      })}
      {runs.map((pts, i) => (
        <Polyline
          key={i}
          points={pts}
          fill="none"
          stroke={AURORA.mint}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

function Badge({ v }: { v: Verdict }) {
  const color =
    v === "works" ? SEMANTIC.solid : v === "fails" ? SEMANTIC.flaw : v === "running" ? AURORA.cyan : CHROME.dust;
  const label = v === "works" ? "WORKS" : v === "fails" ? "FAILS" : v === "running" ? "RUNNING" : "NOT RUN";
  return <Text style={[s.badge, { color, borderColor: color }]}>{label}</Text>;
}

function summarise(points: readonly PitchPoint[]): string {
  const m = melody(points);
  if (!m) return `${points.length} voiced frames, too few to judge range`;
  return `${points.length} voiced frames · range ${m.rangeSt.toFixed(1)} st · melody score ${m.score}`;
}

async function prepare(): Promise<boolean> {
  const perm = await requestRecordingPermissionsAsync();
  if (!perm.granted) return false;
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  return true;
}

function deleteQuietly(uri: string | null) {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone, or never written; either way nothing is left to clean.
  }
}

// --- 1 + 2: the live stream ---------------------------------------------------

function LiveTests() {
  const tracker = useRef(new PitchTracker());
  const firstAt = useRef<number | null>(null);
  const stats = useRef({ buffers: 0, samples: 0, rate: 0, channels: 0 });
  const [, force] = useState(0);
  const [live, setLive] = useState<Verdict>("untested");
  const [combo, setCombo] = useState<Verdict>("untested");
  const [detail, setDetail] = useState("");
  const [comboDetail, setComboDetail] = useState("");
  const [now, setNow] = useState(0);

  const onBuffer = useCallback((b: AudioStreamBuffer) => {
    const mono = monoFloat(b.data, b.channels);
    if (firstAt.current === null) firstAt.current = Date.now();
    stats.current.buffers++;
    stats.current.samples += mono.length;
    stats.current.rate = b.sampleRate;
    stats.current.channels = b.channels;
    tracker.current.push(mono, b.sampleRate);
    setNow(b.timestamp);
  }, []);

  const { stream } = useAudioStream({ sampleRate: 48000, channels: 1, encoding: "float32", onBuffer });
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => () => stream.stop(), [stream]);

  const reset = () => {
    tracker.current = new PitchTracker();
    firstAt.current = null;
    stats.current = { buffers: 0, samples: 0, rate: 0, channels: 0 };
    setNow(0);
  };

  const describe = (seconds: number) => {
    const st = stats.current;
    const perBuffer = st.buffers ? Math.round(st.samples / st.buffers) : 0;
    const ms = st.rate ? Math.round((perBuffer / st.rate) * 1000) : 0;
    return `${st.buffers} buffers in ${seconds}s · ${st.rate} Hz · ${st.channels} ch · ${ms} ms each\n${summarise(tracker.current.points)}`;
  };

  const runLive = async () => {
    reset();
    setLive("running");
    setDetail("Talk for 6 seconds. Say something with feeling, then something flat.");
    try {
      if (!(await prepare())) {
        setLive("fails");
        setDetail("Microphone permission was refused.");
        return;
      }
      await stream.start();
      await new Promise((r) => setTimeout(r, 6000));
      stream.stop();
      const ok = stats.current.buffers > 0 && tracker.current.frames > 0;
      setLive(ok ? "works" : "fails");
      setDetail(ok ? describe(6) : "The stream started but no audio arrived.");
    } catch (e) {
      stream.stop();
      setLive("fails");
      setDetail(`Stream error: ${e instanceof Error ? e.message : String(e)}`);
    }
    force((n) => n + 1);
  };

  const runCombo = async () => {
    reset();
    setCombo("running");
    setComboDetail("Recording and streaming together for 5 seconds. Keep talking.");
    let uri: string | null = null;
    try {
      if (!(await prepare())) {
        setCombo("fails");
        setComboDetail("Microphone permission was refused.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      await stream.start();
      await new Promise((r) => setTimeout(r, 5000));
      stream.stop();
      await recorder.stop();
      uri = recorder.uri;
      const size = uri ? new File(uri).size : 0;
      const streamed = stats.current.buffers > 0;
      const recorded = size > 4000;
      setCombo(streamed && recorded ? "works" : "fails");
      setComboDetail(
        `Recorder file: ${recorded ? `${Math.round(size / 1024)} KB` : "empty or missing"}\nStream: ${
          streamed ? describe(5) : "no buffers while recording"
        }`
      );
    } catch (e) {
      stream.stop();
      setCombo("fails");
      setComboDetail(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      deleteQuietly(uri);
    }
  };

  const busy = live === "running" || combo === "running";

  return (
    <>
      <Glass style={s.card}>
        <View style={s.head}>
          <Text style={s.h}>1 · Live melody</Text>
          <Badge v={live} />
        </View>
        <Text style={s.body}>Pitch read straight off the mic while you talk.</Text>
        <View style={s.line}>
          <MelodyLine points={tracker.current.points} until={Math.max(now, SHOW_S)} />
        </View>
        {detail ? <Text style={s.detail}>{detail}</Text> : null}
        <GlowButton label={live === "running" ? "Listening…" : "Test live melody"} onPress={runLive} disabled={busy} compact />
      </Glass>

      <Glass style={s.card}>
        <View style={s.head}>
          <Text style={s.h}>2 · Stream and record at once</Text>
          <Badge v={combo} />
        </View>
        <Text style={s.body}>
          The games need a live melody and a file for transcription from the same take.
        </Text>
        {comboDetail ? <Text style={s.detail}>{comboDetail}</Text> : null}
        <GlowButton label={combo === "running" ? "Recording…" : "Test both together"} onPress={runCombo} disabled={busy} compact tone="ghost" />
      </Glass>
    </>
  );
}

// --- 3: playback sampling, the fallback -------------------------------------

function PlaybackTest() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const frames = useRef<number[][]>([]);
  const capturing = useRef(false);
  const uriRef = useRef<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict>("untested");
  const [detail, setDetail] = useState("");
  const [points, setPoints] = useState<PitchPoint[]>([]);

  useAudioSampleListener(player, (sample: AudioSample) => {
    if (!capturing.current) return;
    const ch = sample.channels[0];
    if (ch && ch.frames.length) frames.current.push(ch.frames);
  });

  const finish = useCallback(() => {
    capturing.current = false;
    player.setAudioSamplingEnabled(false);
    const total = frames.current.reduce((a, f) => a + f.length, 0);
    const duration = player.duration || 4;
    deleteQuietly(uriRef.current);
    uriRef.current = null;
    if (total === 0) {
      setVerdict("fails");
      setDetail(`No samples came back during playback. Sampling supported: ${String(player.isAudioSamplingSupported)}`);
      return;
    }
    // The tap does not say its rate, so infer it from how much audio arrived.
    const rate = Math.round(total / duration);
    const tracker = new PitchTracker();
    for (const f of frames.current) tracker.push(f, rate);
    setPoints([...tracker.points]);
    setVerdict(tracker.frames > 0 ? "works" : "fails");
    setDetail(`${frames.current.length} chunks · ~${rate} Hz inferred\n${summarise(tracker.points)}`);
  }, [player]);

  useEffect(() => {
    if (capturing.current && status.didJustFinish) finish();
  }, [status.didJustFinish, finish]);

  const run = async () => {
    setVerdict("running");
    setPoints([]);
    setDetail("Recording 4 seconds. Talk.");
    try {
      if (!(await prepare())) {
        setVerdict("fails");
        setDetail("Microphone permission was refused.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      await new Promise((r) => setTimeout(r, 4000));
      await recorder.stop();
      uriRef.current = recorder.uri;
      if (!recorder.uri) throw new Error("the recorder produced no file");
      setDetail("Playing it back through the sample tap…");
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      frames.current = [];
      player.replace({ uri: recorder.uri });
      player.setAudioSamplingEnabled(true);
      capturing.current = true;
      player.play();
      // A backstop in case didJustFinish never fires.
      setTimeout(() => capturing.current && finish(), 9000);
    } catch (e) {
      capturing.current = false;
      deleteQuietly(uriRef.current);
      setVerdict("fails");
      setDetail(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Glass style={s.card}>
      <View style={s.head}>
        <Text style={s.h}>3 · Replay sampling</Text>
        <Badge v={verdict} />
      </View>
      <Text style={s.body}>The fallback: record first, then read the melody off the replay.</Text>
      <View style={s.line}>
        <MelodyLine points={points} until={Math.max(points[points.length - 1]?.t ?? 0, SHOW_S)} />
      </View>
      {detail ? <Text style={s.detail}>{detail}</Text> : null}
      <GlowButton label={verdict === "running" ? "Working…" : "Test replay sampling"} onPress={run} disabled={verdict === "running"} compact tone="ghost" />
    </Glass>
  );
}

export default function PitchSpike() {
  // useAudioStream constructs the native object on first render, so on a build
  // without it the hook itself would throw. Check before mounting it.
  const hasStream = typeof (AudioModule as { AudioStream?: unknown }).AudioStream === "function";

  return (
    <Screen>
      <Masthead close />
      <View style={{ gap: 6 }}>
        <Text style={s.title}>Pitch test</Text>
        <Text style={s.lede}>
          Run all three, then screenshot this screen and send it over. It decides how Bring It to
          Life gets built.
        </Text>
      </View>
      {hasStream ? (
        <LiveTests />
      ) : (
        <Glass style={s.card}>
          <View style={s.head}>
            <Text style={s.h}>1 · Live melody</Text>
            <Badge v="fails" />
          </View>
          <Text style={s.body}>This Expo Go build has no live audio stream. Tests 1 and 2 cannot run.</Text>
        </Glass>
      )}
      <PlaybackTest />
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: CHROME.chalk, fontSize: 34, fontFamily: TYPE.display, letterSpacing: -0.8 },
  lede: { color: CHROME.dust, fontSize: 14.5, lineHeight: 21, fontFamily: TYPE.ui },
  card: { gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.displaySoft },
  body: { color: CHROME.dust, fontSize: 13.5, lineHeight: 19, fontFamily: TYPE.ui },
  line: { borderRadius: 12, backgroundColor: "rgba(0,0,0,0.25)", paddingVertical: 6 },
  detail: { color: CHROME.chalk, fontSize: 12, lineHeight: 18, fontFamily: TYPE.mono, ...TABULAR },
  badge: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: TYPE.uiBold,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
