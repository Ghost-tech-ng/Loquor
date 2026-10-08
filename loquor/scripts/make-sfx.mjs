// Synthesises the game chimes into assets/sfx/*.wav.
//
// Pure tones and shaped noise, written sample by sample, so every sound in the
// app is ours outright: no library, no licence, nothing downloaded. Run it once
// after changing a recipe: `node scripts/make-sfx.mjs`.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sfx");

/** A note: frequency, start, length, all seconds; optional glide target and wave. */
function render(notes, lengthS, { noise = null } = {}) {
  const n = Math.ceil(lengthS * RATE);
  const buf = new Float32Array(n);
  for (const { hz, at, dur, to = hz, gain = 0.5, wave = "sine" } of notes) {
    const i0 = Math.floor(at * RATE);
    const len = Math.floor(dur * RATE);
    let phase = 0;
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / len;
      const f = hz + (to - hz) * t;
      phase += (2 * Math.PI * f) / RATE;
      // Fast attack, exponential tail: a struck sound, not a held one.
      const env = Math.min(1, i / (0.004 * RATE)) * Math.exp(-4.5 * t);
      const s =
        wave === "sine"
          ? Math.sin(phase) + 0.18 * Math.sin(2 * phase)
          : wave === "square"
            ? Math.sign(Math.sin(phase)) * 0.35
            : (2 / Math.PI) * Math.asin(Math.sin(phase));
      buf[i0 + i] += s * env * gain;
    }
  }
  if (noise) {
    let lp = 0;
    const len = Math.floor(noise.dur * RATE);
    for (let i = 0; i < len && i < n; i++) {
      const t = i / len;
      lp += ((Math.random() * 2 - 1) - lp) * noise.tone;
      buf[i] += lp * Math.exp(-noise.decay * t) * noise.gain;
    }
  }
  return buf;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const scale = peak > 0.9 ? 0.9 / peak : 1;
  samples.forEach((v, i) => data.writeInt16LE(Math.round(v * scale * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// C major, high and bright: E5 G5 C6 E6.
const SOUNDS = {
  correct: render(
    [
      { hz: 784, at: 0, dur: 0.16 },
      { hz: 1047, at: 0.07, dur: 0.22 },
    ],
    0.32
  ),
  wrong: render([{ hz: 220, to: 160, at: 0, dur: 0.24, wave: "tri", gain: 0.6 }], 0.26),
  combo: render(
    [
      { hz: 659, at: 0, dur: 0.14 },
      { hz: 784, at: 0.06, dur: 0.14 },
      { hz: 1047, at: 0.12, dur: 0.14 },
      { hz: 1319, at: 0.18, dur: 0.26 },
    ],
    0.46
  ),
  tick: render([{ hz: 1800, at: 0, dur: 0.03, gain: 0.35 }], 0.04),
  defuse: render(
    [
      { hz: 440, to: 1320, at: 0, dur: 0.28, gain: 0.4 },
      { hz: 1319, at: 0.22, dur: 0.3 },
    ],
    0.55
  ),
  boom: render([{ hz: 90, to: 40, at: 0, dur: 0.5, gain: 0.7 }], 0.6, {
    noise: { dur: 0.55, decay: 5, gain: 0.8, tone: 0.18 },
  }),
  heart: render(
    [
      { hz: 523, at: 0, dur: 0.16, wave: "tri" },
      { hz: 392, at: 0.12, dur: 0.28, wave: "tri" },
    ],
    0.42
  ),
  win: render(
    [
      { hz: 523, at: 0, dur: 0.16 },
      { hz: 659, at: 0.1, dur: 0.16 },
      { hz: 784, at: 0.2, dur: 0.16 },
      { hz: 1047, at: 0.3, dur: 0.5 },
      { hz: 1319, at: 0.3, dur: 0.5, gain: 0.25 },
    ],
    0.85
  ),
  go: render([{ hz: 880, at: 0, dur: 0.12, gain: 0.45 }], 0.14),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)} s`);
}
