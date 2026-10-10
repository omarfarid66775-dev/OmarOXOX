/* ==========================================================================
   xo-splash.js  -  Ultimate XO launch screen for the installed app (PWA).

   Shows the app icon with a neon "O" drawn under it for 3 seconds, then
   fades into the page. It only runs when the game is opened as an installed
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
  try { root.style.background = '#05060a'; } catch (e) {}

  /* ---------- the drawn O: a line swoops in from outside, circles the ring, leaves on the other side ---------- */
  var R = 30, K = 1.35, SWEEP = Math.PI * 3, TH0 = Math.PI * 0.8, N = 420;
  function smoother(t) { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); }
  function pathData() {
    var d = '', i, u, th, r, k;
    for (i = 0; i <= N; i++) {
      u = i / N; th = TH0 + SWEEP * u;
      k = u < 0.5 ? 1 - smoother(u / 0.3) : smoother((u - 0.7) / 0.3);
      r = R * (1 + K * k);
      d += (i ? 'L' : 'M') + (r * Math.cos(th)).toFixed(1) + ' ' + (r * Math.sin(th)).toFixed(1);
    }
    return d;
  }
  // [dash length, opacity]: stacked so the comet is brightest at its head and fades along its tail
  var LAYERS = [[520, .22, 2.4], [400, .34, 3], [290, .5, 3.7], [190, .68, 4.4], [110, .85, 5.1], [55, 1, 5.8], [20, 1, 5.8]];   // [dash length, opacity, width]: thin faint tail, thick bright head
  var PL = 1000;           // path is normalised to length 1000

  var css = document.createElement('style');
  css.textContent =
    '#xoSplash{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;' +
      'background:radial-gradient(120% 90% at 50% 38%,#170a33 0%,#07060f 58%,#05060a 100%);overflow:hidden;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' +
      'transition:opacity ' + FADE + 'ms ease-out,transform ' + FADE + 'ms ease-out}' +
    '#xoSplash.out{opacity:0;transform:scale(1.035)}' +
    '#xoSplash .sp-glow{position:absolute;left:50%;top:40%;width:150vmin;height:150vmin;margin:-75vmin 0 0 -75vmin;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(157,0,255,.22) 0,rgba(0,243,255,.08) 34%,transparent 62%);animation:spGlow 3s ease-in-out infinite alternate}' +
    '#xoSplash .sp-stack{position:relative;display:flex;flex-direction:column;align-items:center;margin-top:-4vh}' +
    '#xoSplash .sp-icon{width:min(46vw,34vh,230px);height:auto;aspect-ratio:1;border-radius:22%;display:block;-webkit-user-drag:none;user-select:none;' +
      'box-shadow:0 0 0 1px rgba(255,255,255,.07),0 0 60px rgba(157,0,255,.38),0 24px 50px rgba(0,0,0,.6);' +
      'animation:spIcon .55s cubic-bezier(.2,1.2,.35,1) both,spBreath 2.4s .55s ease-in-out infinite alternate}' +
    '#xoSplash .sp-o{width:190px;height:190px;margin-top:-10px;overflow:visible;opacity:0;animation:spFade .5s .25s ease-out forwards;' +
      'filter:drop-shadow(0 0 4px rgba(0,243,255,.9)) drop-shadow(0 0 12px rgba(120,80,255,.8)) drop-shadow(0 0 26px rgba(188,19,254,.5))}' +
    '#xoSplash .sp-o path{fill:none;stroke-linecap:round;stroke-linejoin:round}' +
    '@keyframes spIcon{from{opacity:0;transform:scale(.82) translateY(10px)}to{opacity:1;transform:none}}' +
    '@keyframes spBreath{from{transform:scale(1)}to{transform:scale(1.025)}}' +
    '@keyframes spFade{to{opacity:1}}' +
    '@keyframes spGlow{from{opacity:.7;transform:scale(.96)}to{opacity:1;transform:scale(1.04)}}' +
    '@media (prefers-reduced-motion:reduce){#xoSplash .sp-glow,#xoSplash .sp-icon{animation:none}}';
  (document.head || root).appendChild(css);

  var el = document.createElement('div');
  el.id = 'xoSplash'; el.setAttribute('aria-hidden', 'true');
  var svg = '<svg class="sp-o" viewBox="-95 -95 190 190" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="spG" gradientUnits="userSpaceOnUse" x1="-60" y1="-50" x2="60" y2="50">' +
    '<stop offset="0" stop-color="#00f3ff"/><stop offset=".5" stop-color="#b86bff"/><stop offset="1" stop-color="#ff2f8d"/></linearGradient></defs>' +
    '<circle r="' + R + '" fill="none" stroke="#9d6bff" stroke-opacity=".2" stroke-width="3.4"/>';   // the O itself (dim), the comet draws over it
  var d = pathData(), i;
  for (i = 0; i < LAYERS.length; i++) {
    svg += '<path class="sp-l" d="' + d + '" pathLength="' + PL + '" stroke="' + (i === LAYERS.length - 1 ? '#ffffff' : 'url(#spG)') + '" stroke-width="' + LAYERS[i][2] + '" stroke-opacity="' + LAYERS[i][1] +
           '" stroke-dasharray="' + LAYERS[i][0] + ' 3000" stroke-dashoffset="' + LAYERS[i][0] + '"/>';
  }
  svg += '</svg>';
  el.innerHTML = '<div class="sp-glow"></div><div class="sp-stack"><img class="sp-icon" src="' + ICON + '" alt="" draggable="false">' + svg + '</div>';
  root.appendChild(el);

  /* ---------- animation (plain rAF: works everywhere, stays in sync with the 3 second timer) ---------- */
  var paths = el.querySelectorAll('.sp-l'), t0 = null, done = false, raf = 0;
  var CYCLES = 2, CYCLE = (TOTAL - FADE) / CYCLES;
  function ease(t) { return .55 * t + .45 * t * t * (3 - 2 * t); }   // keeps moving: soft start and end, quick through the ring
  function frame(now) {
    if (done) return;
    if (t0 === null) t0 = now;
    var el_ = now - t0, c = (el_ % CYCLE) / CYCLE, head = ease(c) * (PL + LAYERS[0][0]), j;
    if (el_ >= CYCLE * CYCLES) c = 0, head = 0;
    for (j = 0; j < paths.length; j++) paths[j].style.strokeDashoffset = (LAYERS[j][0] - head).toFixed(1);
    raf = requestAnimationFrame(frame);
  }
  if (reduce) {
    for (i = 0; i < paths.length; i++) paths[i].style.strokeDashoffset = (LAYERS[i][0] - PL * .6).toFixed(1);
    TOTAL = 1500;
  } else {
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (done) return; done = true; cancelAnimationFrame(raf);
    if (el.parentNode) el.parentNode.removeChild(el);
    if (css.parentNode) css.parentNode.removeChild(css);
  }
  setTimeout(function () { el.classList.add('out'); }, TOTAL - FADE);
  setTimeout(finish, TOTAL + 80);
  window.addEventListener('pagehide', finish);
})();
