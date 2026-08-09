// Cloud backup: what goes up, when, and how it comes back.
//
// The device stays the source of truth. This is a copy, not a sync — there is
// one phone, and pretending otherwise would mean conflict resolution for a
// problem that does not exist. Restoring is an explicit act on a new device,
// never something that happens behind the user's back.
//
// TWO THINGS NEVER LEAVE THE DEVICE, and both are load-bearing:
//
//   1. The Groq / Anthropic / Deepgram API keys. They live in expo-secure-store
//      and a key that syncs to a cloud is no longer device-local, which is the
//      entire premise of BYOK. After a restore you paste the key once.
//   2. Audio. It is deleted after transcription and was never persisted.
//
// Room debriefs are the third sensitive thing, and unlike the first two it is a
// judgement call rather than a rule — the rooms table is the only place the app
// holds anything about real meetings and real colleagues. It is excluded by
// default and can be opted in.

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BACKUP_TABLES,
  dumpTable,
  isBackupTable,
  restoreRows,
  type BackupTable,
} from "./db.ts";
import {
  chunkTable,
  manifestOf,
  planUpload,
  type Chunk,
  type Manifest,
  type Row,
} from "./backupCore.ts";
import { cloudConfigured, deleteDoc, freshSession, getDoc, listDocs, setDoc } from "./cloud.ts";

/** Device-local backup settings. Deliberately NOT synced: whether this phone
 *  auto-backs-up is a fact about this phone. */
const PREFS_SLOT = "loquor.backup.prefs";
const STATE_SLOT = "loquor.backup.state";

/** Everything under this prefix is backup bookkeeping and must not be shipped
 *  up, or a restore would overwrite the new device's own sync state. */
const LOCAL_ONLY_PREFIX = "loquor.backup.";

/** The pseudo-table carrying AsyncStorage: settings and reminder slots. */
const PREFS_TABLE = "prefs";

/** Auto backup will not fire more often than this while the app is in use. */
const AUTO_INTERVAL_MS = 15 * 60 * 1000;

export type BackupPrefs = {
  auto: boolean;
  /** Off by default. See the note at the top of this file. */
  includeRooms: boolean;
};

export const DEFAULT_BACKUP_PREFS: BackupPrefs = { auto: true, includeRooms: false };

export type BackupState = {
  lastAt: number | null;
  lastError: string | null;
};

export async function loadBackupPrefs(): Promise<BackupPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_SLOT);
    if (!raw) return DEFAULT_BACKUP_PREFS;
    return { ...DEFAULT_BACKUP_PREFS, ...(JSON.parse(raw) as Partial<BackupPrefs>) };
  } catch {
    return DEFAULT_BACKUP_PREFS;
  }
}

export async function saveBackupPrefs(p: BackupPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_SLOT, JSON.stringify(p));
}

export async function backupState(): Promise<BackupState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_SLOT);
    if (!raw) return { lastAt: null, lastError: null };
    return { lastAt: null, lastError: null, ...(JSON.parse(raw) as Partial<BackupState>) };
  } catch {
    return { lastAt: null, lastError: null };
  }
}

async function setState(s: BackupState): Promise<void> {
  await AsyncStorage.setItem(STATE_SLOT, JSON.stringify(s));
}

// ------------------------------------------------------------------ snapshot

/** AsyncStorage as rows, so it chunks and diffs like everything else. */
async function dumpPrefs(): Promise<Row[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) => k.startsWith("loquor.") && !k.startsWith(LOCAL_ONLY_PREFIX)
  );
  const pairs = await AsyncStorage.multiGet([...keys].sort());
  return pairs
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({ k, v: v as string }));
}

async function snapshot(prefs: BackupPrefs): Promise<Chunk[]> {
  const tables = BACKUP_TABLES.filter((t) => prefs.includeRooms || t !== "rooms");
  const chunks: Chunk[] = [];
  for (const t of tables) {
    chunks.push(...chunkTable(t, (await dumpTable(t)) as Row[]));
  }
  chunks.push(...chunkTable(PREFS_TABLE, await dumpPrefs()));
  return chunks;
}

// -------------------------------------------------------------------- paths

const manifestPath = (uid: string) => `users/${uid}/meta/manifest`;
const chunkPath = (uid: string, id: string) => `users/${uid}/chunks/${id}`;
const chunksCollection = (uid: string) => `users/${uid}/chunks`;

// ------------------------------------------------------------------- backup

export type BackupResult = {
  uploaded: number;
  removed: number;
  unchanged: number;
  at: number;
};

let inFlight: Promise<BackupResult> | null = null;

/**
 * Uploads everything that changed since the last backup.
 *
 * Cost is the whole point of the chunk-and-hash design: most tables here are
 * append-only, so a day of practice dirties the final chunk of `sessions` and
 * nothing else. A routine backup is two or three writes against a free-tier
 * allowance of twenty thousand a day.
 */
export function backupNow(): Promise<BackupResult> {
  // Coalesce rather than queue. Two concurrent backups would race on the
  // manifest and the loser would leave it describing chunks it did not write.
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<BackupResult> {
  if (!cloudConfigured()) throw new Error("Cloud backup is not configured in this build.");

  const session = await freshSession();
  if (!session) throw new Error("Sign in to back up.");
  const { uid, idToken } = session;

  try {
    const prefs = await loadBackupPrefs();
    const chunks = await snapshot(prefs);

    const remote = await readManifest(uid, idToken);
    const plan = planUpload(chunks, remote);

    for (const c of plan.upload) {
      await setDoc(
        chunkPath(uid, c.id),
        { table: c.table, hash: c.hash, rows: c.rows, data: c.data },
        idToken
      );
    }
    for (const id of plan.remove) {
      await deleteDoc(chunkPath(uid, id), idToken);
    }

    // The manifest goes last, always. Until it is written the remote still
    // describes the previous good backup, so a failure partway through leaves
    // a restorable state rather than a half-described one.
    const at = Date.now();
    const manifest = manifestOf(chunks, at);
    await setDoc(manifestPath(uid), { json: JSON.stringify(manifest) }, idToken);

    await setState({ lastAt: at, lastError: null });
    return { uploaded: plan.upload.length, removed: plan.remove.length, unchanged: plan.unchanged, at };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const prev = await backupState();
    await setState({ lastAt: prev.lastAt, lastError: message });
    throw err;
  }
}

async function readManifest(uid: string, token: string): Promise<Manifest | null> {
  const doc = await getDoc(manifestPath(uid), token);
  if (!doc || typeof doc.json !== "string") return null;
  try {
    return JSON.parse(doc.json) as Manifest;
  } catch {
    // A manifest we cannot parse is treated as no manifest: the next backup
    // re-uploads everything and repairs it.
    return null;
  }
}

// ------------------------------------------------------------------ restore

export type RestoreResult = { tables: number; rows: number; at: number };

/**
 * Pulls the whole backup down and merges it into SQLite.
 *
 * Merge, not replace. Nothing local is deleted — if this device has a session
 * the backup does not, that session survives. The only thing that overwrites is
 * a row with the same primary key.
 */
export async function restoreNow(): Promise<RestoreResult> {
  if (!cloudConfigured()) throw new Error("Cloud backup is not configured in this build.");

  const session = await freshSession();
  if (!session) throw new Error("Sign in to restore.");
  const { uid, idToken } = session;

  const manifest = await readManifest(uid, idToken);
  if (!manifest) throw new Error("There is no backup on this account yet.");

  const docs = await listDocs(chunksCollection(uid), idToken);

  const byTable = new Map<string, Row[]>();
  for (const entry of manifest.chunks) {
    const doc = docs.get(entry.id);
    if (!doc || typeof doc.data !== "string") {
      throw new Error(`The backup is incomplete — chunk ${entry.id} is missing.`);
    }
    const rows = JSON.parse(doc.data) as Row[];
    byTable.set(entry.table, [...(byTable.get(entry.table) ?? []), ...rows]);
  }

  let tables = 0;
  let rows = 0;
  for (const [table, list] of byTable) {
    if (table === PREFS_TABLE) {
      const pairs = list
        .filter((r) => typeof r.k === "string" && typeof r.v === "string")
        .filter((r) => !(r.k as string).startsWith(LOCAL_ONLY_PREFIX))
        .map((r) => [r.k as string, r.v as string] as [string, string]);
      if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
      tables++;
      rows += pairs.length;
      continue;
    }
    if (!isBackupTable(table)) continue;
    rows += await restoreRows(table as BackupTable, list as Record<string, unknown>[]);
    tables++;
  }

  return { tables, rows, at: manifest.at };
}

/** Whether this account holds anything worth restoring, for the prompt on a
 *  fresh install. Cheap: one document read. */
export async function remoteBackupAt(): Promise<number | null> {
  const session = await freshSession();
  if (!session) return null;
  const manifest = await readManifest(session.uid, session.idToken);
  return manifest?.at ?? null;
}

// --------------------------------------------------------------------- auto

/**
 * The automatic path.
 *
 * Expo Go has no background execution — that needs a config plugin, which v1
 * rules out — so "automatic" here means opportunistic: on launch, and whenever
 * the app goes to the background, which is the moment after every write the
 * user was going to make. It fails silently on purpose. A backup is a
 * convenience layered on top of local storage that already worked, and an alert
 * about a flaky network while someone is mid-session would cost more than the
 * missed upload.
 */
export async function autoBackup(force = false): Promise<void> {
  try {
    if (!cloudConfigured()) return;
    const prefs = await loadBackupPrefs();
    if (!prefs.auto) return;
    if (!(await freshSession())) return;

    if (!force) {
      const { lastAt } = await backupState();
      if (lastAt && Date.now() - lastAt < AUTO_INTERVAL_MS) return;
    }
    await backupNow();
  } catch {
    // Recorded in backupState by run(); surfaced in Setup, nowhere else.
  }
}
