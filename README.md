# Constructive

Pre-feasibility street redevelopment for Indian cities. Build for Bharat, Track 5 (Smarter Cities & Civic Infrastructure).

Pick any of 154 Indian cities and districts across 34 states and UTs, or pan to any street in India → the 3D city loads → click a street → Constructive reads that 250 m area from Overture Maps building footprints and OpenStreetMap streets, flags problems (fire-tender access, drainage, density, heat) and ranks possible works → open the 3D street study to test them under fire and monsoon scenarios → save & share the proposal, export a DPR PDF.

> Indicative pre-feasibility only. Screening checks are not a compliance or structural audit. All coefficients are placeholders to be replaced with the local schedule of rates and validated by a planner.

## Stack

| Layer | Tech |
|---|---|
| App | React 19 + TypeScript + Vite, Tailwind v4, Framer Motion, Zustand |
| City map | MapLibre GL (OpenFreeMap vector tiles, 3D buildings for every city) + deck.gl (risk layers, arcs, pulses) |
| Area analysis | Read from the loaded vector tiles with Turf.js (instant, no extra API). Overpass client kept as an optional source. |
| Street study | React Three Fiber + drei + postprocessing (N8AO, bloom, AgX tone mapping, SMAA) |
| Animations | lottie-web (animations authored in code) |
| Backend | Supabase (proposals, votes, area cache) with a localStorage fallback |
| Report | jsPDF |

## Run

```bash
cd web
npm install
cp .env.example .env.local   # optional: add Supabase URL + anon key
npm run dev                  # http://localhost:5174
npm test                     # model + diagnosis unit tests
```

### Supabase (optional)
1. Create a project at supabase.com.
2. Run `supabase/migrations/001_init.sql` in the SQL editor.
3. Put the project URL and anon key in `web/.env.local`.

Without these, everything is stored in the browser and the header shows "Local only".

## Structure

```
web/src/
  model/       model.ts (all formulas + assumptions), diagnose.ts (rules: features → observations → suggestions), tests
  services/    tileArea.ts (area from vector tiles), overpass.ts, supabase.ts, dpr.ts
  components/  TopBar, CityMap (MapLibre + deck.gl), AreaPanel, ui
  study/       StudyScene (R3F), StudyView (works, metrics, checks, share, DPR)
  data/        cities.ts (grouped by state)
  i18n/        English / Hindi strings
supabase/migrations/   database schema + row-level security
legacy/                the earlier single-page prototype
```
