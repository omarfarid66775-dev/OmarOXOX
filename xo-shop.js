/* ==========================================================================
   xo-shop.js  -  Ultimate XO: coins, projector shop, in-match projector.
   One shared file. Put it in the same folder as auth.js and load it AFTER
   auth.js on every page that needs it:

     <script src="auth.js"></script>
     <script src="xo-shop.js" data-mode="game"></script>

   data-mode:
     "shop"    -> Bbb.html: coin counter + SHOP button + the shop window
     "menu"    -> a pure menu page (Levels, OnAi): just the coin counter
     "game"    -> a page that is always a match (VS AI, Local, Nomad, Mystery):
                  no counter, projector behind the board
     "manual"  -> a page with menu screens + match screens (League, Online):
                  the counter shows on the menus and hides during a match; the
                  page calls XOShop.setPlaying(true/false) when the match
                  screen opens/closes

   WHERE THE COIN COUNTER SITS
   Top-right corner by default. If a page already has something up there, move
   the counter down with two CSS variables (they can change per screen):
       body.on-lobby { --xs-top: 66px; --xs-right: 18px; }

   Money lives inside the existing "xo_stats" save (key "shop"), so it is
   uploaded to the cloud together with the rest of the progress and no change
   to auth.js is needed.
   ========================================================================== */
(function () {
  'use strict';
  if (window.XOShop) return;

  var me = document.currentScript;
  var MODE = (me && me.getAttribute('data-mode')) || 'game';

  /* ------------------------------------------------------------------ *
   *  SETTINGS - change prices / rewards here
   * ------------------------------------------------------------------ */
  var REWARDS = { win: 20, promotion: 50 };

  var CATALOG = [
    { id: 'violet', name: 'Violet Nebula',  blurb: 'Purple and magenta clouds',        price: 400, rar: ['COMMON', '#9aa3b8'],
      accent: '#b85cff', pal: ['150,40,255', '255,70,200', '80,60,255'],  kind: 'nebula', seed: 11, fade: 40, op: .66 },
    { id: 'ocean',  name: 'Ocean Nebula',   blurb: 'Cold cyan over deep blue',         price: 400, rar: ['COMMON', '#9aa3b8'],
      accent: '#2fd6ff', pal: ['0,190,255', '30,90,255', '0,255,200'],    kind: 'nebula', seed: 23, fade: 40, op: .66 },
    { id: 'ember',  name: 'Ember Nebula',   blurb: 'Burning orange and crimson',       price: 450, rar: ['RARE', '#3da5ff'],
      accent: '#ff7a3d', pal: ['255,80,30', '255,170,40', '210,20,90'],   kind: 'nebula', seed: 37, fade: 40, op: .66 },
    { id: 'moon',   name: 'Full Moon',      blurb: 'A silver moon in a starry sky',    price: 500, rar: ['RARE', '#3da5ff'],
      accent: '#dbe6ff', pal: ['120,150,255'],                            kind: 'moon',   seed: 5,  fade: 58, op: .95 },
    { id: 'aurora', name: 'Aurora',         blurb: 'Green and teal northern lights',   price: 600, rar: ['EPIC', '#bc13fe'],
      accent: '#3dffb0', pal: ['40,255,170', '60,200,255', '150,90,255'], kind: 'aurora', seed: 9,  fade: 28, op: .72 },
    { id: 'galaxy', name: 'Spiral Galaxy',  blurb: 'A slowly turning galaxy and shooting stars', price: 750, rar: ['LEGENDARY', '#ffcc00'],
      accent: '#ff7ad9', pal: ['255,110,200'],                            kind: 'galaxy', seed: 3,  fade: 62, op: .64 }
  ];

  /* ------------------------------------------------------------------ *
   *  small helpers
   * ------------------------------------------------------------------ */
  var byId = {}; CATALOG.forEach(function (c) { byId[c.id] = c; });
  function $(s, r) { return (r || document).querySelector(s); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(t) { return String(t).replace(/[<>&"]/g, ''); }
  function fmt(n) { try { return Number(n).toLocaleString('en-US'); } catch (e) { return String(n); } }
  function hexRgb(h) { h = h.replace('#', ''); return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16); }
  var uidN = 0;
  var idle = window.requestIdleCallback ? function (f) { requestIdleCallback(f, { timeout: 2500 }); } : function (f) { setTimeout(f, 400); };

  var COIN = '<svg class="xs-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.4" fill="#ffc93c"/>' +
    '<circle cx="12" cy="12" r="10.4" fill="none" stroke="#b9780a" stroke-width="1.5"/>' +
    '<circle cx="12" cy="12" r="7" fill="none" stroke="#e29b12" stroke-width="1.4"/>' +
    '<path d="M12 7.4l3.2 4.6-3.2 4.6-3.2-4.6z" fill="#fff3c4" stroke="#c98a0c" stroke-width="1" stroke-linejoin="round"/></svg>';

  /* ------------------------------------------------------------------ *
   *  WALLET (stored inside xo_stats.shop = { c: coins, o: [owned], e: equipped })
   * ------------------------------------------------------------------ */
  var KEY = 'xo_stats', mem = null, subs = [];

  function readStats() {
    try {
      var raw = localStorage.getItem(KEY), o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return mem ? JSON.parse(JSON.stringify(mem)) : {}; }
  }
  function writeStats(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { mem = st; }
    // signed-in player: make sure the new balance gets uploaded (same trick recordGame uses)
    try { var h = localStorage.getItem('xo_hint'); if (h && h !== 'guest') localStorage.setItem('xo_dirty', '1'); } catch (e) {}
  }
  function readShop() {
    var s = readStats().shop || {}, seen = {};
    var o = (Array.isArray(s.o) ? s.o : []).filter(function (x) { if (!byId[x] || seen[x]) return false; seen[x] = 1; return true; });
    return { c: Math.max(0, Math.floor(+s.c || 0)), o: o, e: (byId[s.e] && o.indexOf(s.e) > -1) ? s.e : null };
  }
  function writeShop(w) {
    var st = readStats(); st.shop = { c: w.c, o: w.o, e: w.e }; writeStats(st); fire();
  }
  function fire() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }

  function coins() { return readShop().c; }
  function owns(id) { return readShop().o.indexOf(id) > -1; }
  function equipped() { return readShop().e; }
  function addCoins(n) {
    n = Math.floor(+n || 0); if (!n) return coins();
    var w = readShop(); w.c = Math.max(0, w.c + n); writeShop(w); return w.c;
  }
  function buy(id) {
    var it = byId[id], w = readShop();
    if (!it) return { ok: false, reason: 'unknown' };
    if (w.o.indexOf(id) > -1) return { ok: false, reason: 'owned' };
    if (w.c < it.price) return { ok: false, reason: 'poor', need: it.price - w.c };
    w.c -= it.price; w.o.push(id); w.e = id;           // a new projector is equipped right away
    writeShop(w); return { ok: true };
  }
  function equip(id) {
    var w = readShop();
    if (id && w.o.indexOf(id) < 0) return false;
    w.e = id || null; writeShop(w); return true;
  }

  /* ------------------------------------------------------------------ *
   *  base CSS (coin icon, toasts) + toasts
   * ------------------------------------------------------------------ */
  var baseCssDone = false;
  function baseCss() {
    if (baseCssDone) return; baseCssDone = true;
    var s = mk('style'); s.id = 'xo-shop-base';
    s.textContent =
      '.xs-coin{width:20px;height:20px;flex:none;display:block;filter:drop-shadow(0 0 5px rgba(255,201,60,.55))}' +
      '#xo-toasts{position:fixed;top:14px;left:0;right:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;font-family:"Segoe UI",system-ui,sans-serif}' +
      '.xo-toast{display:flex;align-items:center;gap:9px;padding:8px 18px 8px 10px;border-radius:50px;border:2px solid #ffcc00;background:rgba(10,8,22,.92);color:#ffcc00;box-shadow:0 0 24px rgba(255,204,0,.35);animation:xtIn .35s cubic-bezier(.2,1.3,.4,1)}' +
      '.xo-toast .xs-coin{width:26px;height:26px}' +
      '.xo-toast b{font-size:20px;font-weight:900;color:#fff}' +
      '.xo-toast span{font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}' +
      '.xo-toast.warn{border-color:#ff0055;color:#ff5c8a;box-shadow:0 0 24px rgba(255,0,85,.3)}' +
      '.xo-toast.out{animation:xtOut .5s ease-in forwards}' +
      '@keyframes xtIn{from{opacity:0;transform:translateY(-18px) scale(.9)}to{opacity:1;transform:none}}' +
      '@keyframes xtOut{to{opacity:0;transform:translateY(-12px)}}';
    document.head.appendChild(s);
  }
  function toast(o) {
    baseCss();
    setTimeout(function () {
      var box = $('#xo-toasts');
      if (!box) { box = mk('div'); box.id = 'xo-toasts'; document.body.appendChild(box); }
      var t = mk('div', 'xo-toast' + (o.warn ? ' warn' : ''),
        (o.coin ? COIN : '') + (o.amt ? '<b>' + esc(o.amt) + '</b>' : '') + '<span>' + esc(o.text || '') + '</span>');
      box.appendChild(t);
      setTimeout(function () { t.classList.add('out'); }, 2300);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2850);
    }, o.delay || 0);
  }

  function rewardWin() { addCoins(REWARDS.win); toast({ coin: true, amt: '+' + REWARDS.win, text: 'Win bonus' }); }
  function rewardPromotion() { addCoins(REWARDS.promotion); toast({ coin: true, amt: '+' + REWARDS.promotion, text: 'Promotion bonus', delay: 900 }); }

  // Every win in VS AI, League and Online goes through XOAuth.recordGame, so we
  // listen there instead of editing each game's end-of-match code.
  function earnsCoins(mode) { mode = String(mode || ''); return mode === 'ai' || mode === 'league' || mode.indexOf('online-') === 0; }
  function hookAuth() {
    var A = window.XOAuth;
    if (!A || A.__xoShopHooked || typeof A.recordGame !== 'function') return;
    var orig = A.recordGame;
    A.recordGame = function (mode, result) {
      var r = orig.apply(this, arguments);
      try { if (result === 'win' && earnsCoins(mode)) rewardWin(); } catch (e) {}
      return r;
    };
    A.__xoShopHooked = true;
  }

  /* ------------------------------------------------------------------ *
   *  SCENE PAINTERS (canvas, painted once, transparent background)
   * ------------------------------------------------------------------ */
  function rng(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function blob(c, x, y, r, rgb, a) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    g.addColorStop(.45, 'rgba(' + rgb + ',' + (a * .4) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function stars(c, S, R, n) {
    var k = S / 300, tints = ['255,255,255', '200,215,255', '255,232,205'];
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) {
      var x = R() * S, y = R() * S, r = (.35 + R() * R() * 1.5) * k, a = .35 + R() * .65, t = tints[(R() * 3) | 0];
      c.fillStyle = 'rgba(' + t + ',' + a + ')'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      if (R() > .93) blob(c, x, y, r * 7, t, .45);
    }
  }

  function paintNebula(c, S, R, it) {
    var pal = it.pal, n = pal.length, i, a, d;
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < 30; i++) { a = R() * 6.2832; d = Math.pow(R(), .7) * S * .36; blob(c, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (.14 + R() * .22), pal[i % n], .12 + R() * .13); }
    for (i = 0; i < 9; i++) { a = R() * 6.2832; d = R() * S * .18; blob(c, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (.06 + R() * .09), pal[(i + 1) % n], .28 + R() * .25); }
    c.globalCompositeOperation = 'source-over';
    for (i = 0; i < 7; i++) { a = R() * 6.2832; d = R() * S * .26; blob(c, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (.06 + R() * .10), '3,1,14', .30 + R() * .2); }
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (i = 0; i < 5; i++) {
      c.strokeStyle = 'rgba(' + pal[i % n] + ',.18)'; c.lineWidth = S * (.004 + R() * .006); c.beginPath();
      var a0 = R() * 6.28; c.arc(S * (.25 + R() * .5), S * (.25 + R() * .5), S * (.08 + R() * .18), a0, a0 + 1 + R() * 1.6); c.stroke();
    }
    stars(c, S, R, S < 400 ? 55 : 130);
  }

  function paintMoon(c, S, R, it, game) {
    var cx = S / 2, cy = S / 2, r = S * (game ? .13 : .27), i;
    c.globalCompositeOperation = 'lighter';
    blob(c, cx, cy, r * 4.6, '120,150,255', .26); blob(c, cx, cy, r * 2.6, '200,220,255', .38);
    stars(c, S, R, game ? 90 : 60);
    c.globalCompositeOperation = 'source-over';
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.clip();
    var g = c.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r * 1.05);
    g.addColorStop(0, '#fffff4'); g.addColorStop(.55, '#dfe4f1'); g.addColorStop(1, '#8d97b6');
    c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
    [[-.25, -.15, .38], [.22, .05, .30], [-.05, .38, .26], [.30, -.35, .20]].forEach(function (m) { blob(c, cx + m[0] * r, cy + m[1] * r, m[2] * r, '120,130,160', .26); });
    for (i = 0; i < 14; i++) {
      var a = R() * 6.2832, d = Math.sqrt(R()) * r * .85, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, cr = r * (.04 + R() * .10);
      c.fillStyle = 'rgba(105,115,145,.17)'; c.beginPath(); c.arc(x, y, cr, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1, cr * .18); c.beginPath(); c.arc(x - cr * .12, y - cr * .12, cr, 3.5, 5.6); c.stroke();
    }
    var sh = c.createRadialGradient(cx - r * .5, cy - r * .45, r * .5, cx, cy, r * 1.15);
    sh.addColorStop(0, 'rgba(10,12,40,0)'); sh.addColorStop(1, 'rgba(10,12,40,.42)');
    c.fillStyle = sh; c.fillRect(cx - r, cy - r, r * 2, r * 2);
    c.restore();
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(220,235,255,.35)'; c.lineWidth = Math.max(1, r * .04);
    c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.stroke();
  }

  function paintAurora(c, S, R, it) {
    var pal = it.pal, step = Math.max(1, Math.round(S / 300)), sc = 300 / S, k, x;
    c.globalCompositeOperation = 'lighter';
    blob(c, S * .5, S * .78, S * .5, pal[1], .12);
    stars(c, S, R, S < 400 ? 45 : 110);
    for (k = 0; k < 4; k++) {
      var col = pal[k % pal.length], ph = R() * 6.28, base = S * (.26 + k * .07), amp = S * (.05 + R() * .04), fr = (.011 + R() * .01) * sc;
      for (x = 0; x < S; x += step) {
        var y = base + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.3 + ph * 1.7) * amp * .4;
        var len = S * (.30 + .10 * Math.sin(x * .02 * sc + k));
        var g = c.createLinearGradient(0, y, 0, y + len);
        g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(.1, 'rgba(' + col + ',.5)');
        g.addColorStop(.45, 'rgba(' + col + ',.16)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        c.fillStyle = g; c.fillRect(x, y, step + .5, len);
      }
    }
  }

  function paintGalaxy(c, S, R, it) {
    var cx = S / 2, cy = S / 2, M = S * .42, k = S / 300, N = S < 400 ? 3500 : 9000, i;
    c.globalCompositeOperation = 'lighter';
    blob(c, cx, cy, M * 1.25, '90,70,255', .16); blob(c, cx, cy, M * .55, '255,110,200', .18);
    stars(c, S, R, S < 400 ? 40 : 100);
    function tone(t) { return t < .25 ? '255,226,170' : (t < .6 ? '255,140,215' : '120,160,255'); }
    for (i = 0; i < N; i++) {
      var t = Math.pow(R(), .75), j = (R() + R() + R() - 1.5) * (.25 + .35 * t);
      var ang = (i % 3) * 2.0944 + t * 4.4 + j, r = M * t, sz = (.5 + R() * 1.2) * k;
      c.fillStyle = 'rgba(' + tone(t) + ',' + (.25 + .5 * R() * (1 - t * .5)) + ')';
      c.fillRect(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, sz, sz);
    }
    for (i = 0; i < 14; i++) { var tt = .2 + R() * .7, aa = (i % 3) * 2.0944 + tt * 4.4; blob(c, cx + Math.cos(aa) * M * tt, cy + Math.sin(aa) * M * tt, S * .02, '255,100,180', .5); }
    blob(c, cx, cy, M * .28, '255,235,190', .9); blob(c, cx, cy, M * .12, '255,255,240', .9);
  }

  var PAINT = { nebula: paintNebula, moon: paintMoon, aurora: paintAurora, galaxy: paintGalaxy };

  /* ---------- 3 more scenes ---------- */

  // Retro sun over a neon grid. pal = [sun top, sun bottom, grid]
  PAINT.synth = function (c, S, R, it) {
    var p = it.pal, cx = S / 2, hy = S * .56, r = S * .21, i, g;
    c.save(); c.beginPath(); c.rect(0, 0, S, hy); c.clip();
    g = c.createLinearGradient(0, hy - r * 2.2, 0, hy);
    g.addColorStop(0, 'rgba(' + p[0] + ',1)'); g.addColorStop(1, 'rgba(' + p[1] + ',1)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, hy - r * .9, r, 0, 6.2832); c.fill();
    c.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 5; i++) c.fillRect(cx - r, hy - r * (.15 + i * .3), r * 2, r * (.11 - i * .018));
    c.restore();
    c.globalCompositeOperation = 'lighter';
    blob(c, cx, hy - r * .9, r * 2.6, p[0], .30);
    c.strokeStyle = 'rgba(' + p[2] + ',.8)'; c.lineWidth = Math.max(1, S / 300); c.beginPath();
    c.moveTo(0, hy); c.lineTo(S, hy);
    for (i = 1; i <= 6; i++) { var y = hy + (S - hy) * Math.pow(i / 6, 2); c.moveTo(0, y); c.lineTo(S, y); }
    for (i = -8; i <= 8; i++) { c.moveTo(cx, hy); c.lineTo(cx + i * S * .17, S); }
    c.stroke();
    stars(c, S, R, S < 400 ? 35 : 80);
  };

  // Glowing rings with sparks around a bright core
  PAINT.portal = function (c, S, R, it) {
    var p = it.pal, cx = S / 2, i, a, d;
    c.globalCompositeOperation = 'lighter';
    blob(c, cx, cx, S * .42, p[0], .22);
    for (i = 0; i < 7; i++) {
      var rr = S * (.06 + i * .05), col = p[i % p.length];
      c.strokeStyle = 'rgba(' + col + ',' + (.9 - i * .1) + ')'; c.lineWidth = S * (.012 - i * .0009);
      c.beginPath(); c.arc(cx, cx, rr, 0, 6.2832); c.stroke(); blob(c, cx, cx, rr, col, .05);
    }
    for (i = 0; i < 70; i++) {
      a = R() * 6.2832; d = S * (.05 + R() * .33);
      c.fillStyle = 'rgba(' + p[i % p.length] + ',' + (.3 + R() * .6) + ')';
      c.beginPath(); c.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, S * (.002 + R() * .004), 0, 6.2832); c.fill();
    }
    blob(c, cx, cx, S * .07, '255,255,255', .9);
    stars(c, S, R, S < 400 ? 30 : 70);
  };

  // Floating neon X and O marks (the game's own symbols)
  PAINT.xo = function (c, S, R, it) {
    var p = it.pal, i;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    blob(c, S / 2, S / 2, S * .45, p[0], .12);
    for (i = 0; i < 22; i++) {
      var x = S * (.12 + R() * .76), y = S * (.12 + R() * .76), s = S * (.04 + R() * .05), col = p[i % p.length], a = .35 + R() * .5;
      blob(c, x, y, s * 2.2, col, a * .35);
      c.strokeStyle = 'rgba(' + col + ',' + a + ')'; c.lineWidth = Math.max(1.2, S * .008);
      c.save(); c.translate(x, y); c.rotate(R() * 6.28); c.beginPath();
      if (i % 2) { c.arc(0, 0, s * .8, 0, 6.2832); }
      else { c.moveTo(-s * .8, -s * .8); c.lineTo(s * .8, s * .8); c.moveTo(s * .8, -s * .8); c.lineTo(-s * .8, s * .8); }
      c.stroke(); c.restore();
    }
    stars(c, S, R, S < 400 ? 30 : 70);
  };

  /* ---------- 15 more projectors ---------- */

  var MYTHIC = ['MYTHIC', '#ff0055'], RC = ['COMMON', '#9aa3b8'], RR = ['RARE', '#3da5ff'], RE = ['EPIC', '#bc13fe'], RL = ['LEGENDARY', '#ffcc00'];
  [
    { id: 'mint',    name: 'Mint Haze',        blurb: 'Fresh green neon mist',                  price: 300,  rar: RC, accent: '#00ff66', pal: ['0,255,102', '0,243,255', '120,255,180'],  kind: 'nebula', seed: 41, fade: 40, op: .66 },
    { id: 'crimson', name: 'Crimson Haze',     blurb: 'Hot pink and deep red clouds',           price: 300,  rar: RC, accent: '#ff0055', pal: ['255,0,85', '255,60,120', '160,0,60'],    kind: 'nebula', seed: 47, fade: 40, op: .66 },
    { id: 'snow',    name: 'Snow Static',      blurb: 'Cold white and ice blue drift',          price: 300,  rar: RC, accent: '#e8f0ff', pal: ['255,255,255', '170,200,255', '220,230,255'], kind: 'nebula', seed: 53, fade: 40, op: .6 },
    { id: 'gold',    name: 'Golden Dust',      blurb: 'Warm gold and amber glow',               price: 350,  rar: RC, accent: '#ffcc00', pal: ['255,204,0', '255,140,0', '255,240,160'], kind: 'nebula', seed: 59, fade: 40, op: .66 },
    { id: 'xocyan',  name: 'XO Rain',          blurb: 'Floating neon X and O marks',            price: 450,  rar: RR, accent: '#00f3ff', pal: ['255,255,255', '157,0,255', '0,243,255'], kind: 'xo',     seed: 61, fade: 45, op: .85 },
    { id: 'xofire',  name: 'XO Inferno',       blurb: 'Burning X and O in red and orange',      price: 470,  rar: RR, accent: '#ff5a1f', pal: ['255,0,85', '255,140,0', '255,204,0'],    kind: 'xo',     seed: 67, fade: 45, op: .85 },
    { id: 'toxic',   name: 'Toxic Aurora',     blurb: 'Acid green and cyan curtains',           price: 470,  rar: RR, accent: '#a6ff00', pal: ['0,255,102', '200,255,0', '0,243,255'],   kind: 'aurora', seed: 71, fade: 28, op: .72 },
    { id: 'rose',    name: 'Rose Aurora',      blurb: 'Pink and violet northern lights',        price: 500,  rar: RR, accent: '#ff4fa0', pal: ['255,0,85', '188,19,254', '255,150,200'], kind: 'aurora', seed: 73, fade: 28, op: .72 },
    { id: 'synthp',  name: 'Synthwave Sunset', blurb: 'Pink retro sun over a neon grid',        price: 650,  rar: RE, accent: '#ff2fa6', pal: ['255,0,150', '255,200,0', '188,19,254'],  kind: 'synth',  seed: 79, fade: 55, op: .88 },
    { id: 'synthc',  name: 'Cyber Sunrise',    blurb: 'Cyan and violet sun, electric grid',     price: 700,  rar: RE, accent: '#00f3ff', pal: ['0,243,255', '157,0,255', '0,243,255'],   kind: 'synth',  seed: 83, fade: 55, op: .88 },
    { id: 'portalv', name: 'Violet Portal',    blurb: 'Rings of purple light with sparks',      price: 800,  rar: RE, accent: '#bc13fe', pal: ['157,0,255', '188,19,254', '0,243,255'],  kind: 'portal', seed: 89, fade: 50, op: .85 },
    { id: 'portalg', name: 'Matrix Portal',    blurb: 'Green and cyan energy gate',             price: 999,  rar: RE, accent: '#00ff66', pal: ['0,255,102', '0,243,255', '255,255,255'], kind: 'portal', seed: 97, fade: 50, op: .85 },
    { id: 'portalr', name: 'Hellgate',         blurb: 'A burning red portal',                   price: 1200,  rar: RL, accent: '#ff0055', pal: ['255,0,85', '255,120,0', '255,204,0'],    kind: 'portal', seed: 101, fade: 50, op: .88 },
    { id: 'chroma',  name: 'Chroma XO',        blurb: 'Every game colour, floating X and O',    price: 1599, rar: RL, accent: '#ffffff', pal: ['157,0,255', '0,243,255', '255,0,85', '0,255,102', '255,204,0'], kind: 'xo', seed: 103, fade: 45, op: .92 },
    { id: 'prism',   name: 'Prism Nebula',     blurb: 'All neon colours in one huge cloud',     price: 2100, rar: RL, accent: '#ff7ad9', pal: ['157,0,255', '0,243,255', '255,0,85', '0,255,102', '255,204,0'], kind: 'nebula', seed: 107, fade: 42, op: .78 }
  ].forEach(function (it) { CATALOG.push(it); });

  /* ---------- animated projectors: sea with fish, sunny day, fireflies, snow, rain, lava lamp, jellyfish ---------- */

  // soft glowing backdrop (uses it.bg colours, optional stars)
  PAINT.soft = function (c, S, R, it) {
    var bg = it.bg || it.pal, n = bg.length, i, a, d;
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < 16; i++) { a = R() * 6.2832; d = Math.pow(R(), .8) * S * .3; blob(c, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (.16 + R() * .2), bg[i % n], .14 + R() * .14); }
    blob(c, S / 2, S / 2, S * .3, bg[0], .2);
    if (it.stars) stars(c, S, R, S < 400 ? 30 : 70);
  };
  // underwater: deep blue water, light rays, tiny specks
  PAINT.sea = function (c, S, R, it) {
    var i, x, w, g;
    c.globalCompositeOperation = 'lighter';
    blob(c, S / 2, S * .35, S * .5, '0,90,220', .35); blob(c, S / 2, S * .7, S * .45, '0,200,255', .22); blob(c, S / 2, S / 2, S * .3, '0,40,160', .3);
    for (i = 0; i < 7; i++) {
      x = S * (.12 + R() * .76); w = S * (.05 + R() * .07);
      g = c.createLinearGradient(0, 0, 0, S * .9); g.addColorStop(0, 'rgba(190,245,255,.30)'); g.addColorStop(1, 'rgba(190,245,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - w * .3, 0); c.lineTo(x + w * .3, 0); c.lineTo(x + w * 1.6 + S * .06, S * .9); c.lineTo(x - w * .6 + S * .06, S * .9); c.closePath(); c.fill();
    }
    for (i = 0; i < 30; i++) blob(c, R() * S, R() * S, S * (.008 + R() * .014), '190,245,255', .5);
  };
  // daytime: blue sky disc with a bright sun
  PAINT.sky = function (c, S, R, it) {
    var g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(40,130,255,.95)'); g.addColorStop(1, 'rgba(150,215,255,.9)');
    c.fillStyle = g; c.beginPath(); c.arc(S / 2, S / 2, S * .5, 0, 6.2832); c.fill();
    c.globalCompositeOperation = 'lighter';
    blob(c, S * .72, S * .28, S * .34, '255,240,170', .75); blob(c, S * .72, S * .28, S * .12, '255,255,235', 1);
  };

  // animated extras (plain DOM + CSS, drawn on top of the painted scene, used by the shop card AND the match)
  var fxDone = false;
  function fxCss() {
    if (fxDone) return; fxDone = true;
    var s = mk('style'); s.id = 'xo-fx-css';
    s.textContent =
      '.fx{position:absolute;inset:0;overflow:hidden;pointer-events:none}' +
      '.fx-lane{position:absolute;left:0;top:var(--y);width:100%;animation:fxSwim var(--d) linear infinite;animation-delay:var(--dl);will-change:transform}' +
      '.fx-lane.rev{animation-direction:reverse}.fx-lane.rev svg{transform:scaleX(-1)}' +
      '.fx-f{animation:fxBob 3.4s ease-in-out infinite alternate}' +
      '.fx-f svg{display:block;width:100%;height:auto}' +
      '.fx-rise{position:absolute;left:var(--x);top:0;width:var(--s);height:100%;animation:fxRise var(--d) linear infinite;animation-delay:var(--dl);will-change:transform}' +
      '.fx-rise.fall{animation-direction:reverse}' +
      '.fx-bub{display:block;width:100%;aspect-ratio:1;border-radius:50%;border:1.5px solid rgba(190,240,255,.75);background:rgba(190,240,255,.12)}' +
      '.fx-snow{display:block;width:100%;aspect-ratio:1;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff;animation:fxSway 3s ease-in-out infinite alternate}' +
      '.fx-rain{display:block;width:100%;height:7%;background:linear-gradient(rgba(var(--c),0),rgb(var(--c)));box-shadow:0 0 6px rgb(var(--c))}' +
      '.fx-drift{position:absolute;inset:0;animation:fxDrift var(--d) ease-in-out infinite alternate;animation-delay:var(--dl);will-change:transform}' +
      '.fx-fly{position:absolute;width:2.2%;aspect-ratio:1;border-radius:50%;background:rgb(var(--c));box-shadow:0 0 8px 3px rgba(var(--c),.7);animation:fxBlink 2.6s ease-in-out infinite;animation-delay:inherit}' +
      '.fx-lava{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(var(--c),.9),rgba(var(--c),0) 70%)}' +
      '.fx-cloud{display:block;aspect-ratio:2.4;background:radial-gradient(ellipse 22% 48% at 24% 62%,#fff 25%,rgba(255,255,255,0) 100%),radial-gradient(ellipse 28% 58% at 50% 42%,#fff 25%,rgba(255,255,255,0) 100%),radial-gradient(ellipse 22% 48% at 76% 62%,#fff 25%,rgba(255,255,255,0) 100%)}' +
      '.fx-bird{color:#12306b;animation:fxFlap .45s ease-in-out infinite alternate}.fx-bird svg{display:block;width:100%;height:auto}' +
      '.fx-jelly svg{display:block;width:100%;height:auto;transform-origin:50% 20%;animation:fxPulse 2.6s ease-in-out infinite}' +
      '@keyframes fxSwim{from{transform:translateX(-115%)}to{transform:translateX(115%)}}' +
      '@keyframes fxBob{from{transform:translateY(-35%)}to{transform:translateY(35%)}}' +
      '@keyframes fxRise{from{transform:translateY(105%)}to{transform:translateY(-105%)}}' +
      '@keyframes fxSway{from{transform:translateX(-160%)}to{transform:translateX(160%)}}' +
      '@keyframes fxDrift{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}' +
      '@keyframes fxBlink{0%,100%{opacity:.15}50%{opacity:1}}' +
      '@keyframes fxFlap{from{transform:scaleY(.45)}to{transform:scaleY(1)}}' +
      '@keyframes fxPulse{0%,100%{transform:scale(1,1)}50%{transform:scale(.86,1.12)}}' +
      '@media (prefers-reduced-motion:reduce){.fx *{animation:none!important}}';
    document.head.appendChild(s);
  }
  var FISH = '<svg viewBox="0 0 44 24" aria-hidden="true"><path d="M2 4L13 12 2 20Q6 12 2 4Z" fill="currentColor"/><path d="M8 12C14 1 30 1 38 12 30 23 14 23 8 12Z" fill="currentColor"/><path d="M16 6Q22 0 28 5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="10" r="1.8" fill="#06101a"/></svg>';
  var BIRD = '<svg viewBox="0 0 20 10" aria-hidden="true"><path d="M0 8Q5 0 10 7Q15 0 20 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var JELLY = '<svg viewBox="0 0 40 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5 26C5 2 35 2 35 26Q20 31 5 26Z" fill="currentColor" fill-opacity=".28"/><path d="M12 29q-4 9 0 16t0 15M20 31q-4 10 0 18t0 14M28 29q4 9 0 16t0 15" opacity=".8"/></svg>';

  // small = the little preview in the shop: fewer pieces, same look (keeps scrolling smooth)
  function makeFx(it, small) {
    var K = it.fx; if (!K) return null; fxCss();
    var R = rng(it.seed + 7), pal = it.pal, h = '', i, w;
    function N(n) { return small ? Math.max(2, Math.round(n * .55)) : n; }
    function P(i) { return pal[i % pal.length]; }
    function rise(n, cls, inner, sMin, sRng, dMin, dRng) {
      n = N(n);
      for (var j = 0; j < n; j++) h += '<div class="fx-rise' + cls + '" style="--x:' + (R() * 96) + '%;--s:' + (sMin + R() * sRng) + '%;--d:' + (dMin + R() * dRng) + 's;--dl:' + (-R() * (dMin + dRng)) + 's">' + inner(j) + '</div>';
    }
    function lane(y, d, rev, inner) { h += '<div class="fx-lane' + (rev ? ' rev' : '') + '" style="--y:' + y + '%;--d:' + d + 's;--dl:' + (-R() * d) + 's">' + inner + '</div>'; }
    if (K === 'fish') {
      for (i = 0; i < N(7); i++) { w = 15 + R() * 12; lane(14 + R() * 56, 14 + R() * 16, i % 2, '<div class="fx-f" style="width:' + w + '%;color:rgb(' + P(i) + ')">' + FISH + '</div>'); }
      rise(10, '', function () { return '<i class="fx-bub"></i>'; }, 2, 3, 7, 8);
    } else if (K === 'clouds') {
      for (i = 0; i < N(4); i++) lane(8 + R() * 60, 38 + R() * 30, 0, '<i class="fx-cloud" style="width:' + (28 + R() * 22) + '%"></i>');
      for (i = 0; i < N(3); i++) lane(10 + R() * 50, 13 + R() * 8, i % 2, '<div class="fx-bird" style="width:' + (5 + R() * 3) + '%">' + BIRD + '</div>');
    } else if (K === 'flies') {
      for (i = 0; i < N(16); i++) h += '<div class="fx-drift" style="--dx:' + (R() * 30 - 15) + '%;--dy:' + (R() * 30 - 15) + '%;--d:' + (5 + R() * 6) + 's;--dl:' + (-R() * 8) + 's"><i class="fx-fly" style="left:' + (8 + R() * 84) + '%;top:' + (8 + R() * 84) + '%;--c:' + P(i) + '"></i></div>';
    } else if (K === 'snow') {
      rise(24, ' fall', function () { return '<i class="fx-snow"></i>'; }, 1.2, 2.2, 6, 7);
    } else if (K === 'rain') {
      rise(22, ' fall', function (j) { return '<i class="fx-rain" style="--c:' + P(j) + '"></i>'; }, .5, .5, 1.1, 1.3);
    } else if (K === 'lava') {
      for (i = 0; i < N(6); i++) { w = 28 + R() * 22; h += '<div class="fx-drift" style="--dx:' + (R() * 50 - 25) + '%;--dy:' + (R() * 50 - 25) + '%;--d:' + (9 + R() * 8) + 's;--dl:' + (-R() * 10) + 's"><i class="fx-lava" style="left:' + (R() * (100 - w)) + '%;top:' + (R() * (100 - w)) + '%;width:' + w + '%;height:' + w + '%;--c:' + P(i) + '"></i></div>'; }
    } else if (K === 'jelly') {
      rise(5, '', function (j) { return '<div class="fx-jelly" style="color:rgb(' + P(j) + ')">' + JELLY + '</div>'; }, 11, 7, 20, 14);
    }
    var box = mk('div', 'fx'); box.innerHTML = h; return box;
  }

  [
    { id: 'snowfall', name: 'Snowfall',       blurb: 'Soft snow drifting down',                 price: 350,  rar: RR, accent: '#dfeaff', pal: ['255,255,255', '190,215,255'], bg: ['120,150,255', '200,220,255'], kind: 'soft', fx: 'snow', seed: 121, fade: 50, op: .9 },
    { id: 'rain',   name: 'Neon Rain',      blurb: 'Glowing cyan and pink rain',              price: 400,  rar: RR, accent: '#00f3ff', pal: ['0,243,255', '255,0,85', '188,19,254'], bg: ['40,20,110', '100,0,130'], kind: 'soft', fx: 'rain', seed: 123, fade: 48, op: .9, stars: 1 },
    { id: 'flies',  name: 'Firefly Night',  blurb: 'Fireflies blinking in a dark forest',     price: 450,  rar: RR, accent: '#b6ff3d', pal: ['190,255,60', '255,240,120', '0,255,102'], bg: ['10,70,40', '30,110,50'], kind: 'soft', fx: 'flies', seed: 127, fade: 45, op: .85, stars: 1 },
    { id: 'day',    name: 'Sunny Day',      blurb: 'Blue sky, bright sun, birds and clouds',  price: 500,  rar: RR, accent: '#ffd34d', pal: ['255,255,255'], kind: 'sky', fx: 'clouds', seed: 131, fade: 58, op: .95 },
    { id: 'lava',   name: 'Lava Lamp',      blurb: 'Neon blobs floating and merging',         price: 600,  rar: RE, accent: '#ff4fa0', pal: ['255,0,85', '255,140,0', '188,19,254', '0,243,255'], bg: ['60,0,70', '90,0,60'], kind: 'soft', fx: 'lava', seed: 137, fade: 50, op: .9 },
    { id: 'reef',   name: 'Neon Reef',      blurb: 'You are underwater, glowing fish swim by', price: 700, rar: RE, accent: '#00d4ff', pal: ['0,243,255', '255,0,85', '255,204,0', '0,255,102', '188,19,254'], kind: 'sea', fx: 'fish', seed: 141, fade: 55, op: .92 },
    { id: 'skybig', name: 'Open Sky', blurb: 'A huge daytime sky: the whole board floats among clouds, birds and balloons', price: 3200, rar: RL, accent: '#4db8ff', pal: ['255,255,255'], kind: 'full', full: 'sky', seed: 211, fade: 100, op: .96 },
    { id: 'deepsea', name: 'Ocean World', blurb: 'The whole board under the sea: fish, sharks, a whale, turtles and jellyfish', price: 4000, rar: MYTHIC, accent: '#00c8ff', pal: ['0,243,255'], kind: 'full', full: 'sea', seed: 223, fade: 100, op: .98 },
    { id: 'jelly',  name: 'Jellyfish Deep', blurb: 'Glowing jellyfish drifting up from the dark', price: 900, rar: RL, accent: '#7a5cff', pal: ['157,0,255', '0,243,255', '255,0,150'], bg: ['0,40,160', '60,0,160'], kind: 'soft', fx: 'jelly', seed: 143, fade: 52, op: .9, stars: 1 }
  ].forEach(function (it) { CATALOG.push(it); });

  CATALOG.sort(function (a, b) { return a.price - b.price; });
  CATALOG.forEach(function (c) { byId[c.id] = c; });

  /* ---------- BIG projectors: the whole screen becomes the scene ---------- */
  // Open Sky (daytime, clouds, sun, birds, balloons, a plane) and Ocean World (water, light rays, fish, sharks,
  // a whale, turtle, jellyfish, bubbles, seabed). Everything is plain DOM + CSS transforms (no canvas, no filters,
  // no backdrop blur), so it runs on the GPU compositor and costs almost nothing while a match is played.
  var fullCssDone = false;
  function fullCss() {
    if (fullCssDone) return; fullCssDone = true; fxCss();
    var s = mk('style'); s.id = 'xo-full-css';
    s.textContent =
      '.fs{position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:strict}' +
      '.fs-sky,.fs-sea{position:absolute;inset:0}' +
      '.fs-sky{background:linear-gradient(180deg,#2670f0 0%,#4f9dff 38%,#8fcdff 72%,#dff3ff 100%)}' +
      '.fs-sea{background:linear-gradient(180deg,#2cd6ff 0%,#0f8be0 30%,#0b52b8 62%,#071f5e 100%)}' +
      '.fs-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,10,50,.16),rgba(4,10,50,.32))}' +
      '.fs-sea+.fs-shade,.fs-shade.sea{background:linear-gradient(180deg,rgba(0,8,40,.10),rgba(0,6,34,.30))}' +
      /* sun */
      '.fs-sunw{position:absolute;right:-4%;top:-6%;width:52%;aspect-ratio:1;animation:fsGlow 7s ease-in-out infinite alternate}' +
      '.fs-glow{position:absolute;inset:-38%;border-radius:50%;background:radial-gradient(circle,rgba(255,244,190,.9) 0,rgba(255,226,140,.42) 28%,rgba(255,220,120,0) 62%)}' +
      '.fs-rays{position:absolute;inset:-85%;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.17) 0 5deg,rgba(255,255,255,0) 5deg 16deg);-webkit-mask-image:radial-gradient(circle,#000 0,transparent 56%);mask-image:radial-gradient(circle,#000 0,transparent 56%);animation:fsSpin 140s linear infinite;will-change:transform}' +
      '.fs-sun{position:absolute;inset:30%;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fffbe3,#ffe27a 68%,#ffc93c);box-shadow:0 0 38px 12px rgba(255,236,150,.85)}' +
      '.fs-trail{position:absolute;right:92%;top:46%;width:520%;height:7%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.7))}' +
      '.fs-pl{position:relative;width:7%}.fs-pl svg{display:block;width:100%;height:auto}.fs-pl .fs-trail{right:96%;width:620%}' +
      /* sea */
      '.fs-ray{position:absolute;top:-14%;height:96%;left:var(--x);width:var(--w);background:linear-gradient(180deg,rgba(215,252,255,.46),rgba(215,252,255,0) 88%);clip-path:polygon(34% 0,66% 0,100% 100%,0 100%);transform-origin:50% 0;transform:rotate(var(--r));opacity:.8}' +
      '.fs-raysg{position:absolute;inset:0;transform-origin:50% 0;animation:fsRayG 9s ease-in-out infinite alternate;will-change:transform}' +
      '.fs-caus{position:absolute;left:-30%;top:-4%;width:160%;height:46%;opacity:.55;background:repeating-radial-gradient(ellipse at 22% 38%,rgba(255,255,255,.16) 0 1.4%,rgba(255,255,255,0) 1.4% 6.5%);animation:fsCaus 26s ease-in-out infinite alternate;will-change:transform}' +
      '.fs-caus.b{top:6%;opacity:.38;background:repeating-radial-gradient(ellipse at 70% 52%,rgba(255,255,255,.15) 0 1.2%,rgba(255,255,255,0) 1.2% 7.5%);animation-duration:34s;animation-direction:alternate-reverse}' +
      '.fs-floor{position:absolute;left:0;right:0;bottom:0;height:17%;background:linear-gradient(180deg,rgba(215,180,115,0),rgba(214,178,112,.88) 42%,#b48c52)}' +
      '.fs-b{position:absolute;bottom:var(--b,0%);left:var(--x);width:var(--w)}.fs-b svg{display:block;width:100%;height:auto}' +
      '.fs-weed{transform-origin:50% 100%;animation:fsWeed var(--d) ease-in-out infinite alternate;animation-delay:var(--dl);will-change:transform}' +
      '.fs-crab{animation:fsCrab 16s ease-in-out infinite alternate;will-change:transform}' +
      '@keyframes fsSpin{to{transform:rotate(360deg)}}' +
      '@keyframes fsGlow{from{transform:scale(1)}to{transform:scale(1.05)}}' +
      '@keyframes fsRayG{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}' +
      '@keyframes fsCaus{from{transform:translateX(-7%)}to{transform:translateX(7%)}}' +
      '@keyframes fsWeed{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}' +
      '@keyframes fsCrab{from{transform:translateX(-90%)}to{transform:translateX(160%)}}' +
      '@media (prefers-reduced-motion:reduce){.fs *{animation:none!important}}';
    document.head.appendChild(s);
  }

  var SHARK = '<svg viewBox="0 -2 130 52" aria-hidden="true"><path d="M4 27C24 9 64 6 98 20L120 5 113 25 124 44 99 32C66 45 26 43 4 27Z" fill="#6b8399"/><path d="M4 27C26 43 66 45 99 32L113 25C70 34 30 33 4 27Z" fill="#dce8f1"/><path d="M52 14L66 -1 72 15Z" fill="#5a7288"/><path d="M60 35L50 49 76 37Z" fill="#5a7288"/><circle cx="26" cy="23" r="2.2" fill="#0a1830"/><path d="M34 24q2 4 0 8M40 24q2 4 0 8" stroke="#4a6074" stroke-width="1.2" fill="none"/></svg>';
  var WHALE = '<svg viewBox="0 0 240 100" aria-hidden="true"><path d="M6 48C24 14 96 6 158 26C182 33 204 28 232 8 228 32 222 46 204 56 224 60 236 70 240 86 218 78 202 68 180 66 124 98 28 90 6 48Z" fill="#3f6a96"/><path d="M10 54C40 88 124 96 180 66 140 76 60 76 10 54Z" fill="#a9c7e0"/><path d="M60 62Q84 74 110 70M70 68Q92 78 118 74" stroke="#7fa3c4" stroke-width="1.6" fill="none"/><circle cx="44" cy="46" r="3" fill="#0b1c34"/></svg>';
  var TURTLE = '<svg viewBox="0 0 80 52" aria-hidden="true"><path d="M26 14C18 4 6 6 4 12 12 18 20 18 26 14ZM26 38C18 48 6 46 4 40 12 34 20 34 26 38ZM48 12c4-8 12-10 16-6-2 6-8 8-16 6ZM48 40c4 8 12 10 16 6-2-6-8-8-16-6Z" fill="#7cc27f"/><ellipse cx="38" cy="26" rx="22" ry="16" fill="#4c9a5b"/><path d="M22 26h32M38 10v32M27 15l22 22M49 15L27 37" stroke="#2e6d3d" stroke-width="1.4" fill="none"/><path d="M58 22c8-4 16-1 18 5-6 5-14 4-18-1Z" fill="#7cc27f"/><circle cx="71" cy="25" r="1.6" fill="#0a1830"/></svg>';
  var CLOWN = '<svg viewBox="0 0 44 26" aria-hidden="true"><path d="M2 3L12 13 2 23Q6 13 2 3Z" fill="#ff7a1a"/><ellipse cx="25" cy="13" rx="17" ry="10" fill="#ff7a1a"/><path d="M18 3.4Q15 13 18 22.6M29 4Q26 13 29 22" stroke="#fff" stroke-width="3.2" fill="none"/><circle cx="35" cy="10.5" r="1.6" fill="#10203a"/></svg>';
  var TANG = '<svg viewBox="0 0 44 30" aria-hidden="true"><path d="M2 5L14 15 2 25Q7 15 2 5Z" fill="#ffd21f"/><ellipse cx="26" cy="15" rx="16" ry="12" fill="#1f6bff"/><path d="M14 12Q26 4 40 14" stroke="#0a2c8c" stroke-width="2" fill="none"/><path d="M18 20Q28 24 38 17" stroke="#7fd0ff" stroke-width="1.6" fill="none"/><circle cx="35" cy="12" r="1.7" fill="#fff"/><circle cx="35.4" cy="12" r=".8" fill="#0a1830"/></svg>';
  var WEED = '<svg viewBox="0 0 30 100" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M15 100C4 82 26 72 15 52 6 36 22 26 15 2" stroke="#1fae5c" stroke-width="5"/><path d="M6 100C0 88 12 82 7 68" stroke="#13924a" stroke-width="4"/><path d="M24 100C30 86 18 80 24 64" stroke="#2bd07a" stroke-width="4"/></svg>';
  var CORAL = '<svg viewBox="0 0 60 70" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" aria-hidden="true"><path d="M30 70V34M30 48L12 30M30 40L48 20M12 30V16M48 20V8M12 30L4 22"/></svg>';
  var CHEST = '<svg viewBox="0 0 50 38" aria-hidden="true"><rect x="3" y="14" width="44" height="22" rx="3" fill="#8a5a2b"/><path d="M3 18C3 4 47 4 47 18Z" fill="#a9712f"/><rect x="3" y="18" width="44" height="4" fill="#ffcc00"/><rect x="22" y="16" width="6" height="9" rx="1.5" fill="#ffe27a"/></svg>';
  var STAR = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2l5 13 14 1-11 9 4 14-12-8-12 8 4-14L1 16l14-1z" fill="#ff8a3d"/></svg>';
  var CRAB = '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M9 14L2 6M31 14L38 6M10 20L3 24M30 20L37 24" stroke="#ff4d3a" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="20" cy="16" rx="12" ry="8" fill="#ff4d3a"/><circle cx="3" cy="5" r="3.2" fill="#ff4d3a"/><circle cx="37" cy="5" r="3.2" fill="#ff4d3a"/><circle cx="15" cy="9" r="2" fill="#fff"/><circle cx="25" cy="9" r="2" fill="#fff"/><circle cx="15" cy="9" r=".9" fill="#111"/><circle cx="25" cy="9" r=".9" fill="#111"/></svg>';
  var BALLOON = '<svg viewBox="0 0 30 44" aria-hidden="true"><path d="M15 1C4 1 0 12 5 21c2 4 6 7 10 7s8-3 10-7C30 12 26 1 15 1Z" fill="#ff5a6a"/><path d="M15 1c-5 6-5 20 0 27 5-7 5-21 0-27Z" fill="#ffd34d"/><path d="M10 28l2 8h6l2-8" fill="none" stroke="#6b4a2a" stroke-width="1"/><rect x="11" y="36" width="8" height="6" rx="1.5" fill="#8a5a2b"/></svg>';
  var PLANE = '<svg viewBox="0 0 60 24" aria-hidden="true"><path d="M26 9L18 1 24 1 36 9ZM26 15L18 23 24 23 36 15Z" fill="#cfd9ee"/><path d="M2 12L14 9 44 9C54 9 58 11 58 12 58 13 54 15 44 15L14 15Z" fill="#f4f7ff"/><path d="M2 12L8 6 11 6 10 10Z" fill="#cfd9ee"/><rect x="40" y="10" width="10" height="2" fill="#6aa7ff"/></svg>';

  // small = the little preview in the shop (about half the pieces, same look)
  function makeFull(it, small) {
    fullCss();
    var R = rng(it.seed + 9), h = '', i, w;
    function N(n) { return small ? Math.max(1, Math.round(n * .5)) : n; }
    function lane(y, d, rev, inner, extra) { h += '<div class="fx-lane' + (rev ? ' rev' : '') + '" style="--y:' + y + '%;--d:' + d + 's;--dl:' + (-R() * d) + 's;' + (extra || '') + '">' + inner + '</div>'; }
    function fish(wid, color, svg) { return '<div class="fx-f" style="width:' + wid + '%;color:' + color + '">' + svg + '</div>'; }
    function rise(n, inner, s, sr, d, dr) {
      for (var j = 0; j < n; j++) h += '<div class="fx-rise" style="--x:' + (R() * 96) + '%;--s:' + (s + R() * sr) + '%;--d:' + (d + R() * dr) + 's;--dl:' + (-R() * (d + dr)) + 's">' + inner(j) + '</div>';
    }
    if (it.full === 'sky') {
      h += '<i class="fs-sky"></i><div class="fs-sunw"><i class="fs-glow"></i><i class="fs-rays"></i><i class="fs-sun"></i></div>';
      for (i = 0; i < N(5); i++) lane(3 + R() * 40, 95 + R() * 40, 0, '<i class="fx-cloud" style="width:' + (18 + R() * 10) + '%"></i>', 'opacity:.55');
      for (i = 0; i < N(4); i++) lane(14 + R() * 46, 58 + R() * 26, 0, '<i class="fx-cloud" style="width:' + (28 + R() * 14) + '%"></i>', 'opacity:.85');
      for (i = 0; i < N(2); i++) lane(48 + R() * 26, 38 + R() * 16, 0, '<i class="fx-cloud" style="width:' + (52 + R() * 20) + '%"></i>', 'opacity:.95');
      lane(11, 52, 0, '<div class="fs-pl">' + PLANE + '<i class="fs-trail"></i></div>');
      for (i = 0; i < N(4); i++) lane(8 + R() * 34, 14 + R() * 12, i % 2, '<div class="fx-bird" style="width:' + (3.5 + R() * 2) + '%">' + BIRD + '</div>');
      rise(N(2), function () { return '<div style="width:100%">' + BALLOON + '</div>'; }, 5.5, 2.5, 70, 30);
      h += '<i class="fs-shade"></i>';
    } else {
      h += '<i class="fs-sea"></i>';
      h += '<div class="fs-raysg">';
      for (i = 0; i < 6; i++) h += '<i class="fs-ray" style="--x:' + (4 + i * 17 + R() * 6) + '%;--w:' + (10 + R() * 9) + '%;--r:' + (-12 + R() * 14) + 'deg;--d:' + (6 + R() * 6) + 's;--dl:' + (-R() * 8) + 's"></i>';
      h += '</div>';
      h += '<i class="fs-caus"></i><i class="fs-caus b"></i>';
      // distant whale + far fish (small, faint)
      lane(30, 120, 0, '<div class="fx-f" style="width:46%;color:#fff;opacity:.5">' + WHALE + '</div>');
      for (i = 0; i < N(9); i++) lane(6 + R() * 56, 22 + R() * 16, i % 2, fish(4 + R() * 3, 'rgb(170,225,255)', FISH), 'opacity:.55');
      // schools: a few tiny fish travelling together
      for (i = 0; i < N(3); i++) {
        var sc = '', k, nf = small ? 4 : 7;
        for (k = 0; k < nf; k++) sc += '<div class="fx-f" style="position:absolute;left:' + (k * 11 + (k % 2) * 4) + '%;top:' + ((k * 37) % 60) + '%;width:9%;color:#d6f3ff;animation-delay:' + (-k * .4) + 's">' + FISH + '</div>';
        lane(14 + R() * 50, 20 + R() * 12, i % 2, '<div style="position:relative;width:15%;aspect-ratio:2/1">' + sc + '</div>');
      }
      // sharks, turtle
      lane(24, 44, 0, '<div class="fx-f" style="width:34%;opacity:.92">' + SHARK + '</div>');
      lane(50, 58, 1, '<div class="fx-f" style="width:26%;opacity:.92">' + SHARK + '</div>');
      lane(66, 80, 0, '<div class="fx-f" style="width:13%">' + TURTLE + '</div>');
      // colourful fish close to the camera
      var nearSvg = [CLOWN, TANG, FISH, CLOWN, TANG, FISH], nearCol = ['', '', 'rgb(0,243,255)', '', '', 'rgb(255,60,160)'];
      for (i = 0; i < N(6); i++) lane(12 + R() * 56, 13 + R() * 9, i % 2, fish(9 + R() * 5, nearCol[i], nearSvg[i]));
      rise(N(3), function (j) { return '<div class="fx-jelly" style="color:rgb(' + (j % 2 ? '255,120,220' : '140,220,255') + ');opacity:.85">' + JELLY + '</div>'; }, 8, 5, 26, 14);
      rise(N(14), function () { return '<i class="fx-bub"></i>'; }, 1.4, 2.2, 7, 8);
      // seabed
      h += '<i class="fs-floor"></i>';
      for (i = 0; i < N(9); i++) h += '<div class="fs-b fs-weed" style="--x:' + (R() * 92) + '%;--w:' + (4 + R() * 3.5) + '%;--b:' + (R() * 4) + '%;--d:' + (3 + R() * 3) + 's;--dl:' + (-R() * 4) + 's">' + WEED + '</div>';
      var cc = ['#ff5a8a', '#ff8a3d', '#b86bff', '#ff4fa0'];
      for (i = 0; i < N(4); i++) h += '<div class="fs-b" style="--x:' + (6 + R() * 84) + '%;--w:' + (5 + R() * 4) + '%;--b:' + (R() * 3) + '%;color:' + cc[i % 4] + '">' + CORAL + '</div>';
      h += '<div class="fs-b" style="--x:68%;--w:8%;--b:1.5%">' + CHEST + '</div><div class="fs-b" style="--x:30%;--w:4.5%;--b:.5%">' + STAR + '</div>';
      h += '<div class="fs-b" style="--x:0;--w:6%;--b:2%"><div class="fs-crab">' + CRAB + '</div></div>';
      h += '<i class="fs-shade sea"></i>';
    }
    var box = mk('div', 'fs'); box.innerHTML = h; return box;
  }

  function paintScene(it, S, game) {
    var cv = document.createElement('canvas'); cv.width = cv.height = S;
    var c = cv.getContext && cv.getContext('2d'); if (!c) return cv;
    try { PAINT[it.kind](c, S, rng(it.seed), it, !!game); } catch (e) {}
    c.globalCompositeOperation = 'source-over';
    return cv;
  }

  /* ------------------------------------------------------------------ *
   *  THE PROJECTOR (small white device, faces right)
   *  lens centre = (88%, 53%) of the drawing
   * ------------------------------------------------------------------ */
  function projectorSVG(accent) {
    var u = 'xp' + (++uidN);
    return '<svg viewBox="0 0 100 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="' + u + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9deec"/></linearGradient>' +
      '<radialGradient id="' + u + 'l" cx=".35" cy=".4" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="' + accent + '"/><stop offset="1" stop-color="#1a1030"/></radialGradient></defs>' +
      '<rect x="19" y="49" width="10" height="7" rx="2.5" fill="#bfc6d8"/><rect x="52" y="49" width="10" height="7" rx="2.5" fill="#bfc6d8"/>' +
      '<rect x="7" y="14" width="68" height="38" rx="13" fill="url(#' + u + 'b)" stroke="#c3c9db" stroke-width="1.2"/>' +
      '<path d="M19 25h24M19 31h24M19 37h24" stroke="#b6bdd1" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="58" cy="25" r="2.6" fill="' + accent + '"/><circle cx="58" cy="25" r="5" fill="' + accent + '" opacity=".25"/>' +
      '<rect x="72" y="21" width="12" height="26" rx="4" fill="#eef0f7" stroke="#c3c9db" stroke-width="1.2"/>' +
      '<rect x="82" y="19" width="6" height="30" rx="3" fill="#d3d8e6"/>' +
      '<ellipse cx="88" cy="34" rx="2.4" ry="10" fill="url(#' + u + 'l)"/></svg>';
  }

  /* ------------------------------------------------------------------ *
   *  IN-MATCH LAYER (behind the board, never blocks taps)
   * ------------------------------------------------------------------ */
  var layer = null, layerDone = false, playing = (MODE === 'game'), geo = null;

  function gameCss() {
    if (layerDone) return; layerDone = true;
    var s = mk('style'); s.id = 'xo-proj-css';
    s.textContent =
      '#xoProj{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}' +
      '#xoProj .xp-disc{position:absolute;border-radius:50%;opacity:var(--op,.62);-webkit-mask-image:radial-gradient(closest-side,#000 var(--fade),transparent 100%);mask-image:radial-gradient(closest-side,#000 var(--fade),transparent 100%);animation:xpBreath 9s ease-in-out infinite}' +
      '#xoProj .xp-scene{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease;contain:strict}' +
      '#xoProj.xp-lite .fs-caus,#xoProj.xp-lite .fx-rise:nth-child(2n),#xoProj.xp-lite .fx-lane:nth-child(3n){display:none}#xoProj.xp-lite .fs-raysg{animation:none}' +
      '#xoProj .xp-scene.in{opacity:var(--op,.95)}' +
      '#xoProj canvas{display:block;width:100%;height:100%;opacity:0;transition:opacity .9s ease;animation:xpSway 40s ease-in-out infinite alternate;will-change:transform}' +
      '#xoProj canvas.in{opacity:1}' +
      '#xoProj[data-k=galaxy] canvas{animation:xpSpin 240s linear infinite}' +
      '#xoProj .xp-beam{position:absolute;inset:0;animation:xpBeam 6s ease-in-out infinite}' +
      '#xoProj .xp-dev{position:absolute;filter:drop-shadow(0 0 10px rgba(255,255,255,.22));opacity:.95}' +
      '#xoProj .xp-dev svg{display:block;width:100%;height:auto}' +
      '#xoProj .xp-shelf{position:absolute;height:3px;border-radius:3px;background:rgba(255,255,255,.22)}' +
      '#xoProj .xp-tw{position:absolute;border-radius:50%;background:#fff;opacity:.2;animation:xpTw 4s ease-in-out infinite}' +
      '#xoProj .xp-shoot{position:absolute;left:var(--x);top:var(--y);width:130px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(255,255,255,0),#fff);opacity:0;transform:rotate(28deg);animation:xpShoot var(--d) linear infinite;animation-delay:var(--dl)}' +
      '@keyframes xpBreath{0%,100%{opacity:calc(var(--op,.62)*.8)}50%{opacity:var(--op,.62)}}' +
      '@keyframes xpSway{from{transform:scale(1) translate(0,0)}to{transform:scale(1.07) translate(1.5%,-1%)}}' +
      '@keyframes xpSpin{to{transform:rotate(360deg)}}' +
      '@keyframes xpBeam{0%,100%{opacity:.75}50%{opacity:1}}' +
      '@keyframes xpTw{0%,100%{opacity:.12;transform:scale(.8)}50%{opacity:.85;transform:scale(1.25)}}' +
      '@keyframes xpShoot{0%{opacity:0;transform:translate(0,0) rotate(28deg)}2%{opacity:1}11%{opacity:0;transform:translate(300px,160px) rotate(28deg)}100%{opacity:0;transform:translate(300px,160px) rotate(28deg)}}' +
      '@media (prefers-reduced-motion:reduce){#xoProj *{animation:none!important}}';
    document.head.appendChild(s);
  }

  function layoutLayer() {
    if (!layer || !geo) return;
    var W = window.innerWidth, H = window.innerHeight, m = Math.min(W, H);
    var d = Math.max(m * 1.05, 360), cx = W * .78, cy = H > W ? H * .14 : H * .26;
    var disc = $('.xp-disc', layer), dev = $('.xp-dev', layer), shelf = $('.xp-shelf', layer), beam = $('.xp-beam', layer);
    if (disc) { disc.style.width = disc.style.height = d + 'px'; disc.style.left = (cx - d / 2) + 'px'; disc.style.top = (cy - d / 2) + 'px'; }
    var pw = Math.max(54, Math.min(96, m * .13)), ph = pw * .64, x0 = 10, y0 = H * .86 - ph;
    dev.style.width = pw + 'px'; dev.style.left = x0 + 'px'; dev.style.top = y0 + 'px';
    shelf.style.left = (x0 - 4) + 'px'; shelf.style.width = (pw * 1.15) + 'px'; shelf.style.top = (y0 + ph * .88) + 'px';
    var lx = x0 + pw * .88, ly = y0 + ph * .53, vx = cx - lx, vy = cy - ly, len = Math.sqrt(vx * vx + vy * vy) || 1, nx = -vy / len, ny = vx / len, rr = d * .40;
    if (geo.full) {          // big projector: a soft cone that opens over the whole screen
      beam.style.clipPath = beam.style.webkitClipPath = 'polygon(' + lx + 'px ' + ly + 'px,0 0,' + W + 'px 0,' + W + 'px ' + H + 'px)';
      beam.style.background = 'radial-gradient(circle at ' + lx + 'px ' + ly + 'px,rgba(255,255,255,.2) 0,rgba(' + geo.rgb + ',.06) ' + (H * .55) + 'px,rgba(' + geo.rgb + ',0) ' + (H * 1.1) + 'px)';
      return;
    }
    beam.style.clipPath = beam.style.webkitClipPath = 'polygon(' + lx + 'px ' + ly + 'px,' + (cx + nx * rr) + 'px ' + (cy + ny * rr) + 'px,' + (cx - nx * rr) + 'px ' + (cy - ny * rr) + 'px)';
    beam.style.background = 'radial-gradient(circle at ' + lx + 'px ' + ly + 'px,rgba(255,255,255,.2) 0,rgba(' + geo.rgb + ',.07) ' + (len * .55) + 'px,rgba(' + geo.rgb + ',0) ' + (len * .93) + 'px)';
  }

  function unmountLayer() { if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; geo = null; }
  function mountLayer() {
    var id = equipped(), it = id && byId[id];
    if (!it || !document.body) { unmountLayer(); return; }
    if (layer && layer.getAttribute('data-id') === id) return;
    unmountLayer(); gameCss();
    geo = { rgb: hexRgb(it.accent), full: !!it.full };
    var mine = layer = mk('div'); layer.id = 'xoProj'; layer.setAttribute('aria-hidden', 'true'); layer.setAttribute('data-id', id); layer.setAttribute('data-k', it.kind);
    var disc = null, scene = null;
    if (it.full) { layer.setAttribute('data-full', '1'); scene = mk('div', 'xp-scene'); scene.style.setProperty('--op', it.op || .95); layer.appendChild(scene); }
    else { disc = mk('div', 'xp-disc'); disc.style.setProperty('--fade', it.fade + '%'); disc.style.setProperty('--op', it.op || .62); layer.appendChild(disc); }
    layer.appendChild(mk('div', 'xp-beam'));
    layer.appendChild(mk('div', 'xp-shelf'));
    layer.appendChild(mk('div', 'xp-dev', projectorSVG(it.accent)));
    var R = rng(it.seed + 100), i;
    for (i = 0; i < (it.full ? 0 : 20); i++) {
      var t = mk('i', 'xp-tw'), sz = 1.5 + R() * 2;
      t.style.cssText = 'left:' + (R() * 100) + '%;top:' + (R() * 100) + '%;width:' + sz + 'px;height:' + sz + 'px;animation-delay:' + (-R() * 4) + 's;animation-duration:' + (3 + R() * 4) + 's';
      layer.appendChild(t);
    }
    if (it.kind === 'galaxy' || it.kind === 'aurora') {
      [[18, 6, 13, 0], [55, 14, 17, 7]].forEach(function (p) {
        var sh = mk('i', 'xp-shoot'); sh.style.cssText = '--x:' + p[0] + '%;--y:' + p[1] + '%;--d:' + p[2] + 's;--dl:' + p[3] + 's';
        layer.appendChild(sh);
      });
    }
    document.body.appendChild(layer);
    layer.style.display = playing ? '' : 'none';
    layoutLayer();
    // the big scene is painted a moment later and fades in, so the page itself never stutters while it loads
    setTimeout(function () {
      if (layer !== mine) return;
      if (it.full) {
        scene.appendChild(makeFull(it, false)); requestAnimationFrame(function () { scene.classList.add('in'); });
        // weak phones: if the first seconds run slowly, quietly drop the extras (same scene, fewer moving parts)
        setTimeout(function () {
          if (layer !== mine) return;
          var n = 0, last = 0, ds = [];
          (function f(t) {
            if (layer !== mine) return;
            if (last) ds.push(t - last); last = t;
            if (++n < 45) { requestAnimationFrame(f); return; }
            ds.sort(function (a, b) { return a - b; });
            if (ds[ds.length >> 1] > 30) layer.classList.add('xp-lite');
          })(0);
        }, 2500);
        return;
      }
      var cv = paintScene(it, 768, true); disc.appendChild(cv);
      var fxm = makeFx(it, false); if (fxm) disc.appendChild(fxm);
      requestAnimationFrame(function () { cv.classList.add('in'); });
    }, 60);
  }
  var rsT = 0;
  window.addEventListener('resize', function () { cancelAnimationFrame(rsT); rsT = requestAnimationFrame(layoutLayer); });

  function setPlaying(on) {
    playing = !!on;
    if (pill) pill.style.display = playing ? 'none' : '';
    if (playing && !layer) mountLayer();
    if (layer) { layer.style.display = playing ? '' : 'none'; if (playing) layoutLayer(); }
  }

  /* ------------------------------------------------------------------ *
   *  COIN COUNTER (+ shop button on the main menu)
   * ------------------------------------------------------------------ */
  var pill = null, modal = null, lastBal = null;
  var pillCssDone = false;
  function pillCss() {
    if (pillCssDone) return; pillCssDone = true; baseCss();
    var s = mk('style'); s.id = 'xo-shop-pill';
    s.textContent =
      (MODE === 'shop' ? ':root{--xs-top:68px;--xs-right:12px}' : '') +
      '#xsPill{position:fixed;top:calc(var(--xs-top,14px) + env(safe-area-inset-top,0px));right:var(--xs-right,14px);z-index:200;height:36px;display:flex;align-items:center;gap:7px;padding:0 13px 0 6px;border-radius:50px;border:2px solid #ffcc00;background:rgba(14,10,6,.55);color:#ffcc00;font:800 13px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:1px;pointer-events:none;box-shadow:0 0 16px rgba(255,204,0,.22);transition:top .28s ease,right .28s ease}' +
      '#xsPill .xs-coin{width:22px;height:22px}' +
      '#xsShopBtn{position:fixed;top:20px;left:72px;z-index:200;width:42px;height:42px;flex:none;padding:0;display:grid;place-items:center;border-radius:50%;border:2px solid #ffcc00;background:rgba(255,204,0,.06);color:#ffcc00;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:background .25s,color .25s,box-shadow .25s,transform .25s;box-shadow:0 0 16px rgba(255,204,0,.22)}' +
      '#xsShopBtn svg{width:24px;height:24px;filter:drop-shadow(0 0 4px currentColor)}' +
      '#xsShopBtn:hover,#xsShopBtn:focus-visible{background:#ffcc00;color:#000;box-shadow:0 0 28px #ffcc00;transform:scale(1.08);outline:none}' +
      '#xsShopBtn:hover svg,#xsShopBtn:focus-visible svg{filter:none}';
    document.head.appendChild(s);
  }

  var SHOP_ICON = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 12l2.5-7h21L29 12"/><path d="M11.7 5v7M20.3 5v7"/>' +
    '<path d="M3 12a4.33 4.33 0 0 0 8.67 0 4.33 4.33 0 0 0 8.66 0 4.33 4.33 0 0 0 8.67 0"/>' +
    '<path d="M5 15.5V27h22V15.5"/><path d="M13 27v-7h6v7"/></svg>';

  function mountPill() {
    if (pill || !document.body) return; pillCss();
    pill = mk('div', '', COIN + '<span class="xs-n">0</span>');
    pill.id = 'xsPill'; pill.setAttribute('role', 'status'); pill.setAttribute('aria-label', 'Your coins');
    document.body.appendChild(pill);
    if (MODE === 'shop') {
      var sb = mk('button', '', SHOP_ICON);
      sb.id = 'xsShopBtn'; sb.type = 'button'; sb.title = 'Shop'; sb.setAttribute('aria-label', 'Open the projector shop'); sb.onclick = openShop;
      document.body.appendChild(sb);
      idle(buildModal);                       // build the shop window while the menu is idle, so the first tap opens it instantly
    }
    if (playing) pill.style.display = 'none';
    refreshBalance();
  }

  function tween(elm, from, to) {
    if (from === to || !window.requestAnimationFrame) { elm.textContent = fmt(to); return; }
    var t0 = null;
    (function f(t) {
      if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / 500);
      elm.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(f);
    })(performance.now());
  }
  function refreshBalance() {
    var n = coins();
    var a = pill && $('.xs-n', pill), b = modal && $('.xs-bal b', modal);
    if (a) a.textContent = fmt(n);
    if (b) tween(b, lastBal == null ? n : lastBal, n);
    lastBal = n;
  }

  /* ------------------------------------------------------------------ *
   *  SHOP WINDOW
   *  Smoothness: the window is built once while idle; each preview is painted
   *  only when it scrolls near the screen (one per frame); previews that are
   *  off screen are paused; no full-screen blur; opening/closing is a short
   *  opacity + slide transition.
   * ------------------------------------------------------------------ */
  var shopCssDone = false, confirmId = null, confirmT = 0, scenes = {}, io = null, io2 = null, observed = false, paintQ = [], painting = false;

  function shopCss() {
    if (shopCssDone) return; shopCssDone = true; pillCss();
    var s = mk('style'); s.id = 'xo-shop-css';
    s.textContent =
      '#xsModal{position:fixed;inset:0;z-index:99990;visibility:hidden;opacity:0;background:radial-gradient(circle at 50% 0,#1b1038 0,#06050f 62%,#04040a 100%);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;font-family:"Segoe UI",system-ui,sans-serif;color:#fff;transition:opacity .22s ease,visibility 0s linear .22s}' +
      '#xsModal.open{visibility:visible;opacity:1;transition:opacity .22s ease}' +
      '#xsModal:not(.open) *{animation-play-state:paused!important}' +
      '.xs-sheet{max-width:1000px;margin:0 auto;padding:20px 16px 40px;transform:translateY(18px);transition:transform .34s cubic-bezier(.2,.8,.2,1)}' +
      '#xsModal.open .xs-sheet{transform:none}' +
      '.xs-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}' +
      '.xs-head h2{margin:0;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;text-shadow:0 0 14px #9d00ff}' +
      '.xs-head p{margin:4px 0 0;font-size:13px;opacity:.6}' +
      '.xs-sp{flex:1;min-width:0}' +
      '.xs-bal{display:flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:50px;border:2px solid #ffcc00;color:#ffcc00;font-weight:900;font-size:17px;white-space:nowrap}' +
      '.xs-bal .xs-coin{width:26px;height:26px}' +
      '.xs-x{width:42px;height:42px;flex:none;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-size:18px;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}' +
      '.xs-x:hover,.xs-x:focus-visible{border-color:#fff;background:rgba(255,255,255,.12);transform:scale(1.1);outline:none}' +
      '.xs-grid{display:grid;gap:16px;grid-template-columns:repeat(3,1fr)}' +
      '@media (max-width:759px){.xs-grid{grid-template-columns:repeat(2,1fr);gap:12px}.xs-head h2{font-size:18px}.xs-head p{display:none}.xs-info h3{font-size:14px}.xs-btn{font-size:12px;letter-spacing:.6px}}' +
      '@media (max-width:339px){.xs-grid{grid-template-columns:1fr}}' +
      '.xs-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:10px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.1);transition:border-color .3s}' +
      '#xsModal.open .xs-card{animation:xsCardIn .4s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*28ms)}' +
      '@keyframes xsCardIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
      '.xs-card:hover{border-color:rgba(var(--acrgb),.6)}' +
      '.xs-card.eq{border-color:#00ff66}' +
      '.xs-card:not(.live) *{animation-play-state:paused!important}' +
      '#xsModal.sc .xs-card *{animation-play-state:paused!important}' +
      '.xs-card{contain:layout paint style}' +
      '#xsModal .xs-card.pop{animation:xsPop .6s ease-out}' +
      '@keyframes xsPop{0%{transform:scale(1)}35%{transform:scale(1.04)}100%{transform:scale(1)}}' +
      '.xs-stage{position:relative;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:radial-gradient(120% 100% at 82% 50%,rgba(var(--acrgb),.16),transparent 70%),linear-gradient(180deg,#0d0c22,#07071a);border:1px solid rgba(255,255,255,.06);contain:layout paint}' +
      '.xs-shelf{position:absolute;left:2%;width:34%;top:62%;height:3px;border-radius:3px;background:rgba(255,255,255,.2)}' +
      '.xs-dev{position:absolute;left:3%;width:32%;top:50%;transform:translateY(-53%);filter:drop-shadow(0 0 8px rgba(255,255,255,.25));z-index:3}' +
      '.xs-dev svg{display:block;width:100%;height:auto}' +
      '.xs-beam{position:absolute;left:31%;right:3%;top:6%;bottom:6%;clip-path:polygon(0 49%,100% 0,100% 100%,0 51%);background:linear-gradient(90deg,rgba(255,255,255,.5),rgba(var(--acrgb),.2) 55%,rgba(var(--acrgb),0) 100%);z-index:1}' +
      '.xs-disc{position:absolute;right:3%;top:4%;width:57.5%;aspect-ratio:1;border-radius:50%;-webkit-mask-image:radial-gradient(closest-side,#000 var(--fade),transparent 100%);mask-image:radial-gradient(closest-side,#000 var(--fade),transparent 100%);z-index:2;opacity:0;transition:opacity .5s ease}' +
      '.xs-card.ready .xs-disc{opacity:1}' +
      '.xs-card[data-full] .xs-disc{left:0;right:0;top:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0;-webkit-mask-image:none;mask-image:none}' +
      '.xs-card[data-full] .xs-beam{display:none}' +
      '.xs-disc canvas{display:block;width:100%;height:100%;animation:xsBob 8s ease-in-out infinite alternate;will-change:transform}' +
      '.xs-card[data-k=galaxy] .xs-disc canvas{animation:xsSpin 90s linear infinite}' +
      '@keyframes xsBob{from{transform:scale(1)}to{transform:scale(1.08)}}' +
      '@keyframes xsSpin{to{transform:rotate(360deg)}}' +
      '.xs-rar{position:absolute;top:8px;left:8px;z-index:4;padding:2px 8px;border-radius:20px;border:1px solid var(--rc);color:var(--rc);background:rgba(0,0,0,.4);font-size:9px;font-weight:800;letter-spacing:1.2px}' +
      '.xs-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:2px 8px}' +
      '.xs-info h3{margin:0;font-size:15px;font-weight:800}' +
      '.xs-price{display:flex;align-items:center;gap:5px;color:#ffcc00;font-weight:900;font-size:14px}' +
      '.xs-price .xs-coin{width:20px;height:20px}' +
      '.xs-price.own{color:#00ff66;font-size:10px;letter-spacing:1.2px}' +
      '.xs-info p{margin:3px 0 0;font-size:12px;opacity:.6;line-height:1.35}' +
      '.xs-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 8px;border-radius:50px;border:2px solid #ffcc00;background:rgba(255,255,255,.03);color:#ffcc00;font:800 13px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:background .2s,color .2s,border-color .2s,transform .12s}' +
      '.xs-btn:active{transform:scale(.97)}' +
      '.xs-btn:hover,.xs-btn:focus-visible{background:#ffcc00;color:#000;outline:none}' +
      '.xs-btn.poor{border-color:rgba(255,255,255,.22);color:rgba(255,255,255,.55)}' +
      '.xs-btn.poor:hover,.xs-btn.poor:focus-visible{background:transparent;color:rgba(255,255,255,.55)}' +
      '.xs-btn.sure{border-color:#ff0055;color:#fff;background:#ff0055}' +
      '.xs-btn.own{border-color:#00ff66;color:#00ff66}' +
      '.xs-btn.own:hover,.xs-btn.own:focus-visible{background:#00ff66;color:#000}' +
      '.xs-btn.on{border-color:#00ff66;background:#00ff66;color:#000}' +
      '.xs-shake{animation:xsShake .4s}' +
      '@keyframes xsShake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}' +
      '.xs-note{margin:22px 0 0;text-align:center;font-size:12px;line-height:1.6;opacity:.55}' +
      '.xs-note b{color:#ffcc00}' +
      '@media (prefers-reduced-motion:reduce){#xsModal *{animation:none!important;transition:none!important}}';
    document.head.appendChild(s);
  }

  // ---- previews are painted lazily, one per frame, nearest-to-screen first ----
  function paintCard(card) {
    var it = byId[card.getAttribute('data-id')], host = $('.xs-disc', card);
    if (it.full) host.appendChild(makeFull(it, true));
    else {
      host.appendChild(scenes[it.id] || (scenes[it.id] = paintScene(it, 256, false)));
      var fx = makeFx(it, true); if (fx) host.appendChild(fx);
    }
    card._painted = true; card.classList.add('ready');
  }
  function pump() {
    var c = paintQ.shift();
    if (!c) { painting = false; return; }
    if (!c._painted) paintCard(c);
    requestAnimationFrame(pump);
  }
  function queuePaint(card) {
    if (card._painted || card._queued) return; card._queued = true; paintQ.push(card);
    if (!painting) { painting = true; requestAnimationFrame(pump); }
  }
  function observeCards() {
    if (observed || !modal) return; observed = true;
    var cards = modal.querySelectorAll('.xs-card');
    if (!('IntersectionObserver' in window)) { [].forEach.call(cards, function (c) { c.classList.add('live'); queuePaint(c); }); return; }
    // two observers: cards are painted a little before they arrive, but only the ones really on screen animate
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) queuePaint(e.target); });
    }, { root: modal, rootMargin: '320px 0px' });
    io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('live', e.isIntersecting); });
    }, { root: modal, rootMargin: '0px' });
    [].forEach.call(cards, function (c) { io.observe(c); io2.observe(c); });
    // everything holds still while the page is being scrolled, and resumes a moment after the finger lifts
    var scT = 0;
    modal.addEventListener('scroll', function () {
      if (!modal.classList.contains('sc')) modal.classList.add('sc');
      clearTimeout(scT); scT = setTimeout(function () { modal.classList.remove('sc'); }, 140);
    }, { passive: true });
  }

  function buildModal() {
    if (modal) return;
    shopCss();
    modal = mk('div'); modal.id = 'xsModal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'xsT');
    var h = '<div class="xs-sheet"><div class="xs-head"><div class="xs-sp"><h2 id="xsT">Projector shop</h2><p>Equip one and it lights up the wall behind every match.</p></div>' +
      '<div class="xs-bal" title="Your coins">' + COIN + '<b>0</b></div><button class="xs-x" type="button" aria-label="Close">&#10005;</button></div><div class="xs-grid">';
    CATALOG.forEach(function (it, i) {
      h += '<article class="xs-card" data-id="' + it.id + '" data-k="' + it.kind + '"' + (it.full ? ' data-full="1"' : '') + ' style="--i:' + Math.min(i, 8) + ';--ac:' + it.accent + ';--acrgb:' + hexRgb(it.accent) + ';--fade:' + it.fade + '%;--rc:' + it.rar[1] + '">' +
        '<div class="xs-stage"><span class="xs-rar">' + it.rar[0] + '</span><div class="xs-shelf"></div><div class="xs-dev">' + projectorSVG(it.accent) + '</div><div class="xs-beam"></div><div class="xs-disc"></div></div>' +
        '<div class="xs-info"><div class="xs-row"><h3>' + esc(it.name) + '</h3><span class="xs-price"></span></div><p>' + esc(it.blurb) + '</p></div><button class="xs-btn" type="button"></button></article>';
    });
    h += '</div><p class="xs-note">Win a match: <b>+' + REWARDS.win + '</b> coins. Get promoted in the League: <b>+' + REWARDS.promotion + '</b> coins.<br>Projectors only show during matches.</p></div>';
    modal.innerHTML = h;
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('.xs-x')) { closeShop(); return; }
      var btn = e.target.closest('.xs-btn'); if (!btn) return;
      onAction(btn.closest('.xs-card').getAttribute('data-id'), btn);
    });
    document.body.appendChild(modal);
    updateCards(); refreshBalance();
  }

  function updateCards() {
    if (!modal) return;
    var w = readShop();
    CATALOG.forEach(function (it) {
      var card = $('.xs-card[data-id="' + it.id + '"]', modal), btn = $('.xs-btn', card), pr = $('.xs-price', card);
      var own = w.o.indexOf(it.id) > -1, on = w.e === it.id, html, cls = 'xs-btn', title = '';
      if (on) { cls += ' on'; html = 'Equipped'; title = 'Tap to take it off'; }
      else if (own) { cls += ' own'; html = 'Equip'; }
      else if (confirmId === it.id) { cls += ' sure'; html = 'Tap again to buy'; }
      else if (w.c < it.price) { cls += ' poor'; html = 'Need ' + fmt(it.price - w.c) + ' more'; }
      else { html = 'Buy'; }
      var sig = [on, own, confirmId === it.id, own ? 0 : (w.c < it.price ? it.price - w.c : -1)].join('|');
      if (card._sig === sig) return; card._sig = sig;          // nothing changed on this card: leave the DOM alone
      card.classList.toggle('eq', on);
      pr.className = 'xs-price' + (own ? ' own' : ''); pr.innerHTML = own ? 'OWNED' : COIN + it.price;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.title = title;
      btn.className = cls; btn.innerHTML = html;
    });
  }

  function onAction(id, btn) {
    var w = readShop(), it = byId[id], card = btn.closest('.xs-card');
    if (w.o.indexOf(id) > -1) { equip(w.e === id ? null : id); confirmId = null; return; }
    if (w.c < it.price) {
      btn.classList.remove('xs-shake'); void btn.offsetWidth; btn.classList.add('xs-shake');
      toast({ warn: true, text: 'Need ' + fmt(it.price - w.c) + ' more coins' }); return;
    }
    if (confirmId !== id) {
      confirmId = id; clearTimeout(confirmT); confirmT = setTimeout(function () { confirmId = null; updateCards(); }, 3200); updateCards(); return;
    }
    clearTimeout(confirmT); confirmId = null;
    if (buy(id).ok) {
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      toast({ coin: true, text: it.name + ' unlocked and equipped' });
    }
  }

  function onKey(e) { if (e.key === 'Escape') closeShop(); }
  function openShop() {
    if (!modal) buildModal();
    confirmId = null; lastBal = null; refreshBalance(); updateCards();
    modal.scrollTop = 0;
    // next frame: lets the browser apply the closed state first so the slide/fade actually animates
    requestAnimationFrame(function () {
      modal.classList.add('open');
      observeCards();
    });
    document.addEventListener('keydown', onKey);
    var x = $('.xs-x', modal); if (x) setTimeout(function () { try { x.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function closeShop() {
    if (!modal) return; modal.classList.remove('open'); confirmId = null; clearTimeout(confirmT);
    document.removeEventListener('keydown', onKey); var sbn = $('#xsShopBtn'); if (sbn) sbn.focus({ preventScroll: true });
  }

  subs.push(function () { refreshBalance(); updateCards(); });

  /* ------------------------------------------------------------------ *
   *  public API + start-up
   * ------------------------------------------------------------------ */
  window.XOShop = {
    catalog: CATALOG, rewards: REWARDS,
    coins: coins, owns: owns, equipped: equipped, addCoins: addCoins, buy: buy, equip: equip,
    promotion: rewardPromotion, win: rewardWin, toast: toast,
    setPlaying: setPlaying, openShop: openShop, closeShop: closeShop,
    refresh: function () { refreshBalance(); updateCards(); if (MODE !== 'shop' && MODE !== 'menu') mountLayer(); }
  };

  function boot() {
    hookAuth();
    if (MODE === 'shop' || MODE === 'menu' || MODE === 'manual') {
      mountPill();
      // the profile bar pulls the cloud save a moment after load: update the number when it is done
      try { new MutationObserver(function () { if (!document.documentElement.classList.contains('xo-wait')) refreshBalance(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
      window.addEventListener('pageshow', refreshBalance);
      window.addEventListener('focus', refreshBalance);
      window.addEventListener('storage', refreshBalance);
      setTimeout(refreshBalance, 4000);
    }
    if (MODE === 'game' || MODE === 'manual') {
      mountLayer();
      window.addEventListener('pageshow', function () { mountLayer(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', hookAuth);
})();
