// "My English": which soft fillers count for you.
//
// Shared by Settings and onboarding. Picking a variety switches its whole list
// on; each word can then be switched off on its own, because "o" at the end of
// a sentence is a habit for one speaker and plain grammar for the next.

import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../../components/kit/motion";
import { AURORA, CHROME, RADIUS, SURFACE, TYPE, alpha } from "../../theme";
import { ENGLISH_LABEL, SOFT_FILLERS, type English } from "../../lib/lexicon";

const VARIETIES: English[] = ["general", "nigerian", "indian"];

export function MyEnglish({
  english,
  off,
  onChange,
}: {
  english: English;
  off: readonly string[];
  onChange: (patch: { english: English; softOff: string[] }) => void;
}) {
  const words = SOFT_FILLERS[english];

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {VARIETIES.map((v) => {
          const on = v === english;
          return (
            <PressableScale
              key={v}
              onPress={() => {
                onChange({ english: v, softOff: [] });
              }}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{ENGLISH_LABEL[v]}</Text>
            </PressableScale>
          );
        })}
      </View>

      {words.length > 0 ? (
        <>
          <Text style={s.note}>These count as fillers for you. Tap one to stop counting it.</Text>
          <View style={s.row}>
            {words.map((w) => {
              const counted = !off.includes(w);
              return (
                <PressableScale
                  key={w}
                  onPress={() => {
                    onChange({
                      english,
                      softOff: counted ? [...off, w] : off.filter((x) => x !== w),
                    });
                  }}
                  style={[s.word, counted && s.wordOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: counted }}
                  accessibilityLabel={`Count "${w}" as a filler`}
                >
                  <Text style={[s.wordText, !counted && s.wordTextOff]}>{w}</Text>
                </PressableScale>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={s.note}>Only the universal fillers count: um, uh, er and the like.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  chipOn: { backgroundColor: alpha(AURORA.emerald, 0.14), borderColor: alpha(AURORA.emerald, 0.6) },
  chipText: { color: CHROME.dust, fontSize: 14, fontFamily: TYPE.uiMedium },
  chipTextOn: { color: CHROME.chalk },
  note: { color: CHROME.dustDim, fontSize: 12.5, lineHeight: 18, fontFamily: TYPE.ui },
  word: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  wordOn: { backgroundColor: alpha(AURORA.coral, 0.12), borderColor: alpha(AURORA.coral, 0.5) },
  wordText: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.displayItalic },
  wordTextOff: { color: CHROME.dustDim, textDecorationLine: "line-through" },
});
