// Must be first: makes Alert.alert work on web (react-native-web stubs it out).
import "@/lib/webAlert";
import { InAppBannerHost } from "@/components/InAppBanner";
import { InstallHint } from "@/components/InstallHint";
import { stopPreview } from "@/lib/music";
import { colors, fontAssets } from "@/theme";
import { useFonts } from "expo-font";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";

SplashScreen.preventAutoHideAsync();

// Navigation surfaces default to paper so transitions never flash white/black.
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.paper, card: colors.paper },
};

export default function RootLayout() {
  // Keep the native splash up until Fraunces / Nunito / Caveat are ready, so
  // no screen ever renders in the system font first.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontError) console.log("[RootLayout] font load failed:", fontError.message);
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);

  // Song previews never keep playing once the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") stopPreview();
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="memory/viewer"
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="memory/reel"
          options={{ presentation: "fullScreenModal", animation: "fade" }}
        />
        <Stack.Screen
          name="anniversary/[year]"
          options={{ presentation: "fullScreenModal", animation: "fade" }}
        />
      </Stack>
      {/* web only: one-time "Add Us to your home screen" hint in iOS Safari */}
      <InstallHint />
      {/* in-app notification banners (pushes forwarded by sw.js + Realtime fallback) */}
      <InAppBannerHost />
    </ThemeProvider>
  );
}
