# Pinpoint — Supabase dogfooding project

New Supabase hire's dogfooding project. Keep it **small and simple**: database + auth + one extra (Realtime). No feature creep (no multiplayer rooms, daily challenges, PostGIS, Edge Functions for now).

## The game
Geography game: shown a country, the player drops a pin on a 3D globe where the capital is. Closer = more points
(1000 within 50 km, then `1000 * exp(-(km-50)/1500)`). 10 rounds per game, max 10,000.

## State: front end is DONE and working (local only)
- Stack: Vite + React + `react-globe.gl` (three.js). Node installed via Homebrew. Run: `npm run dev` -> http://127.0.0.1:5173
- `src/App.jsx` game state machine (intro | guess | reveal | done), `src/components/GlobeStage.jsx` globe, `src/components/Screens.jsx` UI screens, `src/lib/geo.js` distance/score helpers.
- Countries currently load from the local `src/data/countries.json` (194 UN members: code=cca3, cca2, name, capital, lat, lng, region). Regenerate with `npm run build:data`. Country shapes: `public/data/countries.geojson`.
- Personal best is stored in `localStorage` (`pinpoint:best`). No backend yet.

## Next: Supabase (this is what remains)
Supabase MCP is configured in `.mcp.json` for project ref `iosrkgmelshbaoerqdqc`. It needs OAuth: run `/mcp` -> supabase -> Authenticate.

Plan, in order:
1. **Confirm the project** `iosrkgmelshbaoerqdqc` is the right one for dogfooding and look at what's already in it BEFORE creating anything. Ask the user if it's not empty/unexpected.
2. **Schema** (via MCP migrations):
   - `countries(code text pk, cca2, name, capital, lat, lng, region)` — seed from `src/data/countries.json`. RLS: public read only.
   - `scores(id, user_id uuid default auth.uid() references auth.users, display_name text, points int check (points between 0 and 10000), created_at)`. RLS: anyone can read; authenticated users can insert only rows where `user_id = auth.uid()`.
   - Enable Realtime on `scores`.
   - Run the security/performance advisors after migrations.
3. **Auth**: anonymous sign-in on game start (no login wall); after a game the player picks a display name for the leaderboard. Optional later: GitHub/Google login to keep scores across devices.
4. **Front end**: add `@supabase/supabase-js`, a `src/lib/supabase.js` client (URL + publishable key in `.env.local`, never commit secrets), save the final score at game end, add a Leaderboard screen (top 20) that updates live via Realtime.
5. Optional: load `countries` from Supabase instead of the local JSON.

## Notes
- Don't use the service_role key in the browser. Only the publishable/anon key goes in `.env.local`.
- Bolivia's capital is Sucre in the data (La Paz is the seat of government) — intentional.
- 29 tiny countries have no polygon on the globe (still playable, just don't highlight on reveal).
