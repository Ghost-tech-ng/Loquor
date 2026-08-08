# Phase 0 — de-risk before building anything

Four questions. Three of them can kill or reshape the product, so they get answered
before a single Arena screen is written.

| # | Question | Status | Blocked on |
|---|---|---|---|
| 1 | Does Whisper actually return filler words? | **harness ready, needs data** | your Groq key + 20 recordings |
| 2 | Can Expo Go record and upload audio on iOS? | **app ready, needs your phone** | scanning the QR |
| 3 | Does a permanent EAS Update link survive a restart? | **configured, needs project** | your Expo account |
| 4 | Is the round-trip under 3.5s? | measured by 1 and 2 | — |

---

## 1. STT filler recall — the go/no-go gate

Everything is in [`stt-spike/`](stt-spike/). Zero dependencies, runs on the Node 22
you already have. Full instructions in [`stt-spike/README.md`](stt-spike/README.md).

```powershell
cd phase0\stt-spike
# drop 20 recordings into audio\
node spike.mjs --init          # creates label stubs
# hand-label each one verbatim, um's included
$env:GROQ_API_KEY = "gsk_..."
node spike.mjs
```

**Why this one is first.** The Arena scorecard's headline number is `filler_rate`.
Whisper is trained to produce clean prose, which means it may be deleting the exact
tokens we're counting — and it will do so silently, producing a plausible-looking
number that is simply wrong. A speech-coaching app that quietly under-reports your
filler words is worse than no app.

**Outcome:**

- **≥ 80% recall** → Groq alone. One vendor, one key, $0/month, ship it.
- **< 80% recall** → Deepgram (`filler_words=true`) for Arena only; Groq keeps
  transcription elsewhere and all the judging. About **$0.65/month** at 5 sessions/day.
  This is the Precision mode already specified in PRD §6.2c, so the architecture
  absorbs it without a rewrite.

Either way the product ships. What changes is one line in the provider config and
whether the scorecard prints `4.2` or `≈4.2`.

The harness also measures three things you'd otherwise have to discover later:
whether a disfluency-priming `prompt` recovers any recall for free, whether word
timestamps come back at all (`pace`, `dead_air`, `hedge_density` all depend on them
and are *unaffected* by the filler problem), and p50/p95 transcription latency.

---

## 2. Expo Go audio — device smoke test

[`loquor-app/`](loquor-app/) is a real Expo SDK 54 app, pinned deliberately: App Store
Expo Go does not yet run SDK 55 on iOS.

**Verified on this machine already:** dependencies resolve against SDK 54,
`tsc --noEmit` passes under `strict` + `noUncheckedIndexedAccess`, and the iOS bundle
builds (2.59 MB Hermes bytecode).

**Not verified — needs your phone:**

```powershell
cd phase0\loquor-app
npm start
```

Scan the QR with the iPhone camera. The screen runs four checks live:

1. **Microphone permission** — proves `expo-audio` can ask, with no dev build.
2. **Recording produced a file** — guards against the zero-byte regression in
   expo/expo#39646.
3. **Live metering** — the amplitude bloom is the single highest-value animation in
   the product. If metering doesn't report, that interaction isn't buildable in
   Expo Go and the Record screen needs rethinking.
4. **Groq round-trip** — paste your key into the field, and it does a real multipart
   upload and prints latency plus the word-timestamp count.

Speak for ~20 seconds and put some `um`s in deliberately.

The key field writes to `expo-secure-store` and nowhere else. Device-local, never
uploaded, never logged — that's the whole point of BYOK, and it's enforced here from
the first commit rather than retrofitted.

---

## 3. Permanent Expo Go link — the pattern from your gym app

`eas.json` and `app.json` are configured. Two placeholders need your account:

```powershell
cd phase0\loquor-app
npx eas login
npx eas init                  # writes the real projectId into app.json
npx eas update --branch preview --message "phase 0 smoke test"
```

Then replace `PROJECT_ID_GOES_HERE` in `app.json` under `updates.url` — `eas init`
usually does this for you; check it landed.

`eas update` prints a QR and a channel link of the form
`https://qr.expo.dev/eas-update?projectId=…&channelId=…`. **That link is the permanent
one.** Scan it once, and from then on every `eas update` pushes new JS to the phone
with no rebuild and no re-scan.

**Confirm it properly:** scan it, force-quit Expo Go, restart the phone, open the link
again. If it still loads, the distribution model is proven and no iOS native build is
needed for v1.

Two constraints that come with this and are worth knowing now rather than in month
three:

- **No remote push notifications.** Removed from Expo Go in SDK 53+. Local and
  scheduled notifications still work, which covers the daily practice reminder. A
  server-triggered nudge needs a real build — that's a v2 decision.
- **SDK pinning.** Expo Go tracks the latest SDK. Roughly twice a year you'll spend
  half a day upgrading or the app stops opening. Budget it.

---

## 4. Latency budget

Falls out of 1 and 2. Target is **under 3.5s** from release-to-speak to scorecard.

| Stage | Budget |
|---|---|
| Upload (~1 MB over LTE) | 600ms |
| Groq transcription | 900ms |
| Judge (structured output) | 1200ms |
| Render | 200ms |
| Slack | 600ms |

The spike prints real p50/p95 for transcription; the device test prints real upload
time. If the total lands over ~5s, the fix is to fire transcription and judging as a
visible two-stage reveal — delivery metrics appear the moment the transcript lands,
substance scores fill in after — rather than making the user watch one spinner.
