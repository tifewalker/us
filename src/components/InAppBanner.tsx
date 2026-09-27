import { Body, Handwritten, Icon3D, tapHaptic } from "@/components/ui";
import { bannerIcon, nextBanner, useCurrentBanner, type Banner } from "@/lib/banners";
import { colors, radius, shadows, space } from "@/theme";
import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SHOW_MS = 5000;

// The in-app banner: a paper note that slides down under the safe area with
// the 3D icon, the title (Caveat, it's a note) and an optional body (Nunito).
// Auto-dismisses after ~5s, swipe up to dismiss, tap to open its screen.
// Skipped if you're already on that screen. One at a time (lib/banners.ts).
export function InAppBannerHost() {
  const banner = useCurrentBanner();
  const pathname = usePathname();
  const onIt = !!banner && pathname === banner.url;
  useEffect(() => {
    if (onIt) nextBanner(); // already looking at it — drop it quietly
  }, [onIt, banner]);
  if (!banner || onIt) return null;
  return <BannerNote key={banner.key} banner={banner} />;
}

function BannerNote({ banner }: { banner: Banner }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-200)).current;
  const done = useRef(false);

  const dismiss = (then?: () => void) => {
    if (done.current) return;
    done.current = true;
    Animated.timing(y, { toValue: -200, duration: 220, useNativeDriver: true }).start(() => {
      nextBanner();
      then?.();
    });
  };

  useEffect(() => {
    tapHaptic(); // soft haptic on native; no-op on web
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
    const t = setTimeout(() => dismiss(), SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => y.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30 || g.vy < -0.6) dismiss();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + space.sm, transform: [{ translateY: y }] }]} {...pan.panHandlers}>
      <Pressable
        onPress={() => dismiss(() => router.push(banner.url as any))}
        accessibilityRole="button"
        accessibilityLabel={`${banner.title}. Open`}
        style={styles.note}
      >
        <Icon3D name={bannerIcon(banner.kind)} size={36} />
        <View style={styles.text}>
          <Handwritten variant="handSmall" numberOfLines={2}>
            {banner.title}
          </Handwritten>
          {banner.body ? (
            <Body variant="small" color={colors.inkSoft} numberOfLines={2}>
              {banner.body}
            </Body>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.md, zIndex: 1000, elevation: 1000 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    transform: [{ rotate: "-0.6deg" }],
    ...shadows.floating,
  },
  text: { flex: 1 },
});
