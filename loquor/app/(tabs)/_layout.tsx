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

import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  GlyphProgress,
  GlyphPractice,
  GlyphRooms,
  GlyphSettings,
  GlyphToday,
} from "../../components/glyphs";
import { CHROME, TYPE } from "../../theme";

type Glyph = (p: { tint: string }) => React.ReactElement;

// The label is drawn rather than handed to the navigator so it uses Geist at
// the app's tracking. A tab bar in San Francisco under a Fraunces headline
// reads as two apps.
function tab(label: string, Glyph: Glyph) {
  return {
    title: label,
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <Glyph tint={focused ? CHROME.chalk : CHROME.dustDim} />
    ),
    tabBarLabel: ({ focused }: { focused: boolean }) => (
      <Text style={[s.label, focused && s.labelOn]}>{label}</Text>
    ),
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.bar,
        // The hairline is the app's only separator, so the bar gets the same one
        // rather than the platform's default shadow.
        tabBarBackground: () => <View style={s.barFill} />,
        sceneStyle: { backgroundColor: CHROME.floor },
        tabBarItemStyle: { paddingTop: 8 },
      }}
    >
      <Tabs.Screen name="index" options={tab("Today", GlyphToday)} />
      <Tabs.Screen name="practice" options={tab("Practice", GlyphPractice)} />
      <Tabs.Screen name="rooms" options={tab("Rooms", GlyphRooms)} />
      <Tabs.Screen name="progress" options={tab("Progress", GlyphProgress)} />
      <Tabs.Screen name="settings" options={tab("Setup", GlyphSettings)} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: "transparent",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHROME.carve,
    elevation: 0,
    height: 58,
    paddingBottom: 4,
  },
  barFill: { flex: 1, backgroundColor: CHROME.floor },
  label: {
    color: CHROME.dustDim,
    fontSize: 9,
    letterSpacing: 1.1,
    fontFamily: TYPE.uiMedium,
    marginTop: 3,
  },
  labelOn: { color: CHROME.chalk },
});
