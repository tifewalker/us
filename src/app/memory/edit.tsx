import { MemoryFields, type MemoryFieldValues } from "@/components/memories/MemoryFields";
import { Body, Button, ScreenBackground, Title, toDateString } from "@/components/ui";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import { addMemoryVoice, getMemoryById, updateMemory } from "@/lib/memories";
import { MAX_VOICE_SECONDS, type LocalVoice } from "@/lib/voice";
import { colors, GUTTER, space } from "@/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EditMemory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState<MemoryFieldValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [voices, setVoices] = useState<LocalVoice[]>([]);

  useEffect(() => {
    if (!id) return;
    getMemoryById(id)
      .then((m: any) => {
        let date: Date | null = null;
        if (m.memory_date) {
          const [y, mo, d] = m.memory_date.split("-").map(Number);
          date = new Date(y, mo - 1, d);
        }
        setCoupleId(m.couple_id);
        setFields({ title: m.title ?? "", description: m.description ?? "", location: m.location ?? "", date, song: m.song ?? null });
      })
      .catch((err) => {
        Alert.alert("Couldn't open this memory", err.message ?? String(err));
        router.back();
      });
  }, [id]);

  async function handleSave() {
    if (!fields) return;
    if (!fields.title.trim()) {
      Alert.alert("Missing title", "Give this memory a name.");
      return;
    }
    setSaving(true);
    try {
      await updateMemory(id, {
        title: fields.title.trim(),
        description: fields.description.trim() || null,
        location: fields.location.trim() || null,
        memoryDate: fields.date ? toDateString(fields.date) : null,
        song: fields.song ?? null,
      });
      const failed: string[] = [];
      for (const [i, voice] of voices.entries()) {
        try {
          if (coupleId) await addMemoryVoice({ coupleId, memoryId: id, voice });
        } catch (err: any) {
          failed.push(`Voice note ${i + 1}: ${err.message ?? String(err)}`);
        }
      }
      if (failed.length) Alert.alert("Saved, but some voice notes didn't upload", failed.join("\n"));
      router.back();
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? String(err));
    } finally {
      setSaving(false);
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
          <Title variant="titleItalic">Edit memory</Title>
          <Body color={colors.inkSoft} style={styles.lead}>
            Fix a detail or tell it a little better.
          </Body>

          {fields ? (
            <>
              <MemoryFields value={fields} onChange={setFields} withDate />
              <VoiceNotesField
                voices={voices}
                onAdd={(v) => setVoices((p) => [...p, v])}
                onRemove={(uri) => setVoices((p) => p.filter((v) => v.uri !== uri))}
                max={5}
                maxSeconds={MAX_VOICE_SECONDS}
                disabled={saving}
                style={styles.voice}
              />
              <Button title="Save changes" onPress={handleSave} loading={saving} style={styles.save} />
              <Button title="Cancel" variant="text" onPress={() => router.back()} disabled={saving} />
            </>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.coral} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER },
  lead: { marginTop: space.xs },
  voice: { marginTop: space.xl },
  save: { marginTop: space.xl },
  loading: { marginTop: space.xxxl, alignItems: "center" },
});
