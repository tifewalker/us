# CLAUDE.md — "Us" App

Context file for Claude Code (or any future agent session) working on this project. Read this before making changes — it captures the product intent, architecture decisions, what's actually been tested and confirmed working, and hard-won lessons from getting this far.

## What this is

A private, two-person relationship app — not a productivity or social app. Built by the developer for himself and his girlfriend. No public profiles, no followers, no third party ever sees this data. Every backend decision (RLS everywhere, private storage bucket) exists to enforce that.

Core concept: the app is a digital version of their relationship — shared memories (photos/videos from real outings), small daily connection prompts with a "simultaneous reveal" mechanic (neither partner sees the other's answer until both have answered), and eventually an animated "beach" home screen tied to where their relationship began.

**Key dates baked into the product (not just test data):**
- Anniversary: March 29
- His birthday: July 4, 2002
- Her birthday: April 15, 2002

## Tech stack

- **Mobile**: React Native + Expo (TypeScript), Expo Router (file-based routing)
- **Backend**: Supabase — Postgres, Auth, Storage, Row Level Security. No custom backend server.
- **State**: Local component state + direct Supabase client calls. No global state library yet (not needed at current scope).

**Expo SDK 57** (React Native 0.86, React 19.2). The project was briefly downgraded to SDK 54 because the App Store Expo Go lagged behind; on 2026-09-26 Expo Go auto-updated to SDK 57 and refused to open the SDK 54 project ("Project is incompatible with this version of Expo Go"), so it was upgraded back via `npx expo install expo@^57.0.0 --fix`. iOS Expo Go only ever supports the latest SDK and old versions can't be installed — keep the project on whatever SDK the current Expo Go supports.

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
│   │   │   ├── index.tsx             — Home tab ("Our little beach"), days-together count, Today's Moment + Add Memory cards
│   │   │   ├── play.tsx              — Play tab (placeholder)
│   │   │   ├── story.tsx             — Story tab: timeline list of all memories
│   │   │   ├── us.tsx                — Us tab (placeholder)
│   │   │   └── settings.tsx          — Settings tab: names, email, together-since, sign out
│   │   ├── memory/
│   │   │   ├── create.tsx            — Memory creation form + photo/video picker
│   │   │   └── [id].tsx              — Memory detail view (photo grid, description)
│   │   └── activity/
│   │       └── today.tsx             — Daily activity + simultaneous reveal
│   ├── lib/
│   │   ├── supabase.ts               — Supabase client (platform-aware storage adapter — see gotchas)
│   │   ├── auth.ts                   — signUp/signIn/signOut/getCurrentUser/getUserName
│   │   ├── couples.ts                — createCouple/joinCoupleByCode/getMyCouple
│   │   ├── memories.ts               — createMemory/uploadMemoryMedia/getMemoriesForCouple/etc — includes HEIC→JPEG conversion
│   │   └── activities.ts             — getTodayActivity/submitActivityResponse/etc, includes TESTING-ONLY deleteTodayActivity
│   ├── hooks/
│   │   └── useAuth.ts                — Session state via Supabase auth listener
│   ├── components/
│   │   ├── app-tabs.tsx              — NativeTabs: Home/Play/Story/Us/Settings (sf icons on iOS, md Material icons on Android)
│   │   ├── app-tabs.web.tsx          — Web fallback tab bar (same five tabs)
│   │   └── (other template-generated components, mostly untouched)
│   └── constants/theme.ts            — Template-generated theme constants
├── assets/images/lockscreen.jpeg     — Background photo used on welcome screen
├── supabase/
│   ├── live_schema_dump.json         — Dump of the LIVE DB (FKs, functions, indexes, policies, RLS, triggers) as of 2026-09-26; source for the 002–007 reconstruction
│   └── migrations/                   — Run manually in the Supabase SQL Editor after review (no CLI/migration tool wired up)
│       ├── 001_init_schema.sql       — Tables, is_couple_member(), base RLS policies
│       ├── 002_storage_policies.sql  — RECONSTRUCTED: memory-media storage.objects policies
│       ├── 003_user_signup_trigger.sql — RECONSTRUCTED: handle_new_user + on_auth_user_created
│       ├── 004_invite_join_policies.sql — RECONSTRUCTED: open-invite couples policies (dropped by 009)
│       ├── 005_seed_activities.sql   — RECONSTRUCTED placeholder: rows exist live, seed text not recovered
│       ├── 006_daily_activity_unique.sql — RECONSTRUCTED: daily_activities_couple_date_unique
│       ├── 007_activity_response_type.sql — RECONSTRUCTED: activities.response_type (values/default inferred from client)
│       ├── 008_partner_can_view_user.sql — Partners can read each other's users row (nobody else's)
│       ├── 009_preflight.sql         — Read-only checks to run BEFORE 009 (duplicate responses, nulls); all must return 0 rows/0
│       └── 009_security_hardening.sql — join_couple RPC, DB-enforced reveal, one-answer-per-user, NOT NULLs
└── .env                              — EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (root only — Expo only reads the root one; don't add one under src/)
```

## Database schema (as of migration 009)

Tables: `users`, `couples`, `important_dates`, `memories`, `memory_media`, `memory_reflections` (unused so far), `activities`, `daily_activities`, `activity_responses`, `bottles` (unused so far), `missions` (unused so far), `couple_world` (unused so far).

RLS is enabled on every table. The core pattern: a Postgres function `is_couple_member(couple_id)` checks whether `auth.uid()` is `partner_one` or `partner_two` on that couple, and every policy reuses this function instead of repeating the join.

Migrations 002–007 were never saved when originally run; they were **reconstructed** from `supabase/live_schema_dump.json` and are documentation only ("Already applied. Do not re-run."). 005 has no row data, and 007's allowed values/default were inferred from the client.

**Joining a couple goes through an RPC, not open policies (migration 009).** Before 009, two policies (004) let any authenticated user SELECT couples with an open invite code and UPDATE `partner_two` on them. 009 drops both and replaces them with `public.join_couple(code)` — a `security definer` function that normalises the code (`upper(trim(code))`, matching `join-couple.tsx`), refuses if the caller is already in a couple or owns the invite, and atomically sets `partner_two` + clears `invite_code`. `joinCoupleByCode()` calls it via `supabase.rpc('join_couple', { code })`. Also from 009:
- Couple creators can't pre-fill `partner_two` on insert.
- `authenticated` only has column-level UPDATE on `couples.relationship_start`; every other couples column changes only through the RPC.
- `is_couple_member()` now pins `search_path = public`.

**Simultaneous reveal is enforced by the database (migration 009),** not just hidden in the UI. `activity_responses` SELECT allows your own row, and your partner's row **only once you've answered** (`has_answered()`). The client therefore can't read the partner's row beforehand — `today.tsx` calls `supabase.rpc('partner_has_answered', …)` to show "your turn" vs "waiting", and refetches after submitting so the reveal appears. Insert/update/delete are restricted to your own row, and `activity_responses_one_per_user` (unique `daily_activity_id, user_id`) means a duplicate insert fails with `23505`, which `submitActivityResponse()` treats as "already answered."

`users`: you can read your own row, and (migration 008) your partner's — nobody else's.

`public.users` rows are created automatically via a **database trigger** (`handle_new_user`, migration 003) on `auth.users` insert, not by client-side code. This was a deliberate fix: client-side insert right after `signUp()` was failing RLS because the client isn't authenticated yet at that exact moment if email confirmation is required. The trigger runs with elevated privileges and bypasses this entirely. **"Confirm email" is turned OFF** in Supabase Auth settings for this project — acceptable since only two known people will ever have accounts.

Storage: one private bucket, `memory-media`. Path convention: `<couple_id>/<memory_id>/<filename>` for memories, `<couple_id>/activity-responses/<daily_activity_id>/<filename>` for activity photo responses. Storage RLS policies check `is_couple_member()` against the first folder segment of the object path.

## What's built and confirmed working (tested on a real iPhone via Expo Go)

- Sign up / sign in, session persists across app restarts (AsyncStorage)
- Create couple (with relationship start date) → generates invite code
- Join couple via invite code (tested with two separate accounts)
- Home screen shows real days-together count
- Memory creation: multi-photo picker → HEIC-to-JPEG conversion → upload to private storage → DB rows
- Five-tab NativeTabs bar: Home, Play (placeholder), Story, Us (placeholder), Settings — all behind the auth + couple guard
- Story tab listing all memories with thumbnails
- Settings tab: your name + email, partner's name, "together since" date, Sign Out
- Memory detail screen showing full photo grid (signed URLs)
- Daily activity: one per couple per day (race-condition-safe via a unique DB constraint), simultaneous reveal (partner's answer hidden until both have answered)
  - ⚠️ The DB-enforced reveal, RPC join and partner-name policy (008/009) are written and the client is updated, but not yet applied/tested on-device — run `009_preflight.sql` first
- Activity responses support both text and photo (photo-type prompts show a picker instead of a text box)

## What's NOT built yet

- Voice recording for voice-type activity prompts (currently falls back to a text box with a note — real recording needs `expo-audio` (`expo-av` was removed from Expo Go in SDK 55 and has been uninstalled) plus a record/stop/playback UI, deliberately deferred as its own chunk of work)
- Bottles in the ocean, secret missions, couple roulette
- The actual animated "beach" home screen visuals (current home screen is plain/functional by design — visual polish was deliberately sequenced last, after the data/auth foundation was proven, per the original phased plan)
- Important dates / birthday mode / anniversary mode screens (schema exists — `important_dates` table — but no UI reads or writes it yet)
- Push notifications
- Play and Us tab content (placeholder screens only)

## Known client-only locks (fix when building the feature)

These are currently "secret" only because the UI doesn't show them — RLS lets either partner read them. Enforce them in the database (like the 009 activity reveal) when the feature is built:
- **Bottles `unlock_at`** — the `bottles` policy is plain `is_couple_member`, so the recipient can read `message` before `unlock_at`.
- **Missions secrecy** — `missions` is plain `is_couple_member`; the recipient can read a mission the sender meant to keep hidden.
- **`memory_reflections` reveal** — plain membership check; a partner's reflection is readable before you've written yours.
- **Activity-response photos in storage** — photos under `<couple_id>/activity-responses/…` are covered by the couple-wide storage read policy, so the partner can fetch them (if they know/guess the path) before the reveal, even though the `activity_responses` row itself is now hidden.

## Gotchas and lessons learned (read before debugging similar issues)

- **Expo Router route groups strip parentheses from the actual URL.** `(auth)/welcome.tsx` is navigated to as `/welcome`, never `/(auth)/welcome`. This caused a whole round of `RelativePathString` type errors early on.
- **Every route group needs its own `_layout.tsx`**, or Expo Router won't collapse it into a single nested navigator — it'll flatten the files into individually-named routes instead, which breaks a parent `<Stack.Screen name="(group)" />` reference. This caused a silent redirect failure that looked like a routing bug but was a missing file.
- **`expo-file-system`'s modern API dropped `EncodingType`/`readAsStringAsync`** — that surface still exists, but only under the `expo-file-system/legacy` import path.
- **Import navigation things (`DarkTheme`, `DefaultTheme`, `ThemeProvider`, `Stack`, …) from `expo-router`, never `@react-navigation/*`.** Since SDK 56, direct `@react-navigation/*` imports in app code break; `@react-navigation/native` has been uninstalled. (On SDK 54 it was the reverse — that's why older notes may say otherwise.)
- **NativeTabs syntax is version-specific.** SDK 57 uses `NativeTabs.Trigger.Label` / `NativeTabs.Trigger.Icon` (with `sf` for iOS, `md` for Android). SDK 54 used separately imported `Label` / `Icon`. Check the versioned docs before changing `app-tabs.tsx`.
- **Slow network:** a full `npm install` on this machine can take 15+ minutes (single tarballs taking 10+ min). If an install fails with `EBUSY … rmdir node_modules\…`, something briefly locked the folder — close `expo start` and retry.
- **iPhone photos default to HEIC**, and Supabase Storage will happily serve a HEIC file back with whatever `contentType` you declared at upload — if that's hardcoded to `image/jpeg` (as it originally was here), `<Image>` silently fails to render it. Fix: convert every photo to actual JPEG via `expo-image-manipulator` at upload time, so the bytes and the declared type always match.
- **`aspectRatio` combined with a percentage `width` inside a wrapping flex container can compute to zero visible size in React Native**, even when the image data itself loads successfully (confirmed via `onLoad` firing). Symptom: images report "loaded" but nothing is visible. Fix: compute an explicit pixel size (e.g. via `Dimensions.get('window')`) instead of relying on percentage + aspectRatio.
- **There's a real race condition risk in any auth-guard `useEffect` keyed on `[session]`**: `session` starts `null` before the async session restore completes, and if a couple/permission check runs on that initial `null` and sets some "checked" flag to `true`, a subsequent render with the real session can slip through before the real check reruns. Fix used here: track *which user id* the last completed check belongs to, and treat any mismatch as "still loading," never as a definitive "no."
- **Windows/PowerShell**: square brackets in a path (like `[id].tsx`) are wildcard syntax to PowerShell — use `-LiteralPath` instead of `-Path` in cmdlets like `Select-String`, or checks will silently return nothing even when the file is correct.
- **Verify a file save actually landed before testing on-device.** Several rounds of "the fix isn't working" during this build turned out to be a paste that never actually happened. Standing habit: after any edit, run something like `Select-String -Path <file> -Pattern <something-unique-to-the-new-code>` and confirm a match before reloading the app.
- **New npm packages require a real restart** (`npx expo start -c`), not just Fast Refresh. A giveaway in the terminal: a real cold bundle logs something like `(1500+ modules)`; a Fast Refresh of one file logs `(1 module)`.
- **`--legacy-peer-deps`** has been needed more than once for `npm install` in this project — some of Expo Router's web-only tooling (`@expo/ui`, Radix UI, `vaul`) declares peer deps that conflict with the React version actually used by the native app, even though that tooling is never touched by the mobile code path.

## Testing conventions

- Two Supabase Auth test accounts have been used throughout to test both sides of the couple pairing (creator / joiner).
- `deleteTodayActivity()` in `lib/activities.ts` is a **testing-only** helper for rerolling which activity gets assigned on a given day, so different `response_type`s (text/photo/voice) can be tested without waiting for a new calendar day. Remove this function and any UI button calling it before this app is actually handed to a real end user (i.e. before the girlfriend uses it for real) — it lets either partner silently wipe the other's already-submitted answer for the day.
- No automated tests exist yet. All verification so far has been manual, on a physical iPhone via Expo Go.