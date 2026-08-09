import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
// Deep imports, not the package roots. The root index re-exports all eighteen
// weights of each family, and Metro bundles every asset it can reach — importing
// from the root put 3 MB of unused TTFs into the payload.
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_400Regular_Italic } from "@expo-google-fonts/fraunces/400Regular_Italic";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";

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
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  if (!ready || !floorPassed) {
    return (
      <>
        <StatusBar style="light" />
        <Boot label={ready ? undefined : "LOADING"} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: CHROME.floor },
          animation: "fade",
        }}
      />
    </>
  );
}
