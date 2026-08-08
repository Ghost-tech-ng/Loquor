// Provider settings and API key storage.
//
// Keys live in expo-secure-store and nowhere else: never AsyncStorage, never
// synced to a backend, never logged, never attached to an error report. The
// device is the only place a key exists. That is the entire point of BYOK, and
// it is easier to hold that line from the first commit than to retrofit it.

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Provider = "groq" | "anthropic" | "deepgram";
export type Mode = "free" | "precision" | "custom";

export type Settings = {
  mode: Mode;
  /** Only consulted in custom mode. */
  sttProvider: Extract<Provider, "groq" | "deepgram">;
  judgeProvider: Extract<Provider, "groq" | "anthropic">;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "free",
  sttProvider: "groq",
  judgeProvider: "groq",
};

const SETTINGS_KEY = "loquor.settings";
const keySlot = (p: Provider) => `loquor.key.${p}`;

// Preferences are not secrets, so they go in ordinary storage. Only the keys
// themselves get the secure enclave.
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function getKey(p: Provider): Promise<string | null> {
  return SecureStore.getItemAsync(keySlot(p));
}

export async function setKey(p: Provider, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    await SecureStore.deleteItemAsync(keySlot(p));
    return;
  }
  await SecureStore.setItemAsync(keySlot(p), trimmed);
}

/**
 * Seeds a key from `.env.local` into SecureStore, once, in dev only.
 *
 * This exists so a fresh install does not start with an unusable app while the
 * key is typed in by hand on a phone keyboard. Three things keep it from
 * becoming a hole in the BYOK model:
 *
 * `__DEV__` — a production bundle drops this branch, so an exported or
 * OTA-published bundle never carries the literal. That matters: `EXPO_PUBLIC_`
 * values are inlined at bundle time, and anything shipped over the update URL
 * is readable by whoever can fetch that bundle.
 *
 * It never overwrites. Whatever is in SecureStore wins, so a key entered or
 * cleared in Settings is not quietly resurrected on the next launch.
 *
 * SecureStore remains the only thing the app reads at runtime — nothing else in
 * the codebase touches `process.env` for a credential.
 */
export async function seedKeysFromEnv(): Promise<void> {
  if (!__DEV__) return;
  const seeds: [Provider, string | undefined][] = [
    ["groq", process.env.EXPO_PUBLIC_GROQ_KEY],
    ["anthropic", process.env.EXPO_PUBLIC_ANTHROPIC_KEY],
    ["deepgram", process.env.EXPO_PUBLIC_DEEPGRAM_KEY],
  ];
  for (const [provider, value] of seeds) {
    if (!value) continue;
    try {
      if (await getKey(provider)) continue;
      await setKey(provider, value);
    } catch {
      // A seed failing is never worth blocking startup for — the key can still
      // be entered in Settings, which is the supported path anyway.
    }
  }
}

/** `gsk_abc…4f2a` — enough to tell two keys apart, not enough to use one. */
export function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(8)}${key.slice(-4)}`;
}

/** Resolves the mode into concrete providers for this run. */
export function resolve(s: Settings): { stt: Settings["sttProvider"]; judge: Settings["judgeProvider"] } {
  switch (s.mode) {
    case "free":
      return { stt: "groq", judge: "groq" };
    case "precision":
      return { stt: "deepgram", judge: "anthropic" };
    case "custom":
      return { stt: s.sttProvider, judge: s.judgeProvider };
  }
}

/**
 * Whether filler counts from this provider should be printed with a `≈`.
 *
 * Whisper is trained to emit clean prose and drops disfluencies, so its filler
 * count is a floor, not a measurement. Deepgram flags them explicitly. Showing
 * `4.2` when the honest answer is `≈4.2` is the kind of small lie that makes a
 * 90-day trend worthless, so the provenance travels with the number.
 */
export function fillerCountIsApproximate(stt: Settings["sttProvider"]): boolean {
  return stt === "groq";
}
