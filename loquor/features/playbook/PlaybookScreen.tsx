// The Playbook.
//
// Thirty question archetypes, each a shape you can carry into any meeting. The
// drill is one snippet, one named archetype, one question said out loud, and a
// verdict that includes what the room would most likely say back.
//
// That last part is the design decision worth defending. A score tells you the
// question was weak; a plausible reply tells you *how* it was weak — you watch
// your own question get deflected, and the lesson arrives as a consequence
// rather than as a rating. The trap line on every archetype does the same job
// before the fact: most of these questions asked badly read as hostile or as
// showing off, which is exactly the failure mode of someone trying to be noticed.
//
// The archetype and the snippet are chosen independently. Pairing each move with
// the meeting it suits best would teach that the move belongs to that kind of
// meeting; the skill is being able to reach for it anywhere.

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { ScoreBar } from "../../components/kit/Charts";
import { Panel } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { Aperture, Failed, Working } from "../../components/kit/Recorder";
import { Masthead, Screen } from "../../components/kit/Screen";
import { Body, Display, Eyebrow, Hair, Meta } from "../../components/kit/Text";
import { Reveal, Tap } from "../../components/kit/motion";
import { useTake } from "../../components/useTake";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE, heat } from "../../theme";
import { FAMILY_LABELS } from "../../content/archetypes";
import { archetypeStats, familyMap, nextDrill, record, type Assignment } from "../../lib/skillStore";
import { MASTERY_LABELS, type Mastery } from "../../lib/coach";
import { judgeQuestion, QUESTION_LABELS, type QuestionVerdict } from "./playbookJudge";
import { getKey, loadSettings, resolve } from "../../lib/settings";
import { saveDrill } from "../../lib/db";

const CEILING_S = 30;

type Stage = "brief" | "recording" | "working" | "error" | "verdict" | "map";

export default function Playbook() {
  const router = useRouter();
  const { archetypeId } = useLocalSearchParams<{ archetypeId?: string }>();

  const [stage, setStage] = useState<Stage>("brief");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [verdict, setVerdict] = useState<QuestionVerdict | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof archetypeStats>>>([]);
  const [families, setFamilies] = useState<Awaited<ReturnType<typeof familyMap>>>([]);

  const take = useTake();

  const load = useCallback(() => {
    (async () => {
      setAssignment(await nextDrill(archetypeId));
      setStats(await archetypeStats());
      setFamilies(await familyMap());
    })();
  }, [archetypeId]);

  useFocusEffect(load);

  const deal = async () => {
    setVerdict(null);
    setAssignment(await nextDrill());
    setStage("brief");
  };

  /** Pick a specific move off the map. The scenario is still dealt, not chosen. */
  const pick = async (id: string) => {
    setVerdict(null);
    setAssignment(await nextDrill(id));
    setStage("brief");
  };

  const begin = async () => {
    setFailure(null);
    await take.start();
    setStage("recording");
  };

  const finish = async () => {
    if (!assignment) return;
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
      const v = await judgeQuestion(
        {
          archetype: assignment.archetype,
          scenario: assignment.scenario,
          transcript: t.text,
        },
        provider,
        key
      );

      await saveDrill({
        id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        kind: "playbook",
        itemId: assignment.archetype.id,
        contextId: assignment.scenario.id,
        provider,
        transcript: t.text,
        score: v.score,
        verdict: v,
      });
      await record("archetype", assignment.archetype.id, v.score);

      setVerdict(v);
      setStage("verdict");
      setStats(await archetypeStats());
      setFamilies(await familyMap());
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  if (stage === "working") return <Working right="Playbook" step="Weighing the question" />;

  if (stage === "error") {
    return (
      <Failed
        right="Playbook"
        error={failure ?? "Something went wrong."}
        onRetry={() => {
          setFailure(null);
          take.clearError();
          setStage("brief");
        }}
        onBack={() => router.replace("/")}
      />
    );
  }

  if (stage === "map") {
    return (
      <Screen>
        <Masthead right="Playbook" />
        <Eyebrow>Thirty moves</Eyebrow>
        <Display>
          {stats.filter((x) => x.mastery !== "untried").length} tried,{" "}
          {stats.filter((x) => x.mastery === "solid").length} solid.
        </Display>

        {/* A family at a time, not thirty rows at once — the map is read as
            five groups and that is how it should arrive. */}
        {families.map((f, i) => (
          <Reveal key={f.family} index={i} style={{ gap: SPACE.sm }}>
            <View style={s.famHead}>
              <Eyebrow>{FAMILY_LABELS[f.family].toUpperCase()}</Eyebrow>
              <Text style={s.famCount}>
                {f.tried}/{f.total}
              </Text>
            </View>
            {stats
              .filter((x) => x.archetype.family === f.family)
              .map((x) => (
                <Tap
                  key={x.archetype.id}
                  style={s.mapRow}
                  onPress={() => pick(x.archetype.id)}
                >
                  <View style={[s.pip, { backgroundColor: pip(x.mastery, x.state?.ewma) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.mapName}>{x.archetype.name}</Text>
                    <Text style={s.mapForm} numberOfLines={1}>
                      {x.archetype.form}
                    </Text>
                  </View>
                  <Text style={s.mapState}>
                    {x.state ? x.state.ewma.toFixed(1) : MASTERY_LABELS.untried}
                  </Text>
                </Tap>
              ))}
          </Reveal>
        ))}

        <GlowButton label="Back to the drill" tone="ghost" onPress={() => setStage("brief")} />
      </Screen>
    );
  }

  if (!assignment) {
    return (
      <Screen>
        <Masthead right="Playbook" />
        <Display>Loading the deck.</Display>
      </Screen>
    );
  }

  const { archetype: a, scenario } = assignment;

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead right="Playbook" />
        <Display style={s.liveName} numberOfLines={2}>
          {a.name}
        </Display>
        <Aperture
          level={take.level}
          seconds={take.seconds}
          ceilingS={CEILING_S}
          onStop={finish}
          hint="One question — tap when done"
        />
        <Text style={s.liveForm}>{a.form}</Text>
      </Screen>
    );
  }

  if (stage === "verdict" && verdict) {
    return (
      <Screen>
        <Masthead right="Playbook" />
        <Eyebrow>{a.name.toUpperCase()}</Eyebrow>
        <Display>{verdict.verdict}</Display>

        <View style={{ gap: SPACE.md }}>
          {QUESTION_LABELS.map((l, i) => (
            <Reveal key={l.key} index={i}>
              <ScoreBar label={l.label} hint={l.hint} score={verdict.scores[l.key]} />
            </Reveal>
          ))}
        </View>

        <Hair />

        <Panel>
          <Eyebrow>What you asked</Eyebrow>
          <Body style={s.heard}>{verdict.heard}</Body>
          <Eyebrow style={{ marginTop: SPACE.sm }}>What they&rsquo;d say back</Eyebrow>
          <Body style={{ color: CHROME.dust }}>{verdict.likely_reply}</Body>
        </Panel>

        <Panel glow={SEMANTIC.ember}>
          <Eyebrow style={{ color: SEMANTIC.ember }}>Ask it like this</Eyebrow>
          <Body style={s.model}>{verdict.model_question}</Body>
        </Panel>

        <GlowButton label="Next drill" onPress={deal} />
        <GlowButton label="The map" tone="ghost" onPress={() => setStage("map")} />
        <GlowButton label="Back home" tone="quiet" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  // brief
  return (
    <Screen>
      <Masthead right="Playbook" />

      <View style={s.headRow}>
        <Eyebrow>{FAMILY_LABELS[a.family].toUpperCase()}</Eyebrow>
        <Pressable onPress={() => setStage("map")}>
          <Text style={s.mapLink}>The map</Text>
        </Pressable>
      </View>

      <Display>{a.name}</Display>
      <Body style={s.form}>{a.form}</Body>
      <Meta>{a.cue}</Meta>

      <Hair />

      <Eyebrow>{scenario.setting.toUpperCase()}</Eyebrow>
      <Panel>
        <Body style={s.transcript}>&ldquo;{scenario.transcript}&rdquo;</Body>
      </Panel>

      <Panel glow={SEMANTIC.flaw}>
        <Eyebrow style={{ color: SEMANTIC.flaw }}>The trap</Eyebrow>
        <Body>{a.trap}</Body>
      </Panel>

      <Hair />
      <Meta>
        One question. Out loud. No preamble — the version you would actually say in the room, not
        the version you would write down.
      </Meta>

      <GlowButton label="Ask it" onPress={begin} disabled={!take.ready} />
      <GlowButton label="Different drill" tone="ghost" onPress={deal} />
      <GlowButton label="Back home" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

/** Untried is chrome, not colour — an unattempted move is absence of data. */
function pip(m: Mastery, ewma?: number): string {
  if (m === "untried") return CHROME.carve;
  return heat(Math.max(0, Math.min(1, (ewma ?? 0) / 4)));
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mapLink: { color: CHROME.dustDim, fontSize: 11.5, fontFamily: TYPE.uiMedium },

  form: { fontFamily: TYPE.displayItalic, fontSize: 17, lineHeight: 25, color: CHROME.chalk },
  transcript: { fontFamily: TYPE.displayItalic, color: "#C9C3B6" },
  heard: { color: CHROME.chalk },
  model: { color: CHROME.chalk, fontFamily: TYPE.displayItalic, fontSize: 16, lineHeight: 24 },

  liveName: { fontSize: 20, lineHeight: 26, color: CHROME.chalk },
  liveForm: {
    color: CHROME.dust,
    fontSize: 13,
    fontFamily: TYPE.displayItalic,
    textAlign: "center",
    paddingBottom: SPACE.lg,
  },

  famHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  famCount: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  mapRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  pip: { width: 5, height: 5, borderRadius: 3 },
  mapName: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
  mapForm: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },
  mapState: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.monoMedium, ...TABULAR },
});
