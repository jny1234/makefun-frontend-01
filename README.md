# makefun-frontend-01

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/jny1234/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/jny1234/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, polished, fully working static frontend for make.fun — no build step, no sign-in, no third-party code. It reads make.fun's public API alone (read-only GET) and renders live data on every surface.

## Surfaces

All four are reachable by link and by their own hash URL:

| Route | Surface |
| --- | --- |
| `#/` | Bounty board — live bounties with live pot, entry fee, time left and entry counts; category filters, sort (largest pot / closing soonest / most entries), search; recently closed bounties below |
| `#/bounty/<slug>` | Bounty page — summary, live pot card, deadline/opened/entries/status, rewards table with live fee shares, description and rules, top-5 leaderboard preview |
| `#/bounty/<slug>/leaderboard` | Full leaderboard — the API's own columns, 25 entries a page, house/baseline tags |
| `#/u/<handle>` | Public profile — avatar, bio, links, record stats (entered / placed / won / podiums / best place / prizes), entries table |

A bounty counts as open while its deadline is in the future — a past-deadline bounty reads closed here even when the API still calls it open. API answers are cached in memory for 60 seconds, so re-renders, back navigation and tab switches do not refetch. `window.__shotReady` is false while a route loads and true once its data has rendered.

## Run it

```sh
python3 -m http.server 8000 --directory app
```

Then open http://localhost:8000/ in a desktop browser.

## Files

- `app/index.html` — shell: sticky header with brand, navigation and search
- `app/main.js` — hash router, board state (sort / filter / search), leaderboard paging
- `app/api.js` — read-only `https://make.fun/api` GET client with a 60 s in-memory cache
- `app/format.js` — money, dates, time-left, win rates, byte sizes, escaping
- `app/views.js` — the four surfaces, plus loading, error and empty states
- `app/style.css` — the whole design; system font stack only
- `main.ts` — hands the app in: copies `app/` and `screenshots/` to `/output` and writes `dossier.json` (unchanged from the kit starter)
- `screenshots/` — 3 real renders at 1280×800, taken in headless Chrome on live data (see `shots.json` for the routes)
- `vendor/makefun-frontend.ts` — the kit's dossier library, unchanged

## Screenshots

1. `1-board.jpg` — the board (`#/`)
2. `2-bounty.jpg` — the token-radar bounty page (`#/bounty/token-radar-01`)
3. `3-bounty.jpg` — the git-forge bounty page (`#/bounty/github-core-clone-01`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=tknw5y2x&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
