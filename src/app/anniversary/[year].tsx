import { NextChapter, Note } from "@/components/anniversary/NextChapter";
import { YearStone } from "@/components/beach/Anniversary";
import { ProgressBars, TapZones, useStoryClock, useSwipeDown } from "@/components/reel/StoryEngine";
import { Body, Button, Handwritten, PaperTexture, Polaroid, Title } from "@/components/ui";
import { Tally } from "@/components/us/StatsLedger";
import { anniversaryStatus, monthName, recapWindow, recordRecapView } from "@/lib/anniversary";
import { getCurrentUser } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { parseLocalDate, startOfToday } from "@/lib/dates";
import { stopPreview } from "@/lib/music";
import { getProfiles } from "@/lib/profile";
import { buildRecap, type Recap, type RecapHighlight, type RecapPhoto } from "@/lib/recap";
import { anniversarySky, colors, fonts, radius, shadows, space } from "@/theme";
import { useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Ctx = { coupleId: string; myId: string; myName: string; partnerName: string; start: string };
type Page = { key: string; duration: number; render: (current: boolean, paused: boolean) => ReactNode; dark?: boolean };

// "Our year" (/anniversary/<N>, or /anniversary/preview for the dev preview
// of the last 12 months). A story built on the reel's engine: progress bars,
// tap left/right, hold to pause, swipe down to close, "Tap to begin" on web
// (sound needs a tap). Pages with no data are skipped. ?page=answer jumps
// straight to "Where should our next chapter take us?".
export default function OurYear() {
  const { year: yearParam, page } = useLocalSearchParams<{ year: string; page?: string }>();
  const insets = useSafeAreaInsets();
  const preview = yearParam === "preview";
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // ---- load ----
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const couple = await getMyCouple();
        if (!couple) throw new Error("Couldn't find your world.");
        const partnerId = couple.partner_one === user.id ? couple.partner_two : couple.partner_one;
        const profiles = await getProfiles([user.id, partnerId ?? ""]);
        const c: Ctx = {
          coupleId: couple.id,
          myId: user.id,
          myName: profiles[user.id]?.firstName ?? "You",
          partnerName: (partnerId && profiles[partnerId]?.firstName) || "Your person",
          start: couple.relationship_start,
        };
        setCtx(c);
        let year: number | null;
        let from: Date;
        let to: Date;
        if (preview) {
          const today = startOfToday();
          year = null;
          to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
          from = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1);
        } else {
          year = Math.max(1, Number(yearParam) || 1);
          if (year > anniversaryStatus(couple.relationship_start).reached) throw new Error("This year isn't over yet 🌅");
          ({ from, to } = recapWindow(couple.relationship_start, year));
          recordRecapView(couple.id, year);
        }
        setRecap(await buildRecap({ coupleId: couple.id, myId: user.id, relationshipStart: couple.relationship_start, year, from, to }));
      } catch (e: any) {
        setFailed(e?.message ?? String(e));
      }
    })();
  }, [preview, yearParam]);

  if (failed) {
    return (
      <View style={[styles.root, styles.center]}>
        <Body color={colors.onDark} center style={styles.pad}>
          {failed}
        </Body>
        <Button title="Close" variant="soft" onPress={() => router.back()} />
      </View>
    );
  }
  if (!ctx || !recap) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.coral} />
        <Handwritten color={colors.onDarkSoft} style={styles.loading}>
          Gathering our year…
        </Handwritten>
      </View>
    );
  }
  return <RecapStory ctx={ctx} recap={recap} preview={preview} startAtAnswer={page === "answer"} topInset={insets.top} bottomInset={insets.bottom} />;
}

function RecapStory({ ctx, recap, preview, startAtAnswer, topInset, bottomInset }: { ctx: Ctx; recap: Recap; preview: boolean; startAtAnswer: boolean; topInset: number; bottomInset: number }) {
  const year = recap.year ?? 1;
  const isWeb = Platform.OS === "web";
  const [started, setStarted] = useState(!isWeb);
  const [held, setHeld] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    stopPreview();
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  // ---- pages (skip any with no data) ----
  const pages = useMemo<Page[]>(() => {
    const list: Page[] = [];
    const s = recap.stats;
    if (recap.lastYear && (recap.lastYear.mine || recap.lastYear.theirs)) {
      list.push({ key: "lastYear", duration: 10000, render: () => <LastYearPage recap={recap} ctx={ctx} /> });
    }
    list.push({ key: "title", duration: 4500, dark: true, render: () => <TitlePage recap={recap} year={year} /> });
    const numbers = s.memories + s.photos + s.videos + s.voiceNotes + s.bottlesSent.me + s.bottlesSent.partner + s.songsPicked + s.questionsAnsweredTogether + s.missionsCompleted + s.bucketDone;
    if (numbers > 0) list.push({ key: "numbers", duration: 10000, render: (current) => <NumbersPage recap={recap} ctx={ctx} active={current} /> });
    if (recap.first) list.push({ key: "firstLast", duration: 8000, render: () => <FirstLastPage recap={recap} /> });
    if (recap.busiest) list.push({ key: "busiest", duration: 7000, render: () => <BusiestPage recap={recap} /> });
    if (recap.songs.covers.length) list.push({ key: "songs", duration: 8000, render: () => <SongsPage recap={recap} /> });
    if (recap.sameBrain.count > 0) list.push({ key: "sameBrain", duration: 9000, render: () => <SameBrainPage recap={recap} ctx={ctx} /> });
    if (recap.bucketDone.length || recap.places > 0) list.push({ key: "bucket", duration: 7000, render: () => <BucketPlacesPage recap={recap} /> });
    if (recap.bothRemembered) list.push({ key: "both", duration: 6000, render: () => <BothRememberedPage photo={recap.bothRemembered!} /> });
    recap.highlights.forEach((h, i) =>
      list.push({
        key: `hl-${i}`,
        duration: h.type === "video" && h.videoUrl ? 7000 : 4500,
        dark: true,
        render: (current, paused) => <HighlightPage item={h} first={i === 0} current={current} paused={paused} />,
      }),
    );
    list.push({ key: "answer", duration: 0, render: () => <NextChapterPage ctx={ctx} year={year} preview={preview} /> });
    list.push({ key: "closing", duration: 0, dark: true, render: () => <ClosingPage year={year} onReplay={() => setIndex(0)} onClose={() => router.back()} /> });
    return list;
  }, [recap, ctx, year, preview]);

  const [index, setIndex] = useState(() => (startAtAnswer ? pages.findIndex((p) => p.key === "answer") : 0));
  const current = pages[index];
  const interactive = current.duration === 0;
  const paused = held || !appActive || !started;
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(pages.length - 1, i + d))), [pages.length]);
  const progress = useStoryClock({ index, duration: current.duration, paused, onEnd: () => go(1) });
  const close = useCallback(() => router.back(), []);
  const swipe = useSwipeDown(close);

  // ---- soundtrack: our favorite song, else the most-picked (30s preview, looped, soft) ----
  const songUrl = recap.songs.soundtrack?.previewUrl ?? null;
  const source = useMemo(() => (songUrl ? { uri: songUrl } : null), [songUrl]);
  const song = useAudioPlayer(source);
  useEffect(() => {
    if (!songUrl) return;
    song.loop = true;
    song.volume = 0.35;
  }, [song, songUrl]);
  // quiet while answering (voice notes) and when paused
  const songOn = !!songUrl && started && appActive && !held && current.key !== "answer";
  useEffect(() => {
    if (!songUrl) return;
    if (songOn) song.play();
    else song.pause();
  }, [songOn, song, songUrl]);

  function begin() {
    try {
      song?.play(); // inside the tap (Safari)
    } catch {}
    setStarted(true);
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[styles.root, swipe.style]}>
          <Animated.View key={current.key} entering={FadeIn.duration(350)} style={StyleSheet.absoluteFill}>
            {!current.dark && (
              <View style={[StyleSheet.absoluteFill, styles.paper]}>
                <PaperTexture />
              </View>
            )}
            <View style={[styles.pageBody, { paddingTop: topInset + 44, paddingBottom: bottomInset + space.xl }]} pointerEvents="box-none">
              {current.render(true, paused)}
            </View>
          </Animated.View>

          {!interactive && <TapZones onPrev={() => go(-1)} onNext={() => go(1)} onHold={setHeld} />}
          {current.key === "answer" && (
            <View style={[styles.answerNav, { bottom: bottomInset + space.md }]}>
              <Button title="Back" variant="text" onPress={() => go(-1)} />
              <Button title="Continue" variant="soft" onPress={() => go(1)} />
            </View>
          )}

          <ProgressBars count={pages.length} current={index} progress={progress} top={topInset + space.sm} tone={current.dark ? "light" : "ink"} />
          <Pressable onPress={close} style={[styles.close, { top: topInset + space.lg }]} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
            <Text style={[styles.closeText, { color: current.dark ? colors.onDark : colors.inkOcean }]}>✕</Text>
          </Pressable>
          {held && (
            <View style={[styles.pausedTag, { top: topInset + 52 }]} pointerEvents="none">
              <Body variant="small" color={colors.onDark}>
                Paused
              </Body>
            </View>
          )}
          {!started && (
            <Pressable onPress={begin} style={styles.beginOverlay} accessibilityRole="button" accessibilityLabel="Tap to begin">
              <Text style={styles.beginIcon}>▶</Text>
              <Body variant="bodyStrong" color={colors.onDark}>
                Tap to begin
              </Body>
            </Pressable>
          )}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------- pages

const fmt = (d: string) => {
  const x = parseLocalDate(d);
  return `${x.getDate()} ${monthName(x.getMonth()).slice(0, 3)} ${x.getFullYear()}`;
};

function Sunset({ children }: { children: ReactNode }) {
  return (
    <>
      <LinearGradient colors={[anniversarySky[0], anniversarySky[1], anniversarySky[2]]} style={StyleSheet.absoluteFill} />
      <View style={styles.centerFill}>{children}</View>
    </>
  );
}

function LastYearPage({ recap, ctx }: { recap: Recap; ctx: Ctx }) {
  const ly = recap.lastYear!;
  return (
    <ScrollView contentContainerStyle={styles.scrollPage}>
      <Title variant="titleItalic" center>
        Last year, you said…
      </Title>
      <Body color={colors.inkSoft} center>
        Where should our next chapter take us?
      </Body>
      {ly.mine && <Note who={ctx.myName} answer={ly.mine} tint={colors.warmWhite} tilt={-1.2} />}
      {ly.theirs ? (
        <Note who={ctx.partnerName} answer={ly.theirs} tint={colors.sand} tilt={1} />
      ) : (
        <Handwritten color={colors.inkSoft} center>
          {ctx.partnerName}'s answer stays sealed until you've written yours.
        </Handwritten>
      )}
    </ScrollView>
  );
}

function TitlePage({ recap, year }: { recap: Recap; year: number }) {
  return (
    <Sunset>
      <YearStone n={year} size={46} />
      <Title variant="display" color={colors.onDark} center style={styles.gapTop}>
        {recap.partial ? "Our year in Us" : "Our year"}
      </Title>
      <Handwritten color={colors.warmWhite} center>
        {recap.rangeText}
      </Handwritten>
    </Sunset>
  );
}

function useCountUp(target: number, active: boolean, ms = 1100) {
  const [n, setN] = useState(active ? 0 : target);
  useEffect(() => {
    if (!active) return setN(target);
    setN(0);
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [target, active, ms]);
  return n;
}

function NumbersPage({ recap, ctx, active }: { recap: Recap; ctx: Ctx; active: boolean }) {
  const s = recap.stats;
  const rows: [string, number][] = [
    ["memories", s.memories],
    ["photos", s.photos],
    ["videos", s.videos],
    ["voice notes", s.voiceNotes],
    [`bottles from ${ctx.myName}`, s.bottlesSent.me],
    [`bottles from ${ctx.partnerName}`, s.bottlesSent.partner],
    ["songs picked", s.songsPicked],
    ["questions answered together", s.questionsAnsweredTogether],
    ["secret missions", s.missionsCompleted],
    ["bucket list ticks", s.bucketDone],
  ];
  return (
    <ScrollView contentContainerStyle={styles.scrollPage}>
      <Title variant="titleItalic" center>
        Our year, in tallies
      </Title>
      <View style={styles.ledger}>
        {rows
          .filter(([, n]) => n > 0)
          .map(([label, n]) => (
            <CountRow key={label} label={label} n={n} active={active} />
          ))}
      </View>
    </ScrollView>
  );
}

function CountRow({ label, n, active }: { label: string; n: number; active: boolean }) {
  const shown = useCountUp(n, active);
  return (
    <View style={styles.ledgerLine}>
      <View style={styles.ledgerCount}>{n <= 20 ? <Tally n={Math.max(1, shown)} /> : <Handwritten>{shown.toLocaleString()}</Handwritten>}</View>
      <Text style={styles.ledgerLabel}>
        {n <= 20 ? `${shown} ` : ""}
        {label}
      </Text>
    </View>
  );
}

function FirstLastPage({ recap }: { recap: Recap }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width * 0.44, 190);
  return (
    <View style={styles.centerFill}>
      <Title variant="titleItalic" center>
        {recap.latest ? "Where our year began, and where it's got to" : "Where our year began"}
      </Title>
      <View style={styles.pair}>
        <PhotoCard photo={recap.first!} width={w} caption={`first · ${fmt(recap.first!.date)}`} />
        {recap.latest && <PhotoCard photo={recap.latest} width={w} caption={`latest · ${fmt(recap.latest.date)}`} style={styles.pairSecond} />}
      </View>
    </View>
  );
}

function PhotoCard({ photo, width, caption, style }: { photo: RecapPhoto; width: number; caption: string; style?: object }) {
  return (
    <View style={style}>
      <Polaroid seed={photo.memoryId} uri={photo.url} cacheKey={photo.cacheKey} width={width} caption={caption} />
      <Body variant="small" color={colors.inkSoft} center numberOfLines={1} style={{ width, marginTop: space.xs }}>
        {photo.title}
      </Body>
    </View>
  );
}

function BusiestPage({ recap }: { recap: Recap }) {
  const { width } = useWindowDimensions();
  const b = recap.busiest!;
  const w = Math.min(width * 0.4, 170);
  const spots = [
    { left: 0, top: 0 },
    { left: w * 0.8, top: w * 0.15 },
    { left: w * 0.15, top: w * 0.85 },
    { left: w * 0.95, top: w * 1.0 },
  ];
  return (
    <View style={styles.centerFill}>
      <Title variant="titleItalic" center>
        {monthName(b.month)}
      </Title>
      <Body color={colors.inkSoft} center>
        the month we made the most memories · {b.count}
      </Body>
      <View style={{ width: w * 1.95, height: w * 2.2, marginTop: space.lg }}>
        {b.photos.map((p, i) => (
          <View key={p.memoryId} style={[styles.abs, spots[i]]}>
            <Polaroid seed={p.memoryId} uri={p.url} cacheKey={p.cacheKey} width={w} />
          </View>
        ))}
      </View>
    </View>
  );
}

function SongsPage({ recap }: { recap: Recap }) {
  const { width } = useWindowDimensions();
  const covers = recap.songs.covers;
  const cols = covers.length > 6 ? 4 : 3;
  const size = Math.floor((Math.min(width, 440) - space.xl * 2 - (cols - 1) * space.sm) / cols);
  return (
    <ScrollView contentContainerStyle={styles.scrollPage}>
      <Title variant="titleItalic" center>
        Songs of our year
      </Title>
      <View style={styles.coverGrid}>
        {covers.map((s) => (
          <View key={s.itunesId} style={[styles.cover, { width: size, height: size }]}>
            <Image source={{ uri: s.artworkUrl! }} style={{ width: size, height: size, borderRadius: radius.photo }} contentFit="cover" />
          </View>
        ))}
      </View>
      {recap.songs.topArtist && (
        <Handwritten center>
          {recap.songs.topArtist} kept coming back
        </Handwritten>
      )}
      {recap.songs.soundtrack && (
        <Body variant="small" color={colors.inkSoft} center>
          ♪ playing: {recap.songs.soundtrack.title} — {recap.songs.soundtrack.artist}
        </Body>
      )}
    </ScrollView>
  );
}

function SameBrainPage({ recap, ctx }: { recap: Recap; ctx: Ctx }) {
  const n = recap.sameBrain.count;
  return (
    <ScrollView contentContainerStyle={styles.scrollPage}>
      <Title variant="display" center color={colors.coral}>
        {n}
      </Title>
      <Title variant="headingItalic" center>
        {n === 1 ? "time we had the same brain 😂❤️" : "times we had the same brain 😂❤️"}
      </Title>
      {recap.sameBrain.examples.map((e, i) => (
        <View key={i} style={styles.example}>
          <Body variant="label" color={colors.inkSoft}>
            {e.prompt}
          </Body>
          <View style={styles.exampleRow}>
            <View style={[styles.slip, { transform: [{ rotate: "-1.5deg" }] }]}>
              <Body variant="small" color={colors.inkSoft}>
                {ctx.myName}
              </Body>
              <Handwritten variant="handSmall">{e.mine}</Handwritten>
            </View>
            <View style={[styles.slip, styles.slipTheirs, { transform: [{ rotate: "1.5deg" }] }]}>
              <Body variant="small" color={colors.inkSoft}>
                {ctx.partnerName}
              </Body>
              <Handwritten variant="handSmall">{e.theirs}</Handwritten>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function BucketPlacesPage({ recap }: { recap: Recap }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollPage}>
      {recap.bucketDone.length > 0 && (
        <>
          <Title variant="titleItalic" center>
            We did it
          </Title>
          <View style={styles.bucketPage}>
            {recap.bucketDone.map((b, i) => (
              <View key={i} style={styles.bucketLine}>
                <Text style={styles.tick}>✓</Text>
                <Body style={styles.flex}>
                  {b.emoji ? `${b.emoji}  ` : ""}
                  {b.title}
                </Body>
                <Body variant="small" color={colors.inkSoft}>
                  {fmt(b.doneAt.slice(0, 10))}
                </Body>
              </View>
            ))}
          </View>
        </>
      )}
      {recap.places > 0 && (
        <Handwritten center style={styles.places}>
          {recap.places} {recap.places === 1 ? "place" : "places"} we went together
        </Handwritten>
      )}
    </ScrollView>
  );
}

function BothRememberedPage({ photo }: { photo: RecapPhoto }) {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.centerFill}>
      <Title variant="titleItalic" center>
        The memory you both remembered
      </Title>
      <View style={styles.gapTop}>
        <PhotoCard photo={photo} width={Math.min(width * 0.62, 260)} caption={fmt(photo.date)} />
      </View>
      <Body color={colors.inkSoft} center>
        You both left it a heart ❤️
      </Body>
    </View>
  );
}

function HighlightPage({ item, first, current, paused }: { item: RecapHighlight; first: boolean; current: boolean; paused: boolean }) {
  const reduceMotion = useReducedMotion();
  const zoom = useSharedValue(1);
  useEffect(() => {
    if (!current || reduceMotion || item.type === "video") return;
    zoom.value = 1;
    zoom.value = withTiming(1.14, { duration: 4500, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [current, reduceMotion, item.type, zoom]);
  const kb = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.darkBg]}>
      {item.type === "video" && item.videoUrl ? (
        <HighlightVideo url={item.videoUrl} poster={item.url} posterKey={item.cacheKey} playing={current && !paused} />
      ) : item.url ? (
        <Animated.View style={[StyleSheet.absoluteFill, kb]}>
          <Image source={{ uri: item.url, cacheKey: item.cacheKey ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ) : null}
      <LinearGradient colors={["transparent", "rgba(7,26,43,0.75)"]} style={styles.captionShade} />
      <View style={styles.caption}>
        {first && (
          <Body variant="small" color={colors.onDarkSoft}>
            Our year, month by month
          </Body>
        )}
        <Title variant="headingItalic" color={colors.onDark}>
          {item.title}
        </Title>
        <Handwritten variant="handSmall" color={colors.sand}>
          {fmt(item.date)}
        </Handwritten>
      </View>
    </View>
  );
}

// Muted (the soundtrack keeps playing), inline, first ~7s.
function HighlightVideo({ url, poster, posterKey, playing }: { url: string; poster: string | null; posterKey: string | null; playing: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = true;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);
  return (
    <View style={StyleSheet.absoluteFill}>
      {poster ? <Image source={{ uri: poster, cacheKey: posterKey ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <VideoView playsInline player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

function NextChapterPage({ ctx, year, preview }: { ctx: Ctx; year: number; preview: boolean }) {
  return (
    <ScrollView contentContainerStyle={[styles.scrollPage, styles.answerPage]} keyboardShouldPersistTaps="handled">
      <NextChapter coupleId={ctx.coupleId} myId={ctx.myId} year={year} myName={ctx.myName} partnerName={ctx.partnerName} preview={preview} />
    </ScrollView>
  );
}

function ClosingPage({ year, onReplay, onClose }: { year: number; onReplay: () => void; onClose: () => void }) {
  return (
    <Sunset>
      <YearStone n={year + 1} size={40} />
      <Title variant="titleItalic" color={colors.onDark} center style={styles.gapTop}>
        Here's to year {year + 1} 🌅
      </Title>
      <View style={styles.closingButtons}>
        <Button title="Play again" onPress={onReplay} />
        <Button title="Close" variant="soft" onPress={onClose} />
      </View>
    </Sunset>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deepOcean },
  center: { alignItems: "center", justifyContent: "center", gap: space.md },
  pad: { padding: space.xl },
  loading: { marginTop: space.md },
  paper: { backgroundColor: colors.paper },
  darkBg: { backgroundColor: colors.deepOcean },
  pageBody: { flex: 1, paddingHorizontal: space.xl },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl },
  scrollPage: { flexGrow: 1, justifyContent: "center", gap: space.lg, paddingVertical: space.xl },
  answerPage: { paddingBottom: 90 },
  abs: { position: "absolute" },
  flex: { flex: 1 },
  gapTop: { marginTop: space.md },
  ledger: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, transform: [{ rotate: "-0.5deg" }], ...shadows.paper },
  ledgerLine: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 36, borderBottomWidth: 1, borderBottomColor: "#BFE3F0" },
  ledgerCount: { minWidth: 80 },
  ledgerLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.inkSoft, flex: 1 },
  pair: { flexDirection: "row", alignItems: "flex-start", marginTop: space.lg },
  pairSecond: { marginLeft: -space.md, marginTop: space.xxl },
  coverGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center" },
  cover: { borderRadius: radius.photo, ...shadows.lifted },
  example: { gap: space.xs },
  exampleRow: { flexDirection: "row", gap: space.sm },
  slip: { flex: 1, backgroundColor: colors.warmWhite, padding: space.md, borderRadius: radius.photo, ...shadows.lifted },
  slipTheirs: { backgroundColor: colors.sand },
  bucketPage: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, paddingHorizontal: space.lg, paddingVertical: space.sm, ...shadows.paper },
  bucketLine: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.paperEdge },
  tick: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ocean },
  places: { marginTop: space.lg },
  captionShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" },
  caption: { position: "absolute", left: space.xl, right: space.xl, bottom: space.xxxl + space.xl, gap: space.xs },
  answerNav: { position: "absolute", left: space.xl, right: space.xl, flexDirection: "row", justifyContent: "space-between" },
  closingButtons: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  close: { position: "absolute", right: space.lg, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  closeText: { fontFamily: fonts.bodyBold, fontSize: 18 },
  pausedTag: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(7,26,43,0.55)", borderRadius: 8, paddingHorizontal: space.md, paddingVertical: 2 },
  beginOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,26,43,0.45)", alignItems: "center", justifyContent: "center", gap: space.sm },
  beginIcon: { color: colors.onDark, fontSize: 44 },
});
