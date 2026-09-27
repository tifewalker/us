import { Body, Button, Icon3D, Input, ScreenBackground, Title } from "@/components/ui";
import { colors, space } from "@/theme";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { joinCoupleByCode } from "../../lib/couples";

export default function JoinCouple() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleJoin() {
    if (!code.trim()) {
      Alert.alert(
        "Missing code",
        "Enter the invite code they shared with you.",
      );
      return;
    }
    setBusy(true);
    try {
      await joinCoupleByCode(code.trim().toUpperCase());
      router.replace("/");
    } catch (err: any) {
      Alert.alert("Something went wrong", err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Icon3D name="envelope" size={80} style={styles.icon} />
        <Title variant="titleItalic" center>
          Got a code?
        </Title>
        <Body center color={colors.inkSoft} style={styles.lead}>
          Type the invite code your person sent you.
        </Body>

        <View style={styles.form}>
          <Input
            placeholder="BLUE-OCEAN-4821"
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            style={styles.codeInput}
            accessibilityLabel="Invite code"
          />
          <Button title="Join your person" onPress={handleJoin} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  icon: { alignSelf: "center", marginBottom: space.lg },
  lead: { marginTop: space.sm },
  form: { marginTop: space.xxl },
  codeInput: { textAlign: "center", fontSize: 20, letterSpacing: 1 },
});
