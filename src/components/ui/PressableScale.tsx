import { PRESS_SCALE, REDUCED_PRESS_OPACITY, springs } from "@/theme";
import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { tapHaptic } from "./haptics";

type Props = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
};

// Every tappable object in the app goes through this: spring to ~0.96 + light
// haptic. With Reduce Motion on, it dips opacity instead of scaling.
export function PressableScale({
  children,
  style,
  scaleTo = PRESS_SCALE,
  haptic = true,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - pressed.value * (1 - REDUCED_PRESS_OPACITY) }
      : { transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }] },
  );

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = reduceMotion
          ? withTiming(1, { duration: 80 })
          : withSpring(1, springs.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = reduceMotion
          ? withTiming(0, { duration: 120 })
          : withSpring(0, springs.press);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) tapHaptic();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.55 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
