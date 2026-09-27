import { Button, Handwritten, Icon3D, Input, PaperCard, Title } from "@/components/ui";
import { signIn, signUp } from "@/lib/auth";
import { colors, GUTTER, space } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// "Lock the door": once both real accounts exist, set EXPO_PUBLIC_SIGNUPS_OPEN=false
// (and turn off sign-ups in Supabase — see CLAUDE.md). The screen then only
// offers Sign in. Defaults to open.
const SIGNUPS_OPEN = process.env.EXPO_PUBLIC_SIGNUPS_OPEN !== "false";

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signin" | "signup">(SIGNUPS_OPEN ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Enter a name first.");
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
      router.replace("/pairing-choice");
    } catch (err: any) {
      Alert.alert("Something went wrong", err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ImageBackground
      source={require("@/assets/images/lockscreen.jpeg")}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(7,26,43,0.15)", "rgba(7,26,43,0.35)", "rgba(7,26,43,0.85)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Title variant="titleItalic" color={colors.onDark} center style={styles.title}>
              It all started here.
            </Title>
            <View style={styles.dateRow}>
              <Handwritten color={colors.sand}>March 29</Handwritten>
              <Icon3D name="heart" size={26} />
            </View>
          </View>

          <PaperCard style={styles.card}>
            {mode === "signup" && (
              <Input
                label="Your name"
                placeholder="What should they call you?"
                value={name}
                onChangeText={setName}
                textContentType="givenName"
              />
            )}
            <Input
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Password"
              placeholder="Something only you know"
              secureTextEntry
              textContentType={mode === "signup" ? "newPassword" : "password"}
              value={password}
              onChangeText={setPassword}
            />

            <Button
              title={mode === "signup" ? "Create account" : "Sign in"}
              onPress={handleSubmit}
              loading={busy}
              style={styles.submit}
            />
            {SIGNUPS_OPEN && (
              <Button
                variant="text"
                title={
                  mode === "signup"
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"
                }
                onPress={() => setMode(mode === "signup" ? "signin" : "signup")}
              />
            )}
          </PaperCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.deepOcean },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: GUTTER },
  hero: { alignItems: "center", marginBottom: space.xl },
  title: { marginBottom: space.xs },
  dateRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  card: { padding: space.xl, transform: [{ rotate: "-0.6deg" }] },
  submit: { marginTop: space.sm },
});
