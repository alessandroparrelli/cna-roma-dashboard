// ============================================================
// NAV.JS — Top nav a gruppi con dropdown (modulo additivo)
// Sostituisce lo scroll orizzontale: tutte le voci sono
// raggruppate in menu a tendina sempre raggiungibili.
// ============================================================
(function () {
  'use strict';

  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // ── Chiude tutti i dropdown ──
  function closeAll(except) {
    $all('.sb-dropdown.open').forEach(function (dd) {
      if (dd !== except) {
        dd.classList.remove('open');
        var t = dd.querySelector('.sb-dd-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Posiziona il pannello sotto il toggle (position:fixed → mai tagliato) ──
  function positionMenu(dd) {
    var toggle = dd.querySelector('.sb-dd-toggle');
    var menu = dd.querySelector('.sb-dd-menu');
    if (!toggle || !menu) return;
    var r = toggle.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    var left = r.left;
    // Non far uscire il menu dallo schermo a destra
    var w = Math.max(menu.offsetWidth, 230);
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    menu.style.left = left + 'px';
  }

  // ── Apre/chiude un dropdown ──
  function toggleDropdown(dd) {
    var isOpen = dd.classList.contains('open');
    closeAll();
    if (!isOpen) {
      dd.classList.add('open');
      var t = dd.querySelector('.sb-dd-toggle');
      if (t) t.setAttribute('aria-expanded', 'true');
      positionMenu(dd);
    }
  }

  // ── Evidenzia il gruppo che contiene il tab attivo ──
  function syncActiveGroup() {
    $all('.sb-dropdown').forEach(function (dd) {
      var toggle = dd.querySelector('.sb-dd-toggle');
      if (!toggle) return;
      var hasActive = !!dd.querySelector('.tab-btn.active');
      toggle.classList.toggle('active', hasActive);
    });
  }

  // ── Nasconde i gruppi senza voci visibili (filtri ruolo) ──
  function syncVisibility() {
    $all('.sb-dropdown').forEach(function (dd) {
      // La sezione admin è gestita da auth.js: non forzarne la visibilità
      var items = $all('.tab-btn[data-tab]', dd);
      var anyVisible = items.some(function (b) { return b.style.display !== 'none'; });
      if (dd.id === 'sb-admin-section') {
        if (!anyVisible && dd.style.display !== 'none') dd.style.display = 'none';
        return;
      }
      var want = anyVisible ? 'flex' : 'none';
      if (dd.style.display !== want) dd.style.display = want; // evita loop dell'observer
    });
  }

  function init() {
    var nav = document.getElementById('sb-nav-scroll');
    if (!nav) return;

    // Click sui toggle
    $all('.sb-dd-toggle', nav).forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown(toggle.closest('.sb-dropdown'));
      });
    });

    // Click su una voce del menu → chiudi e aggiorna evidenziazione
    nav.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn[data-tab]');
      if (btn) {
        setTimeout(function () { closeAll(); syncActiveGroup(); }, 0);
      }
    });

    // Click fuori / ESC → chiudi
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.sb-dropdown')) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
    // Resize/scroll → riposiziona o chiudi
    window.addEventListener('resize', function () {
      var open = document.querySelector('.sb-dropdown.open');
      if (open) positionMenu(open);
    });

    // Visibilità voci cambia dopo il login (filtri ruolo): osserva gli attributi style
    var mo = new MutationObserver(function () { syncVisibility(); syncActiveGroup(); });
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
