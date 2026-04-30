const API_HOSTS = [
  'https://api.cloudmoon.cloudbatata.com',
  'https://api.prod.cloudmoonapp.com',
  'https://api.prod.geometry.today',
  'https://hrz5zfjq02.execute-api.us-east-1.amazonaws.com',
  'https://api.prod.viewoncloud.com'
];

const GAMES = [
  "com.roblox.client",
  "com.zhiliaoapp.musically",
  "com.android.chrome"
];

const GAME_LIST = [...new Set(GAMES)];

const RANDOM_MESSAGES = [
  "You are on Soluna Public. This version is buggy and will not be maintained."
];

function getUser() {
  try { return JSON.parse(localStorage.getItem('userData') || '{}'); } catch { return {}; }
}

function getRandomMessage() {
  return RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
}

function setRandomMessage() {
  const el = document.getElementById('random-message');
  if (el) el.textContent = getRandomMessage();
}

window.signOut = function () {
  localStorage.removeItem('userData');
  location.replace('https://cdn.jsdelivr.net/gh/deustch2acc/cloudmoon-custom@master/login-loader.svg');
};

window.goHome = function () {
  document.getElementById('home').style.display = '';
  document.getElementById('header').style.display = '';
  document.getElementById('launch').style.display = 'none';
  history.replaceState(null, '', './');
};

window.filterGrid = function (q) {
  const term = q.trim().toLowerCase();
  document.querySelectorAll('.card').forEach(c => {
    const label = c.querySelector('.card-label')?.textContent.toLowerCase() || '';
    c.style.display = (!term || label.includes(term)) ? '' : 'none';
  });
};

// ── Status data per package ──────────────────────────────────
// status: 'working' | 'unstable' | 'broken'
// label:  display text
function getStatusInfo(pkg) {
  const lower = pkg.toLowerCase();
  if (lower.includes('roblox'))  return { status: 'unstable',  label: 'Unstable' };
  if (lower.includes('tiktok') || lower.includes('musically')) return { status: 'unstable', label: 'Unstable' };
  if (lower.includes('chrome'))  return { status: 'unstable',  label: 'Unstable' };
  return { status: 'working', label: 'Working' };
}

// ── Description per package ──────────────────────────────────
function getDescription(title) {
  const lower = title.toLowerCase();
  if (lower.includes('roblox')) return 'Roblox Corporation';
  if (lower.includes('tiktok')) return 'TikTok Pte. Ltd.';
  if (lower.includes('chrome')) return 'Google LLC';
  return `Launch ${title}.`;
}

// ── Tilt effect ──────────────────────────────────────────────
function attachTilt(card) {
  card.addEventListener('mousemove', (e) => {
    // Only lift — no rotational tilt, keeping transform clean for CSS
    card.classList.add('hovering');
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.classList.remove('hovering');
  });
}

// ── Build grid ───────────────────────────────────────────────
async function buildGrid() {
  const grid = document.getElementById('grid');

  for (let i = 0; i < GAME_LIST.length; i++) {
    const pkg = GAME_LIST[i];
    let title = pkg;
    let icon = '';

    try {
      const r = await fetch(`./data/games/en/${pkg}.json`);
      if (r.ok) {
        const d = await r.json();
        title = d.title || pkg;
        icon = d.icon || '';
      }
    } catch {}

    const card = document.createElement('div');
    card.className = 'card';

    const desc = getDescription(title);
    const { status, label } = getStatusInfo(pkg);

    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${icon}" alt="${title}" loading="lazy"/>
        <div class="card-time-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Recently added
        </div>
        <div class="card-status ${status}">
          <span class="card-status-dot"></span>
          ${label}
        </div>
      </div>
      <div class="card-content">
        <div class="card-label">${title}</div>
        <div class="card-subtext">${desc}</div>
        <button class="launch-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Launch</span>
        </button>
      </div>
    `;

    const btn = card.querySelector('.launch-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame(pkg, icon, title);
    });

    attachTilt(card);
    grid.appendChild(card);

    await new Promise(res => setTimeout(res, 30));
  }
}

// ── Progress helpers ─────────────────────────────────────────
function setProgress(pct) {
  const bar = document.getElementById('launch-bar');
  if (bar) bar.style.width = pct + '%';
}

function setStatus(msg, pct) {
  document.getElementById('launch-status').textContent = msg;
  if (pct !== undefined) setProgress(pct);
}

function showError(msg) {
  document.getElementById('spinner').style.display = 'none';
  document.getElementById('launch-status').textContent = msg;
}

// ── API helpers ──────────────────────────────────────────────
async function ping(host) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    return (await fetch(host + '/_ping', { signal: ctrl.signal })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function getApiHost() {
  return new Promise(resolve => {
    let done = false;
    let count = 0;
    API_HOSTS.forEach(h => {
      ping(h).then(ok => {
        if (!done && ok) { done = true; resolve(h); }
        else if (++count === API_HOSTS.length && !done) { resolve(null); }
      });
    });
  });
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : r & 3 | 8).toString(16);
  });
}

function apiFetch(host, path, opts = {}) {
  const ud = getUser();
  const did = localStorage.getItem('device_id') || uuid();
  localStorage.setItem('device_id', did);

  const url = new URL(host + path);
  url.searchParams.set('device_type', 'web');
  url.searchParams.set('query_uuid', uuid());
  url.searchParams.set('site', 'cm');
  url.searchParams.set('device_id', did);

  const h = new Headers(opts.headers || {});
  h.set('X-User-Locale', (navigator.language || 'en').split('-')[0]);
  h.set('X-User-Language', 'en');
  if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
  if (ud.token) h.set('X-User-Token', ud.token);

  return fetch(url.toString(), { ...opts, headers: h });
}

// ── Start game ───────────────────────────────────────────────
async function startGame(pkg, icon, title) {
  const ud = getUser();

  if (!ud.token) {
    location.replace('https://cdn.jsdelivr.net/gh/deustch2acc/cloudmoon-custom@master/login-loader.svg?game=' + encodeURIComponent(pkg));
    return;
  }

  document.getElementById('home').style.display = 'none';
  document.getElementById('header').style.display = 'none';
  document.getElementById('launch').style.display = 'flex';
  document.getElementById('launch-icon').src = icon;
  document.getElementById('launch-status').textContent = 'Connecting...';
  document.getElementById('spinner').style.display = '';
  setProgress(0);

  history.replaceState(null, '', `./?game=${encodeURIComponent(pkg)}`);

  setStatus('Finding server...', 5);
  const host = await getApiHost();
  if (!host) { showError('Could not reach any server.'); return; }

  const savedServer = localStorage.getItem('selectedServer') || '23';
  const serverId = parseInt(savedServer, 10) || 23;

  setStatus('Loading account...', 35);
  let androidId = null;
  try {
    const pr = await (await apiFetch(host, '/phone/list')).json();
    if (pr.code === 0 && pr.data?.list?.length > 0) {
      androidId = pr.data.list[0].android_id;
    }
  } catch {}

  setStatus(`Starting ${title}...`, 50);
  try {
    const cr = await (await apiFetch(host, '/phone/connect', {
      method: 'POST',
      body: JSON.stringify({
        android_id: androidId,
        game_name: pkg,
        screen_res: '720x1280',
        server_id: serverId,
        params: JSON.stringify({ language: 'en' }),
        ad_unblock: false
      })
    })).json();

    if (cr.code === 0 && cr.data?.sid) {
      setStatus('Launching...', 60);
      const quality = localStorage.getItem('quality') || 'SD';
      setTimeout(() => {
        window.location.href = `./run-site/run.html?sid=${cr.data.sid}&quality=${quality}`;
      }, 300);
    } else {
      showError(`${cr.message || 'Could not start game'} (${cr.code})`);
    }
  } catch (e) {
    showError(`Connection failed: ${e.message}`);
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const serverSelect = document.getElementById('serverSelect');
  const savedServer = localStorage.getItem('selectedServer') || '23';

  if (serverSelect) {
    serverSelect.value = savedServer;
    serverSelect.addEventListener('change', function () {
      localStorage.setItem('selectedServer', this.value);
    });
  }

  if (!localStorage.getItem('selectedServer')) {
    localStorage.setItem('selectedServer', '23');
  }

  setRandomMessage();

  if (!getUser().token) {
    const game = new URLSearchParams(location.search).get('game');
    location.replace('https://cdn.jsdelivr.net/gh/deustch2acc/cloudmoon-custom@master/login-loader.svg' + (game ? `?game=${encodeURIComponent(game)}` : ''));
    return;
  }

  const params = new URLSearchParams(location.search);
  const gameParam = params.get('game');

  if (gameParam) {
    (async () => {
      let icon = '';
      let title = gameParam;
      try {
        const r = await fetch(`./data/games/en/${gameParam}.json`);
        if (r.ok) {
          const d = await r.json();
          icon = d.icon || '';
          title = d.title || gameParam;
        }
      } catch {}
      startGame(gameParam, icon, title);
    })();
  } else {
    buildGrid();
  }
});
