// What to do now.
//
// The old Today screen listed nine things and ranked none of them, which is
// only legible to someone who already knows what the app is for. A first-time
// user needs exactly one instruction, and an experienced one still benefits
// from the app naming the thing that has gone stale.
//
// So this is a ladder, not a menu: the first rule that fires wins, and Today
// renders that single answer above everything else. The order encodes the
// product's actual priorities rather than the order the features were built —
// setup before measurement, measurement before practice, and the debrief window
// above all of it because it is the only item here that expires.
//
// Pure by design. No React, no db, no clock beyond what is passed in, so the
// ladder can be tested exhaustively instead of by tapping through an app.

export type State = {
  /** Any key at all for the resolved STT provider. Nothing works without one. */
  hasKey: boolean;
  hasBaseline: boolean;
  /** Debriefs for rooms that have happened but were never spoken about. */
  dueDebriefs: number;
  /** Arena takes recorded today. */
  takesToday: number;
  /** Lexicon cards due for review right now. */
  lexDue: number;
  /** Sections left in the reading currently in progress. */
  sectionsLeft: number;
  /** Rooms that were debriefed, ever. The retention pillar. */
  roomsLogged: number;
  /** Rooms on the books that have not happened yet. */
  roomsUpcoming: number;
  /** Arena sessions recorded, ever. */
  sessionsEver: number;
};

export type Action = {
  id: string;
  /** Small label above the instruction. */
  eyebrow: string;
  /** The instruction. Written as something to do, not a feature name. */
  title: string;
  /** One sentence on why it is worth doing. */
  why: string;
  cta: string;
  route: string;
  /** Marks the card ember and moves it above the fold. Reserved for things
   *  that are either blocking or expiring — never for a nudge. */
  urgent: boolean;
};

export function nextAction(st: State): Action {
  // Nothing in the app functions without a key: every drill ends in a
  // transcription call. Any other instruction would lead straight to an error.
  if (!st.hasKey) {
    return {
      id: "key",
      eyebrow: "ONE THING FIRST",
      title: "Add your Groq API key",
      why: "Every drill ends in a transcription, so nothing here works until a key is in. It is free, and it stays on this phone.",
      cta: "OPEN SETUP",
      route: "/settings",
      urgent: true,
    };
  }

  // The baseline is measured once and everything on Progress is measured
  // against it, so a fortnight of practice taken first would be measuring the
  // practice rather than the starting point.
  if (!st.hasBaseline) {
    return {
      id: "baseline",
      eyebrow: "BEFORE ANYTHING ELSE",
      title: "Record your baseline",
      why: "Ninety seconds, once, before the app coaches you. Nothing can show improvement without it.",
      cta: "RECORD IT",
      route: "/onboarding",
      urgent: true,
    };
  }

  // The only expiring item on the ladder. What you nearly said in a meeting is
  // recoverable for about an hour and gone by the next morning.
  if (st.dueDebriefs > 0) {
    const n = st.dueDebriefs;
    return {
      id: "debrief",
      eyebrow: "WHILE YOU STILL REMEMBER",
      title: n === 1 ? "Debrief the meeting you just had" : `Debrief ${n} meetings`,
      why: "Ninety seconds out loud on what you actually said. Leave it until tomorrow and you will describe the version you wish had happened.",
      cta: "DEBRIEF",
      route: "/rooms",
      urgent: true,
    };
  }

  // A first take is the whole product in three minutes, and it is a better
  // introduction than any amount of explaining.
  if (st.sessionsEver === 0) {
    return {
      id: "first",
      eyebrow: "START HERE",
      title: "Speak for ninety seconds",
      why: "A prompt, a minute to think, then you talk. You get back your filler rate, pace and pauses, and one thing to say better.",
      cta: "ENTER THE ARENA",
      route: "/arena",
      urgent: false,
    };
  }

  if (st.takesToday === 0) {
    return {
      id: "today",
      eyebrow: "TODAY",
      title: "Take today's prompt",
      why: "Sixty seconds of primer, ninety of talking. That is the whole thing.",
      cta: "ENTER THE ARENA",
      route: "/arena",
      urgent: false,
    };
  }

  // Rooms is the retention pillar: it is the only feature that ties the app to
  // a real consequence. Three sessions in with nothing on the books is the
  // moment to say so, and it outranks a second take of the day.
  if (st.roomsLogged === 0 && st.roomsUpcoming === 0 && st.sessionsEver >= 3) {
    return {
      id: "room",
      eyebrow: "THE POINT OF ALL THIS",
      title: "Prep a real meeting",
      why: "Practice alone does not transfer. Put one meeting from this week in, and walk in with three questions ready.",
      cta: "ADD A ROOM",
      route: "/rooms",
      urgent: false,
    };
  }

  if (st.lexDue > 0) {
    return {
      id: "lexicon",
      eyebrow: "DUE NOW",
      title: `${st.lexDue} ${st.lexDue === 1 ? "word" : "words"} to review`,
      why: "A few minutes. Words you have met before, back at the moment you were about to lose them.",
      cta: "REVIEW",
      route: "/lexicon",
      urgent: false,
    };
  }

  if (st.sectionsLeft > 0) {
    return {
      id: "reading",
      eyebrow: "PICK IT BACK UP",
      title: "Read the next section aloud",
      why: `${st.sectionsLeft} ${st.sectionsLeft === 1 ? "section" : "sections"} left in the piece you started. Under two minutes each.`,
      cta: "READ ALOUD",
      route: "/practice",
      urgent: false,
    };
  }

  // Everything on the ladder is clear. Offer the drill with no daily quota
  // attached rather than inventing an obligation.
  return {
    id: "playbook",
    eyebrow: "NOTHING OUTSTANDING",
    title: "Drill a question you are weak at",
    why: "One meeting snippet, one named move, one question out loud — and what the room would most likely say back.",
    cta: "OPEN THE PLAYBOOK",
    route: "/playbook",
    urgent: false,
  };
}
