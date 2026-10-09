import { useEffect, useState } from "react";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { AppState, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
// Deep imports, not the package roots. The root index re-exports every weight
// of each family, and Metro bundles every asset it can reach — importing from
// the root put megabytes of unused TTFs into the payload.
import { Fraunces_800ExtraBold } from "@expo-google-fonts/fraunces/800ExtraBold";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_400Regular } from "@expo-google-fonts/fraunces/400Regular";
import { Fraunces_400Regular_Italic } from "@expo-google-fonts/fraunces/400Regular_Italic";
import { Outfit_400Regular } from "@expo-google-fonts/outfit/400Regular";
import { Outfit_500Medium } from "@expo-google-fonts/outfit/500Medium";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit/600SemiBold";
import { Outfit_700Bold } from "@expo-google-fonts/outfit/700Bold";
import { SpaceMono_400Regular } from "@expo-google-fonts/space-mono/400Regular";
import { SpaceMono_700Bold } from "@expo-google-fonts/space-mono/700Bold";

import { Boot } from "../components/kit/Boot";
import { AuroraBackground } from "../components/kit/Aurora";
import { RewardHost } from "../components/kit/RewardHost";
import { PetHost } from "../components/kit/Pet";
import { CHROME } from "../theme";
import { seedKeysFromEnv } from "../lib/settings";
import { autoBackup } from "../features/backup/backup";

/** Shortest time the boot screen stays up. Fonts usually resolve faster than
 *  this on a warm start, and a flash of logo reads as a glitch — either show
 *  the reveal properly or do not show it. */
const BOOT_FLOOR_MS = 1100;

// Every screen is transparent so the one aurora at the root shows through.
// The navigator paints its own background unless its theme says otherwise.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent", card: "transparent" },
};

export default function RootLayout() {
  // Dev convenience only, and it never overwrites what is already stored.
  useEffect(() => {
    void seedKeysFromEnv();
  }, []);

  // Automatic backup, such as Expo Go allows it. Backgrounding is the useful
  // trigger: it is the moment after every write the user was going to make, and
  // iOS gives a few seconds of runway before suspending — enough for the two or
  // three chunk writes a day of practice actually dirties. Launch is the
  // fallback for the day that runway is not granted.
  //
  // `force` on background, because the fifteen-minute floor exists to stop the
  // foreground path backing up on every glance at the app, and leaving is
  // exactly when the floor should not apply.
  useEffect(() => {
    void autoBackup();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") void autoBackup(true);
      else if (next === "active") void autoBackup();
    });
    return () => sub.remove();
  }, []);

  const [floorPassed, setFloorPassed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFloorPassed(true), BOOT_FLOOR_MS);
    return () => clearTimeout(id);
  }, []);

  const [ready] = useFonts({
    Fraunces_800ExtraBold,
    Fraunces_600SemiBold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  // The boot screen stays mounted through its own fade rather than being cut
  // away the instant the fonts land — a hard swap makes the reveal look like it
  // was interrupted.
  const booting = !ready || !floorPassed;
  const [bootMounted, setBootMounted] = useState(true);
  useEffect(() => {
    if (booting) return;
    const id = setTimeout(() => setBootMounted(false), 280);
    return () => clearTimeout(id);
  }, [booting]);

  return (
    <GestureHandlerRootView style={s.root}>
      <StatusBar style="light" />
      {ready ? (
        <ThemeProvider value={NAV_THEME}>
          <AuroraBackground />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
              animation: "fade",
            }}
          />
          <RewardHost />
          <PetHost />
        </ThemeProvider>
      ) : null}
      {bootMounted ? <Boot exiting={!booting} /> : null}
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.floor },
});
