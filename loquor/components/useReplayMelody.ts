// Read the melody off a take by playing it back through the sample tap.
//
// Expo Go cannot stream the mic as PCM, but it can hand back the frames of a
// file as it plays. So the take is replayed out loud, the pitch line draws as
// it goes, and then the file is deleted. You hear the flatness and see it in
// the same pass, which is the whole point of the replay.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioSampleListener,
  type AudioSample,
} from "expo-audio";

import { PitchTracker, type PitchPoint } from "../features/games/pitch";
import { discardAudio } from "./useTake";

/** Seconds of playback before the preview line starts drawing. */
const PREVIEW_AFTER_S = 0.5;

export type ReplayState = {
  /** Points so far while replaying; the final line once done. */
  points: PitchPoint[];
  replaying: boolean;
  /** Plays the file, deletes it, resolves the melody or null when no frames came back. */
  analyse: (uri: string, expectSeconds: number) => Promise<PitchPoint[] | null>;
  /** Stops a replay in progress and deletes its file. */
  cancel: () => void;
};

export function useReplayMelody(): ReplayState {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [points, setPoints] = useState<PitchPoint[]>([]);
  const [replaying, setReplaying] = useState(false);

  const chunks = useRef<number[][]>([]);
  const total = useRef(0);
  const capturing = useRef(false);
  const uri = useRef<string | null>(null);
  const done = useRef<((p: PitchPoint[] | null) => void) | null>(null);
  const backstop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preview = useRef<{ tracker: PitchTracker; fed: number } | null>(null);
  const firstStamp = useRef<number | null>(null);
  const lastStamp = useRef(0);

  useAudioSampleListener(player, (sample: AudioSample) => {
    if (!capturing.current) return;
    const ch = sample.channels[0];
    if (!ch || ch.frames.length === 0) return;
    chunks.current.push(ch.frames);
    total.current += ch.frames.length;
    if (firstStamp.current === null) firstStamp.current = sample.timestamp;
    lastStamp.current = sample.timestamp;
  });

  const settle = useCallback(
    (result: PitchPoint[] | null) => {
      capturing.current = false;
      if (backstop.current) clearTimeout(backstop.current);
      backstop.current = null;
      try {
        player.setAudioSamplingEnabled(false);
        player.pause();
      } catch {
        // The player may already be torn down; nothing left to stop.
      }
      discardAudio(uri.current);
      uri.current = null;
      setReplaying(false);
      const resolve = done.current;
      done.current = null;
      resolve?.(result);
    },
    [player]
  );

  const finish = useCallback(() => {
    if (!capturing.current) return;
    if (total.current === 0) {
      settle(null);
      return;
    }
    // The tap does not say its rate, so infer it from how much audio arrived.
    const duration = player.duration > 0 ? player.duration : Math.max(1, lastStamp.current);
    const tracker = new PitchTracker();
    const rate = Math.round(total.current / duration);
    for (const f of chunks.current) tracker.push(f, rate);
    chunks.current = [];
    const final = tracker.frames > 0 ? [...tracker.points] : null;
    setPoints(final ?? []);
    settle(final);
  }, [player, settle]);

  useEffect(() => {
    if (capturing.current && status.didJustFinish) finish();
  }, [status.didJustFinish, finish]);

  // Draw a preview while it plays. The rate is a guess from the first half
  // second; the final pass above redoes it from the whole file.
  useEffect(() => {
    if (!replaying) return;
    const id = setInterval(() => {
      if (!capturing.current) return;
      const span = lastStamp.current - (firstStamp.current ?? lastStamp.current);
      if (!preview.current) {
        if (span < PREVIEW_AFTER_S) return;
        const seen = chunks.current.slice(0, -1).reduce((a, f) => a + f.length, 0);
        preview.current = { tracker: new PitchTracker(), fed: 0 };
        preview.current.tracker.push(new Float32Array(0), Math.round(seen / span) || 44100);
      }
      const p = preview.current;
      const fresh = chunks.current.length - p.fed;
      if (fresh <= 0) return;
      for (let i = p.fed; i < chunks.current.length; i++) p.tracker.push(chunks.current[i]!, 0);
      p.fed = chunks.current.length;
      setPoints([...p.tracker.points]);
    }, 200);
    return () => clearInterval(id);
  }, [replaying]);

  const analyse = useCallback(
    (file: string, expectSeconds: number) =>
      new Promise<PitchPoint[] | null>((resolve) => {
        void (async () => {
          chunks.current = [];
          total.current = 0;
          preview.current = null;
          firstStamp.current = null;
          lastStamp.current = 0;
          uri.current = file;
          done.current = resolve;
          setPoints([]);
          try {
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            player.replace({ uri: file });
            player.setAudioSamplingEnabled(true);
            capturing.current = true;
            setReplaying(true);
            player.play();
            // In case didJustFinish never fires.
            backstop.current = setTimeout(finish, (expectSeconds + 4) * 1000);
          } catch {
            settle(null);
          }
        })();
      }),
    [player, finish, settle]
  );

  const cancel = useCallback(() => {
    chunks.current = [];
    total.current = 0;
    if (capturing.current || uri.current) settle(null);
  }, [settle]);

  useEffect(() => cancel, [cancel]);

  return { points, replaying, analyse, cancel };
}
