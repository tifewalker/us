import { EmptyState, ScreenBackground } from "@/components/ui";
import { StyleSheet } from "react-native";

export default function Play() {
  return (
    <ScreenBackground aboveTabBar>
      <EmptyState
        icon="die"
        title="Games for two"
        message="Little games and challenges for you two are on their way."
        style={styles.fill}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
