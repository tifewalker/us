import { MediaTray } from "@/components/memories/MediaTray";
import { useMediaPicker } from "@/components/memories/useMediaPicker";
import { BottleThrow } from "@/components/moments/BottleMoments";
import { SongCard } from "@/components/music/SongCard";
import { SongPicker } from "@/components/music/SongPicker";
import { usePreviewStopOnBlur } from "@/components/music/usePreviewStopOnBlur";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import { Body, Button, formatLongDate, Icon3D, Input, PressableScale, ScreenBackground, Title } from "@/components/ui";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { arrivalDate, OPEN_WHEN_LABELS, saveBottle, type ArrivalChoice, type Bottle } from "@/lib/bottles";
import { getMyCouple } from "@/lib/couples";
import { addGiftMedia, addGiftVoice, getGift, MAX_SEALED_VOICES, setGiftMedia } from "@/lib/gifts";
import { MAX_VOICE_SECONDS } from "@/lib/voice";
import { birthdayOf, getImportantDates } from "@/lib/importantDates";
import type { MediaRef } from "@/lib/memories";
import type { Song } from "@/lib/music";
import { colors, fonts, GUTTER, radius, space, type as typeScale } from "@/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_MEDIA = 5;
const MAX_CHARS = 2000;

type Ctx = {
  coupleId: string;
  myId: string;
  partnerId: string;
  partnerName: string;
  relationshipStart: string;
  partnerBirthday: string | null;
};

// Write a bottle (or edit one before it's opened, ?id=). Message, optional
// song, up to 5 photos/videos (sealed folder), and when it should arrive —
// or "Open when…" (goes into their jar, openable any time).
export default function WriteBottle() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  usePreviewStopOnBlur();
  const media = useMediaPicker("BottleMedia");

  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [editing, setEditing] = useState<Bottle | null>(null);
  const [message, setMessage] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [existing, setExisting] = useState<MediaRef[]>([]);
  const [arrival, setArrival] = useState<ArrivalChoice | "keep">("now");
  const [openWhen, setOpenWhen] = useState<string>(OPEN_WHEN_LABELS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [throwing, setThrowing] = useState<null | { toJar: boolean }>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const couple = await getMyCouple();
        const partnerId = couple && (couple.partner_one === user.id ? couple.partner_two : couple.partner_one);
        if (!couple || !partnerId) throw new Error("Your partner needs to join first.");
        const [dates, partnerName] = await Promise.all([getImportantDates(couple.id), getUserName(partnerId)]);
        setCtx({
          coupleId: couple.id,
          myId: user.id,
          partnerId,
          partnerName: partnerName?.trim().split(/\s+/)[0] ?? "your person",
          relationshipStart: couple.relationship_start,
          partnerBirthday: birthdayOf(dates, partnerId)?.date ?? null,
        });
        if (id) {
          const b = await getGift(id);
          if (!b || b.sender_id !== user.id || b.opened_at) throw new Error("This bottle can't be edited any more.");
          setEditing(b);
          setMessage(b.message);
          setSong(b.song);
          setExisting(b.media ?? []);
          if (b.kind === "bottle") setArrival("keep"); // editing keeps its arrival unless changed
          if (b.kind === "open_when") {
            setArrival("openWhen");
            if (b.open_when_label && OPEN_WHEN_LABELS.includes(b.open_when_label)) setOpenWhen(b.open_when_label);
            else {
              setOpenWhen("custom");
              setCustomLabel(b.open_when_label ?? "");
            }
          }
        }
      } catch (err: any) {
        Alert.alert("Can't write a bottle yet", err.message ?? String(err));
        router.back();
      }
    })();
  }, [id]);

  if (!ctx) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const existingVisual = existing.filter((m) => m.media_type !== "voice").length;
  const existingVoices = existing.length - existingVisual;
  const keepDate = editing?.kind === "bottle" && editing.unlock_at ? new Date(editing.unlock_at) : null;
  const choices: { value: ArrivalChoice | "keep"; label: string; hidden?: boolean }[] = [
    { value: "keep", label: keepDate ? `Keep ${formatLongDate(keepDate)}` : "Keep", hidden: !keepDate },
    { value: "now", label: "Now" },
    { value: "tonight", label: "Tonight" },
    { value: "tomorrowMorning", label: "Tomorrow morning" },
    { value: "week", label: "In a week" },
    { value: "month", label: "In a month" },
    { value: "anniversary", label: "On our anniversary" },
    { value: "partnerBirthday", label: `On ${ctx.partnerName}'s birthday`, hidden: !ctx.partnerBirthday },
    { value: "year", label: "In a year" },
    { value: "openWhen", label: "Open when…" },
  ];
  const when =
    arrival === "keep" ? keepDate : arrivalDate(arrival, { relationshipStart: ctx.relationshipStart, partnerBirthday: ctx.partnerBirthday });
  const label = openWhen === "custom" ? customLabel.trim() : openWhen;

  async function send() {
    if (!ctx) return;
    if (!message.trim()) return Alert.alert("Write something", "A bottle needs a message.");
    if (arrival === "openWhen" && !label) return Alert.alert("Open when…?", "Pick or write when they should open it.");
    if (existingVisual + media.assets.length > MAX_MEDIA) return Alert.alert("Too many", `Up to ${MAX_MEDIA} photos and videos.`);
    setSending(true);
    try {
      const isOpenWhen = arrival === "openWhen";
      const saved = await saveBottle({
        id: editing?.id,
        coupleId: ctx.coupleId,
        senderId: ctx.myId,
        recipientId: ctx.partnerId,
        message: message.trim(),
        song,
        kind: isOpenWhen ? "open_when" : "bottle",
        unlockAt: isOpenWhen ? null : when,
        openWhenLabel: isOpenWhen ? label : null,
      });
      const added: MediaRef[] = [];
      // uploads run in parallel; slot each result by its picked position
      const failed = await media.uploadEach(async (asset, mediaType, onProgress, position) => {
        added[position] = await addGiftMedia(saved, { uri: asset.uri, mediaType, durationMs: asset.duration, thumbnailUri: asset.thumbnailUri, mimeType: asset.mimeType, width: asset.width, height: asset.height }, onProgress);
      }, async (voice, onProgress, position) => {
        added[position] = await addGiftVoice(saved, voice, onProgress);
      });
      const uploaded = added.filter(Boolean);
      if (uploaded.length) await setGiftMedia(saved.id, [...existing, ...uploaded]);
      media.clear();
      if (failed.length) Alert.alert("Sent, but some files didn't upload", failed.join("\n"));
      setThrowing({ toJar: isOpenWhen });
    } catch (err: any) {
      Alert.alert("Couldn't send the bottle", err.message ?? String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Icon3D name="envelope" size={60} />
            <Title variant="titleItalic" center>
              {editing ? "Edit your bottle" : `A bottle for ${ctx.partnerName}`}
            </Title>
          </View>

          <Input
            label="Your message"
            placeholder={`Dear ${ctx.partnerName}…`}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={MAX_CHARS}
            style={styles.message}
          />
          <Body variant="small" color={colors.inkFaint} style={styles.count}>
            {message.length}/{MAX_CHARS}
          </Body>

          <Text style={[typeScale.label, styles.label]}>A song (optional)</Text>
          {song ? <SongCard song={song} onRemove={() => setSong(null)} style={styles.song} /> : <Button title="Add a song" icon="musicalNotes" variant="soft" onPress={() => setPickerOpen(true)} />}

          <Text style={[typeScale.label, styles.label]}>Photos and videos (optional, up to {MAX_MEDIA})</Text>
          {existingVisual > 0 && (
            <Body variant="small" color={colors.inkSoft} style={styles.existing}>
              {existingVisual} already in the bottle
            </Body>
          )}
          <MediaTray
            assets={media.assets}
            preparing={media.preparing}
            progress={media.progress}
            disabled={sending || existingVisual + media.assets.length >= MAX_MEDIA}
            onPick={media.pick}
            onRemove={media.remove}
          />

          <Text style={[typeScale.label, styles.label]}>Voice notes (optional, up to {MAX_SEALED_VOICES}, 2 minutes each)</Text>
          {existingVoices > 0 && (
            <Body variant="small" color={colors.inkSoft} style={styles.existing}>
              {existingVoices} already in the bottle
            </Body>
          )}
          <VoiceNotesField
            voices={media.voices}
            onAdd={media.addVoice}
            onRemove={media.removeVoice}
            max={MAX_SEALED_VOICES}
            existingCount={existingVoices}
            maxSeconds={MAX_VOICE_SECONDS}
            recorderLabel={`Say something to ${ctx.partnerName}`}
            disabled={sending}
          />

          <Text style={[typeScale.label, styles.label]}>When should it arrive?</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {choices
              .filter((c) => !c.hidden)
              .map((c) => (
                <Chip key={c.value} label={c.label} selected={arrival === c.value} onPress={() => setArrival(c.value)} />
              ))}
          </View>

          {arrival === "openWhen" ? (
            <View style={styles.openWhen}>
              <Body variant="small" color={colors.inkSoft}>
                It waits in their jar — they open it whenever it fits.
              </Body>
              <View style={styles.chips}>
                {OPEN_WHEN_LABELS.map((l) => (
                  <Chip key={l} label={`Open when ${l}`} selected={openWhen === l} onPress={() => setOpenWhen(l)} />
                ))}
                <Chip label="Something else…" selected={openWhen === "custom"} onPress={() => setOpenWhen("custom")} />
              </View>
              {openWhen === "custom" && (
                <Input placeholder="you just got home" value={customLabel} onChangeText={setCustomLabel} maxLength={60} label="Open when…" />
              )}
            </View>
          ) : (
            when && (
              <Body variant="small" color={colors.inkSoft} style={styles.whenLine}>
                {arrival === "now"
                  ? "It washes up for them right away."
                  : `Arrives ${formatLongDate(when)} at ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
              </Body>
            )
          )}

          <Button
            title={editing ? "Save the bottle" : arrival === "openWhen" ? "Put it in the jar" : "Throw it to sea"}
            icon="bottle"
            onPress={send}
            loading={sending && !media.progress}
            disabled={sending || media.preparing}
            style={styles.send}
          />
          <Button title="Cancel" variant="text" onPress={() => router.back()} disabled={sending} />
        </ScrollView>
      </KeyboardAvoidingView>
      <SongPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onChoose={setSong} />
      {throwing && <BottleThrow toJar={throwing.toJar} onDone={() => router.back()} />}
    </ScreenBackground>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[typeScale.small, { color: selected ? colors.onDark : colors.inkOcean }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  header: { alignItems: "center", gap: space.xs, marginBottom: space.xl },
  message: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 28, minHeight: 180 },
  count: { textAlign: "right", marginTop: -space.sm },
  label: { color: colors.inkSoft, marginTop: space.xl, marginBottom: space.sm, marginLeft: space.xs },
  song: { marginLeft: space.xl },
  existing: { marginBottom: space.xs, marginLeft: space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipOn: { backgroundColor: colors.ocean },
  openWhen: { marginTop: space.lg, gap: space.md },
  whenLine: { marginTop: space.md, marginLeft: space.xs },
  send: { marginTop: space.xxl },
});
