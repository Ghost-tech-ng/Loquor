// Rooms.
//
// The list, and the form that creates one. Two things and no more: a room is a
// title, a decision on the table, and a time — because anything else is meeting
// admin, and there are already applications for that.
//
// What is deliberately absent: attendees, notes, an agenda, and any way to
// record. Loquor never records a real meeting. The rooms table is the only place
// in the app that touches other people, so it holds as little about them as
// possible — which is nothing.

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Body, Button, Display, Eyebrow, Hair, Masthead, Meta, Panel, Reveal, Screen, Tap } from "../../components/ui";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE } from "../../theme";
import { contributionRaw, createRoom, pendingDebriefs, recentRooms, type RoomRow } from "../../lib/db";
import { funnel, ratio } from "../../lib/coach";
import { prepFor } from "../../lib/skillStore";
import { packIds, scheduleRoom } from "../../lib/notify";

const WINDOW_MS = 90 * 86_400_000;

/** Offered instead of a date picker: a room you are prepping for is imminent. */
const WHEN = [
  { label: "IN 1H", ms: 3_600_000 },
  { label: "IN 3H", ms: 3 * 3_600_000 },
  { label: "TOMORROW 10AM", ms: -1 },
  { label: "IN 2 DAYS", ms: 2 * 86_400_000 },
] as const;

function tomorrowTen(now = Date.now()): number {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
}

export default function Rooms() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [pending, setPending] = useState<RoomRow[]>([]);
  const [f, setF] = useState(funnel({ entered: 0, spoke: 0, questions: 0, positions: 0, turned: 0 }));

  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [whenIdx, setWhenIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    (async () => {
      const [list, due, raw] = await Promise.all([
        recentRooms(30),
        pendingDebriefs(),
        contributionRaw(Date.now() - WINDOW_MS),
      ]);
      setRooms(list);
      setPending(due);
      setF(funnel(raw));
    })();
  }, []);

  useFocusEffect(load);

  const create = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const choice = WHEN[whenIdx]!;
      const at = choice.ms === -1 ? tomorrowTen() : Date.now() + choice.ms;
      const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

      // The card is built at creation, not at open time, so the questions you
      // were given are the questions you get — a card that quietly changed
      // between prepping and walking in would be worse than no card.
      const prep = await prepFor(decision.trim());
      const scheduled = await scheduleRoom({ roomId: id, title: title.trim(), at });

      await createRoom({
        id,
        title: title.trim(),
        decision: decision.trim(),
        at,
        prep,
        notificationId: packIds(scheduled),
      });

      setTitle("");
      setDecision("");
      setOpen(false);
      router.push({ pathname: "/room", params: { id } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Masthead right="ROOMS" />

      {pending.length > 0 ? (
        <Reveal index={0}>
        <Panel style={{ borderColor: SEMANTIC.ember }}>
          <Eyebrow style={{ color: SEMANTIC.ember }}>
            {pending.length} DEBRIEF{pending.length === 1 ? "" : "S"} WAITING
          </Eyebrow>
          <Body>
            {pending[0]!.title}. Ninety seconds while you still remember what you did not say.
          </Body>
          <Button
            label="DEBRIEF NOW"
            onPress={() => router.push({ pathname: "/room", params: { id: pending[0]!.id } })}
          />
        </Panel>
        </Reveal>
      ) : null}

      <Eyebrow>CONTRIBUTION — LAST 90 DAYS</Eyebrow>
      <Display>{f.headline}</Display>

      {/* The funnel fills top down, which is the direction you fall out of it. */}
      <View style={s.funnel}>
        {f.stages.map((st, i) => (
          <Reveal key={st.key} index={i + 1} style={s.stage}>
            <View style={s.stageHead}>
              <Text style={s.stageLabel}>{st.label}</Text>
              <Text style={s.stageCount}>{st.count}</Text>
            </View>
            {i > 0 ? (
              <Text
                style={[
                  s.stageRatio,
                  f.bottleneck?.key === st.key && { color: SEMANTIC.flaw },
                ]}
              >
                {ratio(st.ofPrevious)}
                {f.bottleneck?.key === st.key ? "  ← where you fall out" : ""}
              </Text>
            ) : null}
          </Reveal>
        ))}
      </View>

      <Hair />

      {open ? (
        <Panel>
          <Eyebrow>NEW ROOM</Eyebrow>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Architecture sync"
            placeholderTextColor={CHROME.dustDim}
            autoCapitalize="sentences"
          />
          <Meta>What is actually being decided? This is what the card aims at.</Meta>
          <TextInput
            style={[s.input, s.inputTall]}
            value={decision}
            onChangeText={setDecision}
            placeholder="Whether we move payments to the new queue this quarter"
            placeholderTextColor={CHROME.dustDim}
            multiline
          />

          <View style={s.whenRow}>
            {WHEN.map((w, i) => (
              <Pressable key={w.label} onPress={() => setWhenIdx(i)} style={[s.chip, i === whenIdx && s.chipOn]}>
                <Text style={[s.chipText, i === whenIdx && s.chipTextOn]}>{w.label}</Text>
              </Pressable>
            ))}
          </View>

          <Meta>
            No audio, no attendees, no notes. Loquor never records a real meeting — you tell it
            what happened afterwards, and only what you said is kept.
          </Meta>
          <Button label={saving ? "SAVING" : "BUILD MY CARD"} onPress={create} disabled={!title.trim() || saving} />
          <Button label="CANCEL" tone="quiet" onPress={() => setOpen(false)} />
        </Panel>
      ) : (
        <Button label="NEW ROOM" onPress={() => setOpen(true)} />
      )}

      {rooms.length > 0 ? (
        <>
          <Eyebrow>HISTORY</Eyebrow>
          <View style={{ gap: 0 }}>
            {rooms.map((r, i) => (
              <Reveal key={r.id} index={i}>
                <Tap
                  onPress={() => router.push({ pathname: "/room", params: { id: r.id } })}
                  style={s.row}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={s.rowMeta}>{describe(r)}</Text>
                  </View>
                  <Text style={[s.rowState, stateTint(r)]}>{stateLabel(r)}</Text>
                </Tap>
              </Reveal>
            ))}
          </View>
        </>
      ) : null}

      <Button label="BACK TO TODAY" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

function describe(r: RoomRow): string {
  const d = new Date(r.at);
  const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (r.debriefed_at === null) return `${when}, ${time}`;
  const bits = [`${r.questions_asked ?? 0}Q`, `${r.positions_taken ?? 0}P`];
  if (r.turned) bits.push("turned");
  return `${when} · ${bits.join(" · ")}`;
}

function stateLabel(r: RoomRow): string {
  if (r.debriefed_at !== null) return r.spoke ? "SPOKE" : "SILENT";
  return r.at <= Date.now() ? "DEBRIEF" : "UPCOMING";
}

function stateTint(r: RoomRow) {
  if (r.debriefed_at !== null) return { color: r.spoke ? CHROME.dust : SEMANTIC.flaw };
  return { color: r.at <= Date.now() ? SEMANTIC.ember : CHROME.dustDim };
}

const s = StyleSheet.create({
  funnel: { gap: SPACE.sm },
  stage: { gap: 2 },
  stageHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  stageLabel: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
  stageCount: { color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.monoMedium, ...TABULAR },
  stageRatio: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },

  input: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    color: CHROME.chalk,
    fontSize: 15,
    fontFamily: TYPE.ui,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: RADIUS.soft,
  },
  inputTall: { minHeight: 72, textAlignVertical: "top" },

  whenRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  chipOn: { borderColor: SEMANTIC.ember, backgroundColor: "rgba(224, 85, 63, 0.1)" },
  chipText: { color: CHROME.dust, fontSize: 10, letterSpacing: 1.4, fontFamily: TYPE.uiMedium },
  chipTextOn: { color: SEMANTIC.ember },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE.edge,
  },
  rowTitle: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.ui },
  rowMeta: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  rowState: { fontSize: 9, letterSpacing: 1.6, fontFamily: TYPE.uiSemi },
});
