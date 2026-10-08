// Glass: the card every screen is made of.
//
// A blur of the aurora behind it, a faint fill so text stays legible where the
// aurora is bright, a hairline edge, and a sheen along the top edge that reads
// as light catching the rim. `glow` tints the edge for the one card on a screen
// that wants your attention.

import type { ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { RADIUS, SURFACE, alpha } from "../../theme";

type BoxStyle = ViewProps["style"];

export function Glass({
  children,
  style,
  glow,
  radius = RADIUS.panel,
  intensity = 28,
  padded = true,
}: {
  children?: ReactNode;
  style?: BoxStyle;
  /** A hex colour to tint the rim and cast a soft halo. */
  glow?: string;
  radius?: number;
  intensity?: number;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        s.shell,
        { borderRadius: radius },
        glow ? { shadowColor: glow, shadowOpacity: 0.45, shadowRadius: 22 } : null,
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, s.clip, { borderRadius: radius }]} pointerEvents="none">
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: SURFACE.sunk }]} />
        <LinearGradient
          colors={[glow ? alpha(glow, 0.16) : "rgba(255,255,255,0.07)", "rgba(255,255,255,0)"]}
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
  shell: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0, shadowRadius: 0 },
  clip: { overflow: "hidden" },
  pad: { padding: 18 },
});
