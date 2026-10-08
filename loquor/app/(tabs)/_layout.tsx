// The tab bar.
//
// Home is what you open the app to do. The Arena is the measurement everything
// else exists to move. Play is the games and the training drills. Rooms is
// where it meets real people. You is the record: level, badges, the trends.
//
// It floats, frosted, over the aurora. A gradient blob slides between tabs on a
// spring — one moving thing rather than five that fade, because a shared
// element travelling is what tells you the tabs are one control. Content clears
// it via TAB_CLEARANCE because the bar is absolutely positioned.

import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { BottomTabBarProps } from "expo-router/tabs";

import { feel } from "../../components/kit/feel";
import { TabIcon, type IconName } from "../../components/kit/icons";
import { AURORA, CHROME, GRADIENT, RADIUS, SPRING, TYPE, alpha } from "../../theme";

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "index", label: "Home", icon: "home" },
  // Not "arena": that path is the take itself, a stack screen above the tabs.
  { name: "stage", label: "Arena", icon: "arena" },
  { name: "play", label: "Play", icon: "play" },
  { name: "rooms", label: "Rooms", icon: "rooms" },
  { name: "you", label: "You", icon: "you" },
];

const BAR_H = 66;
const INSET = 6;

function Item({
  label,
  icon,
  focused,
  onPress,
  onLongPress,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withSpring(focused ? 1 : 0, SPRING.bouncy);
  }, [focused, on]);

  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -on.value * 2 }, { scale: 1 + on.value * 0.12 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={s.item}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={lift}>
        <TabIcon name={icon} active={focused} />
      </Animated.View>
      <Text style={[s.label, focused && s.labelOn]}>{label}</Text>
    </Pressable>
  );
}

function Bar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const cell = width / Math.max(1, state.routes.length);
  const x = useSharedValue(0);

  useEffect(() => {
    if (cell > 0) x.value = withSpring(state.index * cell, SPRING.snappy);
  }, [state.index, cell, x]);

  const blob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[s.dock, { paddingBottom: Math.max(insets.bottom - 6, 10) }]} pointerEvents="box-none">
      <View style={s.shadow}>
        <View style={s.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(CHROME.raised, 0.55) }]} />

          {cell > 0 ? (
            <Animated.View style={[s.blobCell, { width: cell }, blob]} pointerEvents="none">
              <LinearGradient
                colors={[alpha(GRADIENT.primary[0], 0.55), alpha(GRADIENT.primary[1], 0.38)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.blob}
              />
            </Animated.View>
          ) : null}

          {state.routes.map((route, i) => {
            const meta = TABS.find((t) => t.name === route.name);
            if (!meta) return null;
            const focused = state.index === i;
            return (
              <Item
                key={route.key}
                label={meta.label}
                icon={meta.icon}
                focused={focused}
                onPress={() => {
                  const event = emitter.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    feel.select();
                    navigateToTab(route.key);
                  }
                }}
                onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <Bar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        animation: "shift",
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
  },
  shadow: {
    borderRadius: RADIUS.bar,
    shadowColor: AURORA.violet,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  bar: {
    flexDirection: "row",
    height: BAR_H,
    borderRadius: RADIUS.bar,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  blobCell: { position: "absolute", top: 0, bottom: 0, left: 0, padding: INSET },
  blob: { flex: 1, borderRadius: RADIUS.bar - INSET },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { color: "rgba(244,241,255,0.55)", fontSize: 11, fontFamily: TYPE.uiSemi },
  labelOn: { color: "#FFFFFF" },
});
