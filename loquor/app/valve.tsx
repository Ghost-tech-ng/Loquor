// The Valve.
//
// Every other drill in this app measures what you said. This one measures how
// the sound got out, which is a different instrument entirely — so it is the
// only screen with no transcript, no model, no key and no network. The
// microphone is a meter here and the audio is deleted per step.
//
// The problem it exists for: a voice trained for years to be quiet by squeezing
// rather than by using less air. The squeeze shuts the mouth down, the sound
// takes the only route left, and past some volume the soft palate stops sealing
// and the tone goes into the nose. The escape is load-dependent — fine quiet,
// gone loud — so the useful measurement is not "is it nasal", it is "at what
// level does it start". That number is a rung, and moving it is the whole drill.
//
// What the phone can and cannot do is split honestly. Volume is machine-measured
// and calibrated per session, because iOS gain control makes an absolute level
// meaningless. Nasal escape is NOT estimated acoustically — single-microphone
// nasality detection is unreliable and a confident wrong number here would be
// worse than none. The leak call is the speaker's own, made against a physical
// instrument: a mirror under the nostrils either fogs or it does not.

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

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
import { useMeter } from "../components/useMeter";
import { CHROME, RADIUS, SEMANTIC, SPACE, SURFACE, TABULAR, TYPE, heat } from "../theme";
import {
  MATCH_PHRASE,
  OFFLINE_NOTE,
  PASSAGES,
  PRESSURE_PHRASES,
  ROUTINE,
  type RoutineStep,
} from "../content/valve";
import {
  ALL_RUNGS,
  FLOOR_DB,
  RUNGS,
  calibrationFault,
  hitRung,
  ladderResult,
  ladderVerdict,
  rungPosition,
  thresholdTrend,
  workingRung,
  type Calibration,
  type Rung,
  type RungOutcome,
} from "../lib/valve";
import { saveValveSession, valveThresholds } from "../lib/db";

const MATCH_REPS = 3;

export default function Valve() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [cal, setCal] = useState<Calibration | null>(null);
  const [outcomes, setOutcomes] = useState<readonly RungOutcome[]>([]);
  const [carry, setCarry] = useState<{ rung: Rung; seconds: number } | null>(null);
  const startedAt = useRef(Date.now());

  const step = ROUTINE[index];
  const next = useCallback(() => setIndex((i) => Math.min(ROUTINE.length - 1, i + 1)), []);

  if (!started) return <Brief onBegin={() => { startedAt.current = Date.now(); setStarted(true); }} onExit={() => router.back()} />;
  if (!step) return null;

  if (step.kind === "calibrate")
    return (
      <Calibrate
        step={step}
        onSet={(c) => {
          setCal(c);
          next();
        }}
      />
    );

  if (step.kind === "release" || step.kind === "velum")
    return <Timed step={step} onDone={next} />;

  if (step.kind === "ladder" && cal)
    return (
      <LadderStep
        step={step}
        cal={cal}
        onDone={(o) => {
          setOutcomes(o);
          next();
        }}
      />
    );

  if (step.kind === "match")
    return <Match step={step} rung={workingRung(ladderResult(outcomes))} onDone={next} />;

  if (step.kind === "carry" && cal)
    return (
      <Carry
        step={step}
        cal={cal}
        rung={workingRung(ladderResult(outcomes))}
        onDone={(seconds, rung) => {
          setCarry({ rung, seconds });
          next();
        }}
      />
    );

  return (
    <Result
      cal={cal}
      outcomes={outcomes}
      carry={carry}
      startedAt={startedAt.current}
      onExit={() => router.back()}
    />
  );
}

// ------------------------------------------------------------------- brief

function Brief({ onBegin, onExit }: { onBegin: () => void; onExit: () => void }) {
  return (
    <Screen>
      <Masthead right="THE VALVE" />
      <Reveal index={0}>
        <Eyebrow>BEFORE YOU START</Eyebrow>
        <Display style={{ marginTop: SPACE.xs }}>Get something you can fog.</Display>
      </Reveal>

      <Reveal index={1}>
        <Body>
          A small mirror, a spoon, or the back of your phone. Hold it just under
          your nostrils while you speak. If air is escaping through your nose it
          leaves a patch of mist you can see. That patch is the only honest
          reading in this drill — the phone measures how loud you are, you read
          whether it leaked.
        </Body>
      </Reveal>

      <Reveal index={2}>
        <Panel>
          <Eyebrow>NO MIRROR</Eyebrow>
          <Meta>
            Pinch your nose shut and say the line, then say it again with the
            nose free. If the two sound different, the second one leaked. It is a
            coarser test and it works.
          </Meta>
        </Panel>
      </Reveal>

      <Reveal index={3}>
        <Panel>
          <Eyebrow>THIS DRILL STAYS ON THE PHONE</Eyebrow>
          <Meta>{OFFLINE_NOTE}</Meta>
        </Panel>
      </Reveal>

      <Reveal index={4} style={{ gap: SPACE.sm }}>
        <Button label="BEGIN" onPress={onBegin} />
        <Button label="NOT NOW" tone="quiet" onPress={onExit} />
      </Reveal>
    </Screen>
  );
}

/** Every step shares a head: what to do, and why it is worth doing. */
function Head({ step, right }: { step: RoutineStep; right: string }) {
  return (
    <>
      <Masthead right={right} />
      <Reveal index={0}>
        <Eyebrow>{step.name.toUpperCase()}</Eyebrow>
        <Display style={{ marginTop: SPACE.xs }}>{step.instruction}</Display>
        {step.because ? <Meta style={{ marginTop: SPACE.sm }}>{step.because}</Meta> : null}
      </Reveal>
    </>
  );
}

// --------------------------------------------------------------- calibrate

function Calibrate({ step, onSet }: { step: RoutineStep; onSet: (c: Calibration) => void }) {
  const meter = useMeter();
  const [quietDb, setQuietDb] = useState<number | null>(null);
  const [fault, setFault] = useState<string | null>(null);

  const phrase = PRESSURE_PHRASES[0] ?? "";
  const takingQuiet = quietDb === null;

  const finish = async () => {
    const db = await meter.stop();
    if (takingQuiet) {
      setQuietDb(db);
      return;
    }
    const c: Calibration = { quietDb: quietDb ?? db, loudDb: db };
    const problem = calibrationFault(c);
    if (problem) {
      setFault(problem);
      setQuietDb(null);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSet(c);
  };

  return (
    <Screen>
      <Head step={step} right="1 / 6" />

      <Reveal index={1}>
        <Panel style={meter.running ? { borderColor: SEMANTIC.ember } : null}>
          <Eyebrow>{takingQuiet ? "TAKE ONE — AS QUIET AS YOU CAN" : "TAKE TWO — AS LOUD AS IS COMFORTABLE"}</Eyebrow>
          <Text style={s.phrase}>{phrase}</Text>
        </Panel>
      </Reveal>

      {meter.running ? (
        <Reveal index={2}>
          <Bar db={meter.peakDb} />
        </Reveal>
      ) : null}

      {fault ? (
        <Reveal index={2}>
          <Panel style={{ borderColor: SEMANTIC.flaw }}>
            <Eyebrow style={{ color: SEMANTIC.flaw }}>SET IT AGAIN</Eyebrow>
            <Meta>{fault}</Meta>
          </Panel>
        </Reveal>
      ) : null}

      {meter.error ? (
        <Reveal index={3}>
          <Meta style={{ color: SEMANTIC.flaw }}>{meter.error}</Meta>
        </Reveal>
      ) : null}

      <Reveal index={3}>
        {meter.running ? (
          <Button label="DONE" onPress={finish} />
        ) : (
          <Button
            label={takingQuiet ? "SAY IT QUIETLY" : "SAY IT LOUDLY"}
            onPress={() => {
              setFault(null);
              meter.start();
            }}
            disabled={!meter.ready}
          />
        )}
      </Reveal>
    </Screen>
  );
}

/**
 * A raw level bar, used only during calibration.
 *
 * This is the one place in the drill that shows an uncalibrated level, because
 * it is the one place where no calibration exists yet. It is deliberately
 * unlabelled — there is no number on it, because the number would be dBFS and
 * dBFS means nothing until these two takes have given it a scale. All it has to
 * do is prove the microphone is hearing you.
 */
function Bar({ db }: { db: number }) {
  const t = Math.max(0, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB));
  return (
    <View style={s.track}>
      <View style={[s.trackFill, { width: `${t * 100}%`, backgroundColor: heat(t) }]} />
    </View>
  );
}

// ------------------------------------------------------------------- timed

function Timed({ step, onDone }: { step: RoutineStep; onDone: () => void }) {
  const total = step.seconds ?? 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && left === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    }
  }, [running, left, onDone]);

  const t = 1 - left / total;

  return (
    <Screen>
      <Head step={step} right={step.kind === "release" ? "2 / 6" : "3 / 6"} />

      <Reveal index={1} style={s.clockWrap}>
        <Text style={[s.clock, running ? { color: heat(t) } : null]}>
          {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </Text>
        <View style={s.track}>
          <View style={[s.trackFill, { width: `${t * 100}%`, backgroundColor: heat(t) }]} />
        </View>
      </Reveal>

      <Reveal index={2}>
        {running ? (
          <Button label="THAT'S ENOUGH" tone="ghost" onPress={onDone} />
        ) : (
          <Button label="START" onPress={() => setRunning(true)} />
        )}
      </Reveal>
    </Screen>
  );
}

// ------------------------------------------------------------------ ladder

type Pending = { peakDb: number; reached: boolean };

function LadderStep({
  step,
  cal,
  onDone,
}: {
  step: RoutineStep;
  cal: Calibration;
  onDone: (outcomes: readonly RungOutcome[]) => void;
}) {
  const meter = useMeter();
  const [rung, setRung] = useState<Rung>(1);
  const [done, setDone] = useState<readonly RungOutcome[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  const phrase = PRESSURE_PHRASES[(rung - 1) % PRESSURE_PHRASES.length] ?? "";

  const stop = async () => {
    const peakDb = await meter.stop();
    setPending({ peakDb, reached: hitRung(peakDb, rung, cal) });
  };

  const settle = (leaked: boolean) => {
    const outcome: RungOutcome = { rung, peakDb: pending?.peakDb ?? 0, reached: true, leaked };
    const all = [...done, outcome];
    setPending(null);
    if (leaked || rung === RUNGS) {
      Haptics.notificationAsync(
        leaked ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      );
      onDone(all);
      return;
    }
    setDone(all);
    setRung((r) => (r + 1) as Rung);
  };

  const stopShort = () => {
    onDone([...done, { rung, peakDb: pending?.peakDb ?? 0, reached: false, leaked: false }]);
  };

  const position = meter.running ? rungPosition(meter.peakDb, cal) : 0;

  return (
    <Screen>
      <Head step={step} right="4 / 6" />

      <Reveal index={1}>
        <Ladder position={position} target={rung} live={meter.running} />
      </Reveal>

      <Reveal index={2}>
        <Panel style={meter.running ? { borderColor: SEMANTIC.ember } : null}>
          <Eyebrow>LEVEL {rung} OF {RUNGS}</Eyebrow>
          <Text style={s.phrase}>{phrase}</Text>
        </Panel>
      </Reveal>

      {pending && !pending.reached ? (
        <Reveal index={3} style={{ gap: SPACE.sm }}>
          <Panel style={{ borderColor: SEMANTIC.flaw }}>
            <Eyebrow style={{ color: SEMANTIC.flaw }}>THAT WASN&rsquo;T LEVEL {rung}</Eyebrow>
            <Meta>
              You landed somewhere else on the ladder, so the mirror tells us
              nothing about level {rung}. Say it again at the marked level, or
              stop here — stopping is an honest result, it just records a floor
              instead of a limit.
            </Meta>
          </Panel>
          <Button label="SAY IT AGAIN" onPress={() => setPending(null)} />
          <Button label="STOP HERE" tone="ghost" onPress={stopShort} />
        </Reveal>
      ) : null}

      {pending && pending.reached ? (
        <Reveal index={3} style={{ gap: SPACE.sm }}>
          <Panel>
            <Eyebrow>THE MIRROR</Eyebrow>
            <Meta>Did it mist while you were speaking?</Meta>
          </Panel>
          <Button label="IT STAYED CLEAR" onPress={() => settle(false)} />
          <Button label="IT FOGGED" tone="ghost" onPress={() => settle(true)} />
        </Reveal>
      ) : null}

      {!pending ? (
        <Reveal index={3}>
          {meter.running ? (
            <Button label="DONE" onPress={stop} />
          ) : (
            <Button label="SAY IT" onPress={() => meter.start()} disabled={!meter.ready} />
          )}
        </Reveal>
      ) : null}
    </Screen>
  );
}

/**
 * Five rungs, quietest at the bottom, with the target outlined and the live
 * level climbing through them.
 *
 * The number under it is a rung, not decibels. Showing dBFS would invite reading
 * it across sessions, and across sessions it means nothing — the whole point of
 * calibrating at the start is that only the position is comparable.
 */
function Ladder({ position, target, live }: { position: number; target: Rung; live: boolean }) {
  return (
    <View style={s.ladder}>
      {[...ALL_RUNGS].reverse().map((n) => {
        const fill = Math.max(0, Math.min(1, position - n));
        const t = (n - 1) / (RUNGS - 1);
        const isTarget = n === target;
        return (
          <View
            key={n}
            style={[
              s.rung,
              isTarget && { borderColor: SEMANTIC.ember, backgroundColor: SURFACE.sunk },
            ]}
          >
            <View style={[s.rungFill, { width: `${fill * 100}%`, backgroundColor: heat(t) }]} />
            <Text style={[s.rungLabel, isTarget && { color: CHROME.chalk }]}>{n}</Text>
          </View>
        );
      })}
      <Meta style={s.ladderNote}>
        {live ? "Hold the outlined level." : "Quietest at the bottom."}
      </Meta>
    </View>
  );
}

// ------------------------------------------------------------------- match

function Match({ step, rung, onDone }: { step: RoutineStep; rung: Rung; onDone: () => void }) {
  const [reps, setReps] = useState(0);

  return (
    <Screen>
      <Head step={step} right="5 / 6" />

      <Reveal index={1}>
        <Panel>
          <Eyebrow>AT LEVEL {rung} — TWICE EACH TIME</Eyebrow>
          <Text style={s.phrase}>{MATCH_PHRASE}</Text>
        </Panel>
      </Reveal>

      <Reveal index={2}>
        <Panel>
          <Eyebrow>WHAT TO LISTEN FOR</Eyebrow>
          <Meta>
            Pinched, the sound has nowhere to go but out of your mouth, so what
            you hear is your own voice with the leak closed. That is the target.
            Free it and try to keep the same brightness — wider jaw, not more
            push. Nothing is recorded here; this step is your ear.
          </Meta>
        </Panel>
      </Reveal>

      <Reveal index={3} style={{ gap: SPACE.sm }}>
        <View style={s.pips}>
          {Array.from({ length: MATCH_REPS }, (_, i) => (
            <View key={i} style={[s.pip, i < reps && { backgroundColor: SEMANTIC.ember }]} />
          ))}
        </View>
        {reps < MATCH_REPS ? (
          <Button
            label="THAT'S ONE"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setReps((r) => r + 1);
            }}
          />
        ) : (
          <Button label="CARRY IT OVER" onPress={onDone} />
        )}
      </Reveal>
    </Screen>
  );
}

// ------------------------------------------------------------------- carry

function Carry({
  step,
  cal,
  rung,
  onDone,
}: {
  step: RoutineStep;
  cal: Calibration;
  rung: Rung;
  onDone: (seconds: number, rung: Rung) => void;
}) {
  const meter = useMeter();
  const [pick, setPick] = useState(0);
  const passage = PASSAGES[pick % PASSAGES.length];

  const stop = async () => {
    const seconds = meter.seconds;
    await meter.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(seconds, rung);
  };

  if (!passage) return null;

  return (
    <Screen>
      <Head step={step} right="6 / 6" />

      <Reveal index={1}>
        <Ladder position={meter.running ? rungPosition(meter.peakDb, cal) : 0} target={rung} live={meter.running} />
      </Reveal>

      <Reveal index={2}>
        <Panel style={meter.running ? { borderColor: SEMANTIC.ember } : null}>
          <Eyebrow>{passage.title.toUpperCase()}</Eyebrow>
          <Text style={s.passage}>{passage.text}</Text>
          <Hair style={{ marginVertical: SPACE.sm }} />
          <Meta>{passage.note}</Meta>
        </Panel>
      </Reveal>

      <Reveal index={3} style={{ gap: SPACE.sm }}>
        {meter.running ? (
          <Button label="FINISHED READING" onPress={stop} />
        ) : (
          <>
            <Button label="READ IT ALOUD" onPress={() => meter.start()} disabled={!meter.ready} />
            <Button label="A DIFFERENT PASSAGE" tone="ghost" onPress={() => setPick((p) => p + 1)} />
          </>
        )}
      </Reveal>
    </Screen>
  );
}

// ------------------------------------------------------------------ result

function Result({
  cal,
  outcomes,
  carry,
  startedAt,
  onExit,
}: {
  cal: Calibration | null;
  outcomes: readonly RungOutcome[];
  carry: { rung: Rung; seconds: number } | null;
  startedAt: number;
  onExit: () => void;
}) {
  const result = ladderResult(outcomes);
  const [trend, setTrend] = useState<ReturnType<typeof thresholdTrend> | null>(null);
  const written = useRef(false);

  useEffect(() => {
    if (written.current || !cal) return;
    written.current = true;
    (async () => {
      try {
        await saveValveSession({
          id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
          startedAt,
          durationS: (Date.now() - startedAt) / 1000,
          quietDb: cal.quietDb,
          loudDb: cal.loudDb,
          threshold: result.threshold,
          topClean: result.topClean,
          complete: result.complete,
          rungs: outcomes,
          carryRung: carry?.rung ?? null,
          carryS: carry?.seconds ?? null,
        });
        setTrend(thresholdTrend(await valveThresholds()));
      } catch {
        /* a session that fails to save is still a session that was done */
      }
    })();
  }, [cal, outcomes, carry, startedAt, result.threshold, result.topClean, result.complete]);

  const held = result.threshold > RUNGS;

  return (
    <Screen>
      <Masthead right="THE VALVE" />

      <Reveal index={0}>
        <Eyebrow>SEAL HOLDS TO</Eyebrow>
        <View style={s.figureRow}>
          <Text style={[s.bigFigure, { color: heat(result.topClean / RUNGS) }]}>
            {held ? RUNGS : Math.max(result.topClean, 0)}
          </Text>
          <Text style={s.bigUnit}>OF {RUNGS}</Text>
        </View>
      </Reveal>

      <Reveal index={1}>
        <Body>{ladderVerdict(result)}</Body>
      </Reveal>

      <Reveal index={2}>
        <Panel>
          <Eyebrow>THE LADDER</Eyebrow>
          {[...ALL_RUNGS].reverse().map((n) => {
            const o = outcomes.find((x) => x.rung === n);
            const label = !o || !o.reached ? "not reached" : o.leaked ? "leaked" : "clean";
            const tint = !o || !o.reached ? CHROME.dustDim : o.leaked ? SEMANTIC.flaw : SEMANTIC.solid;
            return (
              <View key={n} style={s.row}>
                <Text style={s.rowKey}>LEVEL {n}</Text>
                <Text style={[s.rowValue, { color: tint }]}>{label}</Text>
              </View>
            );
          })}
        </Panel>
      </Reveal>

      {trend?.ready ? (
        <Reveal index={3}>
          <Panel>
            <Eyebrow>ACROSS YOUR LAST SIX</Eyebrow>
            <Meta>
              {trend.direction === "better"
                ? `The leak is starting ${Math.abs(trend.delta).toFixed(1)} of a level higher than it was. That is the seal holding under more pressure, which is the only thing this drill can move.`
                : trend.direction === "worse"
                  ? `The leak is starting ${Math.abs(trend.delta).toFixed(1)} of a level lower than it was. Usually that means the release step is being skipped, or you are pushing from the throat to hit the rungs.`
                  : "Flat. This one moves in weeks, not days — a fortnight of daily sets before you read anything into it."}
            </Meta>
          </Panel>
        </Reveal>
      ) : (
        <Reveal index={3}>
          <Panel>
            <Eyebrow>NO TREND YET</Eyebrow>
            <Meta>
              A single session moves a rung on mood, hydration and how honestly
              the mirror gets read. Six complete ladders and this panel starts
              telling you something.
            </Meta>
          </Panel>
        </Reveal>
      )}

      <Reveal index={4}>
        <Meta style={{ color: CHROME.dustDim }}>{OFFLINE_NOTE}</Meta>
      </Reveal>

      <Reveal index={5}>
        <Button label="DONE" onPress={onExit} />
      </Reveal>
    </Screen>
  );
}

const s = StyleSheet.create({
  phrase: { color: CHROME.chalk, fontSize: 20, lineHeight: 28, fontFamily: TYPE.displaySoft },
  passage: { color: "#C3D0D2", fontSize: 16, lineHeight: 26, fontFamily: TYPE.ui },

  clockWrap: { alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.lg },
  clock: { color: CHROME.chalk, fontSize: 52, fontFamily: TYPE.display, ...TABULAR },
  track: { height: 2, alignSelf: "stretch", backgroundColor: CHROME.carve },
  trackFill: { height: 2 },

  ladder: { gap: 5 },
  rung: {
    height: 32,
    borderRadius: RADIUS.soft,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    backgroundColor: SURFACE.sunk,
    justifyContent: "center",
    overflow: "hidden",
  },
  rungFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.55 },
  rungLabel: {
    color: CHROME.dustDim,
    fontSize: 10,
    fontFamily: TYPE.monoMedium,
    marginLeft: 12,
    ...TABULAR,
  },
  ladderNote: { marginTop: SPACE.xs },

  pips: { flexDirection: "row", gap: SPACE.sm, justifyContent: "center", paddingVertical: SPACE.sm },
  pip: { width: 10, height: 10, borderRadius: 5, backgroundColor: CHROME.carve },

  figureRow: { flexDirection: "row", alignItems: "baseline", gap: SPACE.sm, marginTop: SPACE.xs },
  bigFigure: { fontSize: 76, fontFamily: TYPE.display, letterSpacing: -3, ...TABULAR },
  bigUnit: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, letterSpacing: 1.2 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 3 },
  rowKey: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.mono, letterSpacing: 0.8 },
  rowValue: { fontSize: 12, fontFamily: TYPE.uiSemi },
});
