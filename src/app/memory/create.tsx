import { MediaTray } from "@/components/memories/MediaTray";
import { PolaroidDevelop } from "@/components/moments/PolaroidDevelop";
import { MemoryFields, type MemoryFieldValues } from "@/components/memories/MemoryFields";
import { useMediaPicker } from "@/components/memories/useMediaPicker";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import { MAX_VOICE_SECONDS } from "@/lib/voice";
import { Body, Button, ScreenBackground, Title, toDateString } from "@/components/ui";
import { getMyCouple } from "@/lib/couples";
import { createMemory } from "@/lib/memories";
import { colors, GUTTER, space } from "@/theme";
import { parseLocalDate } from "@/lib/dates";
import { linkBucketMemory } from "@/lib/us";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CreateMemory() {
  const insets = useSafeAreaInsets();
  // Prefilled from a ticked bucket-list item (?title=&date=&bucketItemId=)
  const params = useLocalSearchParams<{ title?: string; date?: string; bucketItemId?: string }>();
  const [fields, setFields] = useState<MemoryFieldValues>({
    title: params.title ?? "",
    description: "",
    location: "",
    date: params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? parseLocalDate(params.date) : new Date(), // defaults to today; pick a past date for older memories
    song: null,
  });
  const [busy, setBusy] = useState(false);
  const media = useMediaPicker("CreateMemory");
  // After a successful save: the first photo develops in a polaroid, then → the memory page.
  const [developing, setDeveloping] = useState<{
    uri: string | null;
    title: string;
    memoryId: string;
    failed: string[];
  } | null>(null);

  function openMemory(memoryId: string, failed: string[]) {
    router.replace(`/memory/${memoryId}`);
    if (failed.length > 0) {
      setTimeout(
        () => Alert.alert("Saved, but some files didn't upload", `The memory was saved without these:\n\n${failed.join("\n")}`),
        500,
      );
    }
  }

  async function handleSave() {
    if (!fields.title.trim()) {
      Alert.alert("Missing title", "Give this memory a name.");
      return;
    }

    setBusy(true);
    try {
      const couple = await getMyCouple();
      if (!couple) throw new Error("Could not find your world.");

      const memory = await createMemory({
        coupleId: couple.id,
        title: fields.title.trim(),
        description: fields.description.trim() || undefined,
        location: fields.location.trim() || undefined,
        memoryDate: fields.date ? toDateString(fields.date) : undefined,
        song: fields.song ?? null,
      });
      if (params.bucketItemId) {
        // link the bucket-list item to its memory; a failure here never loses the memory
        await linkBucketMemory(params.bucketItemId, memory.id).catch((e) => console.log("[CreateMemory] bucket link failed:", e.message));
      }

      // Sequential upload (see useMediaPicker); a failure doesn't stop the rest.
      const failed = await media.uploadAll(couple.id, memory.id);
      const first = media.assets[0];
      if (first) {
        // Local file — the develop moment needs no network.
        setDeveloping({
          uri: first.thumbnailUri ?? (first.type === "video" ? null : first.uri),
          title: memory.title,
          memoryId: memory.id,
          failed,
        });
      } else {
        openMemory(memory.id, failed);
      }
    } catch (err: any) {
      Alert.alert("Something went wrong", err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Title variant="titleItalic">New memory</Title>
          <Body color={colors.inkSoft} style={styles.lead}>
            A day worth keeping, with the photos to prove it.
          </Body>

          <MemoryFields value={fields} onChange={setFields} withDate />

          <MediaTray
            assets={media.assets}
            preparing={media.preparing}
            progress={media.progress}
            disabled={busy}
            onPick={media.pick}
            onRemove={media.remove}
          />
          <VoiceNotesField
            voices={media.voices}
            onAdd={media.addVoice}
            onRemove={media.removeVoice}
            max={5}
            maxSeconds={MAX_VOICE_SECONDS}
            disabled={busy}
            style={styles.voice}
          />

          <Button
            title="Save memory"
            icon="heart"
            onPress={handleSave}
            loading={busy && !media.progress}
            disabled={busy || media.preparing}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {developing && (
        <PolaroidDevelop
          uri={developing.uri}
          title={developing.title}
          onDone={() => openMemory(developing.memoryId, developing.failed)}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  voice: { marginTop: space.xl },
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER },
  lead: { marginTop: space.xs },
  save: { marginTop: space.xxl },
});
