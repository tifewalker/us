import { Body, Icon3D, PressableScale, ScreenBackground, Title, type Icon3DName } from "@/components/ui";
import { colors, radius, shadows, space } from "@/theme";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function PairingChoice() {
  return (
    <ScreenBackground>
      <View style={styles.center}>
        <Icon3D name="palm" size={88} style={styles.palm} />
        <Title variant="titleItalic" center>
          Let's set up your world.
        </Title>
        <Body center color={colors.inkSoft} style={styles.lead}>
          One of you starts it, the other joins with a code.
        </Body>

        <View style={styles.choices}>
          <Choice
            icon="sparkles"
            title="Start our world"
            hint="You'll get a code to share"
            tilt={-2}
            onPress={() => router.push("/create-couple")}
          />
          <Choice
            icon="envelope"
            title="Join with a code"
            hint="Your person already started"
            tilt={1.5}
            tint={colors.warmWhite}
            onPress={() => router.push("/join-couple")}
          />
        </View>
      </View>
    </ScreenBackground>
  );
}

// Each choice is a paper note you pick up, not a generic button.
function Choice({
  icon,
  title,
  hint,
  tilt,
  tint = colors.sand,
  onPress,
}: {
  icon: Icon3DName;
  title: string;
  hint: string;
  tilt: number;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={[styles.note, { backgroundColor: tint, transform: [{ rotate: `${tilt}deg` }] }]}
    >
      <Icon3D name={icon} size={48} />
      <View style={styles.noteText}>
        <Title variant="heading">{title}</Title>
        <Body variant="small" color={colors.inkSoft}>
          {hint}
        </Body>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  palm: { alignSelf: "center", marginBottom: space.lg },
  lead: { marginTop: space.sm },
  choices: { marginTop: space.xxl, gap: space.xl },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.paper,
    ...shadows.paper,
  },
  noteText: { flex: 1 },
});
