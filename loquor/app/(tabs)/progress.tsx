// Progress.
//
// The only screen in the app that looks backwards. Everything else asks you to
// do something; this one only tells you what happened, which is why it is a
// separate screen rather than a strip on Today — a person deciding whether to
// practise should not first have to read a report about not having practised.
//
// It leads with density over 28 days, not with the streak. The streak is here,
// small, as a second figure. PRD §12 rules out the flame and the confetti, and
// the reason is not taste: a streak rewards not breaking a chain, so the cheapest
// way to protect it is a thirty-second take that teaches nothing, and the day it
// breaks the whole structure has nothing left to say to you.
//
// Two things on this screen cost money, and both are opt-in taps: the weekly
// synthesis, and regenerating it. Nothing here calls a model on mount.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Body, Button, Display, Eyebrow, Hair, Masthead, Meta, Panel, Reveal, Screen, Tap } from "../../components/ui";
import { Rail, StrataWall, fillerStrain, strain } from "../../components/viz";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE } from "../../theme";
import { bandPosition, FILLER_TARGET_PER_MIN, PACE_BAND_WPM } from "../../lib/metrics";
import {
  PACE_LABELS,
  condense,
  drift,
  paceBand,
  type LaggingRow,
  type WeekStats,
} from "../../lib/progress";
import { overview, week, type Overview } from "../../lib/progressStore";
import { synthesise, SynthesisError, type Synthesis } from "../../lib/synthesis";
import { contributionRaw, getReport, saveReport, setWeekRating } from "../../lib/db";
import { archetypeStats, scaffoldStats } from "../../lib/skillStore";
import { funnel } from "../../lib/coach";
import { fillerCountIsApproximate, getKey, loadSettings, resolve } from "../../lib/settings";

export default function Progress() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [approx, setApprox] = useState(true);
  const [report, setReport] = useState<Synthesis | null>(null);
  const [reportKey, setReportKey] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const { stt } = resolve(await loadSettings());
        const o = await overview(stt);
        // The report the screen offers is about the week that just ended, so the
        // cache is looked up under that week and not under today.
        const target = o.lastWeek.substantial ? o.lastWeek : o.thisWeek;
        const cached = await getReport(target.key);
        if (!live) return;
        setApprox(fillerCountIsApproximate(stt));
        setData(o);
        setReportKey(target.key);
        setRating(cached?.self_rating ?? null);
        try {
          const text = cached ? (JSON.parse(cached.text_json) as Synthesis | null) : null;
          setReport(text && typeof text.headline === "string" ? text : null);
        } catch {
          setReport(null);
        }
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const generate = async () => {
    if (!data) return;
    const target = data.lastWeek.substantial ? data.lastWeek : data.thisWeek;
    const provisional = target === data.thisWeek;

    setWorking(true);
    setFailed(null);
    try {
      const { judge } = resolve(await loadSettings());
      const key = (await getKey(judge)) ?? "";
      if (!key) throw new SynthesisError(`No ${judge} key. Settings → API keys.`);

      // The week before the one being read. When the report is provisional that
      // is simply last week; otherwise it has to be fetched, since the overview
      // only ever loads two.
      const [arch, scaf, contrib, previous] = await Promise.all([
        archetypeStats(),
        scaffoldStats(),
        contributionRaw(Date.now() - 28 * 86_400_000),
        provisional ? Promise.resolve(data.lastWeek) : week(target.startMs - 1),
      ]);
      const weak = [
        ...arch.filter((a) => a.mastery === "shaky" || a.mastery === "untried"),
      ]
        .sort((a, b) => (a.state?.ewma ?? -1) - (b.state?.ewma ?? -1))
        .slice(0, 4)
        .map((a) => a.archetype.name)
        .concat(
          scaf
            .filter((x) => x.mastery === "shaky" || x.mastery === "untried")
            .slice(0, 2)
            .map((x) => x.scaffold.name)
        );
      const f = funnel(contrib);

      const text = await synthesise(
        {
          week: target,
          previous: previous.substantial ? previous : null,
          approximate: approx,
          weakest: weak,
          bottleneck: f.bottleneck
            ? `${f.bottleneck.label} is where the most is lost. ${f.headline}`
            : null,
        },
        judge,
        key
      );

      setReport(text);
      setReportKey(target.key);
      // A week still in progress is not filed. Cached, it would be read next
      // Monday as a report on a week it only saw half of.
      if (!provisional) {
        await saveReport({ weekKey: target.key, provider: judge, stats: target, text });
      }
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  const rate = async (n: number) => {
    if (reportKey === null) return;
    setRating(n);
    await setWeekRating(reportKey, n);
  };

  if (!data) {
    return (
      <Screen>
        <Masthead right="PROGRESS" />
        <Meta>Reading the record…</Meta>
      </Screen>
    );
  }

  const c = data.consistency;
  const w = data.thisWeek;
  const target = data.lastWeek.substantial ? data.lastWeek : data.thisWeek;
  const provisional = target === data.thisWeek;
  const fillerDrift = drift(data.fillerSeries);

  return (
    <Screen>
      <Masthead right="PROGRESS" />

      {data.baseline === null ? (
        <Reveal index={0}>
          <Tap onPress={() => router.push("/onboarding")} style={s.callout}>
            <Text style={s.calloutTitle}>No baseline recorded</Text>
            <Text style={s.calloutBody}>
              Ninety seconds, once, before any of this has coached you. Without it every figure
              below is a number with nothing to compare it to.
            </Text>
          </Tap>
        </Reveal>
      ) : null}

      {/* ── Consistency ─────────────────────────────────────────────────── */}
      <Eyebrow>LAST {c.window} DAYS</Eyebrow>
      <View style={s.densityRow}>
        <Display style={s.density}>
          {c.active}
          <Text style={s.densityOf}> of {c.window}</Text>
        </Display>
        <Text style={s.streak}>
          {c.current > 0 ? `${c.current} in a row` : "not today yet"}
          {c.longest > c.current ? ` · best ${c.longest}` : ""}
        </Text>
      </View>
      {/* The grid arrives as one object. Twenty-eight cells staggered would read
          as an effect; the fortnight is a single fact. */}
      <Reveal index={1} style={s.grid}>
        {c.grid.map((on, i) => (
          <View key={i} style={[s.cell, on && s.cellOn]} />
        ))}
      </Reveal>
      <Meta>
        Days on which you recorded anything at all. Gaps are information — a fortnight of four days
        a week beats nine days and a fortnight off.
      </Meta>

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* ── This week's leading indicators ──────────────────────────────── */}
      <Eyebrow>THIS WEEK · WHAT YOU CONTROL</Eyebrow>
      <View style={s.targets}>
        {w.targets.map((t, i) => (
          <Reveal key={t.key} index={i} style={s.target}>
            <View style={[s.targetTick, t.met && { backgroundColor: SEMANTIC.ember }]} />
            <Text style={s.targetLabel}>{t.label}</Text>
            <Text style={[s.targetValue, t.met && { color: CHROME.chalk }]}>
              {t.value}
              <Text style={s.targetOf}>/{t.target}</Text>
            </Text>
          </Reveal>
        ))}
      </View>
      <Meta>
        {w.daysActive} of 7 days used. These are behaviours, not outcomes — they are the only part
        of this screen you can decide to change today.
      </Meta>

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* ── Delivery ────────────────────────────────────────────────────── */}
      <Eyebrow>DELIVERY · MEDIAN THIS WEEK</Eyebrow>
      {w.fillerRate !== null ? (
        <Rail
          label="FILLER RATE"
          value={w.fillerRate.toFixed(1)}
          unit="/min"
          position={Math.min(1, w.fillerRate / (FILLER_TARGET_PER_MIN * 3))}
          bandLabel={
            w.fillerRate <= FILLER_TARGET_PER_MIN
              ? "Under five. Below the threshold people notice."
              : "Above five per minute, which listeners hear as hesitation."
          }
          tint={strain(fillerStrain(w.fillerRate))}
          approximate={approx}
        />
      ) : (
        <Meta>No Arena takes this week, so there is no rate to report.</Meta>
      )}

      {w.wpm !== null ? (
        <Rail
          label="PACE"
          value={String(Math.round(w.wpm))}
          unit="wpm"
          position={bandPosition(w.wpm, PACE_BAND_WPM.low, PACE_BAND_WPM.high)}
          bandLabel={PACE_LABELS[paceBand(w.wpm)]}
        />
      ) : null}

      {w.hedgeDensity !== null ? (
        <Rail
          label="HEDGES"
          value={w.hedgeDensity.toFixed(1)}
          unit="% of words"
          position={Math.min(1, w.hedgeDensity / 8)}
          bandLabel="Maybe, sort of, I think — the words that take the weight out of a sentence."
        />
      ) : null}

      <Eyebrow style={{ marginTop: SPACE.xs }}>
        FILLER RATE · {data.totalSessions} SESSIONS
      </Eyebrow>
      <StrataWall rates={condense(data.fillerSeries, 40)} height={104} />
      <Meta>
        {fillerDrift === null
          ? "Six sessions before a direction can be read out of this."
          : fillerDrift < -0.1
            ? `Down about ${Math.round(Math.abs(fillerDrift) * 100)}% from the first third to the last.`
            : fillerDrift > 0.1
              ? `Up about ${Math.round(fillerDrift * 100)}% from the first third to the last.`
              : "Flat across the run. The hairline is five per minute."}
      </Meta>

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* ── The weekly read ─────────────────────────────────────────────── */}
      <View style={s.head}>
        <Eyebrow>THE WEEKLY READ</Eyebrow>
        <Text style={s.weekLabel}>
          {provisional ? "WEEK IN PROGRESS" : weekLabel(target)}
        </Text>
      </View>

      {report ? (
        // Re-keyed on the headline so a regenerate reads as a new paragraph
        // arriving rather than as text silently swapping under the cursor.
        <Reveal key={report.headline}>
        <Panel>
          <Body style={s.headline}>{report.headline}</Body>
          <Hair style={{ marginVertical: SPACE.xs }} />
          <Line label="MOVED" text={report.worked} />
          <Line label="DID NOT" text={report.stalled} />
          <Hair style={{ marginVertical: SPACE.xs }} />
          <Text style={s.nextLabel}>NEXT WEEK</Text>
          <Text style={s.next}>{report.next_week}</Text>
        </Panel>
        </Reveal>
      ) : (
        <Meta>
          {target.substantial
            ? "One paragraph on the week, written from the figures above and nothing else. It has not heard the recordings."
            : "Too little in the week to read. Three recorded things is the floor."}
        </Meta>
      )}

      {failed ? <Text style={s.failed}>{failed}</Text> : null}

      <Button
        label={working ? "READING…" : report ? "REGENERATE" : "READ THE WEEK"}
        tone={report ? "quiet" : "ghost"}
        onPress={generate}
        disabled={working || !target.substantial}
      />

      {/* The one figure on this screen the app cannot measure. */}
      <Eyebrow style={{ marginTop: SPACE.xs }}>I SAID THE THING I WANTED TO SAY</Eyebrow>
      <View style={s.ratingRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Tap
            key={n}
            onPress={() => rate(n)}
            style={[s.ratingCell, rating !== null && n <= rating && s.ratingOn]}
          >
            <Text style={[s.ratingNum, rating !== null && n <= rating && { color: CHROME.floor }]}>
              {n}
            </Text>
          </Tap>
        ))}
      </View>
      <Meta>
        {rating === null
          ? "Rarely, to always. Answer it about the rooms you were actually in."
          : "Recorded for this week. Tap another to change it."}
      </Meta>

      <Hair style={{ marginTop: SPACE.sm }} />

      {/* ── Ninety days ─────────────────────────────────────────────────── */}
      <Eyebrow>NINETY DAYS</Eyebrow>
      <View style={s.lags}>
        {data.lagging.map((r, i) => (
          <Reveal key={r.key} index={i}>
            <Lag row={r} approximate={approx && r.key === "filler"} />
          </Reveal>
        ))}
      </View>
      <Meta>
        {data.baseline
          ? `Baseline taken ${new Date(data.baseline.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}. It is recorded once and never re-measured — a baseline you could redo whenever it looked bad would be a high score.`
          : "Every row here needs a baseline. Record one and they start meaning something."}
      </Meta>

      <Button label="BACK" tone="quiet" onPress={() => router.replace("/")} />
    </Screen>
  );
}

function Line({ label, text }: { label: string; text: string }) {
  return (
    <View style={s.line}>
      <Text style={s.lineLabel}>{label}</Text>
      <Text style={s.lineText}>{text}</Text>
    </View>
  );
}

function Lag({ row, approximate }: { row: LaggingRow; approximate: boolean }) {
  const fmt = (n: number | null) =>
    n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1);

  return (
    <View style={s.lag}>
      <View style={s.lagHead}>
        <Text style={s.lagLabel}>{row.label}</Text>
        <Text style={s.lagFigures}>
          <Text style={s.lagFrom}>{fmt(row.baseline)}</Text>
          <Text style={s.lagArrow}>{"  →  "}</Text>
          <Text style={s.lagNow}>
            {approximate && row.now !== null ? "≈" : ""}
            {fmt(row.now)}
          </Text>
          <Text style={s.lagFrom}>
            {row.target !== null ? `  ·  ${fmt(row.target)}${row.unit}` : ""}
          </Text>
        </Text>
      </View>
      <View style={s.lagTrack}>
        {row.progress === null ? null : (
          <View style={[s.lagFill, { width: `${Math.round(row.progress * 100)}%` }]} />
        )}
      </View>
      <Text style={s.lagNote}>{row.note}</Text>
    </View>
  );
}

function weekLabel(w: WeekStats): string {
  const a = new Date(w.startMs);
  const b = new Date(w.startMs + 6 * 86_400_000);
  const f = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase();
  return `${f(a)} – ${f(b)}`;
}

const s = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekLabel: { color: CHROME.dustDim, fontSize: 10, letterSpacing: 1.6, fontFamily: TYPE.mono, ...TABULAR },

  callout: {
    backgroundColor: "rgba(224, 85, 63, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(224, 85, 63, 0.4)",
    borderRadius: RADIUS.panel,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 5,
  },
  calloutTitle: { color: CHROME.chalk, fontSize: 18, fontFamily: TYPE.display },
  calloutBody: { color: CHROME.dust, fontSize: 12, lineHeight: 19, fontFamily: TYPE.displayItalic },

  densityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  density: { fontSize: 34, ...TABULAR },
  densityOf: { color: CHROME.dustDim, fontSize: 15, fontFamily: TYPE.ui },
  streak: { color: CHROME.dust, fontSize: 12, fontFamily: TYPE.mono, ...TABULAR },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  // A fortnight of squares is a grid; a fortnight of soft dots is a rhythm.
  cell: {
    width: 14,
    height: 14,
    borderRadius: 5,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  cellOn: { backgroundColor: CHROME.chalk, borderColor: CHROME.chalk },

  targets: { gap: 2 },
  target: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  targetTick: { width: 3, alignSelf: "stretch", minHeight: 18, backgroundColor: CHROME.carve },
  targetLabel: { flex: 1, color: CHROME.dust, fontSize: 14, fontFamily: TYPE.ui },
  targetValue: { color: CHROME.dust, fontSize: 15, fontFamily: TYPE.monoMedium, ...TABULAR },
  targetOf: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui },

  headline: { fontSize: 17, lineHeight: 25, fontFamily: TYPE.display, color: CHROME.chalk },
  line: { gap: 3, paddingVertical: 4 },
  lineLabel: { color: CHROME.dustDim, fontSize: 9, letterSpacing: 2, fontFamily: TYPE.uiMedium },
  lineText: { color: "#C3D0D2", fontSize: 14, lineHeight: 21, fontFamily: TYPE.ui },
  nextLabel: { color: SEMANTIC.ember, fontSize: 9, letterSpacing: 2, fontFamily: TYPE.uiSemi },
  next: { color: CHROME.chalk, fontSize: 15, lineHeight: 22, fontFamily: TYPE.displayItalic },
  failed: { color: SEMANTIC.flaw, fontSize: 12, fontFamily: TYPE.ui },

  ratingRow: { flexDirection: "row", gap: 6 },
  ratingCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
  },
  ratingOn: { backgroundColor: CHROME.chalk, borderColor: CHROME.chalk },
  ratingNum: { color: CHROME.dust, fontSize: 14, fontFamily: TYPE.monoMedium, ...TABULAR },

  lags: { gap: SPACE.md },
  lag: { gap: 6 },
  lagHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  lagLabel: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
  lagFigures: { ...TABULAR },
  lagFrom: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.ui },
  lagArrow: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },
  lagNow: { color: CHROME.chalk, fontSize: 15, fontFamily: TYPE.uiMedium },
  lagTrack: { height: 2, backgroundColor: CHROME.strata },
  lagFill: { height: 2, backgroundColor: SEMANTIC.ember },
  lagNote: { color: CHROME.dustDim, fontSize: 11, lineHeight: 16, fontFamily: TYPE.ui },
});
