# DESIGN.md — "Us"

The permanent design source of truth. Every screen follows this file. If a screen needs something this file doesn't cover, add it here first, then build it. Code tokens live in `src/theme/` and must match this file.

## Concept

**A handmade scrapbook left on a warm beach.**

- The **beach** (Home) is the one bold, animated, living element: the sky, the sea and the sand move, and they change with the time of day.
- **Everything else is paper on top of it:** polaroids, washi tape, ticket stubs, handwriting, and pages with a little grain. Screens feel collected and personal, not manufactured.
- **Things you tap feel like objects** where it makes sense: a message in a bottle, a photo, a wooden sign, a shell, a ticket. A plain button is fine for plain actions such as "Save" or "Sign out".

**Avoid generic app UI:**
- No rows of identical rounded cards with the same grey shadow. Vary the objects: a polaroid next to a ticket next to a handwritten note.
- No ALL-CAPS labels, anywhere.
- No "→" or chevrons on buttons.
- No cold greys. Every neutral is warm: sand, paper or ink.
- No stock "card list" screens. When a screen is a list, make its items physical: polaroids, stubs, notes.

## Color

### Core palette

| Token | Hex | Use |
|---|---|---|
| `deepOcean` | `#071A2B` | Night sky, deep water, dark surfaces, primary ink on light paper for headings |
| `ocean` | `#126E82` | Water, primary buttons on paper, links |
| `sky` | `#7EC8E3` | Daytime sky, soft accents, focus rings |
| `sand` | `#F5D7A1` | Beach, warm highlights, tape, soft buttons |
| `sunset` | `#FF8C69` | Golden hour, warm accents, active states |
| `warmWhite` | `#FFF8EF` | Polaroid borders, text on dark, lightest paper |
| `coral` | `#FF6B6B` | **Hearts and key moments only**: the reveal, anniversaries, "both answered". Never a generic button color. |

### Paper and ink (derived)

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FBF1E1` | Default page background (warmWhite pushed toward sand) |
| `paperDeep` | `#F3E2C4` | Recessed paper: inputs, wells, the back of a ticket |
| `paperEdge` | `#E7CFA6` | Hairlines, torn edges, input borders |
| `ink` | `#2B2520` | Body text on paper (a warm near-black, never pure #000) |
| `inkSoft` | `#6E5F52` | Secondary text |
| `inkFaint` | `#A8968A` | Placeholders, disabled text |
| `inkOcean` | `#0E3A4F` | Headings on paper (deepOcean lifted slightly toward ocean) |
| `onDark` | `#FFF8EF` | Text on deepOcean or ocean (= warmWhite) |
| `onDarkSoft` | `rgba(255,248,239,0.72)` | Secondary text on dark |
| `danger` | `#C4553F` | Destructive actions only (the "Delete memory" button, the destructive row in a menu). A warm terracotta, never coral. |

### Tape colors (washi)

`tapeSand #F5D7A1` · `tapeSky #BFE3F0` · `tapeCoral #FFB4A8` · `tapeMint #CDE8D5`. Always drawn at about 85% opacity, so they read as translucent paper.

### Time-of-day sky gradients (the beach)

Top to bottom, three stops. The beach **blends smoothly** between keyframes by local time, using `skyKeyframes` in `src/theme/colors.ts` with smoothstep interpolation, so the sky never jumps.

| Name | Around | Stops |
|---|---|---|
| `dawn` | 05:00–07:30 (peak 06:00) | `#2B3A67` → `#C77D9B` → `#FFB38A` |
| `day` | 07:30–17:00 | `#4FA9D6` → `#7EC8E3` → `#D7EEF5` |
| `goldenHour` | 17:00–19:00 (peak 18:00) | `#6A5A9E` → `#FF8C69` → `#F5D7A1` |
| `dusk` | 19:00–20:30 (peak 19:18) | `#1C2552` → `#6B4A7E` → `#D9787A` |
| `night` | 20:30–04:30 | `#030C16` → `#071A2B` → `#123A55` |

### Scene colors (the beach)

`scene.*` in `src/theme/colors.ts`: the sea from `seaDeep #0E4F63` through `sea` and `seaLight` to `seaShallow #7EC8E3`, `foam` (warmWhite), `sand` / `sandLight` / `sandShadow`, `footprint`, palm trunk and leaves (`#B07A48`, `#3E8C6A`), `wood` / `woodDark` for the sign, `sun #FFD27A`, `moon #FFF4D6`, towel stripes (sunset and warmWhite), fire, bulb, hut, and a five-color shell set (Chapter 2+) against a plain `shellPlain` for Chapter 1.

## Type

Three families, each with one job:

- **Fraunces:** headings and emotional moments such as the days-together count, the reveal, or a memory's title. Use the *italic* for warmth ("our little beach", names, dates said out loud). Only the static cuts ship, so the variable "SOFT" axis isn't available; use the italic instead.
- **Nunito:** all UI text: body, labels, buttons, inputs.
- **Caveat:** **only** handwritten captions and personal notes, such as a polaroid caption, a partner's answer, or a note on the back of a ticket. Never for UI labels or buttons.

### Scale

| Token | Family / weight | Size / line height | Use |
|---|---|---|---|
| `display` | Fraunces SemiBold | 44 / 48 | One per screen at most: the big number or moment |
| `title` | Fraunces SemiBold | 30 / 36 | Screen titles |
| `titleItalic` | Fraunces Italic | 30 / 36 | Warm screen titles ("Our story") |
| `heading` | Fraunces SemiBold | 22 / 28 | Section and object titles |
| `headingItalic` | Fraunces SemiBold Italic | 22 / 28 | Emotional sub-moments |
| `bodyLarge` | Nunito Regular | 18 / 26 | Lead paragraph, prompts |
| `body` | Nunito Regular | 16 / 24 | Default text |
| `bodyStrong` | Nunito Bold | 16 / 24 | Emphasis, values |
| `label` | Nunito Bold | 14 / 20 | Field labels, small headers (sentence case, never caps) |
| `button` | Nunito ExtraBold | 16 / 20 | Buttons |
| `small` | Nunito SemiBold | 13 / 18 | Meta: dates, counts, badges |
| `hand` | Caveat Bold | 26 / 28 | Handwritten captions and notes |
| `handSmall` | Caveat Medium | 20 / 22 | Small captions on polaroids |

Letter spacing is 0 everywhere except `display` (−0.5). Do not use tracking for emphasis.

## Shape and surfaces

**Paper:** the default screen background is `paper` with a tiled grain texture (`assets/textures/paper-grain.png`, generated in-repo at about 6–8% visible specks). `PaperCard` is a raised sheet of the same paper. Use it sparingly, at most one or two per screen. Most content sits directly on the page.

**Polaroid:** a white (`warmWhite`) border of 8px on three sides and 28px at the bottom, with the caption written in Caveat in the bottom band. Each polaroid is rotated −3° to 3°, seeded by its id, so it's random but stable between renders. Grids of polaroids never align perfectly, and that's the point.

**Washi tape:** a translucent strip (tape colors above) about 64×20, rotated −8° to 8°, overlapping the top edge of a photo or note to "pin" it. At most one or two strips per object.

**Ticket:** for codes and one-off tokens, such as the invite code. A paper stub with notched sides (half-circles cut out, drawn in the page color) and a dashed perforation line.

**Radius by object:** there is no single app-wide radius.

| Object | Radius |
|---|---|
| Polaroid / photo | 2 |
| Paper card / note | 6 |
| Input | 12 |
| Ticket | 14 |
| Button | 999 (pill) |
| Tab bar | 30 |
| Badge | 6 |

**Shadows are warm, never grey:** the shadow color is `#7A4A1E` (a sunburnt brown).

| Token | Offset / blur / opacity | Use |
|---|---|---|
| `lifted` | 0,2 / 6 / 0.12 | Tape, small objects |
| `paper` | 0,4 / 12 / 0.14 | Paper cards, polaroids |
| `floating` | 0,10 / 24 / 0.20 | Tab bar, modals, the active object |

**Spacing:** 4-pt base. `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`. The screen gutter is 20.

## Motion

- **Every tappable object** springs to scale 0.96 on press (damping 15, stiffness 320) with a light haptic (`Haptics.impactAsync(Light)`, or `selectionAsync` for tab switches). Use `PressableScale` for this; don't hand-roll it.
- **Entrances only for key moments:** the reveal, a newly saved memory, the invite code. Subtle: fade plus 8–12px rise, about 420ms. Ordinary screens don't animate in.
- **Big animation is reserved for the beach** (Phase 2) and special moments (Phase 4: the reveal, anniversaries, birthdays).
- **Respect Reduce Motion everywhere.** Check `useReducedMotion()` from Reanimated. When it's on, there's no scale spring (a slight opacity dip instead), no entrances, and a static beach. Haptics stay.

Constants live in `src/theme/motion.ts`.

## Icons

**Microsoft Fluent Emoji 3D** (MIT, `assets/icons3d/LICENSE`). They're 256×256 PNGs rendered through `<Icon3D name size />`. Use them at 28–96px. Never tint them, and never mix them with line icons on the same surface.

| Name | File | Fluent source | Used for |
|---|---|---|---|
| `beach` | beach.png | Beach with umbrella | Home tab |
| `die` | die.png | Game die | Play tab |
| `camera` | camera.png | Camera with flash | Story tab, add photos |
| `loveLetter` | love-letter.png | Love letter | Us tab |
| `gear` | gear.png | Gear | Settings tab |
| `shell` | shell.png | Spiral shell | Small beach objects, empty states |
| `palm` | palm.png | Palm tree | Beach scenery, pairing |
| `bottle` | bottle.png | Bottle with popping cork | Bottles in the ocean (messages), Today's moment |
| `cake` | cake.png | Birthday cake | Birthday mode |
| `fire` | fire.png | Fire | Streaks |
| `star` | star.png | Glowing star | Highlights, missions |
| `moon` | moon.png | Crescent moon | Night mode |
| `sun` | sun.png | Sun | Day mode |
| `wave` | wave.png | Water wave | Ocean and beach accents |
| `sparklingHeart` | sparkling-heart.png | Sparkling heart | Reveal, "both answered" |
| `gift` | gift.png | Wrapped gift | Surprises, anniversaries |
| `film` | film.png | Film frames | Videos |
| `heart` | heart.png | Red heart | Love, reactions |
| `envelope` | envelope.png | Envelope with arrow | Invites, sending |
| `calendar` | calendar.png | Spiral calendar | Dates, together-since |
| `hourglass` | hourglass.png | Hourglass done | Waiting for your partner |
| `sparkles` | sparkles.png | Sparkles | Delight, success |
| `radio` | radio.png | Radio | Our song today (beach radio, song screen) |
| `headphone` | headphone.png | Headphone | "I listened", "Open songs in" setting |
| `musicalNotes` | musical-notes.png | Musical notes | "Add a song", "Pick a song", song picker empty state |

## Copy voice

Warm, short, sentence case, and it speaks to "you two".

- ✅ "Add a memory" · "Waiting for your partner to join" · "Your turn" · "Saved to your story" · "Something went wrong — try again?"
- ❌ "ADD MEMORY" · "Submit →" · "Operation failed" · "Click here"

**Rules:**
- **Sentence case** for everything, including buttons and titles.
- **One idea per line.** An empty state is one line of direction plus one action.
- **Say "you two", "your partner" or "your person".** Say "our" only in the couple's own voice, such as titles ("Our story").
- **Errors are gentle** and say what to do next.
- **No exclamation marks** except in real celebrations (the reveal).

## The beach (Home)

A **paper-cut diorama**: every layer is a flat cut-paper shape with a soft black shadow (about 8–12% opacity, offset 2–4px) on the layer beneath, with the paper grain tiled over the scenery at 35%. Everything is drawn in code with `react-native-svg`. There are no image backgrounds, and the only images are the Fluent icons and polaroid photos. The code lives in `src/components/beach/`.

**Layers, back to front:**
1. **Sky:** the blended gradient described above.
2. **Sun or moon** on an arc from the left horizon to the right. The sun is up 06:00–19:30, the moon the rest of the time. **Stars** (three groups twinkling on different rhythms) appear only as night falls.
3. **Clouds:** three, drifting left to right at different speeds (140–190s a lap).
4. **Sea:** three wave strips moving at different speeds (the middle one in the opposite direction). The front, shallow wave's crest carries the **foam line** where the water meets the sand.
5. **Sand:** a hand-cut top edge, a wet band, and **footprints** walking from the bottom of the screen up to the polaroid.
6. **Palm trees** that sway ±1.5° around their base.
7. **Objects** (below).

At night, the sea, sand and clouds dim toward deepOcean. The objects stay readable.

**Objects:** each one is a thing you tap (`PressableScale` with a haptic), never a card.

| Object | Shows | Tap |
|---|---|---|
| Wooden sign in the sand | "{N} days of us" plus "{N} days until our anniversary", or "Happy anniversary 🌅" on the day | Us tab (dev builds: long-press opens the dev panel) |
| Polaroid stuck in the sand | Latest memory's first photo (or first video's thumbnail) with its title in Caveat. With no memories, a blank polaroid saying "Add our first memory" | That memory, or create memory |
| Folded note pinned to the palm | Today's moment: "Something's waiting for you" · "Your partner answered — your turn 👀" · "Waiting for your partner" · "Revealed ❤️" · before pairing: "This opens once your partner joins 🌊" (disabled) | Today's activity |
| Shells along the shore | One per memory, 12 at most. Plain until Chapter 2, then colorful | Story tab |
| Camera sticker on a striped towel | "Add a memory" | Create memory |
| Message in a bottle (at the waterline) | Only while the partner hasn't joined: the invite code, tap to copy | Copies the code |
| Radio sticker (bottom right, beside the towel) | Our song today: "Pick today's song" · "{Name} picked a song for you 🎧" (sand bubble) · "You picked today's song" · "You both listened ❤️" · before pairing: "This opens once your partner joins 🌊" (disabled) | Our song today screen |

A **greeting** sits at the top in quiet Fraunces italic: "Good morning / afternoon / evening / night, {first name}".

**Layout:** every position comes from `useBeachLayout()` as a fraction of the window: horizon at 34%, sand from 50%, and objects inside the sand band, which ends above the floating tab bar (`useTabBarClearance`). It's checked for both iPhone SE (667pt) and Pro Max (932pt) heights. Don't hard-code pixel positions.

**Chapters (the beach grows):** thresholds live in `src/components/beach/chapters.ts`, and a chapter unlocks at *either* count.

| Chapter | Name | Memories | Completed activities* | Adds |
|---|---|---|---|---|
| 1 | Where it started | 0 | 0 | sea, sand, one palm, sign, polaroid |
| 2 | Getting closer | 5 | 7 | second palm, starfish, colorful shells |
| 3 | Our adventures | 15 | 20 | campfire (flickers at golden hour, dusk and night), string lights between the palms (glow at night) |
| 4 | Still us | 40 | 50 | a small beach hut |

\*A completed activity is a day both partners answered. The beach never shrinks: the chapter shown is the higher of the derived and the saved one, saved to `couple_world` (`chapter`, `unlocked_items`).

**Unlock moment:** the first time *this user* sees a new chapter (tracked per user in AsyncStorage as `beach.seenChapter.<userId>`), the scene dims, "Chapter N" appears in Caveat above the chapter name in Fraunces italic, and the new items drop in with a spring. It happens once only. Chapter 1 on a first visit isn't celebrated.

**Motion rules for the beach:** everything runs on the UI thread with Reanimated shared values (`useLoop`). Animations **pause** when Home isn't the focused tab or the app is in the background. With **Reduce Motion** on, the scene is completely still, while the sky still follows the time.

**Dev panel (`__DEV__` only):** long-press the sign to force the time of day (auto / dawn / day / golden / dusk / night), force the chapter (auto / 1–4), and replay the unlock moment. It saves nothing and never ships.

## Memories (the scrapbook)

The code is in `src/components/memories/`, `src/app/(tabs)/story.tsx` and `src/app/memory/*`.

**Images:** every memory image uses **expo-image** with `cacheKey` set to the file's **storage path**, so images stay cached even though signed URLs change every time they're re-signed. Screens that show several files sign them in **one** `createSignedUrls` request (`signPaths` in lib/memories.ts). Polaroid photos use `contentFit="cover"` biased toward the upper-middle (`contentPosition` top 30%), where faces usually are.

### Story tab: the journal
- **Sort:** newest first by default, with a small Newest / Oldest toggle (shown once there are two or more memories).
- **Month headings:** a quiet Fraunces italic heading per month ("March 2026"), from `memory_date`, or `created_at` when no date was set.
- **"The beginning" page** is always present: last when newest first, first when oldest first. It shows the beach icon, "The beginning", the `relationship_start` date, and "It all started here." in Caveat.
- **Each memory is a cluster:** 1–3 overlapping polaroids (tilt seeded by media id), one washi-tape strip, the title in Fraunces, the date (plus location), and the first line of the description in Caveat. Videos show their thumbnail with a small ▶ badge and never autoplay here. Clusters **alternate left and right**.
- **A dashed footprint path** winds from each cluster to the next, like a trail in the sand.
- **Empty state:** the camera icon, "Your story starts with one memory" and an "Add a memory" button. The beginning page still shows.
- **Performance:** a FlatList with memoized clusters. URLs are signed a page at a time (visible rows plus 8 ahead) as you scroll, never all at once.

### Memory page: the collage
The layout depends on how many items there are. Positions are fractions of the content width, so they fit every iPhone.

| Count | Layout |
|---|---|
| 1 | One large polaroid |
| 2 | Two overlapping polaroids at different angles |
| 3 | One large, with two small ones tucked at the top-left and bottom-right corners |
| 4 | Four scattered, slightly overlapping |
| 5+ | The first 5 (four corners and one on top in the middle), plus a "+N more" stack. Tapping it opens a neat grid of everything |

- **Videos in the collage:** only the **first** video autoplays, muted and looped, with at most one player. It pauses when the screen loses focus. Other videos show their thumbnail with ▶.
- **Tap** any item to open the full-screen viewer at that item and swipe between all of them. **Long-press** an item, in the collage or the grid, for "Remove from memory".
- **Under the collage:** the title (Fraunces), the date and location (quiet), and the description in Nunito `bodyLarge` on a paper card with a 28px line height, followed by the primary **"Play this memory"** button and the photo/video counts.
- **"…" menu (top right):** Edit · Add photos or videos · Delete (in `danger`).

### "Play this memory" (reel)
A full-screen modal (`memory/reel`) in story format:
- **Title card:** the first photo blurred behind, the title in Fraunces italic, and the date and location.
- **Photos** show for the viewer's chosen time — 8, 15, 30 or 60s, **default 60s**, from a small "60s" button next to ✕ that opens a sheet — with a slow **Ken Burns** zoom and pan stretched across that whole time. The direction alternates each photo.
- **Videos** play **with sound** for their full length, cut at 60s. They ignore the photo speed.
- **Closing card:** "{N} photos, {M} videos — {date}", then "Play again" and "Close".
- **Thin progress bars** run across the top, one per item.
- **Controls:** tap the right side for next, the left for previous. Press and hold to pause (a "Paused" tag appears): the timer, progress bar, zoom, video and soundtrack all freeze, then carry on from the same spot. Opening the speed sheet pauses too. Swipe down to close. There's a light haptic on each advance.
- **Loading:** only the current and next items are mounted, so there are at most two video players and the next image is already loading. Everything pauses when the app goes to the background.
- **Reduce Motion:** no Ken Burns, just the plain 320ms crossfade between items (which is always used).

### Editing and deleting
- **Edit** (`memory/edit`) changes the title, date, location and description, using the same fields as New memory (`MemoryFields`) plus a date picker.
- **Add photos or videos** (`memory/add-media`) uses the same picker, HEIC→JPEG conversion, 50 MB limit, thumbnails and progress as New memory (`useMediaPicker` and `MediaTray`).
- **Delete memory:** a confirmation sheet says "Delete this memory? Its photos and videos will be removed for both of you." with "Delete memory" (in `danger`) and "Keep it".
  - Delete the **storage files first**: every media file and thumbnail, in one `storage.remove`.
  - Only then delete the `memories` row. The database cascade removes its `memory_media` rows.
  - If any file is still there afterwards, the row is **kept** and the alert lists which files failed.
- **Remove one item** follows the same storage-first rule for that file and its thumbnail, then deletes its `memory_media` row.
- **After any change,** the beach, Story and the memory page all reload when you return to them (`useFocusEffect`).

## Music

The code is in `src/lib/music.ts`, `src/lib/songs.ts`, `src/components/music/` and `src/app/music/today.tsx`. It deliberately doesn't use the Spotify API, because its 2026 developer rules need Premium, cap apps at 5 users and have removed previews.

- **Search** uses the iTunes Search API, waiting ~350ms after typing stops. Artwork is upgraded to 600×600. Each result carries its 30s `previewUrl`.
- **Links:** when a song is chosen, Odesli (song.link) is asked **once** for the song on Spotify, Apple Music, YouTube Music and Audiomack, and the links are stored in the song. If that fails, or there's no Spotify link, a Spotify search URL is used. Choosing a song is never blocked.
- **"Open songs in"** (Settings, saved per user on this phone, default Spotify) decides where "Open full song" goes. If that platform has no link, it falls back to any link the song has.
- **Previews:** one shared player in the whole app, so only one preview ever plays. Previews stop when a screen loses focus (`usePreviewStopOnBlur`) and when the app goes to the background (root layout). They play even when the phone is on silent, because a preview is always a deliberate tap.
- **Song card:** a **vinyl record**, with the cover art as the label, peeking out to the left of a warmWhite paper sleeve. It shows the title in Fraunces, the artist, a round ▶ / ❚❚ preview button and "Open full song" (soft). The record spins (one turn every 3.2s) only while its preview plays, holds its angle when paused, and never spins with Reduce Motion on. `compact` stacks it vertically for side-by-side use.
- **Song picker:** a bottom sheet with a search field and results showing cover art, title and artist. ▶ previews a song and tapping the row chooses it. Before any search it shows the musical-notes icon and "Search for a song you both love".
- **Memories:** create and edit have "Add a song" (the chosen song card has "Remove song"). The memory page shows the song card under the collage, and journal clusters with a song get a tiny vinyl badge next to the title. **The reel** loops the song's preview softly (volume 0.35) behind everything, fades it to 0.04 while a video with sound plays, and stops when the reel closes.
- **Our song today** (`daily_songs`): one song per couple per local day, where either partner can pick and **the first pick wins**. The screen offers "Pick a song", an optional note in Caveat and "Send our song". Once a song is picked, it shows the song card, "Picked by {name}", the note on taped paper, "I listened 🎧", who has listened, and "You both listened ❤️" when you both have. **Past songs** below it forms your shared playlist over time: artwork, title, artist, date, who picked it, the note, and ▶.
- **Song prompts** (activities with `response_type 'song'`) answer with the song picker instead of a text box. At the reveal, both song cards sit side by side, with **"Same song?!"** in coral when they match.

## Special moments

**One orchestrated moment per event, nothing scattered.** Every moment can be **skipped with a tap**. With **Reduce Motion** on, it shows the end state with a simple fade (Reanimated's entering and exiting animations skip themselves, and custom motion checks `useReducedMotion()`). The code is in `src/components/moments/`. "Seen once" flags are kept per user on each phone (`lib/moments.ts`, AsyncStorage). Full-screen moments on a tab open in their own transparent `Modal`, so they sit above the floating tab bar.

### "It all started here" (`Beginning.tsx`)
- **When:** the first time each user reaches Home with a **complete** couple (the partner has joined). Flag: `moments.beginning.<userId>`. It can be replayed from Us → "Replay our beginning".
- **Beats, about 13s**, each with a light haptic:

  | Time | Beat |
  |---|---|
  | 0s | Deep ocean screen with a faint, silent wave line |
  | 0.7s | "It all started here." (Fraunces italic) |
  | 3s | The beach draws in at dawn, fading in over 1.6s, as the sun rises (the sky is driven from 5:00 to 6:48 over 6.5s) |
  | 6.5s | The `relationship_start` date in Caveat |
  | 8.5s | "And we're still writing the story." |
  | 10.5s | If the **other** partner left a welcome note: a paper slip in Caveat with a coral tape strip, signed "— {their first name}" |
  | ≈12.5s | "Enter our world" |

- **Enter our world:** the modal fades out onto the real-time beach.
- **Skip:** tap anywhere to jump straight to the end card.
- **Reduce Motion:** the sun doesn't move (the sky is already at dawn) and the beats simply fade in.
- **The chapter unlock waits** until this intro is finished, so there's never more than one moment at a time.

### Welcome notes (Us tab → "Our beginning")
Each of you has **your own** note (`welcome_notes`, one per person), so writing yours never replaces theirs.
- **Their note** shows as "{partner}'s note to you" on a sand slip, signed.
- **Yours** shows as "Your note to {partner}" on a warmWhite slip, with "Edit your note". Before you've written one, the button says "Leave a note for {partner}". The editor is a Caveat sheet, up to 500 characters.
- **The intro** shows only the note written by the **other** partner.

### Birthday moment (`BirthdayMoment.tsx`)
- **When:** the birthday person's first open on their birthday (local date), **once per year**. It comes after the Beginning intro and before any chapter unlock.
- **Beats**, on a golden-hour gradient, each with a light haptic:

  | Time | Beat |
  |---|---|
  | 0.6s | "Today is your day." (Fraunces italic) |
  | 2.6s | "{age} years of you, {name}" (Caveat) |
  | 4.6s | If a birthday gift has unlocked: the wrapped gift glows, "Someone left you something.", then **"Open your gift"** and "Later". Otherwise the cake, then "Enter our world". A sparkle burst plays. |

- **Skip:** tap to jump to the end. **Reduce Motion:** fades only, no glow or sparkles.

### Unwrapping a gift (`gift/[id].tsx`)
- **When:** the recipient's first open of an unlocked gift. `opened_at` is marked as it starts.
- **Sequence:** the white ribbon pulls away (from 0.5s), the lid with its bow lifts and tilts (from 1.3s), a sparkle and success haptic (1.7s), then it fades (2.7s) into the letter in Caveat on taped paper, the song card, and the media collage with a full-screen viewer.
- **Skip:** tap. **Reduce Motion:** a fade.

### The reveal (Today's activity)
- **When:** both partners have answered and this user hasn't seen this reveal yet. Flag: `moments.reveal.<userId>.<dailyActivityId>`.
- **Two sealed envelopes** (paper, coral seal, first names in Caveat). Tap **"Open together"** or an envelope to start.
- **Timeline** (ms):

  | Time | Beat |
  |---|---|
  | 0 | My flap opens (rotateX, 520ms) |
  | 380 | My card slides out and turns to face you (rotateY 90°→0°, 780ms) |
  | 900 | Their flap opens |
  | 1280 | Their card slides out |
  | 2050 | 12 coral hearts float up and fade, with a success haptic |
  | ≈3.9s | Switches to the calm static cards |

- **Matching answers** (the same song, or the same words ignoring case and spaces) add **"Same brain again 😂❤️"** in Fraunces italic. It shows in the moment and on the static cards afterwards.
- **Skip:** tap during it and everything opens at once. **Reduce Motion** gives open cards that fade in, with no hearts.
- **Live:** while you wait, the screen listens for your partner's answer through Supabase Realtime on today's `daily_activity_id`. When it arrives, the envelopes open automatically. The listener stops when you leave the screen.
- **Waiting state:** a paper boat bobs and drifts on a wave line with "Waiting for {partner}…". "Check again" stays as a fallback.

### Polaroid develops (after saving a memory)
- The first photo (or video thumbnail), from the local file, starts **milky white**, passes through a **warm tint** and settles to true colour over **3s**. Meanwhile the title **types itself** in Caveat (55ms per character, starting at 45% of the develop).
- A success haptic, a 0.9s hold, then it goes to the memory page. Any upload failures are shown after arriving.
- **Skip:** tap to finish at once. **Reduce Motion:** the finished polaroid fades in.

### Polish
- **Chapter unlock:** the new items drop in with a spring, and a gentle **sparkle burst** (8 sparkles, about 1.1s) plays at each one, with a success haptic on the chapter card. It's still one moment.
- **The invite bottle bobs** on the waterline (±3px, ±4°). It stays still when animations are paused or Reduce Motion is on.
- **Dev panel** (long-press the sign, dev builds only) can replay the chapter unlock, the beginning, today's reveal (it opens Today's activity with `?replayReveal=1`, which ignores the seen flag) and the polaroid develop. It can also force birthday mode for you or your partner (visual only), and "Seal a test gift (1 min)" seals a birthday gift to your partner that unlocks a minute later, and "Force a Remember when today". **"Show every object"** turns on every conditional beach object at once, with stand-in data, for layout reviews.

## Important dates and birthdays

- **Our dates** (Us tab) is one list sorted by next occurrence:
  - **The beginning**, from `relationship_start` and never stored twice: the beach icon, "3 years together".
  - **Each birthday**: "{Name}'s birthday" or "Your birthday", the cake icon, "turns 25".
  - **Custom dates**: your label and chosen 3D icon, "2 years ago today", "2 years on", or "The first one".

  Each row shows the date and a countdown: "in 12 days", "Tomorrow", or "Today 🌸" in coral on a highlighted row. Tap a row to edit it. **Add** opens a sheet with three choices: my birthday, {partner}'s birthday (either of you can set either), or another day (label and icon). Dates always include the year.
- **A one-time prompt** appears on Us after pairing if your birthday is missing: "When's your birthday?", with a date picker plus Save and Not now.
- **The beach sign** shows the **nearest** upcoming date: "12 days until {Name}'s birthday 🎂", "Today: {label}", or "Happy anniversary 🌅".
- **Birthday mode** (on the day, local date), for the whole beach:
  - a **soft golden sky all day**
  - **balloons** tied to the palm, bobbing
  - **bunting** from the palm to the second palm, or to the right edge
  - a **cake sticker** on the towel
  - **petals** drifting down (still with Reduce Motion)
  - the greeting becomes "Happy birthday, {name} 🎂" for the birthday person, or "It's {name}'s birthday — make it special" for their partner
- **Sealed birthday surprise** (Us tab, **only for your partner's birthday**):
  - **Preparing:** a letter in Caveat, an optional song, and up to 10 photos or videos, sealed until local midnight at the start of their next birthday. You can edit it until it unlocks.
  - **Your status line:** "Sealed until 15 April", then "Opened ❤️" with the time.
  - **On their beach:** from 7 days before, a wrapped gift sticker at the waterline says "Something is waiting for you… {N} days". Tapping only **shakes** it, with a haptic. The content is never fetched, and the database wouldn't return it anyway.
  - **Once unlocked,** the sticker glows with "Open your gift".

## Bottles in the ocean

- **Write a bottle:** the 3D envelope-with-arrow sticker on the sand, between the towel and the radio. The compose screen (`bottle/write`) has:
  - a message in Caveat (up to 2,000 characters)
  - an optional song
  - up to 5 photos or videos, stored in the sealed folder
  - **when it should arrive**, in local time: Now · Tonight (21:00) · Tomorrow morning (08:00) · In a week · In a month · On our anniversary (08:00) · On {partner}'s birthday (08:00, if set) · In a year · **Open when…** (one of six preset labels, or your own)
- **Throw moment:** the bottle arcs from the shore into the sea (1.1s), then a splash ripple, a sparkle and a success haptic, and "On its way 🌊". Open-when letters show a letter icon and "It's in the jar 🫙" instead. Tap to skip. **Reduce Motion:** just the text.
- **On the recipient's beach:**
  - **In transit:** up to 5 tiny bottles bob far out at sea. Only the count is known, never the content. Tapping one gives a gentle haptic and a toast: "Something is drifting your way".
  - **Arrived and unopened:** the bottle washes up and bobs at the waterline, with a coral count badge if there's more than one. It moves up out of the way when a gift sticker is showing. Tap to open.
  - **Open-when jar:** a glass jar sticker, with a count of unopened notes, appears only when you have open-when letters.
- **Opening (`bottle/[id]`):** the recipient's first open plays the **unroll**: the cork pops (0.5s, with a haptic), the paper unrolls from the top (1.2s) and it fades into the letter, song and media. `opened_at` is marked as it starts. Open-when notes use the same moment, headed "Open when {label}". Opened notes stay readable, dated.
- **Us → Our bottles:**
  - **Received:** shows "Arrived {date}" / "In your jar" / "Opened {date}".
  - **Sent:** shows "Arrives 14 Nov" / "Waiting in the jar" / "Washed ashore" / "Opened ❤️ 2 Oct". Before it's opened, tapping a sent bottle offers Read it, Edit, or **Take it back**, which asks for confirmation and removes its files too.
- **Birthday gifts keep their own flow** and never appear as ocean bottles.

## Two perspectives

- **"What do you remember?"** (Fraunces) is on every memory page, after the description and "Play this memory". Links can open the page scrolled straight to it (`?section=reflect`).
- **Before you've written:**
  - a Caveat note field and **"Save my side"**
  - if your partner already wrote theirs: "{Name} already wrote theirs 👀 — write yours to read it"
  - the database won't show you their side until yours exists
- **After you've written but before they have:** your note, "Edit my side", and "Waiting for {Name}'s side…". Their side arrives live if you're on the page, and the reveal then opens by itself.
- **When both are written:** the first time, the envelope reveal plays with your two sides. After that there are two paper notes, side by side (warmWhite for you, sand for them) or stacked on narrow screens (under 380pt). "Edit my side" is always available.
- **Story journal:** a small sand "2 sides" badge under the title of memories you've both written about.
- **After your partner adds a memory,** a pinned paper note sits over the beach polaroid for 3 days: "{Name} added '{title}' — what do you remember?". It opens that memory at the section, and disappears once you've written your side.

## Remember when…

- **When:** at most one memory a day, on roughly 2 of every 5 days. It's decided from your couple and today's local date, so **both of you get the same memory**.
- **Which memory:** memories at least 30 days old. It prefers "on this day" (the same day and month in a past year, then the same day of the month), otherwise a seeded pick. Any memory picked in the last 60 days is skipped.
- **The day's pick is saved once for the couple** (`remember_days`). Whoever opens the app first picks it, and the other phone reads the same one, so you always see the same memory.
- **On the beach:** that memory's small polaroid (64pt, sky tape) washes in at the tide line on the left, labelled "Remember when…" in Caveat.
- **Card (full screen):**
  - "Remember when…", the photo in a polaroid, "{N} months ago" / "{N} years ago today", the title (Fraunces italic), the first line (Caveat), and the song ▶ if it has one
  - **"❤️ I remember"** saves a heart for today and floats a few hearts up. When both of you have hearted it: **"You both remembered this ❤️"**
  - **"Write what I remember"** opens the memory's Two perspectives section; **"Open memory"** opens the memory itself
- **Dev panel:** two buttons, both ignoring the day and 30-day rules so they work with new memories:
  - **"Force a Remember when today (this phone)"** picks on that phone only and saves nothing.
  - **"Pick today's Remember when for real (shared)"** saves today's pick for the couple, so the other phone shows the same one. If today already has a pick, it keeps that one.

## Play

**The Play tab** is a striped beach towel seen from above, tilted slightly, with the games lying on it as objects (each a `PressableScale` with a haptic, not a box). Each object has one Caveat status line under it:

| Object | Game | Status line |
|---|---|---|
| A fanned deck of cards | Questions | "{Name} asked you something 👀" / "Ask {Name} something" |
| A sealed envelope with a coral wax seal | Secret missions | "Draw today's mission" / "On a mission 🤫" / "Mission done ✅" / "Missions revealed 💌" |
| A small wooden wheel | Roulette | "Spin something fun" |
| A folded note | Today's moment | The activity's current status |

- **The tab-bar dot:** a small coral dot on the Play icon when something is waiting for you: an unanswered question your partner asked, today's activity still unanswered by you, or a revealed partner mission you haven't looked at.

**Couple questions** (`play/questions`):
- Category chips (Know you · Deep · Future · Would you rather · Fun, plus Spicy 🌶️ when it's on), then a paper card deck. The question is in Fraunces, with an "ours" mark on your own cards.
- **Swipe left to skip, right to "Ask {Name}".** There are buttons too, for the web. Skipping records nothing. Asking opens the thread for you to answer first.
- **Lists:** "Waiting for you", "Waiting for {Name}", and **Our answers** (revealed threads by category, newest first).
- **Thread:** answer in a Caveat field; the database keeps their answer hidden until yours exists. The first reveal is the envelope moment (it opens live if you're waiting), then static notes, with "Same brain again 😂❤️" when your answers match.

**Secret missions** (`play/missions`):
- **Drawing:** three face-down, wax-sealed cards fanned out. Tap one and it flips (600ms, none with Reduce Motion) to show your mission, with a category tag and a duration tag. You get one "Draw again" per day.
- **Doing it:** "Done ✅" with an optional "What I did" note in Caveat. "{Name} is on a secret mission 🤫" shows with no content.
- **Reveal:** once you've both finished, or the next day, the two missions appear side by side as open letters, with what each of you did. Under your partner's: "Did you notice?" → "I noticed 😏" / "I had no idea 😂". Their answer about yours shows once they've picked. Past missions are listed below.

**Roulette** (`play/roulette`):
- **Spinning:** mood chips (Easy · Romantic · Funny · Chaotic · Hard, plus Spicy). Each slice shows the mood's emoji (🌊 💕 😂 🌀 🔥 🌶️), never a number. An 8-segment SVG wheel spins 5 turns plus the offset over 3.8s, easing out, with a haptic tick for each segment that passes (native only). It lands on a challenge card.
- **After it lands:** "We did it ✅" and "Spin again". Recent spins read "{Name} spun · done ✅/not yet".
- **Reduce Motion:** no spin, just the card.

**Spicy mode 🌶️** (a toggle on the Play tab):
- **On only when both of you turn it on.** The line under the toggle reads:
  - "Turn on (your partner has to turn it on too)" before either of you has
  - "Waiting for {Name} to turn it on" once you have
  - "{Name} turned on spicy mode 🌶️" once they have and you haven't (**no notification or pressure message is ever sent**)
  - "Spicy mode is on" once you both have

  Either of you turning it off switches it off for both.
- **Tone:** sensual, flirty, teasing and tasteful: words, voice notes, massages, kisses, honest conversations, date nights. Never explicit, never photo requests.
- **Discretion:**
  - spicy never appears on the beach
  - summaries show **"Something spicy 🌶️"** until opened
  - every spicy card has a Skip that records nothing
  - future notifications must stay neutral

**Your own cards:** every game has "Add your own card" (text, a category, and a duration for missions). Spicy is offered only while spicy mode is on. Your cards are private to the two of you and show an "ours" mark.

## Voice notes

**Recording** (`VoiceRecorder`): a warmWhite paper note (radius 6, paper shadow) with a Caveat label ("Say it to {Name}", "Say it instead", "Say something to {Name}"…).
- **Idle:** a round ocean mic button (56px, white mic glyph) with "Tap to record · up to 1 minute / 2 minutes" in Nunito.
- **Recording:** the button turns sunset with a stop square; 32 live level bars in sunset fill the rest of the row; under it a sunset dot and the timer "0:12 / 1:00". Tap again to stop; it stops itself at the limit (60s for activities, questions and perspectives; 2 min for memories, bottles and gifts).
- **Preview:** "Have a listen", the player, then "Record again" (soft) and "Use this" (primary).
- **Mic permission:** native shows a short, warm explanation first ("…only the two of you ever hear it") with "Allow microphone" / "Not now". If it's off, the note explains exactly where to turn it on. Web browsers that can't record mp4 say "Voice notes aren't supported in this browser — try Safari or the app".

**Playing** (`VoicePlayer`): a round play/pause button (ocean on paper, warmWhite on dark), 48 rounded waveform bars that fill with the button's colour as it plays (unplayed = paperEdge), and the duration (position / total while playing). Tap or drag on the waveform to seek. Only one sound plays in the whole app at a time.

**Where it shows:**
- **Answers** (today's moment, questions, Two perspectives): the player sits inside that person's paper note, under their words if they wrote any. In the envelope reveal, a voice answer's card shows "🎙️ a voice note" (or the words) over a small static waveform; it's played on the notes that follow.
- **Memories:** never a polaroid. Each voice note is a **paper tag** (warmWhite, seeded tilt ±2°, a sky washi strip on top, Caveat "a voice note") below the collage, alternating left/right at 88% width. Long-press → remove.
- **The reel:** a voice note is its own frame: the first photo blurred behind a scrim, and a big paper card (tilted −1.5°) with "a voice note" in Caveat, a 72px-tall waveform filling as it plays, and the time. The soundtrack ducks while it plays.
- **Bottles and gifts:** up to 3 voice notes as paper tags after the letter, shown only once the unroll / unwrap moment has finished.

## Us tab (scrapbook pages)

The tab reads as one scrapbook, each section a different object, flowing into the next. Every section starts with a **SectionHeading**: a 30px 3D icon, the title in Fraunces SemiBold Italic, an optional text action ("Add"), and a hand-drawn wavy underline in paperEdge (no boxes, no caps).

Order: **Our beginning → How we met → Our dates (+ A birthday surprise) → Our favorites → Little things → Bucket list → Our bottles → Our stats.**

- **Our beginning:** the existing paper card, now with both avatars overlapping (48px, −14px overlap) instead of the beach icon.
- **How we met:** a paper page (tilted 0.5°). With a photo, it's a polaroid taped at the top (sky tape) that overlaps the page edge. Title "How we met" in Fraunces, the story in Nunito bodyLarge (12 lines, then the editor), and "Last edited by {Name}" in inkFaint. Empty: a Caveat invitation. The editor autosaves (no Save button) and shows "Saving…" / "Last edited by you" / "Couldn't save — check your connection" (danger).
- **Our favorites:** the song is a SongCard (vinyl) with its label above. Everything else is a **paper scrap**: a small rectangle in a rotating tint (warmWhite, tapeSky, tapeMint, sand, tapeCoral), a seeded ±3° tilt and a lifted shadow, with the label in Nunito small and the value in Caveat. Missing suggestions show as dashed outlines ("+ our place"). The sheet has suggestion chips (Our song / place / food / film / show / dessert / Something else).
- **Little things:** two notebook pages (warmWhite with a coral margin line on the left; theirs on `paper`), side by side at ≥400px width, otherwise stacked, tilted −0.8° / +0.8°. Each has an avatar and a title ("About me" / "About {Name}"), then ruled lines with the label in Nunito small and the answer in Caveat. Only your page has dashed "+ favorite flower" prompts and "+ your own". Theirs is read-only.
- **Bucket list:** one lined warmWhite checklist page. Open items: an ocean-outlined checkbox, the emoji, the title, and an optional "by {date}". Ticking plays a SparkleBurst on the box with a success haptic, then offers "Turn this into a memory?". **We did it** (Fraunces italic in coral, a key moment) lists done items struck through in inkSoft with an ocean hand-drawn tick, the date, and "📷 in our story" once linked.
- **Our stats:** a ruled ledger page (sky rules, mint tape). The days together is the one `display` number, then one line per stat: **tally marks** (four uprights in ink, a coral strike per five) for 1–20, Caveat numerals above 20, and the label in Nunito small. Never a grid of number cards.

## Settings

- **Profile:** your avatar (64px, tap → "Choose a new photo" / "Remove photo"), your name in Caveat with "Edit name" (a sheet), your email. Below it is your person's avatar and name.
- **Delete our world:** a small danger-colored text link at the very bottom, never a big button. Step 1 is a sheet listing exactly what goes, with a filled danger pill "I understand — continue" and "Keep everything". Step 2 is a sheet asking you to type "delete our world"; the danger pill "Delete our world" stays at 40% opacity until the phrase matches.

## Anniversary (March 29)

- **Palette:** `anniversarySky` = `#3A1E52` → `#D9507A` → `#FF9E6D`. Deeper violet and coral than golden hour, and it stays all day. The sun is big (r 34, soft halo) and rests low on the horizon at the right. Lanterns are warm amber paper (`#FFB86B`, glow `#FFD9A0`, frame `#C0613A`).
- **The beach that day:**
  - 9 paper lanterns rise slowly from the shoreline and shrink and fade toward the top of the sky (6 on web; still in the sky with Reduce Motion).
  - "{N} years of us" is written in the sand in Caveat 30, a darker sand tone (`#D9AE6E`) with a faint light edge below-right, tilted −4°, as if drawn with a finger.
  - The sign reads "Happy anniversary 🌅" and the greeting reads "Another year of us 🌅".
- **Year stones:** small warm-grey pebbles (`#CFC2B0`, shadow `#A89A87`), each engraved with its number in Nunito bold ink and given a seeded tilt of up to ±8°. They sit in a row under the sign, one per anniversary reached, and stay forever. The same stone is the icon for "Year N" in Us → Our years, on the recap title and on the closing page.
- **The moment:** a dark screen, then the sunset gradient fades in, then "29 March" (Caveat 34), "Another year of us." (Fraunces italic 36), "{N} years · {days} days together" (Nunito on onDarkSoft), then "Look back at our year" (primary, film icon) and "Later".
- **"Our year" recap:** scrapbook pages on paper, with dark full-bleed pages only for the title, the highlights and the closing.
  - Ink progress bars on paper pages, light bars on dark ones; ✕ at the top right.
  - Tallies sit on a ruled warmWhite ledger (sky rules), and the numbers count up.
  - Polaroids for first/latest and the busiest month (an overlapping collage).
  - An album-cover grid with "{artist} kept coming back" in Caveat.
  - Same brain is a big coral number with paired paper slips.
  - "We did it" is a checklist page with ocean ticks.
  - Highlights: a full-bleed photo with a slow zoom, a dark shade at the bottom, the title in Fraunces italic and the date in Caveat sand.
  - Closing: "Here's to year {N+1} 🌅" on the sunset.
- **Us → Our years:** one warmWhite paper page per year, alternating ±0.6°. Each has a stone, "Year N" (Fraunces italic 22), the date, "Watch our year" (soft, film icon) and a status line: coral once you've both answered, ocean otherwise, and it's tappable.

## Notifications

- **Settings → Notifications** (heading with the bottle icon):
  - Status line in Nunito:
    - "Notifications are on ✓" (ocean), with "Send me a test" (soft) and "Turn off here" (text).
    - "Turn on notifications" (primary, bottle icon).
    - Blocked: tells you exactly where to allow it.
    - Not installed: "Add Us to your home screen first…".
  - Five switch rows (label in Nunito bold, one-line hint in small inkSoft, ocean track): From {Name} · Bottles & gifts · Dates & reminders · Remember when · Gentle nudges.
  - Quiet hours as two pill chips ("from 23:00", "to 08:00"). Each opens a sheet with a 24-hour grid and :00/:15/:30/:45.
- **The one-time card** (`NotifyPromptCard`): a warmWhite paper note with mint tape, tilted 0.8°. "Want to know when {Name} replies?" in Caveat, a reassuring line ("never what they wrote"), then "Not now" and "Yes, tell me". It shows on the today screen while you're waiting, and in Our bottles once you've sent one — only in the installed web app, and only until answered.
- **Copy voice for notifications:** short, warm, first names, one emoji at most, and no guilt, streaks or task lists. Never private content. Anything spicy reads "Something's waiting for you 😏".

## Avatars

`Avatar` (ui): a round photo inside a warmWhite ring (ring ≈ size/18) with a lifted shadow. With no photo, it shows the first letter in Fraunces italic on sand. Sizes: 64 (Settings), 48 (Our beginning), 32 (Little things pages), 30 (the stamp on reveal envelopes, pinned to the envelope's bottom-right corner).

## Components (`src/components/ui/`)

Use these before writing a one-off:

- **`PressableScale`:** the spring and haptic wrapper. Every tappable object uses it.
- **`Button`:** `primary` (ocean pill), `soft` (sand pill) and `text` variants, with a loading state.
- **`PaperCard`:** a raised paper sheet with grain.
- **`Polaroid`:** a photo or video thumbnail with a Caveat caption and a seeded rotation.
- **`WashiTape`:** a decorative strip in four colors.
- **`Ticket`:** a notched paper stub for codes.
- **`ScreenBackground`:** `paper` or `gradient` variants, safe-area aware.
- **Text:** `Title`, `Body` and `Handwritten`, mapped to the scale above.
- **`Input`:** a paper-style field. **`DatePickerField`:** a matching trigger that opens the native date picker.
- **`EmptyState`:** a 3D icon, one line of direction and one action.
- **`Sheet` / `ActionSheet` / `ConfirmSheet`:** paper bottom sheets for menus and "are you sure?" prompts. The destructive choice uses `danger`. When one sheet leads to another (menu → confirmation), the second opens about 350ms later, because iOS can't present a modal while another is still closing.
- **`Icon3D`:** a typed Fluent icon.

The tab bar is a custom floating bar (`src/components/tab-bar.tsx`): warm translucent blur, one 3D icon per tab, and the active icon lifts and grows with its label shown underneath.
