// ============================================================
// RAGGRUPPAMENTI.JS — Tab Raggruppamenti e Zone  v2026.05.31.4
//
// Join corretto (verificato sui file reali):
//   tesseramento_records.codicecliente
//     → Anagrafiche.codiceanagrafica  (UPPERCASE match)
//     → Anagrafiche.codiceateco       → codiciateco (unione/settore/mestiere)
//     → Anagrafiche.cap               → zona geografica
//     → Anagrafiche.sesso             → donne
//     → Anagrafiche.cftitolare        → stranieri + giovani
//
// Numeri attesi (verificati su file Excel):
//   Totale: 3571 | Commercio: 501 | Turismo: 477 | Cinema: 93
//   Donne: 969 | Stranieri: 309 | Giovani≤40: 840
// ============================================================
console.log('✅ raggruppamenti.js v4 CARICATO');

var raggLoaded  = false;
var raggLoading = false;
var raggData    = [];
var raggAnni    = [];   // anni disponibili per il filtro
var raggZone    = [];   // zone disponibili (nomi esatti dal DB)

// Stesse costanti non-deliberato usate in ateco.js
var RAGG_ND = {
  '':1,'n/d':1,'nd':1,'n.d.':1,
  'art.ne di mestiere non deliberata':1,
  'unione non assegnata':1,
  'attività n.c.a.':1,'attivita n.c.a.':1,
  'attività non deliberata':1,'attivita non deliberata':1,
  'unione non deliberata':1,'mestiere non deliberato':1,'settore non deliberato':1
};

// ── Fetch paginato ─────────────────────────────────────────────────────────────
async function raggFetchAll(table, sel) {
  var all = [], offset = 0, size = 1000;
  var s = sel ? '&select=' + sel : '&select=*';
  var base = SB + '/rest/v1/' + encodeURIComponent(table) + '?limit=' + size + s;
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
    <div class="tab-hero">
      <h2 class="tab-hero-title">Raggruppamenti e Zone</h2>
      <p class="tab-hero-desc">Analisi dei nuovi associati per area territoriale, settore e caratteristiche del titolare</p>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;gap:14px">
      <div style="font-size:16px;font-weight:700;color:var(--text)">⏳ Caricamento dati…</div>
      <div style="width:360px;height:7px;background:var(--border,#e2e8f0);border-radius:4px">
        <div id="ragg-pb" style="height:7px;background:#005CA9;border-radius:4px;transition:width .4s;width:0%"></div>
      </div>
      <div id="ragg-msg" style="font-size:13px;color:var(--text-secondary,#64748b)">Connessione…</div>
    </div>`;

  function pb(pct, msg) {
    var el = G('ragg-pb'); if (el) el.style.width = pct + '%';
    var m  = G('ragg-msg'); if (m) m.textContent = msg;
  }

  try {
    pb(8,  'Caricamento tesseramento_records…');
    var tess = await raggFetchAll('tesseramento_records');

    pb(25, 'Caricamento Anagrafiche…');
    // select=* per evitare errori su nomi campo — stesso approccio di ateco.js
    var anagrafiche = await raggFetchAll('Anagrafiche');

    pb(48, 'Caricamento Diretti (per zona cliente)…');
    var diretti = await raggFetchAll('diretti');

    pb(70, 'Elaborazione join…');

    // ── Mappa codiceanagrafica → dati anagrafica ──────────────────────────────
    var anaMap = {};
    (anagrafiche || []).forEach(function(a) {
      var k = String(a.codiceanagrafica || '').trim().toUpperCase();
      // Salta righe di intestazione spazzatura (es. codiceanagrafica = "0")
      if (k && k !== '0' && !anaMap[k]) anaMap[k] = a;
    });

    // ── Mappa codiceanagrafica → zona cliente (primo record diretti) ───────────
    var zonaMap = {};
    (diretti || []).forEach(function(d) {
      var k = String(d.codiceanagrafica || '').trim().toUpperCase();
      if (k && !zonaMap[k] && d.zonacliente) zonaMap[k] = String(d.zonacliente).trim();
    });

    // ── Normalizza codice ATECO: rimuove .0 float e puntini ───────────────────
    function normAteco(raw) {
      if (!raw || raw === 'null' || raw === 'undefined') return '';
      var s = String(raw).trim();
      // Se arriva come float tipo "46720.0" → togli decimali
      var f = parseFloat(s);
      if (!isNaN(f) && String(f) === s) s = String(Math.round(f));
      // Rimuovi puntini/spazi
      return s.replace(/\./g, '').replace(/\s/g, '');
    }

    var ANNO = new Date().getFullYear();

    // ── Enrich ogni record tesseramento ──────────────────────────────────────
    (tess || []).forEach(function(tr) {
      var cc  = String(tr.codicecliente || '').trim().toUpperCase();
      var ana = cc ? anaMap[cc] : null;

      // Anno di stipula
      tr._anno = tr.anno ? parseInt(tr.anno, 10) : null;
      if (!tr._anno) {
        var ds = String(tr.datastipula || '').trim();
        if (ds) { var m = ds.match(/(\d{4})/); if (m) tr._anno = parseInt(m[1], 10); }
      }

      // Zona: da diretti.zonacliente (priorità) oppure Anagrafiche.zoncliente
      var zonaStr = (cc && zonaMap[cc]) ? zonaMap[cc] : '';
      if (!zonaStr && ana) {
        zonaStr = String(ana.zoncliente || '').trim();
      }
      tr._zona = zonaStr || 'N/D';

      // Sesso da Anagrafiche
      var sessoRaw = ana ? String(ana.sesso || '').trim().toUpperCase() : '';
      tr._isDonna  = (sessoRaw === 'F');

      // CF Titolare da Anagrafiche
      var cfTit = ana ? String(ana.cftitolare || '').trim().toUpperCase() : '';

      // Straniero: 12° char del CF titolare = 'Z'
      tr._isStraniero = (cfTit.length >= 12 && cfTit.charAt(11).toUpperCase() === 'Z');
      tr._nazionalita = tr._isStraniero ? 'Straniero' : (cfTit.length >= 12 ? 'Italiano' : '');

      // Giovani: anno nascita da posizioni 7-8 del CF titolare
      tr._isGiovane = false;
      tr._fascia    = null;
      if (cfTit.length === 16) {
        var a2 = cfTit.substring(6, 8);
        if (/^\d{2}$/.test(a2)) {
          var y2 = parseInt(a2, 10);
          var threshold = ANNO - 2000;
          var annoNasc = y2 <= threshold ? 2000 + y2 : 1900 + y2;
          var eta = ANNO - annoNasc;
          tr._isGiovane = eta <= 40;
          if (tr._isGiovane) {
            if (eta <= 25)      tr._fascia = '≤25 anni';
            else if (eta <= 30) tr._fascia = '26–30 anni';
            else if (eta <= 35) tr._fascia = '31–35 anni';
            else                tr._fascia = '36–40 anni';
          }
        }
      }

      // ATECO 2007: da Anagrafiche.codiceateco, normalizzato
      var atecoRaw = ana ? normAteco(ana.codiceateco) : '';
      tr._ateco = atecoRaw;

      // Flag settoriali (prefisso sul codice ATECO normalizzato)
      tr._isCommercio = atecoRaw.startsWith('46') || atecoRaw.startsWith('47');
      tr._isTurismo   = atecoRaw.startsWith('55') || atecoRaw.startsWith('56') || atecoRaw.startsWith('79');
      tr._isCinema    = atecoRaw.startsWith('591') || atecoRaw.startsWith('592');
    });

    raggData = tess || [];

    // Raccoglie anni disponibili (ordinati desc) per il filtro
    var anniSet = {};
    raggData.forEach(function(r) { if (r._anno) anniSet[r._anno] = 1; });
    raggAnni = Object.keys(anniSet).map(Number).sort(function(a,b){ return b-a; });

    // Raccoglie zone disponibili (dal DB, non inventate) per popolare il filtro
    var zoneSet = {};
    raggData.forEach(function(r) { if (r._zona && r._zona !== 'N/D') zoneSet[r._zona] = 1; });
    raggZone = Object.keys(zoneSet).sort();

    raggLoaded = true;
    pb(100, 'Completato!');

    setTimeout(function() {
      raggBuildUI();
      raggRenderAll(raggCompute(raggData));
    }, 300);

  } catch (e) {
    console.error('❌ raggruppamenti:', e);
    var t = G('tab-raggruppamenti');
    if (t) t.innerHTML = '<div style="padding:40px;color:red"><h2>Errore</h2><p>' + e.message + '</p></div>';
  } finally {
    raggLoading = false;
    if (typeof hideLoad === 'function') hideLoad();
  }
}

// ── Calcolo statistiche ────────────────────────────────────────────────────────
function raggCompute(records) {
  // Zone dinamiche: quelle presenti nei record (nomi esatti dal DB)
  var zoneSet = {};
  records.forEach(function(r) { zoneSet[r._zona || 'N/D'] = 1; });
  var ZONE = Object.keys(zoneSet).sort(function(a, b) {
    if (a === 'N/D') return 1;
    if (b === 'N/D') return -1;
    return a.localeCompare(b, 'it');
  });

  function newZoneObj() {
    var o = {};
    ZONE.forEach(function(z) { o[z] = { n: 0, donne: 0, stranieri: 0, giovani: 0 }; });
    return o;
  }

  function emptyByZona() {
    var o = {};
    ZONE.forEach(function(z) { o[z] = 0; });
    return o;
  }

  var s = {
    tot:       records.length,
    zone:      newZoneObj(),
    commercio: { tot: 0, donne: 0, stranieri: 0, byZona: emptyByZona() },
    turismo:   { tot: 0, donne: 0, stranieri: 0, byZona: emptyByZona() },
    cinema:    { tot: 0, donne: 0, stranieri: 0, byZona: emptyByZona() },
    donne:     { tot: 0, stranieri: 0, giovani: 0, byZona: emptyByZona() },
    stranieri: { tot: 0, donne: 0, giovani: 0, byZona: emptyByZona() },
    giovani:   { tot: 0, donne: 0, stranieri: 0, byFascia: {}, byZona: emptyByZona() }
  };

  records.forEach(function(r) {
    var z = r._zona || 'N/D';
    if (!s.zone[z]) s.zone[z] = { n: 0, donne: 0, stranieri: 0, giovani: 0 };
    s.zone[z].n++;
    if (r._isDonna)     s.zone[z].donne++;
    if (r._isStraniero) s.zone[z].stranieri++;
    if (r._isGiovane)   s.zone[z].giovani++;

    function addZ(cat) {
      if (!s[cat].byZona[z] !== undefined) s[cat].byZona[z] = (s[cat].byZona[z] || 0) + 1;
      s[cat].byZona[z] = (s[cat].byZona[z] || 0) + 1;
    }

    if (r._isCommercio) {
      s.commercio.tot++;
      if (r._isDonna)     s.commercio.donne++;
      if (r._isStraniero) s.commercio.stranieri++;
      addZ('commercio');
    }
    if (r._isTurismo) {
      s.turismo.tot++;
      if (r._isDonna)     s.turismo.donne++;
      if (r._isStraniero) s.turismo.stranieri++;
      addZ('turismo');
    }
    if (r._isCinema) {
      s.cinema.tot++;
      if (r._isDonna)     s.cinema.donne++;
      if (r._isStraniero) s.cinema.stranieri++;
      addZ('cinema');
    }
    if (r._isDonna) {
      s.donne.tot++;
      if (r._isStraniero) s.donne.stranieri++;
      if (r._isGiovane)   s.donne.giovani++;
      addZ('donne');
    }
    if (r._isStraniero) {
      s.stranieri.tot++;
      if (r._isDonna)   s.stranieri.donne++;
      if (r._isGiovane) s.stranieri.giovani++;
      addZ('stranieri');
    }
    if (r._isGiovane) {
      s.giovani.tot++;
      if (r._isDonna)     s.giovani.donne++;
      if (r._isStraniero) s.giovani.stranieri++;
      if (r._fascia) s.giovani.byFascia[r._fascia] = (s.giovani.byFascia[r._fascia] || 0) + 1;
      addZ('giovani');
    }
  });

  return s;
}

// ── Build UI ───────────────────────────────────────────────────────────────────
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
      .ragg-head{padding:15px 18px;color:#fff;display:flex;align-items:center;
        gap:10px;font-weight:800;font-size:14px;letter-spacing:.3px}
      .ragg-body{padding:18px 20px}
      .ragg-big{font-size:42px;font-weight:900;letter-spacing:-1.5px;line-height:1}
      .ragg-sub{font-size:13px;font-weight:600;color:var(--text-secondary,#475569);margin-top:4px}
      .ragg-desc{font-size:12px;color:var(--text,#1e293b);font-weight:500;margin-top:2px}
      .ragg-bar{background:var(--border,#e2e8f0);border-radius:999px;height:8px;overflow:hidden;margin:6px 0}
      .ragg-bar-fill{height:100%;border-radius:999px;transition:width .7s cubic-bezier(.4,0,.2,1)}
      .ragg-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
        border-radius:999px;font-size:12px;font-weight:700;border:1px solid transparent}
      .ragg-kpi3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
      .ragg-kpi-cell{background:var(--surface2,#f8fafc);border-radius:10px;padding:12px 8px;text-align:center}
      .ragg-kpi-num{font-size:24px;font-weight:900;line-height:1}
      .ragg-kpi-lbl{font-size:11px;font-weight:700;color:var(--text-secondary,#475569);margin-top:4px;line-height:1.2}
      .ragg-sec{font-size:11px;font-weight:800;color:var(--text-secondary,#475569);
        text-transform:uppercase;letter-spacing:.08em;margin:14px 0 8px}
      .ragg-zona-row{display:flex;align-items:center;gap:8px;margin-bottom:9px}
      .ragg-zona-name{font-size:13px;font-weight:700;color:var(--text,#1e293b);min-width:170px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ragg-zona-n{font-size:13px;font-weight:800;min-width:40px;text-align:right}
      .ragg-zona-pct{font-size:12px;font-weight:600;color:var(--text-secondary,#475569);
        min-width:38px;text-align:right}
      .ragg-zona-pills{display:flex;gap:4px;min-width:200px;justify-content:flex-end;flex-wrap:nowrap}
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
        <select id="ragg-f-anno" style="padding:7px 12px;border-radius:8px;
          border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);
          font-size:13px;font-weight:600;color:var(--text,#1e293b);cursor:pointer">
          <option value="">Tutti gli anni</option>
        </select>
        <select id="ragg-f-zona" style="padding:7px 12px;border-radius:8px;
          border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);
          font-size:13px;font-weight:600;color:var(--text,#1e293b);cursor:pointer">
          <option value="">Tutte le zone</option>
        </select>
        <select id="ragg-f-sesso" style="padding:7px 12px;border-radius:8px;
          border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);
          font-size:13px;font-weight:600;color:var(--text,#1e293b);cursor:pointer">
          <option value="">Tutti i sessi</option>
          <option value="M">Maschi</option>
          <option value="F">Femmine</option>
        </select>
        <select id="ragg-f-naz" style="padding:7px 12px;border-radius:8px;
          border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff);
          font-size:13px;font-weight:600;color:var(--text,#1e293b);cursor:pointer">
          <option value="">Italiani e Stranieri</option>
          <option value="Italiano">Italiani</option>
          <option value="Straniero">Stranieri</option>
        </select>
        <button id="ragg-reset" style="padding:7px 16px;border-radius:8px;border:none;
          background:#005CA9;color:#fff;font-size:13px;font-weight:700;cursor:pointer">↺ Reset</button>
        <span id="ragg-tot-label" style="font-size:13px;font-weight:700;
          color:var(--text,#1e293b);margin-left:auto"></span>
      </div>
      <div id="ragg-boxes"></div>
    </div>`;

  // Popola anni dinamicamente
  var selAnno = G('ragg-f-anno');
  if (selAnno) {
    raggAnni.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      selAnno.appendChild(opt);
    });
  }

  // Popola zone dinamicamente (nomi esatti dal DB)
  var selZona = G('ragg-f-zona');
  if (selZona) {
    raggZone.forEach(function(z) {
      var opt = document.createElement('option');
      opt.value = z; opt.textContent = z;
      selZona.appendChild(opt);
    });
  }

  ['ragg-f-anno','ragg-f-zona','ragg-f-sesso','ragg-f-naz'].forEach(function(id) {
    var el = G(id); if (el) el.addEventListener('change', raggApplyFilter);
  });
  var rst = G('ragg-reset');
  if (rst) rst.addEventListener('click', function() {
    ['ragg-f-anno','ragg-f-zona','ragg-f-sesso','ragg-f-naz'].forEach(function(id) {
      var el = G(id); if (el) el.value = '';
    });
    raggApplyFilter();
  });
}

function raggApplyFilter() {
  var annoF  = (G('ragg-f-anno') || {}).value || '';
  var zonaF  = (G('ragg-f-zona') || {}).value || '';
  var sessoF = (G('ragg-f-sesso') || {}).value || '';
  var nazF   = (G('ragg-f-naz')  || {}).value || '';

  var filtered = raggData.filter(function(r) {
    if (annoF && String(r._anno || '') !== annoF)       return false;
    if (zonaF && r._zona !== zonaF)                     return false;
    if (sessoF === 'F' && !r._isDonna)                  return false;
    if (sessoF === 'M' && r._isDonna)                   return false;
    if (nazF   && r._nazionalita !== nazF)              return false;
    return true;
  });

  raggRenderAll(raggCompute(filtered));

  // Ripristina valori dopo re-render
  if (G('ragg-f-anno'))  G('ragg-f-anno').value  = annoF;
  if (G('ragg-f-zona'))  G('ragg-f-zona').value  = zonaF;
  if (G('ragg-f-sesso')) G('ragg-f-sesso').value = sessoF;
  if (G('ragg-f-naz'))   G('ragg-f-naz').value   = nazF;
}

// ── Render ─────────────────────────────────────────────────────────────────────
function raggRenderAll(s) {
  var cont = G('ragg-boxes'); if (!cont) return;
  var lbl  = G('ragg-tot-label');
  if (lbl) {
    var totGlobale = raggData.length;
    if (s.tot === totGlobale) {
      lbl.textContent = s.tot.toLocaleString('it-IT') + ' nuovi associati';
      lbl.style.color = 'var(--text,#1e293b)';
    } else {
      lbl.innerHTML = '<span style="color:#005CA9;font-weight:900">' + s.tot.toLocaleString('it-IT') + '</span>'
        + ' su ' + totGlobale.toLocaleString('it-IT') + ' filtrati';
    }
  }

  var html = '';

  // ── Riga 1: ZONE (larghezza piena) ──
  html += raggZoneCard(s);

  // ── Righe 2-3: 3 colonne ──
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:18px">';
  html += raggSimpleCard(s.commercio, s.tot, {
    title: '🛒 Commercio', color: '#F59E0B',
    desc:  'Imprese con ATECO che inizia per 46 o 47',
    icon:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
  });
  html += raggSimpleCard(s.turismo, s.tot, {
    title: '🏨 Turismo', color: '#3B82F6',
    desc:  'Imprese con ATECO che inizia per 55, 56 o 79',
    icon:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
  });
  html += raggSimpleCard(s.cinema, s.tot, {
    title: '🎬 Cinema e Audiovisivo', color: '#8B5CF6',
    desc:  'Imprese con ATECO che inizia per 591 o 592',
    icon:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>'
  });
  html += raggDonneCard(s.donne, s.tot);
  html += raggStranCard(s.stranieri, s.tot);
  html += raggGiovaniCard(s.giovani, s.tot);
  html += '</div>';

  cont.innerHTML = html;

  setTimeout(function() {
    cont.querySelectorAll('.ragg-bar-fill[data-w]').forEach(function(el) {
      el.style.width = el.getAttribute('data-w');
    });
  }, 60);
}

// ── Box Zone ───────────────────────────────────────────────────────────────────
function raggZoneCard(s) {
  // Palette ciclica — si adatta a qualsiasi nome di zona venga dal DB
  var PALETTE = ['#005CA9','#3B82F6','#10B981','#F59E0B','#8B5CF6',
                 '#06B6D4','#EC4899','#F97316','#EF4444','#14B8A6'];

  var zoneOrd = Object.keys(s.zone)
    .filter(function(z) { return s.zone[z].n > 0; })
    .sort(function(a, b) {
      if (a === 'N/D') return 1;
      if (b === 'N/D') return -1;
      return s.zone[b].n - s.zone[a].n;
    });
  var maxN = zoneOrd.length ? s.zone[zoneOrd[0]].n : 1;
  var totMappate = zoneOrd
    .filter(function(z) { return z !== 'N/D'; })
    .reduce(function(acc, z) { return acc + s.zone[z].n; }, 0);

  var rows = zoneOrd.map(function(zona) {
    var d   = s.zone[zona];
    var col = zona === 'N/D' ? '#cbd5e1' : (PALETTE[zoneOrd.indexOf(zona) % PALETTE.length] || '#64748b');
    var pct = s.tot > 0 ? (d.n / s.tot * 100).toFixed(1) : '0';
    var bar = Math.round(d.n / maxN * 100);
    var pD  = d.n > 0 ? (d.donne     / d.n * 100).toFixed(0) : '0';
    var pS  = d.n > 0 ? (d.stranieri / d.n * 100).toFixed(0) : '0';
    var pG  = d.n > 0 ? (d.giovani   / d.n * 100).toFixed(0) : '0';
    return `
      <div class="ragg-zona-row ragg-anim">
        <div class="ragg-zona-name" style="color:${col}">${zona}</div>
        <div style="flex:1">
          <div class="ragg-bar">
            <div class="ragg-bar-fill" data-w="${bar}%" style="background:${col};width:0%"></div>
          </div>
        </div>
        <div class="ragg-zona-n" style="color:${col}">${d.n.toLocaleString('it-IT')}</div>
        <div class="ragg-zona-pct">${pct}%</div>
        <div class="ragg-zona-pills">
          <span class="ragg-pill" style="background:rgba(236,72,153,.12);color:#be185d;border-color:rgba(236,72,153,.3)">♀ ${pD}%</span>
          <span class="ragg-pill" style="background:rgba(16,185,129,.12);color:#065f46;border-color:rgba(16,185,129,.3)">🌍 ${pS}%</span>
          <span class="ragg-pill" style="background:rgba(59,130,246,.12);color:#1e40af;border-color:rgba(59,130,246,.3)">⚡ ${pG}%</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-head" style="background:linear-gradient(135deg,#14B8A6,#0D9488)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
        Zone
        <span style="font-size:12px;font-weight:500;opacity:.85;margin-left:auto">
          ${totMappate.toLocaleString('it-IT')} di ${s.tot.toLocaleString('it-IT')} associati con area mappata
        </span>
      </div>
      <div class="ragg-body">
        <div style="display:flex;font-size:11px;font-weight:800;color:var(--text-secondary,#475569);
          text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;gap:8px">
          <span style="min-width:170px">Zona</span>
          <span style="flex:1"></span>
          <span style="min-width:40px;text-align:right">N</span>
          <span style="min-width:38px;text-align:right">%</span>
          <span style="min-width:200px;text-align:right">♀ Donne · 🌍 Stranieri · ⚡ Giovani</span>
        </div>
        ${rows}
      </div>
    </div>`;
}

// ── Box settore generico ────────────────────────────────────────────────────────
function raggSimpleCard(d, totTot, cfg) {
  var pct  = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctD = d.tot > 0 ? (d.donne     / d.tot * 100).toFixed(1) : '0';
  var pctS = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';

  var zoneOrd = Object.entries(d.byZona)
    .filter(function(x) { return x[1] > 0 && x[0] !== 'N/D'; })
    .sort(function(a, b) { return b[1] - a[1]; });
  var maxA = zoneOrd.length ? zoneOrd[0][1] : 1;

  var zoneHtml = zoneOrd.slice(0, 5).map(function(x) {
    var bar = Math.round(x[1] / maxA * 100);
    var p   = d.tot > 0 ? (x[1] / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${x[0]}</span>
        <span style="color:${cfg.color};font-weight:800">${x[1]}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${p}%)</span></span>
      </div>
      <div class="ragg-bar">
        <div class="ragg-bar-fill" data-w="${bar}%" style="background:${cfg.color};width:0%;opacity:.8"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-head" style="background:linear-gradient(135deg,${cfg.color},${cfg.color}cc)">
        ${cfg.icon} ${cfg.title}
      </div>
      <div class="ragg-body">
        <div class="ragg-big" style="color:${cfg.color}">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-sub">${pct}% dei nuovi associati</div>
        <div class="ragg-desc">${cfg.desc}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="ragg-pill" style="background:rgba(236,72,153,.12);color:#be185d;border-color:rgba(236,72,153,.3)">♀ Donne ${pctD}%</span>
          <span class="ragg-pill" style="background:rgba(16,185,129,.12);color:#065f46;border-color:rgba(16,185,129,.3)">🌍 Stranieri ${pctS}%</span>
        </div>
        <div class="ragg-sec">Per zona</div>
        ${zoneHtml || '<span style="font-size:13px;color:var(--text-secondary,#475569)">Nessun dato</span>'}
      </div>
    </div>`;
}

// ── Box Donne ──────────────────────────────────────────────────────────────────
function raggDonneCard(d, totTot) {
  var pct  = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctS = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';
  var pctG = d.tot > 0 ? (d.giovani   / d.tot * 100).toFixed(1) : '0';

  var zoneOrd = Object.entries(d.byZona)
    .filter(function(x) { return x[1] > 0 && x[0] !== 'N/D'; })
    .sort(function(a, b) { return b[1] - a[1]; });
  var maxA = zoneOrd.length ? zoneOrd[0][1] : 1;

  var zHtml = zoneOrd.slice(0, 5).map(function(x) {
    var bar = Math.round(x[1] / maxA * 100);
    var p   = d.tot > 0 ? (x[1] / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${x[0]}</span>
        <span style="color:#EC4899;font-weight:800">${x[1]}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${p}%)</span></span>
      </div>
      <div class="ragg-bar">
        <div class="ragg-bar-fill" data-w="${bar}%" style="background:#EC4899;width:0%"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-head" style="background:linear-gradient(135deg,#EC4899,#db2777)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <circle cx="12" cy="8" r="4"/><path d="M12 12v8M9 18h6"/>
        </svg>
        👩 Donne
      </div>
      <div class="ragg-body">
        <div class="ragg-big" style="color:#EC4899">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-sub">${pct}% dei nuovi associati</div>
        <div class="ragg-desc">Imprese con titolare di sesso femminile</div>
        <div class="ragg-kpi3">
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#EC4899">${d.tot.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Totale</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#10B981">${d.stranieri.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Straniere<br>${pctS}%</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#3B82F6">${d.giovani.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Giovani ≤40<br>${pctG}%</div>
          </div>
        </div>
        <div class="ragg-sec">Per zona</div>
        ${zHtml}
      </div>
    </div>`;
}

// ── Box Stranieri ──────────────────────────────────────────────────────────────
function raggStranCard(d, totTot) {
  var pct  = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctD = d.tot > 0 ? (d.donne   / d.tot * 100).toFixed(1) : '0';
  var pctG = d.tot > 0 ? (d.giovani / d.tot * 100).toFixed(1) : '0';

  var zoneOrd = Object.entries(d.byZona)
    .filter(function(x) { return x[1] > 0 && x[0] !== 'N/D'; })
    .sort(function(a, b) { return b[1] - a[1]; });
  var maxA = zoneOrd.length ? zoneOrd[0][1] : 1;

  var zHtml = zoneOrd.slice(0, 5).map(function(x) {
    var bar = Math.round(x[1] / maxA * 100);
    var p   = d.tot > 0 ? (x[1] / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${x[0]}</span>
        <span style="color:#10B981;font-weight:800">${x[1]}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${p}%)</span></span>
      </div>
      <div class="ragg-bar">
        <div class="ragg-bar-fill" data-w="${bar}%" style="background:#10B981;width:0%"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-head" style="background:linear-gradient(135deg,#10B981,#059669)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        🌍 Stranieri
      </div>
      <div class="ragg-body">
        <div class="ragg-big" style="color:#10B981">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-sub">${pct}% dei nuovi associati</div>
        <div class="ragg-desc">Titolari con nazionalità straniera (12° char CF = Z)</div>
        <div class="ragg-kpi3">
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#10B981">${d.tot.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Totale</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#EC4899">${d.donne.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Donne<br>${pctD}%</div>
          </div>
          <div class="ragg-kpi-cell">
            <div class="ragg-kpi-num" style="color:#3B82F6">${d.giovani.toLocaleString('it-IT')}</div>
            <div class="ragg-kpi-lbl">Giovani ≤40<br>${pctG}%</div>
          </div>
        </div>
        <div class="ragg-sec">Per zona</div>
        ${zHtml}
      </div>
    </div>`;
}

// ── Box Giovani ────────────────────────────────────────────────────────────────
function raggGiovaniCard(d, totTot) {
  var pct  = totTot > 0 ? (d.tot / totTot * 100).toFixed(1) : '0';
  var pctD = d.tot > 0 ? (d.donne     / d.tot * 100).toFixed(1) : '0';
  var pctS = d.tot > 0 ? (d.stranieri / d.tot * 100).toFixed(1) : '0';

  var FASCE = ['≤25 anni','26–30 anni','31–35 anni','36–40 anni'];
  var maxF  = Math.max.apply(null, FASCE.map(function(f) { return d.byFascia[f] || 0; })) || 1;

  var fascHtml = FASCE.map(function(f) {
    var n   = d.byFascia[f] || 0;
    var bar = Math.round(n / maxF * 100);
    var p   = d.tot > 0 ? (n / d.tot * 100).toFixed(1) : '0';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700;color:var(--text,#1e293b)">${f}</span>
        <span style="color:#EF4444;font-weight:800">${n.toLocaleString('it-IT')}
          <span style="color:var(--text-secondary,#475569);font-weight:500">(${p}%)</span></span>
      </div>
      <div class="ragg-bar">
        <div class="ragg-bar-fill" data-w="${bar}%" style="background:#EF4444;width:0%"></div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ragg-card ragg-anim">
      <div class="ragg-head" style="background:linear-gradient(135deg,#EF4444,#DC2626)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        🌱 Giovani
      </div>
      <div class="ragg-body">
        <div class="ragg-big" style="color:#EF4444">${d.tot.toLocaleString('it-IT')}</div>
        <div class="ragg-sub">${pct}% dei nuovi associati</div>
        <div class="ragg-desc">Titolari con età ≤ 40 anni (CF titolare da Anagrafiche)</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="ragg-pill" style="background:rgba(236,72,153,.12);color:#be185d;border-color:rgba(236,72,153,.3)">♀ Donne ${pctD}%</span>
          <span class="ragg-pill" style="background:rgba(16,185,129,.12);color:#065f46;border-color:rgba(16,185,129,.3)">🌍 Stranieri ${pctS}%</span>
        </div>
        <div class="ragg-sec">Fasce d'età</div>
        ${fascHtml}
      </div>
    </div>`;
}
