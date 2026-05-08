/* ==================================================================
   The Pitch — multi-league football tracker
   ------------------------------------------------------------------
   - Caches every endpoint with TTL appropriate to its update rate
   - Tracks daily request count (resets at 00:00 UTC)
   - Stores API key in localStorage only (never committed to repo)
   - Supports leagues AND cups (handles no-standings gracefully)
   ================================================================== */

const API_BASE = 'https://v3.football.api-sports.io';

/* ------------------------------------------------------------------
   League catalogue
   ------------------------------------------------------------------
   API-Football's league IDs are stable across seasons.
     type: 'league' has standings + top scorers/assists
     type: 'cup'    usually no league standings (groups instead)
     seasonStyle:
       'aug-may'    European calendar (Aug start)
       'mar-nov'    South American / MLS calendar (Mar start)
       'tournament' single-year tournaments (World Cup, Euros)
   ------------------------------------------------------------------ */
const LEAGUES = [
  // South Africa
  { id: 288, name: 'Premier Soccer League',     short: 'PSL',          country: 'South Africa', flag: '🇿🇦', type: 'league', seasonStyle: 'aug-may',    group: 'South Africa' },
  { id: 289, name: 'National First Division',   short: 'NFD',          country: 'South Africa', flag: '🇿🇦', type: 'league', seasonStyle: 'aug-may',    group: 'South Africa' },

  // England
  { id: 39,  name: 'Premier League',            short: 'EPL',          country: 'England',      flag: '🏴', type: 'league', seasonStyle: 'aug-may',    group: 'England' },
  { id: 40,  name: 'Championship',              short: 'Champ.',       country: 'England',      flag: '🏴', type: 'league', seasonStyle: 'aug-may',    group: 'England' },
  { id: 45,  name: 'FA Cup',                    short: 'FA Cup',       country: 'England',      flag: '🏴', type: 'cup',    seasonStyle: 'aug-may',    group: 'England' },
  { id: 48,  name: 'EFL Cup',                   short: 'EFL Cup',      country: 'England',      flag: '🏴', type: 'cup',    seasonStyle: 'aug-may',    group: 'England' },

  // Top European leagues
  { id: 140, name: 'La Liga',                   short: 'La Liga',      country: 'Spain',        flag: '🇪🇸', type: 'league', seasonStyle: 'aug-may',    group: 'Europe' },
  { id: 135, name: 'Serie A',                   short: 'Serie A',      country: 'Italy',        flag: '🇮🇹', type: 'league', seasonStyle: 'aug-may',    group: 'Europe' },
  { id: 78,  name: 'Bundesliga',                short: 'Bundes.',      country: 'Germany',      flag: '🇩🇪', type: 'league', seasonStyle: 'aug-may',    group: 'Europe' },
  { id: 61,  name: 'Ligue 1',                   short: 'Ligue 1',      country: 'France',       flag: '🇫🇷', type: 'league', seasonStyle: 'aug-may',    group: 'Europe' },
  { id: 88,  name: 'Eredivisie',                short: 'Eredivisie',   country: 'Netherlands',  flag: '🇳🇱', type: 'league', seasonStyle: 'aug-may',    group: 'Europe' },
  { id: 94,  name: 'Primeira Liga',             short: 'Liga POR',     country: 'Portugal',     flag: '🇵🇹', type: 'league', seasonStyle: 'aug-may',    group: 'Europe' },

  // UEFA & continental
  { id: 2,   name: 'UEFA Champions League',     short: 'UCL',          country: 'Europe',       flag: '🏆', type: 'cup',    seasonStyle: 'aug-may',    group: 'Continental' },
  { id: 3,   name: 'UEFA Europa League',        short: 'UEL',          country: 'Europe',       flag: '🏆', type: 'cup',    seasonStyle: 'aug-may',    group: 'Continental' },
  { id: 848, name: 'UEFA Europa Conf. League',  short: 'UECL',         country: 'Europe',       flag: '🏆', type: 'cup',    seasonStyle: 'aug-may',    group: 'Continental' },
  { id: 12,  name: 'CAF Champions League',      short: 'CAF CL',       country: 'Africa',       flag: '🌍', type: 'cup',    seasonStyle: 'aug-may',    group: 'Continental' },

  // International
  { id: 1,   name: 'World Cup',                 short: 'World Cup',    country: 'World',        flag: '🌐', type: 'cup',    seasonStyle: 'tournament', group: 'International' },
  { id: 4,   name: 'European Championship',     short: 'Euros',        country: 'Europe',       flag: '🌐', type: 'cup',    seasonStyle: 'tournament', group: 'International' },
  { id: 6,   name: 'Africa Cup of Nations',     short: 'AFCON',        country: 'Africa',       flag: '🌐', type: 'cup',    seasonStyle: 'tournament', group: 'International' },
  { id: 9,   name: 'Copa America',              short: 'Copa America', country: 'South America',flag: '🌐', type: 'cup',    seasonStyle: 'tournament', group: 'International' },

  // Other notable leagues
  { id: 71,  name: 'Brasileirão Série A',       short: 'Brasil A',     country: 'Brazil',       flag: '🇧🇷', type: 'league', seasonStyle: 'mar-nov',    group: 'Americas' },
  { id: 128, name: 'Liga Profesional Argentina',short: 'Argentina',    country: 'Argentina',    flag: '🇦🇷', type: 'league', seasonStyle: 'mar-nov',    group: 'Americas' },
  { id: 253, name: 'Major League Soccer',       short: 'MLS',          country: 'USA',          flag: '🇺🇸', type: 'league', seasonStyle: 'mar-nov',    group: 'Americas' }
];

const DEFAULT_LEAGUE_ID = 288; // PSL

const TTL = {
  leagues:   24 * 60 * 60 * 1000,
  standings:      60 * 60 * 1000,
  fixtures:    6 * 60 * 60 * 1000,
  live:           60 * 1000,
  topscorers: 12 * 60 * 60 * 1000,
  topassists: 12 * 60 * 60 * 1000
};

/* ------------------------------------------------------------------
   Storage
   ------------------------------------------------------------------ */
const LS = {
  KEY:          'pitch.apikey',
  LEAGUE_ID:    'pitch.league.id',
  CACHE_PREFIX: 'pitch.cache.',
  COUNTER:      'pitch.counter'
};
const getKey   = () => localStorage.getItem(LS.KEY);
const setKey   = (k) => localStorage.setItem(LS.KEY, k.trim());
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
   Season inference per league type
   ------------------------------------------------------------------ */
function currentSeasonFor(league) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  if (league.seasonStyle === 'tournament') return y;
  if (league.seasonStyle === 'mar-nov')    return m >= 2 ? y : y - 1;
  return m >= 7 ? y : y - 1; // aug-may default
}

/* ------------------------------------------------------------------
   Quota counter
   ------------------------------------------------------------------ */
function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
}
function getCounter() {
  try {
    const c = JSON.parse(localStorage.getItem(LS.COUNTER) || '{}');
    if (c.day !== todayUTC()) return { day: todayUTC(), count: 0 };
    return c;
  } catch { return { day: todayUTC(), count: 0 }; }
}
function bumpCounter() {
  const c = getCounter();
  c.count += 1;
  localStorage.setItem(LS.COUNTER, JSON.stringify(c));
  renderQuota();
}
function renderQuota() {
  const c = getCounter();
  const limit = 100;
  document.getElementById('quota-used').textContent = c.count;
  document.getElementById('quota-limit').textContent = limit;
  const pct = Math.min(100, (c.count / limit) * 100);
  const fill = document.getElementById('quota-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct >= 80
    ? 'linear-gradient(135deg, #e5484d 0%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #ff5b1f 0%, #c2410c 100%)';
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
  } catch { /* quota exceeded */ }
}

async function apiGet(path, params = {}, ttl = 60_000, { force = false } = {}) {
  const qs = new URLSearchParams(params).toString();
  const cacheKey = `${path}?${qs}`;
  if (!force) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  const url = `${API_BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': getKey() } });
  bumpCounter();
  if (res.status === 401 || res.status === 403)
    throw new Error('Invalid API key. Click ⚙ Key to re-enter it.');
  if (res.status === 429)
    throw new Error('Daily quota exhausted. Try again after 00:00 UTC.');
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    const msg = typeof json.errors === 'object'
      ? Object.values(json.errors).join(' · ')
      : String(json.errors);
    throw new Error('API: ' + msg);
  }
  cacheSet(cacheKey, json, ttl);
  return json;
}

/* ------------------------------------------------------------------
   API methods (scoped to current league)
   ------------------------------------------------------------------ */
async function fetchStandings(force = false) {
  const l = getLeague();
  return apiGet('/standings', { league: l.id, season: currentSeasonFor(l) }, TTL.standings, { force });
}
async function fetchFixtures({ from, to, force = false }) {
  const l = getLeague();
  return apiGet('/fixtures',
    { league: l.id, season: currentSeasonFor(l), from, to }, TTL.fixtures, { force });
}
async function fetchAllSeasonFixtures(force = false) {
  const l = getLeague();
  return apiGet('/fixtures',
    { league: l.id, season: currentSeasonFor(l) }, TTL.fixtures, { force });
}
async function fetchLive(force = false) {
  const l = getLeague();
  return apiGet('/fixtures', { live: String(l.id) }, TTL.live, { force });
}
async function fetchTopScorers(force = false) {
  const l = getLeague();
  return apiGet('/players/topscorers',
    { league: l.id, season: currentSeasonFor(l) }, TTL.topscorers, { force });
}
async function fetchTopAssists(force = false) {
  const l = getLeague();
  return apiGet('/players/topassists',
    { league: l.id, season: currentSeasonFor(l) }, TTL.topassists, { force });
}

/* ------------------------------------------------------------------
   Renderers
   ------------------------------------------------------------------ */
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-ZA',
    { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-ZA',
    { hour: '2-digit', minute: '2-digit' });

function renderHeader() {
  const l = getLeague();
  document.getElementById('current-league-name').textContent = l.name;
  document.getElementById('current-league-meta').textContent =
    `${l.country} · ${currentSeasonFor(l)} season`;
  const hint = document.getElementById('standings-meta');
  if (hint) hint.textContent = `${l.name} · ${currentSeasonFor(l)} season`;
}

function renderStandings(json) {
  const tbody = document.querySelector('#standings-table tbody');
  const data = json.response?.[0]?.league;
  if (!data || !data.standings || !data.standings[0] || !data.standings[0].length) {
    const l = getLeague();
    const msg = l.type === 'cup'
      ? 'This is a cup competition — check Fixtures and Results for the bracket.'
      : 'No standings available yet for this season.';
    tbody.innerHTML = `<tr><td colspan="11" class="empty">${msg}</td></tr>`;
    return;
  }
  const groups = data.standings;
  let html = '';
  groups.forEach((rows, idx) => {
    if (groups.length > 1) {
      const groupName = rows[0]?.group || `Group ${idx + 1}`;
      html += `<tr class="group-row"><td colspan="11">${groupName}</td></tr>`;
    }
    html += rows.map(row => {
      const formPills = (row.form || '').split('').map(c =>
        `<span class="form-pill form-pill--${c}">${c}</span>`).join('');
      const gd = row.goalsDiff;
      const gdCls = gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : '';
      const rankCls = row.rank <= 3 ? 'rank rank--top' : 'rank';
      return `
        <tr>
          <td><span class="${rankCls}">${row.rank}</span></td>
          <td class="t-left">
            <div class="club-cell">
              <img src="${row.team.logo}" alt="" loading="lazy" />
              <span class="club-cell__name">${row.team.name}</span>
            </div>
          </td>
          <td>${row.all.played}</td>
          <td>${row.all.win}</td>
          <td>${row.all.draw}</td>
          <td>${row.all.lose}</td>
          <td>${row.all.goals.for}</td>
          <td>${row.all.goals.against}</td>
          <td class="${gdCls}">${gd > 0 ? '+' + gd : gd}</td>
          <td class="pts">${row.points}</td>
          <td class="t-left"><span class="form-pills">${formPills}</span></td>
        </tr>`;
    }).join('');
  });
  tbody.innerHTML = html;
}

function renderMatchList(containerId, fixtures, mode) {
  const el = document.getElementById(containerId);
  if (!fixtures || !fixtures.length) {
    el.innerHTML = `<div class="empty">No matches in this window.</div>`;
    return;
  }
  el.innerHTML = fixtures.map(f => {
    const home = f.teams.home, away = f.teams.away;
    const gh = f.goals.home, ga = f.goals.away;
    const status = f.fixture.status.short;
    const isFinished = ['FT','AET','PEN'].includes(status);
    const round = f.league?.round || '';
    const centre = mode === 'fixtures'
      ? `<div class="match__score match__score--vs">vs</div>`
      : `<div class="match__score">${gh ?? '-'} : ${ga ?? '-'}</div>`;
    const subline = mode === 'fixtures'
      ? fmtTime(f.fixture.date)
      : (isFinished ? 'Full time' : status);
    const when = `<div class="match__when">
        <strong>${fmtDate(f.fixture.date)}</strong>
        ${subline}
        ${round ? `<span class="match__round">${round}</span>` : ''}
      </div>`;
    return `
      <div class="match">
        ${when}
        <div class="match__team"><img src="${home.logo}" alt="" loading="lazy" /><span>${home.name}</span></div>
        ${centre}
        <div class="match__team match__team--away"><span>${away.name}</span><img src="${away.logo}" alt="" loading="lazy" /></div>
      </div>`;
  }).join('');
}

function renderLive(json) {
  const el = document.getElementById('live-body');
  const fixtures = json.response || [];
  if (!fixtures.length) {
    el.innerHTML = `<div class="empty">No matches in play right now for this competition.</div>`;
    return;
  }
  el.innerHTML = fixtures.map(f => {
    const home = f.teams.home, away = f.teams.away;
    const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0;
    const minute = f.fixture.status.elapsed
      ? `${f.fixture.status.elapsed}'`
      : f.fixture.status.long;
    return `
      <div class="match">
        <div class="match__row">
          <span class="match__live-tag">Live</span>
          <span class="match__minute">${minute}</span>
        </div>
        <div class="match__row">
          <div class="match__team"><img src="${home.logo}" alt="" /><span>${home.name}</span></div>
          <div class="match__score">${gh}</div>
        </div>
        <div class="match__row">
          <div class="match__team"><img src="${away.logo}" alt="" /><span>${away.name}</span></div>
          <div class="match__score">${ga}</div>
        </div>
      </div>`;
  }).join('');
}

function renderPlayerLeaderboard(tableId, json, statKey) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  const rows = json.response || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Not available for this competition / season yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.slice(0, 25).map((row, i) => {
    const p = row.player;
    const stats = row.statistics?.[0];
    if (!stats) return '';
    const stat = statKey === 'goals' ? stats.goals.total : stats.goals.assists;
    const apps = stats.games?.appearences ?? '-';
    const mins = stats.games?.minutes ?? '-';
    const team = stats.team?.name ?? '-';
    const teamLogo = stats.team?.logo ?? '';
    return `
      <tr>
        <td><span class="rank ${i < 3 ? 'rank--top' : ''}">${i + 1}</span></td>
        <td class="t-left"><strong>${p.name}</strong></td>
        <td class="t-left">
          <div class="club-cell">
            ${teamLogo ? `<img src="${teamLogo}" alt="" loading="lazy" />` : ''}
            <span>${team}</span>
          </div>
        </td>
        <td>${apps}</td>
        <td>${mins}</td>
        <td class="pts">${stat ?? 0}</td>
      </tr>`;
  }).join('');
}

/* ------------------------------------------------------------------
   Tab loaders
   ------------------------------------------------------------------ */
async function loadStandings(force = false) {
  try { renderStandings(await fetchStandings(force)); }
  catch (e) { showError(e); }
}
async function loadLive(force = false) {
  try { renderLive(await fetchLive(force)); }
  catch (e) { showError(e); }
}
async function loadFixtures(force = false) {
  try {
    const l = getLeague();
    let fixtures;
    if (l.type === 'cup') {
      const json = await fetchAllSeasonFixtures(force);
      fixtures = (json.response || [])
        .filter(f => !['FT','AET','PEN','CANC','PST','ABD'].includes(f.fixture.status.short))
        .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
        .slice(0, 30);
    } else {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const to   = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
      const json = await fetchFixtures({ from, to, force });
      fixtures = (json.response || [])
        .filter(f => !['FT','AET','PEN'].includes(f.fixture.status.short))
        .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    }
    renderMatchList('fixtures-body', fixtures, 'fixtures');
  } catch (e) { showError(e); }
}
async function loadResults(force = false) {
  try {
    const l = getLeague();
    let fixtures;
    if (l.type === 'cup') {
      const json = await fetchAllSeasonFixtures(force);
      fixtures = (json.response || [])
        .filter(f => ['FT','AET','PEN'].includes(f.fixture.status.short))
        .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
        .slice(0, 30);
    } else {
      const today = new Date();
      const from = new Date(today.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
      const to   = today.toISOString().slice(0, 10);
      const json = await fetchFixtures({ from, to, force });
      fixtures = (json.response || [])
        .filter(f => ['FT','AET','PEN'].includes(f.fixture.status.short))
        .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    }
    renderMatchList('results-body', fixtures, 'results');
  } catch (e) { showError(e); }
}
async function loadScorers(force = false) {
  try { renderPlayerLeaderboard('scorers-table', await fetchTopScorers(force), 'goals'); }
  catch (e) { showError(e); }
}
async function loadAssists(force = false) {
  try { renderPlayerLeaderboard('assists-table', await fetchTopAssists(force), 'assists'); }
  catch (e) { showError(e); }
}

const TAB_LOADERS = {
  live:      loadLive,
  standings: loadStandings,
  fixtures:  loadFixtures,
  results:   loadResults,
  scorers:   loadScorers,
  assists:   loadAssists
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
  if (name === 'live') liveTimer = setInterval(() => loadLive(true), 60_000);
}

/* ------------------------------------------------------------------
   League selector dropdown
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
  // Reset every panel back to "Loading..."
  document.querySelector('#standings-table tbody').innerHTML =
    '<tr><td colspan="11" class="empty">Loading…</td></tr>';
  document.querySelector('#scorers-table tbody').innerHTML =
    '<tr><td colspan="6" class="empty">Loading…</td></tr>';
  document.querySelector('#assists-table tbody').innerHTML =
    '<tr><td colspan="6" class="empty">Loading…</td></tr>';
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
    if (confirm('Clear stored API key? You will need to re-enter it.')) {
      clearKey(); location.reload();
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
function initKeyGate() {
  const gate = document.getElementById('key-gate');
  const form = document.getElementById('key-form');
  const input = document.getElementById('key-input');
  const errEl = document.getElementById('key-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const k = input.value.trim();
    if (k.length < 20) {
      errEl.textContent = 'That key looks too short. Double-check it.';
      return;
    }
    setKey(k);
    try {
      await apiGet('/status', {}, 0, { force: true });
      gate.classList.add('hidden');
      bootAfterKey();
    } catch (e) {
      clearKey();
      errEl.textContent = e.message;
    }
  });

  if (!getKey()) gate.classList.remove('hidden');
  else { gate.classList.add('hidden'); bootAfterKey(); }
}

async function bootAfterKey() {
  buildLeagueMenu();
  refreshLeagueButton();
  renderHeader();
  renderQuota();
  setActiveTab('standings');
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initButtons();
  initKeyGate();
  renderQuota();
});
