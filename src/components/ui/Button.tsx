import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon3D, type Icon3DName } from "./Icon3D";
import { PressableScale } from "./PressableScale";

type Variant = "primary" | "soft" | "text";

const variants: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.ocean, fg: colors.onDark },
  soft: { bg: colors.sand, fg: colors.inkOcean },
  text: { bg: "transparent", fg: colors.ocean },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: Icon3DName;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variants[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      style={[
        styles.base,
        { backgroundColor: v.bg },
        variant !== "text" && shadows.lifted,
        variant === "text" && styles.textVariant,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon3D name={icon} size={24} />}
          <Text style={[typeScale.button, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  textVariant: { minHeight: 44, paddingHorizontal: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
