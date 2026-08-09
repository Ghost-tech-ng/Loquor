// The microphone as an instrument rather than a source of words.
//
// Deliberately not useTake. That hook exists to turn speech into a transcript,
// and it throws the raw level away — it normalises metering into a 0..1 number
// for the bloom, which is right for a recording surface and useless for a
// measurement. It also transcribes, which costs an API call, needs a key, and
// sends audio off the device. The Valve measures loudness and nothing else, so
// it needs the opposite of all four: raw dBFS, no model, no key, no network.
//
// The file is deleted the moment a take ends, same rule as everywhere else, and
// here it is easier to honour because nothing ever reads it. The recorder writes
// to disk only because that is the only way expo-audio will report a level.

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

import { FLOOR_DB, decayPeak, sustainedPeak } from "../lib/valve";

/** Ten samples a second. Fast enough that a held syllable lands three or four
 *  ticks, which is what sustainedPeak needs to tell a voice from a door slam. */
const SAMPLE_MS = 100;

export type MeterState = {
  ready: boolean;
  running: boolean;
  error: string | null;
  /** Live level, raw dBFS. FLOOR_DB when nothing is being picked up. */
  db: number;
  /** The same, held and decayed, for anything the eye has to follow. */
  peakDb: number;
  seconds: number;
  start: () => Promise<void>;
  /** Stops, deletes the audio, and returns the level actually held. */
  stop: () => Promise<number>;
};

export function useMeter(): MeterState {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, SAMPLE_MS);

  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peakDb, setPeakDb] = useState(FLOOR_DB);
  const samples = useRef<number[]>([]);

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

  const db = typeof state.metering === "number" ? state.metering : FLOOR_DB;

  // durationMillis is in the dependency list on purpose. It advances on every
  // poll whereas the level does not, so without it a steady tone would stop the
  // effect firing and freeze the decay at whatever it last reached.
  useEffect(() => {
    if (!running) return;
    samples.current.push(db);
    setPeakDb((p) => decayPeak(p, db));
  }, [running, db, state.durationMillis]);

  const start = useCallback(async () => {
    if (!ready) return;
    setError(null);
    samples.current = [];
    setPeakDb(FLOOR_DB);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(true);
  }, [ready, recorder]);

  const stop = useCallback(async (): Promise<number> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    setRunning(false);

    const uri = recorder.uri;
    if (uri) {
      try {
        new File(uri).delete();
      } catch {
        /* a leftover temp file is not worth failing the take over */
      }
    }
    return sustainedPeak(samples.current);
  }, [recorder]);

  return {
    ready,
    running,
    error,
    db,
    peakDb,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    start,
    stop,
  };
}
