// Glass: the card every screen is made of.
//
// A tinted night fill so text stays legible where the aurora is bright, a
// hairline edge, and a sheen along the top edge that reads as light catching
// the rim. `glow` tints the rim and sheen for the one card on a screen that
// wants your attention.
//
// No live blur and no layer shadow. Both get recomputed every frame when the
// thing behind them moves, and the aurora never stops moving — with a dozen
// cards on screen that was the stutter. The fill is opaque enough that a blur
// would barely show through it anyway.

import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { RADIUS, SURFACE, alpha } from "../../theme";

type BoxStyle = ViewProps["style"];

export function Glass({
  children,
  style,
  glow,
  radius = RADIUS.panel,
  padded = true,
}: {
  children?: ReactNode;
  style?: BoxStyle;
  /** A hex colour to tint the rim and sheen. */
  glow?: string;
  radius?: number;
  padded?: boolean;
}) {
  return (
    <View style={[{ borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, s.clip, { borderRadius: radius }]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, s.fill]} />
        <LinearGradient
          colors={[glow ? alpha(glow, 0.16) : "rgba(242,238,230,0.06)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: glow ? alpha(glow, 0.5) : SURFACE.edge,
          },
        ]}
      />
      <View style={padded ? s.pad : null}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  clip: { overflow: "hidden" },
  fill: { backgroundColor: "rgba(20, 26, 38, 0.74)" },
  pad: { padding: 18 },
});
