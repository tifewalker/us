# us

A private, two-person relationship app: shared memories, daily prompts with a simultaneous reveal, songs, bottles in the ocean, and an animated beach that grows with you.

- **App:** React Native + Expo (SDK 57), Expo Router, TypeScript. It runs in Expo Go, and on iPhone as a home-screen web app (PWA).
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime) with row-level security everywhere. The migrations are in `supabase/migrations/`.
- **Read first:** `CLAUDE.md` (architecture, database rules, gotchas, deploy steps) and `DESIGN.md` (the design system every screen follows).

## Run it

```bash
npm install
cp .env.example .env        # fill in your Supabase URL + anon key
npx expo start -c           # open in Expo Go
```

Web build and deploy steps are in `CLAUDE.md` → "Web app (PWA on iPhone Safari)".
