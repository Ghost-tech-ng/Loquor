// Pip's voice: a chirp, then the line spoken aloud.
//
// The words come from the phone's own speech voice, pitched up, so Pip talks
// offline, for free, with no key. voiceOf() in pet.ts decides how each stage
// sounds; this file only plays it.
//
// Same rule as the game chimes: never a sound while a take records, because the
// mic would hear it. The host hushes Pip the moment it is sent away, and the
// words re-check before they start, because a take can begin in the gap
// between the chirp and the speech.

import * as Speech from "expo-speech";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { loadSettings } from "../../lib/settings";
import { isPetAway, isPetEnabled } from "./petPresence";
import { spokenText, voiceOf, type Chirp, type Stage } from "./pet";

const CHIRPS = {
  "pip-peep": require("../../assets/sfx/pip-peep.wav"),
  "pip-chirp": require("../../assets/sfx/pip-chirp.wav"),
  "pip-squawk": require("../../assets/sfx/pip-squawk.wav"),
} as const satisfies Record<Chirp, number>;

/** The chirp, then a breath, then the words. */
const WORDS_AFTER_MS = 320;

const players = new Map<Chirp, AudioPlayer>();
let enabled = true;
let wordsTimer: ReturnType<typeof setTimeout> | null = null;

export async function refreshPetVoice(): Promise<void> {
  try {
    enabled = (await loadSettings()).petVoice;
  } catch {
    enabled = true;
  }
}
void refreshPetVoice();

export function setPetVoiceEnabled(on: boolean): void {
  enabled = on;
  if (!on) hushPet();
}

function canSpeak(): boolean {
  return enabled && isPetEnabled() && !isPetAway();
}

function chirp(name: Chirp): void {
  try {
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(CHIRPS[name]);
      p.volume = 0.6;
      players.set(name, p);
    }
    void p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // A missed chirp still leaves the words.
  }
}

/** Chirps and says `text` in this stage's voice. Cuts off anything Pip was saying. */
export function speakAs(stage: Stage, text: string): void {
  if (!canSpeak()) return;
  hushPet();
  const voice = voiceOf(stage);
  chirp(voice.chirp);
  const words = spokenText(text);
  if (!words) return;
  wordsTimer = setTimeout(() => {
    wordsTimer = null;
    if (!canSpeak()) return;
    try {
      Speech.speak(words, { pitch: voice.pitch, rate: voice.rate });
    } catch {
      // The bubble already says it.
    }
  }, WORDS_AFTER_MS);
}

/** Stops Pip mid-word. Safe to call when it is not talking. */
export function hushPet(): void {
  if (wordsTimer) {
    clearTimeout(wordsTimer);
    wordsTimer = null;
  }
  for (const p of players.values()) {
    try {
      p.pause();
    } catch {
      // Already stopped.
    }
  }
  void Speech.stop().catch(() => {});
}
