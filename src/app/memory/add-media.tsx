import { MediaTray } from "@/components/memories/MediaTray";
import { useMediaPicker } from "@/components/memories/useMediaPicker";
import { Body, Button, ScreenBackground, Title } from "@/components/ui";
import { getMemoryById } from "@/lib/memories";
import { colors, GUTTER, space } from "@/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Add photos/videos to an existing memory — same picker, HEIC→JPEG, size
// limit, thumbnails and progress as "New memory" (useMediaPicker + MediaTray).
export default function AddMedia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const media = useMediaPicker("AddMedia");
  const [memory, setMemory] = useState<{ title: string; couple_id: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMemoryById(id)
      .then((m: any) => setMemory({ title: m.title, couple_id: m.couple_id }))
      .catch((err) => {
        Alert.alert("Couldn't open this memory", err.message ?? String(err));
        router.back();
      });
  }, [id]);

  async function handleUpload() {
    if (!memory) return;
    if (media.assets.length === 0) {
      Alert.alert("Nothing picked yet", "Choose a photo or video first.");
      return;
    }
    setBusy(true);
    try {
      const failed = await media.uploadAll(memory.couple_id, id);
      if (failed.length > 0) {
        Alert.alert("Some files didn't upload", `These weren't added:\n\n${failed.join("\n")}`);
      }
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground padded={false}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        <Title variant="titleItalic">Add to this memory</Title>
        {memory && (
          <Body color={colors.inkSoft} style={styles.lead}>
            {memory.title}
          </Body>
        )}

        <MediaTray
          assets={media.assets}
          preparing={media.preparing}
          progress={media.progress}
          disabled={busy}
          onPick={media.pick}
          onRemove={media.remove}
        />

        <Button
          title={media.assets.length > 1 ? `Add these ${media.assets.length}` : "Add to memory"}
          icon="heart"
          onPress={handleUpload}
          loading={busy && !media.progress}
          disabled={busy || media.preparing || !memory}
          style={styles.save}
        />
        <Button title="Cancel" variant="text" onPress={() => router.back()} disabled={busy} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER },
  lead: { marginTop: space.xs },
  save: { marginTop: space.xxl },
});
