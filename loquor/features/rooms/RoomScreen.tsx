// One room: the card before, the debrief after.
//
// The same screen either side of the meeting, because they are the same object
// seen from two directions — the card asks "what will you do", the debrief asks
// "what did you do", and putting them side by side is the only way the gap
// between the two is ever visible.
//
// The debrief is spoken, not typed. Typing invites editing, and an edited
// account of a meeting is the account you wish were true. Ninety seconds out
// loud, immediately afterwards, is the only way the thing worth capturing —
// what you wish you had said — survives contact with your own ego.

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { Panel } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { Aperture, Failed, Working } from "../../components/kit/Recorder";
import { Masthead, Screen } from "../../components/kit/Screen";
import { Body, Display, Eyebrow, Hair, Meta } from "../../components/kit/Text";
import { Reveal } from "../../components/kit/motion";
import { useTake } from "../../components/useTake";
import { CHROME, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE } from "../../theme";
import { getRoom, saveDebrief, type RoomRow } from "../../lib/db";
import { judgeRoom, type RoomDebrief } from "./roomJudge";
import { getKey, loadSettings, resolve } from "../../lib/settings";
import { ARCHETYPES, archetype } from "../../content/archetypes";
import type { PrepCard } from "../../lib/coach";
import { cancel } from "./notify";

const CEILING_S = 120;

type Stage = "card" | "recording" | "working" | "error" | "done";

export default function Room() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [stage, setStage] = useState<Stage>("card");
  const [debrief, setDebrief] = useState<RoomDebrief | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const take = useTake();

  const load = useCallback(() => {
    (async () => {
      if (!id) return;
      const r = await getRoom(id);
      setRoom(r);
      if (r?.debrief_json) {
        setDebrief(JSON.parse(r.debrief_json) as RoomDebrief);
        setStage("done");
      }
    })();
  }, [id]);

  useFocusEffect(load);

  if (!room) {
    return (
      <Screen>
        <Masthead right="Room" />
        <Display>That room no longer exists.</Display>
        <GlowButton label="Back" tone="ghost" onPress={() => router.replace("/rooms")} />
      </Screen>
    );
  }

  const prep = JSON.parse(room.prep_json) as PrepCard;

  const begin = async () => {
    setFailure(null);
    await take.start();
    setStage("recording");
  };

  const finish = async () => {
    setStage("working");
    const t = await take.stop();
    if (!t) {
      setFailure(take.error ?? "The recording failed.");
      setStage("error");
      return;
    }

    try {
      const { judge: provider } = resolve(await loadSettings());
      const key = (await getKey(provider)) ?? "";
      const d = await judgeRoom(
        {
          title: room.title,
          decision: room.decision,
          archetypeMenu: ARCHETYPES.map((a) => ({ id: a.id, name: a.name, form: a.form })),
          transcript: t.text,
        },
        provider,
        key
      );

      await saveDebrief({
        id: room.id,
        debrief: d,
        spoke: d.spoke,
        questionsAsked: d.questions_asked,
        positionsTaken: d.positions_taken,
        turned: d.turned,
      });
      // The reminders have done their job; leaving them scheduled would nag
      // about a meeting already accounted for.
      await cancel(room.notification_id);

      setDebrief(d);
      setStage("done");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  if (stage === "working") return <Working right="Debrief" step="Reading it back" />;

  if (stage === "error") {
    return (
      <Failed
        right="Debrief"
        error={failure ?? "Something went wrong."}
        onRetry={() => {
          setFailure(null);
          take.clearError();
          setStage("card");
        }}
        onBack={() => router.replace("/rooms")}
      />
    );
  }

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead right="Debrief" />
        <Display style={s.liveTitle} numberOfLines={2}>
          {room.title}
        </Display>
        <Aperture
          level={take.level}
          seconds={take.seconds}
          ceilingS={CEILING_S}
          onStop={finish}
          hint="Tap to finish"
        />
        <View style={s.promptStack}>
          {DEBRIEF_PROMPTS.map((p) => (
            <Text key={p} style={s.prompt}>
              {p}
            </Text>
          ))}
        </View>
      </Screen>
    );
  }

  if (stage === "done" && debrief) {
    const suggested = archetype(debrief.suggested_archetype);
    return (
      <Screen>
        <Masthead right="Debrief" />
        <Eyebrow>{room.title.toUpperCase()}</Eyebrow>
        <Display>{debrief.headline}</Display>

        <View style={s.tallies}>
          <Tally label="Spoke" value={debrief.spoke ? "yes" : "no"} flaw={!debrief.spoke} />
          <Tally label="Questions" value={String(debrief.questions_asked)} />
          <Tally label="Positions" value={String(debrief.positions_taken)} />
          <Tally label="Turned it" value={debrief.turned ? "yes" : "no"} />
        </View>

        <Hair />

        <Eyebrow>What you didn&rsquo;t say</Eyebrow>
        <Body style={s.gap}>{debrief.unsaid}</Body>

        {suggested ? (
          <Panel>
            <Eyebrow>The move that would have opened it</Eyebrow>
            <Display style={s.smallDisplay}>{suggested.name}</Display>
            <Body>{suggested.form}</Body>
            <Meta>{suggested.cue}</Meta>
            <GlowButton
              label="Drill it now"
              onPress={() =>
                router.push({ pathname: "/playbook", params: { archetypeId: suggested.id } })
              }
            />
          </Panel>
        ) : null}

        {debrief.contributions.length > 0 ? (
          <>
            <Eyebrow>What you contributed</Eyebrow>
            <View style={{ gap: SPACE.sm }}>
              {debrief.contributions.map((c, i) => (
                <Reveal key={i} index={i} style={s.bullet}>
                  <View style={s.bulletTick} />
                  <Body style={{ flex: 1 }}>{c}</Body>
                </Reveal>
              ))}
            </View>
          </>
        ) : null}

        <Hair />
        <Eyebrow>The card you walked in with</Eyebrow>
        <Card prep={prep} muted />

        <GlowButton label="Back to rooms" tone="ghost" onPress={() => router.replace("/rooms")} />
      </Screen>
    );
  }

  // card
  const happened = room.at <= Date.now();
  return (
    <Screen>
      <Masthead right="Prep card" />
      <Eyebrow>{when(room.at)}</Eyebrow>
      <Display>{room.title}</Display>
      {room.decision ? <Body style={s.decision}>{room.decision}</Body> : null}

      <Hair />
      <Card prep={prep} />

      <Hair />
      <Meta>
        Nothing here is recorded in the room. When it is over, come back and talk for ninety
        seconds about what happened.
      </Meta>

      <GlowButton
        label={happened ? "Debrief — 90 seconds" : "Debrief early"}
        onPress={begin}
        disabled={!take.ready}
        tone={happened ? "primary" : "ghost"}
      />
      <GlowButton label="Back to rooms" tone="quiet" onPress={() => router.replace("/rooms")} />
    </Screen>
  );
}

const DEBRIEF_PROMPTS = [
  "What was actually decided?",
  "What did you say?",
  "What did you think of and not say?",
  "When did you nearly speak and stop yourself?",
];

function Card({ prep, muted }: { prep: PrepCard; muted?: boolean }) {
  return (
    <View style={{ gap: SPACE.md, opacity: muted ? 0.6 : 1 }}>
      <View>
        <Eyebrow>Your one intention</Eyebrow>
        <Body style={{ marginTop: 4 }}>{prep.intent}</Body>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <Eyebrow>Three questions to have loaded</Eyebrow>
        {/* Three questions, one at a time. You will only remember them if you
            read them as three things rather than as a paragraph. */}
        {prep.questions.map((q, i) => (
          <Reveal key={q.id} index={i} style={s.q}>
            <Text style={s.qNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.qName}>{q.name}</Text>
              <Text style={s.qForm}>{q.form}</Text>
              <Text style={s.qCue}>{q.cue}</Text>
            </View>
          </Reveal>
        ))}
      </View>

      {prep.scaffold ? (
        <View>
          <Eyebrow>If you have to argue</Eyebrow>
          <Text style={s.scName}>{prep.scaffold.name}</Text>
          <Text style={s.scSteps}>{prep.scaffold.steps.join("  →  ")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Tally({ label, value, flaw }: { label: string; value: string; flaw?: boolean }) {
  return (
    <View style={s.tally}>
      <Text style={[s.tallyValue, flaw && { color: SEMANTIC.flaw }]}>{value}</Text>
      <Text style={s.tallyLabel}>{label}</Text>
    </View>
  );
}

function when(at: number): string {
  const d = new Date(at);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`.toUpperCase();
}

const s = StyleSheet.create({
  decision: { color: CHROME.dust },
  liveTitle: { fontSize: 20, lineHeight: 26, color: CHROME.dust },
  smallDisplay: { fontSize: 20, lineHeight: 26 },
  gap: { color: CHROME.chalk },

  promptStack: { paddingBottom: SPACE.lg, gap: 4 },
  prompt: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.displayItalic, textAlign: "center" },

  q: { flexDirection: "row", gap: 12 },
  qNum: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.monoMedium, width: 16, ...TABULAR },
  qName: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium },
  qForm: { color: "#C9C3B6", fontSize: 14, lineHeight: 21, fontFamily: TYPE.displayItalic },
  qCue: { color: CHROME.dustDim, fontSize: 11, lineHeight: 17, fontFamily: TYPE.ui, marginTop: 2 },

  scName: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium, marginTop: 4 },
  scSteps: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.ui, marginTop: 2 },

  tallies: { flexDirection: "row", gap: SPACE.lg, flexWrap: "wrap" },
  tally: { gap: 2 },
  tallyValue: { color: CHROME.chalk, fontSize: 20, letterSpacing: -0.8, fontFamily: TYPE.monoMedium, ...TABULAR },
  tallyLabel: { color: CHROME.dustDim, fontSize: 11.5, fontFamily: TYPE.uiMedium },

  bullet: { flexDirection: "row", gap: 12 },
  bulletTick: { width: 1, alignSelf: "stretch", borderRadius: 1, backgroundColor: SURFACE.edgeLive },
});
