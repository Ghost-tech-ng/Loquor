// The sky behind the whole app.
//
// Mounted once, at the root, under every screen — screens are transparent and
// float on it. One canvas for the app rather than one per screen, because the
// tab navigator keeps screens mounted and five full-screen shaders animating
// behind each other is a battery bill nobody sees the benefit of.
//
// Four soft pools of light drifting on a navy ground: a cold stage-blue wash,
// a brass lamp, and faint sage and terracotta underneath. Slow on purpose: it
// should feel like the screen is breathing, not like it is busy.
//
// Rendered at a quarter of the screen's size and scaled up. The blobs are pure
// low-frequency colour, so the upscale is invisible, and the shader runs on a
// sixteenth of the pixels — at full size it was eating the frame budget every
// other animation needed.

import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Canvas, Fill, Shader, Skia, useClock } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { AURORA, CHROME, alpha } from "../../theme";

const STAGE_BLUE = "#2E4A78";

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
  float3 col = float3(0.043, 0.059, 0.090);
  float3 stage = float3(0.180, 0.290, 0.470);
  float3 brass = float3(0.851, 0.659, 0.357);
  float3 sage = float3(0.435, 0.718, 0.643);
  float3 terracotta = float3(0.878, 0.478, 0.373);
  float e = 1.0 + energy;
  col += stage * 0.34 * e * blob(p, float2(0.12 + 0.16 * sin(s * 1.3), 0.06 * h + 0.07 * cos(s * 1.1)), 0.62);
  col += brass * 0.15 * e * blob(p, float2(1.0 + 0.10 * cos(s * 0.9), 0.30 * h + 0.10 * sin(s * 1.4)), 0.50);
  col += sage * 0.07 * e * blob(p, float2(0.18 + 0.18 * sin(s * 0.7 + 2.0), 0.80 * h + 0.08 * cos(s * 1.2)), 0.55);
  col += terracotta * 0.07 * e * blob(p, float2(0.90 + 0.10 * sin(s), 1.02 * h), 0.45);
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

const SCALE = 4;

function LiveAurora({ width, height }: { width: number; height: number }) {
  const clock = useClock();
  const w = Math.ceil(width / SCALE);
  const h = Math.ceil(height / SCALE);
  const res = useMemo(() => [w, h], [w, h]);
  const uniforms = useDerivedValue(() => ({ t: clock.value, res, energy: 0 }), [res]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: CHROME.floor }]} pointerEvents="none">
      <Canvas
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          transformOrigin: "top left",
          transform: [{ scale: SCALE }],
        }}
      >
        <Fill>
          <Shader source={EFFECT!} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

/** Same sky, frozen. Used only if the runtime effect fails to compile. */
function StaticAurora() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: CHROME.floor }]} pointerEvents="none">
      <LinearGradient
        colors={[alpha(STAGE_BLUE, 0.4), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", alpha(AURORA.brass, 0.12)]}
        start={{ x: 0.6, y: 0.4 }}
        end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
