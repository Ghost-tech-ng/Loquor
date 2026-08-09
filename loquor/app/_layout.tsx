import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { StyleSheet, View } from "react-native";
// Deep imports, not the package roots. The root index re-exports all eighteen
// weights of each family, and Metro bundles every asset it can reach — importing
// from the root put 3 MB of unused TTFs into the payload.
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { SchibstedGrotesk_400Regular } from "@expo-google-fonts/schibsted-grotesk/400Regular";
import { SchibstedGrotesk_500Medium } from "@expo-google-fonts/schibsted-grotesk/500Medium";
import { SchibstedGrotesk_600SemiBold } from "@expo-google-fonts/schibsted-grotesk/600SemiBold";
import { MartianMono_400Regular } from "@expo-google-fonts/martian-mono/400Regular";
import { MartianMono_500Medium } from "@expo-google-fonts/martian-mono/500Medium";

import { Boot } from "../components/boot";
import { CHROME } from "../theme";
import { seedKeysFromEnv } from "../lib/settings";

/** Shortest time the boot screen stays up. Fonts usually resolve faster than
 *  this on a warm start, and a 120ms flash of wordmark reads as a glitch —
 *  either show the thing properly or do not show it. */
const BOOT_FLOOR_MS = 700;

export default function RootLayout() {
  // Dev convenience only, and it never overwrites what is already stored.
  useEffect(() => {
    void seedKeysFromEnv();
  }, []);

  const [floorPassed, setFloorPassed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFloorPassed(true), BOOT_FLOOR_MS);
    return () => clearTimeout(id);
  }, []);

  const [ready] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_600SemiBold,
    InstrumentSerif_400Regular_Italic,
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    MartianMono_400Regular,
    MartianMono_500Medium,
  });

  // The boot screen stays mounted through its own fade rather than being cut
  // away the instant the fonts land — a hard swap makes a 700ms sequence look
  // like it was interrupted.
  const booting = !ready || !floorPassed;
  const [bootMounted, setBootMounted] = useState(true);
  useEffect(() => {
    if (booting) return;
    const id = setTimeout(() => setBootMounted(false), 280);
    return () => clearTimeout(id);
  }, [booting]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {ready ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: CHROME.floor },
            animation: "fade",
          }}
        />
      ) : null}
      {bootMounted ? <Boot exiting={!booting} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.floor },
});
