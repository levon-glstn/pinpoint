# Pinpoint

A geography game: you're given a country, drop a pin where its capital is. Closer pin, more points.
10 rounds per game, max 10,000 points.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

## Data

`src/data/countries.json` (194 UN member states + capital coordinates) and
`public/data/countries.geojson` (globe shapes) are generated from open datasets:

```bash
npm run build:data
```

## Stack

Vite + React, `react-globe.gl` (three.js). Scores/leaderboard via Supabase are the next step.

## Supabase

Database, anonymous + email auth, and Realtime for the leaderboard.

1. In the Supabase SQL Editor run `supabase/01_schema.sql`, then `supabase/02_seed_countries.sql`.
2. Authentication: enable anonymous sign-ins, enable manual linking, and enable the GitHub provider
   (GitHub OAuth app callback: `https://<project-ref>.supabase.co/auth/v1/callback`). Set the Site URL /
   redirect URLs to where the app runs. Sign-in is GitHub-only, so no email is ever sent.
3. Create `.env.local` (never commit it):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Without these the game still plays, using the bundled `countries.json` and no leaderboard.
