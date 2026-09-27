import { Body, Button, formatLongDate, Handwritten, Icon3D, PressableScale, Sheet, tapHaptic, Title } from "@/components/ui";
import { getMemoryById, resolveMedia, type ResolvedMedia } from "@/lib/memories";
import { stopPreview } from "@/lib/music";
import { colors, radius, space, type as typeScale } from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEventListener } from "expo";
import { Waveform } from "@/components/voice/Waveform";
import { formatDuration } from "@/lib/voice";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    ReduceMotion,
    useSharedValue,
    withSequence,
    withTiming,
    type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

// Reel timing rules (see CLAUDE.md):
// - title card 3s; photos use the viewer's speed setting (8/15/30/60s, default 60s)
// - videos play their full length up to 60s and ignore the photo speed
// - one shared progress value drives the timer, the progress bar and Ken Burns,
//   so they always match and hold-to-pause freezes all three
const TITLE_MS = 3000;
const PHOTO_SPEEDS = [8, 15, 30, 60] as const;
type PhotoSpeed = (typeof PHOTO_SPEEDS)[number];
const DEFAULT_PHOTO_S: PhotoSpeed = 60;
const PHOTO_SPEED_KEY = "reel.photoSeconds";
const VIDEO_CAP_S = 60;
// Short clips advance on playToEnd; their timer runs a little longer so the
// two never both fire (which would skip a frame).
const VIDEO_END_BUFFER_MS = 800;
const VOICE_CAP_S = 120;

type Frame =
  | { kind: "title" }
  | { kind: "media"; item: ResolvedMedia; mediaIndex: number }
  | { kind: "end" };

function frameDuration(f: Frame, photoSeconds: number) {
  if (f.kind === "title") return TITLE_MS;
  if (f.kind === "end") return 0;
  if (f.item.type === "voice") {
    // Plays in full (voice notes are at most 2 minutes); the end event
    // usually advances first.
    const s = Math.min(f.item.durationSeconds ?? VOICE_CAP_S, VOICE_CAP_S);
    return s * 1000 + VIDEO_END_BUFFER_MS;
  }
  if (f.item.type === "video") {
    // duration_seconds is whole SECONDS (not ms). Unknown length → the cap,
    // and playToEnd advances earlier if the clip is shorter.
    const s = f.item.durationSeconds;
    if (s == null || s >= VIDEO_CAP_S) return VIDEO_CAP_S * 1000;
    return s * 1000 + VIDEO_END_BUFFER_MS;
  }
  return photoSeconds * 1000;
}

// "Play this memory": a story-style reel. Title card → every item (photos at
// the chosen speed with Ken Burns, videos with sound up to 60s) → closing card.
// Tap right/left = next/previous, hold = pause, swipe down = close.
export default function MemoryReel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [memory, setMemory] = useState<any>(null);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [photoSeconds, setPhotoSeconds] = useState<PhotoSpeed>(DEFAULT_PHOTO_S);
  const [speedOpen, setSpeedOpen] = useState(false);
  // Web (iOS Safari): sound may only start from a tap, so the reel waits on a
  // "Tap to begin" card; the tap starts the soundtrack synchronously.
  const isWeb = Platform.OS === "web";
  const [started, setStarted] = useState(!isWeb);
  const [voiceWaitingAt, setVoiceWaitingAt] = useState<number | null>(null);
  const paused = held || !appActive || speedOpen || !started || voiceWaitingAt === index;
  // Web: reel videos start muted (muted autoplay is allowed); "Tap for sound"
  // unmutes the current one inside the tap. Native plays with sound.
  const currentVideo = useRef<ReturnType<typeof useVideoPlayer> | null>(null);
  const [soundOnFor, setSoundOnFor] = useState<string | null>(null);
  const onVideoPlayer = useCallback((p: ReturnType<typeof useVideoPlayer> | null) => {
    currentVideo.current = p;
  }, []);
  // Web: a voice note tries to play by itself; if Safari blocks it, the frame
  // holds on "Tap to listen" (the timer waits) and the tap starts it.
  const currentVoice = useRef<ReturnType<typeof useAudioPlayer> | null>(null);


  useEffect(() => {
    AsyncStorage.getItem(PHOTO_SPEED_KEY)
      .then((v) => {
        const n = Number(v);
        if ((PHOTO_SPEEDS as readonly number[]).includes(n)) setPhotoSeconds(n as PhotoSpeed);
      })
      .catch(() => {});
  }, []);

  function chooseSpeed(sec: PhotoSpeed) {
    setPhotoSeconds(sec);
    AsyncStorage.setItem(PHOTO_SPEED_KEY, String(sec)).catch(() => {});
    setSpeedOpen(false);
  }

  const progress = useSharedValue(0);
  const songUrl = memory?.song?.previewUrl ?? null;
  const songSource = useMemo(() => (songUrl ? { uri: songUrl } : null), [songUrl]);
  const songPlayer = useAudioPlayer(songSource);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const m = await getMemoryById(id);
        const items = await resolveMedia(m.memory_media ?? []);
        setMemory(m);
        setFrames([
          { kind: "title" },
          ...items.map((item, mediaIndex) => ({ kind: "media" as const, item, mediaIndex })),
          { kind: "end" },
        ]);
      } catch (err: any) {
        console.log("[Reel] load failed:", err.message);
        router.back();
      }
    })();
  }, [id]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    stopPreview(); // the reel's own soundtrack replaces any song preview
    return () => sub.remove();
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (!frames) return;
      setIndex((i) => {
        const next = Math.max(0, Math.min(frames.length - 1, i + delta));
        if (next !== i) tapHaptic();
        return next;
      });
    },
    [frames],
  );
  const goNext = useCallback(() => go(1), [go]);

  // ---- the frame timer ----------------------------------------------------
  // A plain JS clock decides WHEN to advance (setTimeout + elapsed-time
  // bookkeeping). The shared `progress` value only DRAWS the bar and the Ken
  // Burns zoom, and is always set explicitly — never read back — because on
  // native a JS-side read right after a write can return the previous value
  // (e.g. 1 from the last item), which made items advance after ~50ms. Web
  // shared values are plain JS, which is why Chrome looked fine.
  const current = frames?.[index];
  const duration = current ? frameDuration(current, photoSeconds) : 0;
  const clock = useRef<{ elapsed: number; startedAt: number | null }>({ elapsed: 0, startedAt: null });

  useEffect(() => {
    clock.current = { elapsed: 0, startedAt: null }; // new frame
    progress.value = 0;
  }, [index, progress]);

  // __DEV__: log how long each item actually stayed on screen (wall clock).
  const shownAt = useRef<{ index: number; at: number; label: string; planned: number } | null>(null);
  useEffect(() => {
    if (!__DEV__ || !current) return;
    const now = Date.now();
    const prev = shownAt.current;
    if (prev) {
      console.log(`[Reel] item ${prev.index} (${prev.label}) on screen: ${now - prev.at}ms (planned ${prev.planned}ms)`);
    }
    const label = current.kind === "media" ? current.item.type : current.kind;
    shownAt.current = { index, at: now, label, planned: duration };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current]);

  useEffect(() => {
    if (!current || duration === 0 || paused) return;
    const c = clock.current;
    const remaining = Math.max(0, duration - c.elapsed);
    c.startedAt = Date.now();
    // reduceMotion: Never — this is a clock, not decoration. With the default
    // (follow the system), iOS Reduce Motion makes timings finish instantly.
    progress.value = withSequence(
      withTiming(Math.min(1, c.elapsed / duration), { duration: 0, reduceMotion: ReduceMotion.Never }),
      withTiming(1, { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
    );
    const t = setTimeout(goNext, remaining);
    return () => {
      // Pause, speed change, next item or unmount: stop the clock where it is.
      clearTimeout(t);
      if (c.startedAt != null) {
        c.elapsed += Date.now() - c.startedAt;
        c.startedAt = null;
      }
      cancelAnimation(progress);
      progress.value = Math.min(1, c.elapsed / duration);
    };
  }, [index, paused, duration, current, goNext, progress]);

  // ---- swipe down to close ----
  const close = useCallback(() => router.back(), []);
  const pan = Gesture.Pan()
    .activeOffsetY(18)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(close);
      else dragY.value = withTiming(0, { duration: 180 });
    });
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    opacity: 1 - Math.min(dragY.value / 600, 0.4),
  }));

  // ---- hold to pause ----
  const holding = useRef(false);

  if (!frames || !memory) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.coral} />
      </View>
    );
  }

  const mediaFrames = frames.filter((f) => f.kind === "media") as Extract<Frame, { kind: "media" }>[];
  const currentMediaIndex = current?.kind === "media" ? current.mediaIndex : current?.kind === "end" ? mediaFrames.length : -1;
  const firstPhoto = mediaFrames.find((f) => f.item.thumbUrl)?.item;
  const date = memory.memory_date ? (() => { const [y, m, d] = memory.memory_date.split("-").map(Number); return new Date(y, m - 1, d); })() : null;

  // Only the current and the next frame are mounted: at most two video players,
  // and the next image is already loading while the current one shows.
  const mounted = [index, index + 1].filter((i) => i < frames.length);
  const currentIsVideo = current?.kind === "media" && current.item.type === "video";
  const currentIsVoice = current?.kind === "media" && current.item.type === "voice";
  const currentVideoSound = !isWeb || (current?.kind === "media" && soundOnFor === current.item.id);

  function soundOn() {
    // inside the tap: Safari lets a video unmute here
    const p = currentVideo.current;
    if (p && current?.kind === "media") {
      try {
        p.muted = false;
        p.play();
      } catch {}
      setSoundOnFor(current.item.id);
    }
  }

  function listen() {
    // inside the tap: Safari allows this audio element to start here
    try {
      currentVoice.current?.play();
    } catch {}
    setVoiceWaitingAt(null);
  }

  function begin() {
    // inside the tap: Safari allows audio to start here
    try {
      songPlayer?.play();
    } catch {}
    setStarted(true);
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {songUrl ? (
        <ReelSoundtrack player={songPlayer} playing={!paused} ducked={(currentIsVideo && currentVideoSound) || currentIsVoice} />
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.root, dragStyle]}>
          {mounted.map((i) => (
            <FrameView
              key={i}
              frame={frames[i]}
              isCurrent={i === index}
              paused={paused}
              progress={i === index ? progress : null}
              reduceMotion={reduceMotion}
              memory={memory}
              date={date}
              firstPhoto={firstPhoto}
              counts={{
                photos: mediaFrames.filter((f) => f.item.type === "photo").length,
                videos: mediaFrames.filter((f) => f.item.type === "video").length,
                voices: mediaFrames.filter((f) => f.item.type === "voice").length,
              }}
              onEnded={goNext}
              onVoiceBlocked={(p) => {
                currentVoice.current = p;
                setVoiceWaitingAt(i);
              }}
              onReplay={() => setIndex(0)}
              onClose={close}
              onVideoPlayer={onVideoPlayer}
            />
          ))}

          {/* tap zones (not on the closing card, which has its own buttons) */}
          {current?.kind !== "end" && (
            <View style={StyleSheet.absoluteFill}>
              <View style={styles.zones}>
                {[-1, 1].map((dir) => (
                  <Pressable
                    key={dir}
                    style={dir === -1 ? styles.zoneLeft : styles.zoneRight}
                    onPress={() => {
                      if (!holding.current) go(dir);
                    }}
                    onLongPress={() => {
                      holding.current = true;
                      setHeld(true);
                    }}
                    delayLongPress={220}
                    onPressOut={() => {
                      if (holding.current) {
                        setHeld(false);
                        setTimeout(() => (holding.current = false), 0);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={dir === -1 ? "Previous" : "Next"}
                  />
                ))}
              </View>
            </View>
          )}

          {/* thin progress bars */}
          {mediaFrames.length > 0 && current?.kind !== "title" && (
            <View style={[styles.bars, { top: insets.top + space.sm }]} pointerEvents="none">
              {mediaFrames.map((f) => (
                <ProgressBar
                  key={f.item.id}
                  state={f.mediaIndex < currentMediaIndex ? "done" : f.mediaIndex === currentMediaIndex ? "current" : "todo"}
                  progress={progress}
                />
              ))}
            </View>
          )}

          {current?.kind !== "end" && (
            <PressableScale
              onPress={() => setSpeedOpen(true)}
              style={[styles.speed, { top: insets.top + space.lg + 6 }]}
              accessibilityRole="button"
              accessibilityLabel={`Photo speed: ${photoSeconds} seconds per photo. Change`}
              hitSlop={8}
            >
              <Text style={[typeScale.small, styles.speedText]}>{photoSeconds}s</Text>
            </PressableScale>
          )}

          <Pressable
            onPress={close}
            style={[styles.close, { top: insets.top + space.lg + 6 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
          >
            <Body variant="bodyStrong" color={colors.onDark}>
              ✕
            </Body>
          </Pressable>

          {isWeb && started && currentIsVideo && !currentVideoSound && (
            <Pressable onPress={soundOn} style={[styles.soundChip, { bottom: insets.bottom + space.xl }]} accessibilityRole="button" accessibilityLabel="Turn on sound">
              <Body variant="small" color={colors.onDark}>
                🔇 Tap for sound
              </Body>
            </Pressable>
          )}

          {isWeb && started && currentIsVoice && voiceWaitingAt === index && (
            <Pressable onPress={listen} style={[styles.soundChip, { bottom: insets.bottom + space.xl }]} accessibilityRole="button" accessibilityLabel="Play the voice note">
              <Body variant="small" color={colors.onDark}>
                🔊 Tap to listen
              </Body>
            </Pressable>
          )}

          {!started && (
            <Pressable onPress={begin} style={styles.beginOverlay} accessibilityRole="button" accessibilityLabel="Tap to begin">
              <View style={styles.beginCard}>
                <Text style={styles.beginIcon}>▶</Text>
                <Body variant="bodyStrong" color={colors.onDark}>
                  Tap to begin
                </Body>
              </View>
            </Pressable>
          )}

          {held && (
            <View style={[styles.pausedTag, { top: insets.top + space.xxl + 8 }]} pointerEvents="none">
              <Body variant="small" color={colors.onDark}>
                Paused
              </Body>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Opening this pauses the reel (speedOpen is part of `paused`). */}
      <Sheet visible={speedOpen} onClose={() => setSpeedOpen(false)}>
        <Title variant="heading">Time per photo</Title>
        <Body variant="small" color={colors.inkSoft} style={styles.speedHint}>
          Videos always play in full (up to a minute).
        </Body>
        <View style={styles.speedRow} accessibilityRole="radiogroup">
          {PHOTO_SPEEDS.map((sec) => (
            <PressableScale
              key={sec}
              onPress={() => chooseSpeed(sec)}
              accessibilityRole="radio"
              accessibilityState={{ selected: photoSeconds === sec }}
              accessibilityLabel={`${sec} seconds`}
              style={[styles.speedChip, photoSeconds === sec && styles.speedChipOn]}
            >
              <Text style={[typeScale.button, { color: photoSeconds === sec ? colors.onDark : colors.inkOcean }]}>
                {sec}s
              </Text>
            </PressableScale>
          ))}
        </View>
      </Sheet>
    </GestureHandlerRootView>
  );
}

function ProgressBar({ state, progress }: { state: "done" | "current" | "todo"; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: `${(state === "done" ? 1 : state === "current" ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

function FrameView({
  frame,
  isCurrent,
  paused,
  progress,
  reduceMotion,
  memory,
  date,
  firstPhoto,
  counts,
  onEnded,
  onReplay,
  onClose,
  onVideoPlayer,
  onVoiceBlocked,
}: {
  frame: Frame;
  isCurrent: boolean;
  paused: boolean;
  progress: SharedValue<number> | null;
  reduceMotion: boolean;
  memory: any;
  date: Date | null;
  firstPhoto?: ResolvedMedia;
  counts: { photos: number; videos: number; voices: number };
  onEnded: () => void;
  onReplay: () => void;
  onClose: () => void;
  onVideoPlayer: (p: ReturnType<typeof useVideoPlayer> | null) => void;
  onVoiceBlocked: (p: ReturnType<typeof useAudioPlayer>) => void;
}) {
  // Crossfade: the next frame waits underneath at opacity 0.
  const visible = useSharedValue(isCurrent ? 1 : 0);
  useEffect(() => {
    visible.value = withTiming(isCurrent ? 1 : 0, { duration: 320 });
  }, [isCurrent, visible]);
  const fade = useAnimatedStyle(() => ({ opacity: visible.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents={isCurrent ? "box-none" : "none"}>
      {frame.kind === "title" && (
        <View style={styles.card}>
          {firstPhoto?.thumbUrl ? (
            <Image
              source={{ uri: firstPhoto.thumbUrl, cacheKey: firstPhoto.thumbCacheKey ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={28}
            />
          ) : null}
          <View style={styles.scrim} />
          <Title variant="titleItalic" color={colors.onDark} center style={styles.cardTitle}>
            {memory.title}
          </Title>
          <Body color={colors.onDarkSoft} center>
            {[date ? formatLongDate(date) : null, memory.location].filter(Boolean).join(" · ")}
          </Body>
        </View>
      )}

      {frame.kind === "media" && frame.item.type === "photo" && (
        <KenBurnsPhoto item={frame.item} direction={frame.mediaIndex % 2 === 0 ? 1 : -1} progress={reduceMotion ? null : progress} />
      )}

      {frame.kind === "media" && frame.item.type === "video" && (
        <ReelVideo item={frame.item} playing={isCurrent && !paused} onEnded={onEnded} onPlayer={isCurrent ? onVideoPlayer : undefined} />
      )}

      {frame.kind === "media" && frame.item.type === "voice" && (
        <ReelVoice item={frame.item} backdrop={firstPhoto} playing={isCurrent && !paused} onEnded={onEnded} onBlocked={onVoiceBlocked} />
      )}

      {frame.kind === "end" && (
        <View style={styles.card}>
          <Icon3D name="sparklingHeart" size={72} />
          <Handwritten color={colors.sand} center style={styles.endLine}>
            {counts.photos} {counts.photos === 1 ? "photo" : "photos"}, {counts.videos} {counts.videos === 1 ? "video" : "videos"}
            {counts.voices > 0 ? `, ${counts.voices} ${counts.voices === 1 ? "voice note" : "voice notes"}` : ""}
            {date ? ` — ${formatLongDate(date)}` : ""}
          </Handwritten>
          <Title variant="titleItalic" color={colors.onDark} center>
            {memory.title}
          </Title>
          <View style={styles.endButtons}>
            <Button title="Play again" onPress={onReplay} />
            <Button title="Close" variant="soft" onPress={onClose} />
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// Slow zoom + pan across the photo's WHOLE on-screen time (whatever the speed
// setting), alternating direction. Driven by the frame's progress value (0→1
// over that time), so it never finishes early and pausing freezes it too.
function KenBurnsPhoto({
  item,
  direction,
  progress,
}: {
  item: ResolvedMedia;
  direction: 1 | -1;
  progress: SharedValue<number> | null;
}) {
  const { width } = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    const p = progress ? progress.value : 0;
    return {
      transform: [
        { scale: progress ? 1.04 + 0.12 * p : 1 },
        { translateX: progress ? direction * (p - 0.5) * width * 0.06 : 0 },
        { translateY: progress ? -direction * (p - 0.5) * width * 0.03 : 0 },
      ],
    };
  });
  return (
    <View style={styles.mediaWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image
          source={{ uri: item.url, cacheKey: item.cacheKey }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

const SONG_VOLUME = 0.35;
const SONG_DUCKED = 0.04;

// The memory's song, looping softly behind the reel (the 30s preview).
// Fades almost silent while a video with sound plays, back up after.
// Unmounting (closing the reel) releases the player, which stops it.
function ReelSoundtrack({
  player,
  playing,
  ducked,
}: {
  player: ReturnType<typeof useAudioPlayer>;
  playing: boolean;
  ducked: boolean;
}) {
  const volume = useRef(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => {});
    player.loop = true;
    player.volume = 0;
  }, [player]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  // Simple JS fade (~450ms) toward the target volume.
  useEffect(() => {
    const target = ducked ? SONG_DUCKED : SONG_VOLUME;
    const step = (target - volume.current) / 10;
    let n = 0;
    const t = setInterval(() => {
      n++;
      volume.current = n >= 10 ? target : volume.current + step;
      player.volume = volume.current;
      if (n >= 10) clearInterval(t);
    }, 45);
    return () => clearInterval(t);
  }, [ducked, player]);

  return null;
}

// A voice note in the reel: a big paper waveform card over the blurred first
// photo, playing with sound (the soundtrack ducks). Web: if the browser blocks
// the autoplay, onBlocked hands the player up so a tap can start it.
function ReelVoice({
  item,
  backdrop,
  playing,
  onEnded,
  onBlocked,
}: {
  item: ResolvedMedia;
  backdrop?: ResolvedMedia;
  playing: boolean;
  onEnded: () => void;
  onBlocked: (p: ReturnType<typeof useAudioPlayer>) => void;
}) {
  const { width } = useWindowDimensions();
  const source = useMemo(() => ({ uri: item.url }), [item.url]);
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const ended = useRef(false);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  useEffect(() => {
    if (status.didJustFinish && playing && !ended.current) {
      ended.current = true;
      onEnded();
    }
  }, [status.didJustFinish, playing, onEnded]);

  useEffect(() => {
    if (!playing || Platform.OS !== "web") return;
    const t = setTimeout(() => {
      if (!player.playing && player.currentTime < 0.05) onBlocked(player);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, player]);

  const duration = status.duration || item.durationSeconds || 1;
  const cardWidth = Math.min(width - space.xl * 2, 420);
  return (
    <View style={styles.card}>
      {backdrop?.thumbUrl ? (
        <Image source={{ uri: backdrop.thumbUrl, cacheKey: backdrop.thumbCacheKey ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} />
      ) : null}
      <View style={styles.scrim} />
      <View style={[styles.voiceCard, { width: cardWidth }]}>
        <Handwritten color={colors.inkSoft}>a voice note</Handwritten>
        <View style={styles.voiceWave}>
          <Waveform values={item.waveform ?? []} progress={Math.min(1, status.currentTime / duration)} color={colors.paperEdge} playedColor={colors.ocean} height={72} />
        </View>
        <Body variant="small" color={colors.inkSoft} style={styles.voiceTime}>
          {formatDuration(status.currentTime)} / {formatDuration(duration)}
        </Body>
      </View>
    </View>
  );
}

function ReelVideo({
  item,
  playing,
  onEnded,
  onPlayer,
}: {
  item: ResolvedMedia;
  playing: boolean;
  onEnded: () => void;
  onPlayer?: (p: ReturnType<typeof useVideoPlayer> | null) => void;
}) {
  const player = useVideoPlayer(item.url, (p) => {
    p.loop = false;
    // Web: start muted (Safari only allows muted autoplay); "Tap for sound" unmutes.
    p.muted = Platform.OS === "web";
    p.audioMixingMode = "mixWithOthers"; // let the (ducked) soundtrack keep going underneath
  });
  useEffect(() => {
    if (!playing) return;
    onPlayer?.(player);
    return () => onPlayer?.(null);
  }, [playing, player, onPlayer]);
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);
  useEventListener(player, "playToEnd", () => {
    if (playing) onEnded();
  });
  return (
    <View style={styles.mediaWrap}>
      {item.thumbUrl ? (
        <Image source={{ uri: item.thumbUrl, cacheKey: item.thumbCacheKey ?? undefined }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : null}
      <VideoView playsInline player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deepOcean },
  center: { alignItems: "center", justifyContent: "center" },
  mediaWrap: { ...StyleSheet.absoluteFill, backgroundColor: colors.deepOcean, overflow: "hidden" },
  card: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
    backgroundColor: colors.deepOcean,
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,26,43,0.45)" },
  cardTitle: { fontSize: 36, lineHeight: 42 },
  endLine: { marginTop: space.md },
  voiceCard: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    padding: space.xl,
    gap: space.md,
    transform: [{ rotate: "-1.5deg" }],
  },
  voiceWave: { height: 72, flexDirection: "row" },
  voiceTime: { textAlign: "right", fontVariant: ["tabular-nums"] },
  endButtons: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  zones: { flex: 1, flexDirection: "row" },
  zoneLeft: { flex: 35 },
  zoneRight: { flex: 65 },
  bars: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,248,239,0.3)", overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.warmWhite },
  speed: {
    position: "absolute",
    right: space.lg + 44,
    height: 36,
    minWidth: 44,
    paddingHorizontal: space.sm,
    borderRadius: 18,
    backgroundColor: "rgba(7,26,43,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  speedText: { color: colors.onDark },
  speedHint: { marginTop: space.xs },
  speedRow: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  speedChip: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.paperDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  speedChipOn: { backgroundColor: colors.ocean },
  close: {
    position: "absolute",
    right: space.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(7,26,43,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  soundChip: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(7,26,43,0.65)",
    borderRadius: 18,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  beginOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,26,43,0.35)", alignItems: "center", justifyContent: "center" },
  beginCard: { alignItems: "center", gap: space.sm },
  beginIcon: { color: colors.onDark, fontSize: 44 },
  pausedTag: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(7,26,43,0.55)",
    borderRadius: 8,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
});
