/* ==================================================================
   The Pitch — frontend
   ------------------------------------------------------------------
   Calls a Cloudflare Worker (deployed by you) which proxies
   football-data.org for major leagues and scrapes BBC for PSL.
   ================================================================== */

const LEAGUES = [
  { code: 'psl',   name: 'Premier Soccer League',  short: 'PSL',     flag: '🇿🇦', group: 'South Africa' },
  { code: 'epl',   name: 'Premier League',         short: 'EPL',     flag: '🏴', group: 'England' },
  { code: 'cha',   name: 'Championship',           short: 'Champ.',  flag: '🏴', group: 'England' },
  { code: 'laliga',name: 'La Liga',                short: 'La Liga', flag: '🇪🇸', group: 'Europe' },
  { code: 'seriea',name: 'Serie A',                short: 'Serie A', flag: '🇮🇹', group: 'Europe' },
  { code: 'bundes',name: 'Bundesliga',             short: 'Bundes.', flag: '🇩🇪', group: 'Europe' },
  { code: 'ligue1',name: 'Ligue 1',                short: 'Ligue 1', flag: '🇫🇷', group: 'Europe' },
  { code: 'ered',  name: 'Eredivisie',             short: 'Eredivisie', flag: '🇳🇱', group: 'Europe' },
  { code: 'pl_pt', name: 'Primeira Liga',          short: 'Liga POR', flag: '🇵🇹', group: 'Europe' },
  { code: 'ucl',   name: 'UEFA Champions League',  short: 'UCL',     flag: '🏆', group: 'Continental' },
  { code: 'wc',    name: 'FIFA World Cup',         short: 'World Cup', flag: '🌐', group: 'International' },
  { code: 'euro',  name: 'European Championship',  short: 'Euros',   flag: '🌐', group: 'International' },
  { code: 'brasil',name: 'Brasileirão Série A',    short: 'Brasil A', flag: '🇧🇷', group: 'Americas' }
];

const DEFAULT_LEAGUE_CODE = 'psl';

const LS = {
  WORKER_URL: 'pitch.workerUrl',
  LEAGUE:     'pitch.league'
};

const getWorkerUrl = () => localStorage.getItem(LS.WORKER_URL) || '';
const setWorkerUrl = (u) => localStorage.setItem(LS.WORKER_URL, u.trim().replace(/\/$/, ''));
const clearWorkerUrl = () => localStorage.removeItem(LS.WORKER_URL);

const getLeagueCode = () => localStorage.getItem(LS.LEAGUE) || DEFAULT_LEAGUE_CODE;
const setLeagueCode = (c) => localStorage.setItem(LS.LEAGUE, c);
const getLeague = () => LEAGUES.find(l => l.code === getLeagueCode()) || LEAGUES[0];

/* ------------------------------------------------------------------
   API
   ------------------------------------------------------------------ */
async function api(kind, leagueCode) {
  const base = getWorkerUrl();
  if (!base) throw new Error('Worker URL not configured.');
  const r = await fetch(`${base}/${kind}/${leagueCode}`);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Worker returned ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

/* ------------------------------------------------------------------
   Renderers
   ------------------------------------------------------------------ */
const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA',
    { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-ZA',
    { hour: '2-digit', minute: '2-digit' });
};

function renderHeader() {
  const l = getLeague();
  document.getElementById('current-league-name').textContent = l.name;
  document.getElementById('current-league-meta').textContent = l.group;
  const hint = document.getElementById('standings-meta');
  if (hint) hint.textContent = `${l.name} · ${l.group}`;
}

function renderStandings(json) {
  const tbody = document.querySelector('#standings-table tbody');
  const rows = Array.isArray(json?.table) ? json.table : [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">No standings available for this competition.<br>Cup competitions and tournaments don't always have a league table — check Fixtures and Results.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((row, i) => {
    const rank = row.rank || (i + 1);
    const gd = row.goalDifference ?? 0;
    const gdCls = gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : '';
    const rankCls = rank <= 3 ? 'rank rank--top' : 'rank';
    const formPills = (row.form || '').split(/[,\s]+/).filter(Boolean).slice(-5).map(c => {
      const ch = (c[0] || '').toUpperCase();
      return ['W','D','L'].includes(ch)
        ? `<span class="form-pill form-pill--${ch}">${ch}</span>` : '';
    }).join('');
    return `
      <tr>
        <td><span class="${rankCls}">${rank}</span></td>
        <td class="t-left">
          <div class="club-cell">
            ${row.badge ? `<img src="${row.badge}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
            <span class="club-cell__name">${row.team || '—'}</span>
          </div>
        </td>
        <td>${row.played ?? '-'}</td>
        <td>${row.won ?? '-'}</td>
        <td>${row.drawn ?? '-'}</td>
        <td>${row.lost ?? '-'}</td>
        <td>${row.goalsFor ?? '-'}</td>
        <td>${row.goalsAgainst ?? '-'}</td>
        <td class="${gdCls}">${gd > 0 ? '+' + gd : gd}</td>
        <td class="pts">${row.points ?? '-'}</td>
        <td class="t-left"><span class="form-pills">${formPills}</span></td>
      </tr>`;
  }).join('');
}

function renderMatches(containerId, matches, mode) {
  const el = document.getElementById(containerId);
  const items = Array.isArray(matches) ? matches : [];
  if (!items.length) {
    el.innerHTML = `<div class="empty">No matches in this window.</div>`;
    return;
  }
  el.innerHTML = items.map(m => {
    const home = m.home || {};
    const away = m.away || {};
    const isFinished = ['FT','AET','PEN','FINISHED'].includes(m.status);
    const centre = mode === 'fixtures'
      ? `<div class="match__score match__score--vs">vs</div>`
      : `<div class="match__score">${home.score ?? '-'} : ${away.score ?? '-'}</div>`;
    const subline = mode === 'fixtures'
      ? (m.kickoffHasTime !== false ? fmtTime(m.kickoff) : 'Time TBC')
      : (isFinished ? 'Full time' : (m.status || ''));
    const round = m.round || '';
    const when = `<div class="match__when">
        <strong>${fmtDate(m.kickoff)}</strong>
        ${subline}
        ${round ? `<span class="match__round">${round}</span>` : ''}
      </div>`;
    const homeImg = home.badge ? `<img src="${home.badge}" alt="" loading="lazy" onerror="this.style.display='none'" />` : '';
    const awayImg = away.badge ? `<img src="${away.badge}" alt="" loading="lazy" onerror="this.style.display='none'" />` : '';
    return `
      <div class="match">
        ${when}
        <div class="match__team">${homeImg}<span>${home.name || '—'}</span></div>
        ${centre}
        <div class="match__team match__team--away"><span>${away.name || '—'}</span>${awayImg}</div>
      </div>`;
  }).join('');
}

/* ------------------------------------------------------------------
   Tab loaders
   ------------------------------------------------------------------ */
async function loadStandings() {
  try { renderStandings(await api('standings', getLeagueCode())); }
  catch (e) { showError(e); }
}
async function loadFixtures() {
  try {
    const json = await api('fixtures', getLeagueCode());
    renderMatches('fixtures-body', json.matches, 'fixtures');
  } catch (e) { showError(e); }
}
async function loadResults() {
  try {
    const json = await api('results', getLeagueCode());
    renderMatches('results-body', json.matches, 'results');
  } catch (e) { showError(e); }
}

const TAB_LOADERS = { standings: loadStandings, fixtures: loadFixtures, results: loadResults };

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
  document.getElementById('last-updated').textContent =
    'Last updated: ' + new Date().toLocaleTimeString();
}

/* League selector */
function buildLeagueMenu() {
  const menu = document.getElementById('league-menu');
  const groups = {};
  for (const l of LEAGUES) (groups[l.group] = groups[l.group] || []).push(l);
  menu.innerHTML = Object.entries(groups).map(([groupName, items]) => `
    <div class="lm-group">
      <div class="lm-group__title">${groupName}</div>
      ${items.map(l => `
        <button class="lm-item" data-code="${l.code}">
          <span class="lm-item__flag">${l.flag}</span>
          <span class="lm-item__name">${l.name}</span>
          <span class="lm-item__short">${l.short}</span>
        </button>
      `).join('')}
    </div>
  `).join('');
  menu.querySelectorAll('.lm-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchLeague(btn.dataset.code);
      closeLeagueMenu();
    });
  });
}
const closeLeagueMenu  = () => document.getElementById('league-picker').classList.remove('is-open');
const toggleLeagueMenu = () => document.getElementById('league-picker').classList.toggle('is-open');

function refreshLeagueButton() {
  const l = getLeague();
  document.getElementById('league-picker-flag').textContent = l.flag;
  document.getElementById('league-picker-name').textContent = l.short;
  document.querySelectorAll('.lm-item').forEach(btn => {
    btn.classList.toggle('is-current', btn.dataset.code === l.code);
  });
}
function switchLeague(code) {
  setLeagueCode(code);
  refreshLeagueButton();
  renderHeader();
  document.querySelector('#standings-table tbody').innerHTML =
    '<tr><td colspan="11" class="empty">Loading…</td></tr>';
  document.getElementById('fixtures-body').innerHTML = '<div class="empty">Loading…</div>';
  document.getElementById('results-body').innerHTML  = '<div class="empty">Loading…</div>';
  TAB_LOADERS[activeTab]?.();
}

/* Init */
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn =>
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));
}
function initButtons() {
  document.getElementById('refresh-btn').addEventListener('click', () => {
    TAB_LOADERS[activeTab]?.();
    showToast('Refreshing ' + activeTab + '…');
  });
  document.getElementById('reset-key-btn').addEventListener('click', () => {
    if (confirm('Change Worker URL? You\'ll need to enter it again.')) {
      clearWorkerUrl();
      location.reload();
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
function initWorkerGate() {
  const gate = document.getElementById('key-gate');
  const form = document.getElementById('key-form');
  const input = document.getElementById('key-input');
  const errEl = document.getElementById('key-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const url = input.value.trim().replace(/\/$/, '');
    if (!/^https:\/\/[^\s]+$/.test(url)) {
      errEl.textContent = 'Please enter a valid HTTPS URL.';
      return;
    }
    setWorkerUrl(url);
    // Validate by hitting /health
    try {
      const r = await fetch(`${url}/health`);
      if (!r.ok) throw new Error(`Worker returned ${r.status}`);
      const data = await r.json();
      if (!data.ok) throw new Error('Worker did not return ok=true');
      gate.classList.add('hidden');
      bootAfterGate();
    } catch (e) {
      clearWorkerUrl();
      errEl.textContent = `Couldn't reach the Worker: ${e.message}`;
    }
  });

  if (!getWorkerUrl()) gate.classList.remove('hidden');
  else { gate.classList.add('hidden'); bootAfterGate(); }
}

function bootAfterGate() {
  buildLeagueMenu();
  refreshLeagueButton();
  renderHeader();
  setActiveTab('standings');
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initButtons();
  initWorkerGate();
});
