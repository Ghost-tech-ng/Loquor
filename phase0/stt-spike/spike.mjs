#!/usr/bin/env node
//
// Loquor Phase 0 -- STT filler-recall spike.
//
// This is the go/no-go gate for the entire product. The Arena scorecard's
// headline metric is filler_rate, and Whisper is trained to produce clean prose,
// which means it may silently delete the exact tokens we are trying to count.
// Nothing downstream is worth building until we know the real number.
//
// Gate (PRD 6.2a):  non-lexical filler recall >= 0.80  ->  Groq alone
//                   non-lexical filler recall <  0.80  ->  hybrid, Deepgram for Arena
//
// Usage:
//   set GROQ_API_KEY=gsk_...        (PowerShell: $env:GROQ_API_KEY="gsk_...")
//   node spike.mjs                  run the gate
//   node spike.mjs --init           create label stubs for every audio file
//   node spike.mjs --model whisper-large-v3

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { NON_LEXICAL, LEXICAL_HEDGE, countPhrases, recall } from "./fillers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(HERE, "audio");
const LABEL_DIR = join(HERE, "labels");

const GATE = 0.8;
const MIN_SAMPLES = 20;
const AUDIO_EXT = new Set([".m4a", ".mp3", ".wav", ".webm", ".ogg", ".flac", ".mp4"]);

// Mitigation ladder step 1 (PRD 6.2a): Whisper's `prompt` biases decoding toward
// the style of the prompt text. Priming it with disfluent prose is the cheapest
// possible fix, so the spike measures it alongside the baseline rather than
// after a failed gate.
const PRIMING_PROMPT =
  "Um, so I think, uh, the thing is — er, we should probably, um, look at it again. " +
  "Uh, hmm, right, and, um, that's, uh, sort of where I landed.";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const MODEL = opt("--model", "whisper-large-v3-turbo");

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  hot: (s) => `\x1b[38;5;209m${s}\x1b[0m`,
  bad: (s) => `\x1b[38;5;204m${s}\x1b[0m`,
  ok: (s) => `\x1b[38;5;230m${s}\x1b[0m`,
};

async function listAudio() {
  let entries;
  try {
    entries = await readdir(AUDIO_DIR);
  } catch {
    fail(`No audio directory. Expected ${AUDIO_DIR}`);
  }
  return entries.filter((f) => AUDIO_EXT.has(extname(f).toLowerCase())).sort();
}

function fail(msg) {
  console.error(`\n${C.bad("x")} ${msg}\n`);
  process.exit(1);
}

async function init() {
  const files = await listAudio();
  if (files.length === 0) fail(`Drop your recordings into ${AUDIO_DIR} first.`);

  let made = 0;
  for (const f of files) {
    const stem = basename(f, extname(f));
    const path = join(LABEL_DIR, `${stem}.txt`);
    try {
      await stat(path);
    } catch {
      await writeFile(
        path,
        `# Verbatim transcript of ${f}\n` +
          `# Type EXACTLY what you hear, including every um, uh, er, hmm.\n` +
          `# Do not clean it up -- the disfluencies are the measurement.\n` +
          `# Delete these comment lines when done.\n\n`,
        "utf8"
      );
      made++;
    }
  }
  console.log(`\nCreated ${made} label stub(s) in ${LABEL_DIR}`);
  console.log(`${files.length} audio file(s) found. Fill in each .txt, then run: node spike.mjs\n`);
}

async function transcribe(apiKey, filePath, { prompt } = {}) {
  const buf = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf]), basename(filePath));
  form.append("model", MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("temperature", "0");
  if (prompt) form.append("prompt", prompt);

  const t0 = Date.now();
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status} on ${basename(filePath)}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  return { text: json.text || "", words: json.words || null, duration: json.duration ?? null, ms };
}

function pct(x) {
  return x === null ? "  n/a" : `${(x * 100).toFixed(1).padStart(5)}%`;
}

async function run() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    fail(
      "GROQ_API_KEY is not set.\n" +
        '  PowerShell:  $env:GROQ_API_KEY = "gsk_..."\n' +
        "  bash:        export GROQ_API_KEY=gsk_...\n\n" +
        "  Get a key at https://console.groq.com/keys -- free tier is enough for this spike."
    );
  }

  const files = await listAudio();
  if (files.length === 0) fail(`No audio in ${AUDIO_DIR}. See README.md for what to record.`);

  const samples = [];
  for (const f of files) {
    const stem = basename(f, extname(f));
    let truthText;
    try {
      truthText = await readFile(join(LABEL_DIR, `${stem}.txt`), "utf8");
    } catch {
      console.warn(C.dim(`  skipping ${f} -- no labels/${stem}.txt`));
      continue;
    }
    truthText = truthText
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join(" ")
      .trim();
    if (!truthText) {
      console.warn(C.dim(`  skipping ${f} -- labels/${stem}.txt is empty`));
      continue;
    }
    samples.push({ stem, path: join(AUDIO_DIR, f), truthText });
  }

  if (samples.length === 0) fail("No labelled samples. Run: node spike.mjs --init");

  console.log(`\n${C.bold("LOQVOR")} ${C.dim("- phase 0 - stt filler recall")}`);
  console.log(C.dim(`model ${MODEL} - ${samples.length} labelled sample(s)\n`));

  console.log(
    C.dim("  sample        base    primed    hedge     lat     words  truth-fillers")
  );
  console.log(C.dim("  " + "-".repeat(68)));

  const agg = {
    base: { matched: 0, truth: 0 },
    primed: { matched: 0, truth: 0 },
    hedge: { matched: 0, truth: 0 },
  };
  let latencies = [];
  let missingWordTimestamps = 0;
  let totalAudioSec = 0;

  for (const s of samples) {
    const truthFiller = countPhrases(s.truthText, NON_LEXICAL);
    const truthHedge = countPhrases(s.truthText, LEXICAL_HEDGE);

    let base, primed;
    try {
      base = await transcribe(apiKey, s.path);
      primed = await transcribe(apiKey, s.path, { prompt: PRIMING_PROMPT });
    } catch (err) {
      console.error(`  ${C.bad(s.stem.padEnd(12))} ${err.message}`);
      continue;
    }

    if (!base.words || base.words.length === 0) missingWordTimestamps++;
    if (base.duration) totalAudioSec += base.duration;
    latencies.push(base.ms);

    const rBase = recall(truthFiller.counts, countPhrases(base.text, NON_LEXICAL).counts);
    const rPrim = recall(truthFiller.counts, countPhrases(primed.text, NON_LEXICAL).counts);
    const rHedge = recall(truthHedge.counts, countPhrases(base.text, LEXICAL_HEDGE).counts);

    for (const [k, r] of [["base", rBase], ["primed", rPrim], ["hedge", rHedge]]) {
      agg[k].matched += r.matched;
      agg[k].truth += r.truth;
    }

    const colour = rBase.rate === null ? C.dim : rBase.rate >= GATE ? C.ok : C.bad;
    console.log(
      `  ${s.stem.padEnd(12)} ${colour(pct(rBase.rate))}   ${pct(rPrim.rate)}   ` +
        `${pct(rHedge.rate)}  ${String(base.ms + "ms").padStart(7)}  ` +
        `${String(base.words ? base.words.length : "NONE").padStart(6)}  ${String(truthFiller.total).padStart(8)}`
    );

    // Write the diff so failures are inspectable rather than just a number.
    await writeFile(
      join(HERE, "out", `${s.stem}.json`),
      JSON.stringify(
        {
          truth: s.truthText,
          baseline: base.text,
          primed: primed.text,
          truthFillerCounts: truthFiller.counts,
          baselineFillerCounts: countPhrases(base.text, NON_LEXICAL).counts,
          primedFillerCounts: countPhrases(primed.text, NON_LEXICAL).counts,
          latencyMs: base.ms,
          audioSec: base.duration,
          wordTimestamps: base.words ? base.words.length : 0,
        },
        null,
        2
      ),
      "utf8"
    ).catch(() => {});
  }

  const rate = (a) => (a.truth === 0 ? null : a.matched / a.truth);
  const baseRate = rate(agg.base);
  const primedRate = rate(agg.primed);
  const hedgeRate = rate(agg.hedge);

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  console.log(C.dim("\n  " + "-".repeat(68)));
  console.log(`  ${C.bold("non-lexical filler recall")}`);
  console.log(`    baseline            ${pct(baseRate)}   (${agg.base.matched}/${agg.base.truth})`);
  console.log(`    with priming prompt ${pct(primedRate)}   (${agg.primed.matched}/${agg.primed.truth})`);
  console.log(`  ${C.bold("lexical hedge recall")} ${C.dim("(control -- expect ~100%)")}`);
  console.log(`    baseline            ${pct(hedgeRate)}   (${agg.hedge.matched}/${agg.hedge.truth})`);
  console.log(`  ${C.bold("latency")}   p50 ${p50}ms   p95 ${p95}ms   ${C.dim(`over ${totalAudioSec.toFixed(0)}s of audio`)}`);
  console.log(`  ${C.bold("word timestamps")}   ${missingWordTimestamps === 0 ? C.ok("present on all samples") : C.bad(`MISSING on ${missingWordTimestamps} sample(s)`)}`);

  console.log("");
  if (samples.length < MIN_SAMPLES) {
    console.log(
      `  ${C.hot("!")} Only ${samples.length} labelled samples. The gate calls for ${MIN_SAMPLES} ` +
        `before this number is trustworthy.`
    );
  }

  const best = Math.max(baseRate ?? 0, primedRate ?? 0);
  if (hedgeRate !== null && hedgeRate < 0.9) {
    console.log(`  ${C.bad("CHECK THE HARNESS")} -- hedge recall is ${pct(hedgeRate)}.`);
    console.log(`  ${C.dim("Real words should survive transcription. Suspect the labels, not the model.")}`);
  } else if (best >= GATE) {
    console.log(`  ${C.ok("PASS")} -- ${pct(best)} >= ${GATE * 100}%. Groq alone is viable for Arena.`);
    if ((primedRate ?? 0) > (baseRate ?? 0) + 0.02) {
      console.log(`  ${C.dim("Ship the priming prompt: it bought " + ((primedRate - baseRate) * 100).toFixed(1) + " points.")}`);
    }
  } else {
    console.log(`  ${C.bad("FAIL")} -- ${pct(best)} < ${GATE * 100}%.`);
    console.log(`  ${C.dim("Go hybrid: Deepgram (filler_words=true) for Arena, Groq for everything else.")}`);
    console.log(`  ${C.dim("pace / dead_air / hedge_density are unaffected -- they only need word timestamps.")}`);
  }
  console.log(`\n  ${C.dim("Per-sample diffs written to phase0/stt-spike/out/")}\n`);
}

if (flag("--init")) {
  await init();
} else {
  await run();
}
