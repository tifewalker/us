import { Body, Button, Icon3D } from "@/components/ui";
import { colors, radius, shadows, space } from "@/theme";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KEY = "us.installHint.dismissed";

// Web only: a one-time "Add Us to your home screen" hint, shown only in iOS
// Safari when the app isn't already installed (running standalone).
function shouldShow(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ua = nav.userAgent || "";
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const standalone = nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  let dismissed = false;
  try {
    dismissed = window.localStorage.getItem(KEY) === "1";
  } catch {}
  return iOS && safari && !standalone && !dismissed;
}

export function InstallHint() {
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // after first paint, so it never blocks the app
    const t = setTimeout(() => setShow(shouldShow()), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  }

  return (
    <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOut.duration(300)} style={[styles.wrap, { bottom: insets.bottom + space.md }]}>
      <View style={styles.card}>
        <Icon3D name="beach" size={40} />
        <View style={styles.flex}>
          <Body variant="bodyStrong" color={colors.inkOcean}>
            Add Us to your home screen
          </Body>
          <Body variant="small" color={colors.inkSoft}>
            Tap Share (the square with an arrow ↑), then "Add to Home Screen".
          </Body>
        </View>
      </View>
      <Button title="Got it" variant="text" onPress={dismiss} style={styles.button} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.ticket,
    padding: space.lg,
    zIndex: 100,
    ...shadows.floating,
  },
  card: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  button: { alignSelf: "flex-end", marginTop: space.xs },
});
