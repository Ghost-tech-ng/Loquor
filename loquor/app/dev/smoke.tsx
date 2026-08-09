// Phase 0 smoke test.
//
// Proves four things inside Expo Go on iOS, all of which the product depends on
// and none of which are worth assuming:
//
//   1. expo-audio can request mic permission and record            (no dev build)
//   2. live metering is available at a usable rate                 (the amplitude bloom)
//   3. the recording file is real and non-zero                     (cf. expo/expo#39646)
//   4. a multipart upload of that file to Groq round-trips         (the latency budget)
//
// If any of these fail here, they fail in the real app, and better to know now.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { CHROME, SEMANTIC, heat } from "../../theme";

const KEY_STORE = "groq_api_key";
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

type Check = { label: string; state: "pending" | "pass" | "fail"; detail?: string };

export default function SmokeTest() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [checks, setChecks] = useState<Check[]>([
    { label: "Microphone permission", state: "pending" },
    { label: "Recording produced a file", state: "pending" },
    { label: "Live metering", state: "pending" },
    { label: "Groq round-trip", state: "pending" },
  ]);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const meteringSeen = useRef(false);

  const setCheck = useCallback((i: number, patch: Partial<Check>) => {
    setChecks((prev) => prev.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(KEY_STORE);
      if (stored) setApiKey(stored);

      const perm = await AudioModule.requestRecordingPermissionsAsync();
      setCheck(0, {
        state: perm.granted ? "pass" : "fail",
        detail: perm.granted ? "granted" : "denied — enable in iOS Settings",
      });
      if (perm.granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }
    })();
  }, [setCheck]);

  // Metering is what drives the amplitude bloom. If it never reports, the single
  // highest-value animation in the product is not buildable in Expo Go.
  useEffect(() => {
    if (state.isRecording && typeof state.metering === "number" && !meteringSeen.current) {
      meteringSeen.current = true;
      setCheck(2, { state: "pass", detail: `reporting dBFS at ~10Hz` });
    }
  }, [state.isRecording, state.metering, setCheck]);

  const start = async () => {
    setTranscript(null);
    meteringSeen.current = false;
    setCheck(1, { state: "pending", detail: undefined });
    setCheck(2, { state: "pending", detail: undefined });
    setCheck(3, { state: "pending", detail: undefined });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stop = async () => {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setCheck(1, { state: "fail", detail: "recorder returned no uri" });
      return;
    }

    let bytes = 0;
    try {
      bytes = new File(uri).size ?? 0;
    } catch (err) {
      setCheck(1, { state: "fail", detail: String(err) });
      return;
    }

    if (bytes === 0) {
      setCheck(1, { state: "fail", detail: "zero-byte file — see expo/expo#39646" });
      return;
    }
    setCheck(1, { state: "pass", detail: `${(bytes / 1024).toFixed(0)} KB` });

    if (!meteringSeen.current) {
      setCheck(2, { state: "fail", detail: "metering never reported" });
    }

    if (!apiKey) {
      setCheck(3, { state: "fail", detail: "no API key entered" });
      return;
    }
    await upload(uri);
  };

  const upload = async (uri: string) => {
    setBusy(true);
    const form = new FormData();
    // React Native's FormData takes a file descriptor, not a Blob.
    form.append("file", { uri, name: "take.m4a", type: "audio/m4a" } as unknown as Blob);
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    const t0 = Date.now();
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const ms = Date.now() - t0;

      if (!res.ok) {
        setCheck(3, { state: "fail", detail: `HTTP ${res.status} in ${ms}ms` });
        return;
      }

      const json = await res.json();
      const words = Array.isArray(json.words) ? json.words.length : 0;
      setCheck(3, {
        state: words > 0 ? "pass" : "fail",
        detail: words > 0 ? `${ms}ms · ${words} word timestamps` : `${ms}ms · NO word timestamps`,
      });
      setTranscript(json.text ?? "");
    } catch (err) {
      setCheck(3, { state: "fail", detail: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const saveKey = async (value: string) => {
    setApiKey(value);
    // SecureStore only — never AsyncStorage, never synced to a backend.
    await SecureStore.setItemAsync(KEY_STORE, value);
  };

  // dBFS is roughly -60 (silence) to 0 (peak). Map it onto the heat ramp.
  const level = typeof state.metering === "number" ? Math.max(0, Math.min(1, (state.metering + 60) / 60)) : 0;
  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <Text style={styles.inscr}>LOQVOR</Text>
          <Text style={styles.mono}>PHASE 0</Text>
        </View>
        <View style={styles.hair} />

        <Text style={styles.display}>Can Expo Go do what the product needs?</Text>

        <View style={styles.checks}>
          {checks.map((c) => (
            <View key={c.label} style={styles.checkRow}>
              <View
                style={[
                  styles.dot,
                  c.state === "pass" && { backgroundColor: CHROME.chalk },
                  c.state === "fail" && { backgroundColor: SEMANTIC.flaw },
                ]}
              />
              <View style={styles.checkText}>
                <Text style={styles.checkLabel}>{c.label}</Text>
                {c.detail ? <Text style={styles.checkDetail}>{c.detail}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.hair} />

        <Text style={styles.fieldLabel}>GROQ API KEY</Text>
        <TextInput
          value={apiKey}
          onChangeText={saveKey}
          placeholder="gsk_..."
          placeholderTextColor={CHROME.dustDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />
        <Text style={styles.note}>
          Stored in expo-secure-store on this device only. Never uploaded, never logged.
        </Text>

        <View style={styles.apertureWrap}>
          <View
            style={[
              styles.bloom,
              {
                backgroundColor: heat(level),
                opacity: state.isRecording ? 0.1 + level * 0.5 : 0,
                transform: [{ scale: 1 + level * 0.9 }],
              },
            ]}
          />
          <Pressable onPress={state.isRecording ? stop : start} style={styles.aperture}>
            <View
              style={[
                styles.core,
                state.isRecording && { width: 26, height: 26, borderRadius: 5, backgroundColor: SEMANTIC.flaw },
              ]}
            />
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {state.isRecording ? `RECORDING · ${seconds}s · TAP TO STOP` : "TAP TO SPEAK FOR ~20 SECONDS"}
        </Text>
        <Text style={styles.note}>Say a few &ldquo;um&rdquo;s on purpose — that&rsquo;s the thing being measured.</Text>

        {busy ? <ActivityIndicator color={SEMANTIC.ember} style={{ marginTop: 24 }} /> : null}

        {transcript !== null ? (
          <>
            <View style={styles.hair} />
            <Text style={styles.fieldLabel}>TRANSCRIPT</Text>
            <Text style={styles.body}>{transcript || "(empty)"}</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.floor },
  scroll: { padding: 20, paddingBottom: 60, gap: 12 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  inscr: { color: CHROME.dust, fontSize: 11, letterSpacing: 4 },
  mono: { color: CHROME.dustDim, fontSize: 11, letterSpacing: 2 },
  hair: { height: 1, backgroundColor: CHROME.carve, marginVertical: 8 },
  display: { color: CHROME.chalk, fontSize: 26, lineHeight: 30 },
  checks: { gap: 14, marginTop: 12 },
  checkRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: CHROME.carve },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { color: CHROME.chalk, fontSize: 15 },
  checkDetail: { color: CHROME.dust, fontSize: 12 },
  fieldLabel: { color: CHROME.dustDim, fontSize: 10, letterSpacing: 2 },
  input: {
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
    borderRadius: 2,
    color: CHROME.chalk,
    padding: 12,
    fontSize: 14,
  },
  note: { color: CHROME.dustDim, fontSize: 11, lineHeight: 16 },
  body: { color: "#C3D0D2", fontSize: 14, lineHeight: 21 },
  apertureWrap: { alignItems: "center", justifyContent: "center", height: 180, marginTop: 12 },
  bloom: { position: "absolute", width: 180, height: 180, borderRadius: 90 },
  aperture: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    alignItems: "center",
    justifyContent: "center",
  },
  core: { width: 52, height: 52, borderRadius: 26, backgroundColor: SEMANTIC.ember },
  hint: { color: CHROME.dust, fontSize: 11, letterSpacing: 2, textAlign: "center" },
});
