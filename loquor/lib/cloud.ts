// Firebase over plain HTTP.
//
// Deliberately not the `firebase` npm package. Three reasons, in order: the JS
// SDK needs `experimentalForceLongPolling` to talk to Firestore from React
// Native at all, its React Native auth persistence has broken across several
// releases, and it costs a few hundred kilobytes of a bundle that has to keep
// running inside Expo Go with no native build to fall back on. What we actually
// need is four endpoints, and SQLite is already the offline store, so the SDK's
// offline queue would be redundant machinery.
//
// The security model is unchanged by this choice. Firestore rules are enforced
// server-side and apply identically to REST.
//
// The web API key below is a project identifier, not a secret — Firebase ships
// it inside every web bundle by design and it grants nothing on its own. What
// protects the data is that every path is scoped to the caller's own uid and
// the security rules refuse anything else. It is written here rather than in an
// EXPO_PUBLIC_ variable or app.json `extra` for exactly that reason: those
// exist to keep values out of source and to vary them per environment, and this
// value needs neither. A single literal is one source of truth that cannot go
// missing from a manifest.
//
// It is NOT where an API key would go. Groq, Anthropic and Deepgram keys are
// the user's, live in expo-secure-store, and are never written down anywhere in
// this repository.

import * as SecureStore from "expo-secure-store";

import { decodeFields, encodeFields, type Cell, type Row } from "./backupCore.ts";

type FirebaseConfig = { apiKey: string; projectId: string };

const CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyClc05ykWEZGqM6D1MTrf20frqkh5sDGFs",
  projectId: "loquor-2dec5",
};

const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const SECURETOKEN = "https://securetoken.googleapis.com/v1/token";

const SESSION_SLOT = "loquor.cloud.session";

/** Refresh this far ahead of expiry so a long upload cannot expire mid-flight. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type Session = {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  /** Absolute epoch ms. */
  expiresAt: number;
};

export function cloudConfigured(): boolean {
  return Boolean(CONFIG?.apiKey && CONFIG?.projectId);
}

function config(): FirebaseConfig {
  if (!CONFIG?.apiKey || !CONFIG?.projectId) {
    throw new Error("Cloud backup is not configured in this build.");
  }
  return CONFIG;
}

function documentsBase(): string {
  return `https://firestore.googleapis.com/v1/projects/${config().projectId}/databases/(default)/documents`;
}

// ------------------------------------------------------------------- errors

/**
 * Firebase returns machine codes. Left raw they are alarming and useless — a
 * user who mistypes a password should not be told INVALID_LOGIN_CREDENTIALS.
 * The two that matter most are the setup ones: they tell you a console step was
 * missed, which is otherwise very hard to guess from the app.
 */
function humanise(code: string): string {
  switch (code.split(" ")[0]) {
    case "EMAIL_EXISTS":
      return "That email already has a backup account. Sign in instead.";
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
      return "That email and password don't match an account.";
    case "WEAK_PASSWORD":
      return "Password must be at least six characters.";
    case "INVALID_EMAIL":
      return "That doesn't look like an email address.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Wait a few minutes and try again.";
    case "OPERATION_NOT_ALLOWED":
      return "Email sign-in is switched off in the Firebase console. Enable Authentication → Email/Password.";
    case "PERMISSION_DENIED":
      return "Firestore refused the write. Check the security rules are published.";
    case "NOT_FOUND":
      return "That Firestore database doesn't exist yet. Create it in the Firebase console.";
    default:
      return code;
  }
}

async function readError(res: Response): Promise<string> {
  // The body may be echoed. The request never is — on the auth endpoints it
  // carries the password, and on Firestore it carries a bearer token.
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } };
    const code = body.error?.message ?? body.error?.status ?? String(res.status);
    return humanise(code);
  } catch {
    return `Firebase returned ${res.status}.`;
  }
}

// -------------------------------------------------------------------- auth

type TokenResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email: string;
};

async function identity(method: "signUp" | "signInWithPassword", email: string, password: string) {
  const res = await fetch(`${IDENTITY}:${method}?key=${config().apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(await readError(res));

  const body = (await res.json()) as TokenResponse;
  const session: Session = {
    uid: body.localId,
    email: body.email,
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    expiresAt: Date.now() + Number(body.expiresIn) * 1000,
  };
  await saveSession(session);
  return session;
}

export const signUp = (email: string, password: string) => identity("signUp", email, password);
export const signIn = (email: string, password: string) =>
  identity("signInWithPassword", email, password);

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_SLOT);
}

// The refresh token is a credential, so it lives where credentials live. Note
// this is the one thing here that touches SecureStore, and it goes in the same
// direction as everything else in that store: onto the device, never off it.
async function saveSession(s: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_SLOT, JSON.stringify(s));
}

export async function currentSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_SLOT);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * A session guaranteed usable for the next few minutes.
 *
 * An expired refresh token means the account was disabled or the password
 * changed elsewhere; the stored session is cleared so the UI falls back to the
 * signed-out state rather than looping on a token it can never renew.
 */
export async function freshSession(): Promise<Session | null> {
  const s = await currentSession();
  if (!s) return null;
  if (s.expiresAt - REFRESH_MARGIN_MS > Date.now()) return s;

  const res = await fetch(`${SECURETOKEN}?key=${config().apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
  });
  if (!res.ok) {
    await signOut();
    return null;
  }

  const body = (await res.json()) as {
    id_token: string;
    refresh_token: string;
    expires_in: string;
    user_id: string;
  };
  const next: Session = {
    ...s,
    uid: body.user_id,
    idToken: body.id_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + Number(body.expires_in) * 1000,
  };
  await saveSession(next);
  return next;
}

// --------------------------------------------------------------- firestore

async function authed(path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`${documentsBase()}/${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

/** Null when the document does not exist — an absent backup is not an error. */
export async function getDoc(path: string, token: string): Promise<Row | null> {
  const res = await authed(path, { method: "GET" }, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { fields?: Record<string, unknown> };
  return decodeFields(body.fields);
}

/** PATCH with no updateMask replaces the document wholesale, which is what a
 *  snapshot wants: no field of a previous backup survives into this one. */
export async function setDoc(path: string, fields: Record<string, Cell>, token: string): Promise<void> {
  const res = await authed(
    path,
    { method: "PATCH", body: JSON.stringify({ fields: encodeFields(fields) }) },
    token
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteDoc(path: string, token: string): Promise<void> {
  const res = await authed(path, { method: "DELETE" }, token);
  // 404 means it is already gone, which is the state we were asking for.
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}

/** Every document in a collection, following pagination to the end. */
export async function listDocs(collection: string, token: string): Promise<Map<string, Row>> {
  const out = new Map<string, Row>();
  let pageToken: string | undefined;

  do {
    const q = `?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await authed(`${collection}${q}`, { method: "GET" }, token);
    if (res.status === 404) return out;
    if (!res.ok) throw new Error(await readError(res));

    const body = (await res.json()) as {
      documents?: { name: string; fields?: Record<string, unknown> }[];
      nextPageToken?: string;
    };
    for (const d of body.documents ?? []) {
      const id = d.name.split("/").pop();
      if (id) out.set(id, decodeFields(d.fields));
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return out;
}
