# Constructive

Pre-feasibility street redevelopment simulator for Indian cities. Build for Bharat, Track 5 (Smarter Cities & Civic Infrastructure).

Pick a lane, record site observations, add proposed works from categorised lists, and see the effect on fire access, waterlogging, heat, structural screening, walkability, displacement and indicative cost — then export a DPR note.

> Indicative pre-feasibility only. Screening checks are not a compliance or structural audit. All coefficients are placeholders to be replaced with the local schedule of rates and validated by a planner.

## Run

```bash
python3 -m http.server 5173   # then open http://localhost:5173
npm test                      # model unit tests (Node 18+)
```

No build step. Static files only, so it deploys to any static host (Vercel, GitHub Pages).

## Structure

- `model.js` — all formulas, assumptions and works (pure, unit-tested in `model.test.mjs`)
- `scene.js` — three.js lane scene
- `app.js` — UI wiring, observations, DPR note
- `i18n.js` — English / Hindi strings
