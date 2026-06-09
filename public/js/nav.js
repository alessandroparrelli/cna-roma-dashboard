// ============================================================
// NAV.JS v2 — Top nav a gruppi con dropdown (modulo additivo)
// I pannelli vengono spostati in <body> (pattern "portal"):
// così non vengono mai tagliati da overflow/scroll container,
// problema noto di position:fixed dentro contenitori scrollabili
// su iOS Safari.
// ============================================================
(function () {
  'use strict';

  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var dropdowns = []; // { dd, toggle, menu }

  // ── Chiude tutti i dropdown ──
  function closeAll() {
    dropdowns.forEach(function (o) {
      o.dd.classList.remove('open');
      o.menu.classList.remove('open');
      o.toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // ── Posiziona il pannello sotto il toggle ──
  function positionMenu(o) {
    var r = o.toggle.getBoundingClientRect();
    o.menu.style.top = (r.bottom + 6) + 'px';
    var w = Math.max(o.menu.offsetWidth, 230);
    var left = r.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    o.menu.style.left = left + 'px';
  }

  function toggleDropdown(o) {
    var isOpen = o.menu.classList.contains('open');
    closeAll();
    if (!isOpen) {
      o.dd.classList.add('open');
      o.menu.classList.add('open');
      o.toggle.setAttribute('aria-expanded', 'true');
      positionMenu(o);
    }
  }

  // ── Evidenzia il gruppo che contiene il tab attivo ──
  function syncActiveGroup() {
    dropdowns.forEach(function (o) {
      o.toggle.classList.toggle('active', !!o.menu.querySelector('.tab-btn.active'));
    });
  }

  // ── Visibilità gruppi: nasconde quelli senza voci accessibili.
  //    La sezione Amministrazione è SOLO per admin: nav.js non la
  //    mostra mai (lo fa auth.js) e la forza nascosta se il ruolo
  //    non è admin. ──
  function syncVisibility() {
    dropdowns.forEach(function (o) {
      var items = $all('.tab-btn[data-tab]', o.menu);
      var anyVisible = items.some(function (b) { return b.style.display !== 'none'; });
      if (o.dd.id === 'sb-admin-section') {
        var admin = (typeof isAdmin === 'function') && isAdmin();
        if ((!admin || !anyVisible) && o.dd.style.display !== 'none') {
          o.dd.style.display = 'none';
          o.menu.classList.remove('open');
          o.dd.classList.remove('open');
        }
        return; // mai mostrata da nav.js: ci pensa auth.js
      }
      var want = anyVisible ? 'flex' : 'none';
      if (o.dd.style.display !== want) o.dd.style.display = want; // evita loop dell'observer
    });
  }

  function init() {
    var nav = document.getElementById('sb-nav-scroll');
    if (!nav) return;

    var mo = new MutationObserver(function () { syncVisibility(); syncActiveGroup(); });

    $all('.sb-dropdown', nav).forEach(function (dd) {
      var toggle = dd.querySelector('.sb-dd-toggle');
      var menu = dd.querySelector('.sb-dd-menu');
      if (!toggle || !menu) return;
      var o = { dd: dd, toggle: toggle, menu: menu };
      dropdowns.push(o);

      // PORTAL: sposta il pannello in <body> (i listener dei tab-btn
      // restano attaccati agli elementi, che si spostano con esso)
      document.body.appendChild(menu);

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown(o);
      });

      // Click su una voce → cambia tab (listener di import.js) e chiudi
      menu.addEventListener('click', function (e) {
        var btn = e.target.closest('.tab-btn[data-tab]');
        if (btn) setTimeout(function () { closeAll(); syncActiveGroup(); }, 0);
      });

      // Osserva anche il pannello spostato (i filtri ruolo nascondono i tab-btn)
      mo.observe(menu, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
    });

    // Click fuori / ESC → chiudi (i pannelli in body vanno esclusi).
    // Su iOS Safari 'click' non scatta su aree non interattive: serve anche touchstart.
    function outsideClose(e) {
      if (!e.target.closest('.sb-dropdown') && !e.target.closest('.sb-dd-menu')) closeAll();
    }
    document.addEventListener('click', outsideClose);
    document.addEventListener('touchstart', outsideClose, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });

    // Resize → riposiziona; scroll orizzontale della barra → chiudi
    window.addEventListener('resize', function () {
      dropdowns.forEach(function (o) { if (o.menu.classList.contains('open')) positionMenu(o); });
    });
    nav.addEventListener('scroll', closeAll, { passive: true });

    // Osserva la barra (visibilità sezione admin via auth.js, classi active)
    mo.observe(nav, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });

    syncVisibility();
    syncActiveGroup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
