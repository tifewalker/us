import { Body, Button, Icon3D, PaperCard, PasswordInput, ScreenBackground, Title } from "@/components/ui";
import { friendlyAuthError, updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, GUTTER, radius, space } from "@/theme";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Where the "reset your password" email link lands (/reset-password). On web,
// supabase-js reads the recovery token from the URL (detectSessionInUrl) and
// signs this browser in for the reset; then you choose a new password.
// Email links open in Safari, not the installed app — so afterwards we tell
// you to open Us from the home screen and sign in there.
export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<"checking" | "ready" | "expired" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        settled = true;
        setState("ready");
      }
    });
    // the token may already have been consumed before this screen mounted
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setState("ready");
      }
    });
    const t = setTimeout(() => {
      if (!settled) setState((s) => (s === "checking" ? "expired" : s));
    }, 4000);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function save() {
    setError(null);
    if (password.length < 6) return setError("Pick a password with at least 6 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await updatePassword(password);
      setState("done");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Icon3D name="loveLetter" size={56} />
            <Title variant="titleItalic" center>
              {state === "done" ? "All set" : "A new password"}
            </Title>
          </View>

          <PaperCard style={styles.card}>
            {state === "checking" && <ActivityIndicator color={colors.coral} />}

            {state === "expired" && (
              <>
                <Body color={colors.inkSoft}>This reset link has expired or was already used. Ask for a new one from the sign-in screen.</Body>
                <Button title="Back to sign in" onPress={() => router.replace("/welcome")} style={styles.gap} />
              </>
            )}

            {state === "ready" && (
              <>
                <PasswordInput label="New password" placeholder="At least 6 characters" textContentType="newPassword" value={password} onChangeText={setPassword} />
                <PasswordInput label="Type it again" placeholder="Same again" textContentType="newPassword" value={confirm} onChangeText={setConfirm} onSubmitEditing={save} returnKeyType="done" />
                {error && (
                  <View style={styles.error} accessibilityRole="alert">
                    <Body variant="small" color={colors.danger}>
                      {error}
                    </Body>
                  </View>
                )}
                <Button title="Save new password" onPress={save} loading={busy} />
              </>
            )}

            {state === "done" && (
              <>
                <Body>Your password is changed.</Body>
                <Body color={colors.inkSoft} style={styles.gap}>
                  If you use Us from your home screen, open it from there and sign in with your new password.
                </Body>
                <Button title="Continue to Us" onPress={() => router.replace("/")} style={styles.gap} />
              </>
            )}
          </PaperCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: GUTTER },
  head: { alignItems: "center", gap: space.sm, marginBottom: space.xl },
  card: { padding: space.xl },
  gap: { marginTop: space.md },
  error: { backgroundColor: "rgba(196,85,63,0.08)", borderRadius: radius.paper, padding: space.md, marginBottom: space.sm },
});
