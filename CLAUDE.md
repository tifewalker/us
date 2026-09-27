# CLAUDE.md — "Us" App

Context file for Claude Code (or any future agent session) working on this project. Read this before making changes — it captures the product intent, architecture decisions, what's actually been tested and confirmed working, and hard-won lessons from getting this far.

**All UI must follow DESIGN.md.** (Concept, colors, type scale, surfaces, motion, icon map, copy voice. Tokens live in `src/theme/`, shared components in `src/components/ui/`.)

## What this is

A private, two-person relationship app — not a productivity or social app. Built by the developer for himself and his girlfriend. No public profiles, no followers, no third party ever sees this data. Every backend decision (RLS everywhere, private storage bucket) exists to enforce that.

Core concept: the app is a digital version of their relationship — shared memories (photos/videos from real outings), small daily connection prompts with a "simultaneous reveal" mechanic (neither partner sees the other's answer until both have answered), and an animated "beach" home screen tied to where their relationship began (Phase 2 — it grows in chapters as they add memories and answer prompts).

**Key dates baked into the product (not just test data):**
- Anniversary: March 29
- His birthday: July 4, 2002
- Her birthday: April 15, 2002

## Tech stack

- **Mobile**: React Native + Expo (TypeScript), Expo Router (file-based routing)
- **Backend**: Supabase — Postgres, Auth, Storage, Row Level Security. No custom backend server.
- **State**: Local component state + direct Supabase client calls. No global state library yet (not needed at current scope).

**Expo SDK 57** (React Native 0.86, React 19.2). The project was briefly downgraded to SDK 54 because the App Store Expo Go lagged behind; on 2026-09-26 Expo Go auto-updated to SDK 57 and refused to open the SDK 54 project ("Project is incompatible with this version of Expo Go"), so it was upgraded back via `npx expo install expo@^57.0.0 --fix`. iOS Expo Go only ever supports the latest SDK and old versions can't be installed — keep the project on whatever SDK the current Expo Go supports. **The project is on SDK 57; any instruction or note that says it's "pinned to SDK 54" is outdated.**

## Project structure

Everything lives under `src/`, not the repo root — this was a template quirk (SDK 57's new default), not our choice, but we're consistent with it now:

```
us-app/
├── src/
│   ├── app/                          — Expo Router screens (file-based routing)
│   │   ├── _layout.tsx               — Root layout: Stack wrapping (tabs) and (auth) groups
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx           — Nested Stack for auth screens (REQUIRED — see gotchas)
│   │   │   ├── welcome.tsx           — Sign up / sign in, has ImageBackground (lockscreen.jpeg)
│   │   │   ├── pairing-choice.tsx    — "Create Our World" vs "Join Our World"
│   │   │   ├── create-couple.tsx     — Enter relationship start date, generates invite code
│   │   │   └── join-couple.tsx       — Enter invite code to pair as partner_two
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           — Auth + couple-pairing guard wrapping all tabs (see gotchas — has a fixed race condition)
│   │   │   ├── index.tsx             — Home tab: renders <BeachScene /> (the living beach — see components/beach/ and DESIGN.md → The beach)
│   │   │   ├── play.tsx              — Play tab (placeholder)
│   │   │   ├── story.tsx             — Story tab: timeline list of all memories
│   │   │   ├── us.tsx                — Us tab: birthday prompt, "Our beginning" (replay intro, per-person welcome notes), "Our dates" (+ DateSheet), birthday surprise status
│   │   │   └── settings.tsx          — Settings tab: names, email, together-since, sign out
│   │   ├── memory/
│   │   │   ├── create.tsx            — Memory creation form + photo/video picker, size check, per-file upload progress
│   │   │   ├── [id].tsx              — Memory page: collage by count (first video autoplays muted), "+N more" grid, "Play this memory", "…" menu (edit / add / delete), long-press to remove an item
│   │   │   ├── edit.tsx              — Edit title / date / location / description (?id=)
│   │   │   ├── add-media.tsx         — Add photos/videos to an existing memory (?id=) — same picker/uploader as create
│   │   │   ├── reel.tsx              — "Play this memory" story-style reel (fullScreenModal): title card, Ken Burns photos, videos w/ sound ≤30s, closing card
│   │   │   └── viewer.tsx            — Full-screen modal viewer: swipe between a memory's items, expo-video player for videos
│   │   ├── activity/
│   │   │   └── today.tsx             — Daily activity + simultaneous reveal (text / photo / song answers)
│   │   ├── music/
│   │   │   └── today.tsx             — Our song today: pick (first wins) + note, "I listened 🎧", past songs
│   │   ├── bottle/
│   │   │   ├── write.tsx             — Write / edit a bottle: message, song, ≤5 media (sealed), arrival (now … in a year, anniversary, birthday) or "Open when…" → throw moment
│   │   │   ├── [id].tsx              — Open a bottle / open-when note: unroll moment (recipient's first open) → letter, song, media
│   │   │   └── jar.tsx               — The open-when jar: folded notes, opened ones dated
│   │   └── gift/
│   │       ├── prepare.tsx           — Prepare / edit (until it unlocks) a sealed birthday surprise: letter, song, ≤10 photos/videos
│   │       └── [id].tsx              — Open a gift: unwrap moment (recipient's first open) → letter, song, media collage + viewer; sender sees status
│   ├── lib/
│   │   ├── supabase.ts               — Supabase client (platform-aware storage adapter — see gotchas)
│   │   ├── auth.ts                   — signUp/signIn/signOut/getCurrentUser/getUserName
│   │   ├── couples.ts                — createCouple/joinCoupleByCode/getMyCouple
│   │   ├── memories.ts               — createMemory/uploadMemoryMedia/resolveMedia/signPaths (batch createSignedUrls)/updateMemory/deleteMemory/removeMediaItem/etc — HEIC→JPEG, video thumbnails, storage-first deletes
│   │   ├── upload.ts                 — Shared streaming uploader (signed upload URL + native binary PUT), MAX_UPLOAD_BYTES, content types
│   │   ├── activities.ts             — getTodayActivity/submitActivityResponse(…, song?)/etc
│   │   ├── dates.ts                  — localDateString(): the one local "today" (YYYY-MM-DD) for every daily feature
│   │   ├── moments.ts                — "seen once" flags (beginning / reveal / birthday / birthday prompt), welcome notes (get / saveMyWelcomeNote), answersMatch
│   │   ├── importantDates.ts         — important_dates CRUD, buildUpcoming (Our dates list), signCountdown (beach sign), ageOn
│   │   ├── bottles.ts                — Ocean bottles + open-when (kind 'bottle' / 'open_when'): arrivalDate presets, saveBottle, takeBackBottle, received / sent lists
│   │   ├── reflections.ts            — Two perspectives: getReflections, saveMyReflection (upsert), partnerHasReflected, memoriesWithBothSides
│   │   ├── remember.ts               — "Remember when…": isRememberDay, pickRememberWhen (seeded by couple + date), agoLabel, hearts
│   │   ├── gifts.ts                  — sealed birthday gifts on `bottles`: getWaitingForMe (RPC), getUnopenedGiftsForMe, save/add/remove media (sealed path), markGiftOpened
│   │   ├── music.ts                  — Song type, iTunes searchSongs, Odesli resolveLinks, "Open songs in" preference + openFullSong, ONE shared preview player (togglePreview/stopPreview/usePreviewState)
│   │   ├── songs.ts                  — Our song today: getTodaySong, pickTodaySong (first pick wins on 23505), markListened, getPastSongs, todaySongStatus
│   │   └── world.ts                  — Beach data: getBeachCounts (memories + completed days), getLatestMemory, getTodayStatus, get/saveWorld (couple_world upsert)
│   ├── hooks/
│   │   └── useAuth.ts                — Session state via Supabase auth listener
│   ├── theme/                        — Design tokens generated from DESIGN.md: colors (+ tape, time-of-day skies), typography (fonts + type scale), spacing/radius, warm shadows, motion constants. Import from "@/theme".
│   ├── components/
│   │   ├── tab-bar.tsx               — Custom floating tab bar (expo-blur, 3D icon per tab, spring lift on active, haptic on switch)
│   │   ├── moments/                  — Special moments (Phase 4): Beginning (intro), BirthdayMoment, EnvelopeReveal, PolaroidDevelop, effects.tsx (SparkleBurst, FloatingHearts, PaperBoat)
│   │   ├── music/                    — VinylRecord (+ VinylBadge), SongCard, SongPicker (sheet), usePreviewStopOnBlur
│   │   ├── beach/OceanObjects.tsx    — WriteBottleSticker, SeaBottles (in transit, count only), WashedBottle, JarSticker, NewMemoryTag, RememberPolaroid
│   │   ├── memories/Perspectives.tsx — "What do you remember?" (both sides, reveal, live via Realtime); memories/SimpleViewer.tsx — full-screen viewer for non-memory media
│   │   ├── moments/BottleMoments.tsx — BottleThrow (arc + splash) and BottleUnroll (cork pops, paper unrolls); moments/RememberCard.tsx
│   │   ├── dates/DateSheet.tsx       — add/edit a date: my birthday / partner's birthday / custom (label + 3D icon)
│   │   ├── memories/                 — Scrapbook pieces (Phase 3): journal.tsx (MemoryCluster, FootprintTrail, MonthHeading, BeginningPage), Collage.tsx, MediaGrid.tsx,
│   │   │                               MediaTray.tsx + useMediaPicker.ts (shared pick/size-check/thumbnail/upload-with-progress), MemoryFields.tsx
│   │   ├── beach/                    — The living beach (Home, Phase 2): BeachScene (composition + pause/reduce-motion gating + unlock + dev panel),
│   │   │                               Sky/Clouds/Sea/Sand/Palm/Decor (SVG layers), objects.tsx (sign, polaroid, note, shells, towel, bottle),
│   │   │                               chapters.ts (thresholds — tune here), time.ts (sky blend, sun/moon arc, greeting), layout.ts,
│   │   │                               useBeachData.ts (+ days-of-us / anniversary math), useLoop.ts, ChapterUnlock.tsx, DevPanel.tsx
│   │   ├── ui/                       — Shared design-system components, import from "@/components/ui":
│   │   │                               PressableScale, Button, PaperCard, PaperTexture, Polaroid, WashiTape, Ticket, ScreenBackground,
│   │   │                               Title/Body/Handwritten, Input, DatePickerField, EmptyState, Icon3D, useTabBarClearance, haptics
│   │   └── (template leftovers — themed-text, themed-view, hint-row, web-badge, external-link, animated-icon, ui/collapsible — unused; don't build on them)
│   └── constants/theme.ts            — Template theme, only used by those unused template components. Use src/theme/ instead.
├── DESIGN.md                         — Design source of truth (every screen follows it)
├── assets/images/lockscreen.jpeg     — Background photo used on welcome screen
├── assets/icons3d/                   — Microsoft Fluent Emoji 3D PNGs (MIT, LICENSE alongside); names mapped in components/ui/Icon3D.tsx
├── assets/textures/paper-grain.png   — Tileable paper grain, generated in-repo (no third-party asset)
├── supabase/
│   ├── live_schema_dump.json         — Dump of the LIVE DB (FKs, functions, indexes, policies, RLS, triggers) as of 2026-09-26; source for the 002–007 reconstruction
│   └── migrations/                   — 001–009 run manually in the SQL Editor; 010+ applied via the project-scoped Supabase MCP after review
│       ├── 001_init_schema.sql       — Tables, is_couple_member(), base RLS policies
│       ├── 002_storage_policies.sql  — RECONSTRUCTED: memory-media storage.objects policies
│       ├── 003_user_signup_trigger.sql — RECONSTRUCTED: handle_new_user + on_auth_user_created
│       ├── 004_invite_join_policies.sql — RECONSTRUCTED: open-invite couples policies (dropped by 009)
│       ├── 005_seed_activities.sql   — RECONSTRUCTED placeholder: rows exist live, seed text not recovered
│       ├── 006_daily_activity_unique.sql — RECONSTRUCTED: daily_activities_couple_date_unique
│       ├── 007_activity_response_type.sql — RECONSTRUCTED: activities.response_type (values/default inferred from client)
│       ├── 008_partner_can_view_user.sql — Partners can read each other's users row (nobody else's)
│       ├── 009_preflight.sql         — Read-only checks to run BEFORE 009 (duplicate responses, nulls); all must return 0 rows/0
│       ├── 009_security_hardening.sql — join_couple RPC, DB-enforced reveal, one-answer-per-user, NOT NULLs
│       ├── 010_pairing_hardening.sql — create_couple RPC, one couple per user, per-user lock on create/join
│       ├── 011_function_grants.sql   — EXECUTE revokes on SECURITY DEFINER functions; memory-media 50 MB + mime allow-list
│       ├── 012_music.sql             — memories.song / activity_responses.song (jsonb), response_type 'song', daily_songs + song_listens (RLS), 5 song prompts
│       ├── 013_moments.sql           — couples.welcome_note/_by (superseded by 014), activity_responses in supabase_realtime
│       ├── 014_dates_and_gifts.sql   — welcome_notes (one per person), important_dates person_id/emoji + birthday rules, sealed gifts on bottles (RLS, opened_at-only trigger, bottle_is_waiting, can_read/can_write_sealed, sealed storage paths)
│       ├── 015_bottles_reflections_remember.sql — bottles kind 'open_when' (+ label), bottle_is_waiting split by kind, memory_reflections enforced reveal (has_reflected / partner_has_reflected, Realtime), remember_hearts
│       └── 016_remember_days.sql     — remember_days: ONE shared "Remember when…" pick per couple per day (insert-only; members read + insert)
└── .env                              — EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (root only — Expo only reads the root one; don't add one under src/)
```

## Database schema (as of migration 016)

Tables: `remember_days` (016 — one pick per couple per day; members read + insert, no update/delete), `remember_hearts` (015 — members read; hearts only as yourself), `welcome_notes` (014), `daily_songs`, `song_listens` (music, 012 — members read; only the picker inserts/updates/deletes their own pick; listens insert/delete only for yourself), `users`, `couples`, `important_dates`, `memories`, `memory_media`, `memory_reflections` (Two perspectives, reveal enforced in 015), `activities`, `daily_activities`, `activity_responses`, `bottles` (birthday gifts, ocean bottles, open-when — sealed by RLS, 014/015), `missions` (unused so far), `couple_world` (unused so far).

RLS is enabled on every table. The core pattern: a Postgres function `is_couple_member(couple_id)` checks whether `auth.uid()` is `partner_one` or `partner_two` on that couple, and every policy reuses this function instead of repeating the join.

Migrations 002–007 were never saved when originally run; they were **reconstructed** from `supabase/live_schema_dump.json` and are documentation only ("Already applied. Do not re-run."). 005 has no row data, and 007's allowed values/default were inferred from the client.

**Joining a couple goes through an RPC, not open policies (migration 009).** Before 009, two policies (004) let any authenticated user SELECT couples with an open invite code and UPDATE `partner_two` on them. 009 drops both and replaces them with `public.join_couple(code)` — a `security definer` function that normalises the code (`upper(trim(code))`, matching `join-couple.tsx`), refuses if the caller is already in a couple or owns the invite, and atomically sets `partner_two` + clears `invite_code`. `joinCoupleByCode()` calls it via `supabase.rpc('join_couple', { code })`. Also from 009:
- Couple creators can't pre-fill `partner_two` on insert. (Superseded by 010: `authenticated` has no INSERT on `couples` at all.)
- `authenticated` only has column-level UPDATE on `couples.relationship_start` (013 briefly added welcome_note columns; 014 moved notes to `welcome_notes` and shrank the grant back); every other couples column changes only through the RPCs.
- `is_couple_member()` now pins `search_path = public`.

**Creating a couple also goes through an RPC (migration 010).** `public.create_couple(start_date)` refuses if the caller is already in a couple, generates the `WORD-WORD-1234` invite code server-side (retrying on collision), and returns the new row; `createCouple()` calls it via `supabase.rpc('create_couple', { start_date })`. Unique indexes on `couples.partner_one` and `couples.partner_two` (partial, non-null) mean nobody can be in two couples, and both `create_couple` and `join_couple` take a per-user `pg_advisory_xact_lock` so a double-tap can't race past the "already in a couple" check. This matters because `getMyCouple()` uses `.maybeSingle()`, which throws if a user ever has two couple rows.

**Simultaneous reveal is enforced by the database (migration 009),** not just hidden in the UI. `activity_responses` SELECT allows your own row, and your partner's row **only once you've answered** (`has_answered()`). The client therefore can't read the partner's row beforehand — `today.tsx` calls `supabase.rpc('partner_has_answered', …)` to show "your turn" vs "waiting", and refetches after submitting so the reveal appears. Insert/update/delete are restricted to your own row, and `activity_responses_one_per_user` (unique `daily_activity_id, user_id`) means a duplicate insert fails with `23505`, which `submitActivityResponse()` treats as "already answered."

`users`: you can read your own row, and (migration 008) your partner's — nobody else's.

`public.users` rows are created automatically via a **database trigger** (`handle_new_user`, migration 003) on `auth.users` insert, not by client-side code. This was a deliberate fix: client-side insert right after `signUp()` was failing RLS because the client isn't authenticated yet at that exact moment if email confirmation is required. The trigger runs with elevated privileges and bypasses this entirely. **"Confirm email" is turned OFF** in Supabase Auth settings for this project — acceptable since only two known people will ever have accounts.

**Function grants (migration 011).** `handle_new_user()` and `rls_auto_enable()` are not executable by `public`/`anon`/`authenticated` (triggers don't need it — Postgres only checks EXECUTE at CREATE TRIGGER time; verified by a rolled-back signup test). `is_couple_member`, `has_answered`, `partner_has_answered` are executable by `authenticated` only, so anon requests that hit a policy using them get "permission denied" instead of an empty result — fine, the app never queries signed-out. The remaining advisor warnings (lint 0029, signed-in users can call SECURITY DEFINER functions) are intentional: those five functions are the RPCs/helpers the app needs.

Storage: one private bucket, `memory-media`. **Limits (migration 011): 50 MB per file** (the Supabase Free plan's global cap — the bucket limit can't exceed it) and `allowed_mime_types = image/jpeg, video/quicktime, video/mp4`. Uploading any other type is rejected by Storage. `MAX_UPLOAD_BYTES` in `lib/upload.ts` must match the bucket limit. Path convention: `<couple_id>/<memory_id>/<filename>` for memories, `<couple_id>/activity-responses/<daily_activity_id>/<filename>` for activity photo responses. Storage RLS policies check `is_couple_member()` against the first folder segment of the object path.

## What's built and confirmed working (tested on a real iPhone via Expo Go)

- Sign up / sign in, session persists across app restarts (AsyncStorage)
- Create couple (with relationship start date) → generates invite code
- Join couple via invite code (tested with two separate accounts)
- Home screen shows real days-together count
- Memory creation: multi-photo picker → HEIC-to-JPEG conversion → upload to private storage → DB rows
- Five-tab bar: Home, Play (placeholder), Story, Us (placeholder), Settings — all behind the auth + couple guard
- ⚠️ Web app / PWA for iPhone Safari (single-page export, `public/index.html` template, manifest + icons + launch images, install hint, web uploader / thumbnails / reel tap-to-begin / native date input, lighter web beach) — web export builds; not yet tested on an iPhone and **not deployed**.
- ⚠️ Bottles in the ocean + open-when jar, Two perspectives (enforced reveal + live), Remember when… (migration 015 applied + security-tested) — type-checks, not yet tested on-device.
- ⚠️ Important dates + birthday mode + sealed birthday gifts + per-person welcome notes (migration 014 applied + security-tested) — type-checks, not yet tested on-device.
- ⚠️ Phase 4 special moments ("It all started here" intro, envelope reveal + Realtime live reveal, polaroid develop, chapter sparkles, bobbing bottle, Us → Our beginning + welcome note; migration 013 applied + verified) — type-checks, not yet tested on-device.
- ⚠️ Music (song search/preview/links, songs on memories + reel soundtrack, "Our song today" + beach radio, song prompts, "Open songs in" setting; migration 012 applied + verified) — type-checks, not yet tested on-device. Needs `npx expo start -c` (expo-audio was added).
- ⚠️ Phase 3 scrapbook (Story journal, memory collage, "Play this memory" reel, edit / add media / delete / remove item) — type-checks, not yet tested on-device.
- ⚠️ Phase 2 living beach (Home): animated SVG scene, tappable objects, chapters persisted to `couple_world`, unlock moment, `__DEV__` panel — type-checks, not yet tested on-device. Needs `npx expo start -c` (react-native-svg was added).
- ⚠️ Phase 1 UI overhaul (DESIGN.md, theme, fonts, 3D icons, shared components, custom floating tab bar, every screen restyled) type-checks but is not yet tested on-device
- Story tab listing all memories with thumbnails
- Settings tab: your name + email, partner's name, "together since" date, Sign Out
- Memory detail screen showing full photo grid (signed URLs)
- Daily activity: one per couple per day (race-condition-safe via a unique DB constraint), simultaneous reveal (partner's answer hidden until both have answered)
  - ⚠️ 008/009/010 are applied to the live DB (verified 2026-09-26; all data was wiped first) but not yet re-tested on-device — test create/join (incl. double-tap) and the reveal with both accounts
- Activity responses support both text and photo (photo-type prompts show a picker instead of a text box)
- ⚠️ Video memories (pick → compress → size check → streaming upload → thumbnail → grid tile → full-screen player) and the full-screen photo viewer are written and type-check, but not yet tested on-device

## Media pipeline (photos + videos)

- **Picking** (`memory/create.tsx`): `mediaTypes: ['images', 'videos']`. On iOS, `videoExportPreset: H264_1280x720` makes the picker re-encode library videos to 720p `.mp4` at pick time. It's marked `@deprecated` in the TS types, but in expo-image-picker 57 it's still the option the native code uses to transcode library picks; `videoQuality` only affects *recorded* videos. Videos over `MAX_UPLOAD_BYTES` are dropped with "This video is too long to save — try trimming it to under about a minute." (720p H.264 is roughly 5–8 Mbit/s, so 50 MB ≈ a minute.) `asset.duration` is in **milliseconds**; `duration_seconds` stores it rounded to seconds.
- **Uploading** (`lib/upload.ts` → `uploadLocalFile`): never base64. It calls `createSignedUploadUrl(path)` (RLS still applies: the storage INSERT policy checks `is_couple_member` on the first path segment), then `expo-file-system/legacy`'s `createUploadTask` does a native binary `PUT` to the signed URL with the real `content-type` (from the extension: jpg/jpeg → image/jpeg, mov → video/quicktime, mp4 → video/mp4) and reports progress. Both memory media and activity-response photos use it. Photos still go through HEIC→JPEG first.
- **Thumbnails**: `expo-video-thumbnails` grabs a JPEG ~1 s in (frame 0 for clips under a second). It's generated right after picking for the create-screen preview, then uploaded as `<couple_id>/<memory_id>/thumb_<name>.jpg` and saved in `memory_media.thumbnail_path`. A failed thumbnail doesn't fail the video (the tile shows a placeholder).
- **Create screen**: uploads run one after another, showing "Uploading 2 of 5 — 64%". A failed file doesn't stop the rest; the memory is saved and an alert lists which files failed.
- **Showing**: `resolveMedia()` signs every item (1 hour, long enough to watch). The detail grid shows the photo, or for videos the thumbnail + ▶ + a duration badge (still using the explicit pixel sizing). Tapping any tile opens `/memory/viewer?memoryId=…&index=…` (a `fullScreenModal` registered in the root `_layout.tsx`), a horizontal paging list where only the visible video gets an `expo-video` player (`useVideoPlayer` + `VideoView` with native controls). The Story tab uses the first photo, or else the first video's thumbnail.
- `memory_media` is ordered by `created_at` in both memory queries so the grid and viewer indices match.

## What's NOT built yet

- Voice recording for voice-type activity prompts (currently falls back to a text box with a note — real recording needs `expo-audio` (`expo-av` was removed from Expo Go in SDK 55 and has been uninstalled) plus a record/stop/playback UI, deliberately deferred as its own chunk of work)
- Bottles in the ocean, secret missions, couple roulette
- Anniversary mode (a special beach look on the anniversary itself — the sign already says "Happy anniversary 🌅")
- Push notifications
- Play and Us tab content (placeholder screens only)

## Known client-only locks (fix when building the feature)

These are currently "secret" only because the UI doesn't show them — RLS lets either partner read them. Enforce them in the database (like the 009 activity reveal) when the feature is built:
- **Missions secrecy** — `missions` is plain `is_couple_member`; the recipient can read a mission the sender meant to keep hidden.
- **Activity-response photos in storage** — photos under `<couple_id>/activity-responses/…` are covered by the couple-wide storage read policy, so the partner can fetch them (if they know/guess the path) before the reveal, even though the `activity_responses` row itself is now hidden.

## Web app (PWA on iPhone Safari)

Her phone runs **Us** as a home-screen web app (Safari → Share → Add to Home Screen); development stays on Expo Go. Same codebase — web differences are behind `Platform.OS === "web"`.

**Build shape:** `app.json` → `web.output: "single"` (one `index.html` + client routing; almost every route is behind sign-in and has dynamic ids, so static pre-rendering doesn't fit). ⚠️ With `"single"`, **`src/app/+html.tsx` is ignored** — the HTML template is **`public/index.html`** (viewport-fit=cover, iOS meta tags, manifest link, launch images, 100dvh reset); Expo injects the bundle `<script>`. Everything in `public/` is copied to the export: `manifest.webmanifest`, `icons/` (apple-touch-icon 180, 192, 512, maskable 512, favicons), `splash/` (10 iOS launch images), `vercel.json`. Icons/splash are generated by `python scripts/generate-web-icons.py` (needs Pillow; Fluent beach icon on sunset→sand, "Us" in Fraunces italic) — re-run if the design changes.

**iPhone Safari audit (what changed for web):**
| Feature | iOS Safari | Fix |
|---|---|---|
| Photo/video upload | ❌ native streaming uploader (`expo-file-system` `createUploadTask`) doesn't exist on web | `lib/upload.ts`: web path fetches the picked `blob:` and XHR-PUTs it to the signed upload URL with progress. Content type now comes from the **storage path** extension (web uris have none); video extension from the picker's `mimeType` (`videoExtension`). |
| HEIC photos | ✅ iOS hands Safari a JPEG from the photo picker; we still re-encode via `expo-image-manipulator` (canvas on web) → always `image/jpeg` | — |
| Video thumbnails | ❌ `expo-video-thumbnails` has no web build | `generateVideoThumbnail` on web draws a frame from a hidden muted `playsinline` `<video>` onto a `<canvas>` → JPEG data URL |
| File size check | ⚠️ `FileSystem.getInfoAsync` not on web | picker's `fileSize` (web provides it), else `fetch(uri).blob().size` |
| Inline video | ⚠️ iOS goes fullscreen without it | `playsInline` on every `VideoView` |
| Collage autoplay | ✅ muted + looped + inline is allowed | — |
| Viewer videos | ❌ unmuted autoplay is blocked | web doesn't auto-play; the native ▶ control starts it |
| Reel | ❌ soundtrack + video sound can't start without a tap | web shows **"Tap to begin"** (the tap starts the soundtrack synchronously — the audio player lives in `MemoryReel`); reel videos start **muted** with a "🔇 Tap for sound" chip that unmutes inside the tap |
| Song previews | ⚠️ `await` before `play()` can lose the tap | `togglePreview` no longer awaits before `play()` |
| Date pickers | ⚠️ community picker has no web build | `DatePickerField` renders a native `<input type="date">` (iOS date wheel), 16px so Safari doesn't zoom |
| Safe areas / 100vh | ⚠️ | `viewport-fit=cover` → `react-native-safe-area-context` reads `env(safe-area-inset-*)`; `#root` uses `100dvh`; body scroll/rubber-band off |
| Keyboard | ✅ Safari scrolls the focused field into view (KeyboardAvoidingView is a no-op on web) | inputs are ≥16px (no zoom) |
| Beach animation | ⚠️ Reanimated on web runs frames on the JS thread | `webLite`: stars hold still, only the front wave moves, 5 petals instead of 8 |
| Haptics | ✅ expo-haptics uses the iOS switch trick / no-op | helpers guard sync throws + rejections |
| Sign-in persistence | ✅ supabase-js uses `localStorage` on web (`storage: undefined` in `lib/supabase.ts`) | — note: iOS may clear a home-screen app's storage after ~7 days unused → she'd sign in again |
| Realtime / signed URLs / blur / clipboard | ✅ WebSocket, plain HTTPS URLs, `backdrop-filter`, `navigator.clipboard` (HTTPS) | — |
| Install hint | — | `components/InstallHint.tsx`: once, only in iOS Safari when not standalone (`navigator.standalone` / `display-mode`), dismissal in `localStorage` |

**Hosting — Vercel Hobby (free, personal use):** 100 GB/month transfer, unlimited deploys; over the cap the project pauses (never bills). Media is served by Supabase, so the site itself is tiny. (Netlify free = 300 credits ≈ 20 deploys/month; EAS Hosting free = 100k requests/month and needs `eas init` — both viable fallbacks.) The build happens **locally** (reads `.env`), and only the finished `dist/` is uploaded — Vercel needs no env vars and no build step. `public/vercel.json` (copied into `dist/`) rewrites every app route to `/index.html` and caches `/_expo/*` forever.
```bash
npx expo export -p web            # → dist/  (EXPO_PUBLIC_* from .env are inlined)
npx vercel login                  # first time only
npx vercel deploy dist --prod     # first run asks to create/link a project (name it "us")
```
Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are in the bundle (both public by design; RLS protects the data). Verified on the 2026-09-27 export: no service-role JWT and no `sb_secret_` key in the bundle. Never put a secret in an `EXPO_PUBLIC_` variable.
**Supabase Auth URLs:** nothing needs the production URL today — email confirmation is off and the app sends no magic links / OAuth / password-reset emails. If password reset is ever added, set Authentication → URL Configuration → Site URL to the Vercel URL and add it to Redirect URLs.

**Lock the door (do this once both real accounts exist — NOT yet applied):**
1. Supabase dashboard → **Authentication → Sign In / Providers** (on older dashboards: Authentication → Settings) → turn **off "Allow new users to sign up"** → Save. The label/location has moved between dashboard versions — it's the project-wide sign-up switch, not the Email provider toggle (leave Email enabled so sign-in keeps working). (Existing users can still sign in; any new sign-up is rejected by the server, whatever the client does.)
2. Set `EXPO_PUBLIC_SIGNUPS_OPEN=false` in `.env`, then rebuild + redeploy the web app (and restart Expo Go). `welcome.tsx` then starts in Sign in and hides "New here? Create an account". Defaults to open when unset.
3. Optional: Authentication → Users — confirm only the two accounts exist; delete strays.

## Gotchas and lessons learned (read before debugging similar issues)

- **Expo Router route groups strip parentheses from the actual URL.** `(auth)/welcome.tsx` is navigated to as `/welcome`, never `/(auth)/welcome`. This caused a whole round of `RelativePathString` type errors early on.
- **Every route group needs its own `_layout.tsx`**, or Expo Router won't collapse it into a single nested navigator — it'll flatten the files into individually-named routes instead, which breaks a parent `<Stack.Screen name="(group)" />` reference. This caused a silent redirect failure that looked like a routing bug but was a missing file.
- **`expo-file-system`'s modern API dropped `EncodingType`/`readAsStringAsync`** — that surface still exists, but only under the `expo-file-system/legacy` import path.
- **Import navigation things (`DarkTheme`, `DefaultTheme`, `ThemeProvider`, `Stack`, …) from `expo-router`, never `@react-navigation/*`.** Since SDK 56, direct `@react-navigation/*` imports in app code break; `@react-navigation/native` has been uninstalled. (On SDK 54 it was the reverse — that's why older notes may say otherwise.)
- **Tabs are JS `<Tabs>` from `expo-router/tabs` with a custom `tabBar`**, not NativeTabs (replaced in the Phase 1 UI overhaul so the bar could be a floating, blurred, 3D-icon object). `BottomTabBarProps` is imported from `expo-router/tabs` (never `@react-navigation/*`). The bar floats over content, so every tab screen must clear it: `<ScreenBackground aboveTabBar>` or `useTabBarClearance()` for ScrollView/FlatList bottom padding. The guard logic in `(tabs)/_layout.tsx` is unchanged.
- **Fonts gate the splash screen.** `src/app/_layout.tsx` calls `useFonts(fontAssets)` and returns `null` (native splash still showing) until Fraunces/Nunito/Caveat load or fail. Font family names are the `@expo-google-fonts` export names (e.g. `Fraunces_600SemiBold`), referenced via `fonts`/`type` in `src/theme/typography.ts` — never hardcode a family string in a screen. Only static cuts ship, so Fraunces' variable SOFT axis isn't available (use the italic).
- **`StyleSheet.absoluteFillObject` no longer exists in RN 0.86** — use `StyleSheet.absoluteFill` (it's a plain object now, spreadable). RN `<Image>` has no `pointerEvents` prop in the types; wrap it in a `View pointerEvents="none"` instead.
- **Paper grain uses RN's `<Image resizeMode="repeat">`**, not expo-image (no repeat mode). Photos everywhere else use expo-image.
- **No Spotify API** (2026 dev-mode: Premium required, 5-user cap, no previews). Search = iTunes Search API; links = Odesli (`api.song.link`), called once per chosen song and stored in the song jsonb. Odesli failures fall back to an `open.spotify.com/search/…` link — never block choosing.
- **One shared preview player** (`lib/music.ts`, module-level `createAudioPlayer`). Don't create extra players for previews; call `togglePreview(song)` and read `usePreviewState()`. Screens with song cards call `usePreviewStopOnBlur()`; the root layout stops previews on background. The reel has its *own* `useAudioPlayer` soundtrack (released on close) and calls `stopPreview()` on open. Audio mode is `playsInSilentMode: true, interruptionMode: "mixWithOthers"`, and reel videos set `audioMixingMode = "mixWithOthers"`, so the ducked soundtrack keeps playing under video sound.
- **expo-audio typing quirk:** its `.d.ts` files import `expo-modules-core`, which npm installed nested under `expo/`, so TS can't resolve `SharedObject` and `player.addListener` "doesn't exist". It does at runtime — `lib/music.ts` uses a narrow, commented cast. Don't "fix" it by installing expo-modules-core at the top level.
- **Every daily feature uses the phone's LOCAL date** via `localDateString()` in `src/lib/dates.ts` — daily activities (`getTodayActivity`), the beach's Today's-moment note (`getTodayStatus`) and Our song today (`songs.ts`). Never compute "today" with `toISOString().slice(0, 10)` (that's UTC and flips at the wrong hour). Daily activities used UTC until 2026-09-26; existing `daily_activities.activity_date` rows were left as-is (at most, a day around the switch may appear twice or be skipped). Both partners share a timezone, so local "today" is the same for both.
- **Welcome notes: one per person** (`welcome_notes`, 014 — PK (couple_id, author_id); you can only write rows where author_id = you). The Beginning intro shows the note by the OTHER partner. 013's single `couples.welcome_note` + stamp trigger were migrated and dropped.
- **Sealed gifts are enforced by the database, not the UI** (014). A birthday gift is a `bottles` row (kind 'birthday'): the sender can do anything with their own rows; the recipient can SELECT only once `unlock_at <= now()`, and a trigger (`bottles_recipient_only_opened_at`) lets anyone but the sender change nothing except `opened_at`. `bottle_is_waiting(couple)` (security definer) gives the recipient only a count + earliest unlock + kinds — the beach's "Something is waiting…" sticker uses ONLY this; never query the row to "peek". Media lives at `<couple_id>/sealed/<bottle_id>/…`: storage SELECT there needs `can_read_sealed(bottle)`, INSERT/UPDATE/DELETE need `can_write_sealed(bottle)` (sender only). So save the gift row first (its id names the folder), upload, then write `media` jsonb. Verified in a rolled-back test: locked → recipient sees 0 rows / 0 files, `bottle_is_waiting` = 1, edits blocked; unlocked → 1 row / 1 file, can set `opened_at`, can't edit the message.
- **Important dates** (014): birthdays are `type 'birthday'` with `person_id` (check constraint; one per person via a partial unique index; person must be in the couple), custom dates `type 'custom'` with a label + `emoji` (a 3D icon name). The anniversary is NEVER stored — it's `couples.relationship_start`. `lib/importantDates.ts` → `buildUpcoming()` (list by next occurrence) and `signCountdown()` (beach sign). Date math lives in `lib/dates.ts` (`parseLocalDate`, `nextOccurrence` with Feb 29 → Feb 28, `daysUntil`, `yearsAtNext`); always local dates.
- **Birthday mode** = a birthday row whose next occurrence is today (local). Gift `unlock_at` = local midnight at the start of the next birthday (`nextBirthdayUnlock`). Moments queue on Home: Beginning → birthday moment (birthday person, once per year: `moments.birthday.<userId>.<year>`) → chapter unlock.
- **Realtime live reveal:** `activity_responses` is in the `supabase_realtime` publication (013). Postgres Changes are delivered only to subscribers whose RLS SELECT allows the row, so your partner's answer reaches you only after you've answered (009's `has_answered` policy). The client subscribes only while "waiting for partner" (`channel('reveal-<id>')`, filter `daily_activity_id=eq.<id>`), refetches on arrival, and removes the channel on leave. DELETE events aren't RLS-filtered but carry only the PK — don't rely on them.
- **Special moments are one-at-a-time:** the beach's chapter-unlock effect waits for the Beginning intro to finish (`beginning === "done"`). Full-screen moments on tab screens render inside a transparent `Modal` (so they cover the floating tab bar). Seen flags live in AsyncStorage per user id (`lib/moments.ts`) — a failed write just means the moment plays again.
- **Ocean bottles reuse the 014 sealing rules** (policies are keyed on sender/recipient/unlock_at, not kind): kind 'bottle' arrives at `unlock_at`; kind 'open_when' has `unlock_at` null (check constraint) so the recipient can read it any time — the jar UI keeps it folded until tapped. `bottle_is_waiting` (015) returns totals plus `birthday_waiting` / `next_birthday_unlock_at` (the beach's gift sticker uses ONLY these) and `bottles_in_transit` (the tiny bottles far out at sea). Birthday gifts never appear in ocean lists (`OCEAN_KINDS`). Sender edits / takes back (files first, then row) only before `opened_at`.
- **Two perspectives are enforced like the activity reveal** (015): `memory_reflections` SELECT = your own, or your partner's only if `has_reflected(memory_id)`; one per person (unique memory_id, user_id); in the Realtime publication so the other side arrives live (the client subscribes only while it has written its own side). The journal's "2 sides" badge counts 2 visible rows — correct because you can only see 2 once you've written yours.
- **"Remember when…" is stored once per couple per day** (`remember_days`, 016, insert-only). `getTodaysRemember()` in `lib/remember.ts`: first read today's row — **a row always wins, even on a non-remember day**; if none and today is a remember day (`isRememberDay`, ~40% of days, seeded by `couple_id:YYYY-MM-DD`), pick (memories ≥30 days old, excluding any memory in `remember_days` in the last 60 days — read from the table, not the device; prefer "on this day", else a seeded pick) and insert; on 23505 re-read and use the partner's pick. So both phones always show the same memory. The old per-device AsyncStorage skip list (`remember.shown`) is gone (a stale key may linger on devices — harmless). Dev panel, two buttons: **"Force a Remember when today (this phone)"** ignores the day and 30-day rules and picks locally WITHOUT writing (not shared). **"Pick today's Remember when for real (shared)"** (`shareToday`) runs the real read → pick → insert flow ignoring the schedule and the 30-day rule (still skipping the last 60 days' picks), so the other phone — which always reads today's row first — shows the same memory. If today already has a row, that row is used (insert-only: it can't be replaced). Hearts are `remember_hearts` rows keyed by `remembered_on` (local date).
- **Dev panel "Show every object"** (`dev.everything`, `__DEV__` only) forces every conditional beach object on at once with stand-in data — gift sticker (waiting, 3 days), washed bottle ×2, 3 bottles at sea, jar (1 unopened), remember polaroid (latest memory's photo), new-memory note ("Sunset at the pier"), envelope sticker, chapter 4 (campfire, lights, hut, palm 2, starfish, colorful shells ×12) and birthday decorations (golden sky) — for layout reviews. The pre-pairing invite bottle is excluded. It changes nothing in the database.
- **Memory images: expo-image with `cacheKey` = storage path** (signed URLs change on every re-sign; the path doesn't). Sign several files with `signPaths()` (one `createSignedUrls` request), not a loop of `getSignedMediaUrl`. `resolveMedia()` returns `cacheKey` / `thumbCacheKey` / `storagePath` / `thumbnailPath` alongside the URLs.
- **Deletes are storage-first.** `deleteMemory` / `removeMediaItem` call `storage.remove(allPaths)` first; Storage silently skips files it can't delete (RLS or already gone), so any path missing from the result is re-checked by trying to sign it — still signable = still exists = abort and keep the DB row. Only then is the row deleted (`.select()` afterwards to confirm RLS actually let it through; the memory → memory_media FK is ON DELETE CASCADE).
- **Chained modals need a gap on iOS** (menu sheet → confirm sheet, grid → viewer): close the first, open the second ~350ms later (`ActionSheet` does this for you). Opening a Modal while another is dismissing silently fails.
- **The reel wraps itself in `GestureHandlerRootView`** (expo-router doesn't add one at the root).
- **Reel timing rules** (`memory/reel.tsx`):
  - Title card 3s. **Photos** use the viewer's speed setting — 8 / 15 / 30 / 60s, **default 60s** — chosen from the small "60s" button next to ✕ (a sheet; saved in AsyncStorage as `reel.photoSeconds`, per device). **Videos** ignore that setting: full length up to **60s** (`VIDEO_CAP_S`); `duration_seconds` is whole seconds (×1000 once); unknown length → the 60s cap, and `playToEnd` advances earlier.
  - **A plain JS clock decides when to advance** (`setTimeout(next, remaining)` + an `elapsed` ref updated on every pause/advance). The shared `progress` value only *draws* the progress bar and Ken Burns, and is always **set** (`withSequence(withTiming(from, 0), withTiming(1, remaining))`), never read back. Two native-only bugs made the old "animation callback advances the reel" design skip items on iPhone while Chrome looked fine: (1) a JS-side read of a shared value right after writing it can return the *previous* value on native (e.g. 1 from the last item → next item ends after ~50ms); (2) Reanimated timings follow the system **Reduce Motion** setting by default and finish instantly — timers must pass `reduceMotion: ReduceMotion.Never`.
  - **Pause** (hold, speed sheet open, or app backgrounded) = the effect cleanup: clear the timeout, add the elapsed time, freeze the bar/zoom at `elapsed / duration`; resume schedules only the remaining time. Videos and the soundtrack pause/resume in place.
  - Short videos: timer = length + 800ms so `playToEnd` (not the timer) advances — otherwise both fire and a frame is skipped. `useEventListener` (from `expo`) always calls the latest handler, so the `playing` guard in it is never stale.
  - `__DEV__` logs each item's real on-screen time: `[Reel] item N (photo|video|title) on screen: 60012ms (planned 60000ms)`.
- **The create screen asks "When"** (defaults to today) so older memories can be imported with their real date; the journal still falls back to `created_at` for any memory without a `memory_date`.
- **The beach never creates today's activity.** `getTodayStatus()` only reads `daily_activities` for today; no row = "Something's waiting for you". The row is still created only when someone opens the Today screen (`getTodayActivity`). Both read the date from `localDateString()`.
- **Completed-activity counting relies on RLS:** a day counts as completed when `daily_activities → activity_responses` returns 2 distinct users. That's correct only because you can see your partner's row once you've answered (009). Don't "fix" it by counting rows server-side for the partner.
- **Beach animation = `useLoop` shared values + `Animated.View` transforms around static SVGs** (not animated SVG props) — cheapest path on the UI thread. Gate every loop on `active` (focused && app foreground && !reduceMotion). Components that wrap items (like `Pop` in BeachScene) must be top-level, or every render remounts the items and restarts their springs.
- **`DatePickerField` falls back to a typed `YYYY-MM-DD` Input on web** (`@react-native-community/datetimepicker` has no web implementation). iOS shows an inline calendar in a paper modal, Android the system dialog.
- **Slow network:** a full `npm install` on this machine can take 15+ minutes (single tarballs taking 10+ min). If an install fails with `EBUSY … rmdir node_modules\…`, something briefly locked the folder — close `expo start` and retry.
- **iPhone photos default to HEIC**, and Supabase Storage will happily serve a HEIC file back with whatever `contentType` you declared at upload — if that's hardcoded to `image/jpeg` (as it originally was here), `<Image>` silently fails to render it. Fix: convert every photo to actual JPEG via `expo-image-manipulator` at upload time, so the bytes and the declared type always match.
- **`aspectRatio` combined with a percentage `width` inside a wrapping flex container can compute to zero visible size in React Native**, even when the image data itself loads successfully (confirmed via `onLoad` firing). Symptom: images report "loaded" but nothing is visible. Fix: compute an explicit pixel size (e.g. via `Dimensions.get('window')`) instead of relying on percentage + aspectRatio.
- **There's a real race condition risk in any auth-guard `useEffect` keyed on `[session]`**: `session` starts `null` before the async session restore completes, and if a couple/permission check runs on that initial `null` and sets some "checked" flag to `true`, a subsequent render with the real session can slip through before the real check reruns. Fix used here: track *which user id* the last completed check belongs to, and treat any mismatch as "still loading," never as a definitive "no."
- **Windows/PowerShell**: square brackets in a path (like `[id].tsx`) are wildcard syntax to PowerShell — use `-LiteralPath` instead of `-Path` in cmdlets like `Select-String`, or checks will silently return nothing even when the file is correct.
- **Verify a file save actually landed before testing on-device.** Several rounds of "the fix isn't working" during this build turned out to be a paste that never actually happened. Standing habit: after any edit, run something like `Select-String -Path <file> -Pattern <something-unique-to-the-new-code>` and confirm a match before reloading the app.
- **`base64-arraybuffer`** is no longer imported anywhere (uploads stream from disk now). It's still in package.json; safe to remove.
- **New npm packages require a real restart** (`npx expo start -c`), not just Fast Refresh. A giveaway in the terminal: a real cold bundle logs something like `(1500+ modules)`; a Fast Refresh of one file logs `(1 module)`.
- **`--legacy-peer-deps`** has been needed more than once for `npm install` in this project — some of Expo Router's web-only tooling (`@expo/ui`, Radix UI, `vaul`) declares peer deps that conflict with the React version actually used by the native app, even though that tooling is never touched by the mobile code path.

## Testing conventions

- Two Supabase Auth test accounts have been used throughout to test both sides of the couple pairing (creator / joiner).
- No automated tests exist yet. All verification so far has been manual, on a physical iPhone via Expo Go.