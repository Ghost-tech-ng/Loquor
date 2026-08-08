# Loquor — Product Requirements Document

**Version:** 0.1 (pre-build)
**Author:** Eghosa
**Date:** 2026-08-08
**Status:** Design complete, not started

---

## 0. The Name

**Loquor** *(LOH-kwor)* — Latin, first person singular, present tense: **"I speak."**

Not a noun describing a skill, not an adjective describing a quality — a verb, in the first person, already happening. The root of *eloquent*, *colloquial*, *loquacious*, *interlocutor*. For a product whose entire thesis is *stop listening, start speaking*, a declarative "I speak" is the statement.

Near-zero collision in the speech-tech category. Two syllables. Known pronunciation risk: reads as "liquor" at a glance — mitigate with typography and a consistent `LOQVOR` / classical-inscription treatment in the wordmark.

**Tagline:** *I speak.* — or, longer: *Stop listening. Start landing.*

Avoid `Nuance` — direct trademark collision with Nuance Communications (Microsoft), same category.

### 0.1 Internal architecture: the five canons

Loquor is Latin, and so is the system beneath it. Cicero's five canons of rhetoric map 1:1 onto the five pillars in §4 — not approximately, exactly. Each pillar carries a canon name **internally** (in code, in the data model, in my own notes). Plain-English names stay in the UI so the app remains navigable.

| Pillar (UI) | Canon (internal) | Meaning |
|---|---|---|
| Playbook | `elenchus` | Socratic cross-examination — the question that exposes the weak joint |
| Lexicon | `elocutio` | Diction and word choice |
| Arena | `pronuntiatio` | Voice, pace, delivery — where fillers live |
| Persuasion Lab | `dispositio` | Arrangement of an argument (PREP, SCQA, Minto) |
| Rooms | `kairos` | Greek: *the opportune moment* — the right thing at the right time |

**Memoria** — the canon of retention — is deliberately not a pillar. It's the FSRS scheduler running underneath all five. That is architecturally correct: retention is infrastructure, not a feature.

The value here isn't decoration. Every competitor trains one canon (`pronuntiatio`) and calls it speaking practice. The gap in the market — and my actual gap — is `inventio`: *finding the thing worth saying*. Naming the parts correctly keeps that visible while building.

---

## 1. Problem Statement

I am a senior engineer who is under-contributing in rooms where I have the most context.

The failure is not knowledge. It's four separate, diagnosable gaps:

| # | Gap | What it looks like | Why existing apps miss it |
|---|-----|--------------------|---------------------------|
| G1 | **Retrieval failure** | I know "consensus," "hindsight," "in-house" — but under live pressure I reach for "the thing where everyone agrees." | Flashcard apps train *recognition*. Meetings demand *production*. Different memory. |
| G2 | **No question repertoire** | I listen well but rarely have the question that makes the room turn. | No app treats "insightful question" as a trainable pattern. It is one. |
| G3 | **Delivery noise** | Fillers, hedging ("I think maybe we could sort of…"), pace drift under pressure. | ELSA scores phonemes, not rhetorical delivery. |
| G4 | **Cold-start on unfamiliar topics** | Someone raises supply chain / monetary policy / org design and I go quiet. | Nothing trains "60 seconds of research → 90 seconds of coherent speech." |

**The meta-problem:** every existing app is a closed loop with itself. You practice in the app, you get better at the app. Nothing connects to the meeting you have at 2pm on Thursday. That disconnect is why 90% of language-app installs are dead in two weeks.

---

## 2. Product Thesis

> **Loquor is not a language app. It's a rehearsal-and-debrief loop wrapped around your actual working life.**

Three commitments that follow from that:

1. **Nothing counts until you say it out loud.** No tap-to-match, no multiple choice for mastery. Speech is the only input that advances progress.
2. **Every session points at a real room.** Prep before a real meeting, debrief after it. The app knows your calendar-shaped reality, not an abstract curriculum.
3. **Structure over vocabulary.** Words are the cheap part. The valuable, teachable assets are *question archetypes* and *argument scaffolds* — reusable shapes you can fill with any content.

**Non-goals (explicitly out of scope):**
- Accent reduction or "sounding native." I'm a fluent English speaker; this is register and delivery, not remediation.
- IELTS/TOEFL prep.
- Social feed, leaderboards, friend graph. Solo tool.
- Real-time live coaching *during* a real meeting (privacy, consent, and legal minefield; also technically infeasible in Expo Go).

---

## 3. Target User

**Primary (n=1, then n=many):** Me. Senior/lead engineer, 5+ yrs, non-native-context English speaker, technically excellent, under-visible in cross-functional rooms.

**Expansion cohort:** ICs at senior level who are passed over for staff/lead because "communication," plus consultants and founders who must sound credible on domains they researched an hour ago.

**Jobs to be done:**
- *When I'm in a design review, I want a question ready that reframes the discussion, so I'm seen as a thinker not a coder.*
- *When someone uses a word I half-know, I want to own it by Friday, so my register rises without sounding like a thesaurus.*
- *When I meet someone at a conference, I want to skip weather-talk and get to substance in 30 seconds, so the connection is actually worth something.*

---

## 4. The Five Pillars (feature architecture)

Each pillar maps 1:1 to a stated goal. Nothing else ships.

### Pillar 1 — The Lexicon (vocabulary → production)

**Not a flashcard deck. A production drill.**

- **Corpus: "The Register 600."** Curated mid-frequency professional words — the tier you recognize but never deploy. Seeds: *nuance, hindsight, in-house, consensus, tractable, marginal, downstream, precedent, contingent, orthogonal, tenable, bandwidth (fig.), attrition, mandate, latitude, salient, provisional, incremental, defer, converge, granular, scope creep, second-order, load-bearing, non-trivial…*
  Explicit exclusion filter: no SAT/GRE ornamental words (*perspicacious*, *ineluctable*). If it would sound like showing off in a standup, it's cut.
- **Every word ships with four fields, not one:**
  1. Meaning in one line
  2. **Collocations** — the words it actually travels with (*"reach consensus," "in hindsight," "keep it in-house"*)
  3. **Deployment slot** — where it belongs (*"use in a standup when scoping"*)
  4. **Anti-pattern** — how it's misused (*"'nuance' is not a synonym for 'detail'"*)
- **Speak-to-unlock:** a word enters your active set only after you speak an original sentence using it, in a given context prompt, and the LLM judge scores it plausible. Three quality gates: correct sense, natural collocation, contextually appropriate register.
- **Dual memory state per word.** FSRS scheduler runs *two independent tracks*: `recognition_strength` and `production_strength`. Only production counts toward mastery. This is the direct architectural answer to G1 and the thing no competitor does.
- **Word of the Day is a challenge, not a card:** "Deploy `contingent` in a real conversation today." Tap to confirm you used it → biggest possible scheduling boost.

#### 1b — The Reading (read-aloud) — *added after Phase 1, reworked in Phase 2*

Every other drill in this product has the user **generate** language. None had them **execute** written language, which quietly dropped "fluency in speech and pronunciation" from the original brief. The Reading closes that.

- **Form:** a ~1,400-word piece of real prose — a history, an argument, an explanation — carrying 24 Register-600 targets in natural collocation. Ten minutes aloud at a measured 130 wpm. It never defines its own vocabulary: meaning is carried by use, so reading it teaches sense and usage rather than a definition list.
- **Why long-form, and why not longer per take.** The first cut of this drill was 130-word paragraphs. They were a minute each, they read like exercises, and a minute never reaches the point where the voice tires and phrasing collapses — which is the part worth training. So the material is now genuinely worth reading on its own terms, and each piece is split into **six sections of ~230 words, one recording each**. A ten-minute single take is a bad unit: one cough at minute nine costs the whole thing, the upload is large, the alignment table is 25× bigger on a phone, and the feedback arrives long after you have forgotten saying the words.
- **Content bar:** if the reader learned nothing but the vocabulary, the piece failed. Two of the four v0.2 readings map straight onto the stated aims — how meetings actually allocate attention in the first ninety seconds, and the Semmelweis case as a study in *being right is a claim about the world, being persuasive is a claim about people*.
- **Scoring is entirely deterministic — no LLM anywhere in the drill.** Because the reference text is known, the transcript can be word-aligned against it (Levenshtein with backtrace). Each reference word comes back *clean*, *altered* (with what was heard instead), or *missed*. Target words are scored separately from the section as a whole.
- **Delivery metrics come free and are sharper here than in the Arena:** pace against a 120–150 wpm read band, phrasing (punctuation marks actually breathed at), and hesitation (long gaps at positions with *no* punctuation — searching, not phrasing).
- **Stated limitation, surfaced in the UI:** Whisper is trained to be robust to accent and will repair a mangled word from context. A word returned wrong is strong evidence of a stumble; a word returned right is weak evidence of correct pronunciation. This ships as a **stumble detector, not a pronunciation score** — ELSA Speak's phoneme scoring is still out of scope, and claiming otherwise would be a lie the user could feel.
- **Whisper's `prompt` is inverted for this drill:** the Arena primes with disfluent prose to stop fillers being deleted; the Reading primes with the section text itself, because the question here is whether the audio supports *this* text. (The Lexicon's speak-to-unlock passes no prompt at all — naming the expected word would defeat the test.)
- **Handoff into the Arena and the Lexicon:** reading targets overlap the `loadedTerms` on Arena topics, and a target read aloud cleanly grades the word's *recognition* card. You read a word on Monday and are expected to deploy it on Tuesday. Reading it can never move the production track — only saying it unprompted does that.

### Pillar 2 — The Question Playbook (contribute & be noticed)

**The core intellectual asset of the product.** ~30 named, reusable question archetypes. You learn the *shape*, then fill it with whatever's in the room.

Starter set:

| Archetype | Form | When it lands |
|---|---|---|
| Assumption Probe | "What has to be true for that to work?" | Someone's plan sounds confident but untested |
| Tradeoff Surfacer | "What are we giving up by doing it that way?" | Decision presented as free |
| Second-Order | "If this works, what breaks downstream?" | Optimistic proposals |
| Definition Check | "When you say *scalable*, do you mean A or B?" | Ambiguous term doing heavy lifting |
| Falsifier | "What would we see if this were wrong?" | Untestable claims |
| Scope Narrow | "Is that generally true, or just for this case?" | Overgeneralization |
| Reversibility | "How expensive is it to undo?" | Risk framing |
| Constraint Reveal | "What's actually stopping us — is it technical or is it approval?" | Stuck discussions |
| Steel-man | "The strongest case for the other option is X — how do we answer it?" | You want to look fair and sharp simultaneously |
| Cost of Delay | "What does waiting a quarter cost us?" | Bias toward inaction |

Training loop: app plays/shows a 60–90 second scenario (a meeting transcript snippet, often a real-ish software/AI scenario). You have 15 seconds, then you **speak your question aloud**. Judged on: archetype correctness, specificity to the scenario, brevity, and whether it opens the discussion or closes it.

### Pillar 3 — The Arena (fluency, fillers, cold topics)

The daily 4-minute core loop.

1. **Topic drops.** 50% inside your field (distributed consensus, model eval, cost of GPU inference, on-call design), 50% deliberately outside (monetary policy, urban zoning, shipping logistics, sleep architecture, insurance underwriting). *No knowledge is wasted.*
2. **60-second primer.** Three bullets + two loaded terms. This literally trains "speak on a random topic after minor research."
3. **90-second monologue.** Push-to-talk. One take. No re-records on the first attempt.
4. **Scorecard:**
   - `filler_rate` (per min) — **target ≤ 5.0**, warning at 8, red at 12 *(grounded in disfluency-perception research; zero is not the goal)*
   - `pace` (WPM) — target band 130–165
   - `hedge_density` — "I think / maybe / sort of / kind of / just" per 100 words
   - `target_words_deployed` — which scheduled Lexicon words you actually used (huge scheduler bonus)
   - `structure_detected` — did the monologue follow a recognizable scaffold (PREP / SCQA / claim-evidence-implication)?
   - `dead_air` — pauses > 2.5s
5. **The Rewrite.** App shows your transcript with fillers struck and offers one tighter version of your weakest sentence. You re-record just that sentence. This 20-second move is where most of the improvement actually comes from.

### Pillar 4 — Rooms (prep → debrief; the retention engine)

**The differentiator. Ship this in v1 or the app is just another Duolingo.**

**Before a real meeting** (30 seconds of input):
> "Design review, 3pm, we're deciding Postgres vs DynamoDB for the events table."

Loquor returns a one-screen **Prep Card**:
- 3 questions you could ask, drawn from archetypes you're currently weak on
- 2 Lexicon words due for review that naturally fit this topic
- 1 argument scaffold if you're pushing a position
- 1 line of "the thing nobody will say out loud"

**After the meeting** (90-second voice debrief):
> "Did you speak? What did you actually say? What did you wish you'd said?"

The app transcribes, extracts what you contributed, scores **contribution** (not delivery), and — critically — feeds the gap between *what you said* and *what you wished you'd said* back into tomorrow's drills. That gap is the highest-signal training data in the entire product.

**Contribution Score** (weekly, the app's headline metric):
`rooms_entered` → `times_spoke` → `questions_asked` → `positions_taken` → `moments_where_the_room_turned` (self-reported, 1 tap)

### Pillar 5 — The Persuasion Lab (influence, convince, networking)

Two drill families.

**A. Argument scaffolds** — drilled as *spoken* templates under a 60s timer:
- **PREP** — Point, Reason, Example, Point
- **SCQA** (Minto) — Situation, Complication, Question, Answer. The single highest-leverage structure for exec audiences.
- **Concede-and-Narrow** — "You're right that X. The question is whether that applies here, because…" The most useful move in engineering disagreements.
- **Steel-man-then-turn** — state their case better than they can, then pivot.
- **Bottom-Line-Up-Front** — answer first, reasoning after. Trained against my natural instinct to build up to the point.

**B. Networking without small talk:**
- **The Substance Opener** — a specific observation instead of "so what do you do?" (*"You mentioned you're on the payments team — what's the part of that everyone underestimates?"*)
- **The Ladder** — role → problem → opinion, in three moves, in under 60 seconds
- **The Hard Question** — "What's the hardest part of that?" — near-universal small-talk escape hatch
- **The Handoff** — closing a conversation so it continues later

Drill format: app role-plays the counterpart via voice. You get 3 turns to get from cold open to substance. Scored on turns-to-substance and whether you asked more than you told.

---

## 5. Scoring Rubric (the LLM judge)

Every spoken artifact is scored on a shared 0–4 rubric so progress is comparable across pillars.

| Dimension | 0 | 2 | 4 |
|---|---|---|---|
| **Clarity** | Point never lands | Point lands late | Point lands in first sentence |
| **Specificity** | Generic, could be about anything | Some concrete detail | Named, falsifiable, tied to context |
| **Structure** | Rambling | Loose order | Recognizable scaffold |
| **Register** | Wrong level (too casual/too ornate) | Serviceable | Precise, professional, unforced |
| **Economy** | 2x longer than needed | Some padding | Tight |

Delivery metrics (`filler_rate`, `pace`, `hedge_density`, `dead_air`) are computed deterministically from the transcript + timestamps, **not** by the LLM. Keeps them cheap, stable, and trustworthy over time. The LLM only judges content.

---

## 6. Technical Design

### 6.1 Hard constraint: Expo Go

**This is the single most important engineering constraint and it shapes everything.**

Expo Go runs only the native modules bundled into the Expo Go binary. No custom native modules, no prebuild, no config plugins requiring a new binary. Therefore:

| Wanted | Available in Expo Go? | Decision |
|---|---|---|
| On-device streaming ASR (`expo-speech-recognition`, `expo-stt`) | ❌ Requires dev build | **Cut from v1.** Server-side STT instead. |
| Real-time VAD / live filler detection while speaking | ❌ Needs native audio taps | **Cut.** Post-hoc analysis only. |
| Audio recording to file (`expo-audio`) | ✅ | **Core input path.** |
| TTS (`expo-speech`) | ✅ | v1 voice output. |
| Streamed audio playback of server-generated TTS | ✅ via `expo-audio` | v1.5 upgrade for better voices. |

**Consequence:** v1 is **turn-based push-to-talk**, not continuous conversation. Record → upload → transcribe → judge → respond. Target round-trip **< 3.5s**. This is a genuine product limitation, and it's acceptable — the drills are all turn-based by design anyway. Continuous conversation is a v3 feature gated on moving to a dev build.

*Known issue to verify on day 1:* `expo-audio` on SDK 54 Android has a reported zero-byte-recording regression (expo/expo#39646). iOS-first target, so low risk, but pin the SDK and smoke-test recording before building anything else.

### 6.1a Distribution: permanent Expo Go install, no native build

**Decision: no iOS build required for v1.** The app lives permanently in Expo Go on my iPhone, served over-the-air, talking to a live hosted backend.

**Mechanism — EAS Update (the same pattern as the gym app):**

1. Project published to an EAS Update branch/channel (e.g. `production`).
2. A permanent QR/deep link is generated against the **channel ID**, not a build — `https://qr.expo.dev/eas-update?projectId=<id>&channelId=<id>`. That link always resolves to the latest update on that channel.
3. Expo Go opens it. It stays in Expo Go's "Recently opened" list, so it's one tap, always.
4. `eas update` ships new JS/assets over the air. No rebuild, no reinstall, no App Store.
5. Backend (FastAPI + Postgres) runs on a real host, so data is live and persistent across devices and reinstalls. Nothing lives only on the phone.

**This works only because the client stays inside Expo Go's bundled module set** — `expo-audio`, `expo-speech`, `expo-router`, `expo-secure-store`, plus `fetch`. Every AI capability is server-side by design, which is what makes the constraint survivable. **Hard rule for v1: if a feature needs a config plugin or a custom native module, it does not go in v1.**

**Two things that genuinely bite:**

| Constraint | Impact | Handling |
|---|---|---|
| **Remote push notifications do not work in Expo Go** as of SDK 53+ — `expo-notifications` push was removed. **Local/scheduled notifications still work.** | Can't send server-triggered nudges ("your 3pm design review — here's your Prep Card"). | v1 uses **locally scheduled notifications only** — daily drill reminder, and a Room reminder scheduled on-device at the time I create the Room. This covers ~90% of the need. Server-push is a v2 feature and is *the* most likely reason to eventually build. |
| **Expo Go only runs the SDK version it ships with.** When Expo Go auto-updates to a new SDK, an older-SDK project stops opening until upgraded. Also, App Store Expo Go lags the newest SDK — SDK 55 currently isn't supported by the store build of Expo Go on iOS. | "Permanent" is really "permanent until the next SDK bump." | **Pin to SDK 54** (current App Store Expo Go support). Budget a half-day SDK upgrade roughly every ~6 months. Do not chase the newest SDK. |

**When I would actually need a native iOS build (TestFlight / dev build):**
- Server-triggered push notifications *(most likely trigger — v2)*
- On-device streaming ASR for sub-second latency *(v3, already deferred)*
- Background microphone or audio session control
- Distributing to anyone who isn't me
- Custom app icon, splash, and a standalone home-screen presence

None of those are v1. **Build in Expo Go, and treat the first native build as a v2 decision driven by push notifications — not something to solve now.**

### 6.2 Stack

**Client** — Expo SDK 54, React Native, TypeScript **strict** (no `any`), expo-router, Zustand, NativeWind, expo-audio, expo-speech, expo-secure-store, expo-notifications.

**Backend** — FastAPI (Python 3.12), Pydantic v2 models on every endpoint, PostgreSQL 16, Redis (session state + job queue), Docker Compose → single VPS or Cloud Run. Type hints on all functions.

### 6.2a AI layer — Groq (BYOK)

**Provider decision: Groq**, with the user's own API key entered in app Settings and stored in `expo-secure-store`.

Three distinct AI jobs. None of them involve training a model — this is API integration end to end.

| # | Job | Model | When |
|---|---|---|---|
| 1 | **Transcription** — speech → text + word timestamps | `whisper-large-v3-turbo` | Every recording, real time |
| 2 | **Judgement** — rubric scoring, question quality, debrief extraction | `gpt-oss-120b` or `llama-4-scout` w/ Structured Outputs | Every recording, real time |
| 3 | **Content generation** — topics, primers, scenarios, Prep Cards | `gpt-oss-120b` | Batched offline, nightly |

**Why Groq fits unusually well:**
- **Cost is effectively zero.** Whisper v3 Turbo is $0.04/hour of audio, and the free tier covers 28,800 audio-seconds/day. Realistic solo usage is ~300s/day — roughly **96x of headroom inside the free tier.** LLM judging adds a few thousand tokens per session. This app plausibly runs at $0/month.
- **Latency.** Groq's whole value proposition is inference speed, which is exactly the constraint the Expo Go turn-based design is fighting. It buys back the round-trip budget lost to upload.
- **Structured Outputs with strict JSON Schema and constrained decoding.** The rubric judge returns a guaranteed-conformant object — no parse failures, no "the model returned prose today." For a scoring system that must stay stable across months of trend data, this matters more than model quality.
- **Word-level timestamps** via `timestamp_granularities: ["word"]`.

**⚠️ The one real problem: Groq's Whisper is still Whisper, and Whisper strips disfluencies.** Its training objective normalizes "um" and "uh" out of the transcript. Choosing Groq does not fix the critical risk flagged in §10 — it slightly *sharpens* it, since Groq has no Deepgram-style disfluency flag.

**But the blast radius is smaller than it first appears.** Of the four delivery metrics, three survive intact on word timestamps alone:

| Metric | Source | Safe on Groq Whisper? |
|---|---|---|
| `pace` (WPM) | word timestamps | ✅ |
| `dead_air` (>2.5s gaps) | word timestamps | ✅ |
| `hedge_density` | ordinary words — *"I think," "maybe," "sort of," "just"* — never stripped | ✅ |
| `filler_rate` | disfluencies | ⚠️ **at risk** |

So exactly one metric is exposed. Mitigation ladder, in order:

1. `prompt` parameter (224-token max) seeded with filler-dense example text to bias toward verbatim output, plus `temperature: 0`. **Test first.**
2. If recall is poor, **hybrid**: Deepgram for Arena recordings only (explicit disfluency flags), Groq for everything else. Adds a second provider but keeps the cost and latency win on 90% of calls.
3. Detect long unlabeled gaps between words as *proxy* fillers — a filled pause still consumes time even when transcribed as silence. Weakest option, but free.

**Phase 0 validation gate:** record 20 samples, hand-label every filler, measure recall against Groq Whisper. **≥80% recall → ship on Groq alone. <80% → go hybrid.** Do not build the scorecard before this number exists.

### 6.2b Architecture consequence of BYOK

Putting the key in app Settings means **the client calls Groq directly** — the backend never proxies AI traffic. This is a deliberate simplification:

```
Phone ──audio──> Groq (STT + judge)      # direct, user's key, no proxy hop
Phone ──data───> FastAPI ──> Postgres    # persistence, scheduling, sync
Cron  ──batch──> Groq ──> content table  # nightly generation, server key
```

- **Pro:** no proxy latency, no server-side audio handling, no key management for a service with one user, and audio never touches my own infrastructure — which is also the cleanest possible answer to the privacy risk in §10.
- **Con:** the key sits on-device (mitigated by `expo-secure-store`), and client-side calls can't be rate-limited centrally. Both acceptable for a single-user app.
- **v1 backend scope shrinks to:** auth, persistence, FSRS scheduling state, and the nightly content job. That's a small FastAPI service, buildable in days.
- **If Loquor ever ships to other people,** AI calls move behind the backend and BYOK becomes optional. Design the client's AI calls behind a single `AiClient` interface now so that swap is a one-file change later.

### 6.2c Provider switching (Settings)

**Principle: providers are a runtime setting, not a build-time decision.** The vendor question in §6.2a is genuinely undecided until real measurements exist, so the app must let me flip providers without a rebuild — especially given Expo Go, where "rebuild" means an OTA cycle.

#### Mode selector

A top-level segmented control with two presets and an escape hatch:

| Mode | STT | Judge | Generation | Est. cost |
|---|---|---|---|---|
| **Free** *(default)* | Groq `whisper-large-v3-turbo` | Groq `gpt-oss-120b` | Groq | **$0/mo** |
| **Precision** | Deepgram `nova-3` | `claude-sonnet-5` | Groq | **~$2.50/mo** |
| **Custom** | per-job picker | per-job picker | per-job picker | computed |

Each mode row shows a one-line honest tradeoff, not marketing:

- **Free** — "Runs entirely on Groq's free tier. Filler counts are estimated — Whisper tends to drop 'um' and 'uh'."
- **Precision** — "Deepgram detects filler words directly. Claude gives sharper feedback on your questions. About the price of one coffee per month."

**Custom** expands to three independent job → provider pickers, backing the provider-per-job recommendation. Only providers with a validated key are selectable; the rest are shown disabled with "Add a key to enable."

#### Key inputs

Three fields — **Groq**, **Anthropic**, **Deepgram** — each with:

- Secure text entry, masked after save (`gsk_••••••••4f2a`)
- **ⓘ info icon** → opens the tutorial sheet (below)
- **Test** button → live validation call, resolving to ✅ valid / ❌ invalid / ⚠️ no credit
- Format pre-check before any network call: Groq `gsk_…`, Anthropic `sk-ant-…`, Deepgram is an unprefixed token
- **Clear key** with confirm

**Storage:** `expo-secure-store` only. Never `AsyncStorage`, never synced to the backend, never logged, never included in error reports. Keys are device-local — that's the whole point of BYOK.

#### Failure behaviour

Never hard-fail a drill because of a provider problem. If the selected provider is missing a key, rate-limited, or errors:

1. Silently fall back to any working provider for that job (Free mode is always the fallback floor).
2. Show a **non-blocking banner**: "Used Groq for this session — Deepgram key is invalid."
3. Persist which provider actually produced each result on the `utterances` row, so trend data is never silently mixed across providers.

#### Metric honesty

When `filler_rate` was produced by Whisper-family STT, it renders with an **`≈` prefix and a tappable footnote** ("Estimated — this model may under-count filler words. Switch to Precision mode for direct detection."). Deepgram-sourced counts render as exact.

This costs one character on screen and preserves the core promise of §12 — Loquor is an instrument, and an instrument that fakes precision it doesn't have is worthless.

---

### 6.2d API key tutorials (in-app content)

Each ⓘ icon opens a bottom sheet. Same structure for all three: what it costs → numbered steps → a button that opens the console in a browser → what the key looks like. Written to be followed on a phone, one hand, in under two minutes.

**Groq** — *Free. No card required.*
1. Open `console.groq.com` and sign in with Google or GitHub.
2. Open **API Keys** in the left sidebar.
3. Tap **Create API Key**, name it "Loquor."
4. Copy it immediately — it's shown only once.
5. Paste below. Starts with `gsk_`.

> Groq's free tier covers about 8 hours of audio per day. You'll use roughly 5 minutes. You will not hit the limit.

**Anthropic** — *Paid. Requires a card. ~$2/month at your usage.*
1. Open `console.anthropic.com` and create an account.
2. Go to **Billing** and add a payment method, then buy the minimum credit.
3. Go to **API Keys** → **Create Key**, name it "Loquor."
4. Copy it immediately — shown only once.
5. Paste below. Starts with `sk-ant-`.

> Only used for judging your questions and monologues. Roughly 2,000 tokens per session — about $2/month for daily use. Set a spend limit in Billing if you want a hard ceiling.

**Deepgram** — *Free signup credit, then paid. ~$0.65/month at your usage.*
1. Open `console.deepgram.com` and create an account.
2. Signup includes free credit — check the current amount on the dashboard; it typically covers months of solo use.
3. Go to **API Keys** → **Create a New API Key**, name it "Loquor."
4. Copy it immediately — shown only once.
5. Paste below. No prefix — it's a plain token.

> This is the only provider that detects filler words directly instead of estimating them. If the filler count is the number you care most about, this is the key worth adding.

Tutorial copy lives in a local constants file, not fetched — it must work offline and on first run before any key exists.

### 6.3 Data model (core tables)

```
users            id, tz, target_filler_rate, weekly_goal, streak
words            id, lemma, definition, collocations[], slot, anti_pattern, tier
word_states      user_id, word_id, recognition_stability, recognition_difficulty,
                 production_stability, production_difficulty, due_at, lapses,
                 first_produced_at, used_in_real_life_count
archetypes       id, name, form, when_to_use, examples[]
archetype_states user_id, archetype_id, production_stability, due_at
sessions         id, user_id, pillar, started_at, duration_s
utterances       id, session_id, audio_uri, transcript, words[] (w/ timestamps),
                 filler_rate, wpm, hedge_density, dead_air_s, rubric_json
rooms            id, user_id, title, context, scheduled_at, prep_card_json
room_debriefs    room_id, transcript, spoke_bool, questions_asked,
                 positions_taken, wished_i_said, contribution_score
topics           id, title, domain(field|random), primer_json, loaded_terms[]
```

### 6.4 Scheduling algorithm

FSRS-5 (Anki's current default; better-calibrated than SM-2) with these modifications:

- Two independent memory states per item (recognition / production), as above.
- **Real-life usage is the strongest possible review signal** — confirming you used a word in an actual conversation applies a larger stability boost than any in-app rep. This is deliberate: it makes the app push you *out* of itself.
- Interleaving is enforced — never two items from the same semantic cluster back to back.
- Daily budget cap so a heavy day never produces a 45-minute queue and a broken streak.

---

## 7. Screens (v1)

| Screen | Purpose |
|---|---|
| **Today** | One card: today's Arena topic + due Lexicon words + any Room prep/debrief pending. Single primary CTA — never a menu. |
| **Arena** | Primer → record → scorecard → Rewrite. The 4-minute loop. |
| **Lexicon** | Due queue, speak-to-unlock, word detail (4 fields), "used it in real life" tap. |
| **Playbook** | Archetype list + scenario drill. |
| **Rooms** | Add room, Prep Card, post-meeting debrief recorder. |
| **Progress** | Filler rate trend, WPM band, words produced (not "learned"), Contribution Score, weekly synthesis. |

Design principle: **one decision per screen.** The app's job is to remove deliberation, because deliberation is where daily habits die.

---

## 8. Success Metrics

**Leading (behavior):**
- ≥ 5 Arena sessions/week
- ≥ 3 Rooms prepped/week (this is the real adoption signal — if Rooms goes unused, the loop is broken and the product is failing)
- ≥ 8 words/week reaching first production

**Lagging (outcome — 90 days):**
| Metric | Baseline (measure week 1) | 90-day target |
|---|---|---|
| Filler rate | TBD (likely 9–14/min) | ≤ 5.0/min |
| Hedge density | TBD | −50% |
| Active production vocabulary | TBD | +150 words |
| Contribution Score | TBD | 2x |
| Self-rated "I said the thing I wanted to say" | TBD | ≥ 4/5 avg |

**The real test, unmeasurable but decisive:** in 90 days, do people start directing questions *to* me in meetings?

---

## 9. Roadmap

**Phase 0 — De-risk (2–3 days, before any UI)**
- Spike STT: verify a provider returns fillers + word timestamps at acceptable cost/latency. **Go/no-go for the entire product.**
- Smoke-test `expo-audio` record → upload round-trip in Expo Go on iOS (SDK 54, pinned).
- Publish a throwaway `eas update` to a channel, confirm the permanent QR/channel link opens in Expo Go and survives a phone restart. Establishes the distribution path before any real code depends on it.
- Benchmark full round-trip latency budget.

**Phase 1 — The Arena (v0.1)**
Record → transcribe → deterministic delivery metrics → scorecard → Rewrite. 60 seeded topics. No auth (local user). This alone is usable daily and validates the loop.

**Phase 1.5 — The Passage (v0.1.1) — shipped, then superseded**
Read-aloud drill: 8 passages of 110–150 words, 48 glossed target words, deterministic alignment scoring, phrasing and hesitation metrics. Added because §5.1b was missing from the original pillar set. The scoring engine survived intact; the *material* did not — a minute of authored sentences read as an exercise rather than as something worth reading, so Phase 2 replaced the corpus (see below) without touching `lib/reading.ts`.

**Phase 2 — The Lexicon (v0.2) — shipped**
- Four ~1,400-word readings (≥10 minutes aloud), each in six ~230-word recorded sections, carrying 96 targets. Today prefers an unfinished reading over the daily rotation, so a piece gets completed rather than abandoned.
- 98-entry glossary; readings and Lexicon entries share one four-field shape, so a word read aloud enters the recognition track without being re-authored.
- Stock FSRS-5 (`lib/fsrs.ts`, published weights, unmodified) on two independent cards per word — recognition and production.
- Speak-to-unlock: three independent boolean gates (sense, collocation, register) rather than a blended score, because the three failures need three different repairs.
- Word of the Day with hand-logged real-world use, credited as a stability multiplier with a floor.
- Track separation is structural, not conventional: the Reading can only call `gradeRecognition`; only `gradeProduction` and `confirmRealUse` can move production.
- Content tests ship with the corpus (`lib/reading.test.mjs`) because authored material fails silently: every target must resolve in its section, have a glossary entry, and every reading must clear ten minutes.

**Deferred out of Phase 2:** the corpus is 98 words, not 600. Authoring the remaining ~500 is content work, not engineering — the scheduler, the gates and the queue do not change when it grows.

**Phase 3 — Rooms (v0.3) — shipped**
- A room is a title, a decision on the table, and a time. No attendees, no notes, no agenda, and no way to record — Loquor never records a real meeting, and the table that touches other people holds nothing about them.
- The Prep Card is built at creation, not at open time: three questions from three different families (weakest-first, avoiding moves already solid), one scaffold, one intention. A card that quietly changed between prepping and walking in would be worse than no card.
- Voice debrief, not typed. Typing invites editing, and an edited account of a meeting is the account you wish were true. `lib/roomJudge.ts` extracts rather than evaluates, and gates the counts on `spoke` so the funnel can never inherit a self-contradiction.
- Contribution Score is a **funnel, not a number out of a hundred**: rooms entered → spoke → questions → positions → turned it, with the bottleneck named. Rooms *entered* counts rooms that happened and were debriefed, so planning cannot inflate the headline metric.
- Reminders are local `expo-notifications` (15 min before, 45 min after). Remote push does not work in Expo Go SDK 53+, and a push server would be infrastructure in exchange for nothing.
- **Deviation from this plan, deliberate:** no backend auth, Postgres or sync. The app is single-user with device-local BYOK keys; a backend would add a deploy target, a second language and a hosting bill for zero functional gain. The `rooms` table mirrors the intended Postgres shape, so sync stays a purely additive later step.

**Phase 4 — Playbook + Persuasion Lab (v0.4) — shipped**
- 30 archetypes across the families, 16 meeting snippets. Archetype and snippet are chosen **independently** — pairing each move with the meeting it suits would teach that the move belongs there, and the skill is reaching for it anywhere. `fits` is a hint to the judge, never a filter.
- The question verdict returns `likely_reply`: what the room would say back. A score says the question was weak; a plausible deflection shows *how*, and the lesson arrives as a consequence rather than a rating.
- Scaffolds are scored **per step**, not as an argument. "That was unconvincing" cannot be practised; "you had a point and a reason but never gave an example" can. Order is scored separately and carries a penalty.
- Networking role-play: six counterparts, each guarding one genuinely interesting thing. The only warm model in the app (temp 0.8). Measured on turns-to-substance and asked-vs-told, both computed on-device from the transcript, not asked of the judge.
- Skill tracking is deliberately **not FSRS**: an archetype is a motion that improves with reps, not a memory that decays, so `skill` stores an EWMA and an attempt count with no schedule (`lib/coach.ts`, 24 tests).

**Phase 5 — Polish (v1.0) — shipped**
- **Progress** is the only screen that looks backwards, and it leads with density over 28 days — "19 of 28 days" — not with the streak. A streak rewards not breaking a chain, and the cheapest way to protect a chain is a thirty-second take that teaches nothing. The current run is a secondary line; PRD §12 forbids the flame and it is not there.
- **The baseline** (`app/onboarding.tsx`) is ninety seconds on a fixed, unrerollable prompt, recorded exactly once — enforced in the screen and by `id = 1` in the table. It stores delivery only: no model reads it, because there is nothing to score before the app has taught anything. Every row of the ninety-day table is measured from it.
- **The weekly read** is the only model call on Progress, and it is an opt-in tap — nothing on this screen calls a model on mount. The synthesis is given already-computed figures, never transcripts. It reads the week that *ended*, so the cache key is last week's; a brand-new user gets a "week in progress" report that is deliberately **not** filed, because cached it would be read next Monday as a report on a week it only saw half of.
- **Self-rating survives regeneration.** `saveReport` upserts the four report columns via `ON CONFLICT` rather than `INSERT OR REPLACE` — the rating can be given before the report exists, and it is the one figure on the screen the user reported themselves.
- **Two repeating local reminders** (daily practice, weekly read) from a small fixed set of preset times rather than a wheel picker. The exact minute does not decide whether a habit sticks, and a free picker is one more decision on a screen whose job is to have as few as possible (§7). No new dependency was added for it.
- **Honest nulls throughout.** Every aggregate is `null` rather than `0` with no data behind it. The Contribution row's baseline stays permanently `null` with a note rather than fabricating a 2×-of-zero target, and free-provider filler figures still print with `≈` until the Phase 0 recall gate clears.

**v1.0 verification:** `tsc --noEmit` clean, 97/97 unit tests, `expo export --platform ios` succeeds (3.49 MB Hermes bundle). **Not yet done:** the Phase 0 filler-recall gate and a hardware smoke test in Expo Go.

**Post-v1 (requires dev build, exits Expo Go):** on-device streaming ASR, live latency <800ms, continuous conversation partner, optional Whisper-on-device for privacy.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| STT strips fillers → core metric is garbage | 🔴 Critical | Phase 0 spike. Provider with explicit disfluency support. Manual-label 20 samples to validate accuracy before trusting the number. |
| Expo Go latency makes drills feel sluggish | 🟠 High | Turn-based design accepts it. Pre-generate content. Optimistic UI. Budget <3.5s and measure. |
| I build it and don't use it | 🔴 Critical | Rooms pillar is the entire answer — tie the app to real meetings. If Rooms isn't used by week 3, the thesis is wrong; stop and rethink rather than adding features. |
| LLM judge scores are noisy/inconsistent | 🟠 High | Deterministic metrics stay out of the LLM. Fixed rubric + few-shot anchors + temperature 0. Spot-check weekly. |
| Corpus authoring is a slog (600 words × 4 fields) | 🟡 Medium | LLM-generate, human-review in batches of 50. Ship at 150. |
| Cost per session | 🟡 Medium | Batch generation offline; STT is the main variable cost (~$0.005/min). Budget ~$4/mo solo use. |
| Expo Go SDK bump breaks the "permanent" install | 🟡 Medium | Pin SDK 54. Budget a half-day upgrade ~2x/year. Never chase the newest SDK — App Store Expo Go lags it anyway. |
| No remote push → reminders are weaker than ideal | 🟡 Medium | Locally scheduled notifications cover daily drills and Room reminders. If adherence data shows this is the binding constraint, that alone justifies the first native build. |
| Privacy — recordings of work-adjacent content | 🟠 High | Audio deleted after transcription by default. Debriefs are my summary, never a recording of the actual meeting. Never record a real meeting — explicit product rule. |

---

## 11. Open Questions

1. Does the Arena topic mix stay 50/50 field/random, or adapt to where I score worst?
2. Should the Rewrite step be mandatory (better learning) or skippable (better retention)? — **Instrument it, decide by data.**
3. Is Contribution Score self-reported forever, or is there a lighter honest signal?
4. Does the app ever pull from my calendar to auto-create Rooms, or is manual entry (30s) actually better because it forces intention?
5. Solo-forever, or does a v2 cohort feature (compare filler trend with 3 peers) meaningfully raise adherence?

---

## 12. Design Concept

### The one-line direction

> **An instrument, not a toy.** Loquor should feel like a tuner or a field recorder that happens to teach — closer to a Teenage Engineering device or a pro audio app than to a language-learning app.

**Anti-brief — what it must never look like:** no mascot, no confetti, no streak flames, no cartoon celebration, no rounded-candy gamification, no generic purple-gradient AI aesthetic. Every one of those signals "toy," and a toy is easy to abandon. The user is a senior engineer preparing for a real meeting in twenty minutes. The app should carry the seriousness of that moment.

### The three ideas the design is built on

**1. Sound is the only source of light.**
The app is a dark, empty room. Silence is darkness. Your voice is the only thing that illuminates it. While recording, a radial bloom behind the UI responds to your amplitude in real time — speak and the screen brightens, stop and it decays. Dead air isn't a number in a report; **it's visible as the screen going dark.** Depth throughout the app comes from luminosity, never from drop shadows: brighter means closer.

**2. Color is data. Chrome is colorless.**
Loquor does not have an accent color, because it isn't about a brand — it's about sound, and sound is a spectrum. All UI chrome is near-monochrome. Color appears **only** where it encodes real measured data, borrowed from scientific spectrogram ramps. That discipline is what makes a saturated palette read as *instrument* rather than *toy*.

**3. Your speech is a physical archive.**
The signature concept, replacing the waveform. Every recording is rendered as a **vertical core sample** — a spectrogram ribbon, frequency on one axis, time on the other. Your history is a wall of these stacked side by side, like geological strata or a shelf of specimens. Every session is visually unique because your voice that day was unique. Fillers appear as bright flecks in the rock.

**Over 90 days, you watch the flecks thin out.** That is the progress screen. It is vastly more compelling than a line chart, it's real data rather than decoration, and nothing in this category looks remotely like it.

### Palette

**The governing idea: the interface lives inside a spectrogram.** The ground is not black — it is the *noise floor* of the heat ramp. Chrome sits in the cold, quiet end of that ramp; data pushes toward the heat. There is no brand accent independent of the ramp.

**Chrome — aubergine, never neutral grey:**

| Token | Hex | Use |
|---|---|---|
| `floor` | `#150F1C` | Page ground — deep aubergine, the spectrogram's silence |
| `strata` | `#1E1628` | Recessed panels and inputs |
| `carve` | `#2E2338` | Hairline rules — **1px lines, not card borders** |
| `chalk` | `#F0E9E4` | Primary text and mastery — warm limestone, never `#FFF` |
| `dust` | `#8B7F94` | Secondary text — violet-biased grey |
| `dust-dim` | `#5F566B` | Tertiary / labels |

**Heat ramp — data encoding only (vocal energy, silence → peak):**

`#3B2A6B` → `#8B2F8F` → `#D1436B` → `#F5793B` → `#FFC96B` → `#FFF3D4`

**Semantic — two values, sampled from the ramp:**

| Token | Hex | Use |
|---|---|---|
| `ember` | `#F5793B` | Live, recording, primary action — ramp stop 4 |
| `flaw` | `#FF4D6D` | Filler markers, hedges, over-threshold |

**The semantic rule, inverted from convention: light is clarity, heat is flaw.** Mastery renders chalk-white and cool; problems render hot. There is no green tick anywhere in this product — and no lone acid-green accent, which is the single most over-used dark-UI default in the category.

**Rendered design system and screen mockups:** https://claude.ai/code/artifact/3db38402-6d6e-4e87-8db4-1f92f610aec9

### Typography

- **Display** — *Fraunces*, variable, pushed high on its WONK and SOFT axes. Genuinely characterful rather than another Playfair. Alternative for more drama: *Bodoni Moda*, extreme contrast.
- **UI** — *Geist* or *Inter Tight*. Tight, neutral, gets out of the way.
- **Metrics** — *Geist Mono* / *JetBrains Mono*, always. Numbers are instrument readouts.

**The distinctive typographic move: Latin inscription headers.** Section titles set in letterspaced small caps using the classical V-for-U carving convention — `ELOCVTIO`, `PRONVNTIATIO`, `KAIROS`, `LOQVOR`. This is where the §0.1 canon architecture surfaces visually. Every competitor's header says "Vocabulary." Loquor's says `ELOCVTIO`, with the plain-English name beneath it in small `ash` type.

### Layout

Editorial and asymmetric, not a stack of rounded cards floating on grey. Content hangs off a strong left margin with generous negative space; metrics right-align in mono. Separation comes from **1px `ridge` hairlines**, not card fills. That single decision kills the generic-app look faster than anything else in this document.

### Interaction principles

1. **One decision per screen.** The home screen has one card and one button. Deliberation is where daily habits die.
2. **The record control is an aperture, not a button.** It irises open when you begin and closes when you stop. It's the emotional center of the app — the moment Loquor asks something of you — and it should feel mechanical and consequential.
3. **The app is audio-reactive while recording.** Amplitude drives the background bloom in real time. This is the single highest-value animation in the product; everything else can be still.
4. **Motion settles, never bounces.** No spring overshoot, no celebration, no confetti.
5. **Numbers show target bands, not verdicts.** `4.2/min` sits inside a range with a marker — never a grade, never a star, never a red X.
6. **Progress is the strata wall,** not a line chart. Sparklines exist, but the archive is the hero.

### Screen priority for design work

1. **Today** — the home card. Most-seen screen in the app.
2. **Arena scorecard** — the waveform. The signature.
3. **Arena record** — primer, timer, the button.
4. **Lexicon word detail** — four fields, speak-to-unlock.
5. **Room prep card** — three questions, two words, one scaffold.
6. **Progress** — trends.
7. **Settings → AI Providers** — mode selector, three key fields with ⓘ icons, and the tutorial bottom sheet. Not glamorous, but it's the first screen touched on install and it must not feel like a config file.

---

## Appendix — Research Sources

- Filler-word thresholds: *"Um, so, like, do speech disfluencies matter? A parametric evaluation of filler sounds and words"* — 0/2/5/12-per-minute conditions; 5/min showed no adverse effect, 12/min significantly damaged perceived effectiveness.
- Filler detection pipelines & datasets: *Filler Word Detection and Classification: A Dataset and Benchmark* (PodcastFillers, arXiv:2203.15135) — 35K annotated fillers; VAD + ASR + classifier pipeline.
- Retrieval practice: spaced *retrieval* practice ≈ 50% better retention than spaced passive review; practice testing and distributed practice are the only two techniques rated "high utility" in the Dunlosky et al. review.
- Competitive landscape: ELSA Speak (phoneme/pronunciation), italki & Preply (human tutors), Duolingo (habit + recognition vocab), SpeakShark (AI accents). **None operate a prep/debrief loop against real meetings.**
- Expo Go constraint: `expo-speech-recognition` and `expo-stt` both require a development build; Expo Go supports only bundled modules. `expo-audio` SDK 54 Android zero-byte regression (expo/expo#39646).
