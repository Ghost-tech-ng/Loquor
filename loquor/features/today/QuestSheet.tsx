// Today's three quests, in a sheet that rises from the bottom.
//
// On Home they are a single row ("1 of 3 quests"), because three cards above
// the fold competed with the one button that matters. The sheet holds the
// detail for the person who wants it.

import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glyph } from "../../components/kit/Glyph";
import { XPBar } from "../../components/kit/Meters";
import { PressableScale } from "../../components/kit/motion";
import { AURORA, CHROME, GRADIENT, RADIUS, SEMANTIC, SURFACE, TABULAR, TYPE, alpha } from "../../theme";
import type { Progress } from "../progression/progressionStore";

type QuestRow = Progress["quests"][number];

export function QuestSheet({
  quests,
  visible,
  onClose,
  onOpen,
}: {
  quests: QuestRow[];
  visible: boolean;
  onClose: () => void;
  onOpen: (route: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const done = quests.filter((q) => q.done).length;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close quests" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grip} />
        <View style={s.head}>
          <Text style={s.title}>Today's quests</Text>
          <Text style={s.count}>
            {done} of {quests.length}
          </Text>
        </View>
        <Text style={s.sub}>New ones at midnight.</Text>

        {quests.map((q, i) => (
          <PressableScale
            key={q.quest.id}
            onPress={() => onOpen(q.quest.route)}
            scaleTo={0.97}
            style={[s.quest, q.done && s.questDone]}
            accessibilityLabel={`${q.quest.title}${q.done ? ", done" : ""}`}
          >
            <View style={[s.tick, q.done && s.tickDone]}>
              {q.done ? (
                <Glyph name="check" size={15} strokeWidth={2.8} color={CHROME.floor} />
              ) : (
                <Text style={s.tickMark}>{i + 1}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[s.questTitle, q.done && s.questTitleDone]} numberOfLines={2}>
                {q.quest.title}
              </Text>
              {q.quest.goal > 1 && !q.done ? (
                <View style={s.track}>
                  <XPBar progress={q.value / q.quest.goal} height={6} colors={GRADIENT.cool} style={{ flex: 1 }} />
                  <Text style={s.trackCount}>
                    {q.value}/{q.quest.goal}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.xp, q.done && { color: SEMANTIC.solid }]}>+{q.quest.xp}</Text>
          </PressableScale>
        ))}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: CHROME.floor,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: SURFACE.edge,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  grip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(CHROME.chalk, 0.2),
    marginBottom: 6,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { color: CHROME.chalk, fontSize: 22, fontFamily: TYPE.displaySoft },
  count: { color: CHROME.dust, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
  sub: { color: CHROME.dustDim, fontSize: 12.5, fontFamily: TYPE.ui, marginTop: -6 },

  quest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.soft + 4,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  questDone: { backgroundColor: alpha(AURORA.mint, 0.08), borderColor: alpha(AURORA.mint, 0.3) },
  tick: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: alpha(AURORA.emerald, 0.7),
  },
  tickDone: { backgroundColor: AURORA.mint, borderColor: AURORA.mint },
  tickMark: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.uiBold },
  questTitle: { color: CHROME.chalk, fontSize: 15, lineHeight: 20, fontFamily: TYPE.uiMedium },
  questTitleDone: { color: CHROME.dust, textDecorationLine: "line-through" },
  track: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackCount: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  xp: { color: SEMANTIC.xp, fontSize: 13, fontFamily: TYPE.monoMedium, ...TABULAR },
});
