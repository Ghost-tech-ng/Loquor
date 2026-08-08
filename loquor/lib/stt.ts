// Speech-to-text behind one interface.
//
// Phase 0 has not run yet, so we do not know whether Groq's filler recall clears
// 80%. Rather than block Phase 1 on that number, both providers are implemented
// and the choice is a setting. When the gate result arrives it changes a default,
// not an architecture.
//
// Every provider must return word-level timestamps. `pace`, `dead_air` and
// `hedge_density` are computed from timings alone and are unaffected by the
// filler question — losing timestamps would cost three metrics instead of one.

import type { Word } from "./metrics.ts";

export type Transcript = {
  text: string;
  words: Word[];
  durationS: number | null;
  latencyMs: number;
  provider: "groq" | "deepgram";
};

export class SttError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SttError";
  }
}

// Whisper's `prompt` biases decoding toward the style of the prompt text.
// Priming it with disfluent prose is the cheapest available defence against it
// silently cleaning up the exact tokens we are trying to count.
const DISFLUENCY_PRIMER =
  "Um, so I think, uh, the thing is — er, we should probably, um, look at it again. " +
  "Uh, hmm, right, and, um, that's, uh, sort of where I landed.";

export type TranscribeOptions = {
  /**
   * Overrides the disfluency primer. The Passage drill passes the text being
   * read, which biases decoding toward those words — the exact opposite of what
   * the Arena wants, and exactly right there: the question is whether the audio
   * supports this text, not what the audio might have been.
   *
   * Groq only. Deepgram has no equivalent parameter and ignores it.
   */
  prompt?: string;
};

export async function transcribe(
  uri: string,
  provider: "groq" | "deepgram",
  apiKey: string,
  opts: TranscribeOptions = {}
): Promise<Transcript> {
  if (!apiKey) throw new SttError(`No ${provider} API key. Add one in Settings.`);
  return provider === "groq" ? viaGroq(uri, apiKey, opts) : viaDeepgram(uri, apiKey);
}

async function viaGroq(uri: string, apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
  const form = new FormData();
  // React Native's FormData takes a file descriptor, not a Blob.
  form.append("file", { uri, name: "take.m4a", type: "audio/m4a" } as unknown as Blob);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("temperature", "0");
  // Whisper truncates the prompt to its last 224 tokens, so a long passage is
  // trimmed from the front — take the tail deliberately rather than discovering
  // it silently.
  form.append("prompt", (opts.prompt ?? DISFLUENCY_PRIMER).slice(-800));

  const t0 = Date.now();
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const latencyMs = Date.now() - t0;

  if (!res.ok) throw new SttError(await errorText(res, "Groq"), res.status);
  const json = (await res.json()) as {
    text?: string;
    duration?: number;
    words?: { word: string; start: number; end: number }[];
  };

  const words = (json.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end }));
  if (words.length === 0 && (json.text ?? "").trim().length > 0) {
    throw new SttError("Transcript came back without word timestamps — delivery metrics need them.");
  }

  return {
    text: json.text ?? "",
    words,
    durationS: json.duration ?? null,
    latencyMs,
    provider: "groq",
  };
}

async function viaDeepgram(uri: string, apiKey: string): Promise<Transcript> {
  // filler_words=true is the reason this provider exists: it is the only one of
  // the two that reports disfluencies as a first-class output rather than
  // incidentally leaving them in.
  const url =
    "https://api.deepgram.com/v1/listen" +
    "?model=nova-3&smart_format=true&filler_words=true&punctuate=true";

  const body = await fetch(uri).then((r) => r.blob());

  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "audio/m4a" },
    body,
  });
  const latencyMs = Date.now() - t0;

  if (!res.ok) throw new SttError(await errorText(res, "Deepgram"), res.status);
  const json = (await res.json()) as {
    metadata?: { duration?: number };
    results?: {
      channels?: {
        alternatives?: {
          transcript?: string;
          words?: { word: string; punctuated_word?: string; start: number; end: number }[];
        }[];
      }[];
    };
  };

  const alt = json.results?.channels?.[0]?.alternatives?.[0];
  const words = (alt?.words ?? []).map((w) => ({
    word: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
  }));

  return {
    text: alt?.transcript ?? "",
    words,
    durationS: json.metadata?.duration ?? null,
    latencyMs,
    provider: "deepgram",
  };
}

async function errorText(res: Response, vendor: string): Promise<string> {
  const body = await res.text().catch(() => "");
  if (res.status === 401) return `${vendor} rejected the API key. Check it in Settings.`;
  if (res.status === 429) return `${vendor} rate limit hit. Wait a moment and try again.`;
  return `${vendor} error ${res.status}. ${body.slice(0, 180)}`;
}
