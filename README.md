# Little Sky Station

A child-themed weather station display for Merrimack, NH. It shows real
current + upcoming weather through an animated "looking out a window"
scene that changes with the time of day and current conditions, plus a
real night-sky star chart for your exact location. Click things in the
scene to trigger short kid-friendly facts and quizzes.

## How it's built

- **`backend/`** — a small FastAPI service that fetches weather from
  [Open-Meteo](https://open-meteo.com/) (free, no API key) for Merrimack,
  NH, and classifies it into a time-of-day *period* (`dawn` / `day` /
  `dusk` / `night`, based on real sunrise/sunset) and a weather
  *condition* (`clear` / `partly_cloudy` / `cloudy` / `fog` / `rain` /
  `snow` / `thunderstorm`).
- **`frontend/`** — a React + TypeScript (Vite) app. The *period*
  chooses which "room" you're looking out from (a scene config loaded
  from JSON); the *condition* drives an independent animated overlay
  (rain, snow, fog, drifting clouds, thunderstorm flashes) layered on
  top. At night, a real star chart renders instead, computed live from
  your location and the current time using
  [astronomy-engine](https://github.com/cosinekitty/astronomy).

## Running it locally

**Backend** (needs Python 3.11+):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

This serves the API at `http://localhost:8000`. `GET /api/weather` fetches
live weather; `GET /api/location` returns the configured location.

**Frontend** (needs Node 18+):

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. It talks to the backend at
`http://localhost:8000` by default — set `VITE_API_BASE` if you're running
the backend somewhere else.

### Offline / no network dev mode

If you don't have internet access to Open-Meteo (or just want stable
data while tweaking scenes), run the backend with:

```bash
MOCK_WEATHER=1 uvicorn app.main:app --reload
```

This serves a bundled sample weather payload instead of calling the live
API.

## Changing the location

Location is currently fixed in `backend/app/config.py` (`LOCATION`), set
to Merrimack, NH. Update the `lat`/`lon`/`timezone`/`name` fields there to
move the whole app (weather + star chart) elsewhere.

## Customizing scenes without touching the defaults

Each time-of-day scene (`dawn`, `day`, `dusk`, `night`) is a JSON file in
`frontend/public/scenes/default/`. To recast a scene — different colors,
different hotspots, a different "feel" — **don't edit the defaults**.
Instead, add a same-named file under `frontend/public/scenes/user/`
containing only the fields you want to change; anything you leave out
falls back to the shipped default. See
`frontend/public/scenes/user/README.md` for the merge rules and an
example.

Each hotspot in a scene has a `lesson`: a fact, a multiple-choice
question, and a success message — that's the "click to learn something"
interaction. The night scene instead renders live constellation outlines
(Big Dipper, Cassiopeia, Little Dipper, Orion, the Summer Triangle) that
are clickable for a short blurb, plus the Moon with its current phase.

## Project layout

```
backend/
  app/
    config.py      location + feature flags
    weather.py      Open-Meteo client + condition/period classification
    main.py         FastAPI endpoints
  tests/             offline unit tests for the classification logic
frontend/
  public/scenes/
    default/         shipped scene configs (dawn/day/dusk/night)
    user/             your local overrides (gitignored is up to you)
  src/
    components/       Scene, SkyBackground, WeatherOverlay, SceneAccent,
                       HotspotMarker, LessonModal, StarChart, ForecastStrip
    lib/
      sceneEngine.ts       default+user scene loader/merger
      astronomyClient.ts   star/moon position + sky-dome projection
      starCatalog.ts        bright-star catalog + constellation lines
```

## Ideas for next steps

- A settings screen to change location without editing `config.py`.
- More scene variants (e.g. a distinct rainy-day room vs. sunny-day room,
  rather than one room with a weather overlay).
- Seasonal hotspots (e.g. a different tree state per season).
- A simple "streak" or sticker reward for answering lesson questions.
