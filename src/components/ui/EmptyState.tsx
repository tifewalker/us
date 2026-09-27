import { colors, space } from "@/theme";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "./Button";
import { Icon3D, type Icon3DName } from "./Icon3D";
import { Body, Title } from "./Text";

// 3D icon + one line of direction + (optionally) one action. Nothing more.
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  style,
}: {
  icon: Icon3DName;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Icon3D name={icon} size={96} />
      {title ? (
        <Title variant="headingItalic" center style={styles.title}>
          {title}
        </Title>
      ) : null}
      <Body center color={colors.inkSoft} style={styles.message}>
        {message}
      </Body>
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="soft" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: space.xl },
  title: { marginTop: space.lg },
  message: { marginTop: space.sm, maxWidth: 280 },
  action: { marginTop: space.xl },
});
