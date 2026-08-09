// node --test lib/backupCore.test.mjs  (run via: npm test)
//
// The backup exists for the day the phone is gone, which is the one day it
// cannot be debugged. Every failure mode here is silent by nature: a chunk that
// hashes the same after changing means data stops being uploaded and nobody
// finds out until the restore, and a wire encoding that drops a null means the
// restore succeeds while quietly corrupting rows. So the arithmetic gets tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHUNK_BYTES,
  CHUNK_ROWS,
  chunkTable,
  decodeFields,
  encodeFields,
  hash,
  manifestOf,
  planUpload,
  utf8Len,
} from "./backupCore.ts";

const row = (i, pad = "") => ({ id: `s${i}`, started_at: 1000 + i, transcript: `take ${i}${pad}` });

test("utf8Len counts what the wire actually costs", () => {
  assert.equal(utf8Len("abc"), 3);
  assert.equal(utf8Len("é"), 2);
  assert.equal(utf8Len("→"), 3);
  // Surrogate pair: one astral codepoint, four bytes, not six.
  assert.equal(utf8Len("𝄞"), 4);
  assert.equal(utf8Len(""), 0);
});

test("hash is stable and separates near-identical payloads", () => {
  assert.equal(hash("loquor"), hash("loquor"));
  assert.notEqual(hash("loquor"), hash("loquoR"));
  assert.notEqual(hash("[]"), hash("[ ]"));
  assert.match(hash("x"), /^[0-9a-f]{8}$/);
});

test("a small table is one chunk", () => {
  const chunks = chunkTable("sessions", [row(1), row(2), row(3)]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].id, "sessions-0");
  assert.equal(chunks[0].rows, 3);
  assert.deepEqual(JSON.parse(chunks[0].data), [row(1), row(2), row(3)]);
});

test("an empty table still produces one chunk", () => {
  // Otherwise a table cleared on this device looks absent rather than emptied,
  // and the restore would put the deleted rows back.
  const chunks = chunkTable("rooms", []);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].rows, 0);
  assert.deepEqual(JSON.parse(chunks[0].data), []);
});

test("chunks split on the byte budget and stay under the document cap", () => {
  const fat = "x".repeat(20 * 1024);
  const rows = Array.from({ length: 40 }, (_, i) => row(i, fat));
  const chunks = chunkTable("sessions", rows);

  assert.ok(chunks.length > 1, "800 KB of rows must not be one document");
  assert.equal(
    chunks.reduce((n, c) => n + c.rows, 0),
    40,
    "no row may be dropped by the split"
  );
  for (const c of chunks) {
    assert.ok(utf8Len(c.data) < 1024 * 1024, `${c.id} exceeds the Firestore document cap`);
  }
  // Ids are positional and stable, which is what makes overwrite-in-place work.
  assert.deepEqual(
    chunks.map((c) => c.id),
    chunks.map((_, i) => `sessions-${i}`)
  );
});

test("a single oversized row gets its own chunk rather than being dropped", () => {
  const rows = [row(1), { ...row(2), transcript: "y".repeat(CHUNK_BYTES + 5000) }, row(3)];
  const chunks = chunkTable("sessions", rows);
  assert.equal(
    chunks.reduce((n, c) => n + c.rows, 0),
    3
  );
});

test("appending dirties only the last chunk", () => {
  // The entire cost argument for daily backups rests on this.
  const fat = "x".repeat(20 * 1024);
  const before = chunkTable("sessions", Array.from({ length: 30 }, (_, i) => row(i, fat)));
  const after = chunkTable("sessions", Array.from({ length: 31 }, (_, i) => row(i, fat)));

  const plan = planUpload(after, manifestOf(before, 1));
  assert.equal(plan.upload.length, 1);
  assert.equal(plan.upload[0].id, after[after.length - 1].id);
  assert.equal(plan.remove.length, 0);
  assert.equal(plan.unchanged, before.length - 1);
});

test("an unchanged snapshot uploads nothing", () => {
  const chunks = chunkTable("lexicon", [row(1), row(2)]);
  const plan = planUpload(chunks, manifestOf(chunks, 1));
  assert.equal(plan.upload.length, 0);
  assert.equal(plan.remove.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("boundaries are counted, not measured", () => {
  const chunks = chunkTable("lexicon", Array.from({ length: 200 }, (_, i) => row(i)));
  assert.equal(chunks.length, 200 / CHUNK_ROWS);
  for (const c of chunks) assert.equal(c.rows, CHUNK_ROWS);
});

test("editing a row in place re-uploads exactly its chunk, however much it resized", () => {
  // The failure this guards against: with byte-measured boundaries, shortening
  // the first row of a table shifts every boundary after it and the whole table
  // re-uploads. A daily lexicon review would then cost a full backup each time.
  const before = chunkTable("lexicon", Array.from({ length: 200 }, (_, i) => row(i)));
  const edited = Array.from({ length: 200 }, (_, i) => row(i));
  edited[0] = { ...edited[0], transcript: "x".repeat(4000) };
  const after = chunkTable("lexicon", edited);

  const plan = planUpload(after, manifestOf(before, 1));
  assert.equal(plan.upload.length, 1);
  assert.equal(plan.upload[0].id, "lexicon-0");
  assert.equal(plan.remove.length, 0);
});

test("a shrinking table marks its orphaned chunks for deletion", () => {
  const fat = "x".repeat(20 * 1024);
  const before = chunkTable("drills", Array.from({ length: 30 }, (_, i) => row(i, fat)));
  const after = chunkTable("drills", [row(0, fat)]);

  const plan = planUpload(after, manifestOf(before, 1));
  assert.ok(plan.remove.length > 0, "orphaned chunks must not be left paid for and stale");
  assert.ok(!plan.remove.includes("drills-0"));
});

test("planUpload treats a missing manifest as a full upload", () => {
  const chunks = chunkTable("sessions", [row(1)]);
  const plan = planUpload(chunks, null);
  assert.equal(plan.upload.length, chunks.length);
  assert.equal(plan.unchanged, 0);
});

test("the wire format round-trips every cell type SQLite produces", () => {
  const original = {
    id: "abc",
    started_at: 1723200000000,
    wpm: 132.4,
    rubric_total: null,
    is_rewrite: true,
    // A transcript is the reason the encoder has to be exact about strings.
    transcript: 'he said "nuance", then — nothing',
  };
  const back = decodeFields(encodeFields(original));
  assert.deepEqual(back, original);
});

test("integers survive as integers and are not sent as floats", () => {
  // Firestore keeps integerValue and doubleValue as distinct types; a timestamp
  // that comes back as 1.7232e12 breaks every ORDER BY started_at on restore.
  const wire = encodeFields({ at: 1723200000000, rate: 0.5 });
  assert.deepEqual(wire.at, { integerValue: "1723200000000" });
  assert.deepEqual(wire.rate, { doubleValue: 0.5 });
  assert.equal(decodeFields(wire).at, 1723200000000);
});

test("decoding tolerates an absent fields object", () => {
  assert.deepEqual(decodeFields(undefined), {});
});

test("manifestOf carries ids and hashes but never the payload", () => {
  const chunks = chunkTable("sessions", [row(1)]);
  const m = manifestOf(chunks, 42);
  assert.equal(m.version, 1);
  assert.equal(m.at, 42);
  assert.equal(m.chunks.length, 1);
  assert.ok(!("data" in m.chunks[0]), "the manifest must stay small enough to read on every backup");
});
