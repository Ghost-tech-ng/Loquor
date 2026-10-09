// Whether Pip may be on screen right now.
//
// Pip leaves for anything that needs your full attention: a take, a live meter,
// a timed game. Those screens do not know about the pet host and should not, so
// they only say "I'm busy" through usePetAway, and the host listens here.
//
// A counter, not a flag: two recorders can overlap for a frame during a screen
// transition, and the first one to stop must not bring Pip back early.

import { useEffect } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();
let away = 0;
let enabled = true;

function emit(): void {
  for (const fn of listeners) fn();
}

/** Sends Pip away until the returned release is called. Release is idempotent. */
export function hidePet(): () => void {
  away += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    away -= 1;
    emit();
  };
}

export function isPetAway(): boolean {
  return away > 0;
}

/** Settings → "Show Pip". */
export function setPetEnabled(on: boolean): void {
  if (enabled === on) return;
  enabled = on;
  emit();
}

export function isPetEnabled(): boolean {
  return enabled;
}

export function onPetPresence(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Keeps Pip away for as long as `active` is true, and while the caller is mounted. */
export function usePetAway(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return hidePet();
  }, [active]);
}
