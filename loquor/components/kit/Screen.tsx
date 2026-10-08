import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AURORA, CHROME, RADIUS, SPACE, SURFACE, TABULAR, TAB_CLEARANCE, TYPE } from "../../theme";
import { Glyph } from "./Glyph";

/** Transparent: the aurora is painted once at the root and shows through. */
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

/**
 * `setup` puts the way to Settings in the masthead. The tab screens pass it:
 * the screen holding the key the app cannot run without has to be one tap from
 * anywhere you land. Drill screens leave it off — mid-take is not the moment.
 */
export function Masthead({
  right,
  setup = false,
  close = false,
  onClose,
}: {
  right?: string;
  setup?: boolean;
  /** For a screen opened over the tabs: a way back that does not need a scroll. */
  close?: boolean;
  /** Runs before the dismiss, e.g. to release the mic mid-take. */
  onClose?: () => void;
}) {
  const router = useRouter();
  const dismiss = () => {
    onClose?.();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <View style={s.masthead}>
      <View style={s.brand}>
        <View style={s.brandDot} />
        <Text style={s.wordmark}>Speek</Text>
      </View>
      <View style={s.mastheadEnd}>
        {right ? (
          <Text style={s.mastheadRight} numberOfLines={1}>
            {right}
          </Text>
        ) : null}
        {setup ? (
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={12}
            style={s.chip}
            accessibilityRole="link"
            accessibilityLabel="Settings"
          >
            <Text style={s.chipLabel}>Setup</Text>
          </Pressable>
        ) : null}
        {close ? (
          <Pressable
            onPress={dismiss}
            hitSlop={12}
            style={s.chip}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Glyph name="x" size={14} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: SPACE.sm,
    paddingBottom: TAB_CLEARANCE,
    gap: SPACE.md,
  },
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 36,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AURORA.emerald,
    shadowColor: AURORA.emerald,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  wordmark: { color: CHROME.chalk, fontSize: 21, fontFamily: TYPE.display, letterSpacing: -0.4 },
  mastheadEnd: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexShrink: 1 },
  mastheadRight: {
    color: CHROME.dust,
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: TYPE.uiSemi,
    flexShrink: 1,
    ...TABULAR,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  chipLabel: { color: CHROME.chalk, fontSize: 12, fontFamily: TYPE.uiSemi },
});
