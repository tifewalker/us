import { MediaTray } from "@/components/memories/MediaTray";
import { useMediaPicker } from "@/components/memories/useMediaPicker";
import { SongCard } from "@/components/music/SongCard";
import { SongPicker } from "@/components/music/SongPicker";
import { usePreviewStopOnBlur } from "@/components/music/usePreviewStopOnBlur";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import { VoiceTag } from "@/components/voice/VoiceTag";
import {
    Body,
    Button,
    formatLongDate,
    Icon3D,
    Input,
    PressableScale,
    ScreenBackground,
    Title,
} from "@/components/ui";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { nextOccurrence } from "@/lib/dates";
import {
    addGiftMedia,
    addGiftVoice,
    getGift,
    MAX_SEALED_VOICES,
    getMyLatestGift,
    nextBirthdayUnlock,
    removeGiftMedia,
    saveGift,
    setGiftMedia,
    signGiftMedia,
    type Gift,
} from "@/lib/gifts";
import { birthdayOf, getImportantDates } from "@/lib/importantDates";
import type { MediaRef } from "@/lib/memories";
import type { Song } from "@/lib/music";
import { asWaveform, MAX_VOICE_SECONDS } from "@/lib/voice";
import { colors, fonts, GUTTER, radius, shadows, space } from "@/theme";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_MEDIA = 10;

// Prepare (or edit, until it unlocks) a sealed birthday surprise for your
// partner: a letter, an optional song, up to 10 photos/videos. It's saved as a
// `bottles` row (kind 'birthday') unlocking at local midnight on their next
// birthday; media goes to <couple_id>/sealed/<bottle_id>/ (sender-only).
export default function PrepareGift() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  usePreviewStopOnBlur();
  const media = useMediaPicker("GiftMedia");

  const [ctx, setCtx] = useState<{ coupleId: string; myId: string; partnerId: string; partnerName: string; unlockAt: Date } | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [letter, setLetter] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [existing, setExisting] = useState<MediaRef[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const couple = await getMyCouple();
        const partnerId = couple && (couple.partner_one === user.id ? couple.partner_two : couple.partner_one);
        if (!couple || !partnerId) throw new Error("Your partner needs to join first.");
        const [dates, partnerName] = await Promise.all([getImportantDates(couple.id), getUserName(partnerId)]);
        const bday = birthdayOf(dates, partnerId);
        if (!bday) throw new Error("Add their birthday in Us → Our dates first.");
        const g = id ? await getGift(id) : await getMyLatestGift(couple.id, user.id);
        // Only a still-sealed gift of mine is editable; otherwise start a new one.
        const editable = g && g.sender_id === user.id && g.unlock_at && new Date(g.unlock_at) > new Date() ? g : null;
        setCtx({
          coupleId: couple.id,
          myId: user.id,
          partnerId,
          partnerName: partnerName?.trim().split(/\s+/)[0] ?? "your person",
          unlockAt: editable?.unlock_at ? new Date(editable.unlock_at) : nextBirthdayUnlock(bday.date, nextOccurrence),
        });
        if (editable) {
          setGift(editable);
          setLetter(editable.message);
          setSong(editable.song);
          setExisting(editable.media ?? []);
          if (editable.media?.length) setThumbs(await signGiftMedia(editable.media));
        }
      } catch (err: any) {
        Alert.alert("Can't prepare a surprise yet", err.message ?? String(err));
        router.back();
      }
    })();
  }, [id]);

  async function removeExisting(ref: MediaRef) {
    if (!gift) return;
    try {
      const next = await removeGiftMedia({ ...gift, media: existing }, ref);
      setExisting(next);
    } catch (err: any) {
      Alert.alert("Couldn't remove that", err.message ?? String(err));
    }
  }

  async function save() {
    if (!ctx) return;
    if (!letter.trim()) {
      Alert.alert("Write a letter", "The letter is the heart of the surprise.");
      return;
    }
    if (existing.filter((m) => m.media_type !== "voice").length + media.assets.length > MAX_MEDIA) {
      Alert.alert("Too many", `Up to ${MAX_MEDIA} photos and videos.`);
      return;
    }
    setSaving(true);
    try {
      // 1. the gift row (its id names the sealed folder)
      const saved = await saveGift({
        id: gift?.id,
        coupleId: ctx.coupleId,
        senderId: ctx.myId,
        recipientId: ctx.partnerId,
        message: letter.trim(),
        song,
        unlockAt: ctx.unlockAt,
      });
      // 2. new media into <couple>/sealed/<gift>/, then 3. record them on the gift
      const added: MediaRef[] = [];
      const failed = await media.uploadEach(async (asset, mediaType, onProgress) => {
        added.push(
          await addGiftMedia(saved, { uri: asset.uri, mediaType, durationMs: asset.duration, thumbnailUri: asset.thumbnailUri, mimeType: asset.mimeType }, onProgress),
        );
      }, async (voice, onProgress) => {
        added.push(await addGiftVoice(saved, voice, onProgress));
      });
      if (added.length) await setGiftMedia(saved.id, [...existing, ...added]);
      media.clear();
      if (failed.length) {
        Alert.alert("Sealed, but some files didn't upload", failed.join("\n"));
      }
      router.back();
    } catch (err: any) {
      Alert.alert("Couldn't seal the surprise", err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  const existingVisual = existing.filter((m) => m.media_type !== "voice");
  const existingVoices = existing.filter((m) => m.media_type === "voice");

  if (!ctx) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Icon3D name="gift" size={64} />
            <Title variant="titleItalic" center>
              A surprise for {ctx.partnerName}
            </Title>
            <Body color={colors.inkSoft} center>
              Sealed until {formatLongDate(ctx.unlockAt)} — they can't peek before then.
            </Body>
          </View>

          <Input
            label="Your letter"
            placeholder={`Dear ${ctx.partnerName}…`}
            value={letter}
            onChangeText={setLetter}
            multiline
            maxLength={4000}
            style={styles.letter}
          />

          <Body variant="label" color={colors.inkSoft} style={styles.label}>
            A song (optional)
          </Body>
          {song ? (
            <SongCard song={song} onRemove={() => setSong(null)} style={styles.song} />
          ) : (
            <Button title="Add a song" icon="musicalNotes" variant="soft" onPress={() => setPickerOpen(true)} />
          )}

          <Body variant="label" color={colors.inkSoft} style={styles.label}>
            Photos and videos (optional, up to {MAX_MEDIA})
          </Body>
          {existingVisual.length > 0 && (
            <View style={styles.existing}>
              {existingVisual.map((m) => {
                const uri = thumbs[m.media_type === "photo" ? m.storage_path : (m.thumbnail_path ?? "")];
                return (
                  <PressableScale
                    key={m.storage_path}
                    onPress={() =>
                      Alert.alert("Remove this from the surprise?", undefined, [
                        { text: "Keep it", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => removeExisting(m) },
                      ])
                    }
                    accessibilityLabel={`Remove ${m.media_type}`}
                    style={styles.thumbFrame}
                  >
                    {uri ? <Image source={{ uri, cacheKey: m.storage_path }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
                    {m.media_type === "video" && <Text style={styles.play}>▶</Text>}
                  </PressableScale>
                );
              })}
            </View>
          )}
          <MediaTray
            assets={media.assets}
            preparing={media.preparing}
            progress={media.progress}
            disabled={saving || existingVisual.length + media.assets.length >= MAX_MEDIA}
            onPick={media.pick}
            onRemove={media.remove}
          />

          <Body variant="label" color={colors.inkSoft} style={styles.label}>
            Voice notes (optional, up to {MAX_SEALED_VOICES}, 2 minutes each)
          </Body>
          {existingVoices.map((m) => (
            <VoiceTag
              key={m.storage_path}
              id={m.storage_path}
              playKey={m.storage_path}
              uri={thumbs[m.storage_path] ?? null}
              durationSeconds={m.duration_seconds ?? 0}
              waveform={asWaveform(m.waveform)}
              label="in the surprise · long-press to remove"
              onLongPress={() =>
                Alert.alert("Remove this voice note?", undefined, [
                  { text: "Keep it", style: "cancel" },
                  { text: "Remove", style: "destructive", onPress: () => removeExisting(m) },
                ])
              }
              style={styles.voiceTag}
            />
          ))}
          <VoiceNotesField
            voices={media.voices}
            onAdd={media.addVoice}
            onRemove={media.removeVoice}
            max={MAX_SEALED_VOICES}
            existingCount={existingVoices.length}
            maxSeconds={MAX_VOICE_SECONDS}
            recorderLabel={`Say happy birthday to ${ctx.partnerName}`}
            disabled={saving}
          />

          <Button title={gift ? "Save the surprise" : "Seal the surprise"} icon="gift" onPress={save} loading={saving && !media.progress} disabled={saving || media.preparing} style={styles.save} />
          <Button title="Cancel" variant="text" onPress={() => router.back()} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
      <SongPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onChoose={setSong} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  voiceTag: { marginBottom: space.md },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  header: { alignItems: "center", gap: space.xs, marginBottom: space.xl },
  letter: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 28, minHeight: 180 },
  label: { marginTop: space.xl, marginBottom: space.sm, marginLeft: space.xs },
  song: { marginLeft: space.xl },
  existing: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.sm },
  thumbFrame: { backgroundColor: colors.warmWhite, padding: 4, paddingBottom: 12, borderRadius: radius.photo, ...shadows.lifted },
  thumb: { width: 72, height: 72, backgroundColor: colors.paperDeep },
  play: { position: "absolute", left: 10, bottom: 16, color: colors.onDark, fontSize: 14 },
  save: { marginTop: space.xxl },
});
