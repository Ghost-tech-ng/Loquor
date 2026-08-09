// The Persuasion Lab.
//
// Two drills that look unrelated and are not. Arguing and networking both fail
// the same way — the shape of what you say is decided while you are already
// speaking — and both are fixed by having a structure ready before you open your
// mouth. The Argument drill trains the structure of a case; the Room drill
// trains the structure of a first conversation.
//
// The Argument drill scores each STEP separately rather than the case as a
// whole, because "that was unconvincing" cannot be practised and "you never gave
// an example" can.
//
// The Room drill is the only warm model in the app. The counterpart is played in
// character, guards the one interesting thing they know, and only says it when a
// question earns it. The score that matters is not whether the chat went well —
// it is how many turns it took to get past the name badge, and whether you asked
// more than you told.

import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Speech from "expo-speech";

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
  Tap,
} from "../components/ui";
import { Aperture, Failed, ScoreBar, Working } from "../components/recorder";
import { useTake } from "../components/useTake";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE } from "../theme";
import { COUNTERPARTS, MOVES, type Counterpart, type Scaffold } from "../content/scaffolds";
import { pickTopic, type Topic } from "../content/topics";
import { nextScaffold, record } from "../lib/skillStore";
import { saveDrill, usedContextIds } from "../lib/db";
import { judgeScaffold, type ScaffoldVerdict } from "../lib/scaffoldJudge";
import {
  ROLEPLAY_LABELS,
  reply,
  scoreRoleplay,
  type Exchange,
  type RoleplayResult,
} from "../lib/roleplay";
import { getKey, loadSettings, resolve } from "../lib/settings";

const ARGUE_CEILING_S = 90;
const TURN_CEILING_S = 30;
/** Below this the conversation is too short to say anything about. */
const MIN_EXCHANGES = 3;

type Mode = "menu" | "argue" | "room";

export default function Lab() {
  const [mode, setMode] = useState<Mode>("menu");
  const router = useRouter();

  if (mode === "argue") return <Argue onExit={() => setMode("menu")} />;
  if (mode === "room") return <Room onExit={() => setMode("menu")} />;

  return (
    <Screen>
      <Masthead right="THE LAB" />
      <Eyebrow>PERSUASION</Eyebrow>
      <Display>Two ways of being listened to.</Display>

      <Reveal index={0}>
      <Tap onPress={() => setMode("argue")}>
        <Panel>
          <Eyebrow>THE ARGUMENT</Eyebrow>
          <Display style={s.cardTitle}>Make the case in ninety seconds.</Display>
          <Body>
            A position, a named structure, and one take. Scored step by step, so you find out which
            ninety seconds to record again.
          </Body>
        </Panel>
      </Tap>
      </Reveal>

      <Reveal index={1}>
      <Tap onPress={() => setMode("room")}>
        <Panel>
          <Eyebrow>THE ROOM</Eyebrow>
          <Display style={s.cardTitle}>Get past the name badge.</Display>
          <Body>
            A stranger with something worth hearing and no intention of volunteering it. Measured on
            how many turns it took, and whether you asked more than you told.
          </Body>
        </Panel>
      </Tap>
      </Reveal>

      <Hair />
      <Eyebrow>FOUR MOVES THAT WORK ANYWHERE</Eyebrow>
      <View style={{ gap: SPACE.md }}>
        {MOVES.map((m, i) => (
          <Reveal key={m.id} index={i + 2} style={{ gap: 3 }}>
            <Text style={s.moveName}>{m.name}</Text>
            <Text style={s.moveForm}>&ldquo;{m.form}&rdquo;</Text>
            <Text style={s.moveWhy}>{m.why}</Text>
          </Reveal>
        ))}
      </View>

      <Button label="BACK TO TODAY" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

// ── the argument drill ────────────────────────────────────────────────────────

type ArgueStage = "brief" | "recording" | "working" | "error" | "verdict";

function Argue({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<ArgueStage>("brief");
  const [scaffold, setScaffold] = useState<Scaffold | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [side, setSide] = useState<"for" | "against">("for");
  const [verdict, setVerdict] = useState<ScaffoldVerdict | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);

  const take = useTake();

  const deal = useCallback(async () => {
    const used = await usedContextIds("scaffold");
    setScaffold(await nextScaffold());
    setTopic(pickTopic({ usedIds: used }));
    setVerdict(null);
    setShowExample(false);
    setStage("brief");
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!scaffold) void deal();
    }, [scaffold, deal])
  );

  if (!scaffold || !topic) {
    return (
      <Screen>
        <Masthead right="THE ARGUMENT" />
        <Display>Setting the question.</Display>
      </Screen>
    );
  }

  const position = `${side === "for" ? "YES" : "NO"} — ${topic.title}`;

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
      const v = await judgeScaffold(
        { scaffold, position, transcript: t.text },
        provider,
        key
      );
      await saveDrill({
        id: rowId(),
        kind: "scaffold",
        itemId: scaffold.id,
        contextId: topic.id,
        provider,
        transcript: t.text,
        score: v.score,
        verdict: v,
      });
      await record("scaffold", scaffold.id, v.score);
      setVerdict(v);
      setStage("verdict");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  if (stage === "working") return <Working right="THE ARGUMENT" step="Taking it apart" />;

  if (stage === "error") {
    return (
      <Failed
        right="THE ARGUMENT"
        error={failure ?? "Something went wrong."}
        onRetry={() => {
          setFailure(null);
          take.clearError();
          setStage("brief");
        }}
        onBack={onExit}
      />
    );
  }

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead right={scaffold.name.toUpperCase()} />
        <Display style={s.livePosition} numberOfLines={3}>
          {position}
        </Display>
        <Aperture
          level={take.level}
          seconds={take.seconds}
          ceilingS={ARGUE_CEILING_S}
          onStop={finish}
          hint="TAP WHEN YOU HAVE LANDED IT"
        />
        <View style={s.stepStrip}>
          {scaffold.steps.map((st) => (
            <Text key={st.label} style={s.stepChip}>
              {st.label}
            </Text>
          ))}
        </View>
      </Screen>
    );
  }

  if (stage === "verdict" && verdict) {
    return (
      <Screen>
        <Masthead right={scaffold.name.toUpperCase()} />
        <Eyebrow>{verdict.in_order ? "IN ORDER" : "OUT OF ORDER"}</Eyebrow>
        <Display>{verdict.headline}</Display>

        <View style={{ gap: SPACE.lg }}>
          {verdict.steps.map((st, i) => (
            <Reveal key={`${st.label}-${i}`} index={i} style={{ gap: 6 }}>
              <ScoreBar label={st.label} score={st.score} />
              {st.heard ? <Text style={s.heard}>&ldquo;{st.heard}&rdquo;</Text> : null}
              <Text style={[s.note, st.score === 0 && { color: SEMANTIC.flaw }]}>{st.note}</Text>
            </Reveal>
          ))}
        </View>

        {!verdict.in_order ? (
          <Panel style={{ borderColor: SEMANTIC.flaw }}>
            <Eyebrow style={{ color: SEMANTIC.flaw }}>SEQUENCE</Eyebrow>
            <Body>
              The moves were there but not in the scaffold&rsquo;s order, which changes what they
              mean. {scaffold.trap}
            </Body>
          </Panel>
        ) : null}

        <Panel style={{ borderColor: SEMANTIC.ember }}>
          <Eyebrow style={{ color: SEMANTIC.ember }}>ARGUED TO THE SCAFFOLD</Eyebrow>
          <Body style={s.model}>{verdict.model_argument}</Body>
        </Panel>

        <Button label="ANOTHER" onPress={deal} />
        <Button label="BACK TO THE LAB" tone="ghost" onPress={onExit} />
      </Screen>
    );
  }

  // brief
  return (
    <Screen>
      <Masthead right="THE ARGUMENT" />
      <Eyebrow>{scaffold.gloss.toUpperCase()}</Eyebrow>
      <Display>{scaffold.name}</Display>
      <Meta>{scaffold.when}</Meta>

      <Hair />

      <Eyebrow>THE QUESTION</Eyebrow>
      <Body style={s.question}>{topic.title}</Body>
      <View style={s.sideRow}>
        {(["for", "against"] as const).map((v) => (
          <Pressable key={v} onPress={() => setSide(v)} style={[s.chip, side === v && s.chipOn]}>
            <Text style={[s.chipText, side === v && s.chipTextOn]}>
              {v === "for" ? "ARGUE YES" : "ARGUE NO"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Meta>
        Pick the side you can argue, not the side you believe. The structure is what is being
        drilled.
      </Meta>

      <Hair />

      <Eyebrow>THE SHAPE</Eyebrow>
      <View style={{ gap: SPACE.sm }}>
        {/* The shape arrives in the order you are meant to say it in. */}
        {scaffold.steps.map((st, i) => (
          <Reveal key={st.label} index={i} style={s.step}>
            <Text style={s.stepNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.stepLabel}>
                {st.label}
                <Text style={s.stepShare}>{`   ~${st.shareS}s`}</Text>
              </Text>
              <Text style={s.stepAsk}>{st.ask}</Text>
            </View>
          </Reveal>
        ))}
      </View>

      <Panel style={{ borderColor: SEMANTIC.flaw }}>
        <Eyebrow style={{ color: SEMANTIC.flaw }}>HOW THIS ONE FAILS</Eyebrow>
        <Body>{scaffold.trap}</Body>
      </Panel>

      {showExample ? (
        <Panel>
          <Eyebrow>WORKED EXAMPLE</Eyebrow>
          <Body style={s.model}>{scaffold.example}</Body>
        </Panel>
      ) : (
        <Button label="SHOW A WORKED EXAMPLE" tone="ghost" onPress={() => setShowExample(true)} />
      )}

      <Meta>{topic.primer[0]}</Meta>

      <Button label="ARGUE IT — 90 SECONDS" onPress={begin} disabled={!take.ready} />
      <Button label="DIFFERENT ONE" tone="ghost" onPress={deal} />
      <Button label="BACK TO THE LAB" tone="quiet" onPress={onExit} />
    </Screen>
  );
}

// ── the networking drill ──────────────────────────────────────────────────────

type RoomStage = "brief" | "live" | "recording" | "thinking" | "scoring" | "error" | "result";

function Room({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<RoomStage>("brief");
  const [c, setC] = useState<Counterpart>(() => COUNTERPARTS[0]!);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [result, setResult] = useState<RoleplayResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const spoken = useRef(false);

  const take = useTake();

  // The counterpart is spoken, not read. Listening to a person and having to
  // answer without a written transcript in front of you is the actual condition
  // being trained; reading their line lets you compose a reply to text.
  const say = (text: string) => {
    Speech.stop();
    Speech.speak(text, { rate: 0.98, pitch: 1.0 });
  };

  const deal = () => {
    Speech.stop();
    spoken.current = false;
    setC(COUNTERPARTS[Math.floor(Math.random() * COUNTERPARTS.length)]!);
    setHistory([]);
    setResult(null);
    setStage("brief");
  };

  const open = () => {
    setHistory([]);
    setStage("live");
    if (!spoken.current) {
      spoken.current = true;
      say(c.opener);
    }
  };

  const begin = async () => {
    Speech.stop();
    setFailure(null);
    await take.start();
    setStage("recording");
  };

  const send = async () => {
    setStage("thinking");
    const t = await take.stop();
    if (!t) {
      setFailure(take.error ?? "The recording failed.");
      setStage("error");
      return;
    }
    try {
      const { judge: provider } = resolve(await loadSettings());
      const key = (await getKey(provider)) ?? "";
      const r = await reply({ counterpart: c, history, said: t.text }, provider, key);
      setHistory((h) => [...h, { you: t.text, them: r.text, substance: r.substance }]);
      say(r.text);
      setStage("live");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  const end = async () => {
    Speech.stop();
    setStage("scoring");
    try {
      const { judge: provider } = resolve(await loadSettings());
      const key = (await getKey(provider)) ?? "";
      const r = await scoreRoleplay({ counterpart: c, history }, provider, key);
      await saveDrill({
        id: rowId(),
        kind: "roleplay",
        itemId: c.id,
        contextId: null,
        provider,
        transcript: history.map((e) => `YOU: ${e.you}\nTHEM: ${e.them}`).join("\n\n"),
        score: r.score,
        verdict: r,
      });
      setResult(r);
      setStage("result");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  };

  if (stage === "thinking") return <Working right="THE ROOM" step={`${c.name} is answering`} />;
  if (stage === "scoring") return <Working right="THE ROOM" step="Reading the conversation" />;

  if (stage === "error") {
    return (
      <Failed
        right="THE ROOM"
        error={failure ?? "Something went wrong."}
        onRetry={() => {
          setFailure(null);
          take.clearError();
          setStage("live");
        }}
        onBack={onExit}
      />
    );
  }

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead right={c.name.toUpperCase()} />
        <Display style={s.livePosition} numberOfLines={3}>
          {history.length === 0 ? c.opener : history[history.length - 1]!.them}
        </Display>
        <Aperture
          level={take.level}
          seconds={take.seconds}
          ceilingS={TURN_CEILING_S}
          onStop={send}
          hint="SAY IT — TAP WHEN DONE"
        />
        <Text style={s.hint}>One thing at a time. This is a conversation, not a turn in a game.</Text>
      </Screen>
    );
  }

  if (stage === "result" && result) {
    return (
      <Screen>
        <Masthead right="THE ROOM" />
        <Eyebrow>{c.name.toUpperCase()}</Eyebrow>
        <Display>{result.headline}</Display>

        <View style={s.tallies}>
          <Tally
            label="Turns to substance"
            value={result.turnsToSubstance === null ? "—" : String(result.turnsToSubstance)}
            flaw={result.turnsToSubstance === null}
          />
          <Tally label="Asked ÷ told" value={fmtRatio(result.askedVsTold)} />
        </View>
        <Meta>
          {result.turnsToSubstance === null
            ? `${c.name} never said the thing they actually knew. That is the drill failing, and it is the most common outcome — polite questions get polite answers.`
            : `${c.name} opened up on exchange ${result.turnsToSubstance}.`}
        </Meta>

        <View style={{ gap: SPACE.md }}>
          {ROLEPLAY_LABELS.map((l, i) => (
            <Reveal key={l.key} index={i}>
              <ScoreBar label={l.label} hint={l.hint} score={result.scores[l.key]} />
            </Reveal>
          ))}
        </View>

        {result.unlocking_question ? (
          <Panel>
            <Eyebrow>THE QUESTION THAT OPENED IT</Eyebrow>
            <Body style={s.model}>&ldquo;{result.unlocking_question}&rdquo;</Body>
          </Panel>
        ) : null}

        <Panel style={{ borderColor: SEMANTIC.ember }}>
          <Eyebrow style={{ color: SEMANTIC.ember }}>WHAT TO OPEN WITH NEXT TIME</Eyebrow>
          <Body style={s.model}>{result.model_opener}</Body>
        </Panel>

        <Hair />
        <Eyebrow>WHAT THEY KNEW</Eyebrow>
        <Body>{c.substance}</Body>

        <Button label="ANOTHER STRANGER" onPress={deal} />
        <Button label="BACK TO THE LAB" tone="ghost" onPress={onExit} />
      </Screen>
    );
  }

  if (stage === "live") {
    const enough = history.length >= MIN_EXCHANGES;
    return (
      <Screen>
        <Masthead right={c.name.toUpperCase()} />
        <Eyebrow>{c.setting.toUpperCase()}</Eyebrow>

        <View style={{ gap: SPACE.md }}>
          <Line who={c.name} text={c.opener} them />
          {/* delay 0, not a stagger: each exchange mounts once, when it happens.
              Staggering by index would make the tenth reply wait half a second. */}
          {history.map((e, i) => (
            <Reveal key={i} delay={0} style={{ gap: SPACE.md }}>
              <Line who="You" text={e.you} />
              <Line who={c.name} text={e.them} them substance={e.substance} />
            </Reveal>
          ))}
        </View>

        <Button label="SAY SOMETHING" onPress={begin} disabled={!take.ready} />
        <Button
          label={enough ? "END AND SCORE IT" : `${MIN_EXCHANGES - history.length} MORE BEFORE SCORING`}
          tone="ghost"
          onPress={end}
          disabled={!enough}
        />
        <Button label="LEAVE THE CONVERSATION" tone="quiet" onPress={onExit} />
      </Screen>
    );
  }

  // brief
  return (
    <Screen>
      <Masthead right="THE ROOM" />
      <Eyebrow>{c.role.toUpperCase()}</Eyebrow>
      <Display>{c.name}</Display>
      <Body style={s.question}>{c.setting}</Body>

      <Panel>
        <Eyebrow>THE DRILL</Eyebrow>
        <Body>
          {c.name} knows one thing genuinely worth hearing and will not offer it. Generic questions
          get generic answers — that is realistic, and it is the whole exercise. Get there in as few
          turns as you can.
        </Body>
      </Panel>

      <Meta>
        They speak out loud and their words are not written down until afterwards. Answering
        something you heard rather than something you can reread is the point.
      </Meta>

      <Button label="WALK OVER" onPress={open} disabled={!take.ready} />
      <Button label="SOMEONE ELSE" tone="ghost" onPress={deal} />
      <Button label="BACK TO THE LAB" tone="quiet" onPress={onExit} />
    </Screen>
  );
}

function Line({
  who,
  text,
  them,
  substance,
}: {
  who: string;
  text: string;
  them?: boolean;
  substance?: boolean;
}) {
  return (
    <View style={[s.line, them && s.lineThem, substance && { borderLeftColor: SEMANTIC.ember }]}>
      <Text style={s.lineWho}>{who.toUpperCase()}</Text>
      <Text style={[s.lineText, them && s.lineTextThem]}>{text}</Text>
    </View>
  );
}

function Tally({ label, value, flaw }: { label: string; value: string; flaw?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={[s.tallyValue, flaw && { color: SEMANTIC.flaw }]}>{value}</Text>
      <Text style={s.tallyLabel}>{label}</Text>
    </View>
  );
}

/** Infinity means they asked and never talked, which is a real result, not an error. */
function fmtRatio(n: number): string {
  if (!Number.isFinite(n)) return "all asked";
  if (n === 0) return "all told";
  return n >= 1 ? `${n.toFixed(1)}×` : n.toFixed(2);
}

function rowId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 21, lineHeight: 27 },

  moveName: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.uiMedium },
  moveForm: { color: "#C3D0D2", fontSize: 14, lineHeight: 21, fontFamily: TYPE.displayItalic },
  moveWhy: { color: CHROME.dustDim, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui },

  question: { color: CHROME.chalk, fontFamily: TYPE.displayItalic, fontSize: 17, lineHeight: 25 },
  model: { color: CHROME.chalk, fontFamily: TYPE.displayItalic, fontSize: 15, lineHeight: 23 },
  heard: { color: "#C3D0D2", fontSize: 13, lineHeight: 20, fontFamily: TYPE.displayItalic },
  note: { color: CHROME.dust, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui },
  hint: {
    color: CHROME.dustDim,
    fontSize: 12,
    fontFamily: TYPE.displayItalic,
    textAlign: "center",
    paddingBottom: SPACE.lg,
  },

  livePosition: { fontSize: 19, lineHeight: 26, color: CHROME.dust },
  stepStrip: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: SPACE.lg,
  },
  stepChip: { color: CHROME.dustDim, fontSize: 10, letterSpacing: 1.6, fontFamily: TYPE.uiMedium },

  sideRow: { flexDirection: "row", gap: 8 },
  chip: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  chipOn: { borderColor: SEMANTIC.ember, backgroundColor: "rgba(224, 85, 63, 0.1)" },
  chipText: { color: CHROME.dust, fontSize: 10, letterSpacing: 1.4, fontFamily: TYPE.uiMedium },
  chipTextOn: { color: SEMANTIC.ember },

  step: { flexDirection: "row", gap: 12 },
  stepNum: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.monoMedium, width: 16, ...TABULAR },
  stepLabel: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium },
  stepShare: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  stepAsk: { color: CHROME.dust, fontSize: 13, lineHeight: 20, fontFamily: TYPE.ui },

  line: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: SURFACE.edgeLive, gap: 3 },
  lineThem: { borderLeftColor: CHROME.dustDim },
  lineWho: { color: CHROME.dustDim, fontSize: 9, letterSpacing: 1.6, fontFamily: TYPE.uiSemi },
  lineText: { color: CHROME.dust, fontSize: 14, lineHeight: 21, fontFamily: TYPE.ui },
  lineTextThem: { color: CHROME.chalk, fontFamily: TYPE.displayItalic, fontSize: 15 },

  tallies: { flexDirection: "row", gap: SPACE.lg, flexWrap: "wrap" },
  tallyValue: { color: CHROME.chalk, fontSize: 20, letterSpacing: -0.8, fontFamily: TYPE.monoMedium, ...TABULAR },
  tallyLabel: { color: CHROME.dustDim, fontSize: 10, letterSpacing: 1.4, fontFamily: TYPE.uiMedium },
});
