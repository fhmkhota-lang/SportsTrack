# The Pitch — football tracker

A single-page football tracker covering 17 leagues and cups, with standings, fixtures, results and today's matches. Powered by [TheSportsDB](https://www.thesportsdb.com/) — a free, crowd-sourced sports database.

**No signup. No API key. No quota. Just open it and go.**

Pure HTML / CSS / vanilla JS. No build step. Deploys straight to GitHub Pages.

## What's covered

| Group          | Competitions |
|----------------|--------------|
| South Africa   | PSL (Betway Premiership) |
| England        | Premier League · Championship · FA Cup |
| Europe         | La Liga · Serie A · Bundesliga · Ligue 1 · Eredivisie |
| Continental    | UEFA Champions League · Europa League · Conference League |
| International  | FIFA World Cup · Africa Cup of Nations · Copa America |
| Americas       | Brasileirão · MLS |

Switch between them via the dropdown in the header.

## Features

- **Standings** with W/D/L form pills (last 5 matches)
- **Today's matches** with kickoff times and status, auto-refreshing every 90 seconds
- **Fixtures** — next 15 scheduled matches
- **Results** — last 15 completed matches
- **Aggressive client-side caching** — standings cached 1 hour, events 30 minutes
- **Sensible defaults for cup competitions** (no league table → friendly message)

## How to deploy to GitHub Pages

1. Create a new public repo on GitHub (e.g. `the-pitch`).
2. Upload the three files — `index.html`, `styles.css`, `app.js` — to the root.
3. Go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, select `main` and `/ (root)`, hit Save.
5. Your site goes live in ~60 seconds at `https://<your-username>.github.io/the-pitch/`.

That's it. No API key gate, no signup step. Just open the URL.

## Why TheSportsDB instead of API-Football?

Honest tradeoff:

| Feature                   | API-Football        | TheSportsDB (used here)    |
|---------------------------|---------------------|----------------------------|
| Signup required           | Yes                 | **No**                     |
| Daily quota               | 100 requests        | **None on free tier**      |
| Live in-play scores       | Yes (15s refresh)   | Premium only (€9/mo)       |
| Account suspension risk   | Yes (if you exceed) | **No**                     |
| Standings, fixtures, results | Yes              | Yes                        |
| Top scorers / assists     | Yes                 | No (not on free tier)      |
| Coverage                  | 1,200+ leagues      | Most major leagues         |

For a casual tracker that just works, TheSportsDB wins because it never breaks on you. The honest catch: you can see today's match status (kickoff time, full time, scores when they're entered), but you don't get the live ticker showing the 67th minute as it ticks. For PSL and most leagues, scores update fairly soon after matches end.

## Upgrading later

If you ever want live in-play scoring, sign up for TheSportsDB Patreon supporter tier (€9/month). They give you a personal key that you paste into the **⚙ Key** button in the header. The app stores it in `localStorage` only, never committed to your repo.

To revert to free, click ⚙ Key again and confirm. The app will fall back to the public `123` key.

## Customisation

The league catalogue is a hand-picked list at the top of `app.js`. To add a league:

1. Find its ID by visiting `https://www.thesportsdb.com/` and looking for the league. The URL will show the ID, e.g. `/league/4328-english-premier-league` → ID is `4328`.
2. Add an entry to the `LEAGUES` array:

```js
{ id: 4328,
  name: 'Premier League',
  short: 'EPL',
  flag: '🏴',
  group: 'England',
  seasonStyle: 'aug-may'  // or 'mar-nov' or 'tournament'
}
```

3. Optionally add `type: 'cup'` for cup competitions (suppresses the "no standings" warning).

## Files

```
the-pitch/
├── index.html     # markup, league picker, tabs
├── styles.css     # editorial dark theme
├── app.js         # API client, caching, league catalogue, renderers
└── README.md      # this file
```

## Credits

- Data: [TheSportsDB](https://www.thesportsdb.com/) (crowd-sourced, free public API)
- Fonts: Fraunces, Inter, JetBrains Mono (Google Fonts)
