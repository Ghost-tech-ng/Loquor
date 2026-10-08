// Game chimes. The WAVs are synthesised by scripts/make-sfx.mjs.
//
// One player per sound, made on first use and kept: creating a player per play
// costs a decode each time, and a combo chime that lands 80 ms late reads as
// the game lagging. Every call swallows its error — a sound that fails to play
// is a silent game, not a crashed one.
//
// Never play one while a take is recording: the mic hears it, and in Pause,
// Don't Um a chime would register as you talking through the gate.

import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { loadSettings } from "../../lib/settings";

const SOURCES = {
  correct: require("../../assets/sfx/correct.wav"),
  wrong: require("../../assets/sfx/wrong.wav"),
  combo: require("../../assets/sfx/combo.wav"),
  tick: require("../../assets/sfx/tick.wav"),
  defuse: require("../../assets/sfx/defuse.wav"),
  boom: require("../../assets/sfx/boom.wav"),
  heart: require("../../assets/sfx/heart.wav"),
  win: require("../../assets/sfx/win.wav"),
  go: require("../../assets/sfx/go.wav"),
} as const satisfies Record<string, number>;

export type Sfx = keyof typeof SOURCES;

const players = new Map<Sfx, AudioPlayer>();
let enabled = true;

/** Re-read after Settings changes; the toggle is cached so a play costs no I/O. */
export async function refreshSfx(): Promise<void> {
  try {
    enabled = (await loadSettings()).sfx;
  } catch {
    enabled = true;
  }
}
void refreshSfx();

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

export function play(name: Sfx): void {
  if (!enabled) return;
  try {
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = 0.7;
      players.set(name, p);
    }
    void p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Sound is decoration; the haptic already carried the meaning.
  }
}
