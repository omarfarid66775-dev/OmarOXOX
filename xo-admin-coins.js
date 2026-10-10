/* xo-admin-coins.js - unlimited coins for the admin account only (username: xo_admin_omar).
   Load it AFTER xo-shop.js. Other players are not affected. */
(function () {
  var ADMIN_USER = 'xo_admin_omar', TARGET = 1000000000;
  function isAdmin() {
    try { return (JSON.parse(localStorage.getItem('xo_profile') || '{}').u || '') === ADMIN_USER; }
    catch (e) { return false; }
  }
  // a button that opens the dashboard, shown only to the admin account
  function mountBtn() {
    if (document.getElementById('xoAdminLink') || !isAdmin() || !document.body) return;
    var a = document.createElement('a');
    a.id = 'xoAdminLink'; a.href = 'admin.html'; a.title = 'Admin dashboard'; a.innerHTML = '&#128202;';
    a.style.cssText = 'position:fixed;top:20px;left:228px;z-index:200;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;' +
      'border:2px solid #00f3ff;background:rgba(0,243,255,.08);color:#00f3ff;font-size:19px;text-decoration:none;box-shadow:0 0 16px rgba(0,243,255,.3)';
    document.body.appendChild(a);
  }
  function topUp() {
    mountBtn();
    var S = window.XOShop;
    if (!S || !isAdmin()) return;
    var c = S.coins();
    if (c < TARGET / 2) S.addCoins(TARGET - c);
  }
  window.addEventListener('load', function () { topUp(); setTimeout(topUp, 3000); setTimeout(topUp, 8000); });
  window.addEventListener('focus', topUp);
  window.addEventListener('pageshow', topUp);
  setInterval(topUp, 5000);
})();
