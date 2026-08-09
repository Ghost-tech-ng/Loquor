// The Scorecard.
//
// Two halves that never mix. Above the rule: delivery, computed by arithmetic on
// this device, identical for identical audio forever. Below it: content, judged
// by a model that will be a different model next year. Keeping them visually
// separate is the honest thing to do — one of these numbers is a measurement and
// the other is an opinion.

import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

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
} from "../components/ui";
import { Rail, Score, Timeline, fillerStrain, strain } from "../components/viz";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE } from "../theme";
import {
  DEAD_AIR_THRESHOLD_S,
  FILLER_TARGET_PER_MIN,
  PACE_BAND_WPM,
  bandPosition,
  fillerVerdict,
  type Metrics,
} from "../lib/metrics";
import { RUBRIC_LABELS, type Judgement } from "../lib/judge";
import { getSession, type SessionRow } from "../lib/db";
import { fillerCountIsApproximate } from "../lib/settings";

export default function Scorecard() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [row, setRow] = useState<SessionRow | null>(null);
  const [parent, setParent] = useState<SessionRow | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const r = id ? await getSession(id) : null;
      if (!r) {
        setMissing(true);
        return;
      }
      setRow(r);
      if (r.parent_id) setParent(await getSession(r.parent_id));
    })();
  }, [id]);

  if (missing) {
    return (
      <Screen>
        <Masthead />
        <Display>That session is gone.</Display>
        <Button label="BACK TO TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (!row) {
    return (
      <Screen scroll={false}>
        <Masthead right="SCORECARD" />
      </Screen>
    );
  }

  const m = JSON.parse(row.metrics_json) as Metrics;
  const j = row.judgement_json ? (JSON.parse(row.judgement_json) as Judgement) : null;
  const approx = fillerCountIsApproximate(row.provider as "groq" | "deepgram");
  const verdict = fillerVerdict(m.fillerRate);

  return (
    <Screen>
      <Masthead right={row.is_rewrite ? "REWRITE" : "SCORECARD"} />

      <Eyebrow>{new Date(row.started_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Eyebrow>
      <Body style={s.topic}>{row.topic_title}</Body>

      <Timeline fillerMarks={m.fillerMarks} deadAirSpans={m.deadAirSpans} />
      <Meta>
        {Math.round(m.durationS)}s · {m.wordCount} words · red flecks are fillers, breaks are
        silences over {DEAD_AIR_THRESHOLD_S}s
      </Meta>

      {parent ? (
        <Panel>
          <Eyebrow>AGAINST THE FIRST TAKE</Eyebrow>
          <View style={s.compare}>
            <Delta label="FILLER" before={parent.filler_rate} after={m.fillerRate} unit="/min" ideal={0} />
            <Delta label="PACE" before={parent.wpm} after={m.wpm} unit="" ideal={PACE_MID} />
            <Delta label="HEDGE" before={parent.hedge_density} after={m.hedgeDensity} unit="%" ideal={0} />
          </View>
        </Panel>
      ) : null}

      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>DELIVERY · MEASURED</Eyebrow>

      {/* The four rails land one after another rather than as a block. A
          scorecard that appears all at once is read as a verdict; one that
          arrives a measurement at a time is read as a measurement. */}
      <View style={s.rails}>
        <Reveal index={0}>
        <Rail
          label="FILLER RATE"
          value={m.fillerRate.toFixed(1)}
          unit="/min"
          approximate={approx}
          position={bandPosition(m.fillerRate, 0, FILLER_TARGET_PER_MIN)}
          tint={strain(fillerStrain(m.fillerRate))}
          bandLabel={
            verdict === "on-target"
              ? "Under five a minute. Nobody notices this."
              : verdict === "drifting"
                ? "Audible, not yet costly. Pause instead — silence reads as thought."
                : "Loud enough to be the thing people remember."
          }
        />
        </Reveal>
        <Reveal index={1}>
        <Rail
          label="PACE"
          value={String(m.wpm)}
          unit="wpm"
          position={bandPosition(m.wpm, PACE_BAND_WPM.low, PACE_BAND_WPM.high)}
          bandLabel={
            m.wpm < PACE_BAND_WPM.low
              ? "Slower than the comfortable band. Deliberate, or hunting for words?"
              : m.wpm > PACE_BAND_WPM.high
                ? "Above the band. Fast reads as nervous more often than as sharp."
                : `Inside ${PACE_BAND_WPM.low}–${PACE_BAND_WPM.high}. This is the range people follow easily.`
          }
        />
        </Reveal>
        <Reveal index={2}>
        <Rail
          label="DEAD AIR"
          value={m.deadAirTotalS.toFixed(1)}
          unit="s"
          position={bandPosition(m.deadAirTotalS, 0, 6)}
          bandLabel={
            m.deadAirCount === 0
              ? "No stalls over the threshold."
              : `${m.deadAirCount} ${m.deadAirCount === 1 ? "stall" : "stalls"}, longest ${m.longestGapS.toFixed(1)}s.`
          }
        />
        </Reveal>
        <Reveal index={3}>
        <Rail
          label="HEDGING"
          value={m.hedgeDensity.toFixed(1)}
          unit="%"
          position={bandPosition(m.hedgeDensity, 0, 4)}
          tint={m.hedgeDensity > 4 ? SEMANTIC.flaw : undefined}
          bandLabel={
            m.hedgeCount === 0
              ? "You asserted things. Good."
              : `${m.hedgeCount} hedges — "I think", "maybe", "just". They cost you authority per use.`
          }
        />
        </Reveal>
      </View>

      {j ? (
        <>
          <Hair style={{ marginTop: SPACE.sm }} />
          <View style={s.headRow}>
            <Eyebrow>CONTENT · JUDGED</Eyebrow>
            <Text style={s.total}>{row.rubric_total}/20</Text>
          </View>

          <Reveal index={4}>
            <Display style={s.headline}>{j.headline}</Display>
          </Reveal>

          <View style={s.scores}>
            {RUBRIC_LABELS.map(({ key, label }, i) => (
              <Reveal key={key} index={5 + i}>
                <Score label={label} score={j.rubric[key]} />
              </Reveal>
            ))}
          </View>

          <Panel style={{ marginTop: SPACE.xs }}>
            <Eyebrow>WEAKEST SENTENCE</Eyebrow>
            <Body style={s.quote}>&ldquo;{j.weakest_sentence}&rdquo;</Body>
            <Meta>{j.weakest_reason}</Meta>
            <Hair style={{ marginVertical: SPACE.xs }} />
            <Eyebrow>SAY THIS INSTEAD</Eyebrow>
            <Body>{j.suggested_rewrite}</Body>
          </Panel>

          <Meta style={s.strong}>
            <Text style={s.strongLabel}>Worked: </Text>
            {j.strongest_moment}
          </Meta>

          {!row.is_rewrite ? (
            <Button
              label="REWRITE THAT SENTENCE"
              onPress={() =>
                router.push({ pathname: "/arena", params: { topicId: row.topic_id, rewriteOf: row.id } })
              }
            />
          ) : null}
        </>
      ) : (
        <Meta>No judgement was recorded for this take.</Meta>
      )}

      <Button label="DONE" tone="ghost" onPress={() => router.replace("/")} />

      <Hair style={{ marginTop: SPACE.sm }} />
      <Eyebrow>WHAT YOU ACTUALLY SAID</Eyebrow>
      <Body style={s.transcript}>{row.transcript}</Body>
      <Meta style={s.provenance}>
        Delivery counted on this device. Words transcribed by {row.provider}
        {approx ? " — Whisper cleans up disfluencies, so the filler count is a floor, not a total." : "."}
      </Meta>
    </Screen>
  );
}

const PACE_MID = (PACE_BAND_WPM.low + PACE_BAND_WPM.high) / 2;

/**
 * A before/after pair. "Better" is movement toward `ideal`, not simply downward —
 * a rewrite that drops from 170 wpm to 120 has not improved, it has overcorrected.
 */
function Delta({
  label,
  before,
  after,
  unit,
  ideal,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  ideal: number;
}) {
  const diff = after - before;
  const better = Math.abs(after - ideal) < Math.abs(before - ideal);
  const flat = Math.abs(diff) < 0.05;
  return (
    <View style={s.delta}>
      <Text style={s.deltaLabel}>{label}</Text>
      <Text style={s.deltaValue}>
        {after.toFixed(1)}
        {unit}
      </Text>
      <Text
        style={[
          s.deltaDiff,
          !flat && { color: better ? CHROME.chalk : SEMANTIC.flaw },
        ]}
      >
        {flat ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  topic: { color: CHROME.chalk, fontFamily: TYPE.display, fontSize: 19, lineHeight: 25 },
  rails: { gap: SPACE.lg, marginTop: SPACE.xs },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  total: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.monoMedium, ...TABULAR },
  headline: { fontSize: 22, lineHeight: 29 },
  scores: { gap: 10, marginTop: SPACE.xs },
  quote: { fontFamily: TYPE.displayItalic, color: CHROME.chalk },
  strong: { marginTop: SPACE.xs },
  strongLabel: { color: CHROME.dustDim, fontFamily: TYPE.uiMedium },
  transcript: { color: CHROME.dust, fontSize: 14, lineHeight: 22 },
  provenance: { color: CHROME.dustDim, fontSize: 11 },

  compare: { flexDirection: "row", gap: SPACE.md },
  delta: { flex: 1, gap: 3 },
  deltaLabel: { color: CHROME.dustDim, fontSize: 9, letterSpacing: 1.8, fontFamily: TYPE.uiMedium },
  deltaValue: { color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.monoMedium, ...TABULAR },
  deltaDiff: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
});
