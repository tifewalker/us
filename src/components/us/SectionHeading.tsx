import { Button, Icon3D, Title, type Icon3DName } from "@/components/ui";
import { colors, space } from "@/theme";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

// A scrapbook page heading: a 3D icon, the title in Fraunces italic, an
// optional text action, and a hand-drawn wavy underline so each section reads
// as the next page rather than another card.
export function SectionHeading({
  icon,
  title,
  action,
  onAction,
  style,
}: {
  icon: Icon3DName;
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Icon3D name={icon} size={30} />
        <Title variant="headingItalic" style={styles.flex}>
          {title}
        </Title>
        {action && onAction ? <Button title={action} variant="text" onPress={onAction} /> : null}
      </View>
      <Svg width={140} height={8} style={styles.doodle}>
        <Path d="M2 5 Q 14 1 26 5 T 50 5 T 74 5 T 98 5 T 122 5 T 138 4" stroke={colors.paperEdge} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxxl, marginBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  doodle: { marginLeft: 38, marginTop: 2 },
});
