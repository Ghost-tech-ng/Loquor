# PipeUp

A speech trainer that runs inside Expo Go on iOS (SDK 57). It has no backend. The
project was called Loquor until v1.0. The Expo slug, the database file and the
SecureStore key names still say `loquor`: the slug is bound to the EAS project,
and the other two keep your history and keys when you update.

The tab bar is **Home · Play · Rooms · You**. Settings is the setup link in
the masthead of every tab.

- **Home**: the orb, one line on where you stand, and one button: the one thing
  to do next, usually an Arena take. Today's quests sit behind a single row, and
  Voice note is one tap below.
- **Arena**: record → transcribe → delivery metrics counted on the phone →
  scorecard → rewrite. The scorecard leads with one sentence; the rest is
  behind "See details".
- **Voice note**: record here, send there. See the filler count and pace,
  re-record if you want, then send the audio through the share sheet.
- **Play**: five games, the five training drills and a word of the day.
- **Rooms**: a Prep Card before a real meeting, a spoken debrief after, and a
  contribution funnel.
- **You**: rank, streak, focus span, liveliness, badges, your Arena takes, and
  everything Progress used to show.

**My English** (in onboarding and Settings) picks which soft fillers count:
"ehn", "abi", "sha" and "o" for Nigerian English, "basically", "actually" and
"na" for Indian English, none for Standard. Each word can be switched off.

## Run it

```bash
npm install
npm start          # scan the QR with the iPhone camera; Expo Go opens it
```

Then in the app, go to **setup (top right) → API Keys → Groq → Add**. The ⓘ next to
each field explains how to get the key. Nothing works until at least one key is in.

## The layout

`app/` holds routes and nothing else. Each route file is a one-line re-export of
a screen that lives with the rest of its feature:

```
app/                   routes only: (tabs)/ for the bar, play/ for the games, the rest are stack screens
features/<name>/       a feature's screens, judge, store, content and tests
features/games/        the five games: pure scoring modules at the top, one folder of screens per game
features/progression/  XP, levels, streak, quests and badges, all pure and all tested
lib/                   shared core: db, llm, stt, metrics, lexicon, settings, coach, skillStore
components/kit/        the whole visual kit (see below)
components/            useTake (record → transcribe → delete) and useReplayMelody
content/               corpora that more than one feature reads: archetypes, scaffolds, scenarios
```

Features import from `lib/`, `components/` and `content/`. They occasionally
import from each other when one genuinely reads another's data: Home picks an
Arena topic, the Reading glosses words from the Lexicon, and Blitz and Word Bomb
grade Lexicon cards.

### The kit

Every screen is built from `components/kit/`. The old `ui`, `viz`, `glyphs`,
`boot` and `recorder` modules are gone.

| File | What it holds |
|---|---|
| `Screen` | the aurora background, the safe area, the masthead and tab clearance |
| `Text` | `Eyebrow`, `Display`, `Body`, `Meta`, `Figure`, and `Hair`, a divider that fades out at both ends |
| `Glass` | the glass card, plus `Panel` (a card with a gap between its children) |
| `GlowButton` | the gradient pill for the main action, plus its ghost and quiet variants |
| `motion` | `PressableScale`, `Rise`, `Reveal`, `Tap`, `Pulse`, `Counter` |
| `Charts` | `Timeline`, `StrataWall`, `Rail`, `Score`, `ScoreBar` |
| `Recorder` | `Aperture` (the voice orb while you talk), `Working`, `Failed` |
| `VoiceOrb` / `RobotOrb` | the mascot, and the grey robot it grows out of |
| `Meters`, `StreakFlame`, `Confetti`, `Halo`, `MelodyLine`, `RewardHost` | progress, celebration and the pitch line |
| `Aurora`, `Boot` | the drifting background and the logo reveal |
| `icons`, `Glyph` | Lucide icons behind one name map (there are no emoji anywhere) |
| `feel`, `sfx` | haptics and the short sound cues |

The palette is **Emerald & Cyan** on a near-black navy. Emerald marks the thing to
press, cyan marks anything earned (XP, badges), mint means cleared, and coral
means a flaw. Fraunces is used for anything read as a sentence, Outfit for
labels, and Space Mono for anything that counts.

## The routes

| Route | What it is |
|---|---|
| `/` | Home: the orb, the next action, the quests row, the voice note shortcut |
| `/play` | The Play tab: five games, then the training drills |
| `/rooms` | The contribution funnel, pending debriefs, and the new-room form |
| `/you` | Rank, streak, focus span and liveliness, badges, your Arena takes, then the whole Progress screen |
| `/arena?topicId=` | A 60-second primer, then the take. `&rewriteOf=<id>` re-records one sentence |
| `/scorecard?id=` | One sentence, then delivery and content behind "See details" |
| `/voicenote` | Record a voice note, check it, send it through the share sheet |
| `/play/blitz` | Lexicon Blitz |
| `/play/bomb` | Word Bomb |
| `/play/pause` | Pause, Don't Um |
| `/play/gauntlet` | No-Um Gauntlet |
| `/play/alive` | Bring It to Life |
| `/read?readingId=&section=` | The Reading: study four words, read one section aloud, get it back marked |
| `/lexicon` | Review queue, speak-to-unlock, Word of the Day, real-use log |
| `/room?id=` | One room: the Prep Card before, the 90-second spoken debrief after |
| `/playbook` | Snippet → named archetype → one question aloud → verdict. `?archetypeId=` pins a move |
| `/lab` | The Argument (scaffold drill) and The Room (networking role-play) |
| `/onboarding` | The baseline: ninety seconds, fixed prompt, recorded once |
| `/settings` | Free / Precision / Custom, the three key slots, reminders, sound, backup |
| `/valve` | The volume ladder against a mirror under the nose |
| `/dev/smoke` | Phase 0 device checks: mic, file, metering, Groq round-trip |
| `/dev/pitch` | The pitch-sampling test: does playback sampling yield frames on this phone |

## Play

Each game has a pure module with tests, a screen, a personal best, and a run
record (`features/games/runs.ts`). The best is read *before* the save, so "new
best" means beating every earlier run, not tying the one just written.

1. **Lexicon Blitz** (60 s, tap). A definition appears; pick the word from four.
   The distractors come from the same themed run of the glossary, so you have to
   tell close words apart, not just recognise a shape. Answers grade the
   recognition card, so a round counts as real review.
2. **Word Bomb.** You get five words, each with a 30-second fuse; say a sentence
   that uses the word. `wordMatch.ts` accepts inflections and the near-misses
   Whisper produces ("trac table"), and nothing looser. A hit grades the
   production card.
3. **Pause, Don't Um** (live). While you talk, a pause gate flashes at moments
   you did not choose. Go quiet, hold it, then pick the thread back up. It runs
   off the mic level alone, because that is the only signal Expo Go has live.
   The state machine is `pauseGate.ts`.
4. **No-Um Gauntlet.** You have three hearts and six rounds of 20 → 90 s. A
   filler costs a heart, and so does dead air. The score is seconds survived, and
   the longest clean stretch is your **focus span** on the You tab.
5. **Bring It to Life**, the fix for sounding like you are reading. The mascot
   starts as a grey robot and turns into the orb as your **liveliness** (0–100)
   rises. Liveliness is built from three parts:
   - **Melody**: the pitch range, from YIN over PCM in `pitch.ts`.
   - **Punch**: how much loudness moves, from the meter.
   - **Rhythm**: how uneven your word lengths and gaps are, from Whisper's
     timestamps.

   There are four modes: Talk, Deliveries (one line, three intents, scored on
   how *different* they are), Read → Retell, and Emphasis.

Melody needs PCM frames, and Expo Go cannot stream the mic as PCM. So
`useReplayMelody` plays the take back through expo-audio's sample tap and draws
the pitch line while you listen, then deletes the file. If the phone yields no
frames, Melody is hidden and liveliness falls back to Punch plus Rhythm. The
Arena scorecard always shows Punch plus Rhythm, which costs nothing extra.

## Progression

`features/progression/` is pure TypeScript, and **nothing in it is a ledger**.
XP, level and quest progress are recomputed from the history tables every time.
A ledger would need a backfill for the months that came before it, and it would
then have to agree with that history forever, through restores and resets.
Deriving these figures means they cannot disagree with the history, and the
backup carries them for free.

- **XP**:
  - Arena take: 50, plus up to 30 for being clean. The bonus is full at 2
    fillers a minute and gone by 8.
  - Rewrite: 25
  - Reading section: 20
  - Lexicon rep: 5
  - Drill: 35
  - Debrief: 60
  - Valve: 30
  - Badge: 25
  - Games: scaled from their score
- **Levels**: a gentle quadratic curve. Ranks run Mumbler → Murmurer → Talker →
  Speaker → Storyteller → Orator → Silver Tongue → Legend.
- **Streak**: a week in a row banks a freeze (two at most), and a missed day spends
  one automatically. It is simulated forward from your first day, because
  whether a freeze existed on a missed day depends on everything before it.
- **Quests**: three a day, chosen once and then fixed. The first aims at your
  weakest skill; the other two rotate across the app.
- **Badges**: 23 lifetime facts. Each is stored once earned and never
  re-evaluated, so a reset cannot take one back.

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
PipeUp never records a real meeting, and the reminders are local notifications —
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

## Progress, and density over the streak

Progress now lives at the bottom of the You tab. It still leads with **density**
("19 of 28 days") and not with the current run. A streak rewards not breaking a
chain, and the cheapest way to protect a chain is a thirty-second take that
teaches nothing. The flame on Home is there to bring you back; density is the
honest figure. Reminder copy still carries no numbers.

Nothing on the screen calls a model on mount. The weekly read is an opt-in tap,
and the model is handed already-computed figures — never a transcript. It reports
on the week that *ended*, so the cache key is last week's; before you have a full
week the screen shows a "week in progress" read that is deliberately **not**
filed, because cached it would be read next Monday as a report on a week it only
saw half of.

The 1–5 self-rating is stored on the same row and survives regeneration:
`saveReport` upserts the four report columns on conflict rather than replacing
the row. It is the only figure in PipeUp the app cannot measure.

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
  runs. An update only reaches the Expo Go built for its SDK: a project ahead of
  the store build (a beta SDK) publishes fine and never arrives on the phone,
  which keeps showing the last update made for its own SDK. Move up only once
  the App Store Expo Go has.
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
