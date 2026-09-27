import { SongCard } from "@/components/music/SongCard";
import { SongPicker } from "@/components/music/SongPicker";
import { usePreviewStopOnBlur } from "@/components/music/usePreviewStopOnBlur";
import {
    Body,
    Button,
    EmptyState,
    formatLongDate,
    Handwritten,
    Icon3D,
    Input,
    PaperCard,
    PressableScale,
    ScreenBackground,
    Title,
    WashiTape,
} from "@/components/ui";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { togglePreview, usePreviewState, type Song } from "@/lib/music";
import { getPastSongs, getTodaySong, markListened, pickTodaySong, type DailySong } from "@/lib/songs";
import { colors, fonts, GUTTER, radius, shadows, space, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Our song today": one song per couple per day. Either partner can pick;
// the first pick wins. Then each of you taps "I listened 🎧".
export default function OurSongToday() {
  const insets = useSafeAreaInsets();
  usePreviewStopOnBlur();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; coupleId: string; partnerJoined: boolean } | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [today, setToday] = useState<DailySong | null>(null);
  const [past, setPast] = useState<DailySong[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosen, setChosen] = useState<Song | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const couple = await getMyCouple();
      if (!couple) throw new Error("Couldn't find your world.");
      const partnerId = couple.partner_one === user.id ? couple.partner_two : couple.partner_one;
      setMe({ id: user.id, coupleId: couple.id, partnerJoined: !!couple.partner_two });
      const [myName, partnerName, todaySong, pastSongs] = await Promise.all([
        getUserName(user.id),
        partnerId ? getUserName(partnerId) : Promise.resolve(null),
        couple.partner_two ? getTodaySong(couple.id) : Promise.resolve(null),
        getPastSongs(couple.id),
      ]);
      const n: Record<string, string> = {};
      if (myName) n[user.id] = myName.trim().split(/\s+/)[0];
      if (partnerId && partnerName) n[partnerId] = partnerName.trim().split(/\s+/)[0];
      setNames(n);
      setToday(todaySong);
      setPast(pastSongs);
    } catch (err: any) {
      Alert.alert("Something went wrong", err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function send() {
    if (!me || !chosen) return;
    setSending(true);
    try {
      const { song, wonRace } = await pickTodaySong(me.coupleId, me.id, chosen, note.trim() || null);
      setToday(song);
      setChosen(null);
      setNote("");
      if (!wonRace) {
        Alert.alert("Your partner beat you to it", "They picked today's song just before you — here it is.");
      }
    } catch (err: any) {
      Alert.alert("Couldn't send the song", err.message ?? String(err));
    } finally {
      setSending(false);
    }
  }

  async function listened() {
    if (!me || !today) return;
    setMarking(true);
    try {
      await markListened(today.id, me.id);
      setToday((await getTodaySong(me.coupleId)) ?? today);
    } catch (err: any) {
      Alert.alert("Couldn't save that", err.message ?? String(err));
    } finally {
      setMarking(false);
    }
  }

  const nameOf = (id: string) => (me && id === me.id ? "You" : (names[id] ?? "Your partner"));

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const iListened = !!(me && today?.listens.some((l) => l.user_id === me.id));

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </PressableScale>

          <View style={styles.header}>
            <Icon3D name="radio" size={64} />
            <Title variant="titleItalic" center>
              Our song today
            </Title>
            <Body variant="small" color={colors.inkSoft} center>
              {formatLongDate(new Date())}
            </Body>
          </View>

          {!me?.partnerJoined ? (
            <EmptyState icon="wave" message="This opens once your partner joins 🌊" />
          ) : today ? (
            <>
              <SongCard song={today.song} style={styles.card} />
              <Body variant="small" color={colors.inkSoft} style={styles.pickedBy}>
                Picked by {nameOf(today.picked_by)}
              </Body>
              {today.note ? (
                <PaperCard style={styles.note}>
                  <WashiTape color="coral" rotate={-4} style={styles.noteTape} />
                  <Handwritten>{today.note}</Handwritten>
                </PaperCard>
              ) : null}

              <View style={styles.listens}>
                {today.listens.length === 0 ? (
                  <Body color={colors.inkSoft}>Nobody's listened yet.</Body>
                ) : (
                  today.listens.map((l) => (
                    <View key={l.user_id} style={styles.listenRow}>
                      <Icon3D name="headphone" size={24} />
                      <Body variant="bodyStrong" color={colors.inkOcean}>
                        {nameOf(l.user_id)} listened
                      </Body>
                    </View>
                  ))
                )}
              </View>

              {!iListened && <Button title="I listened 🎧" onPress={listened} loading={marking} style={styles.cta} />}
              {today.listens.length >= 2 && (
                <Title variant="headingItalic" color={colors.coral} center style={styles.both}>
                  You both listened ❤️
                </Title>
              )}
            </>
          ) : (
            <>
              <Body color={colors.inkSoft} center style={styles.lead}>
                Nobody's picked today's song yet. Send one your way.
              </Body>
              {chosen ? (
                <SongCard song={chosen} onRemove={() => setChosen(null)} style={styles.card} />
              ) : (
                <Button title="Pick a song" icon="musicalNotes" variant="soft" onPress={() => setPickerOpen(true)} style={styles.pick} />
              )}
              <Input
                label="A little note (optional)"
                placeholder="Why this one…"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={280}
                style={styles.noteInput}
              />
              <Button title="Send our song" icon="heart" onPress={send} loading={sending} disabled={!chosen} />
            </>
          )}

          {past.length > 0 && (
            <View style={styles.past}>
              <Title variant="headingItalic" color={colors.inkSoft}>
                Past songs
              </Title>
              {past.map((d) => (
                <PastSongRow key={d.id} day={d} pickedBy={nameOf(d.picked_by)} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SongPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onChoose={setChosen} />
    </ScreenBackground>
  );
}

function PastSongRow({ day, pickedBy }: { day: DailySong; pickedBy: string }) {
  const preview = usePreviewState();
  const playing = preview.songId === day.song.itunesId && preview.playing;
  return (
    <View style={styles.pastRow}>
      {day.song.artworkUrl ? (
        <Image source={{ uri: day.song.artworkUrl }} style={styles.pastArt} contentFit="cover" />
      ) : (
        <View style={[styles.pastArt, { backgroundColor: colors.paperDeep }]} />
      )}
      <View style={styles.flex}>
        <Text style={[typeScale.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
          {day.song.title}
        </Text>
        <Text style={[typeScale.small, { color: colors.inkSoft }]} numberOfLines={1}>
          {day.song.artist} · {formatLongDate(parseDate(day.song_date))} · {pickedBy}
        </Text>
        {day.note ? (
          <Handwritten variant="handSmall" numberOfLines={1}>
            {day.note}
          </Handwritten>
        ) : null}
      </View>
      {day.song.previewUrl ? (
        <PressableScale
          onPress={() => togglePreview(day.song)}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause preview" : `Play preview of ${day.song.title}`}
          style={[styles.pastPlay, playing && styles.pastPlayOn]}
        >
          <Text style={[typeScale.button, { fontSize: 13, color: playing ? colors.onDark : colors.ocean }]}>
            {playing ? "❚❚" : "▶"}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.warmWhite,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lifted,
  },
  backText: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
  header: { alignItems: "center", gap: space.xs, marginTop: space.md, marginBottom: space.xl },
  lead: { marginBottom: space.lg },
  card: { marginLeft: space.xl },
  pick: { marginBottom: space.lg },
  pickedBy: { marginTop: space.sm, textAlign: "right" },
  note: { marginTop: space.lg, padding: space.xl, transform: [{ rotate: "-0.8deg" }] },
  noteTape: { position: "absolute", top: -10, left: space.xl },
  noteInput: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26, minHeight: 90, marginTop: space.lg },
  listens: { marginTop: space.xl, gap: space.sm },
  listenRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cta: { marginTop: space.xl },
  both: { marginTop: space.xl },
  past: { marginTop: space.xxxl, gap: space.md },
  pastRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  pastArt: { width: 48, height: 48, borderRadius: radius.photo },
  pastPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.ocean,
    alignItems: "center",
    justifyContent: "center",
  },
  pastPlayOn: { backgroundColor: colors.ocean },
});
