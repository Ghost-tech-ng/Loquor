// The type ramp. Fraunces for anything you read as a sentence someone said,
// Outfit for the labels around it, Space Mono for anything that counts.

import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { CHROME, TABULAR, TYPE } from "../../theme";

type BoxStyle = ViewProps["style"];

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

/** A divider that fades out at both ends, so it reads as light rather than a rule. */
export function Hair({ style }: { style?: BoxStyle }) {
  return (
    <View style={[s.hair, style]}>
      <LinearGradient
        colors={["rgba(242,238,230,0)", "rgba(242,238,230,0.16)", "rgba(242,238,230,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function Figure({ value, unit, tint }: { value: string; unit?: string; tint?: string }) {
  return (
    <View style={s.figureRow}>
      <Text style={[s.figure, tint ? { color: tint } : null]}>{value}</Text>
      {unit ? <Text style={s.figureUnit}>{unit}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow: { color: CHROME.dust, fontSize: 11, letterSpacing: 1.6, fontFamily: TYPE.uiBold },
  display: { color: CHROME.chalk, fontSize: 30, lineHeight: 36, fontFamily: TYPE.display, letterSpacing: -0.6 },
  body: { color: "#E4DFD4", fontSize: 16, lineHeight: 25, fontFamily: TYPE.ui },
  meta: { color: CHROME.dust, fontSize: 13.5, lineHeight: 20, fontFamily: TYPE.ui },
  hair: { height: 1 },

  figureRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  figure: { color: CHROME.chalk, fontSize: 32, fontFamily: TYPE.monoMedium, letterSpacing: -1, ...TABULAR },
  figureUnit: { color: CHROME.dust, fontSize: 11, fontFamily: TYPE.uiMedium },
});
