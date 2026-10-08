// The parts of backup that are arithmetic: chunking, hashing, and translating
// between plain rows and Firestore's typed-value wire format.
//
// Kept free of every React Native import so it can run under `node --test`.
// The transport in cloud.ts and the orchestration in backup.ts are thin shells
// around this; everything with a chance of being subtly wrong lives here where
// it can be tested without a phone.

/** Rows are flat: SQLite gives back strings, numbers, and nulls, nothing else. */
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export type Chunk = {
  /** Stable across backups, so re-uploading a chunk overwrites in place. */
  id: string;
  table: string;
  /** Content hash. Unchanged hash means the upload is skipped entirely. */
  hash: string;
  rows: number;
  /** The chunk's payload, already serialised. */
  data: string;
};

export type Manifest = {
  version: 1;
  at: number;
  chunks: { id: string; table: string; hash: string; rows: number }[];
};

/**
 * Bytes a string costs as UTF-8.
 *
 * Not `TextEncoder().encode(s).length` — that is present in Hermes on some SDK
 * versions and absent on others, and a backup that silently mis-sizes its
 * chunks on one runtime is worse than a loop.
 */
export function utf8Len(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      // Surrogate pair: four bytes for the pair, and skip its low half.
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/**
 * FNV-1a, 32-bit, hex.
 *
 * This is a change detector, not a security primitive. It answers "is this the
 * same bytes as last time" so an unchanged chunk costs zero writes, and a
 * collision costs one stale chunk out of thousands — which the next edit to
 * that chunk repairs anyway.
 */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Rows per chunk, and the reason boundaries are counted rather than measured.
 *
 * A pure byte budget looks tidier and is quietly much worse: shortening one row
 * shifts every boundary after it, so editing the first row of a table re-uploads
 * the entire table. Counting rows makes a boundary a function of position
 * alone, so an in-place edit dirties exactly one chunk no matter how much the
 * row's size changed.
 *
 * 50 rows of a typical session — transcript, metrics, judgement — is around
 * 150 KB.
 */
export const CHUNK_ROWS = 50;

/**
 * The safety valve on that count, for tables whose rows are unusually fat.
 *
 * A Firestore document caps at 1 MiB. 200 KB leaves a wide margin, and crossing
 * it is the only case where boundaries cascade — accepted, because the
 * alternative is a document that fails to write at all.
 */
export const CHUNK_BYTES = 200 * 1024;

/**
 * Splits a table into chunks.
 *
 * Order matters and is preserved. Tables are dumped in primary-key order (see
 * db.ts), so an append-only table only ever dirties its final chunk.
 */
export function chunkTable(table: string, rows: Row[]): Chunk[] {
  const out: Chunk[] = [];
  let batch: Row[] = [];
  let bytes = 0;

  const flush = () => {
    if (batch.length === 0) return;
    const data = JSON.stringify(batch);
    out.push({
      id: `${table}-${out.length}`,
      table,
      hash: hash(data),
      rows: batch.length,
      data,
    });
    batch = [];
    bytes = 0;
  };

  for (const row of rows) {
    const size = utf8Len(JSON.stringify(row));
    // Flush before adding, so a row never lands in a chunk it pushes over
    // budget — except when it is the first row, where there is nowhere else
    // for it to go.
    if (batch.length >= CHUNK_ROWS || (bytes > 0 && bytes + size > CHUNK_BYTES)) flush();
    batch.push(row);
    bytes += size;
  }
  flush();

  // An empty table still needs one empty chunk, otherwise a table that was
  // cleared locally would look absent rather than emptied on restore.
  if (out.length === 0) {
    const data = "[]";
    out.push({ id: `${table}-0`, table, hash: hash(data), rows: 0, data });
  }
  return out;
}

export type Plan = {
  /** Chunks whose content changed, or that the remote has never seen. */
  upload: Chunk[];
  /** Chunk ids the remote holds that the local snapshot no longer produces. */
  remove: string[];
  unchanged: number;
};

/**
 * Diffs a fresh snapshot against what the remote manifest says is already up
 * there. Everything the free tier costs us is decided here.
 */
export function planUpload(chunks: Chunk[], remote: Manifest | null): Plan {
  const have = new Map((remote?.chunks ?? []).map((c) => [c.id, c.hash]));
  const upload: Chunk[] = [];
  let unchanged = 0;

  for (const c of chunks) {
    if (have.get(c.id) === c.hash) unchanged++;
    else upload.push(c);
    have.delete(c.id);
  }
  return { upload, remove: [...have.keys()], unchanged };
}

export function manifestOf(chunks: Chunk[], at: number): Manifest {
  return {
    version: 1,
    at,
    chunks: chunks.map(({ id, table, hash: h, rows }) => ({ id, table, hash: h, rows })),
  };
}

// ------------------------------------------------------- firestore wire format

/**
 * Firestore's REST API wraps every value in a type tag. Our documents only ever
 * hold strings, numbers, booleans and nulls, so this covers the whole surface —
 * no maps, no arrays, no timestamps. Anything structured is JSON in a string
 * field, which is also what keeps a chunk to one indexed value instead of
 * hundreds.
 */
export function encodeFields(obj: Record<string, Cell>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) out[k] = { nullValue: null };
    else if (typeof v === "string") out[k] = { stringValue: v };
    else if (typeof v === "boolean") out[k] = { booleanValue: v };
    else if (Number.isInteger(v)) out[k] = { integerValue: String(v) };
    else out[k] = { doubleValue: v };
  }
  return out;
}

export function decodeFields(fields: Record<string, unknown> | undefined): Row {
  const out: Row = {};
  for (const [k, wrapped] of Object.entries(fields ?? {})) {
    const v = wrapped as Record<string, unknown>;
    if ("stringValue" in v) out[k] = v.stringValue as string;
    else if ("integerValue" in v) out[k] = Number(v.integerValue);
    else if ("doubleValue" in v) out[k] = Number(v.doubleValue);
    else if ("booleanValue" in v) out[k] = Boolean(v.booleanValue);
    else out[k] = null;
  }
  return out;
}
