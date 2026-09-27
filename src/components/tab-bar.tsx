import { Icon3D, type Icon3DName } from "@/components/ui";
import { selectionHaptic } from "@/components/ui/haptics";
import { colors, radius, shadows, space, springs, TAB_BAR_HEIGHT, type as typeScale } from "@/theme";
import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS: Record<string, { icon: Icon3DName; label: string }> = {
  index: { icon: "beach", label: "Home" },
  play: { icon: "die", label: "Play" },
  story: { icon: "camera", label: "Story" },
  us: { icon: "loveLetter", label: "Us" },
  settings: { icon: "gear", label: "Settings" },
};

// Floating, warm translucent tab bar. Active tab: icon lifts + grows on a
// spring and its label appears; inactive: smaller, no label. See DESIGN.md.
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md) }]}
    >
      <View style={styles.bar}>
        {/* clip the blur separately so the bar's warm shadow isn't clipped too */}
        <View style={styles.clip} pointerEvents="none">
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.tint} />
        </View>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <TabItem
              key={route.key}
              icon={tab.icon}
              label={tab.label}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  selectionHaptic();
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

function TabItem({
  icon,
  label,
  focused,
  onPress,
  onLongPress,
}: {
  icon: Icon3DName;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(focused ? 1 : 0, { duration: 150 })
      : withSpring(focused ? 1 : 0, springs.tab);
  }, [focused, reduceMotion, progress]);

  const iconStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 0.7 + progress.value * 0.3 }
      : {
          transform: [
            { translateY: -10 * progress.value },
            { scale: 0.86 + 0.3 * progress.value },
          ],
        },
  );
  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : 4 * (1 - progress.value) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={iconStyle}>
        <Icon3D name={icon} size={34} />
      </Animated.View>
      <Animated.Text style={[typeScale.small, styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.lg, right: space.lg },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.tabBar,
    flexDirection: "row",
    ...shadows.floating,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.tabBar,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,248,239,0.8)",
  },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(251,241,225,0.72)" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 10 },
  label: {
    color: colors.inkOcean,
    position: "absolute",
    bottom: 6,
    fontSize: 12,
    lineHeight: 16,
  },
});
