// The backup section of Setup.
//
// Everything else in Settings is a preference. This is the one place in the app
// that talks to a server at all, so it says plainly what leaves the phone and
// what does not, and it never moves data without being asked — automatic means
// automatic uploads, never automatic restores. A restore overwrites rows on
// this device, so it stays a deliberate act behind a confirmation.

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Body, Button, Eyebrow, Hair, Meta, Panel } from "./ui";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TYPE } from "../theme";
import { cloudConfigured, currentSession, signIn, signOut, signUp, type Session } from "../lib/cloud";
import {
  backupNow,
  backupState,
  loadBackupPrefs,
  restoreNow,
  saveBackupPrefs,
  type BackupPrefs,
  type BackupState,
} from "../lib/backup";

export function Backup() {
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<BackupPrefs | null>(null);
  const [state, setState] = useState<BackupState>({ lastAt: null, lastError: null });
  const [loaded, setLoaded] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, p, st] = await Promise.all([currentSession(), loadBackupPrefs(), backupState()]);
    setSession(s);
    setPrefs(p);
    setState(st);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!cloudConfigured()) {
    return (
      <>
        <Hair style={{ marginTop: SPACE.sm }} />
        <Eyebrow>BACKUP</Eyebrow>
        <Meta>This build has no backup project configured.</Meta>
      </>
    );
  }

  const run = async (label: string, work: () => Promise<string>) => {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      setNote(await work());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const authenticate = (mode: "in" | "up") =>
    run(mode === "in" ? "SIGNING IN" : "CREATING", async () => {
      if (!email.trim() || !password) throw new Error("Email and password, both.");
      const s = mode === "in" ? await signIn(email, password) : await signUp(email, password);
      // Held only as long as the form is on screen. Neither value is stored;
      // the refresh token that comes back is what persists, and it goes to the
      // same secure store the API keys live in.
      setPassword("");
      setEmail("");
      // A new account has nothing up there yet, so seed it immediately —
      // otherwise the first crash before the first auto backup loses the lot.
      const r = await backupNow();
      return `Signed in as ${s.email}. ${r.uploaded} chunks uploaded.`;
    });

  const setPref = async (patch: Partial<BackupPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await saveBackupPrefs(next);
  };

  return (
    <>
      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>BACKUP</Eyebrow>
      <Meta>
        Every session, take, drill, word schedule and weekly report, copied to your own Firebase
        project so a lost phone is an inconvenience rather than the end of the record. Your API
        keys are never included — they stay in the secure enclave on this device, and you paste
        them again after a restore.
      </Meta>

      {!loaded ? null : session ? (
        <>
          <View style={s.account}>
            <View style={s.dot} />
            <Text style={s.email}>{session.email}</Text>
          </View>

          <Panel>
            <View style={s.statusRow}>
              <Eyebrow>LAST BACKUP</Eyebrow>
              <Text style={s.stamp}>{state.lastAt ? ago(state.lastAt) : "never"}</Text>
            </View>
            {state.lastError ? <Text style={s.error}>{state.lastError}</Text> : null}
            <Button
              label={busy === "BACKING UP" ? "BACKING UP…" : "BACK UP NOW"}
              disabled={busy !== null}
              onPress={() =>
                run("BACKING UP", async () => {
                  const r = await backupNow();
                  return r.uploaded === 0
                    ? "Already up to date — nothing had changed."
                    : `${r.uploaded} uploaded, ${r.unchanged} unchanged.`;
                })
              }
            />
          </Panel>

          <Toggle
            title="Back up automatically"
            sub="On launch, and whenever you leave the app. Expo Go cannot run in the background, so nothing happens while Loquor is closed — and nothing can happen, because you are not speaking into it."
            on={prefs?.auto ?? true}
            onChange={(v) => setPref({ auto: v })}
          />

          <Toggle
            title="Include room debriefs"
            sub="Rooms is the only table holding anything about real meetings and real colleagues. Off by default: everything else is about you, this is about them."
            on={prefs?.includeRooms ?? false}
            onChange={(v) => setPref({ includeRooms: v })}
          />

          <Hair style={{ marginTop: SPACE.xs }} />
          <Eyebrow>NEW PHONE</Eyebrow>
          <Meta>
            Pulls the backup down and merges it in. Nothing local is deleted — a row only changes
            if the backup holds the same one.
          </Meta>
          <Button
            label={busy === "RESTORING" ? "RESTORING…" : "RESTORE FROM BACKUP"}
            tone="ghost"
            disabled={busy !== null}
            onPress={() =>
              Alert.alert(
                "Restore onto this phone?",
                "Sessions, takes and word schedules from the backup will be written over the ones here with matching ids. Anything this phone has that the backup does not is kept.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Restore",
                    onPress: () =>
                      void run("RESTORING", async () => {
                        const r = await restoreNow();
                        return `${r.rows} rows restored across ${r.tables} tables.`;
                      }),
                  },
                ]
              )
            }
          />

          <Button
            label="SIGN OUT"
            tone="quiet"
            disabled={busy !== null}
            onPress={() =>
              Alert.alert(
                "Sign out of backup?",
                "Your data stays on this phone and stays in the cloud. Automatic backups stop until you sign in again.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: () =>
                      void run("SIGNING OUT", async () => {
                        await signOut();
                        return "Signed out.";
                      }),
                  },
                ]
              )
            }
          />
        </>
      ) : (
        <Panel>
          <Body>
            One account, one archive. Use the same email on a new phone and everything comes back.
          </Body>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={CHROME.dustDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="password — at least six characters"
            placeholderTextColor={CHROME.dustDim}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Button
            label={busy === "CREATING" ? "CREATING…" : "CREATE ACCOUNT"}
            disabled={busy !== null}
            onPress={() => void authenticate("up")}
          />
          <Button
            label={busy === "SIGNING IN" ? "SIGNING IN…" : "I ALREADY HAVE ONE"}
            tone="ghost"
            disabled={busy !== null}
            onPress={() => void authenticate("in")}
          />
        </Panel>
      )}

      {busy ? (
        <View style={s.busy}>
          <ActivityIndicator size="small" color={CHROME.dust} />
          <Text style={s.busyLabel}>{busy}</Text>
        </View>
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {note && !error ? <Text style={s.note}>{note}</Text> : null}
    </>
  );
}

function Toggle({
  title,
  sub,
  on,
  onChange,
}: {
  title: string;
  sub: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={({ pressed }) => [s.toggle, pressed && { opacity: 0.7 }]}
    >
      <View style={s.toggleText}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <View style={[s.track, on && s.trackOn]}>
        <View style={[s.knob, on && s.knobOn]} />
      </View>
    </Pressable>
  );
}

/** Relative, because the exact minute of the last backup is never the question
 *  — "is it recent" is. */
function ago(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const s = StyleSheet.create({
  account: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: SPACE.xs },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: SEMANTIC.solid },
  email: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.uiMedium },

  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stamp: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.mono },

  input: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    borderRadius: RADIUS.soft,
    color: CHROME.chalk,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 13,
    fontFamily: TYPE.ui,
  },

  toggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: RADIUS.soft,
  },
  toggleText: { flex: 1, gap: 3 },
  toggleTitle: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.uiMedium },
  toggleSub: { color: CHROME.dustDim, fontSize: 12, lineHeight: 17, fontFamily: TYPE.ui },
  // A switch, not a checkbox: this is a state that stays on, not a choice made
  // once. Off is a recessed surface, on is lit.
  track: {
    width: 40,
    height: 24,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
    padding: 3,
    marginTop: 2,
  },
  trackOn: { backgroundColor: "rgba(224, 85, 63, 0.18)", borderColor: SEMANTIC.ember },
  knob: { width: 16, height: 16, borderRadius: RADIUS.pill, backgroundColor: CHROME.dustDim },
  knobOn: { backgroundColor: SEMANTIC.ember, alignSelf: "flex-end" },

  busy: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: SPACE.xs },
  busyLabel: { color: CHROME.dust, fontSize: 10, letterSpacing: 2, fontFamily: TYPE.uiSemi },
  error: { color: SEMANTIC.flaw, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui },
  note: { color: CHROME.dust, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui },
});
