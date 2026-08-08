# Phase 0 — STT filler-recall spike

**This is the go/no-go gate for Loquor.** The Arena scorecard's headline metric is
`filler_rate`. Whisper is trained to emit clean prose, so it may silently delete the
exact tokens we are trying to count. Nothing downstream is worth building until the
real recall number exists.

Zero dependencies. Node 22 (`fetch`, `FormData`, `Blob` are built in).

---

## 1. Record 20 samples

Speak naturally into Voice Memos on the iPhone, **do not re-record to sound clean** —
the disfluencies are the measurement. Export as `.m4a` into `audio/`, named `01.m4a`
through `20.m4a`.

Spread them across the conditions the app will actually see:

| Count | Condition | Why it's in the set |
|---|---|---|
| 6 | 60–90s answering a technical prompt you know cold | The Arena happy path |
| 6 | 60–90s on a topic you had 60s to skim | Where fillers spike — the real test |
| 4 | 30s of deliberately disfluent speech | Guarantees a non-trivial truth count |
| 2 | Quiet room, close mic | Upper bound on recall |
| 2 | Noisy / phone held at arm's length | Lower bound |

Fewer than 20 and the harness will still run, but it warns you the number isn't
trustworthy yet.

## 2. Generate label stubs

```
node spike.mjs --init
```

Creates `labels/01.txt` … `labels/20.txt`.

## 3. Hand-label

Type each transcript **verbatim** — every `um`, `uh`, `er`, `hmm`. Resist cleaning it
up; a cleaned label makes the model look perfect and the whole exercise pointless.
The script derives truth counts from your text automatically, so there is no JSON to
hand-edit.

## 4. Run the gate

```powershell
$env:GROQ_API_KEY = "gsk_..."
node spike.mjs
```

```bash
export GROQ_API_KEY=gsk_...
node spike.mjs
```

Get a key at <https://console.groq.com/keys>. The free tier covers this spike many
times over. **The key is read from the environment only — never commit it.**

---

## Reading the result

Three numbers, and they answer different questions.

**Non-lexical filler recall — baseline.** The gate. `um`, `uh`, `er`, `hmm` and
friends, which is the population actually at risk.

- **≥ 0.80** → Groq alone is viable. Build Arena on it.
- **< 0.80** → Hybrid. Deepgram (`filler_words=true`) for Arena only; Groq keeps
  everything else. Costs roughly **$0.65/month** at ~5 sessions/day.

**Non-lexical filler recall — primed.** Same audio, run again with a deliberately
disfluent `prompt`. Whisper biases decoding toward the prompt's style, so this is the
cheapest mitigation there is (mitigation ladder step 1, PRD §6.2a). It's measured
alongside the baseline rather than after a failure, because if it's free points we
want them either way.

**Lexical hedge recall — the control.** `like`, `you know`, `basically`. Real words;
Whisper has no reason to strip them. If this isn't near 100%, **the harness is wrong,
not the model** — suspect the labels first. The script says so explicitly rather than
letting you draw a false conclusion about Groq.

Also reported, because they gate other things:

- **Word timestamps present.** `pace`, `dead_air`, and `hedge_density` are computed
  deterministically from word timings and are unaffected by the filler problem. If
  timestamps are missing, three-quarters of the scorecard dies too and that is a much
  bigger problem than filler recall.
- **p50 / p95 latency.** Feeds the <3.5s round-trip budget. Transcription is the
  largest single term in it.

Per-sample diffs land in `out/` — truth vs. baseline vs. primed, side by side. Read a
few failures before accepting the aggregate; a single mislabelled sample can move the
number several points at n=20.

## Options

```
node spike.mjs --init                        create label stubs
node spike.mjs                               run the gate
node spike.mjs --model whisper-large-v3      compare against the non-turbo model
```

The non-turbo comparison is worth one run if the gate is close. Turbo trades some
accuracy for speed, and on a borderline result the slower model may clear 0.80 on its
own — cheaper than adding a second vendor.
