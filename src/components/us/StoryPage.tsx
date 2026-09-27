import { Body, Handwritten, PaperCard, Polaroid, PressableScale, Title, WashiTape } from "@/components/ui";
import { signPaths } from "@/lib/memories";
import { getStory, type Story } from "@/lib/us";
import { colors, space } from "@/theme";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

// "How we met": a paper page, the story in Nunito, an optional taped polaroid
// at the top. Tapping the page opens the editor (app/us/story.tsx).
export function StoryPage({ coupleId, refreshKey, nameOf }: { coupleId: string; refreshKey: number; nameOf: (id: string | null) => string }) {
  const { width } = useWindowDimensions();
  const [story, setStory] = useState<Story | null | undefined>(undefined);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getStory(coupleId)
      .then(async (s) => {
        if (!alive) return;
        setStory(s);
        if (s?.photo_path) {
          const urls = await signPaths([s.photo_path]).catch(() => ({}) as Record<string, string>);
          if (alive) setPhotoUrl(urls[s.photo_path] ?? null);
        } else setPhotoUrl(null);
      })
      .catch(() => alive && setStory(null));
    return () => {
      alive = false;
    };
  }, [coupleId, refreshKey]);

  const empty = !story || (!story.story.trim() && !story.photo_path);
  return (
    <PressableScale onPress={() => router.push("/us/story")} accessibilityRole="button" accessibilityLabel={empty ? "Write how you met" : "How we met. Edit"} scaleTo={0.99}>
      <PaperCard style={styles.page}>
        {story?.photo_path ? (
          <View style={styles.photoWrap}>
            <Polaroid seed={story.photo_path} uri={photoUrl} cacheKey={story.photo_path} width={Math.min(width * 0.5, 220)} tape="sky" />
          </View>
        ) : (
          <WashiTape color="coral" rotate={3} style={styles.tape} />
        )}
        <Title variant="heading">How we met</Title>
        {empty ? (
          <Handwritten color={colors.inkSoft} style={styles.gap}>
            Tap to write it down — where, when, who spoke first…
          </Handwritten>
        ) : (
          <>
            {story!.story.trim() ? (
              <Body variant="bodyLarge" style={styles.gap} numberOfLines={12}>
                {story!.story}
              </Body>
            ) : null}
            <Body variant="small" color={colors.inkFaint} style={styles.gap}>
              Last edited by {nameOf(story!.updated_by)}
            </Body>
          </>
        )}
      </PaperCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, paddingTop: space.xl, transform: [{ rotate: "0.5deg" }] },
  photoWrap: { alignItems: "center", marginTop: -space.xxl, marginBottom: space.lg },
  tape: { position: "absolute", top: -10, right: space.xl },
  gap: { marginTop: space.sm },
});
