// Shared primitives. Everything on screen is built from these so the three
// design rules from PRD §12 hold without being restated on every screen:
// sound is the only source of light, colour is data and chrome is colourless,
// light is clarity and heat is flaw.

import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CHROME, SEMANTIC, SPACE, TABULAR, TYPE } from "../theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.scroll, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** The wordmark uses a V because the Latin alphabet Loquor comes from had no U. */
export function Masthead({ right }: { right?: string }) {
  return (
    <>
      <View style={s.masthead}>
        <Text style={s.wordmark}>LOQVOR</Text>
        {right ? <Text style={s.mastheadRight}>{right}</Text> : null}
      </View>
      <Hair />
    </>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function Display({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[s.display, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}

export function Meta({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.meta, style]}>{children}</Text>;
}

export function Hair({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[s.hair, style]} />;
}

export function Figure({ value, unit, tint }: { value: string; unit?: string; tint?: string }) {
  return (
    <View style={s.figureRow}>
      <Text style={[s.figure, tint ? { color: tint } : null]}>{value}</Text>
      {unit ? <Text style={s.figureUnit}>{unit}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "ghost" | "quiet";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        tone === "primary" && s.btnPrimary,
        tone === "ghost" && s.btnGhost,
        tone === "quiet" && s.btnQuiet,
        pressed && { opacity: 0.72 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Text style={[s.btnLabel, tone === "primary" && s.btnLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

/** Recessed panel. The only container in the app — no cards, no shadows. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.floor },
  scroll: { paddingHorizontal: 22, paddingTop: SPACE.md, paddingBottom: 64, gap: SPACE.md },

  masthead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  wordmark: { color: CHROME.dust, fontSize: 11, letterSpacing: 5, fontFamily: TYPE.uiMedium },
  mastheadRight: {
    color: CHROME.dustDim,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: TYPE.ui,
    ...TABULAR,
  },

  eyebrow: { color: CHROME.dustDim, fontSize: 10, letterSpacing: 2.4, fontFamily: TYPE.uiMedium },
  display: { color: CHROME.chalk, fontSize: 27, lineHeight: 33, fontFamily: TYPE.display },
  body: { color: "#CFC5CE", fontSize: 15, lineHeight: 23, fontFamily: TYPE.ui },
  meta: { color: CHROME.dust, fontSize: 12, lineHeight: 18, fontFamily: TYPE.ui },
  hair: { height: 1, backgroundColor: CHROME.carve },

  figureRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  figure: { color: CHROME.chalk, fontSize: 30, fontFamily: TYPE.display, ...TABULAR },
  figureUnit: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.ui },

  btn: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 2,
    alignItems: "center",
    borderWidth: 1,
  },
  btnPrimary: { backgroundColor: SEMANTIC.ember, borderColor: SEMANTIC.ember },
  btnGhost: { backgroundColor: "transparent", borderColor: CHROME.carve },
  btnQuiet: { backgroundColor: "transparent", borderColor: "transparent", paddingVertical: 10 },
  btnLabel: { color: CHROME.chalk, fontSize: 13, letterSpacing: 1.6, fontFamily: TYPE.uiSemi },
  btnLabelPrimary: { color: CHROME.floor },

  panel: {
    backgroundColor: CHROME.strata,
    borderWidth: 1,
    borderColor: CHROME.carve,
    borderRadius: 2,
    padding: SPACE.md,
    gap: SPACE.sm,
  },
});
