// The baseline.
//
// Ninety seconds, recorded once, before the app has taught anything. Every row
// of the ninety-day table on Progress is a comparison against this take, and
// without it the app can claim improvement it cannot show.
//
// Three deliberate choices.
//
// The prompt is fixed and unrerollable. A baseline measured on whichever topic
// you happened to like is not a baseline, and the value of this recording is
// entirely in the fact that it can never be tuned.
//
// No judging. The baseline stores delivery only — filler rate, pace, hedges,
// dead air — which is arithmetic done on this phone. There is nothing to score
// yet and no reason to spend a model call telling someone their untrained first
// take was untrained.
//
// It can be taken exactly once. That is enforced here and by `id = 1` in the
// table. A baseline you could re-measure whenever it looked bad would be a high
// score, and the number it produced would mean nothing.

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
} from "../components/ui";
import { Ignition } from "../components/boot";
import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE, heat } from "../theme";
import { useTake, type Take } from "../components/useTake";
import { getBaseline, saveBaseline, type BaselineRow } from "../lib/db";
import { fillerCountIsApproximate } from "../lib/settings";

const PROMPT =
  "Something you changed your mind about, and what changed it.";

const SOFT_CEILING_S = 120;

/** Thirty seconds a beat. Not a script — a handrail for the first thirty. */
const SHAPE = [
  "What you used to think, said flatly. No preamble, no “so basically”.",
  "The thing that broke it — the argument, the incident, the number you could not explain away.",
  "What you think now, and the one part you are still not sure about.",
];

type Stage = "brief" | "recording" | "working" | "rate" | "done";

export default function Onboarding() {
  const router = useRouter();
  const take = useTake({ prompt: PROMPT });

  const [existing, setExisting] = useState<BaselineRow | null | undefined>(undefined);
  const [stage, setStage] = useState<Stage>("brief");
  const [result, setResult] = useState<Take | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      getBaseline().then((row) => {
        if (live) setExisting(row);
      });
      return () => {
        live = false;
      };
    }, [])
  );

  const begin = async () => {
    setStage("recording");
    await take.start();
  };

  const finish = async () => {
    setStage("working");
    const t = await take.stop();
    if (!t) {
      setStage("brief");
      return;
    }
    setResult(t);
    setStage("rate");
  };

  const commit = async (n: number) => {
    if (!result) return;
    setRating(n);
    await saveBaseline({
      transcript: result.text,
      provider: result.provider,
      metrics: result.metrics,
      selfRating: n,
    });
    setStage("done");
  };

  if (existing === undefined) {
    return (
      <Screen>
        <Masthead right="BASELINE" />
        <Meta>Checking…</Meta>
      </Screen>
    );
  }

  // Already taken, and there is no route from here to taking it again.
  if (existing && stage !== "done") {
    const approx = fillerCountIsApproximate(
      existing.provider === "deepgram" ? "deepgram" : "groq"
    );
    return (
      <Screen>
        <Masthead right="BASELINE" />
        <Eyebrow>RECORDED {new Date(existing.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }).toUpperCase()}</Eyebrow>
        <Display>This is what you sounded like before any of this.</Display>

        <Panel>
          <Row label="Filler rate" value={`${approx ? "≈" : ""}${existing.filler_rate.toFixed(1)}`} unit="/min" />
          <Row label="Pace" value={String(Math.round(existing.wpm))} unit="wpm" />
          <Row label="Hedges" value={existing.hedge_density.toFixed(1)} unit="% of words" />
          <Row label="Dead air" value={existing.dead_air_s.toFixed(1)} unit="s" />
          <Row label="Said what I meant" value={String(existing.self_rating)} unit="/5" />
        </Panel>

        <Meta>
          It is kept exactly as recorded and never re-measured. Everything the ninety-day table
          claims is measured from here.
        </Meta>

        <Button label="SEE PROGRESS" tone="ghost" onPress={() => router.replace("/progress")} />
        <Button label="BACK" tone="quiet" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (stage === "working") {
    return (
      <Screen scroll={false}>
        <Masthead right="BASELINE" />
        <View style={s.center}>
          <Ignition />
          <Eyebrow style={{ marginTop: SPACE.md }}>TRANSCRIBING</Eyebrow>
          <Meta style={s.centerText}>
            Delivery is counted here on the phone. Only the words go out, and the audio is deleted
            the moment they come back.
          </Meta>
        </View>
      </Screen>
    );
  }

  if (stage === "recording") {
    const over = take.seconds > SOFT_CEILING_S;
    return (
      <Screen scroll={false}>
        <Masthead right="BASELINE" />
        <Display style={s.livePrompt} numberOfLines={3}>
          {PROMPT}
        </Display>

        <View style={s.center}>
          <View style={s.apertureWrap}>
            <View
              style={[
                s.bloom,
                {
                  backgroundColor: heat(take.level),
                  opacity: 0.08 + take.level * 0.5,
                  transform: [{ scale: 0.8 + take.level * 1.1 }],
                },
              ]}
            />
            <Pressable onPress={finish} style={s.aperture} hitSlop={20}>
              <View style={s.stopCore} />
            </Pressable>
          </View>

          <Text style={[s.clock, over && { color: SEMANTIC.flaw }]}>
            {String(Math.floor(take.seconds / 60)).padStart(2, "0")}:
            {String(take.seconds % 60).padStart(2, "0")}
          </Text>
          <Eyebrow>{over ? "PAST NINETY — LAND IT" : "TAP TO FINISH"}</Eyebrow>
        </View>

        <Meta style={s.centerText}>
          Nobody is grading this one. Speak the way you normally do — a careful baseline makes every
          later figure look worse than it is.
        </Meta>
      </Screen>
    );
  }

  if (stage === "rate" && result) {
    return (
      <Screen>
        <Masthead right="BASELINE" />
        <Eyebrow>ONE QUESTION, AND IT IS YOURS</Eyebrow>
        <Display>Did you say the thing you wanted to say?</Display>
        <Meta>
          One is rarely, five is always. This is the only figure in Loquor the app cannot measure,
          and the one that decides whether the rest of them mattered.
        </Meta>

        <View style={s.ratingRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => commit(n)}
              style={({ pressed }) => [
                s.ratingCell,
                rating !== null && n <= rating && s.ratingOn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[s.ratingNum, rating !== null && n <= rating && { color: CHROME.floor }]}
              >
                {n}
              </Text>
            </Pressable>
          ))}
        </View>

        <Hair style={{ marginTop: SPACE.sm }} />
        <Eyebrow>WHAT WAS MEASURED</Eyebrow>
        <Panel>
          <Row
            label="Filler rate"
            value={`${fillerCountIsApproximate(result.provider) ? "≈" : ""}${result.metrics.fillerRate.toFixed(1)}`}
            unit="/min"
          />
          <Row label="Pace" value={String(Math.round(result.metrics.wpm))} unit="wpm" />
          <Row label="Hedges" value={result.metrics.hedgeDensity.toFixed(1)} unit="% of words" />
          <Row label="Dead air" value={result.metrics.deadAirTotalS.toFixed(1)} unit="s" />
        </Panel>
      </Screen>
    );
  }

  if (stage === "done") {
    return (
      <Screen>
        <Masthead right="BASELINE" />
        <Display>Filed. It will not be asked for again.</Display>
        <Meta>
          Ninety days from now the table on Progress reads against this take. Nothing else you do in
          the app can change it.
        </Meta>
        <Button label="SEE PROGRESS" onPress={() => router.replace("/progress")} />
        <Button label="START TODAY" tone="ghost" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  // brief
  return (
    <Screen>
      <Masthead right="BASELINE" />

      <Reveal index={0}>
        <Eyebrow>BEFORE ANYTHING ELSE</Eyebrow>
        <Display>{PROMPT}</Display>
      </Reveal>

      <Reveal index={1}>
        <Body>
          Ninety seconds, recorded once. No score, no verdict, no model reads it — the app counts
          fillers, pace, hedges and pauses on this phone and stores the four numbers.
        </Body>
      </Reveal>

      {/* The single most common way this recording goes wrong is thirty seconds
          of silence followed by an apology. The shape below is not a script —
          it is three beats, so there is always a next thing to reach for. */}
      <Reveal index={2}>
        <Hair />
        <Eyebrow>IF YOU FREEZE, TALK IN THIS SHAPE</Eyebrow>
        <View style={s.shape}>
          {SHAPE.map((beat, i) => (
            <View key={i} style={s.beat}>
              <Text style={s.beatN}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={s.beatText}>{beat}</Text>
            </View>
          ))}
        </View>
        <Meta>
          Anything works — a technical opinion you dropped, a person you misjudged, a way of
          working you defended until it stopped paying. Concrete beats important.
        </Meta>
      </Reveal>

      <Reveal index={3}>
        <Panel>
          <Meta>
            Speak badly if you speak badly. Every claim Loquor makes about your progress is measured
            from this recording, so a baseline you performed carefully is a baseline that will make
            three months of real work look like nothing.
          </Meta>
        </Panel>
      </Reveal>

      {take.error ? <Text style={s.failed}>{take.error}</Text> : null}

      <Button
        label={take.ready ? "RECORD THE BASELINE" : "WAITING FOR THE MIC"}
        onPress={begin}
        disabled={!take.ready}
      />
      <Button label="NOT NOW" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

function Row({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowValue}>
        <Text style={s.rowNum}>{value}</Text>
        <Text style={s.rowUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  centerText: { textAlign: "center", maxWidth: 280, alignSelf: "center", marginTop: SPACE.xs },

  livePrompt: { fontSize: 20, lineHeight: 26, color: CHROME.dust },
  apertureWrap: { alignItems: "center", justifyContent: "center", height: 240, width: 240 },
  bloom: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  aperture: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: SEMANTIC.ember,
    alignItems: "center",
    justifyContent: "center",
  },
  stopCore: { width: 30, height: 30, borderRadius: 3, backgroundColor: SEMANTIC.flaw },
  clock: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.monoMedium, letterSpacing: -1, ...TABULAR },

  shape: { gap: 11, marginTop: SPACE.sm },
  beat: { flexDirection: "row", gap: 11 },
  beatN: { color: SEMANTIC.ember, fontSize: 9.5, fontFamily: TYPE.monoMedium, paddingTop: 3, ...TABULAR },
  beatText: { flex: 1, color: CHROME.chalk, fontSize: 13.5, lineHeight: 21, fontFamily: TYPE.ui },

  ratingRow: { flexDirection: "row", gap: 4 },
  ratingCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
  },
  ratingOn: { backgroundColor: CHROME.chalk, borderColor: CHROME.chalk },
  ratingNum: { color: CHROME.dust, fontSize: 14, fontFamily: TYPE.monoMedium, ...TABULAR },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.ui },
  rowValue: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  rowNum: { color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.monoMedium, ...TABULAR },
  rowUnit: { color: CHROME.dustDim, fontSize: 9, fontFamily: TYPE.mono },

  failed: { color: SEMANTIC.flaw, fontSize: 12, fontFamily: TYPE.ui },
});
