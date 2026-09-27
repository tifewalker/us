import { Body, EmptyState, formatLongDate, Handwritten, Icon3D, PressableScale, ScreenBackground, seededTilt, Title } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getReceivedBottles, openWhenNotes, type Bottle } from "@/lib/bottles";
import { getMyCouple } from "@/lib/couples";
import { colors, GUTTER, radius, shadows, space } from "@/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The open-when jar: folded notes labelled "Open when {label}". Opening one
// plays the unroll moment (bottle/[id]); opened notes stay readable, dated.
export default function Jar() {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Bottle[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const user = await getCurrentUser();
          const couple = await getMyCouple();
          if (!couple) return setNotes([]);
          setNotes(openWhenNotes(await getReceivedBottles(couple.id, user.id)));
        } catch (err: any) {
          console.log("[Jar] load failed:", err.message);
          setNotes([]);
        }
      })();
    }, []),
  );

  return (
    <ScreenBackground padded={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </PressableScale>
        <View style={styles.header}>
          <Icon3D name="loveLetter" size={64} />
          <Title variant="titleItalic" center>
            The open-when jar
          </Title>
          <Body color={colors.inkSoft} center>
            Open one whenever it fits.
          </Body>
        </View>

        {notes === null ? (
          <ActivityIndicator color={colors.coral} />
        ) : notes.length === 0 ? (
          <EmptyState icon="loveLetter" message="Nothing in the jar yet." />
        ) : (
          <View style={styles.grid}>
            {notes.map((n) => (
              <PressableScale
                key={n.id}
                onPress={() => router.push({ pathname: "/bottle/[id]", params: { id: n.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Open when ${n.open_when_label}${n.opened_at ? ", opened" : ""}`}
                style={[styles.note, n.opened_at && styles.noteOpened, { transform: [{ rotate: `${seededTilt(n.id, 4)}deg` }] }]}
              >
                <View style={styles.fold} />
                <Handwritten variant="handSmall" center>
                  Open when {n.open_when_label}
                </Handwritten>
                {n.opened_at ? (
                  <Body variant="small" color={colors.inkSoft} center style={styles.opened}>
                    Opened {formatLongDate(new Date(n.opened_at))}
                  </Body>
                ) : null}
              </PressableScale>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.warmWhite, alignItems: "center", justifyContent: "center", ...shadows.lifted },
  backText: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
  header: { alignItems: "center", gap: space.xs, marginVertical: space.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.lg, justifyContent: "center" },
  note: {
    width: 150,
    minHeight: 110,
    backgroundColor: colors.sand,
    borderRadius: radius.paper,
    padding: space.md,
    justifyContent: "center",
    ...shadows.paper,
  },
  noteOpened: { backgroundColor: colors.warmWhite },
  fold: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderLeftWidth: 18,
    borderBottomWidth: 18,
    borderLeftColor: "transparent",
    borderBottomColor: colors.paperEdge,
  },
  opened: { marginTop: space.xs },
});
