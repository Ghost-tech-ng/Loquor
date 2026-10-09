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
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { feel } from "./kit/feel";
import { transcribe } from "../lib/stt";
import { getKey, loadSettings, resolve, softFillers } from "../lib/settings";
import type { Metrics, Word } from "../lib/metrics";
import { computeMetrics } from "../lib/metrics";

/** Seconds between meter readings, which is also the spacing of `levels`. */
export const LEVEL_STEP_S = 0.1;

export type Take = {
  text: string;
  words: Word[];
  metrics: Metrics;
  /** Meter readings in dBFS, one per LEVEL_STEP_S, for punch and emphasis. */
  levels: number[];
  /** Which STT provider produced it, so the row can record what judged it. */
  provider: "groq" | "deepgram";
  /**
   * Only with `keepAudio`: the file, still on disk, for a caller that has to
   * read the melody off it. That caller owns deleting it, via `discardAudio`.
   */
  audioUri: string | null;
};

export type TakeState = {
  /** Mic permission resolved and granted. */
  ready: boolean;
  recording: boolean;
  /** True from stop() until the transcript is back. */
  busy: boolean;
  /** Seconds elapsed in the current take. */
  seconds: number;
  /** 0..1 input level, for the bloom. */
  level: number;
  /** Raw meter reading in dBFS; -160 when there is none. */
  db: number;
  /** Non-null once something has gone wrong. Cleared by the next start(). */
  error: string | null;
  /** Resolves true once the mic is actually recording. */
  start: () => Promise<boolean>;
  /** Stops and transcribes. Returns null when it failed; `error` explains. */
  stop: () => Promise<Take | null>;
  /** Stops without transcribing and deletes the audio. Safe to call any time. */
  cancel: () => Promise<void>;
  clearError: () => void;
};

export function discardAudio(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone, or never written; either way nothing is left to clean.
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useTake(opts: { prompt?: string; keepAudio?: boolean } = {}): TakeState {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompt = useRef(opts.prompt);
  prompt.current = opts.prompt;
  const keepAudio = useRef(opts.keepAudio ?? false);
  keepAudio.current = opts.keepAudio ?? false;

  // Refs, not state, for the guards: two taps inside one frame both see the
  // same stale state, and the second would start or stop the recorder again.
  const live = useRef(false);
  const stopping = useRef(false);
  const levels = useRef<number[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!alive) return;
        if (perm.granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
          if (alive) setReady(true);
        } else {
          setError("PipeUp needs the microphone. Enable it in iOS Settings → Expo Go → Microphone.");
        }
      } catch (err) {
        if (alive) setError(`Could not open the microphone: ${message(err)}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!live.current) return;
    levels.current.push(typeof state.metering === "number" ? state.metering : -160);
  }, [state.durationMillis, state.metering]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!ready || live.current || stopping.current) return false;
    setError(null);
    try {
      // A replay elsewhere may have switched recording off.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      setError(`The microphone would not start: ${message(err)}`);
      return false;
    }
    levels.current = [];
    live.current = true;
    feel.thud();
    setRecording(true);
    return true;
  }, [ready, recorder]);

  const stop = useCallback(async (): Promise<Take | null> => {
    if (!live.current || stopping.current) return null;
    stopping.current = true;
    live.current = false;
    setBusy(true);
    feel.tap();
    const fallbackS = (state.durationMillis ?? 0) / 1000;
    let uri: string | null = null;

    try {
      await recorder.stop();
      setRecording(false);
      uri = recorder.uri;
      if (!uri) throw new Error("The recorder produced no file. Try once more.");
      if ((new File(uri).size ?? 0) === 0)
        throw new Error("The recording came back empty. Try once more.");

      const settings = await loadSettings();
      const { stt } = resolve(settings);
      const key = (await getKey(stt)) ?? "";
      const t = await transcribe(uri, stt, key, { prompt: prompt.current });

      // Before any early return: the transcript exists, so the audio must not —
      // unless the caller asked to keep it for one replay, and then it is theirs.
      const kept = keepAudio.current ? uri : null;
      if (!kept) discardAudio(uri);

      const metrics = computeMetrics(t.words, t.durationS ?? fallbackS, softFillers(settings));
      if (metrics.wordCount === 0) {
        discardAudio(kept);
        throw new Error("Nothing was picked up. Check the mic and try again.");
      }

      return {
        text: t.text,
        words: t.words,
        metrics,
        levels: [...levels.current],
        provider: stt,
        audioUri: kept,
      };
    } catch (err) {
      discardAudio(uri);
      setRecording(false);
      setError(message(err));
      return null;
    } finally {
      stopping.current = false;
      setBusy(false);
    }
  }, [recorder, state.durationMillis]);

  const cancel = useCallback(async () => {
    if (!live.current) return;
    live.current = false;
    try {
      await recorder.stop();
    } catch {
      // Already stopped is the state we wanted.
    }
    discardAudio(recorder.uri);
    setRecording(false);
  }, [recorder]);

  // Leaving the screen mid-take must not leave the mic open or a file behind.
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => () => void cancelRef.current(), []);

  return {
    ready,
    recording,
    busy,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    level:
      typeof state.metering === "number"
        ? Math.max(0, Math.min(1, (state.metering + 60) / 60))
        : 0,
    db: typeof state.metering === "number" ? state.metering : -160,
    error,
    start,
    stop,
    cancel,
    clearError: useCallback(() => setError(null), []),
  };
}
