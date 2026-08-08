// Record, transcribe, delete the audio.
//
// The Arena grew this inline. Four more screens in Phases 3 and 4 need exactly
// the same seven steps — permission, prepare, record, meter, stop, transcribe,
// delete — and the seventh is the one that must not be reimplemented per screen.
// Audio is deleted the instant a transcript exists (PRD §11); a copy of that
// rule living in five files is a copy that gets forgotten in the fifth.
//
// The hook stops at the transcript. It does not judge, does not save, and does
// not navigate, because every caller does those three differently and a hook
// that tried to own them would take a callback per screen and earn nothing.

import { useCallback, useEffect, useRef, useState } from "react";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { transcribe } from "../lib/stt";
import { getKey, loadSettings, resolve } from "../lib/settings";
import type { Metrics } from "../lib/metrics";
import { computeMetrics } from "../lib/metrics";

export type Take = {
  text: string;
  metrics: Metrics;
  /** Which STT provider produced it, so the row can record what judged it. */
  provider: "groq" | "deepgram";
};

export type TakeState = {
  /** Mic permission resolved and granted. */
  ready: boolean;
  recording: boolean;
  /** Seconds elapsed in the current take. */
  seconds: number;
  /** 0..1 input level, for the bloom. */
  level: number;
  /** Non-null once something has gone wrong. Cleared by the next start(). */
  error: string | null;
  start: () => Promise<void>;
  /** Stops and transcribes. Returns null when it failed; `error` explains. */
  stop: () => Promise<Take | null>;
  clearError: () => void;
};

export function useTake(opts: { prompt?: string } = {}): TakeState {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompt = useRef(opts.prompt);
  prompt.current = opts.prompt;

  useEffect(() => {
    let alive = true;
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive) return;
      if (perm.granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        setReady(true);
      } else {
        setError("Loquor needs the microphone. Enable it in iOS Settings → Loquor.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const start = useCallback(async () => {
    if (!ready) return;
    setError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecording(true);
  }, [ready, recorder]);

  const stop = useCallback(async (): Promise<Take | null> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    setRecording(false);

    const uri = recorder.uri;
    const fallbackS = (state.durationMillis ?? 0) / 1000;

    try {
      if (!uri) throw new Error("The recorder produced no file. Try once more.");
      if ((new File(uri).size ?? 0) === 0)
        throw new Error("The recording came back empty. Try once more.");

      const { stt } = resolve(await loadSettings());
      const key = (await getKey(stt)) ?? "";
      const t = await transcribe(uri, stt, key, { prompt: prompt.current });

      // Before any early return: the transcript exists, so the audio must not.
      try {
        new File(uri).delete();
      } catch {
        /* a leftover temp file is not worth failing the take over */
      }

      const metrics = computeMetrics(t.words, t.durationS ?? fallbackS);
      if (metrics.wordCount === 0)
        throw new Error("Nothing was picked up. Check the mic and try again.");

      return { text: t.text, metrics, provider: stt };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [recorder, state.durationMillis]);

  return {
    ready,
    recording,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    level:
      typeof state.metering === "number"
        ? Math.max(0, Math.min(1, (state.metering + 60) / 60))
        : 0,
    error,
    start,
    stop,
    clearError: useCallback(() => setError(null), []),
  };
}
