// Settings.
//
// Two decisions and three secrets. The mode switch is the only thing most people
// will ever touch; the keys are here because Loquor has no backend and never
// wants one — you bring your own key, it stays in the secure enclave on this
// phone, and no cost of yours passes through anyone else.

import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import {
  Body,
  Button,
  Display,
  Eyebrow,
  Hair,
  Masthead,
  Meta,
  Panel,
  Reveal,
  Screen,
} from "../../components/ui";
import { CHROME, SEMANTIC, SPACE, TYPE } from "../../theme";
import { KEY_GUIDES, type KeyGuide } from "../../content/keyGuides";
import {
  DEFAULT_SETTINGS,
  getKey,
  loadSettings,
  maskKey,
  resolve,
  saveSettings,
  setKey,
  type Mode,
  type Provider,
  type Settings as SettingsShape,
} from "../../lib/settings";
import { resetAll } from "../../lib/db";
import {
  clearDaily,
  clearWeekly,
  clockLabel,
  getDaily,
  getWeekly,
  setDaily,
  setWeekly,
  type Repeating,
} from "../../lib/notify";

// A fixed set of times rather than a wheel picker. The exact minute does not
// change whether a habit sticks, and a free picker is one more decision on a
// screen whose whole job is to have as few as possible (PRD §7).
const DAILY_TIMES: [number, number][] = [
  [7, 30],
  [12, 30],
  [18, 30],
  [21, 0],
];
const WEEKLY_TIMES: [number, number][] = [
  [8, 0],
  [9, 0],
  [18, 0],
];

const MODES: { mode: Mode; title: string; sub: string }[] = [
  { mode: "free", title: "Free", sub: "Groq transcribes and judges. One key, no card." },
  { mode: "precision", title: "Precision", sub: "Deepgram counts fillers exactly, Claude judges harder." },
  { mode: "custom", title: "Custom", sub: "Mix them — exact filler counts, free judging, or the reverse." },
];

export default function Settings() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsShape>(DEFAULT_SETTINGS);
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({});
  const [editing, setEditing] = useState<Provider | null>(null);
  const [draft, setDraft] = useState("");
  const [openGuide, setOpenGuide] = useState<Provider | null>(null);
  const [daily, setDailyState] = useState<Repeating>(null);
  const [weekly, setWeeklyState] = useState<Repeating>(null);
  const [denied, setDenied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const s = await loadSettings();
        const entries = await Promise.all(
          (["groq", "anthropic", "deepgram"] as Provider[]).map(
            async (p) => [p, (await getKey(p)) ?? ""] as const
          )
        );
        const [d, w] = await Promise.all([getDaily(), getWeekly()]);
        if (!live) return;
        setSettings(s);
        setKeys(Object.fromEntries(entries) as Record<Provider, string>);
        setDailyState(d);
        setWeeklyState(w);
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const applyMode = async (mode: Mode) => {
    const next = { ...settings, mode };
    setSettings(next);
    await saveSettings(next);
  };

  const applyCustom = async (patch: Partial<SettingsShape>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
  };

  const commitKey = async (p: Provider) => {
    await setKey(p, draft);
    setKeys((prev) => ({ ...prev, [p]: draft.trim() }));
    setEditing(null);
    setDraft("");
  };

  const active = resolve(settings);
  const needed: Provider[] = Array.from(new Set([active.stt, active.judge]));

  return (
    <Screen>
      <Masthead right="SETTINGS" />

      <Eyebrow>WHO DOES THE WORK</Eyebrow>
      <View style={s.modes}>
        {/* The controls on this screen stay Pressables. A radio that squeezes
            under the thumb reads as a button that did something; these only
            select. Only their arrival is animated. */}
        {MODES.map((m, i) => {
          const on = settings.mode === m.mode;
          return (
            <Reveal key={m.mode} index={i}>
              <Pressable
                onPress={() => applyMode(m.mode)}
                style={({ pressed }) => [s.mode, on && s.modeOn, pressed && { opacity: 0.7 }]}
              >
                <View style={[s.radio, on && s.radioOn]} />
                <View style={s.modeText}>
                  <Text style={[s.modeTitle, on && { color: CHROME.chalk }]}>{m.title}</Text>
                  <Text style={s.modeSub}>{m.sub}</Text>
                </View>
              </Pressable>
            </Reveal>
          );
        })}
      </View>

      {settings.mode === "custom" ? (
        <Panel>
          <Eyebrow>TRANSCRIPTION</Eyebrow>
          <Segment
            options={[
              { value: "groq", label: "Groq — free, approximate fillers" },
              { value: "deepgram", label: "Deepgram — paid, exact fillers" },
            ]}
            value={settings.sttProvider}
            onChange={(v) => applyCustom({ sttProvider: v as SettingsShape["sttProvider"] })}
          />
          <Hair style={{ marginVertical: SPACE.xs }} />
          <Eyebrow>JUDGING</Eyebrow>
          <Segment
            options={[
              { value: "groq", label: "Groq — free" },
              { value: "anthropic", label: "Claude — paid, stricter" },
            ]}
            value={settings.judgeProvider}
            onChange={(v) => applyCustom({ judgeProvider: v as SettingsShape["judgeProvider"] })}
          />
        </Panel>
      ) : null}

      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>API KEYS</Eyebrow>
      <Meta>
        Stored in this phone&rsquo;s secure enclave. Never uploaded, never logged, never attached to
        an error report.
      </Meta>

      <View style={s.keys}>
        {KEY_GUIDES.map((g, i) => {
          const stored = keys[g.provider] ?? "";
          const inUse = needed.includes(g.provider);
          const isEditing = editing === g.provider;

          return (
            <Reveal key={g.provider} index={i} style={s.key}>
              <View style={s.keyHead}>
                <View style={s.keyName}>
                  <Text style={[s.keyTitle, !inUse && { color: CHROME.dustDim }]}>{g.name}</Text>
                  {inUse ? <View style={s.inUse} /> : null}
                </View>
                <Pressable
                  hitSlop={12}
                  onPress={() => setOpenGuide(openGuide === g.provider ? null : g.provider)}
                  accessibilityLabel={`How to get a ${g.name} API key`}
                >
                  <View style={[s.info, openGuide === g.provider && s.infoOn]}>
                    <Text style={[s.infoGlyph, openGuide === g.provider && { color: CHROME.floor }]}>
                      i
                    </Text>
                  </View>
                </Pressable>
              </View>

              {isEditing ? (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={g.prefix ? `${g.prefix}…` : "paste your key"}
                    placeholderTextColor={CHROME.dustDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    secureTextEntry
                    style={s.input}
                  />
                  <View style={s.keyActions}>
                    <Pressable onPress={() => commitKey(g.provider)} hitSlop={8}>
                      <Text style={s.action}>SAVE</Text>
                    </Pressable>
                    <Pressable onPress={() => { setEditing(null); setDraft(""); }} hitSlop={8}>
                      <Text style={[s.action, { color: CHROME.dustDim }]}>CANCEL</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => {
                    setEditing(g.provider);
                    setDraft("");
                  }}
                  style={({ pressed }) => [s.keySlot, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[s.keyValue, !stored && { color: CHROME.dustDim }]}>
                    {stored ? maskKey(stored) : "Not set"}
                  </Text>
                  <Text style={s.action}>{stored ? "REPLACE" : "ADD"}</Text>
                </Pressable>
              )}

              {openGuide === g.provider ? <Guide guide={g} /> : null}
            </Reveal>
          );
        })}
      </View>

      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>REMINDERS</Eyebrow>
      <Meta>
        Two at most, both off until you turn them on, and neither carries a number. Scheduled on
        this phone — Loquor has no server to send you anything from.
      </Meta>

      <Reminder
        title="Daily · ninety seconds"
        sub="One topic, out loud. It is over before the reluctance is."
        times={DAILY_TIMES}
        current={daily}
        onSet={async (h, m) => {
          const r = await setDaily(h, m);
          setDailyState(r);
          setDenied(r === null);
        }}
        onClear={async () => {
          await clearDaily();
          setDailyState(null);
        }}
      />

      <Reminder
        title="Monday · last week in figures"
        sub="What moved, what did not, and the one thing to do about it."
        times={WEEKLY_TIMES}
        current={weekly}
        onSet={async (h, m) => {
          const r = await setWeekly(h, m);
          setWeeklyState(r);
          setDenied(r === null);
        }}
        onClear={async () => {
          await clearWeekly();
          setWeeklyState(null);
        }}
      />

      {denied ? (
        <Text style={s.denied}>
          iOS refused notifications for Loquor. Settings → Notifications → Loquor, then try again.
        </Text>
      ) : null}

      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>YOUR RECORDINGS</Eyebrow>
      <Meta>
        Audio is deleted the moment it has been transcribed. Transcripts and scores stay on this
        phone in a local database — there is no server to delete them from.
      </Meta>
      <Button
        label="ERASE EVERYTHING"
        tone="ghost"
        onPress={() =>
          Alert.alert(
            "Erase all sessions?",
            "Every transcript, score, and trend goes. This cannot be undone.",
            [
              { text: "Keep them", style: "cancel" },
              {
                text: "Erase",
                style: "destructive",
                onPress: async () => {
                  await resetAll();
                  router.replace("/");
                },
              },
            ]
          )
        }
      />

      <Button label="BACK" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

function Reminder({
  title,
  sub,
  times,
  current,
  onSet,
  onClear,
}: {
  title: string;
  sub: string;
  times: [number, number][];
  current: Repeating;
  onSet: (hour: number, minute: number) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  return (
    <View style={s.reminder}>
      <View style={s.remHead}>
        <Text style={s.remTitle}>{title}</Text>
        <Pressable onPress={current ? onClear : () => onSet(...(times[0] as [number, number]))} hitSlop={8}>
          <Text style={[s.action, !current && { color: CHROME.dust }]}>
            {current ? "OFF" : "ON"}
          </Text>
        </Pressable>
      </View>
      <Text style={s.remSub}>{sub}</Text>
      {current ? (
        <View style={s.slots}>
          {times.map(([h, m]) => {
            const on = current.hour === h && current.minute === m;
            return (
              <Pressable
                key={`${h}:${m}`}
                onPress={() => onSet(h, m)}
                style={({ pressed }) => [s.slot, on && s.slotOn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.slotLabel, on && { color: CHROME.floor }]}>
                  {clockLabel(h, m)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Guide({ guide }: { guide: KeyGuide }) {
  return (
    <Panel style={{ marginTop: SPACE.sm }}>
      <Body style={{ fontSize: 14 }}>{guide.what}</Body>
      <Text style={g.cost}>{guide.cost}</Text>
      <Hair style={{ marginVertical: SPACE.xs }} />
      {/* The steps land in the order you will do them. */}
      {guide.steps.map((step, i) => (
        <Reveal key={i} index={i} style={g.step}>
          <Text style={g.stepNum}>{i + 1}</Text>
          <Text style={g.stepText}>{step}</Text>
        </Reveal>
      ))}
      <Text style={g.url}>{guide.url}</Text>
    </Panel>
  );
}

function Segment({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [s.segOpt, on && s.segOptOn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[s.segLabel, on && { color: CHROME.chalk }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  modes: { gap: 2 },
  mode: { flexDirection: "row", gap: 12, paddingVertical: 12, alignItems: "flex-start" },
  modeOn: {},
  radio: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: CHROME.dustDim,
    marginTop: 4,
  },
  radioOn: { backgroundColor: SEMANTIC.ember, borderColor: SEMANTIC.ember },
  modeText: { flex: 1, gap: 3 },
  modeTitle: { color: CHROME.dust, fontSize: 15, fontFamily: TYPE.uiMedium },
  modeSub: { color: CHROME.dustDim, fontSize: 12, lineHeight: 17, fontFamily: TYPE.ui },

  segment: { gap: 2 },
  segOpt: { paddingVertical: 9, paddingHorizontal: 10, borderLeftWidth: 2, borderLeftColor: "transparent" },
  segOptOn: { borderLeftColor: SEMANTIC.ember, backgroundColor: CHROME.floor },
  segLabel: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.ui },

  keys: { gap: SPACE.md, marginTop: SPACE.xs },
  key: { gap: SPACE.sm },
  keyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  keyName: { flexDirection: "row", alignItems: "center", gap: 8 },
  keyTitle: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium },
  inUse: { width: 5, height: 5, borderRadius: 3, backgroundColor: SEMANTIC.ember },
  info: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CHROME.carve,
    alignItems: "center",
    justifyContent: "center",
  },
  infoOn: { backgroundColor: CHROME.chalk, borderColor: CHROME.chalk },
  infoGlyph: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.displayItalic },

  keySlot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  keyValue: { color: CHROME.chalk, fontSize: 13, fontFamily: TYPE.ui },
  input: {
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    color: CHROME.chalk,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 13,
    fontFamily: TYPE.ui,
  },
  reminder: { gap: 6, paddingVertical: SPACE.xs },
  remHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  remTitle: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.uiMedium },
  remSub: { color: CHROME.dustDim, fontSize: 12, lineHeight: 17, fontFamily: TYPE.ui },
  slots: { flexDirection: "row", gap: 4, marginTop: 4 },
  slot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
  },
  slotOn: { backgroundColor: CHROME.chalk, borderColor: CHROME.chalk },
  slotLabel: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.ui },
  denied: { color: SEMANTIC.flaw, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui },

  keyActions: { flexDirection: "row", gap: SPACE.lg },
  action: { color: SEMANTIC.ember, fontSize: 10, letterSpacing: 2, fontFamily: TYPE.uiSemi },
});

const g = StyleSheet.create({
  cost: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui },
  step: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  stepNum: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui, width: 12, paddingTop: 2 },
  stepText: { color: "#C3D0D2", fontSize: 13, lineHeight: 19, flex: 1, fontFamily: TYPE.ui },
  url: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.displayItalic, marginTop: SPACE.xs },
});
