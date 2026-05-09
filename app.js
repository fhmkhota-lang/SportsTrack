/* ==================================================================
   The Pitch — football tracker (TheSportsDB edition)
   ------------------------------------------------------------------
   - Uses TheSportsDB's free public API (key: 123, no signup needed)
   - Caches each endpoint with a sensible TTL to be polite (and fast)
   - Stores no API key (free tier needs none) but allows premium upgrade
   ================================================================== */

const API_BASE = 'https://www.thesportsdb.com/api/v1/json';
const FREE_KEY = '123';

/* ------------------------------------------------------------------
   League catalogue (TheSportsDB IDs)
   ------------------------------------------------------------------ */
const LEAGUES = [
  // South Africa
  { id: 4802, name: 'Premier Soccer League', short: 'PSL', flag: '🇿🇦', group: 'South Africa', seasonStyle: 'aug-may' },

  // England
  { id: 4328, name: 'Premier League',        short: 'EPL',     flag: '🏴', group: 'England', seasonStyle: 'aug-may' },
  { id: 4329, name: 'Championship',          short: 'Champ.',  flag: '🏴', group: 'England', seasonStyle: 'aug-may' },
  { id: 4482, name: 'FA Cup',                short: 'FA Cup',  flag: '🏴', group: 'England', seasonStyle: 'aug-may', type: 'cup' },

  // Europe
  { id: 4335, name: 'La Liga',               short: 'La Liga',     flag: '🇪🇸', group: 'Europe', seasonStyle: 'aug-may' },
  { id: 4332, name: 'Serie A',               short: 'Serie A',     flag: '🇮🇹', group: 'Europe', seasonStyle: 'aug-may' },
  { id: 4331, name: 'Bundesliga',            short: 'Bundes.',     flag: '🇩🇪', group: 'Europe', seasonStyle: 'aug-may' },
  { id: 4334, name: 'Ligue 1',               short: 'Ligue 1',     flag: '🇫🇷', group: 'Europe', seasonStyle: 'aug-may' },
  { id: 4337, name: 'Eredivisie',            short: 'Eredivisie',  flag: '🇳🇱', group: 'Europe', seasonStyle: 'aug-may' },

  // Continental & international
  { id: 4480, name: 'UEFA Champions League', short: 'UCL',          flag: '🏆', group: 'Continental',   seasonStyle: 'aug-may',    type: 'cup' },
  { id: 4481, name: 'UEFA Europa League',    short: 'UEL',          flag: '🏆', group: 'Continental',   seasonStyle: 'aug-may',    type: 'cup' },
  { id: 5071, name: 'UEFA Conference League',short: 'UECL',         flag: '🏆', group: 'Continental',   seasonStyle: 'aug-may',    type: 'cup' },
  { id: 4429, name: 'FIFA World Cup',        short: 'World Cup',    flag: '🌐', group: 'International', seasonStyle: 'tournament', type: 'cup' },
  { id: 4496, name: 'Africa Cup of Nations', short: 'AFCON',        flag: '🌍', group: 'International', seasonStyle: 'tournament', type: 'cup' },
  { id: 4499, name: 'Copa America',          short: 'Copa America', flag: '🌐', group: 'International', seasonStyle: 'tournament', type: 'cup' },

  // Americas
  { id: 4351, name: 'Brasileirão Série A',   short: 'Brasil A', flag: '🇧🇷', group: 'Americas', seasonStyle: 'mar-nov' },
  { id: 4346, name: 'Major League Soccer',   short: 'MLS',      flag: '🇺🇸', group: 'Americas', seasonStyle: 'mar-nov' }
];

const DEFAULT_LEAGUE_ID = 4802; // PSL

/* TTLs — TheSportsDB free has soft rate limits, cache generously */
const TTL = {
  table:    60 * 60 * 1000,        // 1 hour
  events:   30 * 60 * 1000,        // 30 minutes (next/past events)
  livescore:     60 * 1000         // 1 minute
};

/* ------------------------------------------------------------------
   Storage
   ------------------------------------------------------------------ */
const LS = {
  KEY:           'pitch.apikey',     // optional, only if user has premium
  LEAGUE_ID:     'pitch.league.id',
  CACHE_PREFIX:  'pitch.cache.'
};

const getKey = () => localStorage.getItem(LS.KEY) || FREE_KEY;
const setKey = (k) => localStorage.setItem(LS.KEY, k.trim());
const clearKey = () => localStorage.removeItem(LS.KEY);

function getLeagueId() {
  return parseInt(localStorage.getItem(LS.LEAGUE_ID) || DEFAULT_LEAGUE_ID, 10);
}
function setLeagueId(id) { localStorage.setItem(LS.LEAGUE_ID, String(id)); }
function getLeague() {
  const id = getLeagueId();
  return LEAGUES.find(l => l.id === id) || LEAGUES[0];
}

/* ------------------------------------------------------------------
   Season string per league type — TheSportsDB uses YYYY-YYYY
   ------------------------------------------------------------------ */
function currentSeasonFor(league) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (league.seasonStyle === 'mar-nov') {
    // Single-year season, mar-nov — Brazilian/MLS style
    return String(m >= 2 ? y : y - 1);
  }
  // Everything else — including tournaments — uses cross-year format on
  // TheSportsDB (e.g. "2024-2025", "2025-2026"). Tournaments have qualifying
  // matches across multiple seasons, so the cross-year format actually fits.
  // Aug–Dec → current year is the start; Jan–Jul → previous year is the start.
  const start = m >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/* ------------------------------------------------------------------
   Cache + fetch
   ------------------------------------------------------------------ */
function cacheGet(key) {
  try {
    const raw = localStorage.getItem(LS.CACHE_PREFIX + key);
    if (!raw) return null;
    const { exp, data } = JSON.parse(raw);
    if (Date.now() > exp) return null;
    return data;
  } catch { return null; }
}
function cacheSet(key, data, ttl) {
  try {
    localStorage.setItem(LS.CACHE_PREFIX + key,
      JSON.stringify({ exp: Date.now() + ttl, data }));
  } catch { /* quota exceeded — silently skip */ }
}

async function apiGet(path, params = {}, ttl = 60_000, { force = false } = {}) {
  const qs = new URLSearchParams(params).toString();
  const cacheKey = `${path}?${qs}`;

  if (!force) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const url = `${API_BASE}/${getKey()}/${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);

  if (res.status === 429)
    throw new Error('TheSportsDB is rate-limiting. Wait a minute and try again.');
  if (res.status === 401)
    throw new Error('Invalid API key. Click ⚙ Key to clear it (free tier needs no key).');
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const json = await res.json();
  cacheSet(cacheKey, json, ttl);
  return json;
}

/* ------------------------------------------------------------------
   API methods
   ------------------------------------------------------------------ */
async function fetchTable(force = false) {
  const l = getLeague();
  return apiGet('lookuptable.php',
    { l: l.id, s: currentSeasonFor(l) }, TTL.table, { force });
}
async function fetchNextEvents(force = false) {
  const l = getLeague();
  return apiGet('eventsnextleague.php', { id: l.id }, TTL.events, { force });
}
async function fetchPastEvents(force = false) {
  const l = getLeague();
  return apiGet('eventspastleague.php', { id: l.id }, TTL.events, { force });
}
async function fetchSeasonEvents(force = false) {
  const l = getLeague();
  return apiGet('eventsseason.php',
    { id: l.id, s: currentSeasonFor(l) }, TTL.events, { force });
}

/* ------------------------------------------------------------------
   Renderers
   ------------------------------------------------------------------ */
const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA',
    { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtTime = (timeStr) => {
  if (!timeStr) return '';
  // TheSportsDB strTime is HH:MM:SS UTC
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setUTCHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
};

function renderHeader() {
  const l = getLeague();
  document.getElementById('current-league-name').textContent = l.name;
  document.getElementById('current-league-meta').textContent =
    `Season ${currentSeasonFor(l)}`;
  const hint = document.getElementById('standings-meta');
  if (hint) hint.textContent = `${l.name} · season ${currentSeasonFor(l)}`;
}

function renderTable(json) {
  const tbody = document.querySelector('#standings-table tbody');
  const rows = json?.table || [];
  if (!rows.length) {
    const l = getLeague();
    const msg = l.type === 'cup'
      ? 'This is a cup competition — no league table. Check Fixtures and Results for the bracket.'
      : 'No standings data available for this season yet.';
    tbody.innerHTML = `<tr><td colspan="11" class="empty">${msg}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((row, i) => {
    const rank = parseInt(row.intRank, 10) || (i + 1);
    const gd = parseInt(row.intGoalDifference, 10) || 0;
    const gdCls = gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : '';
    const rankCls = rank <= 3 ? 'rank rank--top' : 'rank';
    const formPills = (row.strForm || '').split('').slice(-5).map(c =>
      `<span class="form-pill form-pill--${c}">${c}</span>`).join('');
    return `
      <tr>
        <td><span class="${rankCls}">${rank}</span></td>
        <td class="t-left">
          <div class="club-cell">
            ${row.strBadge ? `<img src="${row.strBadge}/tiny" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
            <span class="club-cell__name">${row.strTeam}</span>
          </div>
        </td>
        <td>${row.intPlayed ?? '-'}</td>
        <td>${row.intWin ?? '-'}</td>
        <td>${row.intDraw ?? '-'}</td>
        <td>${row.intLoss ?? '-'}</td>
        <td>${row.intGoalsFor ?? '-'}</td>
        <td>${row.intGoalsAgainst ?? '-'}</td>
        <td class="${gdCls}">${gd > 0 ? '+' + gd : gd}</td>
        <td class="pts">${row.intPoints ?? '-'}</td>
        <td class="t-left"><span class="form-pills">${formPills}</span></td>
      </tr>`;
  }).join('');
}

function renderEvents(containerId, events, mode) {
  const el = document.getElementById(containerId);
  if (!events || !events.length) {
    el.innerHTML = `<div class="empty">No matches available right now.</div>`;
    return;
  }
  el.innerHTML = events.map(ev => {
    const home = ev.strHomeTeam || '';
    const away = ev.strAwayTeam || '';
    const homeBadge = ev.strHomeTeamBadge || '';
    const awayBadge = ev.strAwayTeamBadge || '';
    const gh = ev.intHomeScore;
    const ga = ev.intAwayScore;
    const isFinished = (ev.strStatus === 'Match Finished') || (gh != null && ga != null && mode !== 'fixtures');
    const round = ev.intRound ? `Round ${ev.intRound}` : '';
    const centre = mode === 'fixtures'
      ? `<div class="match__score match__score--vs">vs</div>`
      : `<div class="match__score">${gh ?? '-'} : ${ga ?? '-'}</div>`;
    const subline = mode === 'fixtures'
      ? fmtTime(ev.strTime)
      : (isFinished ? 'Full time' : (ev.strStatus || ''));
    const when = `<div class="match__when">
        <strong>${fmtDate(ev.dateEvent)}</strong>
        ${subline}
        ${round ? `<span class="match__round">${round}</span>` : ''}
      </div>`;
    const homeImg = homeBadge ? `<img src="${homeBadge}/tiny" alt="" loading="lazy" onerror="this.style.display='none'" />` : '';
    const awayImg = awayBadge ? `<img src="${awayBadge}/tiny" alt="" loading="lazy" onerror="this.style.display='none'" />` : '';
    return `
      <div class="match">
        ${when}
        <div class="match__team">${homeImg}<span>${home}</span></div>
        ${centre}
        <div class="match__team match__team--away"><span>${away}</span>${awayImg}</div>
      </div>`;
  }).join('');
}

function renderLive(events) {
  // TheSportsDB free has no real livescore endpoint — best we can do is
  // surface today's events from past+next as "in play" if dates match today.
  const el = document.getElementById('live-body');
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = (events || []).filter(ev => ev.dateEvent === today);
  if (!todayEvents.length) {
    el.innerHTML = `<div class="empty">No matches scheduled today for this competition.<br><br><span style="font-size:11px;color:var(--ink-faint);text-transform:none;letter-spacing:.05em">Note: in-play live scores require a TheSportsDB premium key (€9/month). Today's fixtures shown here will update with final scores when matches finish.</span></div>`;
    return;
  }
  el.innerHTML = todayEvents.map(ev => {
    const gh = ev.intHomeScore, ga = ev.intAwayScore;
    const hasScore = gh != null && ga != null;
    const status = ev.strStatus || (hasScore ? 'In progress' : `Kicks off ${fmtTime(ev.strTime)}`);
    const homeBadge = ev.strHomeTeamBadge ? `<img src="${ev.strHomeTeamBadge}/tiny" alt="" />` : '';
    const awayBadge = ev.strAwayTeamBadge ? `<img src="${ev.strAwayTeamBadge}/tiny" alt="" />` : '';
    return `
      <div class="match">
        <div class="match__row">
          <span class="match__live-tag">Today</span>
          <span class="match__minute">${status}</span>
        </div>
        <div class="match__row">
          <div class="match__team">${homeBadge}<span>${ev.strHomeTeam}</span></div>
          <div class="match__score">${gh ?? '-'}</div>
        </div>
        <div class="match__row">
          <div class="match__team">${awayBadge}<span>${ev.strAwayTeam}</span></div>
          <div class="match__score">${ga ?? '-'}</div>
        </div>
      </div>`;
  }).join('');
}

/* ------------------------------------------------------------------
   Tab loaders
   ------------------------------------------------------------------ */
async function loadStandings(force = false) {
  try { renderTable(await fetchTable(force)); }
  catch (e) { showError(e); }
}
async function loadLive(force = false) {
  try {
    // Combine past & next events to detect anything happening today
    const [past, next] = await Promise.all([
      fetchPastEvents(force).catch(() => ({ events: [] })),
      fetchNextEvents(force).catch(() => ({ events: [] }))
    ]);
    const all = [...(past.events || []), ...(next.events || [])];
    renderLive(all);
  } catch (e) { showError(e); }
}
async function loadFixtures(force = false) {
  try {
    const json = await fetchNextEvents(force);
    const events = (json.events || []).sort((a, b) =>
      (a.dateEvent + a.strTime).localeCompare(b.dateEvent + b.strTime));
    renderEvents('fixtures-body', events, 'fixtures');
  } catch (e) { showError(e); }
}
async function loadResults(force = false) {
  try {
    const json = await fetchPastEvents(force);
    const events = (json.events || []).sort((a, b) =>
      (b.dateEvent + (b.strTime || '')).localeCompare(a.dateEvent + (a.strTime || '')));
    renderEvents('results-body', events, 'results');
  } catch (e) { showError(e); }
}

const TAB_LOADERS = {
  live:      loadLive,
  standings: loadStandings,
  fixtures:  loadFixtures,
  results:   loadResults
};

/* ------------------------------------------------------------------
   UI plumbing
   ------------------------------------------------------------------ */
function showError(err) {
  console.error(err);
  showToast(err.message || String(err));
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('is-shown');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('is-shown'), 4000);
}

let activeTab = 'standings';
function setActiveTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(b =>
    b.classList.toggle('is-active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => {
    const active = p.dataset.panel === name;
    p.classList.toggle('is-active', active);
    p.hidden = !active;
  });
  TAB_LOADERS[name]?.();
  manageLivePoll(name);
  document.getElementById('last-updated').textContent =
    'Last updated: ' + new Date().toLocaleTimeString();
}

let liveTimer = null;
function manageLivePoll(name) {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  if (name === 'live') liveTimer = setInterval(() => loadLive(true), 90_000);
}

/* ------------------------------------------------------------------
   League selector
   ------------------------------------------------------------------ */
function buildLeagueMenu() {
  const menu = document.getElementById('league-menu');
  const groups = {};
  for (const l of LEAGUES) (groups[l.group] = groups[l.group] || []).push(l);
  menu.innerHTML = Object.entries(groups).map(([groupName, items]) => `
    <div class="lm-group">
      <div class="lm-group__title">${groupName}</div>
      ${items.map(l => `
        <button class="lm-item" data-id="${l.id}">
          <span class="lm-item__flag">${l.flag}</span>
          <span class="lm-item__name">${l.name}</span>
          <span class="lm-item__short">${l.short}</span>
        </button>
      `).join('')}
    </div>
  `).join('');
  menu.querySelectorAll('.lm-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchLeague(parseInt(btn.dataset.id, 10));
      closeLeagueMenu();
    });
  });
}
const openLeagueMenu   = () => document.getElementById('league-picker').classList.add('is-open');
const closeLeagueMenu  = () => document.getElementById('league-picker').classList.remove('is-open');
const toggleLeagueMenu = () => document.getElementById('league-picker').classList.toggle('is-open');

function refreshLeagueButton() {
  const l = getLeague();
  document.getElementById('league-picker-flag').textContent = l.flag;
  document.getElementById('league-picker-name').textContent = l.short;
  document.querySelectorAll('.lm-item').forEach(btn => {
    btn.classList.toggle('is-current', parseInt(btn.dataset.id, 10) === l.id);
  });
}
function switchLeague(id) {
  setLeagueId(id);
  refreshLeagueButton();
  renderHeader();
  document.querySelector('#standings-table tbody').innerHTML =
    '<tr><td colspan="11" class="empty">Loading…</td></tr>';
  document.getElementById('live-body').innerHTML     = '<div class="empty">Loading…</div>';
  document.getElementById('fixtures-body').innerHTML = '<div class="empty">Loading…</div>';
  document.getElementById('results-body').innerHTML  = '<div class="empty">Loading…</div>';
  TAB_LOADERS[activeTab]?.();
}

/* ------------------------------------------------------------------
   Init
   ------------------------------------------------------------------ */
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn =>
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));
}
function initButtons() {
  document.getElementById('refresh-btn').addEventListener('click', () => {
    TAB_LOADERS[activeTab]?.(true);
    showToast('Refreshing ' + activeTab + '…');
  });
  document.getElementById('reset-key-btn').addEventListener('click', () => {
    if (confirm('Clear stored premium API key (if any) and revert to free key?')) {
      clearKey();
      // Clear the cache too, since data may have come from premium endpoints
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS.CACHE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
      showToast('Reset to free tier');
      TAB_LOADERS[activeTab]?.(true);
    }
  });
  document.getElementById('league-picker-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLeagueMenu();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#league-picker')) closeLeagueMenu();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initButtons();
  buildLeagueMenu();
  refreshLeagueButton();
  renderHeader();
  setActiveTab('standings');
});
