# Race Game

Pixel-art race game with two selectable themes: **Forest (wild boar, default)** and **Desert (camel)**; German titles *Wildschwein Rennen* / *Kamel Rennen*. Single `index.html`, zero runtime dependencies, no build step. Works offline from `file://`.

Repo: [`controllan/race-game`](https://github.com/controllan/race-game) · Pages: https://controllan.github.io/race-game/

## Run

Open `index.html` in a browser — double-click it or drag it into a tab. No server, no install, no network.

## Play

- **Camels** — set the count, 2–8 (default 4).
- **Goal** — set a target score, 1–10000 (default 200), or tick **∞** for an endless race. The two are mutually exclusive.
- **Move** — per camel use `+1` / `+5` / `+10`, or type an exact score (integer ≥ 0) and press **Set**. Lowering a score moves the camel left.
- **Teams** — each lane has a **Team** field (max 16 characters). Typing renames that lane: it updates the lane header, the winner banner, the live announcement, and the label drawn above the animal on the canvas (moves with the animal, updates live). Names are session-only and never translated.
- **Finish** — first camel to reach the goal score wins: the race stops, a winner banner and pixel confetti appear, and all score inputs lock.
- **New race** — resets scores and re-enables controls; keeps camel count, goal, and language.
- **Language** — the `EN` / `DE` toggle in the header switches every string. Default EN.
- **Theme** — the `Desert` / `Forest` toggle in the header, next to the language toggle, swaps the art instantly. Default Forest.

All animals always stay visible on the canvas, even at large score spreads or in infinite mode. The canvas renders a `1280×720` pixel-art buffer scaled to fit. In the desert theme camels ride the undulating sand dune lanes; in the forest theme wild boars with hunter riders ride dense grass lanes under a dusk treeline with distant violet ridges. Each animal carries a colored rider and its team name is drawn on a canvas label above it. The camel carries its decorated saddle blanket (green cloth, cream + red stripes, white fringe); the wild boar stays animal + rider, blanket-free.

Out of scope: sound, cross-device sync, multiplayer, betting.

## Persistence

Progress is saved to `localStorage` under the key `camelRace.v1` (single JSON string,
`version: 1`). A page refresh restores the whole game: camel count, each lane's name and
score, goal score, infinite flag, language, theme, race-over flag, and winner. New race
resets scores, the race-over flag, and the winner but keeps count, names, goal, language,
and theme.

Persistence is **per-origin and per-device** — state is not synced across devices or
browsers. Where `localStorage` is unavailable or restricted (private mode, opaque
`file://` origins, disabled storage), the game still plays fully in memory and raises no
errors.

## Themes

Two themes: **Desert** (camel + dunes) and **Forest** (wild boar with visible tusks and
eye detail + hunter rider, dense grass floor cover — tufts, ferns, leaf drifts, grass
waves, twigs, mushrooms, moss, stones and pine needles — plus dusk ridges and a treeline,
moon).
Switch with the theme toggle in the header next to the language toggle — the swap is
instant, does not reset scores, and the selection is persisted. **Forest is the
default**: a fresh game (or one with no saved theme) opens as `BOAR RACE` /
`WILDSCHWEIN RENNEN`. A persisted theme — desert included — overrides the default on
reload. Both themes share one score set, the lane colours, and the team-name labels above the animals.
The in-game title follows the
theme and language: `BOAR RACE` / `WILDSCHWEIN RENNEN` in the forest theme, `CAMEL RACE`
/ `KAMEL RENNEN` in the desert theme (header and browser tab).

## Deploy with Docker

Serves the game on port **6666** via nginx (static file, no backend). Forward your subdomain to `host:6666` — plain HTTP upstream, TLS at your reverse proxy. No websockets or special headers needed.

```bash
docker compose up -d --build
```

Or without compose:

```bash
docker build -t camel-game .
docker run -d --name camel-game -p 6666:6666 --restart unless-stopped camel-game
```

## Test (dev only)

Requires [pnpm](https://pnpm.io/). Tests drive the game over `file://` — no HTTP server.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```
