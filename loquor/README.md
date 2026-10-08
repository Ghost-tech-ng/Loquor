# Loquor — v1.0

Seven drills, one corpus, no backend. Runs inside Expo Go on iOS (SDK 57).

The tab bar is **Today · Arena · Rooms · Practice · Progress**. The Arena and
Rooms are the product and get tabs of their own; the other drills live under
Practice. Settings is the SETUP link in the masthead of every tab.

- **The Arena** — record → transcribe → deterministic delivery metrics → scorecard → rewrite.
- **The Reading** — ~1,400 words of real prose in six sections, aligned word by word.
- **The Lexicon** — FSRS on two tracks, and a word is only *yours* once you have said it.
- **Rooms** — a Prep Card before a real meeting, a spoken debrief after, and a contribution funnel.
- **The Playbook** — 30 question archetypes drilled against 16 meeting snippets.
- **The Lab** — five argument scaffolds, and a stranger who guards the interesting part.
- **Progress** — 28 days of density, this week's targets, and one opt-in weekly read.
- **The Valve** — a volume ladder that finds where the soft palate stops sealing.

## Run it

```bash
npm install
npm start          # scan the QR with the iPhone camera; Expo Go opens it
```

Then in the app: **SETUP (top right) → API Keys → Groq → ADD**. The ⓘ next to each field
walks through getting the key. Nothing works until at least one key is in.

## The layout

`app/` holds routes and nothing else. Each route file is a one-line re-export of
a screen that lives with the rest of its feature:

```
app/                 routes only — (tabs)/ for the bar, the rest are stack screens
features/<name>/     a feature's screens, judge, store, content and tests
lib/                 shared core: db, llm, stt, metrics, lexicon, settings, coach, skillStore
components/          shared UI: ui, viz, glyphs, boot, recorder, useTake
content/             corpora more than one feature reads: archetypes, scaffolds, scenarios
```

Features import from `lib/`, `components/` and `content/`, and occasionally from
each other where one genuinely reads another's data (Today picks an Arena topic;
the Reading glosses words from the Lexicon).

## The routes

| Route | What it is |
|---|---|
| `/` | Today — one prompt, chosen deterministically per day, plus the strata wall |
| `/stage` | The Arena tab — the prompt waiting for you, and every take with its scorecard |
| `/arena?topicId=` | 60s primer, then the take. `&rewriteOf=<id>` re-records one sentence |
| `/read?readingId=&section=` | The Reading — study four words, read one section aloud, get it back marked |
| `/lexicon` | Review queue, speak-to-unlock, Word of the Day, real-use log |
| `/rooms` | The contribution funnel, pending debriefs, and the new-room form |
| `/room?id=` | One room: the Prep Card before, the 90-second spoken debrief after |
| `/playbook` | Snippet → named archetype → one question aloud → verdict. `?archetypeId=` pins a move |
| `/lab` | The Argument (scaffold drill) and The Room (networking role-play) |
| `/progress` | 28-day density, this week's targets, delivery medians, the weekly read, ninety days |
| `/onboarding` | The baseline — ninety seconds, fixed prompt, recorded once |
| `/scorecard?id=` | Delivery above the rule, content below it |
| `/settings` | Free / Precision / Custom, the three key slots, the Reading primer, backup |
| `/valve` | The volume ladder against a mirror under the nose |
| `/dev/smoke` | Phase 0 device checks — mic, file, metering, Groq round-trip |

## The line that matters

`lib/metrics.ts` computes filler rate, pace, dead air, and hedge density from
word timestamps, on the phone, with arithmetic. `features/arena/judge.ts` scores content
with an LLM and is never shown a delivery figure. An LLM asked "how many filler
words?" answers differently on Tuesday; a 90-day trend built on that is worthless.

`lib/metrics.ts`, `lib/lexicon.ts`, `features/reading/reading.ts` and `features/lexicon/fsrs.ts` are pure —
no React, no RN, no network — so they have real unit tests:

```bash
npm test     # lib/*.test.mjs and features/*/*.test.mjs
```

`reading.test.mjs` also tests the *corpus*: that every target word actually
occurs in its section, that every one has a glossary entry, that each reading
clears ten minutes aloud, and that no section outgrows a single sitting. Authored
content fails silently otherwise.

## The Reading

The Arena scores speech you invented. `/read` scores speech against a text we
already have, which makes a sharper signal available: `features/reading/reading.ts` aligns the
transcript to the reference with Levenshtein backtrace, so every divergence is
locatable to a word. No LLM is involved at any point — the only network call is
transcription, and everything after it is arithmetic.

Each reading is ~1,400 words of real prose — the history of speech recognition,
Semmelweis, what actually happens in the first ninety seconds of a meeting,
containerisation — carrying 24 target words that are *used* and never defined.
Ten minutes aloud, recorded six sections at a time: a bad take is cheap to redo,
the upload stays small, the alignment table stays trivial, and the feedback
arrives while you still remember saying the words.

One thing it deliberately does not claim: Whisper is built to forgive accents and
will repair a mangled word from context. A word that comes back **wrong** is real
evidence of a stumble; a word that comes back right proves little. The screen says
so. This is a stumble detector, not a pronunciation score.

## The Lexicon

Every word carries two memories, scheduled independently by stock FSRS-5
(`features/lexicon/fsrs.ts`, published weights, unmodified):

- **recognition** — you see it and know it. Graded by a self-rating, or by reading
  it aloud cleanly in a section.
- **production** — it arrives unprompted, in the right slot, under time pressure.
  Graded *only* by speak-to-unlock, or by a confirmed real-world use.

Speak-to-unlock (`features/lexicon/lexiconJudge.ts`) asks the model three independent yes/no
questions — right sense, natural collocation, right register — rather than a
blended score, because the three failures need three different repairs. A single
number would tell you something was off and nothing about what to do next.

The one thing the app cannot observe is the one that counts most: you actually
said it to someone. That is logged by hand against the Word of the Day, and
credited as a stability multiplier with a floor.

## Rooms, and why there is still no backend

The PRD put "backend auth, Postgres, sync" in Phase 3. Rooms shipped on local
SQLite instead. The app is single-user and the API keys are device-local by
design, so a server would add a deploy target, a second language and a hosting
bill for nothing a user could notice. The `rooms` table mirrors the shape a
Postgres table would have, so sync stays additive if a second device ever
matters.

What Rooms stores about a meeting: a title, the decision on the table, a time,
the card, and what *you* said afterwards. No attendees, no notes, no audio.
Loquor never records a real meeting, and the reminders are local notifications —
remote push does not work in Expo Go on SDK 53+, and a push server would be
infrastructure in exchange for nothing.

The Contribution Score is a funnel, not a number out of a hundred: rooms
entered → spoke → asked → took a position → turned it, with the stage you fall
out of named. Rooms *entered* counts rooms that happened and were debriefed —
otherwise the headline metric could be gamed by planning meetings rather than
by speaking in them.

## Skill is not memory

`lib/coach.ts` tracks archetypes and scaffolds with an EWMA and an attempt
count, not FSRS. A word decays if you never see it again; a question archetype
is a motion that gets better with reps and does not need a review date. Early
attempts use `alpha = 1/(attempts+1)` so the first score *is* the average —
starting at a fixed 0.3 would make a first score of 4 read as 1.2.

The Playbook judge returns `likely_reply`: what the room would most probably say
back. A score tells you the question was weak; a plausible deflection shows you
how. Scaffolds are scored per step for the same reason — "that was unconvincing"
is not something you can practise.

## Progress, and the streak that is not a streak

`/progress` is the only screen in the app that looks backwards. It leads with
**density** — "19 of 28 days" — and not with the current run. A streak rewards
not breaking a chain, and the cheapest way to protect a chain is a thirty-second
take that teaches nothing. The run is a small second line, there is no flame, and
the reminder copy carries no number at all.

Nothing on the screen calls a model on mount. The weekly read is an opt-in tap,
and the model is handed already-computed figures — never a transcript. It reports
on the week that *ended*, so the cache key is last week's; before you have a full
week the screen shows a "week in progress" read that is deliberately **not**
filed, because cached it would be read next Monday as a report on a week it only
saw half of.

The 1–5 self-rating is stored on the same row and survives regeneration:
`saveReport` upserts the four report columns on conflict rather than replacing
the row. It is the only figure in Loquor the app cannot measure.

## The baseline

`/onboarding` is ninety seconds on one fixed prompt — *something you changed your
mind about, and what changed it* — recorded exactly once. The prompt cannot be
rerolled and the take cannot be redone; `id = 1` in the table enforces what the
screen already refuses. A baseline you could re-measure whenever it looked bad
would be a high score.

No model reads it. It stores filler rate, pace, hedge density and dead air —
arithmetic done on the phone — plus your own 1–5. Every row of the ninety-day
table on Progress is measured against it, so Today keeps a card at the top until
it exists, and then never shows it again.

## Reminders

Two repeating local notifications: a daily practice nudge and a weekly one for
the read. Times come from a small fixed set of presets rather than a wheel
picker — the exact minute does not decide whether a habit sticks, and a free
picker is one more decision on a screen whose job is to have as few as possible.
No dependency was added for it. Permission refusal is explained in place, with a
pointer to iOS Settings.

## Known open item

The Phase 0 gate has not been run: we do not yet know whether Whisper's filler
recall clears 80%. Until it does, filler counts under the free (Groq) provider
print with a `≈` and the scorecard says why. Both providers are implemented
behind one interface, so the gate result changes a default, not an architecture.

Session rows store which provider produced them, and `fillerTrend()` filters by
provider — switching modes can never masquerade as an improvement in your speech.

## Constraints that hold

- **Expo Go only.** If a feature needs a config plugin or a custom native module,
  it does not go in v1. On SDK 57, the version the App Store build of Expo Go
  runs. When Expo Go moves to a new SDK the published update stops opening until
  the project follows it — that is what a sudden crash on launch usually means.
- **Keys live in `expo-secure-store`.** Never AsyncStorage, never logged, never
  sent anywhere but the vendor they belong to.
- **Audio is deleted** as soon as the transcript exists.
- **Never record a real meeting.**

## Shipping

```bash
npm run typecheck && npm test && npm run doctor
npm run publish:preview   # eas update to the preview branch Expo Go opens
```

Cloud backup writes to Firestore directly from the phone, so `firestore.rules`
is the whole security model. Deploy it whenever it changes:

```bash
firebase deploy --only firestore:rules
```
