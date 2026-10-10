// What the three Memory Gym screens share: the level picker, the history
// loader, and a timer bag that dies with the screen.

import { useCallback, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../../../components/kit/motion";
import { Glyph } from "../../../components/kit/Glyph";
import { feel } from "../../../components/kit/feel";
import { CHROME, RADIUS, SPACE, TABULAR, TYPE, alpha } from "../../../theme";
import { memoryRuns } from "../../../lib/db";
import { dayOf } from "../../progress/progress";
import { memorySummary, type MemorySummary } from "../memory";

export async function memorySnapshot(): Promise<MemorySummary | null> {
  try {
    const runs = await memoryRuns();
    return memorySummary(
      runs.map((r) => ({ game: r.game, day: dayOf(r.at), score: r.score })),
      dayOf(Date.now())
    );
  } catch {
    return null;
  }
}

/** setTimeout that is cleared on unmount, so a closed game never fires into a dead screen. */
export function useTimers() {
  const ids = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = useCallback(() => {
    for (const id of ids.current) clearTimeout(id);
    ids.current = [];
  }, []);
  const after = useCallback((ms: number, fn: () => void) => {
    ids.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => clear, [clear]);
  return { after, clear };
}

export function LevelPicker({
  max,
  unlocked,
  value,
  onChange,
  tint,
  describe,
}: {
  max: number;
  unlocked: number;
  value: number;
  onChange: (level: number) => void;
  tint: string;
  /** One line on what the chosen level asks of you. */
  describe: (level: number) => string;
}) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.label}>Level</Text>
        <Text style={[s.desc, { color: tint }]}>{describe(value)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {Array.from({ length: max }, (_, i) => i + 1).map((l) => {
          const open = l <= unlocked;
          const on = l === value;
          return (
            <PressableScale
              key={l}
              disabled={!open}
              haptic={false}
              onPress={() => {
                feel.select();
                onChange(l);
              }}
              accessibilityLabel={open ? `Level ${l}` : `Level ${l}, locked`}
              accessibilityState={{ selected: on, disabled: !open }}
            >
              <View
                style={[
                  s.chip,
                  on && { borderColor: tint, backgroundColor: alpha(tint, 0.22) },
                  !open && s.locked,
                ]}
              >
                {open ? (
                  <Text style={[s.chipText, on && { color: tint }]}>{l}</Text>
                ) : (
                  <Glyph name="lock" size={14} color={CHROME.dustDim} />
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
      <Text style={s.hint}>Clear a level to unlock the next one.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  label: { color: CHROME.dust, fontSize: 11.5, fontFamily: TYPE.uiBold },
  desc: { flexShrink: 1, fontSize: 13, fontFamily: TYPE.uiSemi, textAlign: "right" },
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.soft,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  locked: { opacity: 0.55, backgroundColor: "transparent" },
  chipText: { color: CHROME.chalk, fontSize: 16, fontFamily: TYPE.monoMedium, ...TABULAR },
  hint: { color: CHROME.dustDim, fontSize: 12, fontFamily: TYPE.uiMedium },
});
