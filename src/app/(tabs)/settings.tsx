import {
  Body,
  Button,
  Handwritten,
  Icon3D,
  PaperCard,
  PressableScale,
  ScreenBackground,
  Title,
  useTabBarClearance,
  WashiTape,
  type Icon3DName,
} from "@/components/ui";
import { getCurrentUser, getUserName, signOut } from "@/lib/auth";
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
  const [myName, setMyName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [together, setTogether] = useState<string | null>(null);
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
        setMyName(await getUserName(user.id));

        const couple = await getMyCouple();
        if (couple) {
          setTogether(formatDate(couple.relationship_start));
          const partnerId =
            couple.partner_one === user.id
              ? couple.partner_two
              : couple.partner_one;
          if (partnerId) setPartnerName(await getUserName(partnerId));
        }
      } catch (err: any) {
        console.log("[Settings] load FAILED:", err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
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
          <Person icon="sparkles" label="You" name={myName} detail={email} />
          <View style={styles.divider} />
          <Person icon="heart" label="Your person" name={partnerName} />
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

        <Button
          title="Sign out"
          variant="soft"
          onPress={handleSignOut}
          loading={signingOut}
          style={styles.signOut}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

function Person({
  icon,
  label,
  name,
  detail,
}: {
  icon: Icon3DName;
  label: string;
  name: string | null;
  detail?: string | null;
}) {
  return (
    <View style={styles.person}>
      <Icon3D name={icon} size={40} />
      <View style={styles.flex}>
        <Body variant="label" color={colors.inkSoft}>
          {label}
        </Body>
        <Handwritten>{name ?? "—"}</Handwritten>
        {detail ? (
          <Body variant="small" color={colors.inkSoft}>
            {detail}
          </Body>
        ) : null}
      </View>
    </View>
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
});
