// The sky behind the whole app.
//
// Mounted once, at the root, under every screen — screens are transparent and
// float on it. One canvas for the app rather than one per screen, because the
// tab navigator keeps screens mounted and five full-screen shaders animating
// behind each other is a battery bill nobody sees the benefit of.
//
// Four soft blobs of aurora colour drifting on a night ground, plus a whisper of
// grain so the gradients never band. Slow on purpose: it should feel like the
// screen is breathing, not like it is busy.

import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Canvas, Fill, Shader, Skia, useClock } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { AURORA, CHROME, alpha } from "../../theme";

const SKSL = `
uniform float t;
uniform float2 res;
uniform float energy;

float blob(float2 p, float2 c, float r) {
  float2 d = (p - c) / r;
  return exp(-dot(d, d));
}

half4 main(float2 xy) {
  float2 p = xy / res.x;
  float h = res.y / res.x;
  float s = t * 0.00011;
  float3 col = float3(0.043, 0.039, 0.102);
  float3 violet = float3(0.486, 0.361, 1.0);
  float3 teal = float3(0.180, 0.902, 0.773);
  float3 pink = float3(1.0, 0.373, 0.635);
  float3 coral = float3(1.0, 0.478, 0.420);
  float e = 1.0 + energy;
  col += violet * 0.46 * e * blob(p, float2(0.12 + 0.16 * sin(s * 1.3), 0.06 * h + 0.07 * cos(s * 1.1)), 0.62);
  col += teal * 0.20 * e * blob(p, float2(1.0 + 0.10 * cos(s * 0.9), 0.38 * h + 0.10 * sin(s * 1.4)), 0.48);
  col += pink * 0.17 * e * blob(p, float2(0.18 + 0.18 * sin(s * 0.7 + 2.0), 0.78 * h + 0.08 * cos(s * 1.2)), 0.55);
  col += coral * 0.10 * e * blob(p, float2(0.90 + 0.10 * sin(s), 1.02 * h), 0.45);
  float n = fract(sin(dot(xy, float2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.018;
  return half4(half3(col), 1.0);
}`;

const EFFECT = (() => {
  try {
    return Skia.RuntimeEffect.Make(SKSL);
  } catch {
    return null;
  }
})();

export function AuroraBackground() {
  const { width, height } = useWindowDimensions();
  if (!EFFECT) return <StaticAurora />;
  return <LiveAurora width={width} height={height} />;
}

function LiveAurora({ width, height }: { width: number; height: number }) {
  const clock = useClock();
  const res = useMemo(() => [width, height], [width, height]);
  const uniforms = useDerivedValue(() => ({ t: clock.value, res, energy: 0 }), [res]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill>
        <Shader source={EFFECT!} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

/** Same sky, frozen. Used only if the runtime effect fails to compile. */
function StaticAurora() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: CHROME.floor }]} pointerEvents="none">
      <LinearGradient
        colors={[alpha(AURORA.violet, 0.4), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", alpha(AURORA.pink, 0.16)]}
        start={{ x: 0.6, y: 0.4 }}
        end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
