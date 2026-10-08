// A soft glow drawn once as a radial gradient.
//
// The replacement for iOS shadows on anything translucent or animated. A layer
// shadow on a view with no opaque background has no path to reuse, so Core
// Animation re-renders it offscreen on every frame something inside or behind
// it moves — with the aurora always moving, that was every frame, everywhere.
// This is rasterised once; scaling or fading it afterwards is free.

import { useId } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

type BoxStyle = ViewProps["style"];

export function Halo({
  color,
  opacity = 0.6,
  spread = 18,
  style,
}: {
  color: string;
  /** Strength at the centre. */
  opacity?: number;
  /** How far past the parent's edges the glow reaches. */
  spread?: number;
  style?: BoxStyle;
}) {
  const id = `halo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", top: -spread, bottom: -spread, left: -spread, right: -spread }, style]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
