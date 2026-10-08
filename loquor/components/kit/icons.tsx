// Tab icons. Drawn rather than borrowed from an icon font, so the stroke weight
// matches Outfit and the active state can fill with the brand gradient.

import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { AURORA } from "../../theme";

export type IconName = "home" | "arena" | "play" | "rooms" | "you";

function Shape({ name, stroke, fill }: { name: IconName; stroke: string; fill: string }) {
  const common = { stroke, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <>
          <Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" fill={fill} {...common} />
          <Path d="M9.5 20.5v-5.5h5v5.5" fill="none" {...common} />
        </>
      );
    case "arena":
      return (
        <>
          <Rect x="8.5" y="2.8" width="7" height="12" rx="3.5" fill={fill} {...common} />
          <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.2M8.8 21.2h6.4" fill="none" {...common} />
        </>
      );
    case "play":
      return (
        <>
          <Path
            d="M7.5 7h9a5 5 0 0 1 4.9 6l-.7 3.6a2.4 2.4 0 0 1-4.2 1.1L14.6 16H9.4l-1.9 1.7a2.4 2.4 0 0 1-4.2-1.1L2.6 13a5 5 0 0 1 4.9-6Z"
            fill={fill}
            {...common}
          />
          <Path d="M7.5 10v3.2M5.9 11.6h3.2" fill="none" {...common} />
          <Circle cx="16" cy="10.6" r="0.9" fill={stroke} />
          <Circle cx="17.6" cy="12.6" r="0.9" fill={stroke} />
        </>
      );
    case "rooms":
      return (
        <>
          <Path d="M6 20.5V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 5v15.5" fill={fill} {...common} />
          <Path d="M3.5 20.5h17" fill="none" {...common} />
          <Circle cx="14.6" cy="12.5" r="0.9" fill={stroke} />
        </>
      );
    case "you":
      return (
        <>
          <Circle cx="12" cy="8.2" r="4" fill={fill} {...common} />
          <Path d="M4.5 20.5c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6" fill="none" {...common} />
        </>
      );
  }
}

export function TabIcon({ name, active, size = 26 }: { name: IconName; active: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={`tab-${name}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={AURORA.violet} />
          <Stop offset="1" stopColor={AURORA.pink} />
        </LinearGradient>
      </Defs>
      <Shape
        name={name}
        stroke={active ? "#FFFFFF" : "rgba(244,241,255,0.55)"}
        fill={active ? `url(#tab-${name})` : "none"}
      />
    </Svg>
  );
}
