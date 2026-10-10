/* ==========================================================================
   xo-earn.js  -  Ultimate XO: more ways to earn coins + developer/admin account
   + in-game ADMIN DASHBOARD (player stats).
   Load it right AFTER xo-shop.js on every page (as before). Nothing else to add.
   ========================================================================== */
(function () {
  'use strict';
  // Touch feel (all pages, even menus without the shop)
  try {
    var ts = document.createElement('style');
    ts.textContent = '*{-webkit-tap-highlight-color:transparent}body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
      'input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}button,a,[onclick],input,select{touch-action:manipulation}';
    (document.head || document.documentElement).appendChild(ts);
  } catch (e) {}
  if (window.XOEarn || !window.XOShop) return;
  var Shop = window.XOShop;

  /* ------------------------------------------------------------------ *
   *  SETTINGS - change numbers here
   * ------------------------------------------------------------------ */
  var AI_WIN   = { 'beginner': 15, 'professional': 25, 'top-player': 40, 'legend': 70, 'omar-mode': 150 };
  var LEAGUE_WIN = 30, ONLINE_WIN = 30;
  var DRAW = 5, LOSS = 2;
  var PLAYED = 5, PLAYED_CAP = 8;
  var STREAK_EVERY = 3, STREAK_BONUS = 25;
  var PROMOTION = 150;
  var LOGIN = [25, 35, 50, 70, 90, 120, 200];
  var QUESTS = [
    { id: 'p3',  t: 'Play 3 matches',          r: 30,  f: function (q) { return q.p; },          n: 3 },
    { id: 'w2',  t: 'Win 2 matches',           r: 50,  f: function (q) { return q.w; },          n: 2 },
    { id: 'w5',  t: 'Win 5 matches',           r: 100, f: function (q) { return q.w; },          n: 5 },
    { id: 'm3',  t: 'Play 3 different modes',  r: 40,  f: function (q) { return q.m.length; },   n: 3 }
  ];
  var MILESTONES = [[10, 100], [25, 200], [50, 400], [100, 800], [250, 2000]];

  var PRICES = {
    mint: 450, crimson: 450, snow: 450, gold: 499, violet: 499, ocean: 499,
    xocyan: 599, flies: 599, snowfall: 599, rain: 650, ember: 650, xofire: 699, toxic: 699, rose: 750, moon: 799, day: 850,
    aurora: 999, lava: 1099, synthp: 1199, synthc: 1299, reef: 1399, portalv: 1499, portalg: 1599,
    jelly: 1799, galaxy: 1999, portalr: 2199, chroma: 2499,
    prism: 2999
  };

  // Developer accounts: unlimited coins + DEV tools button.
  var DEV_USERNAMES = ['omar_dev', 'omar_admin'];
  var DEV_UIDS = [];
  var DEV_COINS = 1000000000;

  // Admin account: sees the stats dashboard button (must match the Firebase rules).
  var ADMIN_USERNAMES = ['omar_admin'];
  var ADMIN_EMAIL = 'omar_admin@xo.game';

  Shop.catalog.forEach(function (c) { if (PRICES[c.id]) c.price = PRICES[c.id]; });
  Shop.catalog.sort(function (a, b) { return a.price - b.price; });

  /* ------------------------------------------------------------------ *
   *  helpers + storage (xo_stats.earn)
   * ------------------------------------------------------------------ */
  var LS = window.localStorage, SHOP_MODE = !!document.querySelector('script[data-mode="shop"]');
  function readStats() { try { var o = JSON.parse(LS.getItem('xo_stats') || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch (e) { return {}; } }
  function writeStats(st) {
    try { LS.setItem('xo_stats', JSON.stringify(st)); } catch (e) {}
    try { var h = LS.getItem('xo_hint'); if (h && h !== 'guest') LS.setItem('xo_dirty', '1'); } catch (e) {}
  }
  function dayKey(off) { var d = new Date(Date.now() + (off || 0) * 864e5); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function load() {
    var e = readStats().earn || {};
    e.l = e.l || { d: '', s: 0 }; e.ws = e.ws | 0; e.ml = Array.isArray(e.ml) ? e.ml : [];
    var q = e.q || {};
    if (q.d !== dayKey()) q = { d: dayKey(), p: 0, w: 0, m: [], done: {}, pc: 0 };
    q.m = q.m || []; q.done = q.done || {}; e.q = q; return e;
  }
  function save(e) { var st = readStats(); st.earn = e; writeStats(st); }
  function fmt(n) { try { return Number(n).toLocaleString('en-US'); } catch (x) { return String(n); } }

  var delay = 0, delayT = 0;
  function give(n, text) {
    Shop.addCoins(n);
    Shop.toast({ coin: true, amt: '+' + n, text: text, delay: delay });
    delay += 700; clearTimeout(delayT); delayT = setTimeout(function () { delay = 0; }, 800);
  }

  /* ------------------------------------------------------------------ *
   *  developer / admin
   * ------------------------------------------------------------------ */
  function profU() { try { return String(JSON.parse(LS.getItem('xo_profile') || '{}').u || '').toLowerCase(); } catch (e) { return ''; } }
  function isDev() {
    try {
      var u = profU();
      if (authAdmin || (u && DEV_USERNAMES.indexOf(u) > -1)) return true;
      var pl = JSON.parse(LS.getItem('xo_player') || '{}');
      return !!(pl.id && DEV_UIDS.indexOf(pl.id) > -1);
    } catch (e) { return false; }
  }
  var authAdmin = false;   // true once Firebase confirms the signed-in account is the admin
  function isAdmin() { var u = profU(); return authAdmin || (!!u && ADMIN_USERNAMES.indexOf(u) > -1); }
  function checkAuth() {
    var A = window.XOAuth; if (!A || typeof A.ready !== 'function') return;
    try {
      A.ready(function () {
        var u = A.user(); authAdmin = !!(u && u.email === ADMIN_EMAIL);
        syncDevBtn();
        if (authAdmin && location.hash === '#admin') openStats();
      });
    } catch (e) {}
  }
  function topUp() { if (isDev() && Shop.coins() < DEV_COINS / 2) Shop.addCoins(DEV_COINS - Shop.coins()); }
  function setOwned(all) {
    var st = readStats(), s = st.shop || { c: 0, o: [], e: null };
    s.o = all ? Shop.catalog.map(function (c) { return c.id; }) : []; if (!all) s.e = null;
    st.shop = s; writeStats(st); Shop.refresh();
  }

  /* ------------------------------------------------------------------ *
   *  rewards
   * ------------------------------------------------------------------ */
  var pendingWin = 20;
  try {
    Object.defineProperty(Shop.rewards, 'win', { get: function () { return pendingWin; }, set: function (v) { pendingWin = v; }, configurable: true, enumerable: true });
  } catch (e) {}
  Shop.rewards.promotion = PROMOTION;

  function earnsMode(m) { m = String(m || ''); return m === 'ai' || m === 'league' || m.indexOf('online-') === 0; }
  function winFor(m) {
    if (m === 'ai') { var d = new URLSearchParams(location.search).get('diff') || 'beginner'; return AI_WIN[d] || AI_WIN.beginner; }
    return m === 'league' ? LEAGUE_WIN : ONLINE_WIN;
  }

  function after(mode, result) {
    var e = load(), q = e.q, earn = earnsMode(mode);
    if (result === 'draw' && earn) give(DRAW, 'Draw');
    else if (result === 'loss' && earn) give(LOSS, 'Good game');
    else if (result === 'played' && q.pc < PLAYED_CAP) { q.pc++; give(PLAYED, 'Match played'); }
    if (result === 'win') {
      e.ws++;
      if (e.ws % STREAK_EVERY === 0) give(STREAK_BONUS, e.ws + ' wins in a row');
    } else if (result === 'loss') e.ws = 0;
    q.p++; if (result === 'win') q.w++;
    if (q.m.indexOf(mode) < 0) q.m.push(mode);
    QUESTS.forEach(function (Q) {
      if (!q.done[Q.id] && Q.f(q) >= Q.n) { q.done[Q.id] = 1; give(Q.r, 'Quest: ' + Q.t); }
    });
    if (result === 'win') {
      var w = readStats().w || 0;
      MILESTONES.forEach(function (M) { if (w >= M[0] && e.ml.indexOf(M[0]) < 0) { e.ml.push(M[0]); give(M[1], M[0] + ' total wins!'); } });
    }
    save(e);
  }

  function hook() {
    var A = window.XOAuth;
    if (!A || A.__xoEarnHooked || typeof A.recordGame !== 'function') return;
    var prev = A.recordGame;
    A.recordGame = function (mode, result) {
      pendingWin = winFor(mode);
      var r = prev.apply(this, arguments);
      try { after(mode, result); } catch (x) {}
      return r;
    };
    A.__xoEarnHooked = true;
  }

  /* ------------------------------------------------------------------ *
   *  UI (menu page only): Daily button, Daily window, Dev panel
   * ------------------------------------------------------------------ */
  function mk(tag, cls, html) { var el = document.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; }
  var cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true;
    var s = mk('style');
    s.textContent =
      '.xe-btn{position:fixed;top:20px;z-index:950;width:42px;height:42px;padding:0;display:grid;place-items:center;border-radius:50%;border:2px solid var(--c);background:rgba(255,255,255,.04);color:var(--c);font:900 11px/1 "Segoe UI",sans-serif;letter-spacing:.5px;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:.3s;box-shadow:0 0 16px rgba(255,255,255,.08)}' +
      '.xe-btn.big{font-size:19px}' +
      '.xe-btn:hover,.xe-btn:focus-visible{background:var(--c);color:#000;box-shadow:0 0 26px var(--c);transform:scale(1.08);outline:none}' +
      '.xe-btn.dot::after{content:"";position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#ff0055;box-shadow:0 0 10px #ff0055;animation:xePulse 1.4s infinite}' +
      '@keyframes xePulse{50%{transform:scale(1.35)}}' +
      '.xe-modal{position:fixed;inset:0;z-index:99991;display:none;overflow-y:auto;background:rgba(2,2,8,.92);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:"Segoe UI",system-ui,sans-serif;color:#fff}' +
      '.xe-modal.open{display:block}' +
      '.xe-sheet{max-width:520px;margin:0 auto;padding:22px 16px 40px}' +
      '.xe-sheet.wide{max-width:940px}' +
      '.xe-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}' +
      '.xe-top h2{margin:0;font-size:20px;font-weight:900;letter-spacing:2px;text-transform:uppercase;text-shadow:0 0 14px var(--c)}' +
      '.xe-x{width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-size:17px;cursor:pointer}' +
      '.xe-h{margin:20px 0 8px;font-size:11px;font-weight:800;letter-spacing:2px;opacity:.55;text-transform:uppercase}' +
      '.xe-days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.xe-day{padding:8px 2px;border-radius:12px;border:1px solid rgba(255,255,255,.12);text-align:center;font-size:11px;font-weight:800;opacity:.7}' +
      '.xe-day b{display:block;font-size:14px;color:#ffcc00;margin-top:3px}' +
      '.xe-day.past{opacity:.35}.xe-day.now{opacity:1;border-color:#ffcc00;box-shadow:0 0 14px rgba(255,204,0,.4)}' +
      '.xe-claim{width:100%;margin-top:12px;padding:13px;border-radius:50px;border:2px solid #ffcc00;background:#ffcc00;color:#000;font:900 14px/1 "Segoe UI",sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;box-shadow:0 0 22px rgba(255,204,0,.5)}' +
      '.xe-claim:disabled{background:transparent;color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.2);box-shadow:none;cursor:default}' +
      '.xe-q{padding:11px 12px;margin-bottom:8px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)}' +
      '.xe-q.ok{border-color:#00ff66}' +
      '.xe-qr{display:flex;justify-content:space-between;gap:8px;font-size:14px;font-weight:700}' +
      '.xe-qr span{color:#ffcc00;white-space:nowrap}.xe-q.ok .xe-qr span{color:#00ff66}' +
      '.xe-bar{height:5px;margin-top:8px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}' +
      '.xe-bar i{display:block;height:100%;background:linear-gradient(90deg,#00f3ff,#00ff66)}' +
      '.xe-info{font-size:12px;line-height:1.7;opacity:.6;margin-top:16px}' +
      '.xe-dv{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.xe-dv button{padding:12px 6px;border-radius:12px;border:1px solid #ff0055;background:rgba(255,0,85,.08);color:#fff;font:800 12px/1.2 "Segoe UI",sans-serif;cursor:pointer}' +
      '.xe-dv button:hover{background:#ff0055}' +
      /* admin stats */
      '.xa-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px}' +
      '.xa-kc{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);border-left:3px solid var(--a,#00f3ff)}' +
      '.xa-kc span{display:block;font-size:10px;letter-spacing:1.5px;opacity:.55;text-transform:uppercase}' +
      '.xa-kc b{display:block;font-size:24px;margin-top:4px}' +
      '.xa-kc i{font-style:normal;font-size:11px;opacity:.55}' +
      '.xa-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}' +
      '.xa-p{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)}' +
      '.xa-p .xe-h{margin:0 0 10px}' +
      '.xa-cols{display:flex;align-items:flex-end;gap:2px;height:96px}' +
      '.xa-cols i{flex:1;border-radius:2px 2px 0 0;min-height:2px}' +
      '.xa-ax{display:flex;justify-content:space-between;font-size:10px;opacity:.5;margin-top:4px}' +
      '.xa-r{display:grid;grid-template-columns:110px 1fr 38px;gap:8px;align-items:center;font-size:12px;margin:5px 0}' +
      '.xa-r em{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.xa-r s{display:block;height:8px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;text-decoration:none}' +
      '.xa-r s u{display:block;height:100%;text-decoration:none}' +
      '.xa-r b{text-align:right}' +
      '.xa-t{width:100%;border-collapse:collapse;font-size:12px}' +
      '.xa-t th{text-align:left;font-size:10px;letter-spacing:1px;opacity:.5;padding:6px 4px;text-transform:uppercase}' +
      '.xa-t td{padding:7px 4px;border-top:1px solid rgba(255,255,255,.08)}' +
      '.xa-w{overflow-x:auto}' +
      '.xa-msg{padding:30px 10px;text-align:center;opacity:.8;line-height:1.7}' +
      '.xa-rf{padding:8px 14px;border-radius:50px;border:2px solid #00f3ff;background:transparent;color:#00f3ff;font:800 11px/1 "Segoe UI",sans-serif;cursor:pointer}';
    document.head.appendChild(s);
  }

  var dailyEl, devEl, dailyBtn;
  function nextStreak(e) { return e.l.d === dayKey(-1) ? e.l.s + 1 : (e.l.d === dayKey() ? e.l.s : 1); }
  function canClaim(e) { return e.l.d !== dayKey(); }

  function renderDaily() {
    var e = load(), st = nextStreak(e), idx = (st - 1) % 7, claim = canClaim(e), h = '';
    h += '<div class="xe-top"><h2>Daily rewards</h2><button class="xe-x" type="button" aria-label="Close">&#10005;</button></div>';
    h += '<div class="xe-h">Login streak: day ' + st + '</div><div class="xe-days">';
    LOGIN.forEach(function (c, i) { h += '<div class="xe-day ' + (i < idx || (i === idx && !claim) ? 'past' : '') + (i === idx ? ' now' : '') + '">D' + (i + 1) + '<b>' + c + '</b></div>'; });
    h += '</div><button class="xe-claim" type="button" ' + (claim ? '' : 'disabled') + '>' + (claim ? 'Claim +' + LOGIN[idx] + ' coins' : 'Come back tomorrow') + '</button>';
    h += '<div class="xe-h">Today\'s quests</div>';
    QUESTS.forEach(function (Q) {
      var v = Math.min(Q.n, Q.f(e.q)), ok = !!e.q.done[Q.id];
      h += '<div class="xe-q ' + (ok ? 'ok' : '') + '"><div class="xe-qr"><div>' + Q.t + '</div><span>' + (ok ? 'DONE' : '+' + Q.r) + '</span></div><div class="xe-bar"><i style="width:' + (v / Q.n * 100) + '%"></i></div></div>';
    });
    dailyEl.firstChild.innerHTML = h;
    if (dailyBtn) dailyBtn.classList.toggle('dot', claim);
  }
  function openDaily() {
    css();
    if (!dailyEl) {
      dailyEl = mk('div', 'xe-modal', '<div class="xe-sheet"></div>'); dailyEl.style.setProperty('--c', '#00ff66');
      dailyEl.addEventListener('click', function (ev) {
        if (ev.target === dailyEl || ev.target.closest('.xe-x')) { dailyEl.classList.remove('open'); return; }
        var b = ev.target.closest('.xe-claim');
        if (b && !b.disabled) {
          var e = load(); if (!canClaim(e)) return;
          var s = nextStreak(e); e.l = { d: dayKey(), s: s }; save(e);
          give(LOGIN[(s - 1) % 7], 'Day ' + s + ' login'); renderDaily();
        }
      });
      document.body.appendChild(dailyEl);
    }
    renderDaily(); dailyEl.classList.add('open');
  }

  function openDev() {
    css();
    if (!devEl) {
      devEl = mk('div', 'xe-modal', '<div class="xe-sheet"></div>'); devEl.style.setProperty('--c', '#ff0055');
      devEl.firstChild.innerHTML =
        '<div class="xe-top"><h2>Developer</h2><button class="xe-x" type="button" aria-label="Close">&#10005;</button></div>' +
        '<div class="xe-dv">' +
        '<button data-a="coins">+100,000 coins</button><button data-a="all">Unlock all projectors</button>' +
        '<button data-a="none">Lock all projectors</button><button data-a="zero">Set coins to 0</button>' +
        '<button data-a="win">Test win toast</button><button data-a="promo">Test promotion toast</button>' +
        '<button data-a="day">Reset daily + quests</button><button data-a="ms">Reset milestones + streak</button></div>' +
        '<div class="xe-info">Developer account: coins are topped up to ' + fmt(DEV_COINS) + ' automatically, so every purchase is free. ' +
        'Everything you do here is saved to your account like normal progress.</div>';
      devEl.addEventListener('click', function (ev) {
        if (ev.target === devEl || ev.target.closest('.xe-x')) { devEl.classList.remove('open'); return; }
        var b = ev.target.closest('button[data-a]'); if (!b) return;
        var a = b.getAttribute('data-a'), e;
        if (a === 'coins') Shop.addCoins(100000);
        else if (a === 'all') setOwned(true);
        else if (a === 'none') setOwned(false);
        else if (a === 'zero') Shop.addCoins(-Shop.coins());
        else if (a === 'win') Shop.win();
        else if (a === 'promo') Shop.promotion();
        else if (a === 'day') { e = load(); e.q = { d: dayKey(), p: 0, w: 0, m: [], done: {}, pc: 0 }; e.l = { d: '', s: 0 }; save(e); if (dailyBtn) dailyBtn.classList.add('dot'); }
        else if (a === 'ms') { e = load(); e.ml = []; e.ws = 0; save(e); }
        Shop.toast({ text: b.textContent });
      });
      document.body.appendChild(devEl);
    }
    devEl.classList.add('open');
  }

  /* ------------------------------------------------------------------ *
   *  ADMIN: activity tracking + in-game stats dashboard
   * ------------------------------------------------------------------ */
  function getDb() {
    try { var a = firebase.apps.filter(function (x) { return x.name === 'xoAuth'; })[0]; return a ? a.database() : null; } catch (e) { return null; }
  }
  // every signed-in player: last seen, login count, daily activity (once per browser session)
  function track() {
    var A = window.XOAuth; if (!A || typeof A.ready !== 'function') return;
    try {
      A.ready(function () {
        try {
          var u = A.user(), db = getDb();
          if (!u || !db || sessionStorage.getItem('xo_trk')) return;
          sessionStorage.setItem('xo_trk', '1');
          var day = new Date().toISOString().slice(0, 10), pr = 'users/' + u.uid + '/profile';
          db.ref(pr + '/last').set(Date.now()).catch(function () {});
          db.ref(pr + '/logins').transaction(function (n) { return (n || 0) + 1; });
          db.ref('activity/' + day + '/' + u.uid).set(1).catch(function () {});
        } catch (e) {}
      });
    } catch (e) {}
  }

  var DIVN = { 10: 'Iron', 9: 'Bronze', 8: 'Silver', 7: 'Gold', 6: 'Platinum', 5: 'Emerald', 4: 'Diamond', 3: 'Elite', 2: 'Master', 1: 'Legend' };
  var DIVC = { 10: '#888', 9: '#cd7f32', 8: '#ccc', 7: '#fc0', 6: '#0cf', 5: '#0f9', 4: '#00f3ff', 3: '#bc13fe', 2: '#f80', 1: '#f24' };
  var MODEN = { ai: 'VS AI', league: 'League', local: 'Local 2P', mystery: 'Mystery', nomad: 'Nomad' };
  function J(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }
  function dk(ts) { return new Date(ts).toISOString().slice(0, 10); }
  function lastDays(n) { var a = [], t = Date.now(); for (var i = n - 1; i >= 0; i--) a.push(dk(t - i * 864e5)); return a; }
  function ago(ts) { if (!ts) return '-'; var m = (Date.now() - ts) / 6e4; return m < 60 ? Math.round(m) + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; }
  function clean(t) { return String(t == null ? '' : t).replace(/[<>&"]/g, ''); }
  function cols(vals, labels, color) {
    var mx = Math.max.apply(null, vals.concat([1]));
    return '<div class="xa-cols">' + vals.map(function (v, i) { return '<i title="' + labels[i] + ': ' + v + '" style="height:' + Math.round(v / mx * 100) + '%;background:' + color + '"></i>'; }).join('') +
      '</div><div class="xa-ax"><span>' + labels[0] + '</span><span>' + labels[labels.length - 1] + '</span></div>';
  }
  function rows(pairs, color) {
    var mx = Math.max.apply(null, pairs.map(function (p) { return p[1]; }).concat([1]));
    return pairs.map(function (p) {
      return '<div class="xa-r"><em>' + clean(p[0]) + '</em><s><u style="width:' + Math.round(p[1] / mx * 100) + '%;background:' + (p[2] || color) + '"></u></s><b>' + p[1] + '</b></div>';
    }).join('') || '<div style="opacity:.5;font-size:12px">No data yet</div>';
  }
  function tbl(head, body) {
    return '<div class="xa-w"><table class="xa-t"><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' +
      body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }

  var statEl, statBtn;
  function statMsg(t) { statEl.firstChild.innerHTML = head('') + '<div class="xa-msg">' + t + '</div>'; }
  function head(updated) {
    return '<div class="xe-top"><h2>Admin stats</h2><span style="flex:1;font-size:11px;opacity:.5">' + updated + '</span>' +
      '<button class="xa-rf" type="button" data-r="1">Refresh</button><button class="xe-x" type="button" aria-label="Close">&#10005;</button></div>';
  }
  function loadStats() {
    var A = window.XOAuth;
    statMsg('Loading...');
    if (!A || typeof A.ready !== 'function') { statMsg('Open this from the main menu (Bbb) while signed in.'); return; }
    A.ready(function () {
      var u = A.user(), db = getDb();
      if (!u || u.email !== ADMIN_EMAIL || !db) { statMsg('Sign in with the admin account (<b>omar_admin</b>) first.'); return; }
      Promise.all([
        db.ref('users').once('value'),
        db.ref('activity').orderByKey().limitToLast(30).once('value').catch(function () { return null; })
      ]).then(function (r) { renderStats(r[0].val() || {}, (r[1] && r[1].val()) || {}); })
        .catch(function (e) { statMsg('Could not read the data (' + clean(e.code || e.message) + ').<br>Publish the database rules (database.rules.json) in Firebase, then press Refresh.'); });
    });
  }
  function renderStats(users, act) {
    var days = lastDays(30), today = days[29], wk = days.slice(23), P = [], signs = {}, modes = {}, divs = {}, gday = {}, owned = {};
    var W = 0, D = 0, L = 0, G = 0, coinsAll = 0, buyers = 0;
    Object.keys(users).forEach(function (uid) {
      var x = users[uid], p = x.profile || {}, sv = x.save || {}, st = J(sv.xo_stats), lg = J(sv.xo_league_v2), sh = st.shop || {};
      var g = (st.w || 0) + (st.d || 0) + (st.l || 0) + (st.p || 0);
      P.push({ uid: uid, name: p.name || 'Player', tag: p.tag || '-----', created: p.created || 0, last: p.last || 0, logins: p.logins || 0, g: g, lg: lg });
      if (p.created) signs[dk(p.created)] = (signs[dk(p.created)] || 0) + 1;
      W += st.w || 0; D += st.d || 0; L += st.l || 0; G += g; coinsAll += sh.c || 0;
      if ((sh.o || []).length) buyers++;
      (sh.o || []).forEach(function (i) { owned[i] = (owned[i] || 0) + 1; });
      Object.keys(st.m || {}).forEach(function (m) { var o = st.m[m]; modes[m] = (modes[m] || 0) + (o.w || 0) + (o.d || 0) + (o.l || 0) + (o.p || 0); });
      (st.h || []).forEach(function (h) { if (h[2]) gday[dk(h[2])] = (gday[dk(h[2])] || 0) + 1; });
      if (lg.divId) divs[lg.divId] = (divs[lg.divId] || 0) + 1;
    });
    var actDay = {}, wkSet = {};
    days.forEach(function (d) { actDay[d] = act[d] ? Object.keys(act[d]).length : 0; });
    wk.forEach(function (d) { Object.keys(act[d] || {}).forEach(function (u) { wkSet[u] = 1; }); });
    if (!Object.keys(act).length) P.forEach(function (p) { if (p.last) { var d = dk(p.last); if (actDay[d] != null) actDay[d]++; if (wk.indexOf(d) > -1) wkSet[p.uid] = 1; } });
    var total = P.length, new7 = wk.reduce(function (a, d) { return a + (signs[d] || 0); }, 0);
    var returned = P.filter(function (p) { return p.last && p.created && p.last - p.created > 864e5; }).length;
    var played = P.filter(function (p) { return p.g > 0; }).length;
    function pc(a, b) { return b ? Math.round(a / b * 100) + '%' : '-'; }
    var K = [
      ['Total accounts', total, 'all time', '#00f3ff'],
      ['New today', signs[today] || 0, new7 + ' in 7 days', '#00ff66'],
      ['Active today', actDay[today] || 0, Object.keys(wkSet).length + ' in 7 days', '#bc13fe'],
      ['Total games', G, total ? (G / total).toFixed(1) + ' per player' : '-', '#ff0055'],
      ['Win rate', pc(W, W + D + L), W + 'W ' + D + 'D ' + L + 'L', '#ffcc00'],
      ['Returning', pc(returned, total), 'came back after day 1', '#00f3ff'],
      ['Played a game', pc(played, total), played + ' of ' + total, '#00ff66'],
      ['Coins held', fmt(coinsAll), total ? fmt(Math.round(coinsAll / total)) + ' per player' : '-', '#ffcc00'],
      ['Shop buyers', pc(buyers, total), buyers + ' bought a projector', '#ff0055']
    ];
    var short = days.map(function (d) { return d.slice(5); });
    var modeP = Object.keys(modes).map(function (m) { return [MODEN[m] || m, modes[m]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var divP = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(function (i) { return [DIVN[i], divs[i] || 0, DIVC[i]]; });
    var shopP = Shop.catalog.map(function (c) { return [c.name, owned[c.id] || 0]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
    var top = P.filter(function (p) { return p.lg.divId; }).sort(function (a, b) { return (a.lg.divId - b.lg.divId) || ((b.lg.pts || 0) - (a.lg.pts || 0)); }).slice(0, 10);
    var rec = P.slice().sort(function (a, b) { return b.created - a.created; }).slice(0, 12);

    var h = head('updated ' + new Date().toLocaleTimeString());
    h += '<div class="xa-k">' + K.map(function (k) { return '<div class="xa-kc" style="--a:' + k[3] + '"><span>' + k[0] + '</span><b>' + k[1] + '</b><i>' + k[2] + '</i></div>'; }).join('') + '</div>';
    h += '<div class="xa-g" style="margin-top:12px">' +
      '<div class="xa-p"><div class="xe-h">New accounts / day (30d)</div>' + cols(days.map(function (d) { return signs[d] || 0; }), short, '#00f3ff') + '</div>' +
      '<div class="xa-p"><div class="xe-h">Active players / day (30d)</div>' + cols(days.map(function (d) { return actDay[d]; }), short, '#bc13fe') + '</div>' +
      '<div class="xa-p"><div class="xe-h">Games / day (recent matches)</div>' + cols(days.map(function (d) { return gday[d] || 0; }), short, '#ff0055') + '</div>' +
      '<div class="xa-p"><div class="xe-h">Games by mode</div>' + rows(modeP, '#00f3ff') + '</div>' +
      '<div class="xa-p"><div class="xe-h">Results</div>' + rows([['Wins', W, '#00ff66'], ['Draws', D, '#ffcc00'], ['Losses', L, '#ff0055']], '#fff') + '</div>' +
      '<div class="xa-p"><div class="xe-h">Players by division</div>' + rows(divP, '#888') + '</div>' +
      '<div class="xa-p"><div class="xe-h">Most owned projectors</div>' + rows(shopP, '#ffcc00') + '</div></div>';
    h += '<div class="xa-p" style="margin-top:12px"><div class="xe-h">Top 10 players</div>' + tbl(['#', 'Player', 'Division', 'Pts', 'Streak', 'W', 'D', 'L'], top.map(function (p, i) {
      var d = p.lg.divId; return [i + 1, clean(p.name) + ' <small style="opacity:.5">#' + clean(p.tag) + '</small>', '<b style="color:' + DIVC[d] + '">' + DIVN[d] + '</b>', p.lg.pts || 0, p.lg.bestStreak || 0, p.lg.wins || 0, p.lg.draws || 0, p.lg.losses || 0];
    })) + '</div>';
    h += '<div class="xa-p" style="margin-top:12px"><div class="xe-h">Latest sign-ups</div>' + tbl(['Player', 'Joined', 'Last seen', 'Logins', 'Games'], rec.map(function (p) {
      return [clean(p.name) + ' <small style="opacity:.5">#' + clean(p.tag) + '</small>', p.created ? new Date(p.created).toLocaleDateString() : '-', ago(p.last), p.logins || '-', p.g];
    })) + '</div>';
    statEl.firstChild.innerHTML = h;
  }
  function openStats() {
    css();
    if (!statEl) {
      statEl = mk('div', 'xe-modal', '<div class="xe-sheet wide"></div>'); statEl.style.setProperty('--c', '#00f3ff');
      statEl.addEventListener('click', function (ev) {
        if (ev.target === statEl || ev.target.closest('.xe-x')) { statEl.classList.remove('open'); return; }
        if (ev.target.closest('[data-r]')) loadStats();
      });
      document.body.appendChild(statEl);
    }
    statEl.classList.add('open'); loadStats();
  }

  var devBtn;
  function mountUi() {
    if (dailyBtn || !document.body) return; css();
    dailyBtn = mk('button', 'xe-btn big', '&#127873;'); dailyBtn.type = 'button'; dailyBtn.title = 'Daily rewards';
    dailyBtn.setAttribute('aria-label', 'Daily rewards'); dailyBtn.style.cssText = 'left:124px;--c:#00ff66'; dailyBtn.onclick = openDaily;
    document.body.appendChild(dailyBtn);
    dailyBtn.classList.toggle('dot', canClaim(load()));
  }
  function syncDevBtn() {
    var on = isDev();
    if (on && !devBtn) {
      devBtn = mk('button', 'xe-btn', 'DEV'); devBtn.type = 'button'; devBtn.title = 'Developer tools';
      devBtn.style.cssText = 'left:72px;top:auto;bottom:calc(20px + env(safe-area-inset-bottom,0px));--c:#ff0055'; devBtn.onclick = openDev; document.body.appendChild(devBtn);
    } else if (!on && devBtn) { devBtn.remove(); devBtn = null; }
    if (on) topUp();
    // admin stats button (only for the admin account)
    var ad = isAdmin();
    if (ad && !statBtn) {
      var old = document.getElementById('xoAdminLink'); if (old) old.remove();
      css(); statBtn = mk('button', 'xe-btn big', '&#128202;'); statBtn.type = 'button'; statBtn.title = 'Admin stats';
      statBtn.setAttribute('aria-label', 'Admin stats'); statBtn.style.cssText = 'left:20px;top:auto;bottom:calc(20px + env(safe-area-inset-bottom,0px));--c:#00f3ff'; statBtn.onclick = openStats; document.body.appendChild(statBtn);
    } else if (!ad && statBtn) { statBtn.remove(); statBtn = null; }
  }

  function fixNote() {
    var n = document.querySelector('.xs-note'); if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  /* ------------------------------------------------------------------ *
   *  IN-MATCH PROJECTOR CONTROLS (tap = on/off, drag = move, double tap = reset)
   * ------------------------------------------------------------------ */
  var PK_OFF = 'xo_proj_off', PK_POS = 'xo_proj_pos', PK_HINT = 'xo_proj_hint', pcDone = false, pcHandle, pcLayer = null;
  function lsGet(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) LS.removeItem(k); else LS.setItem(k, v); } catch (e) {} }
  function layerEl() { var l = document.getElementById('xoProj'); return (l && l.style.display !== 'none') ? l : null; }
  function rgbOf(id) {
    var it = Shop.catalog.filter(function (c) { return c.id === id; })[0], h = (it ? it.accent : '#ffffff').replace('#', '');
    return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  }
  function base() {
    var W = window.innerWidth, H = window.innerHeight, m = Math.min(W, H), pw = Math.max(54, Math.min(96, m * .13)), ph = pw * .64;
    return { W: W, H: H, pw: pw, ph: ph, x0: 10, y0: H * .86 - ph, d: Math.max(m * 1.05, 360), cx: W * .78, cy: H > W ? H * .14 : H * .26 };
  }
  function placeDev(l, x, y) {
    var dev = l.querySelector('.xp-dev'), shelf = l.querySelector('.xp-shelf'), beam = l.querySelector('.xp-beam'), disc = l.querySelector('.xp-disc');
    if (!dev || !shelf || !beam || !disc) return;
    var B = base(), pw = B.pw, ph = B.ph;
    x = Math.max(0, Math.min(B.W - pw, x)); y = Math.max(0, Math.min(B.H - ph * 1.05, y));
    var cx = B.cx + (x - B.x0), cy = B.cy + (y - B.y0);
    disc.style.left = (cx - B.d / 2) + 'px'; disc.style.top = (cy - B.d / 2) + 'px';
    dev.style.left = x + 'px'; dev.style.top = y + 'px';
    shelf.style.left = (x - 4) + 'px'; shelf.style.width = (pw * 1.15) + 'px'; shelf.style.top = (y + ph * .88) + 'px';
    var lx = x + pw * .88, ly = y + ph * .53, vx = cx - lx, vy = cy - ly, len = Math.sqrt(vx * vx + vy * vy) || 1, nx = -vy / len, ny = vx / len, rr = B.d * .40, rgb = rgbOf(l.getAttribute('data-id'));
    beam.style.clipPath = beam.style.webkitClipPath = 'polygon(' + lx + 'px ' + ly + 'px,' + (cx + nx * rr) + 'px ' + (cy + ny * rr) + 'px,' + (cx - nx * rr) + 'px ' + (cy - ny * rr) + 'px)';
    beam.style.background = 'radial-gradient(circle at ' + lx + 'px ' + ly + 'px,rgba(255,255,255,.2) 0,rgba(' + rgb + ',.07) ' + (len * .55) + 'px,rgba(' + rgb + ',0) ' + (len * .93) + 'px)';
  }
  function applySaved(l) {
    l.classList.toggle('xe-off', lsGet(PK_OFF) === '1');
    var p; try { p = JSON.parse(lsGet(PK_POS) || 'null'); } catch (e) {}
    if (p && typeof p.x === 'number' && typeof p.y === 'number') placeDev(l, p.x * window.innerWidth, p.y * window.innerHeight);
    syncHandle();
  }
  function syncHandle() {
    if (!pcHandle) return;
    var l = layerEl(), dev = l && l.querySelector('.xp-dev');
    if (!dev) { pcHandle.style.display = 'none'; return; }
    var r = dev.getBoundingClientRect();
    pcHandle.style.cssText = 'display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
  }
  function initControls() {
    if (pcDone || SHOP_MODE || !document.body) return; pcDone = true;
    var st = mk('style');
    st.textContent =
      '#xoProj.xe-off .xp-disc,#xoProj.xe-off .xp-beam,#xoProj.xe-off .xp-tw,#xoProj.xe-off .xp-shoot{visibility:hidden}' +
      '#xoProj.xe-off .xp-dev{opacity:.45;filter:none}' +
      '#xePcHandle{position:fixed;z-index:99984;display:none;border-radius:14px;cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent}' +
      '#xePcHandle:active{cursor:grabbing}';
    document.head.appendChild(st);
    pcHandle = mk('div'); pcHandle.id = 'xePcHandle'; pcHandle.title = 'Tap: light on/off. Drag: move. Double tap: reset';
    document.body.appendChild(pcHandle);
    var sx, sy, ox, oy, down = false, moved = false, lastTap = 0;
    pcHandle.addEventListener('pointerdown', function (e) {
      var l = layerEl(), dev = l && l.querySelector('.xp-dev'); if (!dev) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY; ox = parseFloat(dev.style.left) || 0; oy = parseFloat(dev.style.top) || 0;
      try { pcHandle.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    });
    pcHandle.addEventListener('pointermove', function (e) {
      if (!down) return; var l = layerEl(); if (!l) return;
      if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 7) return;
      moved = true; placeDev(l, ox + e.clientX - sx, oy + e.clientY - sy); syncHandle();
    });
    function up() {
      if (!down) return; down = false; var l = layerEl(); if (!l) return;
      if (moved) {
        var dev = l.querySelector('.xp-dev');
        lsSet(PK_POS, JSON.stringify({ x: (parseFloat(dev.style.left) || 0) / window.innerWidth, y: (parseFloat(dev.style.top) || 0) / window.innerHeight }));
        return;
      }
      var now = Date.now();
      if (now - lastTap < 350) {
        lastTap = 0; lsSet(PK_OFF, lsGet(PK_OFF) === '1' ? null : '1'); lsSet(PK_POS, null); window.dispatchEvent(new Event('resize')); return;
      }
      lastTap = now;
      lsSet(PK_OFF, lsGet(PK_OFF) === '1' ? null : '1'); applySaved(l);
    }
    pcHandle.addEventListener('pointerup', up); pcHandle.addEventListener('pointercancel', up);
    window.addEventListener('resize', function () { setTimeout(function () { var l = layerEl(); if (l) applySaved(l); }, 80); });
    setInterval(function () {
      var l = layerEl();
      if (!l) { syncHandle(); return; }
      if (l !== pcLayer) {
        pcLayer = l; applySaved(l);
        if (!lsGet(PK_HINT)) { lsSet(PK_HINT, '1'); Shop.toast({ text: 'Tap the projector: light on/off. Drag it to move.' }); }
      }
    }, 400);
  }

  /* ------------------------------------------------------------------ *
   *  start-up
   * ------------------------------------------------------------------ */
  window.XOEarn = { isDev: isDev, isAdmin: isAdmin, openDaily: openDaily, openStats: openStats, state: load };

  function boot() {
    hook();
    syncDevBtnSafe();
    if (SHOP_MODE) {
      mountUi();
      track(); checkAuth();
      try { new MutationObserver(fixNote).observe(document.body, { childList: true }); } catch (e) {}
      [1500, 4000, 8000].forEach(function (t) { setTimeout(function () { syncDevBtn(); checkAuth(); }, t); });   // the profile arrives from the cloud a moment after load
      window.addEventListener('pageshow', syncDevBtn); window.addEventListener('focus', syncDevBtn);
    } else {
      initControls();
      topUp(); [1500, 4000].forEach(function (t) { setTimeout(topUp, t); });
    }
  }
  function syncDevBtnSafe() { if (SHOP_MODE) syncDevBtn(); }
  hook();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', hook);
})();
