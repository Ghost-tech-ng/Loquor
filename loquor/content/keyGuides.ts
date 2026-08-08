// In-app tutorials for getting each API key, shown behind the ⓘ next to each
// input. They live in the app rather than in a support link because the moment
// someone needs them is the moment they are standing in Settings with no key.

export type KeyGuide = {
  provider: "groq" | "anthropic" | "deepgram";
  name: string;
  what: string;
  cost: string;
  steps: string[];
  prefix: string;
  url: string;
};

export const KEY_GUIDES: KeyGuide[] = [
  {
    provider: "groq",
    name: "Groq",
    what: "Transcribes your audio and judges what you said. This is the free path — both jobs, one key.",
    cost: "Free tier, generous rate limits. No card required.",
    prefix: "gsk_",
    url: "console.groq.com/keys",
    steps: [
      "Open console.groq.com in a browser and sign in with Google or GitHub.",
      "In the left sidebar choose API Keys.",
      "Press Create API Key, name it Loquor, and press Submit.",
      "Copy the key immediately — Groq shows it once and never again.",
      "Paste it above. It starts with gsk_.",
    ],
  },
  {
    provider: "deepgram",
    name: "Deepgram",
    what:
      "Transcription only, and the reason to pay for it is one flag: Deepgram reports filler words explicitly. Whisper is trained to write clean prose and quietly deletes the \"um\"s you are trying to count.",
    cost: "$200 free credit on signup. A daily 90-second take costs well under $1 a month.",
    prefix: "",
    url: "console.deepgram.com",
    steps: [
      "Open console.deepgram.com and sign up — the free credit lands automatically.",
      "From the project dropdown, choose API Keys.",
      "Press Create a New API Key, give it the Member role, and set no expiry.",
      "Copy the key and paste it above.",
      "Your filler counts stop showing ≈ once this is active.",
    ],
  },
  {
    provider: "anthropic",
    name: "Anthropic",
    what:
      "Judges content only — clarity, specificity, structure, register, economy. Noticeably harder to please than the free judge, which is the point of paying for it.",
    cost: "Pay as you go. A 90-second take costs roughly a tenth of a cent.",
    prefix: "sk-ant-",
    url: "console.anthropic.com/settings/keys",
    steps: [
      "Open console.anthropic.com and sign in.",
      "Go to Settings, then API Keys.",
      "Press Create Key, name it Loquor, and copy it.",
      "Add credit under Billing — a new account has none, and the key returns an error until you do.",
      "Paste the key above. It starts with sk-ant-.",
    ],
  },
];

export const GUIDE_BY_PROVIDER: ReadonlyMap<KeyGuide["provider"], KeyGuide> = new Map(
  KEY_GUIDES.map((g) => [g.provider, g])
);
