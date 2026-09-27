import { BackButton } from "@/components/play/BackButton";
import { Body, Button, Icon3D, Input, Polaroid, ScreenBackground, Title } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { signPaths } from "@/lib/memories";
import { getProfiles } from "@/lib/profile";
import { getStory, MAX_STORY, removeStoryPhoto, saveStory, setStoryPhoto, type Story } from "@/lib/us";
import { colors, GUTTER, space } from "@/theme";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AUTOSAVE_MS = 900;

// Edit "How we met". Autosaves ~1s after you stop typing (and when you
// leave); shows "Last edited by {Name}". Either of you can edit it.
export default function StoryEditor() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [ctx, setCtx] = useState<{ coupleId: string; myId: string; names: Record<string, string> } | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [photoBusy, setPhotoBusy] = useState(false);
  const saved = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");
  textRef.current = text;

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const couple = await getMyCouple();
        if (!couple) return;
        const profiles = await getProfiles([couple.partner_one, couple.partner_two ?? ""]);
        const names: Record<string, string> = {};
        for (const p of Object.values(profiles)) names[p.id] = p.id === user.id ? "you" : (p.firstName ?? "your person");
        const s = await getStory(couple.id);
        setCtx({ coupleId: couple.id, myId: user.id, names });
        setStory(s);
        setText(s?.story ?? "");
        saved.current = s?.story ?? "";
        if (s?.photo_path) setPhotoUrl((await signPaths([s.photo_path]))[s.photo_path] ?? null);
      } catch (err: any) {
        Alert.alert("Couldn't open the story", err.message ?? String(err));
      }
    })();
  }, []);

  const flush = useCallback(async () => {
    if (!ctx) return;
    const value = textRef.current;
    if (value === saved.current) return;
    setStatus("saving");
    try {
      await saveStory(ctx.coupleId, ctx.myId, { story: value });
      saved.current = value;
      setStory((s) => ({ story: value, photo_path: s?.photo_path ?? null, updated_by: ctx.myId, updated_at: new Date().toISOString() }));
      setStatus("saved");
    } catch (err: any) {
      console.log("[Story] save failed:", err.message);
      setStatus("error");
    }
  }, [ctx]);

  // autosave after a pause in typing
  useEffect(() => {
    if (!ctx || text === saved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, ctx, flush]);

  // and on the way out
  useEffect(() => () => void flush(), [flush]);

  async function pickPhoto() {
    if (!ctx) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Allow photo access to add a photo.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled) return;
    setPhotoBusy(true);
    try {
      const path = await setStoryPhoto(ctx.coupleId, ctx.myId, result.assets[0].uri, story?.photo_path ?? null);
      setStory((s) => ({ story: s?.story ?? saved.current, photo_path: path, updated_by: ctx.myId, updated_at: new Date().toISOString() }));
      setPhotoUrl((await signPaths([path]))[path] ?? null);
    } catch (err: any) {
      Alert.alert("Couldn't add the photo", err.message ?? String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!ctx || !story?.photo_path) return;
    setPhotoBusy(true);
    try {
      await removeStoryPhoto(ctx.coupleId, ctx.myId, story.photo_path);
      setStory({ ...story, photo_path: null, updated_by: ctx.myId });
      setPhotoUrl(null);
    } catch (err: any) {
      Alert.alert("Couldn't remove the photo", err.message ?? String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  if (!ctx) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const editedBy = story?.updated_by ? (ctx.names[story.updated_by] ?? "your person") : null;
  const statusLine =
    status === "saving" ? "Saving…" : status === "error" ? "Couldn't save — check your connection" : editedBy ? `Last edited by ${editedBy}` : "Saves as you write";

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
          <BackButton />
          <View style={styles.header}>
            <Icon3D name="loveLetter" size={48} />
            <Title variant="titleItalic">How we met</Title>
          </View>

          {story?.photo_path ? (
            <View style={styles.photo}>
              <Polaroid seed={story.photo_path} uri={photoUrl} cacheKey={story.photo_path} width={Math.min(width * 0.6, 260)} tape="sky" />
              <View style={styles.photoActions}>
                <Button title="Change photo" variant="text" onPress={pickPhoto} disabled={photoBusy} />
                <Button title="Remove" variant="text" onPress={removePhoto} disabled={photoBusy} />
              </View>
            </View>
          ) : (
            <Button title={photoBusy ? "Adding…" : "Add a photo"} icon="camera" variant="soft" onPress={pickPhoto} disabled={photoBusy} style={styles.addPhoto} />
          )}

          <Input
            value={text}
            onChangeText={setText}
            onBlur={() => void flush()}
            placeholder="Where were you? Who spoke first? What did you think?"
            multiline
            maxLength={MAX_STORY}
            style={styles.input}
          />
          <View style={styles.meta}>
            <Body variant="small" color={status === "error" ? colors.danger : colors.inkFaint}>
              {statusLine}
            </Body>
            <Body variant="small" color={colors.inkFaint}>
              {text.length}/{MAX_STORY}
            </Body>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, marginBottom: space.lg },
  photo: { alignItems: "center", marginVertical: space.lg },
  photoActions: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  addPhoto: { marginBottom: space.lg },
  input: { minHeight: 280, lineHeight: 26 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
});
