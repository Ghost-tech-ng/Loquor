// Room reminders.
//
// Two notifications per room: one before it starts, carrying the Prep Card, and
// one after it ends, asking for the debrief. The second is the one that matters
// — a debrief recorded the next morning is a summary, and a summary has already
// lost the gap between what you said and what you wish you had said.
//
// LOCAL notifications only. Remote push does not work in Expo Go from SDK 53
// onward, and v1 does not leave Expo Go. That is a constraint, not a shortcut:
// everything the reminder needs is already on the device, so a push server would
// be infrastructure in exchange for nothing.
//
// Every function here fails soft. A denied permission or a scheduling error must
// never stop a room being saved — the room is the user's data, the reminder is a
// convenience, and losing the former to protect the latter would be backwards.

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const PREP_LEAD_MS = 15 * 60 * 1000;
export const DEBRIEF_LAG_MS = 45 * 60 * 1000;

let configured = false;

function configure(): void {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  configured = true;
}

export async function ensurePermission(): Promise<boolean> {
  configure();
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export type Scheduled = { prepId: string | null; debriefId: string | null };

/**
 * Schedule both reminders for a room. Returns whatever was actually scheduled —
 * a room created ten minutes before it starts gets no prep reminder, and that is
 * correct rather than an error.
 */
export async function scheduleRoom(args: {
  roomId: string;
  title: string;
  at: number;
}): Promise<Scheduled> {
  const ok = await ensurePermission();
  if (!ok) return { prepId: null, debriefId: null };

  if (Platform.OS === "android") {
    // Harmless on iOS; required for anything to appear on Android 8+.
    await Notifications.setNotificationChannelAsync("rooms", {
      name: "Room reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }

  const prepId = await at(args.at - PREP_LEAD_MS, {
    title: args.title,
    body: "Starts in 15 minutes. Three questions are on your card.",
    data: { roomId: args.roomId, kind: "prep" },
  });

  const debriefId = await at(args.at + DEBRIEF_LAG_MS, {
    title: `Debrief: ${args.title}`,
    body: "Ninety seconds while it is still fresh. What did you not say?",
    data: { roomId: args.roomId, kind: "debrief" },
  });

  return { prepId, debriefId };
}

async function at(
  when: number,
  content: { title: string; body: string; data: Record<string, unknown> }
): Promise<string | null> {
  // A trigger in the past fires immediately on iOS, which would nag about a
  // meeting that has not happened. Silently skipping is the right behaviour.
  if (when <= Date.now() + 30_000) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: false },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(when),
      },
    });
  } catch {
    return null;
  }
}

/** Ids are stored comma-joined in one column; both are cancelled together. */
export function packIds(s: Scheduled): string | null {
  const ids = [s.prepId, s.debriefId].filter((x): x is string => !!x);
  return ids.length > 0 ? ids.join(",") : null;
}

export async function cancel(packed: string | null): Promise<void> {
  if (!packed) return;
  for (const id of packed.split(",").filter(Boolean)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

// ── The daily rhythm ──────────────────────────────────────────────────────────
//
// Two repeating reminders, and no more than two. A habit app that notifies on
// every streak, every due card and every unfinished thing trains you to swipe
// its notifications away, at which point the one that mattered goes with them.
//
// Neither of these carries a number. "Your streak is 12" makes the streak the
// object and the practice a way of protecting it, which is exactly the failure
// mode PRD §12 rules out — the reminder names the work, and the work is small.
//
// Both are OFF by default. An app that starts notifying before it has been asked
// to has already decided it is more important than the person using it.

const DAILY_SLOT = "loquor.notify.daily";
const WEEKLY_SLOT = "loquor.notify.weekly";

export type Repeating = { hour: number; minute: number; id: string } | null;

export async function getDaily(): Promise<Repeating> {
  return read(DAILY_SLOT);
}

export async function getWeekly(): Promise<Repeating> {
  return read(WEEKLY_SLOT);
}

/**
 * One reminder a day, at a time the user picks. Returns what was actually set —
 * null means permission was refused, and the caller should show that rather than
 * a switch that claims to be on.
 */
export async function setDaily(hour: number, minute: number): Promise<Repeating> {
  await clearDaily();
  if (!(await ensurePermission())) return null;
  await channel();
  const id = await schedule(
    {
      title: "Ninety seconds",
      body: "One topic, out loud. It is over before the reluctance is.",
      data: { kind: "daily" },
    },
    { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }
  );
  if (!id) return null;
  const slot = { hour, minute, id };
  await AsyncStorage.setItem(DAILY_SLOT, JSON.stringify(slot));
  return slot;
}

/** The weekly read. Monday morning, when the week is still shapeable. */
export async function setWeekly(hour: number, minute: number): Promise<Repeating> {
  await clearWeekly();
  if (!(await ensurePermission())) return null;
  await channel();
  const id = await schedule(
    {
      title: "Last week, in figures",
      body: "What moved, what did not, and the one thing to do about it.",
      data: { kind: "weekly" },
    },
    // weekday is 1-indexed from Sunday, so Monday is 2.
    { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour, minute }
  );
  if (!id) return null;
  const slot = { hour, minute, id };
  await AsyncStorage.setItem(WEEKLY_SLOT, JSON.stringify(slot));
  return slot;
}

export async function clearDaily(): Promise<void> {
  await clearSlot(DAILY_SLOT);
}

export async function clearWeekly(): Promise<void> {
  await clearSlot(WEEKLY_SLOT);
}

async function clearSlot(slot: string): Promise<void> {
  const existing = await read(slot);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing.id).catch(() => {});
  }
  await AsyncStorage.removeItem(slot).catch(() => {});
}

async function read(slot: string): Promise<Repeating> {
  try {
    const raw = await AsyncStorage.getItem(slot);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { hour: number; minute: number; id: string };
    return typeof parsed?.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

async function schedule(
  content: { title: string; body: string; data: Record<string, unknown> },
  trigger: Notifications.NotificationTriggerInput
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: false },
      trigger,
    });
  } catch {
    return null;
  }
}

async function channel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("practice", {
    name: "Practice reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

/** `9, 5` → `09:05`. The picker and the settings row read the same. */
export function clockLabel(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
