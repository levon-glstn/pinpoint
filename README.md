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

Vite + React, `react-globe.gl` (three.js), Supabase for the backend, deployed on Vercel.

## Supabase features

- **Database (Postgres):** a `countries` table (194 rows) that the game loads at startup, and a `scores` table
  behind the leaderboard. The bundled `countries.json` is only a fallback if the database can't be reached.
- **Row Level Security:** anyone can read countries and scores. Only signed-in players can submit a score, and
  only under their own user ID. Scores can't be edited or deleted, and check constraints keep points between
  0 and 10,000 and display names to 24 characters.
- **Auth:** guests are signed in anonymously when a game starts, so there is no login wall. Players can
  optionally sign in with GitHub, which links to their guest account so earlier scores are kept and follow
  them across devices. Their display name is stored on the account.
- **Realtime:** the top-20 leaderboard updates live, and a toast announces when someone else scores.
- **Auto-generated API:** the browser talks to Postgres directly through `supabase-js` with the publishable
  key. There is no custom server.
