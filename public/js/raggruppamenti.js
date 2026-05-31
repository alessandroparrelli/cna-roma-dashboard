// ============================================================
// RAGGRUPPAMENTI.JS — Tab Raggruppamenti e Zone  v2026.05.31.2
// Fonte dati: tesseramento_records (nuovi associati)
// Join: Anagrafiche (per CAP → area, cftitolare → giovani)
// ============================================================
console.log('✅ raggruppamenti.js v2 CARICATO');

var raggLoaded  = false;
var raggLoading = false;
var raggData    = [];   // tesseramento_records enriched
var raggFilters = { area: '', sesso: '' };

// ── Fetch paginato ─────────────────────────────────────────────────────────────
async function raggFetchAll(table, selectFields) {
  var all = [], offset = 0, size = 1000;
  var sel = selectFields ? '&select=' + selectFields : '&select=*';
  var base = SB + '/rest/v1/' + encodeURIComponent(table) + '?limit=' + size + sel;
  while (true) {
    var r = await fetch(base + '&offset=' + offset, { headers: H() });
    if (!r.ok) throw new Error(table + ': HTTP ' + r.status);
    var rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    offset += size;
    if (rows.length < size) break;
  }
  return all;
}

// ── Load principale ────────────────────────────────────────────────────────────
async function raggLoad(force) {
  if (raggLoading) return;
  if (raggLoaded && !force) return;
  raggLoading = true;

  var tab = G('tab-raggruppamenti');
  if (!tab) { raggLoading = false; return; }

  tab.innerHTML = `
    <div class="tab-hero"><h2 class="tab-hero-title">Raggruppamenti e Zone</h2>
    <p class="tab-hero-desc">Analisi dei nuovi associati per raggruppamento territoriale, settore e caratteristiche del titolare</p></div>
    <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;gap:14px">
      <div style="font-size:16px;font-weight:700;color:var(--text)">⏳ Caricamento dati…</div>
      <div style="width:340px;height:7px;background:var(--border,#e5e7eb);border-radius:4px">
        <div id="ragg-pb" style="height:7px;background:#005CA9;border-radius:4px;transition:width .4s;width:0%"></div>
      </div>
      <div id="ragg-msg" style="font-size:13px;color:var(--text-secondary,#64748b)">Connessione a Supabase…</div>
    </div>`;

  function setPb(pct, msg) {
    var pb = G('ragg-pb'); if (pb) pb.style.width = pct + '%';
    var m  = G('ragg-msg'); if (m)  m.textContent = msg;
  }

  try {
    setPb(10, 'Caricamento Tesseramento…');
    // Carica tesseramento_records (nuovi associati) — tutti i campi
    var tess = await raggFetchAll('tesseramento_records');

    setPb(45, 'Caricamento Anagrafiche per CAP e CF titolare…');
    // Carica Anagrafiche per ottenere cap → area e cftitolare → giovani
    var anagrafiche = await raggFetchAll('Anagrafiche', 'partitaiva,cap,cftitolare');

    setPb(70, 'Caricamento tabella aree per CAP…');
    var capAree = await raggFetchAll('cap_aree');

    setPb(88, 'Elaborazione dati…');

    // Mappe di lookup
    var capToArea = {};
    capAree.forEach(function(r) {
      capToArea[(r.cap || '').trim()] = r.area;
    });

    // Mappa partitaiva → { cap, area, cftitolare }
    var pivaMap = {};
    anagrafiche.forEach(function(a) {
      var piva = (a.partitaiva || '').trim();
      if (!piva) return;
      pivaMap[piva] = {
        cap:   (a.cap  || '').trim(),
        area:  capToArea[(a.cap || '').trim()] || null,
        cftitolare: (a.cftitolare || '').trim().toUpperCase()
      };
    });

    var currentYear = new Date().getFullYear();

    // Enrich tesseramento_records
    tess.forEach(function(r) {
      var piva  = (r.partitaiva || '').trim();
      var anaRec = pivaMap[piva] || {};
      var cf     = anaRec.cftitolare || '';
      var ateco  = (r.ateco || '').trim();
      var sx     = (r.sesso || '').trim();       // 'Maschio' / 'Femmina'
      var naz    = (r.nazionalita || '').trim();  // 'Straniero' / 'Italiano'

      r._area        = anaRec.area || null;
      r._isDonna     = sx === 'Femmina' || sx === 'F';
      r._isStraniero = naz === 'Straniero';
      r._isCommercio = ateco.startsWith('46') || ateco.startsWith('47');
      r._isTurismo   = ateco.startsWith('55') || ateco.startsWith('79') ||
                       (ateco.startsWith('56') && !ateco.startsWith('563'));
      r._isCinema    = ateco.startsWith('591') || ateco.startsWith('592') ||
                       ateco.startsWith('59.1') || ateco.startsWith('59.2');
      r._isGiovane   = false;
      r._fascia      = null;

      // Giovani: da CF titolare (Anagrafiche)
      if (cf.length === 16) {
        var anno2 = cf.substring(6, 8);
        if (/^\d{2}$/.test(anno2)) {
          var y2 = parseInt(anno2, 10);
          var threshold = currentYear - 2000;
          var annoNasc = y2 <= threshold ? 2000 + y2 : 1900 + y2;
          var eta = currentYear - annoNasc;
          r._isGiovane = eta <= 40;
          if (r._isGiovane) {
            if (eta <= 25)      r._fascia = '≤25 anni';
            else if (eta <= 30) r._fascia = '26–30 anni';
            else if (eta <= 35) r._fascia = '31–35 anni';
            else                r._fascia = '36–40 anni';
          }
        }
      }
    });

    raggData   = tess;
    raggLoaded = true;

    setPb(100, 'Completato');
    setTimeout(function() {
      raggBuildUI();
      raggRenderAll(raggCompute(tess));
    }, 300);

  } catch (e) {
    console.error('❌ raggruppamenti:', e);
    var t = G('tab-raggruppamenti');
    if (t) t.innerHTML = '<div style="padding:40px;color:red"><h2>Errore caricamento</h2><p>' + e.message + '</p></div>';
  } finally {
    raggLoading = false;
    if (typeof hideLoad === 'function') hideLoad();
  }
}

// ── Calcolo statistiche ────────────────────────────────────────────────────────
function raggCompute(records) {
  var AREE = ['Area Nord','Area Ovest - Massaia','Area Sud','Area Tiburtino','Area Tivoli'];

  function emptyByArea() {
    var o = { _none: 0 };
    AREE.forEach(function(a) { o[a] = 0; });
    return o;
  }

  var s = {
    tot:       records.length,
    zone:      { byArea: {}, nonClassif: 0 },
    commercio: { tot: 0, donne: 0, stranieri: 0, byArea: emptyByArea() },
    turismo:   { tot: 0, donne: 0, stranieri: 0, byArea: emptyByArea() },
    cinema:    { tot: 0, donne: 0, stranieri: 0, byArea: emptyByArea() },
    donne:     { tot: 0, stranieri: 0, giovani: 0, byArea: emptyByArea() },
    stranieri: { tot: 0, donne: 0, giovani: 0, byArea: emptyByArea() },
    giovani:   { tot: 0, donne: 0, stranieri: 0, byFascia: {}, byArea: emptyByArea() }
  };

  AREE.forEach(function(a) {
    s.zone.byArea[a] = { tot: 0, donne: 0, stranieri: 0, giovani: 0 };
  });

  records.forEach(function(r) {
    var area = r._area;

    // Zone
    if (area) {
      if (!s.zone.byArea[area]) s.zone.byArea[area] = { tot: 0, donne: 0, stranieri: 0, giovani: 0 };
      s.zone.byArea[area].tot++;
      if (r._isDonna)     s.zone.byArea[area].donne++;
      if (r._isStraniero) s.zone.byArea[area].stranieri++;
      if (r._isGiovane)   s.zone.byArea[area].giovani++;
    } else {
      s.zone.nonClassif++;
    }

    function addArea(cat) {
      if (area) s[cat].byArea[area] = (s[cat].byArea[area] || 0) + 1;
      else      s[cat].byArea._none = (s[cat].byArea._none || 0) + 1;
    }

    if (r._isCommercio) {
      s.commercio.tot++;
      if (r._isDonna)     s.commercio.donne++;
      if (r._isStraniero) s.commercio.stranieri++;
      addArea('commercio');
    }
    if (r._isTurismo) {
      s.turismo.tot++;
      if (r._isDonna)     s.turismo.donne++;
      if (r._isStraniero) s.turismo.stranieri++;
      addArea('turismo');
    }
    if (r._isCinema) {
      s.cinema.tot++;
      if (r._isDonna)     s.cinema.donne++;
      if (r._isStraniero) s.cinema.stranieri++;
      addArea('cinema');
    }
    if (r._isDonna) {
      s.donne.tot++;
      if (r._isStraniero) s.donne.stranieri++;
      if (r._isGiovane)   s.donne.giovani++;
      addArea('donne');
    }
    if (r._isStraniero) {
      s.stranieri.tot++;
      if (r._isDonna)   s.stranieri.donne++;
      if (r._isGiovane) s.stranieri.giovani++;
      addArea('stranieri');
    }
    if (r._isGiovane) {
      s.giovani.tot++;
      if (r._isDonna)     s.giovani.donne++;
      if (r._isStraniero) s.giovani.stranieri++;
      if (r._fascia) s.giovani.byFascia[r._fascia] = (s.giovani.byFascia[r._fascia] || 0) + 1;
      addArea('giovani');
    }
  });

  return s;
}

// ── Build UI skeleton ──────────────────────────────────────────────────────────
function raggBuildUI() {
  var tab = G('tab-raggruppamenti');
  if (!tab) return;

  if (!document.getElementById('ragg-css')) {
    var st = document.createElement('style');
    st.id = 'ragg-css';
    st.textContent = `
      .ragg-card{background:var(--surface,#fff);border-radius:14px;overflow:hidden;
        box-shadow:0 4px 14px rgba(0,0,0,.09);transition:transform .22s,box-shadow .22s}
      .ragg-card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(0,0,0,.14)}
      .ragg-card-head{padding:15px 18px;color:#fff;display:flex;align-items:center;
        gap:10px;font-weight:800;font-size:14px;letter-spacing:.3px}
      .ragg-card-body{padding:18px 20px}
      .ragg-big{font-size:40px;font-weight:900;letter-spacing:-1px;line-height:1}
      .ragg-pct{font-size:13px;font-weight:600;color:var(--text-secondary,#475569);margin-top:3px}
      .ragg-note{font-size:12px;color:var(--text,#1e293b);font-weight:500;margin-top:2px}
      .ragg-bar-wrap{background:var(--border,#e2e8f0);border-radius:999px;height:8px;overflow:hidden;margin:5px 0}
      .ragg-bar-fill{height:100%;border-radius:999px;transition:width .7s cubic-bezier(.4,0,.2,1)}
      .ragg-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
        border-radius:999px;font-size:12px;font-weight:700;border:1px solid transparent}
      .ragg-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
      .ragg-area-label{font-size:13px;font-weight:700;min-width:160px;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis;color:var(--text,#1e293b)}
      .ragg-area-count{font-size:13px;font-weight:800;min-width:44px;text-align:right}
      .ragg-area-pct{font-size:12px;font-weight:600;color:var(--text-secondary,#475569);
        min-width:42px;text-align:right}
      .ragg-sec-label{font-size:11px;font-weight:800;color:var(--text-secondary,#475569);
        text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;margin-top:14px}
      .ragg-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
      .ragg-kpi-cell{background:var(--surface2,#f8fafc);border-radius:10px;padding:12px 10px;text-align:center}
      .ragg-kpi-num{font-size:22px;font-weight:900;line-height:1}
      .ragg-kpi-lbl{font-size:11px;font-weight:700;color:var(--text-secondary,#475569);margin-top:4px}
      @keyframes raggFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      .ragg-anim{animation:raggFadeUp .45s ease-out both}
    `;
    document.head.appendChild(st);
  }

  tab.innerHTML = `
    <div class="tab-hero">
      <h2 class="tab-hero-title">Raggruppamenti e Zone</h2>
      <p class="tab-hero-desc">Analisi dei nuovi associati per area territoriale, settore e caratteristiche del titolare</p>
    </div>
    <div style="padding:0 20px 30px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;
        background:var(--surface2,#f8fafc);padding:12px 16px;border-radius:10px;
        border:1px solid var(--border,#e2e8f0)">
        <span style="font-size:11px;font-weight:800;color:var(--text-secondary,#475569);
          text-transform:uppercase;letter-spacing:.08em">Filtra:</span>
        <select id="ragg-f-area" style="padding:7px 12px;border-radius:8px;
          border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);
          font-size:13px;font-weight:600;color:var(--text,#1e293b);cursor:pointer">
          <option value="">Tutte le aree</option>
          <option>Area Nord</option>
          <option>Area Ovest - Massaia</option>
          <option>Area Sud</option>
          <option>Area Tiburtino</option>
          <option>Area Tivoli</option>
        </select>
        <select id="ragg-f-sesso" style="padding:7px 12px;border-radius:8px;
          border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);
          font-size:13px;font-weight:600;color:var(--text,#1e293b);cursor:pointer">
          <option value="">Tutti i sessi</option>
          <option value="Maschio">Maschi</option>
          <option value="Femmina">Femmine</option>
        </select>
        <button id="ragg-reset" style="padding:7px 16px;border-radius:8px;border:none;
          background:#005CA9;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
          ↺ Reset
        </button>
        <span id="ragg-tot-label" style="font-size:13px;font-weight:700;
          color:var(--text,#1e293b);margin-left:auto"></span>
      </div>
      <div id="ragg-boxes"></div>
    </div>`;

  ['ragg-f-area','ragg-f-sesso'].forEach(function(id) {
    var el = G(id);
    if (el) el.addEventListener('change', raggApplyFilter);
  });
  var rst = G('ragg-reset');
  if (rst) rst.addEventListener('click', function() {
    G('ragg-f-area').value  = '';
    G('ragg-f-sesso').value = '';
    raggApplyFilter();
  });
}

function raggApplyFilter() {
  var areaF  = (G('ragg-f-area')  || {}).value || '';
  var sessoF = (G('ragg-f-sesso') || {}).value || '';
  var filtered = raggData.filter(function(r) {
    if (areaF  && r._area !== areaF)         return false;
    if (sessoF && (r.sesso || '') !== sessoF) return false;
    return true;
  });
  raggRenderAll(raggCompute(filtered));
  // ripristina valori filtro
  if (G('ragg-f-area'))  G('ragg-f-area').value  = areaF;
  if (G('ragg-f-sesso')) G('ragg-f-sesso').value = sessoF;
}

// ── Render all boxes ───────────────────────────────────────────────────────────
function raggRenderAll(s) {
  var container = G('ragg-boxes');
  if (!container) return;

  var lbl = G('ragg-tot-label');
  if (lbl) lbl.textContent = s.tot.toLocaleString('it-IT') + ' nuovi associati nel campione';

  var html = '';

  // Riga 1: Zone (larghezza piena)
  html += raggZoneCard(s);

  // Righe successive: 3 colonne
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:18px">';
  html += raggSimpleCard(s.commercio, s.tot, {
    title: 'Commercio',
    icon:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    color: '#F59E0B',
    note:  'ATECO 46.* e 47.*'
  });
  html += raggSimpleCard(s.turismo, s.tot, {
    title: 'Turismo',
    icon:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8l4 4-4 4M8 12h8"/></svg>',
    color: '#3B82F6',
    note:  'ATECO 55.*, 79.*, 56.*'
  });
  html += raggSimpleCard(s.cinema, s.tot, {
    title: 'Cinema e Audiovisivo',
    icon:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
    color: '#8B5CF6',
    note:  'ATECO 59.1.* e 59.2.*'
  });
  html += raggDonneCard(s.donne, s.tot);
  html += raggStranCard(s.stranieri, s.tot);
  html += raggGiovaniCard(s.giovani, s.tot);
  html += '</div>';

  container.innerHTML = html;

  setTimeout(function() {
    container.querySelectorAll('.ragg-bar-fill[data-w]').forEach(function(el) {
      el.style.width = el.getAttribute('data-w');
    });
  }, 60);
}

// ── Box Zone ───────────────────────────────────────────────────────────────────
function raggZoneCard(s) {
  var AREA_COLORS = {
    'Area Nord':            '#3B82F6',
    'Area Ovest - Massaia': '#10B981',
    'Area Sud':             '#F59E0B',
    'Area Tiburtino':       '#8B5CF6',
    'Area Tivoli':          '#EF4444'
  };

  var aree = Object.keys(s.zone.byArea)
    .filter(function(k) { return s.zone.byArea[k].tot > 0; })
    .sort(function(a,b)  { return s.zone.byArea[b].tot - s.zone.byArea[a].tot; });
  var maxN = aree.length ? s.zone.byArea[aree[0]].tot : 1;
  var totMappate = aree.reduce(function(acc, a) { return acc + s.zone.byArea[a].tot; }, 0);

  var rows = aree.map(function(area) {
    var d      = s.zone.byArea[area];
    var pctTot = s.tot > 0 ? (d.tot / s.tot * 100).toFixed(1) : '0';
    var pctBar = Math.round(d.tot / maxN * 100);
    var col    = AREA_COLORS[area] || '#64748b';
    var pctD   = d.tot > 0 ? (d.donne     / d.tot * 100).toFixed(1) : '0';
    var pctS   = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';
    var pctG   = d.tot > 0 ? (d.giovani   / d.tot * 100).toFixed(1) : '0';
    return `
      <div class="ragg-row ragg-anim">
        <div class="ragg-area-label" style="color:${col}">${area}</div>
        <div style="flex:1">
          <div class="ragg-bar-wrap">
            <div class="ragg-bar-fill" data-w="${pctBar}%" style="background:${col};width:0%"></div>
          </div>
        </div>
        <div class="ragg-area-count" style="color:${col}">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-area-pct">${pctTot}%</div>
        <div style="display:flex;gap:6px;min-width:220px;justify-content:flex-end">
          <span class="ragg-pill" style="background:rgba(236,72,153,.12);color:#be185d;border-color:rgba(236,72,153,.25)">♀ ${pctD}%</span>
          <span class="ragg-pill" style="background:rgba(16,185,129,.12);color:#065f46;border-color:rgba(16,185,129,.25)">🌍 ${pctS}%</span>
          <span class="ragg-pill" style="background:rgba(59,130,246,.12);color:#1e40af;border-color:rgba(59,130,246,.25)">⚡ ${pctG}%</span>
        </div>
      </div>`;
  }).join('');

  var nonCl = s.zone.nonClassif;
  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-card-head" style="background:linear-gradient(135deg,#14B8A6,#0D9488)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
        Zone
        <span style="font-size:12px;font-weight:500;opacity:.85;margin-left:auto">
          ${totMappate.toLocaleString('it-IT')} su ${s.tot.toLocaleString('it-IT')} associati con area mappata
        </span>
      </div>
      <div class="ragg-card-body">
        <div style="display:flex;gap:6px;margin-bottom:8px;font-size:11px;font-weight:800;
          color:var(--text-secondary,#475569);text-transform:uppercase;letter-spacing:.06em">
          <span style="min-width:160px">Area</span>
          <span style="flex:1"></span>
          <span style="min-width:44px;text-align:right">N</span>
          <span style="min-width:42px;text-align:right">%</span>
          <span style="min-width:220px;text-align:right">♀ Donne &nbsp; 🌍 Stranieri &nbsp; ⚡ Giovani</span>
        </div>
        ${rows}
        ${nonCl > 0 ? `
          <div class="ragg-row" style="opacity:.55;font-size:12px;margin-top:6px">
            <div class="ragg-area-label" style="color:#94a3b8;font-weight:500">
              Non classificati (CAP non in mappa)
            </div>
            <div style="flex:1"></div>
            <div class="ragg-area-count" style="color:#94a3b8">${nonCl}</div>
            <div class="ragg-area-pct">${(nonCl/s.tot*100).toFixed(1)}%</div>
            <div style="min-width:220px"></div>
          </div>` : ''}
      </div>
    </div>`;
}

// ── Box generico (Commercio, Turismo, Cinema) ──────────────────────────────────
function raggSimpleCard(d, totTot, cfg) {
  var pctTot  = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctD    = d.tot > 0 ? (d.donne     / d.tot * 100).toFixed(1) : '0';
  var pctS    = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';

  var aree = Object.entries(d.byArea)
    .filter(function(x) { return x[0] !== '_none' && x[1] > 0; })
    .sort(function(a,b)  { return b[1] - a[1]; });
  var maxA = aree.length ? aree[0][1] : 1;

  var areeHtml = aree.slice(0, 5).map(function(x) {
    var pctB = Math.round(x[1] / maxA * 100);
    var pctA = d.tot > 0 ? (x[1] / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${x[0]}</span>
        <span style="color:${cfg.color};font-weight:800">${x[1].toLocaleString('it-IT')}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${pctA}%)</span></span>
      </div>
      <div class="ragg-bar-wrap">
        <div class="ragg-bar-fill" data-w="${pctB}%" style="background:${cfg.color};width:0%;opacity:.8"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-card-head" style="background:linear-gradient(135deg,${cfg.color},${cfg.color}cc)">
        ${cfg.icon} ${cfg.title}
      </div>
      <div class="ragg-card-body">
        <div class="ragg-big" style="color:${cfg.color}">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-pct">${pctTot}% dei nuovi associati</div>
        <div class="ragg-note">${cfg.note}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="ragg-pill" style="background:rgba(236,72,153,.12);color:#be185d;border-color:rgba(236,72,153,.25)">♀ Donne ${pctD}%</span>
          <span class="ragg-pill" style="background:rgba(16,185,129,.12);color:#065f46;border-color:rgba(16,185,129,.25)">🌍 Stranieri ${pctS}%</span>
        </div>
        <div class="ragg-sec-label">Per area</div>
        ${areeHtml || '<div style="font-size:13px;color:var(--text-secondary,#475569)">Nessun dato per area</div>'}
      </div>
    </div>`;
}

// ── Box Donne ──────────────────────────────────────────────────────────────────
function raggDonneCard(d, totTot) {
  var pctTot  = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctS    = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';
  var pctG    = d.tot > 0 ? (d.giovani   / d.tot * 100).toFixed(1) : '0';

  var aree = Object.entries(d.byArea)
    .filter(function(x) { return x[0] !== '_none' && x[1] > 0; })
    .sort(function(a,b)  { return b[1] - a[1]; });
  var maxA = aree.length ? aree[0][1] : 1;

  var areeHtml = aree.slice(0, 5).map(function(x) {
    var pctB = Math.round(x[1] / maxA * 100);
    var pctA = d.tot > 0 ? (x[1] / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${x[0]}</span>
        <span style="color:#EC4899;font-weight:800">${x[1].toLocaleString('it-IT')}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${pctA}%)</span></span>
      </div>
      <div class="ragg-bar-wrap">
        <div class="ragg-bar-fill" data-w="${pctB}%" style="background:#EC4899;width:0%"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-card-head" style="background:linear-gradient(135deg,#EC4899,#db2777)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <circle cx="12" cy="8" r="4"/><path d="M12 12v8M9 18h6"/>
        </svg>
        Donne
      </div>
      <div class="ragg-card-body">
        <div class="ragg-big" style="color:#EC4899">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-pct">${pctTot}% dei nuovi associati</div>
        <div class="ragg-note">Imprese con titolare di sesso femminile</div>
        <div class="ragg-kpi-grid" style="margin-top:12px">
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#EC4899">${d.tot.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Totale</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#10B981">${d.stranieri.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Straniere (${pctS}%)</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#3B82F6">${d.giovani.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Giovani ≤40 (${pctG}%)</div>
          </div>
        </div>
        <div class="ragg-sec-label">Per area</div>
        ${areeHtml}
      </div>
    </div>`;
}

// ── Box Stranieri ──────────────────────────────────────────────────────────────
function raggStranCard(d, totTot) {
  var pctTot = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctD   = d.tot > 0 ? (d.donne   / d.tot * 100).toFixed(1) : '0';
  var pctG   = d.tot > 0 ? (d.giovani / d.tot * 100).toFixed(1) : '0';

  var aree = Object.entries(d.byArea)
    .filter(function(x) { return x[0] !== '_none' && x[1] > 0; })
    .sort(function(a,b)  { return b[1] - a[1]; });
  var maxA = aree.length ? aree[0][1] : 1;

  var areeHtml = aree.slice(0, 5).map(function(x) {
    var pctB = Math.round(x[1] / maxA * 100);
    var pctA = d.tot > 0 ? (x[1] / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${x[0]}</span>
        <span style="color:#10B981;font-weight:800">${x[1].toLocaleString('it-IT')}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${pctA}%)</span></span>
      </div>
      <div class="ragg-bar-wrap">
        <div class="ragg-bar-fill" data-w="${pctB}%" style="background:#10B981;width:0%"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-card-head" style="background:linear-gradient(135deg,#10B981,#059669)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        Stranieri
      </div>
      <div class="ragg-card-body">
        <div class="ragg-big" style="color:#10B981">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-pct">${pctTot}% dei nuovi associati</div>
        <div class="ragg-note">Titolari con nazionalità straniera</div>
        <div class="ragg-kpi-grid" style="margin-top:12px">
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#10B981">${d.tot.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Totale</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#EC4899">${d.donne.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Donne (${pctD}%)</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#3B82F6">${d.giovani.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Giovani ≤40 (${pctG}%)</div>
          </div>
        </div>
        <div class="ragg-sec-label">Per area</div>
        ${areeHtml}
      </div>
    </div>`;
}

// ── Box Giovani ────────────────────────────────────────────────────────────────
function raggGiovaniCard(d, totTot) {
  var pctTot = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctD   = d.tot > 0 ? (d.donne     / d.tot * 100).toFixed(1) : '0';
  var pctS   = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';

  var FASCE = ['≤25 anni','26–30 anni','31–35 anni','36–40 anni'];
  var maxF  = Math.max.apply(null, FASCE.map(function(f) { return d.byFascia[f] || 0; })) || 1;

  var fascHtml = FASCE.map(function(f) {
    var n    = d.byFascia[f] || 0;
    var pctB = Math.round(n / maxF * 100);
    var pctA = d.tot > 0 ? (n / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${f}</span>
        <span style="color:#EF4444;font-weight:800">${n.toLocaleString('it-IT')}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${pctA}%)</span></span>
      </div>
      <div class="ragg-bar-wrap">
        <div class="ragg-bar-fill" data-w="${pctB}%" style="background:#EF4444;width:0%"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-card-head" style="background:linear-gradient(135deg,#EF4444,#DC2626)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Giovani
      </div>
      <div class="ragg-card-body">
        <div class="ragg-big" style="color:#EF4444">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-pct">${pctTot}% dei nuovi associati</div>
        <div class="ragg-note">Titolari con età ≤ 40 anni (da CF in Anagrafiche)</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="ragg-pill" style="background:rgba(236,72,153,.12);color:#be185d;border-color:rgba(236,72,153,.25)">♀ Donne ${pctD}%</span>
          <span class="ragg-pill" style="background:rgba(16,185,129,.12);color:#065f46;border-color:rgba(16,185,129,.25)">🌍 Stranieri ${pctS}%</span>
        </div>
        <div class="ragg-sec-label">Fasce d'età</div>
        ${fascHtml}
      </div>
    </div>`;
}
