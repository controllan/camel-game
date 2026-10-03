# Kamel Derby

Single-file pixel-art camel race game. One `index.html`, zero runtime dependencies, no build step. Works offline from `file://`.

## Run

Open `index.html` in a browser — double-click it or drag it into a tab. No server, no install, no network.

## Play

- **Camels** — set the count, 2–8 (default 4).
- **Goal** — set a target score, 1–10000 (default 200), or tick **∞** for an endless race. The two are mutually exclusive.
- **Move** — per camel use `+1` / `+5` / `+10`, or type an exact score (integer ≥ 0) and press **Set**. Lowering a score moves the camel left.
- **Teams** — each lane has a **Team** field (max 16 characters). Typing renames that lane: it updates the lane header, the winner banner, and the live announcement. Names are session-only and never translated.
- **Finish** — first camel to reach the goal score wins: the race stops, a winner banner and pixel confetti appear, and all score inputs lock.
- **New race** — resets scores and re-enables controls; keeps camel count, goal, and language.
- **Language** — the `EN` / `DE` toggle in the header switches every string. Default EN.

All camels always stay visible on the canvas, even at large score spreads or in infinite mode. Camels ride the undulating sand dune lanes; each is a brown camel with a colored rider and a numbered light-blue saddle blanket.

Out of scope: sound, persistence, multiplayer, betting.

## Test (dev only)

Requires [pnpm](https://pnpm.io/). Tests drive the game over `file://` — no HTTP server.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```
