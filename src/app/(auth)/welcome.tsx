import { Body, Button, Handwritten, Icon3D, Input, PaperCard, PasswordInput, Title } from "@/components/ui";
import { friendlyAuthError, sendPasswordReset, signIn, signUp } from "@/lib/auth";
import { colors, GUTTER, radius, space } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// "Lock the door": once both real accounts exist, set EXPO_PUBLIC_SIGNUPS_OPEN=false
// (and turn off sign-ups in Supabase — see CLAUDE.md). The screen then only
// offers Sign in. Defaults to open.
const SIGNUPS_OPEN = process.env.EXPO_PUBLIC_SIGNUPS_OPEN !== "false";

type Mode = "signin" | "signup" | "forgot";

// Sign in / create account / forgot password. Errors show inline on the card
// (Alert.alert is a no-op on the web app), the password has an eye toggle.
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(SIGNUPS_OPEN ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    const e = email.trim();
    if (!e) return setError("Enter your email first.");
    if (mode === "forgot") {
      setBusy(true);
      try {
        await sendPasswordReset(e);
        setInfo(`If there's an account for ${e}, a reset link is on its way. Open it on this phone, pick a new password, then come back and sign in.`);
      } catch (err) {
        setError(friendlyAuthError(err));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode === "signup" && !name.trim()) return setError("Enter your name first.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      if (mode === "signup") await signUp(e, password, name.trim());
      else await signIn(e, password);
      router.replace("/pairing-choice");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send reset link";

  return (
    <ImageBackground source={require("@/assets/images/lockscreen.jpeg")} style={styles.background} resizeMode="cover">
      <StatusBar style="light" />
      <LinearGradient colors={["rgba(7,26,43,0.15)", "rgba(7,26,43,0.35)", "rgba(7,26,43,0.85)"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
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
            {mode === "forgot" && (
              <View style={styles.forgotHead}>
                <Title variant="heading">Forgot your password?</Title>
                <Body variant="small" color={colors.inkSoft}>
                  We'll email you a link to pick a new one.
                </Body>
              </View>
            )}
            {mode === "signup" && (
              <Input label="Your name" placeholder="What should they call you?" value={name} onChangeText={setName} textContentType="givenName" />
            )}
            <Input
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
            />
            {mode !== "forgot" && (
              <PasswordInput
                label="Password"
                placeholder="Something only you know"
                textContentType={mode === "signup" ? "newPassword" : "password"}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
            )}

            {error && (
              <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Body variant="small" color={colors.danger}>
                  {error}
                </Body>
              </View>
            )}
            {info && (
              <View style={styles.info} accessibilityLiveRegion="polite">
                <Body variant="small" color={colors.inkOcean}>
                  {info}
                </Body>
              </View>
            )}

            <Button title={submitLabel} onPress={handleSubmit} loading={busy} style={styles.submit} />

            {mode === "signin" && <Button variant="text" title="Forgot password?" onPress={() => switchTo("forgot")} />}
            {mode === "forgot" && <Button variant="text" title="Back to sign in" onPress={() => switchTo("signin")} />}
            {SIGNUPS_OPEN && mode !== "forgot" && (
              <Button
                variant="text"
                title={mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
                onPress={() => switchTo(mode === "signup" ? "signin" : "signup")}
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
  forgotHead: { gap: space.xs, marginBottom: space.md },
  error: { backgroundColor: "rgba(196,85,63,0.08)", borderRadius: radius.paper, padding: space.md, marginBottom: space.sm },
  info: { backgroundColor: "rgba(126,200,227,0.18)", borderRadius: radius.paper, padding: space.md, marginBottom: space.sm },
  submit: { marginTop: space.sm },
});
