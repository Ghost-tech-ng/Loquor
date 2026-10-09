// Pip, hosted once at the root so it can wander across every screen.
//
// The rules that keep it from getting in the way:
//   - It never takes a touch anywhere but Home. Everywhere else the whole layer
//     is pointerEvents="none", so a tap lands on whatever is underneath.
//   - It leaves the screen whenever something records or a timed game runs
//     (petPresence), and comes back afterwards with something to say.
//   - It stands on the line just above the tab bar, or clings to a side edge,
//     so it sits over the margins rather than over the content.
//
// What it looks like and where it goes are decided in features/pet/pet.ts;
// this file only draws and animates. Movement and the idle breath run on the UI
// thread; the JS side wakes every few seconds to choose the next perch.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { usePathname } from "expo-router";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import type { ViewStyle } from "react-native";

import { feel } from "./feel";
import { AURORA, CHROME, TYPE, alpha } from "../../theme";
import { loadSettings } from "../../lib/settings";
import { onReward, snapshot } from "../../features/progression/progressionStore";
import {
  backLine,
  evolveLine,
  moodOf,
  nextSpot,
  petLine,
  restMs,
  stageOf,
  type Mood,
  type Spot,
  type Stage,
  type StageName,
} from "../../features/pet/pet";
import {
  isPetAway,
  isPetEnabled,
  onPetPresence,
  setPetEnabled,
} from "../../features/pet/petPresence";

/** Matches the floating tab bar in app/(tabs)/_layout.tsx. */
const BAR_H = 66;
const BUBBLE_W = 210;

type PetInfo = { stage: Stage; mood: Mood; streak: number; level: number };
type Reaction = { kind: "back" | "reward" | "evolve" | "tap"; text: string };
type Bubble = { id: number; text: string; left: number };

async function readPet(): Promise<PetInfo | null> {
  try {
    const p = await snapshot();
    return {
      stage: stageOf(p.level.level),
      mood: moodOf(p.streak),
      streak: p.streak.current,
      level: p.level.level,
    };
  } catch {
    return null;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function PetHost() {
  const onHome = usePathname() === "/";
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [pet, setPet] = useState<PetInfo | null>(null);
  const [away, setAway] = useState(isPetAway());
  const [enabled, setEnabled] = useState(isPetEnabled());
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const hidden = away || !enabled;
  const loaded = pet !== null;

  // Timers and listeners outlive any one render, so everything they read lives
  // in refs rather than in closures that would go stale.
  const petRef = useRef(pet);
  petRef.current = pet;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const bounds = useRef({ width, top: insets.top, ground: 0 });
  bounds.current = {
    width,
    top: insets.top,
    ground: height - (BAR_H + Math.max(insets.bottom - 6, 10)) + 3,
  };
  const pos = useRef<Spot>({ x: 0, y: 0, perch: "ground" });
  const busy = useRef(false);
  const placed = useRef(false);
  const wasHidden = useRef(false);
  const exitLeft = useRef(true);
  const pending = useRef<Reaction | null>(null);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const hop = useSharedValue(0);
  const face = useSharedValue(1);
  const tilt = useSharedValue(0);
  const wing = useSharedValue(0);
  const breath = useSharedValue(0);
  const blink = useSharedValue(1);
  const opacity = useSharedValue(0);
  const flash = useSharedValue(0);

  // ---- motion primitives -------------------------------------------------

  const faceTo = (dir: number, delay = 0) => {
    face.value = withDelay(delay, withTiming(dir, { duration: 140 }));
  };

  const flap = (times: number) => {
    wing.value = withSequence(
      withRepeat(
        withSequence(withTiming(-40, { duration: 85 }), withTiming(8, { duration: 85 })),
        times
      ),
      withTiming(0, { duration: 120 })
    );
  };

  const bounce = (rise: number, times: number) => {
    hop.value = withRepeat(
      withSequence(
        withTiming(-rise, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) })
      ),
      times
    );
  };

  /** Starts the trip to `to` and returns how long it takes, in ms. */
  const moveTo = (to: Spot, stage: Stage, opts: { fly?: boolean } = {}): number => {
    const from = pos.current;
    pos.current = to;
    const dx = to.x - from.x;
    const dist = Math.hypot(dx, to.y - from.y);

    if (reducedRef.current) {
      x.value = to.x;
      y.value = to.y;
      return 0;
    }
    if (Math.abs(dx) > 2) faceTo(dx > 0 ? 1 : -1);

    if (stage.name === "egg") {
      const d = 700 + Math.abs(dx) * 12;
      const lean = dx > 0 ? 14 : -14;
      x.value = withTiming(to.x, { duration: d, easing: Easing.inOut(Easing.quad) });
      y.value = to.y;
      tilt.value = withSequence(
        withTiming(lean, { duration: d / 3 }),
        withTiming(-lean * 0.6, { duration: d / 3 }),
        withTiming(0, { duration: d / 3 })
      );
      return d;
    }

    const flying =
      stage.flies && (opts.fly || to.perch !== "ground" || from.perch !== "ground" || dist > 160);
    let d: number;
    if (flying) {
      d = clamp(dist / 0.4, 600, 1800);
      const ease = Easing.inOut(Easing.sin);
      x.value = withTiming(to.x, { duration: d, easing: ease });
      y.value = withTiming(to.y, { duration: d, easing: ease });
      hop.value = withSequence(
        withTiming(-Math.min(60, 20 + dist * 0.15), { duration: d / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: d / 2, easing: Easing.in(Easing.quad) })
      );
      flap(Math.ceil(d / 170));
    } else {
      const hops = Math.max(1, Math.round(Math.abs(dx) / (stage.size * 0.9)));
      const per = 260;
      d = hops * per;
      x.value = withTiming(to.x, { duration: d, easing: Easing.linear });
      y.value = withTiming(to.y, { duration: d });
      hop.value = withRepeat(
        withSequence(
          withTiming(-stage.size * 0.28, { duration: per / 2, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: per / 2, easing: Easing.in(Easing.quad) })
        ),
        hops
      );
    }
    // On a side perch, turn to face into the screen.
    if (to.perch === "left") faceTo(1, d);
    if (to.perch === "right") faceTo(-1, d);
    return d;
  };

  const say = (text: string, ms: number) => {
    const p = petRef.current;
    if (!p) return;
    if (sayTimer.current) clearTimeout(sayTimer.current);
    const px = pos.current.x;
    const S = p.stage.size;
    const left = clamp(-(BUBBLE_W - S) / 2, 8 - px, bounds.current.width - 8 - BUBBLE_W - px);
    setBubble({ id: Date.now(), text, left });
    busy.current = true;
    sayTimer.current = setTimeout(() => {
      setBubble(null);
      busy.current = false;
    }, ms);
  };

  const react = (r: Reaction) => {
    const p = petRef.current;
    if (!p) return;
    if (!reducedRef.current) {
      if (p.stage.name === "egg") {
        tilt.value = withSequence(
          withTiming(-12, { duration: 90 }),
          withTiming(12, { duration: 120 }),
          withTiming(-6, { duration: 100 }),
          withTiming(0, { duration: 90 })
        );
      } else {
        bounce(r.kind === "tap" || r.kind === "back" ? 10 : 16, r.kind === "tap" ? 1 : 2);
        flap(r.kind === "tap" ? 2 : 4);
      }
      if (r.kind === "evolve") {
        flash.value = withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: 900 }));
      }
    }
    if (r.kind === "evolve") feel.win();
    say(r.text, r.kind === "evolve" ? 4200 : 2600);
  };

  // ---- presence and progress ---------------------------------------------

  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => {
      if (alive) setPetEnabled(s.pet);
    });
    void readPet().then((p) => {
      if (alive && p) setPet(p);
    });
    const unPresence = onPetPresence(() => {
      setAway(isPetAway());
      setEnabled(isPetEnabled());
    });
    // A new day can flip the mood (sleepy overnight, happy after a take).
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void readPet().then((p) => {
        if (alive && p) setPet(p);
      });
    });
    const unReward = onReward((r) => {
      const from = stageOf(r.levelFrom.level);
      const to = stageOf(r.levelTo.level);
      const gained = r.to - r.from;
      const reaction: Reaction =
        to.name !== from.name
          ? { kind: "evolve", text: evolveLine(to) }
          : {
              kind: "reward",
              text:
                to.name === "egg"
                  ? `*wobble* +${gained} XP`
                  : gained > 0
                    ? `+${gained} XP! Squawk!`
                    : "Squawk!",
            };
      void readPet().then((p) => {
        if (alive && p) setPet(p);
      });
      // If Pip is away, it says this on the way back instead.
      pending.current = reaction;
      if (!hiddenRef.current) {
        setTimeout(() => {
          if (pending.current !== reaction || hiddenRef.current) return;
          pending.current = null;
          react(reaction);
        }, 900);
      }
    });
    return () => {
      alive = false;
      unPresence();
      unReward();
      sub.remove();
      if (sayTimer.current) clearTimeout(sayTimer.current);
    };
    // Mount-only: everything the callbacks read goes through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrive, leave and come back.
  useEffect(() => {
    const p = petRef.current;
    if (!p) return;
    const S = p.stage.size;
    const b = bounds.current;
    const groundY = b.ground - S;

    if (!placed.current) {
      if (hidden) return;
      placed.current = true;
      const start: Spot = { x: b.width * 0.68, y: groundY, perch: "ground" };
      pos.current = start;
      x.value = start.x;
      y.value = start.y;
      opacity.value = withTiming(1, { duration: reduced ? 0 : 500 });
      return;
    }

    if (hidden) {
      wasHidden.current = true;
      if (sayTimer.current) clearTimeout(sayTimer.current);
      setBubble(null);
      busy.current = false;
      exitLeft.current = pos.current.x + S / 2 < b.width / 2;
      const off = exitLeft.current ? -S - 24 : b.width + 24;
      pos.current = { x: off, y: pos.current.y, perch: "ground" };
      if (reduced) {
        opacity.value = 0;
        return;
      }
      faceTo(exitLeft.current ? -1 : 1);
      cancelAnimation(hop);
      x.value = withTiming(off, { duration: 420, easing: Easing.in(Easing.quad) });
      if (p.stage.flies) {
        hop.value = withTiming(-30, { duration: 420 });
        flap(3);
      } else {
        bounce(S * 0.25, 2);
      }
      opacity.value = withDelay(300, withTiming(0, { duration: 150 }));
      return;
    }

    if (!wasHidden.current) return;
    wasHidden.current = false;
    busy.current = true;
    const t = setTimeout(() => {
      const fromLeft = exitLeft.current;
      const enter = fromLeft ? -S - 24 : b.width + 24;
      cancelAnimation(x);
      cancelAnimation(y);
      x.value = enter;
      y.value = groundY;
      hop.value = 0;
      pos.current = { x: enter, y: groundY, perch: "ground" };
      opacity.value = withTiming(1, { duration: 150 });
      const spot = 24 + Math.random() * 90;
      const d = moveTo(
        { x: fromLeft ? spot : b.width - S - spot, y: groundY, perch: "ground" },
        p.stage,
        { fly: true }
      );
      setTimeout(() => {
        if (hiddenRef.current) return;
        const r = pending.current ?? { kind: "back", text: backLine(Math.random, p.stage) };
        pending.current = null;
        react(r);
      }, d);
    }, reduced ? 0 : 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, loaded]);

  // A new stage is a new size: put the feet back on the ground.
  const stageName = pet?.stage.name;
  useEffect(() => {
    const p = petRef.current;
    if (!p || !placed.current || hiddenRef.current) return;
    const S = p.stage.size;
    const b = bounds.current;
    if (pos.current.perch === "ground") {
      const next: Spot = {
        x: clamp(pos.current.x, 12, b.width - S - 12),
        y: b.ground - S,
        perch: "ground",
      };
      pos.current = next;
      x.value = withTiming(next.x, { duration: 300 });
      y.value = withTiming(next.y, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageName]);

  // Breathing and blinking. Sleepy is slower and eyes-shut.
  const mood = pet?.mood;
  useEffect(() => {
    if (!mood) return;
    const sleepy = mood === "sleepy";
    if (reduced) {
      breath.value = 0;
      blink.value = sleepy ? 0.15 : 1;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: sleepy ? 2400 : 1300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    blink.value = sleepy
      ? withTiming(0.15, { duration: 400 })
      : withRepeat(
          withSequence(
            withDelay(2800, withTiming(0.1, { duration: 70 })),
            withTiming(1, { duration: 90 })
          ),
          -1
        );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(blink);
    };
  }, [mood, reduced, breath, blink]);

  // Wander: rest, pick a perch, go there, repeat.
  useEffect(() => {
    if (!pet || hidden || reduced) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const rest = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (busy.current) {
          rest();
          return;
        }
        if (pet.mood === "happy" && pet.stage.flies && Math.random() < 0.3) flap(2);
        const d = moveTo(nextSpot(Math.random, bounds.current, pos.current, pet.stage, pet.mood), pet.stage);
        timer = setTimeout(() => alive && rest(), d);
      }, restMs(Math.random, pet.mood));
    };
    rest();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet, hidden, reduced]);

  const onTap = () => {
    const p = petRef.current;
    if (!p) return;
    feel.tap();
    react({ kind: "tap", text: petLine(Math.random, p.stage, p.mood, p.streak, p.level) });
  };

  // ---- drawing ------------------------------------------------------------

  const place = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: hop.value - breath.value * 1.5 },
      { scaleX: face.value },
      { rotate: `${tilt.value}deg` },
      { scaleY: 1 + breath.value * 0.03 },
    ],
  }));
  const wingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wing.value}deg` }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [{ scale: 0.6 + (1 - flash.value) * 1.4 }],
  }));

  if (!pet) return null;
  const S = pet.stage.size;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[s.mover, { width: S, height: S }, place]}
        pointerEvents={onHome && !hidden ? "box-none" : "none"}
      >
        <Animated.View
          pointerEvents="none"
          style={[s.flash, { width: S * 1.6, height: S * 1.6, borderRadius: S, left: -S * 0.3, top: -S * 0.3 }, flashStyle]}
        />
        <Pressable onPress={onTap} disabled={!onHome} hitSlop={10} style={{ width: S, height: S }}>
          <Animated.View style={[{ width: S, height: S, transformOrigin: "50% 100%" }, body]}>
            <Creature name={pet.stage.name} size={S} wing={wingStyle} eye={eyeStyle} sleepy={pet.mood === "sleepy"} />
          </Animated.View>
        </Pressable>
        {pet.mood === "sleepy" && !reduced ? <Zzz size={S} /> : null}
        {bubble ? (
          <Animated.View
            key={bubble.id}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(160)}
            pointerEvents="none"
            style={[s.bubbleWrap, { bottom: S + 6, left: bubble.left }]}
          >
            <View style={s.bubble}>
              <Text style={s.bubbleText}>{bubble.text}</Text>
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ---- the bird ---------------------------------------------------------------

type Palette = {
  body: string;
  belly: string;
  wing: string;
  wingTip: string;
  beak: string;
  beakLow: string;
  accent: string;
  cheek: string;
  tail: string;
};

const PALETTE: Record<Exclude<StageName, "egg">, Palette> = {
  chick: {
    body: "#FFD84D", belly: "#FFF1A8", wing: "#F5C02E", wingTip: "#F5C02E",
    beak: "#FF9F43", beakLow: "#E8812A", accent: "#F5C02E", cheek: "#FF9AA2", tail: "#F5C02E",
  },
  fledgling: {
    body: "#8BE07F", belly: "#D8F7B0", wing: "#4CC26A", wingTip: AURORA.cyan,
    beak: "#FFB347", beakLow: "#E8912A", accent: "#FFD84D", cheek: "#FF9AA2", tail: "#4CC26A",
  },
  parrot: {
    body: AURORA.emerald, belly: "#FFE066", wing: "#15A34A", wingTip: "#3B82F6",
    beak: "#FFB347", beakLow: "#E08A2A", accent: AURORA.coral, cheek: AURORA.coral, tail: "#3B82F6",
  },
  macaw: {
    body: "#FF4D4D", belly: "#FF6F5C", wing: "#FFD84D", wingTip: "#3B82F6",
    beak: "#F2EEE6", beakLow: "#2B2F36", accent: "#FFD84D", cheek: "#FFFFFF", tail: "#3B82F6",
  },
};

type EyeSpot = { cx: number; cy: number; r: number };
const FEET = "#FF9F43";

function Creature({
  name,
  size,
  wing,
  eye,
  sleepy,
}: {
  name: StageName;
  size: number;
  wing: AnimatedStyle<ViewStyle>;
  eye: AnimatedStyle<ViewStyle>;
  sleepy: boolean;
}) {
  if (name === "egg") {
    return (
      <>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Ellipse cx={50} cy={60} rx={26} ry={32} fill="#F6EBD4" stroke="#E2D2B0" strokeWidth={1.5} />
          <Circle cx={40} cy={74} r={2.2} fill="#D9C29A" />
          <Circle cx={61} cy={80} r={1.8} fill="#D9C29A" />
          <Circle cx={64} cy={66} r={2.4} fill="#D9C29A" />
          <Circle cx={35} cy={62} r={1.6} fill="#D9C29A" />
          <Circle cx={52} cy={87} r={1.6} fill="#D9C29A" />
          <Path
            d="M27 48 L34 42 L40 49 L47 41 L54 49 L61 42 L67 49 L73 44"
            stroke="#B79F75"
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <Eye spot={{ cx: 43, cy: 56, r: 3.2 }} size={size} style={eye} sleepy={sleepy} />
        <Eye spot={{ cx: 57, cy: 56, r: 3.2 }} size={size} style={eye} sleepy={sleepy} />
      </>
    );
  }

  const p = PALETTE[name];
  if (name === "chick") {
    return (
      <>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d="M42 89 L42 95 M38 97 L42 95 L46 97 M58 89 L58 95 M54 97 L58 95 L62 97"
            stroke={FEET}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={50} cy={66} r={25} fill={p.body} />
          <Circle cx={55} cy={41} r={18} fill={p.body} />
          <Ellipse cx={54} cy={72} rx={15} ry={13} fill={p.belly} />
          <Path d="M50 25 Q46 13 54 15 Q51 19 55 25 Z" fill={p.accent} />
          <Path d="M55 25 Q57 14 63 17 Q58 20 59 25 Z" fill={p.accent} />
          <Path d="M71 38 L82 42 L71 46 Z" fill={p.beak} />
          <Circle cx={65} cy={48} r={4} fill={p.cheek} opacity={0.6} />
        </Svg>
        <Wing size={size} origin="38% 60%" style={wing}>
          <Path d="M30 58 Q22 68 30 80 Q42 78 42 62 Z" fill={p.wing} />
        </Wing>
        <Eye spot={{ cx: 64, cy: 37, r: 4 }} size={size} style={eye} sleepy={sleepy} />
      </>
    );
  }

  const macaw = name === "macaw";
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path
          d={macaw ? "M36 66 L6 98 L20 99 L44 76 Z" : "M34 68 L14 92 L24 95 L42 76 Z"}
          fill={p.tail}
        />
        <Path
          d="M44 84 L44 92 M40 94 L44 92 L48 94 M54 84 L54 92 M50 94 L54 92 L58 94"
          stroke={FEET}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
        <Ellipse cx={48} cy={62} rx={22} ry={24} fill={p.body} />
        <Ellipse cx={54} cy={68} rx={12} ry={15} fill={p.belly} />
        <Circle cx={60} cy={36} r={18} fill={p.body} />
        {name === "fledgling" ? <Path d="M56 19 Q54 8 61 10 Q58 15 60 19 Z" fill={p.accent} /> : null}
        {name === "parrot" ? <Path d="M53 23 Q62 13 73 22 Q64 21 58 27 Z" fill={p.accent} /> : null}
        {macaw ? (
          <Ellipse cx={69} cy={38} rx={8} ry={8} fill={p.cheek} opacity={0.92} />
        ) : (
          <Circle cx={68} cy={44} r={3.5} fill={p.cheek} opacity={0.55} />
        )}
        <Path d="M74 30 Q90 31 86 47 Q82 41 75 42 Z" fill={p.beak} />
        <Path d="M75 42 Q81 43 83 47 Q78 50 74 46 Z" fill={p.beakLow} />
      </Svg>
      <Wing size={size} origin="46% 54%" style={wing}>
        <Path d="M40 50 Q22 60 28 84 Q44 82 54 60 Z" fill={p.wing} />
        <Path d="M28 84 Q29 73 36 68 Q35 79 28 84 Z" fill={p.wingTip} />
      </Wing>
      <Eye spot={{ cx: 66, cy: 33, r: 4.2 }} size={size} style={eye} sleepy={sleepy} />
    </>
  );
}

function Wing({
  size,
  origin,
  style,
  children,
}: {
  size: number;
  origin: string;
  style: AnimatedStyle<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {children}
      </Svg>
    </Animated.View>
  );
}

function Eye({
  spot,
  size,
  style,
  sleepy,
}: {
  spot: EyeSpot;
  size: number;
  style: AnimatedStyle<ViewStyle>;
  sleepy: boolean;
}) {
  const k = size / 100;
  const r = spot.r * k;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.eye,
        { left: spot.cx * k - r, top: spot.cy * k - r, width: r * 2, height: r * 2, borderRadius: r },
        style,
      ]}
    >
      {sleepy ? null : (
        <View
          style={[s.glint, { left: r * 1.0, top: r * 0.3, width: r * 0.7, height: r * 0.7, borderRadius: r }]}
        />
      )}
    </Animated.View>
  );
}

function Zzz({ size }: { size: number }) {
  const t: SharedValue<number> = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
    return () => cancelAnimation(t);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.2 ? t.value * 5 : t.value > 0.8 ? (1 - t.value) * 5 : 1,
    transform: [{ translateY: -t.value * 16 }, { translateX: t.value * 8 }, { scale: 0.8 + t.value * 0.5 }],
  }));
  return (
    <Animated.Text pointerEvents="none" style={[s.zzz, { left: size * 0.62, top: -size * 0.1 }, style]}>
      z
    </Animated.Text>
  );
}

const s = StyleSheet.create({
  mover: { position: "absolute", left: 0, top: 0 },
  flash: { position: "absolute", borderWidth: 3, borderColor: AURORA.mint },
  eye: { position: "absolute", backgroundColor: "#10131A", overflow: "hidden" },
  glint: { position: "absolute", backgroundColor: "#FFFFFF" },
  zzz: { position: "absolute", color: CHROME.dust, fontFamily: TYPE.uiBold, fontSize: 14 },
  bubbleWrap: { position: "absolute", width: BUBBLE_W, alignItems: "center" },
  bubble: {
    backgroundColor: CHROME.raised,
    borderColor: alpha(AURORA.emerald, 0.35),
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleText: { color: CHROME.chalk, fontFamily: TYPE.uiMedium, fontSize: 13, textAlign: "center" },
});
