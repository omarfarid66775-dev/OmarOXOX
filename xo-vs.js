/* ==========================================================================
   xo-vs.js  -  Ultimate XO "VS" screen shown before a match.

   Load it AFTER auth.js on every page that starts a match:
       <script src="auth.js"></script>
       <script src="xo-vs.js"></script>

   It replaces XOAuth.vs, so the pages keep calling the same function:
       XOAuth.vs({ me, opp, sub, mode, ms })        // returns a Promise (tap to skip)
   me / opp : { name, av, photo, tag, sym, entrance, color }
       av        avatar code ("a:..."), an emoji, or "photo" (then `photo` is used)
       sym       "X" or "O" - small badge on the portrait (optional)
       entrance  id of an entrance style (see below). Default: "classic"
       color     override the accent colour of that side (optional)
   mode "xo" shows a big X against a big O instead of portraits.

   ENTRANCE STYLES (for the shop)
   Every player brings their own style, so each side of the screen can look
   different. A style is only a name, an accent colour and some CSS scoped to
   `.st-<id>`. To add one, anywhere after this file loads:

       XOVS.register({
         id: 'mystyle', name: 'My style', color: '#ff8800',
         css: '.st-mystyle .vs-frame{ ... }  .st-mystyle .vs-card{ animation-name: ... }'
       });

   The player's equipped style is read from  p.entrance, or for "me" from
   XOShop.equippedEntrance() when the shop provides it. Built-in presets:
   classic, glitch, inferno, royal.   Preview them: XOVS.preview('glitch', 'royal')
   ========================================================================== */
(function () {
  'use strict';
  if (window.XOVS) return;

  var A = window.XOAuth;
  var orig = A && A.vs && !A.vs.__xovs ? A.vs : null;   // auth.js's own VS, kept only to draw character avatars

  /* ------------------------------------------------------------------ helpers */
  function esc(t) { return String(t == null ? '' : t).replace(/[<>&"'`]/g, ''); }
  function hexRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return '255,255,255';
    return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  }
  function okColor(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? c : ''; }
  // a photo comes from the other player's device: accept only a plain base64 image, nothing that could break out of the attribute
  function validPhoto(p) {
    p = String(p || '');
    return p.length < 400000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(p) ? p : '';
  }

  /* ------------------------------------------------------------------ avatars */
  var charCache = {};
  function charSvg(code) {      // ask auth.js to draw a character avatar (it owns the drawing code)
    if (!/^a:[0-9a-z]{8,13}$/.test(code)) return '';
    if (charCache[code] != null) return charCache[code];
    var out = '';
    if (orig) {
      try {
        var prev = document.getElementById('xoVS'); if (prev) prev.remove();
        orig({ me: { name: 'x', av: code }, opp: { name: 'y' }, ms: 1 });
        var o = document.getElementById('xoVS'), a = o && o.querySelector('.vs-av');
        out = a ? a.innerHTML : '';
        if (o) o.remove();
      } catch (e) { out = ''; }
    }
    return (charCache[code] = out);
  }
  function portrait(p, glyph) {
    if (glyph) return '<span class="vs-glyph">' + esc(glyph) + '</span>';
    var av = String(p.av || ''), ph = validPhoto(p.photo), s;
    if (ph && (av === 'photo' || !av)) return '<img src="' + ph + '" alt="" decoding="async" draggable="false">';
    if (/^a:/.test(av) && (s = charSvg(av))) return s;
    if (av && av !== 'photo' && !/^a:/.test(av)) return '<span class="vs-emo">' + esc(av) + '</span>';
    return '<span class="vs-ini">' + esc(String(p.name || '?').charAt(0).toUpperCase()) + '</span>';
  }

  /* ------------------------------------------------------------------ entrance styles */
  var STYLES = {};
  var styleCss = {};          // css already injected, by style id
  function register(def) {
    if (!def || !/^[a-z0-9_-]{1,20}$/.test(def.id || '')) return false;
    STYLES[def.id] = { id: def.id, name: def.name || def.id, color: okColor(def.color), css: def.css || '' };
    if (styleCss[def.id]) { var old = document.getElementById('xoVSs-' + def.id); if (old) old.remove(); delete styleCss[def.id]; }
    return true;
  }
  function useStyle(id) {
    var st = STYLES[id] || STYLES.classic;
    if (st.css && !styleCss[st.id] && document.head) {
      var e = document.createElement('style'); e.id = 'xoVSs-' + st.id; e.textContent = st.css; document.head.appendChild(e); styleCss[st.id] = 1;
    }
    return st;
  }

  register({ id: 'classic', name: 'Classic', color: '', css: '' });

  register({ id: 'glitch', name: 'Glitch', color: '#00ff9c', css:
    '.st-glitch .vs-card{animation:vsGlitchIn .95s .3s steps(1,end) both,vsFloat 3.4s 1.4s ease-in-out infinite alternate}' +
    '@keyframes vsGlitchIn{0%{opacity:0;transform:translateX(-34px) skewX(22deg)}10%{opacity:1;transform:translateX(20px) skewX(-14deg)}20%{opacity:.2;transform:translateX(-9px)}30%{opacity:1;transform:translateX(7px) skewX(6deg)}45%{opacity:.35;transform:none}55%{opacity:1}70%{opacity:.7;transform:translateX(-3px)}100%{opacity:1;transform:none}}' +
    '.st-glitch .vs-panel:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px)}' +
    '.st-glitch .vs-n{text-shadow:2px 0 #ff2f6d,-2px 0 #00f3ff;animation:vsGlitchTxt 2.4s 1.4s infinite}' +
    '@keyframes vsGlitchTxt{0%,91%,100%{transform:none}92%{transform:translateX(4px)}94%{transform:translateX(-4px) skewX(-8deg)}96%{transform:translateX(2px)}}' +
    '.st-glitch .vs-frame{border-radius:6%;background:conic-gradient(from 0deg,#00ff9c,#00f3ff,#ff2f6d,#00ff9c)}.st-glitch .vs-ph{border-radius:4%}' +
    '.st-glitch .vs-shine{background:linear-gradient(105deg,transparent 35%,rgba(0,255,156,.5) 50%,transparent 65%)}' });

  register({ id: 'inferno', name: 'Inferno', color: '#ff6a1f', css:
    '.st-inferno .vs-card{animation:vsFireIn .85s .3s cubic-bezier(.2,.9,.3,1.1) both,vsFloat 3s 1.3s ease-in-out infinite alternate}' +
    '@keyframes vsFireIn{0%{opacity:0;transform:translateY(120px) scale(.6)}65%{opacity:1;transform:translateY(-8px) scale(1.05)}100%{opacity:1;transform:none}}' +
    '.st-inferno .vs-frame{background:conic-gradient(from 200deg,#ff3d00,#ffd54a,#ff6a1f,#ff3d00);animation:vsFlame 1.1s ease-in-out infinite alternate}' +
    '@keyframes vsFlame{from{box-shadow:0 0 0 1px rgba(255,255,255,.2),0 0 30px rgba(255,90,0,.55),0 20px 44px rgba(0,0,0,.6)}to{box-shadow:0 0 0 1px rgba(255,255,255,.3),0 0 70px rgba(255,140,0,.85),0 20px 44px rgba(0,0,0,.6)}}' +
    '.st-inferno .vs-fx i{animation-duration:calc(var(--d)*.55)!important}.st-inferno .vs-fx i:nth-child(3n){background:#ffd54a;box-shadow:0 0 9px #ffb300}' +
    '.st-inferno .vs-panel{background:radial-gradient(80% 60% at 50% 90%,rgba(255,90,0,.5),rgba(255,60,0,.12) 60%,transparent 100%),linear-gradient(180deg,#160806,#07060f)}' });

  register({ id: 'royal', name: 'Royal', color: '#ffcc00', css:
    '.st-royal .vs-card{animation:vsRoyalIn 1s .3s cubic-bezier(.2,.8,.2,1) both,vsFloat 3.6s 1.5s ease-in-out infinite alternate}' +
    '@keyframes vsRoyalIn{0%{opacity:0;transform:scale(1.55);filter:blur(10px)}100%{opacity:1;transform:none;filter:none}}' +
    '.st-royal .vs-frame{background:conic-gradient(from 160deg,#ffe27a,#b8860b,#fff3b0,#d4a017,#ffe27a)}' +
    '.st-royal .vs-frame:before{content:"\\1F451";position:absolute;left:50%;top:-.62em;z-index:3;font-size:calc(var(--sz)*.26);line-height:1;transform:translateX(-50%) rotate(-6deg);filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))}' +
    '.st-royal .vs-fx i{border-radius:0;transform:rotate(45deg);animation-name:vsTwinkle!important}' +
    '@keyframes vsTwinkle{0%,100%{opacity:0;scale:.3}50%{opacity:1;scale:1.2}}' +
    '.st-royal .vs-n{letter-spacing:3px;background:linear-gradient(180deg,#fff7c9,#ffcc00);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 8px rgba(255,204,0,.55))}' });

  /* ------------------------------------------------------------------ css */
  var BASE_CSS = "@layer xovs{\n" + [
    "#xoVSX{position:fixed;inset:0;z-index:100000;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;background:#05060a;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:manipulation;--sz:min(52vw,27vh,300px)}",
    "#xoVSX *{box-sizing:border-box}",
    "#xoVSX .vs-bg{position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 50%,#1b0e3b 0%,#09061a 62%,#05060a 100%)}",
    "#xoVSX .vs-grid{position:absolute;inset:-40px;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px;-webkit-mask-image:radial-gradient(closest-side,#000,transparent);mask-image:radial-gradient(closest-side,#000,transparent);animation:vsGrid 14s linear infinite}",
    "#xoVSX .vs-stage{position:absolute;inset:0}",
    "#xoVSX:not(.go) .vs-stage,#xoVSX:not(.go) .vs-sub,#xoVSX:not(.go) .vs-hint{opacity:0}",
    /* the two halves */
    "#xoVSX .vs-side{position:absolute;inset:0;will-change:transform}",
    "#xoVSX .vs-side.a{--from:translateY(-104%);--cx:50%;--cy:25%;clip-path:polygon(0 0,100% 0,100% 43%,0 57%)}",
    "#xoVSX .vs-side.b{--from:translateY(104%);--cx:50%;--cy:76%;clip-path:polygon(0 57%,100% 43%,100% 100%,0 100%)}",
    "#xoVSX .vs-panel{position:absolute;inset:0;background:radial-gradient(75% 55% at 50% 45%,rgba(var(--cr),.46),rgba(var(--cr),.12) 58%,rgba(var(--cr),0) 100%),linear-gradient(180deg,#0f0a22,#07060f)}",
    "#xoVSX .vs-side.b .vs-panel{background:radial-gradient(75% 55% at 50% 58%,rgba(var(--cr),.46),rgba(var(--cr),.12) 58%,rgba(var(--cr),0) 100%),linear-gradient(0deg,#0f0a22,#07060f)}",
    "#xoVSX .vs-panel:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.04) 0 2px,transparent 2px 16px)}",
    "#xoVSX .vs-fx{position:absolute;inset:0;overflow:hidden;pointer-events:none}",
    "#xoVSX .vs-fx i{position:absolute;bottom:-12px;left:var(--x);width:var(--s);height:var(--s);border-radius:50%;background:var(--c);box-shadow:0 0 9px var(--c);opacity:0;animation:vsRise var(--d) linear var(--dl) infinite}",
    /* portrait card */
    "#xoVSX .vs-card{position:absolute;left:var(--cx);top:var(--cy);width:var(--sz);margin-left:calc(var(--sz)/-2);margin-top:calc(var(--sz)*-.66);display:flex;flex-direction:column;align-items:center;gap:calc(var(--sz)*.075)}",
    "#xoVSX .vs-frame{position:relative;width:var(--sz);height:var(--sz);flex:none;border-radius:24%;padding:max(3px,calc(var(--sz)*.024));background:conic-gradient(from 210deg,var(--c),#fff 22%,var(--c) 46%,rgba(var(--cr),.45) 72%,var(--c));box-shadow:0 0 0 1px rgba(255,255,255,.2),0 0 calc(var(--sz)*.24) rgba(var(--cr),.6),0 20px 44px rgba(0,0,0,.6)}",
    "#xoVSX .vs-ph{position:relative;width:100%;height:100%;border-radius:21%;overflow:hidden;background:linear-gradient(135deg,#2a1560,#0d5560);display:grid;place-items:center}",
    "#xoVSX .vs-ph img,#xoVSX .vs-ph svg{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}",
    "#xoVSX .vs-ph:after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,0) 38%);pointer-events:none}",
    "#xoVSX .vs-emo{font-size:calc(var(--sz)*.56);line-height:1}",
    "#xoVSX .vs-ini{font:900 calc(var(--sz)*.5)/1 'Segoe UI',sans-serif;color:#fff;text-shadow:0 4px 20px rgba(0,0,0,.4)}",
    "#xoVSX .vs-glyph{font:900 calc(var(--sz)*.66)/1 'Arial Black',Impact,sans-serif;color:var(--c);text-shadow:0 0 20px var(--c),0 0 56px var(--c)}",
    "#xoVSX .vs-xo .vs-ph{background:radial-gradient(circle at 50% 40%,rgba(var(--cr),.22),#0a0816 75%)}",
    "#xoVSX .vs-shine{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}",
    "#xoVSX .vs-shine:after{content:'';position:absolute;top:-10%;bottom:-10%;width:45%;left:-60%;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.5) 50%,transparent 70%);transform:skewX(-14deg)}",
    "#xoVSX .vs-sym{position:absolute;right:-5%;bottom:-5%;width:26%;aspect-ratio:1;border-radius:50%;background:#0a0818;border:max(2px,calc(var(--sz)*.012)) solid var(--c);display:grid;place-items:center;font:900 calc(var(--sz)*.15)/1 'Arial Black',Impact,sans-serif;color:var(--c);box-shadow:0 0 16px rgba(var(--cr),.75);z-index:2}",
    "#xoVSX .vs-plate{display:flex;flex-direction:column;align-items:center;gap:calc(var(--sz)*.03);width:calc(var(--sz)*1.12)}",
    "#xoVSX .vs-n{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:900;font-size:clamp(15px,calc(var(--sz)*.115),32px);letter-spacing:.06em;text-transform:uppercase;text-shadow:0 0 18px rgba(var(--cr),.9),0 2px 0 rgba(0,0,0,.4)}",
    "#xoVSX .vs-t{font-size:clamp(10px,calc(var(--sz)*.058),13px);letter-spacing:.22em;font-weight:700;color:rgba(255,255,255,.62)}",
    "#xoVSX .vs-bar{height:3px;width:58%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--c),transparent);box-shadow:0 0 12px var(--c);transform-origin:50% 50%}",
    /* center */
    "#xoVSX .vs-seam{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;filter:drop-shadow(0 0 5px #bc13fe) drop-shadow(0 0 16px rgba(188,19,254,.8))}",
    "#xoVSX .vs-seam line{stroke:#fff;stroke-width:2.2px;vector-effect:non-scaling-stroke}",
    "#xoVSX .vs-seam .l{display:none}",
    "#xoVSX .vs-mid{position:absolute;left:50%;top:50%;width:0;height:0;z-index:6;pointer-events:none}",
    "#xoVSX .vs-vs{position:absolute;left:0;top:0;transform:translate(-50%,-50%) rotate(-5deg);font:900 italic clamp(3.4rem,17vmin,8rem)/1 'Arial Black',Impact,'Segoe UI',sans-serif;letter-spacing:-.04em;color:#fff;white-space:nowrap;text-shadow:.045em .045em 0 rgba(255,47,109,.95),-.045em -.045em 0 rgba(18,200,217,.95),0 0 .35em rgba(188,19,254,.95),0 0 .9em rgba(188,19,254,.6)}",
    "#xoVSX .vs-ring{position:absolute;left:0;top:0;width:20vmin;height:20vmin;margin:-10vmin 0 0 -10vmin;border-radius:50%;border:3px solid #fff;opacity:0;box-shadow:0 0 24px #bc13fe,inset 0 0 24px #bc13fe}",
    "#xoVSX .vs-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:8}",
    "#xoVSX .vs-sub{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 16px);z-index:7;text-align:center;font-size:clamp(10px,2.9vmin,13px);font-weight:800;letter-spacing:.42em;text-transform:uppercase;color:rgba(255,255,255,.72);padding:0 16px;pointer-events:none}",
    "#xoVSX .vs-sub span{display:inline-block;padding:0 .4em;position:relative}",
    "#xoVSX .vs-sub span:before,#xoVSX .vs-sub span:after{content:'';position:absolute;top:50%;width:clamp(16px,6vw,46px);height:1px;background:rgba(255,255,255,.35)}",
    "#xoVSX .vs-sub span:before{right:100%;margin-right:.6em}#xoVSX .vs-sub span:after{left:100%;margin-left:.6em}",
    "#xoVSX .vs-hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:7;text-align:center;font-size:10px;letter-spacing:.4em;font-weight:700;color:#fff;pointer-events:none}",
    /* landscape: halves side by side */
    "@media (orientation:landscape){",
    "#xoVSX{--sz:min(25vw,47vh,300px)}",
    "#xoVSX .vs-side.a{--from:translateX(-104%);--cx:25%;--cy:52%;clip-path:polygon(0 0,56% 0,44% 100%,0 100%)}",
    "#xoVSX .vs-side.b{--from:translateX(104%);--cx:75%;--cy:52%;clip-path:polygon(56% 0,100% 0,100% 100%,44% 100%)}",
    "#xoVSX .vs-panel,#xoVSX .vs-side.b .vs-panel{background:radial-gradient(60% 75% at 50% 50%,rgba(var(--cr),.46),rgba(var(--cr),.12) 58%,rgba(var(--cr),0) 100%),linear-gradient(90deg,#0f0a22,#07060f)}",
    "#xoVSX .vs-seam .p{display:none}#xoVSX .vs-seam .l{display:inline}",
    "}",
    /* timeline (everything waits for .go so the portraits are decoded before anything moves) */
    "#xoVSX.go{animation:vsIn .25s ease-out both}",
    "#xoVSX.go .vs-side.a,#xoVSX.go .vs-side.b{animation:vsSideIn .62s .04s cubic-bezier(.2,.9,.25,1) both}",
    "#xoVSX.go .vs-card{animation:vsCardIn .75s .3s cubic-bezier(.2,1.1,.3,1) both,vsFloat 3.4s 1.3s ease-in-out infinite alternate}",
    "#xoVSX .vs-side.a .vs-card{--rot:-7deg}#xoVSX .vs-side.b .vs-card{--rot:7deg}",
    "#xoVSX.go .vs-plate{animation:vsWipeA .5s .8s cubic-bezier(.2,.8,.2,1) both}",
    "#xoVSX.go .vs-side.b .vs-plate{animation-name:vsWipeB}",
    "#xoVSX.go .vs-bar{animation:vsBar .6s 1s ease-out both}",
    "#xoVSX.go .vs-shine:after{animation:vsShine .9s 1.25s ease-in-out both}",
    "#xoVSX.go .vs-seam{animation:vsFade .35s .3s ease-out both}",
    "#xoVSX.go .vs-vs{animation:vsSlam .55s .95s cubic-bezier(.2,1.4,.35,1) both}",
    "#xoVSX.go .vs-ring{animation:vsRing .85s .95s ease-out both}",
    "#xoVSX.go .vs-flash{animation:vsFlash .55s .95s ease-out both}",
    "#xoVSX.go .vs-stage{animation:vsShake .5s .95s ease-out}",
    "#xoVSX.go .vs-sub{animation:vsFade .5s .6s both}",
    "#xoVSX.go .vs-hint{animation:vsHint .6s 1.9s both}",
    "#xoVSX.out{animation:vsOut .42s ease-in both}",
    "#xoVSX.out .vs-side.a,#xoVSX.out .vs-side.b{animation:vsSideOut .42s cubic-bezier(.55,0,.85,.3) both}",
    "#xoVSX.out .vs-vs{animation:vsVsOut .3s ease-in both}",
    "@keyframes vsIn{from{opacity:0}to{opacity:1}}",
    "@keyframes vsOut{from{opacity:1}to{opacity:0}}",
    "@keyframes vsFade{from{opacity:0}to{opacity:1}}",
    "@keyframes vsHint{from{opacity:0}to{opacity:.4}}",
    "@keyframes vsSideIn{from{transform:var(--from)}to{transform:none}}",
    "@keyframes vsSideOut{from{transform:none}to{transform:var(--from)}}",
    "@keyframes vsCardIn{0%{opacity:0;transform:translateY(34px) scale(.68) rotate(var(--rot))}62%{opacity:1;transform:translateY(-5px) scale(1.04) rotate(0)}100%{opacity:1;transform:none}}",
    "@keyframes vsFloat{to{transform:translateY(-6px)}}",
    "@keyframes vsWipeA{from{clip-path:inset(-30px 100% -30px -30px)}to{clip-path:inset(-30px -30px -30px -30px)}}",
    "@keyframes vsWipeB{from{clip-path:inset(-30px -30px -30px 100%)}to{clip-path:inset(-30px -30px -30px -30px)}}",
    "@keyframes vsBar{from{transform:scaleX(0)}to{transform:none}}",
    "@keyframes vsShine{from{left:-60%}to{left:130%}}",
    "@keyframes vsSlam{0%{opacity:0;transform:translate(-50%,-50%) rotate(-16deg) scale(3.6)}60%{opacity:1;transform:translate(-50%,-50%) rotate(-3deg) scale(.88)}100%{opacity:1;transform:translate(-50%,-50%) rotate(-5deg) scale(1)}}",
    "@keyframes vsVsOut{to{opacity:0;transform:translate(-50%,-50%) rotate(-5deg) scale(1.6)}}",
    "@keyframes vsRing{from{opacity:.95;transform:scale(.25)}to{opacity:0;transform:scale(4.4)}}",
    "@keyframes vsFlash{from{opacity:.55}to{opacity:0}}",
    "@keyframes vsShake{0%,100%{transform:none}14%{transform:translate(-8px,5px)}29%{transform:translate(7px,-6px)}44%{transform:translate(-5px,-3px)}59%{transform:translate(4px,4px)}79%{transform:translate(-2px,1px)}}",
    "@keyframes vsRise{0%{opacity:0;transform:translateY(0)}12%{opacity:.9}100%{opacity:0;transform:translateY(-78vh)}}",
    "@keyframes vsGrid{to{transform:translate(40px,40px)}}",
    "@media (prefers-reduced-motion:reduce){#xoVSX *,#xoVSX{animation-duration:.01s!important;animation-delay:0s!important}}"
  ].join("\n") + "\n}";   // in a cascade layer: entrance styles (unlayered) always win, whatever their specificity

  /* ------------------------------------------------------------------ build + show */
  function particles(n, seed) {
    var h = '', i, r = seed;
    function rnd() { r = (r * 16807) % 2147483647; return r / 2147483647; }
    for (i = 0; i < n; i++) {
      h += '<i style="--x:' + (rnd() * 96).toFixed(1) + '%;--s:' + (2 + rnd() * 3.4).toFixed(1) + 'px;--d:' + (3.2 + rnd() * 3.6).toFixed(1) + 's;--dl:' + (-rnd() * 6).toFixed(1) + 's"></i>';
    }
    return h;
  }

  function sideHTML(p, cls, defColor, xo) {
    var enter = String(p.entrance || '').replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    if (!STYLES[enter]) enter = 'classic';
    var st = useStyle(enter), c = okColor(p.color) || st.color || defColor, rgb = hexRgb(c);
    var sym = (p.sym === 'X' || p.sym === 'O') ? '<span class="vs-sym">' + p.sym + '</span>' : '';
    return '<div class="vs-side ' + cls + ' st-' + st.id + '" style="--c:' + c + ';--cr:' + rgb + '">' +
        '<div class="vs-panel"></div><div class="vs-fx">' + particles(14, cls === 'a' ? 7 : 19) + '</div>' +
        '<div class="vs-card' + (xo ? ' vs-xo' : '') + '">' +
          '<div class="vs-frame"><div class="vs-ph">' + portrait(p, xo) + '</div><i class="vs-shine"></i>' + sym + '</div>' +
          '<div class="vs-plate"><div class="vs-n">' + esc(p.name || 'Player') + '</div>' + (p.tag ? '<div class="vs-t">' + esc(p.tag) + '</div>' : '') + '<div class="vs-bar"></div></div>' +
        '</div></div>';
  }

  function ownEntrance() {
    try { return (window.XOShop && XOShop.equippedEntrance && XOShop.equippedEntrance()) || ''; } catch (e) { return ''; }
  }

  var running = null;
  function show(o) {
    o = o || {};
    return new Promise(function (resolve) {
      if (running) { try { running(true); } catch (e) {} }
      var old = document.getElementById('xoVSX'); if (old) old.remove();
      if (!document.getElementById('xoVSXCss')) {
        var s = document.createElement('style'); s.id = 'xoVSXCss'; s.textContent = BASE_CSS; document.head.appendChild(s);
      }
      var xo = o.mode === 'xo';
      var me = o.me || (A && A.myCard ? A.myCard() : { name: 'You' });
      var opp = o.opp || { name: 'Opponent' };
      if (!me.entrance) me = Object.assign({}, me, { entrance: ownEntrance() });
      var el = document.createElement('div');
      el.id = 'xoVSX'; el.setAttribute('role', 'presentation');
      el.innerHTML =
        '<div class="vs-bg"></div><div class="vs-grid"></div>' +
        '<div class="vs-stage">' +
          sideHTML(me, 'a', '#ff2f6d', xo ? 'X' : '') + sideHTML(opp, 'b', '#12c8d9', xo ? 'O' : '') +
          '<svg class="vs-seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="p" x1="-5" y1="57.7" x2="105" y2="42.3"/><line class="l" x1="56.6" y1="-5" x2="43.4" y2="105"/></svg>' +
          '<div class="vs-mid"><div class="vs-ring"></div><div class="vs-vs">VS</div></div>' +
        '</div>' +
        '<div class="vs-flash"></div>' +
        (o.sub ? '<div class="vs-sub"><span>' + esc(o.sub) + '</span></div>' : '') +
        '<div class="vs-hint">TAP TO SKIP</div>';
      document.body.appendChild(el);

      var done = false, born = 0, hold = o.ms ? Math.max(o.ms, 2800) : 3200, timer = 0;
      function end(fast) {
        if (done) return; done = true; running = null; clearTimeout(timer);
        document.removeEventListener('keydown', onKey, true);
        if (fast === true) { el.remove(); resolve(); return; }
        el.classList.add('out');
        setTimeout(function () { el.remove(); resolve(); }, 430);
      }
      function skip() { if (born && Date.now() - born > 700) end(); }      // ignore the tap that opened the page
      function onKey(e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); skip(); } }
      el.addEventListener('click', skip);
      document.addEventListener('keydown', onKey, true);
      running = end;

      // start the show once the portraits are decoded, so photos never pop in half way
      var go = function () {
        if (done || el.classList.contains('go')) return;
        el.classList.add('go'); born = Date.now(); timer = setTimeout(end, hold);
      };
      var imgs = [].slice.call(el.querySelectorAll('img')), waits = imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); });
      Promise.race([Promise.all(waits), new Promise(function (r) { setTimeout(r, 600); })]).then(go, go);
    });
  }
  show.__xovs = true;

  /* ------------------------------------------------------------------ preview (for you, while designing styles) */
  function sampleFace() {
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256; var c = cv.getContext('2d');
      var g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#5b2bd1'); g.addColorStop(1, '#12c8d9'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#f1c27d'; c.beginPath(); c.arc(128, 112, 54, 0, 6.3); c.fill();
      c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(128, 84, 56, Math.PI, 0); c.fill();
      c.fillStyle = '#ff2f6d'; c.beginPath(); c.ellipse(128, 262, 96, 78, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#1b1230'; c.beginPath(); c.arc(108, 112, 6, 0, 6.3); c.arc(148, 112, 6, 0, 6.3); c.fill();
      return cv.toDataURL('image/jpeg', .85);
    } catch (e) { return ''; }
  }
  function preview(styleA, styleB) {
    return show({ me: { name: 'You', av: 'photo', photo: sampleFace(), tag: '#12345', sym: 'X', entrance: styleA || 'classic' },
                  opp: { name: 'Rival', av: '\uD83D\uDD25', tag: '#54321', sym: 'O', entrance: styleB || 'classic' }, sub: 'PREVIEW \u00B7 ' + (styleA || 'classic').toUpperCase() });
  }

  window.XOVS = { show: show, register: register, styles: STYLES, preview: preview };
  if (A) A.vs = show;      // every page that already calls XOAuth.vs(...) now gets this screen
})();
