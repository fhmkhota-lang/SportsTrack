# The Pitch — football tracker

A single-page football tracker covering 23 leagues and cups, with live scores, standings, fixtures, results and player leaderboards. Powered by the free tier of [API-Football](https://www.api-football.com/).

Pure HTML / CSS / vanilla JS. No build step. Deploys straight to GitHub Pages.

## Leagues covered

| Group          | Competitions |
|----------------|--------------|
| South Africa   | Premier Soccer League · National First Division |
| England        | Premier League · Championship · FA Cup · EFL Cup |
| Europe         | La Liga · Serie A · Bundesliga · Ligue 1 · Eredivisie · Primeira Liga |
| Continental    | Champions League · Europa League · Conference League · CAF Champions League |
| International  | World Cup · Euros · AFCON · Copa America |
| Americas       | Brasileirão · Argentina LPF · MLS |

Switch between them via the dropdown in the header. Each league's data caches independently.

## Features

- **Standings** with form pills (last 5). Cup competitions show group stages where applicable.
- **Live matches** with auto-refresh every 60 seconds (only while the tab is active)
- **Fixtures** for the next 14 days (leagues) or upcoming rounds (cups)
- **Results** for the past 14 days (leagues) or recent rounds (cups)
- **Top scorers** and **top assists** leaderboards
- **Built-in daily quota counter** (UTC, matches API-Football's reset)
- **Aggressive client-side caching** so a casual browse burns ~5–10 requests

## How to deploy to GitHub Pages

1. Create a new public repo on GitHub (e.g. `the-pitch`).
2. Upload the three files — `index.html`, `styles.css`, `app.js` — to the root.
3. Go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, select `main` and `/ (root)`, hit Save.
5. Your site will be live in ~1 minute at `https://<your-username>.github.io/the-pitch/`.

## How to use

1. Get a free API key at https://dashboard.api-football.com/register (no credit card needed, 100 requests/day).
2. Open the site. The key gate appears.
3. Paste your key. It's stored in your browser's `localStorage` only.
4. Pick a league from the dropdown. Click any tab to load it.

## Important: the API key is in the browser

GitHub Pages serves only static files. There is no backend, so the key has to live in the browser. Three things to know:

- **The key is yours.** Anyone who opens your deployed site has to enter their own key. Yours is never bundled into the code.
- **If you share the URL**, visitors enter their own key. They cannot see yours.
- **Don't paste your key into the source code or commit it to the repo.** The app keeps the key in `localStorage` only.

## Quota strategy

The free tier gives 100 requests/day, resetting at 00:00 UTC. The app caches each endpoint with a TTL appropriate to how often the data actually changes:

| Data            | TTL          | Why                              |
|-----------------|--------------|----------------------------------|
| Standings       | 1 hour       | API updates hourly anyway        |
| Fixtures list   | 6 hours      | Schedules rarely change          |
| Live scores     | 1 minute     | Updated every 15s by the API     |
| Top scorers     | 12 hours     | Slow-moving                      |
| Top assists     | 12 hours     | Slow-moving                      |

Switching leagues triggers a fresh fetch for that league, but each league's cache is preserved — flicking PSL → EPL → PSL within an hour costs you nothing the second time.

A typical session opens 2–3 tabs across one league = ~5 requests. Sitting on the live tab during a 90-min match = ~90 requests. Budget your live-tab time.

## Adding more leagues

The catalogue is hand-curated for sensible defaults, but adding new ones is one line. Open `app.js`, find the `LEAGUES` array, and add an entry:

```js
{ id: 71, name: 'Brasileirão Série A', short: 'Brasil A',
  country: 'Brazil', flag: '🇧🇷',
  type: 'league',          // 'league' or 'cup'
  seasonStyle: 'mar-nov',  // 'aug-may', 'mar-nov', or 'tournament'
  group: 'Americas' }
```

To find a league ID, log in at the API-Football dashboard and use the IDs section, or call `/leagues?country=Country-Name` from your browser with your API key.

## Files

```
the-pitch/
├── index.html     # markup, sections, key gate, league picker
├── styles.css     # editorial dark theme
├── app.js         # API client, caching, league catalogue, renderers
└── README.md      # this file
```

## Credits

- Data: [API-Football](https://www.api-football.com/) (api-sports.io)
- Fonts: Fraunces, Inter, JetBrains Mono (Google Fonts)
