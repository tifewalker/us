import {
  ActionSheet,
  Avatar,
  Body,
  Button,
  Input,
  Sheet,
  Handwritten,
  Icon3D,
  PaperCard,
  PressableScale,
  ScreenBackground,
  Title,
  useTabBarClearance,
  WashiTape,
} from "@/components/ui";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { clearSignedCache } from "@/lib/signedUrls";
import { getCurrentUser, signOut } from "@/lib/auth";
import {
  DELETE_WORLD_PHRASE,
  deleteWorld,
  pickAndUploadAvatar,
  refreshCoupleProfiles,
  removeAvatar,
  resetCoupleProfiles,
  updateMyName,
  useCoupleProfiles,
} from "@/lib/profile";
import { getMyCouple } from "@/lib/couples";
import {
  getOpenInPreference,
  PLATFORM_LABELS,
  setOpenInPreference,
  type MusicPlatform,
} from "@/lib/music";
import { colors, GUTTER, radius, space, type as typeScale } from "@/theme";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// relationship_start is a 'YYYY-MM-DD' date column. Parse the parts directly
// rather than via new Date(), which treats it as UTC midnight and can shift
// the day back by one in timezones behind UTC.
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [together, setTogether] = useState<string | null>(null);
  const [ids, setIds] = useState<{ myId: string; coupleId: string | null } | null>(null);
  const profiles = useCoupleProfiles();
  const myName = profiles.me?.name ?? null;
  const partnerName = profiles.partner?.name ?? null;
  // profile editing
  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  // delete our world: step 1 explains, step 2 asks for the phrase
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [phrase, setPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [openIn, setOpenIn] = useState<MusicPlatform>("spotify");

  useEffect(() => {
    getOpenInPreference().then(setOpenIn);
  }, []);

  function chooseOpenIn(p: MusicPlatform) {
    setOpenIn(p);
    setOpenInPreference(p);
  }

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        setEmail(user.email ?? null);
        const couple = await getMyCouple();
        setIds({ myId: user.id, coupleId: couple?.id ?? null });
        if (couple) setTogether(formatDate(couple.relationship_start));
        await refreshCoupleProfiles();
      } catch (err: any) {
        console.log("[Settings] load FAILED:", err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function changePhoto() {
    if (!ids?.coupleId) return Alert.alert("Not yet", "Your photo lives in your world — pair up first.");
    setPhotoBusy(true);
    try {
      await pickAndUploadAvatar(ids.coupleId, ids.myId, profiles.me?.avatarPath ?? null);
    } catch (err: any) {
      Alert.alert("Couldn't change your photo", err.message ?? String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function dropPhoto() {
    if (!ids || !profiles.me?.avatarPath) return;
    setPhotoBusy(true);
    try {
      await removeAvatar(ids.myId, profiles.me.avatarPath);
    } catch (err: any) {
      Alert.alert("Couldn't remove your photo", err.message ?? String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveName() {
    if (!ids) return;
    setNameBusy(true);
    try {
      await updateMyName(ids.myId, nameDraft);
      setNameOpen(false);
    } catch (err: any) {
      Alert.alert("Couldn't save your name", err.message ?? String(err));
    } finally {
      setNameBusy(false);
    }
  }

  async function confirmDeleteWorld() {
    if (!ids?.coupleId) return;
    setDeleting(true);
    try {
      const result = await deleteWorld(ids.coupleId);
      setDeleteStep(0);
      resetCoupleProfiles();
      clearSignedCache();
      await signOut().catch(() => {});
      router.replace("/welcome");
      setTimeout(
        () =>
          Alert.alert(
            "Your world was deleted",
            `${result.memories} memories, ${result.bottles_and_gifts} bottles and gifts and ${result.files} files are gone. Your account is still here — sign in any time to start again.`,
          ),
        500,
      );
    } catch (err: any) {
      setDeleting(false);
      Alert.alert("Nothing was deleted", err.message ?? String(err));
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      resetCoupleProfiles();
      clearSignedCache();
      await signOut();
      // The (tabs) guard also redirects once the session clears, so this
      // is belt-and-braces; it won't bounce back because session is now null.
      router.replace("/welcome");
    } catch (err: any) {
      Alert.alert("Couldn't sign out", err.message ?? String(err));
      setSigningOut(false);
    }
  }

  if (loading) {
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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xl, paddingBottom: tabClearance },
        ]}
      >
        <Title variant="titleItalic">Settings</Title>

        <PaperCard style={styles.pair}>
          <WashiTape color="coral" rotate={-5} style={styles.tape} />
          <View style={styles.person}>
            <PressableScale onPress={() => setPhotoMenu(true)} disabled={photoBusy} accessibilityRole="button" accessibilityLabel="Change your photo">
              <Avatar url={profiles.me?.avatarUrl} cacheKey={profiles.me?.avatarPath} name={myName} size={64} />
              {photoBusy ? <ActivityIndicator color={colors.coral} style={StyleSheet.absoluteFill} /> : null}
            </PressableScale>
            <View style={styles.flex}>
              <Body variant="label" color={colors.inkSoft}>
                You
              </Body>
              <Handwritten>{myName ?? "—"}</Handwritten>
              {email ? (
                <Body variant="small" color={colors.inkSoft}>
                  {email}
                </Body>
              ) : null}
              <Button
                title="Edit name"
                variant="text"
                onPress={() => {
                  setNameDraft(myName ?? "");
                  setNameOpen(true);
                }}
                style={styles.editName}
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.person}>
            {profiles.partner ? (
              <Avatar url={profiles.partner.avatarUrl} cacheKey={profiles.partner.avatarPath} name={partnerName} size={64} />
            ) : (
              <Icon3D name="heart" size={40} />
            )}
            <View style={styles.flex}>
              <Body variant="label" color={colors.inkSoft}>
                Your person
              </Body>
              <Handwritten>{partnerName ?? "—"}</Handwritten>
            </View>
          </View>
        </PaperCard>

        <View style={styles.together}>
          <Icon3D name="calendar" size={44} />
          <View style={styles.flex}>
            <Body variant="label" color={colors.inkSoft}>
              Together since
            </Body>
            <Title variant="headingItalic">{together ?? "—"}</Title>
          </View>
        </View>

        <View style={styles.music}>
          <View style={styles.musicHeader}>
            <Icon3D name="headphone" size={36} />
            <View style={styles.flex}>
              <Body variant="label" color={colors.inkSoft}>
                Open songs in
              </Body>
              <Body variant="small" color={colors.inkSoft}>
                Where "Open full song" takes you, on this phone.
              </Body>
            </View>
          </View>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(Object.keys(PLATFORM_LABELS) as MusicPlatform[]).map((p) => (
              <PressableScale
                key={p}
                onPress={() => chooseOpenIn(p)}
                accessibilityRole="radio"
                accessibilityState={{ selected: openIn === p }}
                accessibilityLabel={PLATFORM_LABELS[p]}
                style={[styles.chip, openIn === p && styles.chipOn]}
              >
                <Text style={[typeScale.small, { color: openIn === p ? colors.onDark : colors.inkOcean }]}>
                  {PLATFORM_LABELS[p]}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {ids ? <NotificationsSection userId={ids.myId} partnerName={partnerName?.split(" ")[0] ?? "your person"} /> : null}

        <Button
          title="Sign out"
          variant="soft"
          onPress={handleSignOut}
          loading={signingOut}
          style={styles.signOut}
        />

        {ids?.coupleId ? (
          <PressableScale onPress={() => setDeleteStep(1)} accessibilityRole="button" accessibilityLabel="Delete our world" style={styles.deleteLink}>
            <Text style={[typeScale.button, styles.deleteText]}>Delete our world</Text>
          </PressableScale>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={photoMenu}
        onClose={() => setPhotoMenu(false)}
        actions={[
          { label: profiles.me?.avatarPath ? "Choose a new photo" : "Add a photo", icon: "camera", onPress: changePhoto },
          ...(profiles.me?.avatarPath ? [{ label: "Remove photo", icon: "wave" as const, destructive: true, onPress: dropPhoto }] : []),
        ]}
      />

      <Sheet visible={nameOpen} onClose={() => (nameBusy ? null : setNameOpen(false))}>
        <Title variant="heading">Your name</Title>
        <Body variant="small" color={colors.inkSoft} style={styles.sheetHint}>
          What {partnerName ? partnerName.split(" ")[0] : "your person"} sees everywhere in Us.
        </Body>
        <Input value={nameDraft} onChangeText={setNameDraft} maxLength={60} autoFocus placeholder="Your name" />
        <Button title="Save" onPress={saveName} loading={nameBusy} disabled={!nameDraft.trim()} style={styles.sheetButton} />
      </Sheet>

      {/* Delete our world — step 1: what goes */}
      <Sheet visible={deleteStep === 1} onClose={() => setDeleteStep(0)}>
        <Title variant="heading">Delete our world?</Title>
        <Body color={colors.inkSoft} style={styles.sheetHint}>
          This deletes everything the two of you have made in Us — for both of you, forever:
        </Body>
        {[
          "every memory, with all its photos, videos and voice notes",
          "every bottle, open-when note and birthday gift",
          "every answer: daily moments, questions, missions, spins",
          "songs of the day, Two perspectives, Remember when",
          "your story, dates, favorites, little things and bucket list",
          "your welcome notes and profile photos",
        ].map((line) => (
          <Body key={line} style={styles.bullet}>
            •  {line}
          </Body>
        ))}
        <Body variant="small" color={colors.inkSoft} style={styles.sheetHint}>
          Your accounts stay — you can both still sign in, to an empty app. There's no undo.
        </Body>
        <PressableScale
          onPress={() => {
            setDeleteStep(0);
            setPhrase("");
            setTimeout(() => setDeleteStep(2), 350);
          }}
          accessibilityRole="button"
          style={styles.dangerButton}
        >
          <Text style={[typeScale.button, styles.dangerButtonText]}>I understand — continue</Text>
        </PressableScale>
        <Button title="Keep everything" variant="text" onPress={() => setDeleteStep(0)} />
      </Sheet>

      {/* step 2: type the phrase */}
      <Sheet visible={deleteStep === 2} onClose={() => (deleting ? null : setDeleteStep(0))}>
        <Title variant="heading">Type “{DELETE_WORLD_PHRASE}”</Title>
        <Body variant="small" color={colors.inkSoft} style={styles.sheetHint}>
          To be sure it's really you, and really meant.
        </Body>
        <Input value={phrase} onChangeText={setPhrase} autoCapitalize="none" autoCorrect={false} placeholder={DELETE_WORLD_PHRASE} editable={!deleting} />
        <PressableScale
          onPress={confirmDeleteWorld}
          disabled={deleting || phrase.trim().toLowerCase() !== DELETE_WORLD_PHRASE}
          accessibilityRole="button"
          accessibilityState={{ disabled: deleting || phrase.trim().toLowerCase() !== DELETE_WORLD_PHRASE }}
          style={[styles.dangerButton, phrase.trim().toLowerCase() !== DELETE_WORLD_PHRASE && styles.dangerOff]}
        >
          {deleting ? <ActivityIndicator color={colors.onDark} /> : <Text style={[typeScale.button, styles.dangerButtonText]}>Delete our world</Text>}
        </PressableScale>
        <Button title="Cancel" variant="text" onPress={() => setDeleteStep(0)} disabled={deleting} />
      </Sheet>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  flex: { flex: 1 },
  pair: { marginTop: space.xl, padding: space.xl, transform: [{ rotate: "-0.8deg" }] },
  tape: { position: "absolute", top: -10, alignSelf: "center" },
  person: { flexDirection: "row", alignItems: "center", gap: space.lg },
  divider: {
    height: 1,
    backgroundColor: colors.paperEdge,
    marginVertical: space.lg,
  },
  together: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.xxl,
    paddingHorizontal: space.sm,
  },
  music: { marginTop: space.xxl, paddingHorizontal: space.sm },
  musicHeader: { flexDirection: "row", alignItems: "center", gap: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.paperDeep,
  },
  chipOn: { backgroundColor: colors.ocean },
  signOut: { marginTop: space.xxxl, alignSelf: "center", minWidth: 180 },
  editName: { alignSelf: "flex-start", paddingHorizontal: 0, minHeight: 32, marginTop: space.xs },
  deleteLink: { alignSelf: "center", marginTop: space.xxl, padding: space.md },
  deleteText: { color: colors.danger },
  sheetHint: { marginTop: space.xs, marginBottom: space.md },
  sheetButton: { marginTop: space.md },
  bullet: { marginBottom: space.xs },
  dangerButton: { backgroundColor: colors.danger, borderRadius: radius.pill, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: space.md },
  dangerOff: { opacity: 0.4 },
  dangerButtonText: { color: colors.onDark },
});
