import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useFonts } from "expo-font";
// Deep imports, not the package roots. The root index re-exports all eighteen
// weights of each family, and Metro bundles every asset it can reach — importing
// from the root put 3 MB of unused TTFs into the payload.
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_400Regular_Italic } from "@expo-google-fonts/fraunces/400Regular_Italic";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";

import { CHROME } from "../theme";
import { seedKeysFromEnv } from "../lib/settings";

export default function RootLayout() {
  // Dev convenience only, and it never overwrites what is already stored.
  useEffect(() => {
    void seedKeysFromEnv();
  }, []);

  const [ready] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  // Hold on the ground colour rather than a spinner. The app should look like it
  // was already open, not like it is starting.
  if (!ready) return <View style={{ flex: 1, backgroundColor: CHROME.floor }} />;

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
