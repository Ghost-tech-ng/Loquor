// Pitch tracking: YIN over raw PCM.
//
// YIN rather than autocorrelation peaks or an FFT because speech is mostly
// harmonics with a weak fundamental — a plain autocorrelation picks the octave
// above about as often as the real one, and a melody line that jumps an octave
// on every other frame is worse than none. The cumulative-mean normalisation is
// what makes YIN stop doing that.
//
// Pure: no React, no expo. Buffers come in from either the live mic stream or
// playback sampling, both as floats in -1..1.

export type PitchPoint = {
  /** Seconds from the start of the take. */
  t: number;
  hz: number;
  /** 0..1, how periodic the frame was. Above ~0.85 is a confident voiced frame. */
  clarity: number;
};

/** A speaking voice, low bass to high excited soprano. Wider admits octave errors. */
export const VOICE_HZ = { min: 70, max: 450 } as const;

/** Frames quieter than this RMS are breath and room noise, not voice. */
export const VOICED_RMS = 0.012;

const THRESHOLD = 0.15;

export function rms(frame: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i]! * frame[i]!;
  return frame.length === 0 ? 0 : Math.sqrt(sum / frame.length);
}

/** The fundamental of one frame, or null when it is silence or not periodic. */
export function yin(
  frame: ArrayLike<number>,
  sampleRate: number,
  range: { min: number; max: number } = VOICE_HZ
): { hz: number; clarity: number } | null {
  if (rms(frame) < VOICED_RMS) return null;
  const tauMin = Math.max(2, Math.floor(sampleRate / range.max));
  const tauMax = Math.min(Math.floor(frame.length / 2), Math.ceil(sampleRate / range.min));
  if (tauMax <= tauMin + 2) return null;

  const w = frame.length - tauMax;
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const delta = frame[i]! - frame[i + tau]!;
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalised difference: d'(tau) = d(tau) * tau / sum(d[1..tau]).
  const cmnd = new Float64Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau]!;
    cmnd[tau] = running === 0 ? 1 : (d[tau]! * tau) / running;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t]! < THRESHOLD) {
      while (t + 1 <= tauMax && cmnd[t + 1]! < cmnd[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // Parabolic interpolation between the neighbours, for sub-sample precision.
  let refined = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1]!;
    const b = cmnd[tau]!;
    const c = cmnd[tau + 1]!;
    const denom = a - 2 * b + c;
    if (denom !== 0) refined = tau + (a - c) / (2 * denom);
  }
  const hz = sampleRate / refined;
  if (hz < range.min || hz > range.max) return null;
  return { hz, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau]!)) };
}

/** Semitones above A1 (55 Hz). Pitch is heard on a log scale; Hz differences are not. */
export function semitones(hz: number): number {
  return 12 * Math.log2(hz / 55);
}

/**
 * Integer-factor downsampling by averaging. 48 kHz voice does not need 48 kHz to
 * find a fundamental under 450 Hz, and YIN's cost is window × lag, so halving
 * the rate quarters the work.
 */
export function decimate(samples: ArrayLike<number>, factor: number): Float32Array {
  const f = Math.max(1, Math.floor(factor));
  const out = new Float32Array(Math.floor(samples.length / f));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let k = 0; k < f; k++) sum += samples[i * f + k]!;
    out[i] = sum / f;
  }
  return out;
}

const TARGET_RATE = 12000;
const WINDOW_S = 0.05;
const HOP_S = 0.04;

/**
 * Turns a stream of arbitrary-sized buffers into evenly spaced pitch points.
 * Buffers arrive at whatever size the hardware likes; YIN wants fixed windows.
 */
export class PitchTracker {
  private carry: Float32Array = new Float32Array(0);
  private consumed = 0;
  private rate = 0;
  private factor = 1;
  readonly points: PitchPoint[] = [];
  /** Total frames analysed, voiced or not. Zero after a run means no audio arrived. */
  frames = 0;

  push(buffer: ArrayLike<number>, sampleRate: number): PitchPoint[] {
    if (this.rate === 0) {
      this.factor = Math.max(1, Math.round(sampleRate / TARGET_RATE));
      this.rate = sampleRate / this.factor;
    }
    const fresh = decimate(buffer, this.factor);
    const joined = new Float32Array(this.carry.length + fresh.length);
    joined.set(this.carry, 0);
    joined.set(fresh, this.carry.length);

    const win = Math.round(this.rate * WINDOW_S);
    const hop = Math.round(this.rate * HOP_S);
    const added: PitchPoint[] = [];
    let start = 0;
    while (start + win <= joined.length) {
      const frame = joined.subarray(start, start + win);
      const t = (this.consumed + start + win / 2) / this.rate;
      this.frames++;
      const p = yin(frame, this.rate);
      if (p) {
        const point = { t, hz: p.hz, clarity: p.clarity };
        this.points.push(point);
        added.push(point);
      }
      start += hop;
    }
    this.carry = joined.slice(start);
    this.consumed += start;
    return added;
  }
}

/** Float32 PCM from an ArrayBuffer, mixed down to mono if it is interleaved. */
export function monoFloat(data: ArrayBuffer, channels: number): Float32Array {
  const raw = new Float32Array(data);
  if (channels <= 1) return raw;
  const out = new Float32Array(Math.floor(raw.length / channels));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += raw[i * channels + c]!;
    out[i] = sum / channels;
  }
  return out;
}
