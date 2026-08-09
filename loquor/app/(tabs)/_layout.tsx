// The tab bar.
//
// Five destinations, and Settings is one of them. It used to be a 10px link in
// the footer of a screen you had to scroll to the bottom of, which is not a
// place to put the screen holding the API key the entire app refuses to work
// without.
//
// The grouping is by *when you use it*, not by feature: Today is the thing you
// open the app to do, Practice is the drawer of drills, Rooms is the part that
// touches other people, Progress looks backwards, Settings is setup. A user who
// has never seen the app should be able to guess what is behind each one.
//
// It floats. A bar welded to the bottom edge reads as part of the phone; a bar
// with air under it reads as part of the app, and the gap lets content scroll
// visibly beneath it so you can tell there is more below. Content clears it via
// TAB_CLEARANCE rather than by the navigator insetting the scene, because the
// bar is absolutely positioned.

import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import {
  GlyphProgress,
  GlyphPractice,
  GlyphRooms,
  GlyphSettings,
  GlyphToday,
} from "../../components/glyphs";
import { CHROME, MOTION, SEMANTIC, TYPE } from "../../theme";

type Glyph = (p: { tint: string }) => React.ReactElement;

const TABS: { name: string; label: string; Glyph: Glyph }[] = [
  { name: "index", label: "Today", Glyph: GlyphToday },
  { name: "practice", label: "Practice", Glyph: GlyphPractice },
  { name: "rooms", label: "Rooms", Glyph: GlyphRooms },
  { name: "progress", label: "Progress", Glyph: GlyphProgress },
  { name: "settings", label: "Setup", Glyph: GlyphSettings },
];

/** One tab. Owns its own selection animation so the bar has no shared state to
 *  keep in sync — the glyph lifts and brightens, the label follows. */
function Item({
  label,
  Glyph,
  focused,
  onPress,
  onLongPress,
}: {
  label: string;
  Glyph: Glyph;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const on = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(on, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, on]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={s.item}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: on.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
            { scale: on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          ],
        }}
      >
        <Glyph tint={focused ? CHROME.chalk : CHROME.dustDim} />
      </Animated.View>
      <Animated.Text style={[s.label, focused && s.labelOn, { opacity: on.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

function Bar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const count = state.routes.length;

  // The marker is one view that slides, not five that fade. A shared element
  // moving between positions is what tells you the tabs are one control.
  const x = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    Animated.timing(x, {
      toValue: state.index,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [state.index, x]);

  return (
    <View
      style={[s.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}
      pointerEvents="box-none"
    >
      <View style={s.bar}>
        <Animated.View
          style={[
            s.marker,
            {
              width: `${100 / count}%`,
              left: x.interpolate({
                inputRange: [0, count - 1],
                outputRange: ["0%", `${(100 * (count - 1)) / count}%`],
              }),
            },
          ]}
        >
          <View style={s.markerTick} />
        </Animated.View>

        {state.routes.map((route, i) => {
          const meta = TABS.find((t) => t.name === route.name);
          if (!meta) return null;
          const focused = state.index === i;
          return (
            <Item
              key={route.key}
              label={meta.label}
              Glyph={meta.Glyph}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            />
          );
        })}
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
        sceneStyle: { backgroundColor: CHROME.floor },
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
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    height: 62,
    borderRadius: 16,
    backgroundColor: CHROME.raised,
    borderWidth: 1,
    borderColor: CHROME.carve,
    overflow: "hidden",
    // The one shadow in the app, and it is here to say "this floats", not to
    // decorate. Everything else on screen is flat by rule.
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      default: { elevation: 12 },
    }),
  },

  marker: { position: "absolute", top: 0, bottom: 0, alignItems: "center" },
  // A 2px ember tick along the top edge of the active cell. Colour is data
  // everywhere else, so navigation gets the smallest possible mark that still
  // answers "where am I".
  markerTick: { width: 26, height: 2, borderRadius: 1, backgroundColor: SEMANTIC.ember },

  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 4 },
  label: { color: CHROME.dustDim, fontSize: 8, letterSpacing: 0.2, fontFamily: TYPE.monoMedium },
  labelOn: { color: CHROME.chalk },
});
