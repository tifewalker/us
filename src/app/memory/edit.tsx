import { MemoryFields, type MemoryFieldValues } from "@/components/memories/MemoryFields";
import { Body, Button, ScreenBackground, Title, toDateString } from "@/components/ui";
import { getMemoryById, updateMemory } from "@/lib/memories";
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

  useEffect(() => {
    if (!id) return;
    getMemoryById(id)
      .then((m: any) => {
        let date: Date | null = null;
        if (m.memory_date) {
          const [y, mo, d] = m.memory_date.split("-").map(Number);
          date = new Date(y, mo - 1, d);
        }
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
  save: { marginTop: space.xl },
  loading: { marginTop: space.xxxl, alignItems: "center" },
});
