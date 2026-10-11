/* ==========================================================================
   xo-splash.js  -  Ultimate XO launch screen for the installed app (PWA).

   Shows the app icon (static, exactly where the phone's own launch screen
   puts it, so there is no second "icon entrance") with a neon circle being
   drawn under it and a straight blade slicing through it, for 3 seconds,
   then fades into the page. It only runs when the game is opened as an installed
   app (display-mode: standalone) and only once per app session, so normal
   browser visits and in-app navigation are never delayed.

   Put it FIRST in <head> of every page that can be an entry point:
       <script src="xo-splash.js"></script>

   Test it in a normal browser tab:   index.html?splash=1
   ========================================================================== */
(function () {
  'use strict';

  var TOTAL = 3000;        // how long the screen stays (ms), including the fade
  var FADE = 320;          // fade-out at the end (ms)
  var ICON = 'icon-512.png';

  /* ---------- should it run? ---------- */
  var force = /[?&]splash(=1|=true)?(&|$)/.test(location.search || '');
  var standalone = false;
  try {
    standalone = window.navigator.standalone === true ||
      (window.matchMedia && (matchMedia('(display-mode: standalone)').matches ||
                             matchMedia('(display-mode: fullscreen)').matches ||
                             matchMedia('(display-mode: minimal-ui)').matches));
  } catch (e) {}
  if (!standalone && !force) return;
  try {
    if (!force && sessionStorage.getItem('xo_splash') === '1') return;   // already shown in this app session
    sessionStorage.setItem('xo_splash', '1');
  } catch (e) {}

  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var root = document.documentElement;
  // NOTE: no background is put on <html> (it would hide the page's own z-index:-1 backgrounds, e.g. the web in index.html)

  /* ---------- geometry of the loader: a circle drawn clockwise, then a straight blade cuts through it ---------- */
  var R = 34, TILT = -14, CIRC = 2 * Math.PI * R, X0 = -96, X1 = 96;
  var BG = '#05060a';

  var css = document.createElement('style');
  css.textContent =
    '#xoSplash{position:fixed;inset:0;z-index:2147483600;background:' + BG + ';overflow:hidden;' +
      'transition:opacity ' + FADE + 'ms ease-out}' +
    '#xoSplash.out{opacity:0}' +
    '#xoSplash{--is:min(46vw,34vh,230px)}' +
    '#xoSplash .sp-glow{position:absolute;left:50%;top:50%;width:150vmin;height:150vmin;margin:-75vmin 0 0 -75vmin;border-radius:50%;opacity:0;' +
      'background:radial-gradient(circle,rgba(157,0,255,.2) 0,rgba(0,243,255,.07) 34%,transparent 62%);animation:spGlow 1.2s .2s ease-out forwards}' +
    /* the icon is centred and never animates: it is the same picture the phone showed a moment ago */
    '#xoSplash .sp-icon{position:absolute;left:50%;top:50%;width:var(--is);height:var(--is);transform:translate(-50%,-50%);border-radius:22%;display:block;-webkit-user-drag:none;user-select:none}' +
    '#xoSplash .sp-o{position:absolute;left:50%;top:calc(50% + var(--is) / 2 + 6px);width:190px;height:190px;margin-left:-95px;overflow:visible;' +
      'filter:drop-shadow(0 0 4px rgba(0,243,255,.9)) drop-shadow(0 0 12px rgba(120,80,255,.8)) drop-shadow(0 0 26px rgba(188,19,254,.5))}' +
    '#xoSplash .sp-o *{fill:none;stroke-linecap:round}' +
    '@keyframes spGlow{to{opacity:1}}';
  (document.head || root).appendChild(css);

  var el = document.createElement('div');
  el.id = 'xoSplash'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="sp-glow"></div><img class="sp-icon" src="' + ICON + '" alt="" draggable="false">' +
    '<svg class="sp-o" viewBox="-95 -95 190 190" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="spG" gradientUnits="userSpaceOnUse" x1="-60" y1="-50" x2="60" y2="50">' +
      '<stop offset="0" stop-color="#00f3ff"/><stop offset=".5" stop-color="#b86bff"/><stop offset="1" stop-color="#ff2f8d"/></linearGradient></defs>' +
      '<g id="spAll">' +
        '<circle r="' + R + '" stroke="#9d6bff" stroke-opacity=".18" stroke-width="3.6"/>' +
        '<circle id="spC" r="' + R + '" stroke="url(#spG)" stroke-width="4.6" transform="rotate(-90)" stroke-dasharray="0 ' + CIRC.toFixed(1) + '"/>' +
        '<circle id="spHd" r="3.6" fill="#fff" stroke="none" opacity="0" cx="0" cy="' + (-R) + '"/>' +
        '<g transform="rotate(' + TILT + ')">' +
          '<line id="spBar" x1="' + (-R) + '" y1="0" x2="' + (-R) + '" y2="0" stroke="url(#spG)" stroke-width="3.8" opacity="0"/>' +
          '<line id="spT1" x1="0" y1="0" x2="0" y2="0" stroke="#b86bff" stroke-width="6" stroke-opacity=".28"/>' +
          '<line id="spT2" x1="0" y1="0" x2="0" y2="0" stroke="#00f3ff" stroke-width="3.6" stroke-opacity=".6"/>' +
          '<line id="spT3" x1="0" y1="0" x2="0" y2="0" stroke="#fff" stroke-width="2.6"/>' +
          '<circle id="spS1" r="5" stroke="#fff" stroke-width="1.6" cx="' + (-R) + '" cy="0" opacity="0"/>' +
          '<circle id="spS2" r="5" stroke="#fff" stroke-width="1.6" cx="' + R + '" cy="0" opacity="0"/>' +
        '</g>' +
      '</g></svg>';
  root.appendChild(el);

  /* ---------- animation (plain rAF, driven by the clock so it always ends with the 3 second timer) ---------- */
  var $ = function (id) { return el.querySelector('#' + id); };
  var all = $('spAll'), c = $('spC'), hd = $('spHd'), bar = $('spBar'), t1 = $('spT1'), t2 = $('spT2'), t3 = $('spT3'), s1 = $('spS1'), s2 = $('spS2');
  var t0 = null, done = false, raf = 0, CYCLES = 2, CYCLE = (TOTAL - FADE) / CYCLES;
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function outCubic(v) { return 1 - Math.pow(1 - v, 3); }
  function inOut(v) { return v * v * (3 - 2 * v); }
  function seg(l, x1, x2) { l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y1', 0); l.setAttribute('y2', 0); }
  function draw(t) {                               // t = 0..1 inside one cycle
    var p = outCubic(cl(t / .5)), k = inOut(cl((t - .5) / .3)), hx = X0 + (X1 - X0) * k, a;
    c.setAttribute('stroke-dasharray', (CIRC * p).toFixed(1) + ' ' + CIRC.toFixed(1));
    a = -Math.PI / 2 + 2 * Math.PI * p;
    hd.setAttribute('cx', (R * Math.cos(a)).toFixed(1)); hd.setAttribute('cy', (R * Math.sin(a)).toFixed(1));
    hd.setAttribute('opacity', (p > 0.01 && p < 0.995) ? 1 : 0);
    // the blade: bright head with a tapering tail, travelling in a straight line from outside, through the circle, to outside
    if (k > 0 && k < 1) { seg(t1, Math.max(X0, hx - 78), hx); seg(t2, Math.max(X0, hx - 52), hx); seg(t3, Math.max(X0, hx - 26), hx); }
    else { seg(t1, 0, 0); seg(t2, 0, 0); seg(t3, 0, 0); }
    // what the blade leaves inside the circle: the bar of the "e"
    if (hx > -R && k > 0) { seg(bar, -R, Math.min(R, hx)); bar.setAttribute('opacity', 1); } else bar.setAttribute('opacity', 0);
    // sparks where the blade meets the circle
    var d1 = cl(1 - Math.abs(hx + R) / 16), d2 = cl(1 - Math.abs(hx - R) / 16);
    s1.setAttribute('opacity', k > 0 && k < 1 ? d1 : 0); s1.setAttribute('r', (4 + 10 * (1 - d1)).toFixed(1));
    s2.setAttribute('opacity', k > 0 && k < 1 ? d2 : 0); s2.setAttribute('r', (4 + 10 * (1 - d2)).toFixed(1));
    all.setAttribute('opacity', t > .9 ? cl((1 - t) / .1) : 1);     // clean fade between repeats
  }
  function frame(now) {
    if (done) return;
    if (t0 === null) t0 = now;
    var e = now - t0;
    draw(e >= CYCLE * CYCLES ? .5 : (e % CYCLE) / CYCLE);
    raf = requestAnimationFrame(frame);
  }
  if (reduce) { draw(.82); TOTAL = 1500; } else { draw(0); raf = requestAnimationFrame(frame); }

  function finish() {
    if (done) return; done = true; cancelAnimationFrame(raf);
    if (el.parentNode) el.parentNode.removeChild(el);
    if (css.parentNode) css.parentNode.removeChild(css);
  }
  setTimeout(function () { el.classList.add('out'); }, TOTAL - FADE);
  setTimeout(finish, TOTAL + 80);
  window.addEventListener('pagehide', finish);
})();
