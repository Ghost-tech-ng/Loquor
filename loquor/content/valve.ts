// Drill material for the Valve.
//
// Every line of speakable text in this file is a lipogram: no M, no N, and no
// NG, anywhere. That is not a stylistic game. Those three are the only sounds in
// English that are *supposed* to come out of the nose, so a line containing one
// cannot tell you anything about whether your soft palate is sealing. Strip them
// out and any nasal sound left over is escape, by definition — which turns an
// ordinary sentence into a test instrument.
//
// The constraint is enforced by lib/valve.test.mjs. It is the one test in this
// project that guards content rather than code, because a single stray "and"
// would quietly invalidate every reading the drill produces and nothing on
// screen would look wrong.
//
// The phrases are also deliberately loaded with pressure consonants — P, B, T,
// D, K, G, S. Those demand high pressure inside the mouth, so they are the
// sounds a marginal seal fails on first. A phrase of open vowels would feel
// easy and prove nothing.

/** One rung of the ladder speaks one of these. Short enough to say in a breath
 *  at full volume without running out of air, which is its own bad habit. */
export const PRESSURE_PHRASES: readonly string[] = [
  "Pick the top card, tap it twice, put it back.",
  "Big dogs dig deep pits by the gate.",
  "Katie kept it quiet - six days, first to last.",
  "Stop the truck, drop the crate, back it up.",
  "The pilot got the cargo past the ridge at dusk.",
  "Cut the thick crust off the bread.",
  "Peter took the desk beside the tall door.",
  "That squad tackled the task, kept the schedule.",
];

/** Said twice at the same rung: once with the nose held shut, once free. The
 *  pinched version is the target sound. The free version is the attempt. */
export const MATCH_PHRASE = "Peter took a purple truck up the hill.";

export type ValvePassage = {
  id: string;
  title: string;
  /** Why this passage is worth the breath, beyond the drill. */
  note: string;
  text: string;
};

/** Carry-over material: the point of the drill is not to seal on a phrase, it
 *  is to seal while thinking about something else. These are long enough that
 *  attention drifts to the meaning, which is exactly when the habit reasserts. */
export const PASSAGES: readonly ValvePassage[] = [
  {
    id: "old-code",
    title: "Old code",
    note: "The argument against rewrites, which is worth having ready.",
    text:
      "Great software is old software. You look at a file, you see edits by fifty writers, decades apart. Every odd bit of it is a scar. Every scar is a defect fixed at three o'clock by a tired soul. So a rewrite is rarely wise: to rewrite is to reject a library of fixes, each paid for by a real outage. Better to read closely, edit lightly, ship, wait.",
  },
  {
    id: "lost-well",
    title: "Losing well",
    note: "The office skill that buys you the right to argue hard the next time.",
    text:
      "The rarest office skill: to argue hard for a good idea, to lose, to agree freely that it was a fair loss, thereafter to go build whatever the group chose. That last part is the whole trick. It buys you a very odd credit - the ability to fight for a later idea, at full force, without a soul at that table thirsty for your defeat.",
  },
  {
    id: "the-whisper",
    title: "The whisper",
    note: "About the exact thing you are here to fix.",
    text:
      "A great actor of the old school could hold a full theatre with a whisper. His secret was where the effort sat: at the jaw, at the lips, at the ribs - rarely at the throat. Loudest is easy. Clarity at low levels is the actual craft, because it asks for a wide, active jaw, a free chest, a free throat, all at a level that feels like a private aside.",
  },
];

export const PASSAGES_BY_ID = new Map(PASSAGES.map((p) => [p.id, p]));

// ---------------------------------------------------------------- the routine

export type StepKind =
  | "calibrate"
  | "release"
  | "velum"
  | "ladder"
  | "match"
  | "carry"
  | "result";

export type RoutineStep = {
  kind: StepKind;
  /** Shown as the screen's heading. */
  name: string;
  /** One line, in the second person, saying what to do. Never why. */
  instruction: string;
  /** The why, one line, under the instruction. People abandon exercises they
   *  cannot justify to themselves at the moment of doing them. */
  because: string;
  /** Wall-clock seconds, for the timed steps only. */
  seconds?: number;
};

/**
 * Ordered, and the order is the argument.
 *
 * Release comes before anything is measured, because measuring a squeezed voice
 * only records the squeeze. The velum wake-up comes before load, because asking
 * a cold soft palate to seal against pressure is how you confirm it cannot.
 * Carry-over comes last and it is the only step that matters over months: a seal
 * that holds on a phrase and fails in a sentence has not moved at all.
 */
export const ROUTINE: readonly RoutineStep[] = [
  {
    kind: "calibrate",
    name: "Set the range",
    instruction: "Say the phrase twice: once as quietly as you can, then as loudly as is comfortable.",
    because: "The phone has no idea what loud means for you. These two set the scale for everything after.",
  },
  {
    kind: "release",
    name: "Release",
    instruction: "Hum through a narrow straw, or trill your lips, on one steady note. Keep it going.",
    because:
      "Blocking the mouth part-way raises the pressure above your folds, which widens the throat and drops the larynx without you doing anything. It is the only way to get depth that does not involve pushing.",
    seconds: 90,
  },
  {
    kind: "velum",
    name: "Wake the valve",
    instruction: "Sing NG as in 'sung', hold it, then open into AH. Slowly. Six times.",
    because:
      "NG is the one sound made with the valve fully open. Opening into AH is the valve slamming shut. This is the only exercise where you can feel it move.",
    seconds: 60,
  },
  {
    kind: "ladder",
    name: "The ladder",
    instruction: "Say each phrase at the level shown. Then check the mirror.",
    because:
      "Your seal does not fail at every volume. It fails above some threshold. Finding that number is the whole point of this drill.",
  },
  {
    kind: "match",
    name: "Match it",
    instruction: "Say it holding your nose. Then say it again, free, and make it sound the same.",
    because:
      "Pinched is what sealed sounds like. You cannot aim at a sound you have never heard yourself make.",
  },
  {
    kind: "carry",
    name: "Carry it",
    instruction: "Read this aloud at your best clean level. Jaw wide - two fingers on the open vowels.",
    because:
      "A seal that holds on one phrase and fails in a paragraph has not changed anything. This is the step that tests the habit rather than the muscle.",
  },
  {
    kind: "result",
    name: "Where it stands",
    instruction: "",
    because: "",
  },
];

/** Everything in this drill happens on the phone - no transcript, no network,
 *  no key. Worth saying on screen, because every other drill needs all three. */
export const OFFLINE_NOTE =
  "Nothing here is transcribed, scored by a model, or sent anywhere. The microphone is used as a meter and the audio is discarded the moment the step ends.";
