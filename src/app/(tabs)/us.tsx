import { DateSheet } from "@/components/dates/DateSheet";
import { Beginning } from "@/components/moments/Beginning";
import { BucketList } from "@/components/us/BucketList";
import { Favorites } from "@/components/us/Favorites";
import { LittleThings } from "@/components/us/LittleThings";
import { OurYears } from "@/components/us/OurYears";
import { NotifyPromptCard } from "@/components/settings/NotifyPromptCard";
import { SectionHeading } from "@/components/us/SectionHeading";
import { StatsLedger } from "@/components/us/StatsLedger";
import { StoryPage } from "@/components/us/StoryPage";
import {
    ActionSheet,
    Avatar,
    Body,
    Button,
    ConfirmSheet,
    DatePickerField,
    formatLongDate,
    Handwritten,
    Icon3D,
    Input,
    PaperCard,
    PressableScale,
    ScreenBackground,
    Sheet,
    Title,
    toDateString,
    useTabBarClearance,
    WashiTape,
} from "@/components/ui";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getReceivedBottles, getSentBottles, takeBackBottle, type Bottle } from "@/lib/bottles";
import { getMyCouple } from "@/lib/couples";
import { countdownLabel, nextOccurrence, parseLocalDate } from "@/lib/dates";
import { getMyLatestGift, type Gift } from "@/lib/gifts";
import {
    birthdayOf,
    buildUpcoming,
    getImportantDates,
    saveBirthday,
    type ImportantDate,
} from "@/lib/importantDates";
import {
    dismissBirthdayPrompt,
    getWelcomeNotes,
    hasDismissedBirthdayPrompt,
    saveMyWelcomeNote,
    type WelcomeNote,
} from "@/lib/moments";
import { refreshCoupleProfiles, useCoupleProfiles } from "@/lib/profile";
import { colors, fonts, GUTTER, radius, shadows, space } from "@/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_NOTE = 500;

type UsData = {
  myId: string;
  coupleId: string;
  start: string;
  partnerId: string | null;
  myName: string | null;
  partnerName: string | null;
  notes: WelcomeNote[];
  dates: ImportantDate[];
  myGift: Gift | null;
  showBirthdayPrompt: boolean;
  received: Bottle[];
  sent: Bottle[];
};

// Us tab — scrapbook pages, one flowing into the next: Our beginning (date,
// replay intro, welcome notes) → How we met → Our dates (+ birthday surprise)
// → Our favorites → Little things → Bucket list → Our bottles → Our stats.
// Each newer section loads itself; `refreshKey` bumps on every focus.
export default function Us() {
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const [data, setData] = useState<UsData | null>(null);
  const [replay, setReplay] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateSheet, setDateSheet] = useState<{ open: boolean; editing: ImportantDate | null }>({ open: false, editing: null });
  const [promptDate, setPromptDate] = useState<Date | null>(null);
  const [sentMenu, setSentMenu] = useState<Bottle | null>(null);
  const [takeBack, setTakeBack] = useState<Bottle | null>(null);
  const [takingBack, setTakingBack] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const profiles = useCoupleProfiles();

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const couple = await getMyCouple();
      if (!couple) return;
      const partnerId = couple.partner_one === user.id ? couple.partner_two : couple.partner_one;
      const first = (n: string | null) => (n ? n.trim().split(/\s+/)[0] : null);
      const [myName, partnerName, notes, dates, myGift, dismissed, received, sent] = await Promise.all([
        getUserName(user.id),
        partnerId ? getUserName(partnerId) : Promise.resolve(null),
        getWelcomeNotes(couple.id),
        getImportantDates(couple.id),
        partnerId ? getMyLatestGift(couple.id, user.id).catch(() => null) : Promise.resolve(null),
        hasDismissedBirthdayPrompt(user.id),
        partnerId ? getReceivedBottles(couple.id, user.id).catch(() => []) : Promise.resolve([]),
        partnerId ? getSentBottles(couple.id, user.id).catch(() => []) : Promise.resolve([]),
      ]);
      setData({
        myId: user.id,
        coupleId: couple.id,
        start: couple.relationship_start,
        partnerId,
        myName: first(myName),
        partnerName: first(partnerName),
        notes,
        dates,
        myGift,
        // after pairing, if my birthday is missing — once
        showBirthdayPrompt: !!partnerId && !dismissed && !birthdayOf(dates, user.id),
        received,
        sent,
      });
    } catch (err: any) {
      console.log("[Us] load failed:", err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshCoupleProfiles();
      setRefreshKey((k) => k + 1);
    }, [load]),
  );

  if (!data) {
    return (
      <ScreenBackground aboveTabBar>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const partner = data.partnerName ?? "your person";
  const myNote = data.notes.find((n) => n.author_id === data.myId) ?? null;
  const theirNote = data.notes.find((n) => n.author_id !== data.myId) ?? null;
  const nameOf = (id: string) => (id === data.myId ? "You" : (data.partnerName ?? "Your partner"));
  const upcoming = buildUpcoming(data.start, data.dates, nameOf);
  const partnerBirthday = data.partnerId ? birthdayOf(data.dates, data.partnerId) : null;
  const gift = data.myGift;
  const giftPending = !!gift && !!gift.unlock_at && new Date(gift.unlock_at) > new Date();

  async function saveNote(note: string | null) {
    if (!data) return;
    setSaving(true);
    try {
      await saveMyWelcomeNote(data.coupleId, data.myId, note);
      setNoteOpen(false);
      await load();
    } catch (err: any) {
      setNoteOpen(false);
      setTimeout(() => Alert.alert("Couldn't save your note", err.message ?? String(err)), 350);
    } finally {
      setSaving(false);
    }
  }

  async function saveMyBirthday() {
    if (!data || !promptDate) return;
    try {
      await saveBirthday(data.coupleId, data.myId, toDateString(promptDate));
      await dismissBirthdayPrompt(data.myId);
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? String(err));
    }
  }

  return (
    <ScreenBackground padded={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: tabClearance }]}>
        <Title variant="titleItalic">Us</Title>

        {/* ---- one-time birthday prompt ---- */}
        {data.showBirthdayPrompt && (
          <PaperCard style={styles.prompt} tint={colors.sand}>
            <View style={styles.row}>
              <Icon3D name="cake" size={44} />
              <Title variant="headingItalic" style={styles.flex}>
                When's your birthday?
              </Title>
            </View>
            <Body variant="small" color={colors.inkSoft} style={styles.promptHint}>
              So {partner} never misses it.
            </Body>
            <DatePickerField value={promptDate} onChange={setPromptDate} placeholder="Pick your birthday" />
            <View style={styles.promptActions}>
              <Button
                title="Not now"
                variant="text"
                onPress={async () => {
                  await dismissBirthdayPrompt(data.myId);
                  setData({ ...data, showBirthdayPrompt: false });
                }}
              />
              <Button title="Save" onPress={saveMyBirthday} disabled={!promptDate} />
            </View>
          </PaperCard>
        )}

        {/* ---- Our beginning ---- */}
        <PaperCard style={styles.beginning}>
          <WashiTape color="sand" rotate={-4} style={styles.tape} />
          <View style={styles.row}>
            <View style={styles.pair}>
              <Avatar url={profiles.me?.avatarUrl} cacheKey={profiles.me?.avatarPath} name={profiles.me?.firstName} size={48} />
              {data.partnerId ? (
                <Avatar url={profiles.partner?.avatarUrl} cacheKey={profiles.partner?.avatarPath} name={profiles.partner?.firstName} size={48} style={styles.pairSecond} />
              ) : null}
            </View>
            <View style={styles.flex}>
              <Body variant="label" color={colors.inkSoft}>
                Our beginning
              </Body>
              <Title variant="headingItalic">{formatLongDate(parseLocalDate(data.start))}</Title>
            </View>
          </View>
          <Button title="Replay our beginning" variant="soft" icon="sparkles" onPress={() => setReplay(true)} style={styles.replay} />
        </PaperCard>

        {/* ---- welcome notes, one each ---- */}
        <View style={styles.section}>
          {theirNote && (
            <>
              <Body variant="label" color={colors.inkSoft}>
                {partner}'s note to you
              </Body>
              <View style={[styles.slip, styles.slipTheirs]}>
                <Handwritten>{theirNote.note}</Handwritten>
                <Handwritten variant="handSmall" color={colors.inkSoft} style={styles.signature}>
                  — {partner}
                </Handwritten>
              </View>
            </>
          )}
          {myNote ? (
            <>
              <Body variant="label" color={colors.inkSoft} style={theirNote ? styles.gapTop : undefined}>
                Your note to {partner}
              </Body>
              <View style={styles.slip}>
                <Handwritten>{myNote.note}</Handwritten>
              </View>
              <Button
                title="Edit your note"
                variant="text"
                onPress={() => {
                  setDraft(myNote.note);
                  setNoteOpen(true);
                }}
                style={styles.left}
              />
            </>
          ) : (
            <Button
              title={`Leave a note for ${partner}`}
              icon="loveLetter"
              variant="soft"
              onPress={() => {
                setDraft("");
                setNoteOpen(true);
              }}
              style={theirNote ? styles.gapTop : undefined}
            />
          )}
        </View>

        {/* ---- How we met ---- */}
        <SectionHeading icon="loveLetter" title="How we met" />
        <StoryPage coupleId={data.coupleId} refreshKey={refreshKey} nameOf={(id) => (id === data.myId ? "you" : id ? partner : "—")} />

        {/* ---- Our dates ---- */}
        <View>
          <SectionHeading icon="calendar" title="Our dates" action="Add" onAction={() => setDateSheet({ open: true, editing: null })} />
          {upcoming.map((u) => (
            <PressableScale
              key={u.key}
              onPress={() => u.source && setDateSheet({ open: true, editing: u.source })}
              disabled={!u.source}
              accessibilityRole={u.source ? "button" : undefined}
              accessibilityLabel={`${u.label}, ${formatLongDate(parseLocalDate(u.date))}, ${countdownLabel(u.days)}`}
              style={[styles.dateRow, u.days === 0 && styles.dateRowToday]}
            >
              <Icon3D name={u.icon} size={36} />
              <View style={styles.flex}>
                <Text style={styles.dateLabel} numberOfLines={1}>
                  {u.label}
                </Text>
                <Body variant="small" color={colors.inkSoft}>
                  {formatLongDate(parseLocalDate(u.date))}
                  {u.line ? ` · ${u.line}` : ""}
                </Body>
              </View>
              <Text style={[styles.countdown, u.days === 0 && styles.countdownToday]}>{countdownLabel(u.days)}</Text>
            </PressableScale>
          ))}
        </View>

        {/* ---- Our years (one per anniversary reached) ---- */}
        <OurYears coupleId={data.coupleId} myId={data.myId} start={data.start} partnerName={partner} refreshKey={refreshKey} />

        {/* ---- Birthday surprise (for my partner) ---- */}
        {data.partnerId && (
          <View>
            <SectionHeading icon="gift" title="A birthday surprise" />
            {!partnerBirthday ? (
              <Body color={colors.inkSoft} style={styles.gapTop}>
                Add {partner}'s birthday above to prepare a sealed surprise for their day.
              </Body>
            ) : (
              <PaperCard style={styles.giftCard}>
                <View style={styles.row}>
                  <Icon3D name="gift" size={48} />
                  <View style={styles.flex}>
                    {gift && giftPending ? (
                      <>
                        <Body variant="bodyStrong" color={colors.inkOcean}>
                          Sealed until {formatLongDate(new Date(gift.unlock_at!))}
                        </Body>
                        <Body variant="small" color={colors.inkSoft}>
                          {partner} can't see it until then.
                        </Body>
                      </>
                    ) : gift?.opened_at ? (
                      <>
                        <Body variant="bodyStrong" color={colors.inkOcean}>
                          Opened ❤️
                        </Body>
                        <Body variant="small" color={colors.inkSoft}>
                          {new Date(gift.opened_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </Body>
                      </>
                    ) : gift ? (
                      <Body variant="bodyStrong" color={colors.inkOcean}>
                        Unlocked — waiting for {partner} to open it
                      </Body>
                    ) : (
                      <Body color={colors.inkSoft}>
                        A letter, a song and photos, sealed until {formatLongDate(nextOccurrence(partnerBirthday.date))}.
                      </Body>
                    )}
                  </View>
                </View>
                {giftPending ? (
                  <Button title="Edit the surprise" variant="soft" onPress={() => router.push({ pathname: "/gift/prepare", params: { id: gift!.id } })} style={styles.replay} />
                ) : (
                  <Button title="Prepare a birthday surprise" icon="gift" onPress={() => router.push("/gift/prepare")} style={styles.replay} />
                )}
              </PaperCard>
            )}
          </View>
        )}
        {/* ---- Our favorites ---- */}
        <Favorites coupleId={data.coupleId} myId={data.myId} refreshKey={refreshKey} />

        {/* ---- Little things ---- */}
        <LittleThings
          coupleId={data.coupleId}
          myId={data.myId}
          partnerId={data.partnerId}
          me={profiles.me}
          partner={profiles.partner}
          partnerName={partner}
          refreshKey={refreshKey}
        />

        {/* ---- Bucket list ---- */}
        <BucketList coupleId={data.coupleId} myId={data.myId} refreshKey={refreshKey} />

        {/* ---- Our bottles ---- */}
        {data.partnerId && (data.received.length > 0 || data.sent.length > 0) && (
          <View>
            <SectionHeading icon="bottle" title="Our bottles" action="Write one" onAction={() => router.push("/bottle/write")} />
            {data.received.length > 0 && (
              <>
                <Body variant="label" color={colors.inkSoft} style={styles.gapTop}>
                  Received
                </Body>
                {data.received.map((b) => (
                  <BottleRow
                    key={b.id}
                    bottle={b}
                    title={b.kind === "open_when" ? `Open when ${b.open_when_label}` : firstLine(b.message)}
                    status={
                      b.kind === "open_when"
                        ? b.opened_at
                          ? `Opened ${formatLongDate(new Date(b.opened_at))}`
                          : "In your jar"
                        : b.opened_at
                          ? `Arrived ${formatLongDate(new Date(b.unlock_at ?? b.created_at))}`
                          : "Washed ashore — tap to open"
                    }
                    onPress={() => router.push({ pathname: "/bottle/[id]", params: { id: b.id } })}
                  />
                ))}
              </>
            )}
            {data.sent.length > 0 && <NotifyPromptCard partnerName={partner} style={styles.gapTop} />}
            {data.sent.length > 0 && (
              <>
                <Body variant="label" color={colors.inkSoft} style={styles.gapTop}>
                  Sent
                </Body>
                {data.sent.map((b) => (
                  <BottleRow
                    key={b.id}
                    bottle={b}
                    title={b.kind === "open_when" ? `Open when ${b.open_when_label}` : firstLine(b.message)}
                    status={
                      b.opened_at
                        ? `Opened ❤️ ${formatLongDate(new Date(b.opened_at))}`
                        : b.kind === "open_when"
                          ? "Waiting in the jar"
                          : b.unlock_at && new Date(b.unlock_at) > new Date()
                            ? `Arrives ${formatLongDate(new Date(b.unlock_at))}`
                            : "Washed ashore"
                    }
                    onPress={() =>
                      b.opened_at ? router.push({ pathname: "/bottle/[id]", params: { id: b.id } }) : setSentMenu(b)
                    }
                  />
                ))}
              </>
            )}
          </View>
        )}

        {/* ---- Our stats ---- */}
        <StatsLedger coupleId={data.coupleId} myId={data.myId} start={data.start} myName={data.myName ?? "you"} partnerName={partner} refreshKey={refreshKey} />
      </ScrollView>

      <Sheet visible={noteOpen} onClose={() => (saving ? null : setNoteOpen(false))}>
        <Title variant="heading">A note for {partner}</Title>
        <Body variant="small" color={colors.inkSoft} style={styles.sheetHint}>
          {partner} will see it on a paper slip in "It all started here".
        </Body>
        <Input value={draft} onChangeText={setDraft} placeholder="Something only they should read…" multiline maxLength={MAX_NOTE} autoFocus style={styles.noteInput} />
        <Body variant="small" color={colors.inkFaint} style={styles.count}>
          {draft.length}/{MAX_NOTE}
        </Body>
        <Button title="Save note" onPress={() => saveNote(draft.trim() || null)} loading={saving} disabled={!draft.trim()} />
        {myNote && <Button title="Remove note" variant="text" onPress={() => saveNote(null)} disabled={saving} />}
      </Sheet>

      <ActionSheet
        visible={!!sentMenu}
        onClose={() => setSentMenu(null)}
        actions={
          sentMenu
            ? [
                { label: "Read it", icon: "bottle", onPress: () => router.push({ pathname: "/bottle/[id]", params: { id: sentMenu.id } }) },
                { label: "Edit", icon: "loveLetter", onPress: () => router.push({ pathname: "/bottle/write", params: { id: sentMenu.id } }) },
                { label: "Take it back", icon: "wave", destructive: true, onPress: () => setTakeBack(sentMenu) },
              ]
            : []
        }
      />

      <ConfirmSheet
        visible={!!takeBack}
        title="Take this bottle back?"
        message={`${partner} will never see it. Its photos go too.`}
        confirmLabel="Take it back"
        cancelLabel="Keep it"
        busy={takingBack}
        onCancel={() => setTakeBack(null)}
        onConfirm={async () => {
          if (!takeBack) return;
          setTakingBack(true);
          try {
            await takeBackBottle(takeBack);
            setTakeBack(null);
            await load();
          } catch (err: any) {
            setTakeBack(null);
            setTimeout(() => Alert.alert("Couldn't take it back", err.message ?? String(err)), 350);
          } finally {
            setTakingBack(false);
          }
        }}
      />

      <DateSheet
        visible={dateSheet.open}
        onClose={() => setDateSheet({ open: false, editing: null })}
        onSaved={load}
        coupleId={data.coupleId}
        myId={data.myId}
        partnerId={data.partnerId}
        partnerName={partner}
        dates={data.dates}
        editing={dateSheet.editing}
      />

      <Modal visible={replay} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setReplay(false)}>
        {replay && (
          <Beginning relationshipStart={data.start} note={theirNote?.note ?? null} noteFrom={data.partnerName} onDone={() => setReplay(false)} />
        )}
      </Modal>
    </ScreenBackground>
  );
}

function firstLine(s: string) {
  const line = s.split("\n").find((l) => l.trim())?.trim() ?? "";
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

function BottleRow({ bottle, title, status, onPress }: { bottle: Bottle; title: string; status: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${status}`} style={styles.dateRow}>
      <Icon3D name={bottle.kind === "open_when" ? "loveLetter" : "bottle"} size={32} />
      <View style={styles.flex}>
        <Text style={styles.dateLabel} numberOfLines={1}>
          {title}
        </Text>
        <Body variant="small" color={colors.inkSoft}>
          {status}
        </Body>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  pair: { flexDirection: "row" },
  pairSecond: { marginLeft: -14 },
  prompt: { marginTop: space.xl, padding: space.xl, transform: [{ rotate: "0.6deg" }] },
  promptHint: { marginTop: space.xs, marginBottom: space.md },
  promptActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  beginning: { marginTop: space.xl, padding: space.xl, transform: [{ rotate: "-0.6deg" }] },
  tape: { position: "absolute", top: -10, left: space.xl },
  replay: { marginTop: space.lg },
  section: { marginTop: space.xxl, gap: space.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gapTop: { marginTop: space.md },
  slip: {
    backgroundColor: colors.warmWhite,
    padding: space.lg,
    borderRadius: radius.photo,
    transform: [{ rotate: "1deg" }],
    ...shadows.lifted,
  },
  slipTheirs: { backgroundColor: colors.sand, transform: [{ rotate: "-1deg" }] },
  signature: { textAlign: "right", marginTop: space.xs },
  left: { alignSelf: "flex-start", paddingHorizontal: 0 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperEdge,
  },
  dateRowToday: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, paddingHorizontal: space.sm, borderBottomWidth: 0 },
  dateLabel: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  countdown: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ocean },
  countdownToday: { color: colors.coral },
  giftCard: { marginTop: space.md, padding: space.xl },
  sheetHint: { marginTop: space.xs, marginBottom: space.md },
  noteInput: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26, minHeight: 120 },
  count: { textAlign: "right", marginTop: -space.sm, marginBottom: space.md },
});
