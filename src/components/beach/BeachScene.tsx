import { Beginning } from "@/components/moments/Beginning";
import { AnniversaryMoment } from "@/components/moments/AnniversaryMoment";
import { BirthdayMoment } from "@/components/moments/BirthdayMoment";
import { dayMonthLabel, hasSeenAnniversary, markAnniversarySeen, yearsLabel } from "@/lib/anniversary";
import { RememberCard, type RememberMemory } from "@/components/moments/RememberCard";
import { getSignedMediaUrl } from "@/lib/memories";
import { getTodaysRemember } from "@/lib/remember";
import { SparkleBurst } from "@/components/moments/effects";
import { PolaroidDevelop } from "@/components/moments/PolaroidDevelop";
import { Body, Button, PaperCard, PaperTexture, Title } from "@/components/ui";
import { daysUntil, startOfToday } from "@/lib/dates";
import { saveGift } from "@/lib/gifts";
import { birthdayOf, ageOn } from "@/lib/importantDates";
import { hasSeenBeginning, hasSeenBirthday, markBeginningSeen, markBirthdaySeen } from "@/lib/moments";
import { Alert } from "react-native";
import { colors, space } from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppState, Modal, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { ANNIVERSARY_SUNSET, Lanterns, SandWriting, YearStones } from "./Anniversary";
import { Balloons, Bunting, CakeSticker, GiftSticker, Petals } from "./Birthday";
import { JarSticker, NewMemoryTag, RememberPolaroid, SeaBottles, WashedBottle, WriteBottleSticker } from "./OceanObjects";
import { ChapterUnlock } from "./ChapterUnlock";
import { CHAPTERS, unlockedItems, type BeachItem, type ChapterNumber } from "./chapters";
import { Clouds } from "./Clouds";
import { Campfire, Hut, Starfish, StringLights } from "./Decor";
import { DevPanel, type DevOverrides } from "./DevPanel";
import { useBeachLayout } from "./layout";
import { CameraTowel, MessageBottle, RadioSticker, SandPolaroid, Shells, TodayNote, WoodenSign } from "./objects";
import { Palm } from "./Palm";
import { Sand } from "./Sand";
import { Sea } from "./Sea";
import { Sky } from "./Sky";
import { greeting, localHour, nightFactor, OVERRIDE_HOURS, timeName } from "./time";
import { daysOfUs, useBeachData } from "./useBeachData";

const seenKey = (userId: string) => `beach.seenChapter.${userId}`;

// Items added by the chapter being celebrated spring in; everything else is
// just there. (Top-level on purpose: defining it inside BeachScene would
// remount every wrapped item on each render.)
function Pop({
  item,
  popChapter,
  popKey,
  sparkleAt,
  children,
}: {
  item: BeachItem;
  popChapter: ChapterNumber | null;
  popKey: number;
  sparkleAt?: { x: number; y: number }; // where the item sits — a gentle sparkle burst plays there
  children: ReactNode;
}) {
  const addedBy = CHAPTERS.find((c) => c.items.includes(item))?.number;
  if (popChapter === null || addedBy !== popChapter) return <>{children}</>;
  return (
    <Animated.View
      key={`${item}-${popKey}`}
      entering={FadeInDown.springify().damping(12).delay(500)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {children}
      {sparkleAt ? <SparkleBurst x={sparkleAt.x} y={sparkleAt.y} seed={`${item}-${popKey}`} delay={700} /> : null}
    </Animated.View>
  );
}

// The living beach (Home). Layers back→front: sky, sun/moon + stars, clouds,
// sea + waves, sand + footprints, palms, objects. See DESIGN.md → The beach.
export function BeachScene() {
  const layout = useBeachLayout();
  const { data, error, reload } = useBeachData();

  // ---- animation gating: focused tab + foreground app + motion allowed ----
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);
  const active = focused && appActive && !reduceMotion;
  // Web (Safari runs Reanimated frames on the JS thread): a lighter beach —
  // stars hold still and only the front wave moves. Looks almost the same.
  const webLite = Platform.OS === "web";

  // ---- time of day (re-evaluated every minute) ----
  const [now, setNow] = useState(localHour());
  useEffect(() => {
    if (!focused) return;
    setNow(localHour());
    const t = setInterval(() => setNow(localHour()), 60_000);
    return () => clearInterval(t);
  }, [focused]);

  // ---- dev overrides (__DEV__ only) ----
  const [dev, setDev] = useState<DevOverrides>({ time: "auto", chapter: "auto", birthday: "auto", everything: false, anniversary: false, extraStones: 0 });
  const [devOpen, setDevOpen] = useState(false);
  // __DEV__ "Show every object": every conditional object on at once, with
  // stand-in data where there's none — for layout reviews (never in production).
  const showAll = __DEV__ && dev.everything;

  // ---- birthday mode (local date; dev can force it for either of you) ----
  const birthday = (() => {
    if (!data) return null;
    if (showAll && dev.birthday === "auto" && !data.birthdayToday) {
      return { personId: data.partnerId ?? data.userId, name: data.partnerFirstName ?? "Sam", age: 25 };
    }
    if (dev.birthday === "off") return null;
    if (dev.birthday === "auto") return data.birthdayToday;
    const personId = dev.birthday === "me" ? data.userId : data.partnerId;
    if (!personId) return null;
    const row = birthdayOf(data.dates, personId);
    const name = (dev.birthday === "me" ? data.firstName : data.partnerFirstName) ?? "you";
    return { personId, name, age: row ? ageOn(row.date) : 0 };
  })();
  const myBirthday = !!birthday && !!data && birthday.personId === data.userId;

  // ---- anniversary mode (relationship_start's month/day; dev can force it) ----
  const anniv = !data
    ? null
    : __DEV__ && dev.anniversary
      ? { isToday: true, year: Math.max(1, data.anniversary.reached), reached: Math.max(1, data.anniversary.reached) }
      : data.anniversary;
  const annivToday = !!anniv?.isToday && !!anniv.year;
  const stoneCount = (data?.yearStones ?? 0) + (__DEV__ ? dev.extraStones : 0);

  // A soft golden sky all day on a birthday, the anniversary sunset on the
  // anniversary (unless the dev panel forces a time).
  const hour = dev.time !== "auto" ? OVERRIDE_HOURS[dev.time] : annivToday ? 18 : birthday ? 17.4 : now;
  const sunset = annivToday && dev.time === "auto" ? ANNIVERSARY_SUNSET : undefined;
  const night = nightFactor(hour);
  const tod = timeName(hour);
  const chapter: ChapterNumber = showAll ? 4 : dev.chapter === "auto" ? (data?.chapter ?? 1) : dev.chapter;
  const items = new Set<BeachItem>(unlockedItems(chapter));

  // ---- chapter unlock moment (once per user per chapter) ----
  const [unlock, setUnlock] = useState<{ chapter: ChapterNumber; key: number } | null>(null);
  const [popChapter, setPopChapter] = useState<ChapterNumber | null>(null);
  const [popKey, setPopKey] = useState(0);

  const closeUnlock = useCallback(() => setUnlock(null), []);
  const celebrate = useCallback((c: ChapterNumber) => {
    setPopChapter(c);
    setPopKey((k) => k + 1);
    setUnlock({ chapter: c, key: Date.now() });
  }, []);

  // ---- "It all started here": first time this user reaches Home as a complete couple ----
  const [beginning, setBeginning] = useState<"checking" | "show" | "done">("checking");
  useEffect(() => {
    if (!data || beginning !== "checking") return;
    if (!data.partnerJoined) {
      setBeginning("done");
      return;
    }
    hasSeenBeginning(data.userId).then((seen) => setBeginning(seen ? "done" : "show"));
  }, [data, beginning]);
  const finishBeginning = useCallback(() => {
    if (data) markBeginningSeen(data.userId);
    setBeginning("done");
  }, [data]);

  // ---- birthday moment: the birthday person's first open that day (per year) ----
  const [bdayMoment, setBdayMoment] = useState<"checking" | "show" | "done">("checking");
  useEffect(() => {
    if (!data || beginning !== "done" || bdayMoment !== "checking") return;
    if (!data.birthdayToday || data.birthdayToday.personId !== data.userId) {
      setBdayMoment("done");
      return;
    }
    hasSeenBirthday(data.userId, new Date().getFullYear()).then((seen) => setBdayMoment(seen ? "done" : "show"));
  }, [data, beginning, bdayMoment]);
  const finishBirthday = useCallback(() => {
    if (data) markBirthdaySeen(data.userId, new Date().getFullYear());
    setBdayMoment("done");
  }, [data]);

  // ---- anniversary moment: first open on the anniversary (per person, per year) ----
  const [annivMoment, setAnnivMoment] = useState<"checking" | "show" | "done">("checking");
  useEffect(() => {
    if (!data || beginning !== "done" || bdayMoment !== "done" || annivMoment !== "checking") return;
    if (!annivToday || !anniv?.year) {
      setAnnivMoment("done");
      return;
    }
    hasSeenAnniversary(data.userId, anniv.year).then((seen) => setAnnivMoment(seen ? "done" : "show"));
  }, [data, beginning, bdayMoment, annivMoment, annivToday, anniv?.year]);
  const finishAnniversary = useCallback(() => {
    if (data && anniv?.year && !(__DEV__ && dev.anniversary)) markAnniversarySeen(data.userId, anniv.year);
    setAnnivMoment("done");
  }, [data, anniv?.year, dev.anniversary]);

  // __DEV__: replay the polaroid-develop moment with the latest memory
  const [developReplay, setDevelopReplay] = useState(false);

  // ---- "Remember when…" (same memory for both of you today) ----
  const [forceRemember, setForceRemember] = useState(false); // dev: phone-only pick
  const [shareRemember, setShareRemember] = useState(false); // dev: real shared pick
  const [remember, setRemember] = useState<RememberMemory | null>(null);
  const [rememberOpen, setRememberOpen] = useState(false);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const pick = await getTodaysRemember(
        data.coupleId,
        data.rememberPool.map((m) => ({ id: m.id, title: m.title, description: m.description, date: m.date, created_at: m.created_at })),
        { force: forceRemember, shareToday: shareRemember },
      ).catch((e) => {
        console.log("[Beach] remember-when failed:", e.message);
        return null;
      });
      if (cancelled) return;
      if (!pick) return setRemember(null);
      const full = data.rememberPool.find((m) => m.id === pick.id)!;
      const imageUrl = full.imagePath ? await getSignedMediaUrl(full.imagePath, 3600).catch(() => null) : null;
      if (cancelled) return;
      setRemember({ id: full.id, title: full.title, description: full.description, date: full.date, song: full.song, imageUrl, cacheKey: full.imagePath });
    })();
    return () => {
      cancelled = true;
    };
  }, [data, forceRemember, shareRemember]);

  useEffect(() => {
    // One moment at a time: the chapter unlock waits for the intro, the birthday and the anniversary moments.
    if (!data || dev.chapter !== "auto" || beginning !== "done" || bdayMoment !== "done" || annivMoment !== "done") return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(seenKey(data.userId));
        const seen = raw ? Number(raw) : null;
        if (seen === null) {
          // First visit: chapter 1 is just "the beach"; only celebrate if they arrive later on.
          if (data.chapter > 1) celebrate(data.chapter);
        } else if (data.chapter > seen) {
          celebrate(data.chapter);
        }
        if (seen === null || data.chapter > seen) {
          await AsyncStorage.setItem(seenKey(data.userId), String(data.chapter));
        }
      } catch (e: any) {
        console.log("[Beach] seen-chapter storage failed:", e.message);
      }
    })();
  }, [data?.userId, data?.chapter, dev.chapter, celebrate, beginning, bdayMoment, annivMoment]);

  const { W, shoreY, band, palmHeight, polaroidWidth } = layout;
  const onSky = night > 0.5 ? colors.onDark : colors.inkOcean;

  // Palm crown positions (for the string lights).
  const leftCrown = { x: layout.palmLeft.x + palmHeight * 0.05, y: layout.palmLeft.y - palmHeight * 0.83 };
  const rightCrown = { x: layout.palmRight.x - palmHeight * 0.05, y: layout.palmRight.y - palmHeight * 0.78 };

  return (
    <View style={styles.root}>
      {/* ---- scenery (not tappable) ---- */}
      <Sky layout={layout} hour={hour} active={active && !webLite} sunset={sunset} />
      <Clouds layout={layout} active={active} dim={night} />
      <Sea layout={layout} active={active} dim={night} lite={webLite} />
      <Sand layout={layout} dim={night} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <PaperTexture opacity={0.35} />
      </View>

      {/* ---- anniversary: lanterns rising over the sea, words in the sand ---- */}
      {annivToday && (
        <Lanterns W={W} horizonY={layout.horizonY} shoreY={shoreY} topY={layout.insets.top + 40} active={active} />
      )}
      {annivToday && anniv?.year && (
        <SandWriting text={yearsLabel(anniv.year)} x={W * 0.3} y={shoreY + band * 0.58} maxWidth={W * 0.44} />
      )}
      {/* one engraved stone per anniversary reached — every day after, too */}
      <YearStones count={stoneCount} left={W * 0.64} top={layout.groundBottom - 88} maxWidth={W * 0.34} />

      {items.has("hut") && (
        <Pop item="hut" popChapter={popChapter} popKey={popKey} sparkleAt={{ x: layout.hut.x, y: layout.hut.y - 50 }}>
          <Hut x={layout.hut.x} y={layout.hut.y} width={Math.min(W * 0.3, 130)} />
        </Pop>
      )}

      {data && (
        <>
          <Shells
            count={showAll ? Math.max(12, data.memoryCount) : data.memoryCount}
            colorful={items.has("colorfulShells")}
            W={W}
            shoreY={shoreY}
            band={band}
            onPress={() => router.navigate("/story")}
          />

          {items.has("starfish") && (
            <Pop item="starfish" popChapter={popChapter} popKey={popKey} sparkleAt={layout.starfish}>
              <Starfish x={layout.starfish.x} y={layout.starfish.y} />
            </Pop>
          )}

          {items.has("palm2") && (
            <Pop item="palm2" popChapter={popChapter} popKey={popKey} sparkleAt={{ x: layout.palmRight.x, y: layout.palmRight.y - palmHeight * 0.7 }}>
              <Palm x={layout.palmRight.x} baseY={layout.palmRight.y} height={palmHeight * 0.9} active={active} delay={900} flip />
            </Pop>
          )}

          <Palm x={layout.palmLeft.x} baseY={layout.palmLeft.y} height={palmHeight} active={active}>
            <View style={[styles.notePin, { left: palmHeight * 0.25 - 24, top: palmHeight * 0.45 }]}>
              <TodayNote status={data.today} onPress={() => router.push("/activity/today")} />
            </View>
          </Palm>

          {items.has("stringLights") && (
            <Pop item="stringLights" popChapter={popChapter} popKey={popKey} sparkleAt={{ x: (leftCrown.x + rightCrown.x) / 2, y: Math.max(leftCrown.y, rightCrown.y) + 40 }}>
              <StringLights from={leftCrown} to={rightCrown} glow={night} />
            </Pop>
          )}

          {items.has("campfire") && (
            <Pop item="campfire" popChapter={popChapter} popKey={popKey} sparkleAt={{ x: layout.campfire.x, y: layout.campfire.y - 30 }}>
              <Campfire x={layout.campfire.x} y={layout.campfire.y} lit={tod === "goldenHour" || tod === "dusk" || tod === "night"} active={active} />
            </Pop>
          )}

          <SandPolaroid
            x={layout.polaroid.x}
            top={layout.polaroid.y}
            width={polaroidWidth}
            memory={data.latestMemory}
            onPress={() =>
              data.latestMemory ? router.push(`/memory/${data.latestMemory.id}`) : router.push("/memory/create")
            }
          />

          <WoodenSign
            x={layout.sign.x}
            baseY={layout.sign.y}
            width={Math.min(W * 0.4, 176)}
            daysOfUs={daysOfUs(data.relationshipStart)}
            countdown={annivToday ? "Happy anniversary 🌅" : data.signCountdown}
            onPress={() => router.navigate("/us")}
            onLongPress={__DEV__ ? () => setDevOpen(true) : undefined}
          />

          <CameraTowel
            left={layout.towel.x}
            top={layout.towel.y}
            width={Math.min(W * 0.4, 170)}
            onPress={() => router.push("/memory/create")}
          />

          <RadioSticker
            left={layout.radio.x}
            top={layout.radio.y}
            maxWidth={W - layout.radio.x - space.sm}
            status={data.todaySong}
            partnerName={data.partnerFirstName}
            onPress={() => router.push("/music/today")}
          />

          {/* ---- birthday mode ---- */}
          {birthday && (
            <>
              <Bunting from={leftCrown} to={items.has("palm2") ? rightCrown : { x: W * 0.97, y: leftCrown.y + 20 }} />
              <Balloons x={layout.palmLeft.x + palmHeight * 0.05} y={layout.palmLeft.y - palmHeight * 0.3} active={active} />
              <CakeSticker x={layout.towel.x + Math.min(W * 0.4, 170) - 52} y={layout.towel.y - 14} />
            </>
          )}

          {/* ---- a sealed gift for me: waiting (≤7 days, content never fetched) or unlocked ---- */}
          {(showAll ||
            data.unlockedGiftId ||
            (data.giftWaiting && daysUntil(new Date(data.giftWaiting.nextUnlockAt.getFullYear(), data.giftWaiting.nextUnlockAt.getMonth(), data.giftWaiting.nextUnlockAt.getDate()), startOfToday()) <= 7)) && (
            <GiftSticker
              left={layout.bottle.x}
              top={layout.bottle.y}
              unlocked={!!data.unlockedGiftId}
              daysLeft={data.giftWaiting ? Math.max(0, Math.ceil((data.giftWaiting.nextUnlockAt.getTime() - Date.now()) / 86_400_000)) : showAll ? 3 : 0}
              active={active}
              onOpen={() => data.unlockedGiftId && router.push({ pathname: "/gift/[id]", params: { id: data.unlockedGiftId } })}
            />
          )}

          {/* ---- bottles in the ocean ---- */}
          <SeaBottles count={showAll ? Math.max(3, data.bottlesInTransit) : data.bottlesInTransit} y={layout.seaBottles.y} xFrom={layout.seaBottles.xFrom} xTo={layout.seaBottles.xTo} active={active} />
          {(showAll || data.washedBottleIds.length > 0) && (
            <WashedBottle
              left={layout.washed.x}
              top={layout.washed.y - (showAll || data.unlockedGiftId || data.giftWaiting ? 56 : 0)}
              count={showAll ? Math.max(2, data.washedBottleIds.length) : data.washedBottleIds.length}
              active={active}
              onPress={() => data.washedBottleIds[0] && router.push({ pathname: "/bottle/[id]", params: { id: data.washedBottleIds[0] } })}
            />
          )}
          {(showAll || data.partnerJoined) && (
            <WriteBottleSticker left={layout.writeBottle.x} top={layout.writeBottle.y} onPress={() => router.push("/bottle/write")} />
          )}
          {(showAll || data.jar.total > 0) && (
            <JarSticker left={layout.jar.x} top={layout.jar.y} unopened={showAll ? Math.max(1, data.jar.unopened) : data.jar.unopened} onPress={() => router.push("/bottle/jar")} />
          )}

          {/* ---- "what do you remember?" for my partner's new memory (3 days) ---- */}
          {(showAll || data.newMemoryFromPartner) && (
            <NewMemoryTag
              x={layout.polaroid.x}
              top={layout.polaroid.y - 30}
              width={polaroidWidth + 34}
              partnerName={data.partnerFirstName ?? "Your partner"}
              title={data.newMemoryFromPartner?.title ?? "Sunset at the pier"}
              onPress={() =>
                data.newMemoryFromPartner &&
                router.push({ pathname: "/memory/[id]", params: { id: data.newMemoryFromPartner.id, section: "reflect" } })
              }
            />
          )}

          {/* ---- "Remember when…" at the tide line ---- */}
          {(showAll || remember) && (
            <RememberPolaroid
              left={layout.remember.x}
              top={layout.remember.y}
              seed={remember?.id ?? "show-all"}
              uri={remember?.imageUrl ?? data.latestMemory?.imageUrl ?? null}
              cacheKey={remember?.cacheKey ?? data.latestMemory?.imagePath ?? null}
              onPress={() => remember && setRememberOpen(true)}
            />
          )}

          {data.inviteCode && (
            <MessageBottle
              left={layout.bottle.x}
              top={layout.bottle.y}
              maxWidth={W - layout.bottle.x - space.md}
              code={data.inviteCode}
              active={active}
            />
          )}
        </>
      )}

      {/* ---- quiet greeting ---- */}
      <View style={[styles.greeting, { top: layout.insets.top + space.sm }]} pointerEvents="none">
        <Title variant="headingItalic" color={onSky} center style={styles.greetingText}>
          {annivToday
            ? "Another year of us 🌅"
            : birthday
            ? myBirthday
              ? `Happy birthday, ${birthday.name} 🎂`
              : `It's ${birthday.name}'s birthday — make it special`
            : greeting(hour, data?.firstName)}
        </Title>
      </View>

      {birthday && <Petals width={W} height={layout.H} active={active} />}

      {error && !data && (
        <View style={styles.errorWrap}>
          <PaperCard style={styles.errorCard}>
            <Body center>The tide took that one — couldn't load your beach.</Body>
            <Button title="Try again" variant="soft" onPress={reload} style={styles.retry} />
          </PaperCard>
        </View>
      )}

      {unlock && (
        <ChapterUnlock key={unlock.key} chapter={unlock.chapter} onDone={closeUnlock} />
      )}

      {/* Full-screen moments open in their own modal so they sit above the tab bar;
          the modal's fade is the crossfade back into the (real-time) beach. */}
      <Modal visible={!!data && beginning === "show"} transparent animationType="fade" statusBarTranslucent onRequestClose={finishBeginning}>
        {data && beginning === "show" && (
          <Beginning
            relationshipStart={data.relationshipStart}
            note={data.welcomeNoteFromPartner}
            noteFrom={data.partnerFirstName}
            onDone={finishBeginning}
          />
        )}
      </Modal>

      <Modal visible={!!data && bdayMoment === "show"} transparent animationType="fade" statusBarTranslucent onRequestClose={finishBirthday}>
        {data && bdayMoment === "show" && (
          <BirthdayMoment
            name={data.firstName ?? "you"}
            age={data.birthdayToday?.age ?? 0}
            hasGift={!!data.unlockedGiftId}
            onDone={finishBirthday}
            onOpenGift={() => {
              finishBirthday();
              const id = data.unlockedGiftId;
              if (id) setTimeout(() => router.push({ pathname: "/gift/[id]", params: { id } }), 350);
            }}
          />
        )}
      </Modal>

      <Modal visible={!!data && annivMoment === "show"} transparent animationType="fade" statusBarTranslucent onRequestClose={finishAnniversary}>
        {data && annivMoment === "show" && anniv?.year && (
          <AnniversaryMoment
            dateLabel={dayMonthLabel(data.relationshipStart)}
            years={anniv.year}
            days={daysOfUs(data.relationshipStart)}
            onDone={finishAnniversary}
            onWatch={() => {
              const year = anniv.year;
              finishAnniversary();
              setTimeout(() => router.push({ pathname: "/anniversary/[year]", params: { year: String(year) } }), 350);
            }}
          />
        )}
      </Modal>

      <Modal visible={rememberOpen && !!remember} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setRememberOpen(false)}>
        {rememberOpen && remember && data && (
          <RememberCard
            memory={remember}
            myId={data.userId}
            onClose={() => setRememberOpen(false)}
            onWrite={() => {
              setRememberOpen(false);
              setTimeout(() => router.push({ pathname: "/memory/[id]", params: { id: remember.id, section: "reflect" } }), 350);
            }}
            onOpen={() => {
              setRememberOpen(false);
              setTimeout(() => router.push({ pathname: "/memory/[id]", params: { id: remember.id } }), 350);
            }}
          />
        )}
      </Modal>

      <Modal visible={developReplay && !!data} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDevelopReplay(false)}>
        {developReplay && data && (
          <PolaroidDevelop
            uri={data.latestMemory?.imageUrl ?? null}
            cacheKey={data.latestMemory?.imagePath}
            title={data.latestMemory?.title ?? "Our first memory"}
            onDone={() => setDevelopReplay(false)}
          />
        )}
      </Modal>

      {__DEV__ && (
        <DevPanel
          visible={devOpen}
          value={dev}
          onChange={setDev}
          onReplayUnlock={() => {
            setDevOpen(false);
            setTimeout(() => celebrate(chapter), 350);
          }}
          // (350ms: let the dev panel's modal finish closing first — iOS)
          onReplayBeginning={() => {
            setDevOpen(false);
            setTimeout(() => setBeginning("show"), 350);
          }}
          onReplayReveal={() => {
            setDevOpen(false);
            setTimeout(() => router.push({ pathname: "/activity/today", params: { replayReveal: "1" } }), 350);
          }}
          onReplayDevelop={() => {
            setDevOpen(false);
            setTimeout(() => setDevelopReplay(true), 350);
          }}
          onForceRemember={() => {
            setDevOpen(false);
            setForceRemember(true);
            setTimeout(() => setRememberOpen(true), 1200);
          }}
          onShareRemember={() => {
            setDevOpen(false);
            setForceRemember(false);
            setShareRemember(true);
            setTimeout(() => setRememberOpen(true), 1500);
          }}
          onSealTestGift={async () => {
            setDevOpen(false);
            if (!data?.partnerId) return Alert.alert("No partner yet", "A test gift needs a partner to send it to.");
            try {
              await saveGift({
                coupleId: data.coupleId,
                senderId: data.userId,
                recipientId: data.partnerId,
                message: "A little test gift from the dev panel 🎁 If you can read this, it unlocked.",
                song: null,
                unlockAt: new Date(Date.now() + 60_000),
              });
              Alert.alert("Sealed", "It unlocks for your partner in about a minute.");
            } catch (e: any) {
              Alert.alert("Couldn't seal it", e.message ?? String(e));
            }
          }}
          onForceAnniversary={() => {
            setDevOpen(false);
            const on = !dev.anniversary;
            setDev({ ...dev, anniversary: on });
            if (on) setTimeout(() => setAnnivMoment("show"), 400);
          }}
          onPreviewRecap={() => {
            setDevOpen(false);
            setTimeout(() => router.push({ pathname: "/anniversary/[year]", params: { year: "preview" } }), 350);
          }}
          onClose={() => setDevOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deepOcean, overflow: "hidden" },
  notePin: { position: "absolute" },
  greeting: { position: "absolute", left: space.xl, right: space.xl },
  greetingText: { fontSize: 18, lineHeight: 24, opacity: 0.9 },
  errorWrap: { ...StyleSheet.absoluteFill, justifyContent: "center", padding: space.xl },
  errorCard: { padding: space.xl },
  retry: { marginTop: space.lg, alignSelf: "center" },
});
