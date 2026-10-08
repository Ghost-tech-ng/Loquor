// Haptics, named for what happened rather than for the motor pattern, so a
// screen says `feel.win()` and the vocabulary stays consistent app-wide.
// Every call swallows its error: a phone with haptics off is not a crash.

import * as Haptics from "expo-haptics";

const quiet = (p: Promise<void>) => {
  p.catch(() => {});
};

export const feel = {
  tap: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => quiet(Haptics.selectionAsync()),
  thud: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  win: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  fail: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
