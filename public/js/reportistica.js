// ══════════════════════════════════════════════════════════════════════════════
// REPORTISTICA.JS — Tab Reportistica Admin CNA Roma Dashboard
// Genera report PDF professionale mensile da dati Analisi + Ateco
// ══════════════════════════════════════════════════════════════════════════════
console.log('✅ reportistica.js CARICATO');

var reportisticaLoaded = false;
var reportisticaLoading = false;

// ── INIT TAB ──────────────────────────────────────────────────────────────────
function reportisticaInit() {
  if (!isAdmin()) return;
  buildReportisticaUI();
}

function buildReportisticaUI() {
  var tab = G('tab-reportistica');
  if (!tab) return;

  // Popola selettori anno/mese
  var anniOpt = '';
  for (var y = 2026; y >= 2020; y--) {
    anniOpt += '<option value="' + y + '"' + (y === new Date().getFullYear() ? ' selected' : '') + '>' + y + '</option>';
  }
  var mesiOpt = MESI.slice(1).map(function (m, i) {
    var num = i + 1;
    var sel = num === new Date().getMonth() + 1 ? ' selected' : '';
    return '<option value="' + num + '"' + sel + '>' + m + '</option>';
  }).join('');

  tab.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;padding:24px 20px">

      <!-- HEADER SEZIONE -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="margin:0;font-size:22px;font-weight:800;color:var(--text)">
            <span style="color:var(--primary)">📋</span> Generatore Report Mensile
          </h2>
          <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-secondary)">
            Report professionale PDF con logo e intestazioni — solo per amministratori
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 14px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          <span style="font-size:12px;font-weight:700;color:#EF4444">SOLO ADMIN</span>
        </div>
      </div>

      <!-- CONFIGURAZIONE REPORT -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:var(--shadow-sm)">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;background:var(--primary);border-radius:50%;display:inline-block"></span>
          Configurazione Report
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;align-items:end">
          <div>
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Anno</label>
            <select id="rep-anno" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;font-weight:600">
              ${anniOpt}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Mese di riferimento</label>
            <select id="rep-mese" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;font-weight:600">
              ${mesiOpt}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Tipo Report</label>
            <select id="rep-tipo" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;font-weight:600">
              <option value="completo">Completo (Analisi + Ateco)</option>
              <option value="analisi">Solo Analisi Tesseramento</option>
              <option value="ateco">Solo Analisi Ateco</option>
            </select>
          </div>
          <div style="display:flex;gap:10px">
            <button onclick="caricaDatiReport()" id="rep-btn-carica"
              style="flex:1;padding:10px 16px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.33"/></svg>
              Carica Dati
            </button>
          </div>
        </div>
      </div>

      <!-- STATUS CARICAMENTO -->
      <div id="rep-status" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;align-items:center;gap:10px">
          <div id="rep-spinner" style="width:18px;height:18px;border:3px solid var(--primary-glow);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite"></div>
          <span id="rep-status-text" style="font-size:13px;color:var(--text-secondary)">Caricamento in corso…</span>
        </div>
      </div>

      <!-- ANTEPRIMA REPORT -->
      <div id="rep-preview-wrap" style="display:none">

        <!-- KPI MENSILI -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow-sm)">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;background:#3B82F6;border-radius:50%;display:inline-block"></span>
            Anteprima Dati — <span id="rep-titolo-periodo" style="color:var(--primary)">...</span>
          </div>
          <div id="rep-kpi-strip" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:0"></div>
        </div>

        <!-- DIMENSIONE: TIPO RETE + PROMOTORE -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px" id="rep-grid-dimensioni">
          <div id="rep-card-tiporete" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
            <div style="background:#3B82F6;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;font-weight:700;color:white">🔗 Tipo Rete</span>
              <span id="rep-badge-tiporete" style="background:rgba(255,255,255,0.2);color:white;font-size:11px;padding:2px 8px;border-radius:20px">...</span>
            </div>
            <div style="padding:12px"><canvas id="rep-chart-tiporete" height="180"></canvas></div>
            <div style="padding:0 12px 12px 12px"><table id="rep-table-tiporete" style="width:100%;font-size:11px;border-collapse:collapse"></table></div>
          </div>
          <div id="rep-card-promotore" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
            <div style="background:#EC4899;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;font-weight:700;color:white">👤 Promotore</span>
              <span id="rep-badge-promotore" style="background:rgba(255,255,255,0.2);color:white;font-size:11px;padding:2px 8px;border-radius:20px">...</span>
            </div>
            <div style="padding:12px"><canvas id="rep-chart-promotore" height="180"></canvas></div>
            <div style="padding:0 12px 12px 12px"><table id="rep-table-promotore" style="width:100%;font-size:11px;border-collapse:collapse"></table></div>
          </div>
        </div>

        <!-- CONFRONTO ANNI (tabella) -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow-sm)">
          <div style="background:#8B5CF6;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:12px;font-weight:700;color:white">📊 Confronto anni — Mese selezionato</span>
            <span id="rep-badge-confronto" style="background:rgba(255,255,255,0.2);color:white;font-size:11px;padding:2px 8px;border-radius:20px">...</span>
          </div>
          <div style="padding:12px;overflow-x:auto">
            <table id="rep-table-confronto" style="width:100%;font-size:11px;border-collapse:collapse"></table>
          </div>
          <div style="padding:0 12px 12px 12px"><canvas id="rep-chart-trend" height="120"></canvas></div>
        </div>

        <!-- SERIE STORICA -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow-sm)">
          <div style="background:#DC2626;padding:12px 16px">
            <span style="font-size:12px;font-weight:700;color:white">📅 Serie Storica Mensile</span>
          </div>
          <div style="padding:12px;overflow-x:auto">
            <table id="rep-table-storica" style="width:100%;font-size:11px;border-collapse:collapse"></table>
          </div>
        </div>

        <!-- ATECO PREVIEW -->
        <div id="rep-ateco-section" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow-sm)">
          <div style="background:#0D9488;padding:12px 16px">
            <span style="font-size:12px;font-weight:700;color:white">🏭 Analisi Ateco — Anno selezionato</span>
          </div>
          <div style="padding:16px">
            <div id="rep-ateco-kpi" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="rep-ateco-grids">
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">TOP UNIONI</div>
                <table id="rep-table-unioni" style="width:100%;font-size:11px;border-collapse:collapse"></table>
              </div>
              <div>
                <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px">TOP MESTIERI</div>
                <table id="rep-table-mestieri" style="width:100%;font-size:11px;border-collapse:collapse"></table>
              </div>
            </div>
          </div>
        </div>

        <!-- BOTTONE GENERA PDF -->
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;padding-bottom:24px">
          <button onclick="caricaDatiReport()" style="padding:12px 20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-weight:600;font-size:13px;cursor:pointer">
            🔄 Aggiorna Dati
          </button>
          <button onclick="generaReportPDFMensile()" id="rep-btn-pdf"
            style="padding:12px 24px;background:linear-gradient(135deg,#005CA9,#0073C8);color:white;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(0,92,169,0.3)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
            Genera Report PDF
          </button>
        </div>

      </div>

    </div>
  `;

  // Auto-carica all'apertura della tab
  caricaDatiReport();
}

// ── CARICA DATI ──────────────────────────────────────────────────────────────
async function caricaDatiReport() {
  if (reportisticaLoading) return;
  reportisticaLoading = true;

  var anno = parseInt(G('rep-anno').value);
  var mese = parseInt(G('rep-mese').value);
  var tipo = G('rep-tipo').value;

  setRepStatus(true, 'Caricamento dati tesseramento…');

  try {
    // Carica tutti i record
    var allRec = await sbGetAll(TR);

    setRepStatus(true, 'Elaborazione dati…');

    // Filtra per mese selezionato
    var recMese = allRec.filter(function (r) {
      return parseInt(r.mese) === mese && parseInt(r.anno) === anno;
    });

    // Filtra per anno selezionato (YTD)
    var recAnno = allRec.filter(function (r) {
      return parseInt(r.anno) === anno;
    });

    // Tutti gli anni per serie storica
    var recAll = allRec;

    if (tipo !== 'ateco') {
      renderKPIMensili(recMese, recAnno, anno, mese);
      renderDimensioni(recMese, anno, mese);
      renderConfronto(recAll, mese);
      renderSerieStorica(recAll);
    }

    if (tipo !== 'analisi') {
      setRepStatus(true, 'Caricamento dati Ateco…');
      var atecoRec = allRec.filter(function (r) { return parseInt(r.anno) === anno; });
      renderAtecoPreview(atecoRec, anno);
    } else {
      if (G('rep-ateco-section')) G('rep-ateco-section').style.display = 'none';
    }

    G('rep-titolo-periodo').textContent = MESI[mese] + ' ' + anno;
    setRepStatus(false);
    G('rep-preview-wrap').style.display = 'block';

  } catch (e) {
    console.error('Errore caricaDatiReport:', e);
    setRepStatus(false);
    toast('Errore caricamento dati: ' + e.message, 'error');
  } finally {
    reportisticaLoading = false;
  }
}

function setRepStatus(show, msg) {
  var el = G('rep-status');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (msg && G('rep-status-text')) G('rep-status-text').textContent = msg;
}

// ── RENDER KPI MENSILI ────────────────────────────────────────────────────────
function renderKPIMensili(recMese, recAnno, anno, mese) {
  var totM = recMese.reduce(function (s, r) { return s + (parseFloat(r.importo) || 0); }, 0);
  var cntM = recMese.length;
  var avgM = cntM > 0 ? totM / cntM : 0;

  var totA = recAnno.reduce(function (s, r) { return s + (parseFloat(r.importo) || 0); }, 0);
  var cntA = recAnno.length;

  // Confronto vs anno precedente (stesso mese)
  var kpis = [
    { label: 'Totale Importo', value: '€ ' + fmt(totM, 0), sub: MESI[mese] + ' ' + anno, color: '#3B82F6' },
    { label: 'Nr. Contratti', value: cntM, sub: 'Mese corrente', color: '#10B981' },
    { label: 'Importo Medio', value: '€ ' + fmt(avgM, 0), sub: 'Per contratto', color: '#8B5CF6' },
    { label: 'Totale YTD', value: '€ ' + fmt(totA, 0), sub: 'Gen–' + MESI[mese] + ' ' + anno, color: '#F59E0B' },
    { label: 'Contratti YTD', value: cntA, sub: 'Anno in corso', color: '#EC4899' },
  ];

  var html = kpis.map(function (k) {
    return '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;border-top:3px solid ' + k.color + ';background:var(--surface)">' +
      '<div style="font-size:10px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">' + k.label + '</div>' +
      '<div style="font-size:22px;font-weight:800;color:var(--text);margin-top:4px">' + k.value + '</div>' +
      '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px">' + k.sub + '</div>' +
      '</div>';
  }).join('');

  G('rep-kpi-strip').innerHTML = html;
}

// ── RENDER DIMENSIONI (Tipo Rete + Promotore) ─────────────────────────────────
function renderDimensioni(recMese, anno, mese) {
  // TIPO RETE
  var byRete = {};
  recMese.forEach(function (r) {
    var k = r.tipo_rete || r.tiporete || r.rete || 'N/D';
    if (!byRete[k]) byRete[k] = { cnt: 0, tot: 0 };
    byRete[k].cnt++;
    byRete[k].tot += parseFloat(r.importo) || 0;
  });
  var totaleMese = recMese.reduce(function (s, r) { return s + (parseFloat(r.importo) || 0); }, 0);
  var reteKeys = Object.keys(byRete).sort(function (a, b) { return byRete[b].tot - byRete[a].tot; });

  G('rep-badge-tiporete').textContent = reteKeys.length + ' voci';
  renderMiniChart('rep-chart-tiporete', reteKeys, reteKeys.map(function (k) { return byRete[k].tot; }), ['#3B82F6', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6']);
  renderDimTable('rep-table-tiporete', reteKeys, byRete, totaleMese);

  // PROMOTORE
  var byPromo = {};
  recMese.forEach(function (r) {
    var k = r.promotore || r.a_cura_di || r.acuradi || 'N/D';
    if (!byPromo[k]) byPromo[k] = { cnt: 0, tot: 0 };
    byPromo[k].cnt++;
    byPromo[k].tot += parseFloat(r.importo) || 0;
  });
  var promoKeys = Object.keys(byPromo).sort(function (a, b) { return byPromo[b].tot - byPromo[a].tot; });

  G('rep-badge-promotore').textContent = promoKeys.length + ' voci';
  renderMiniChart('rep-chart-promotore', promoKeys, promoKeys.map(function (k) { return byPromo[k].tot; }), COLORS_PROMO);
  renderDimTable('rep-table-promotore', promoKeys, byPromo, totaleMese);
}

function renderMiniChart(canvasId, labels, values, colors) {
  var canvas = G(canvasId);
  if (!canvas) return;
  var ctxKey = 'repChart_' + canvasId;
  if (charts[ctxKey]) { charts[ctxKey].destroy(); delete charts[ctxKey]; }
  var ctx = canvas.getContext('2d');
  charts[ctxKey] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(function (l) { return l.length > 18 ? l.substring(0, 16) + '…' : l; }),
      datasets: [{
        data: values,
        backgroundColor: labels.map(function (_, i) { return colors[i % colors.length]; }),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, callback: function (v) { return '€' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v); } } }
      }
    }
  });
}

function renderDimTable(tableId, keys, data, totale) {
  var tbl = G(tableId);
  if (!tbl) return;
  var h = '<thead><tr style="border-bottom:2px solid #e5e7eb">' +
    '<th style="text-align:left;padding:5px 6px;font-size:10px;color:#666;text-transform:uppercase">Categoria</th>' +
    '<th style="text-align:right;padding:5px 6px;font-size:10px;color:#666">Nr.</th>' +
    '<th style="text-align:right;padding:5px 6px;font-size:10px;color:#666">Importo</th>' +
    '<th style="text-align:right;padding:5px 6px;font-size:10px;color:#666">% Tot.</th>' +
    '<th style="text-align:right;padding:5px 6px;font-size:10px;color:#666">Media</th>' +
    '</tr></thead><tbody>';
  keys.forEach(function (k) {
    var d = data[k];
    var pct = totale > 0 ? (d.tot / totale * 100).toFixed(1) : '0.0';
    var avg = d.cnt > 0 ? d.tot / d.cnt : 0;
    h += '<tr style="border-bottom:1px solid #f1f5f9">' +
      '<td style="padding:5px 6px;font-size:11px;font-weight:600">' + k + '</td>' +
      '<td style="padding:5px 6px;font-size:11px;text-align:right">' + d.cnt + '</td>' +
      '<td style="padding:5px 6px;font-size:11px;text-align:right;font-weight:600">€ ' + fmt(d.tot, 0) + '</td>' +
      '<td style="padding:5px 6px;font-size:11px;text-align:right;color:#6366f1">' + pct + '%</td>' +
      '<td style="padding:5px 6px;font-size:11px;text-align:right;color:#059669">€ ' + fmt(avg, 0) + '</td>' +
      '</tr>';
  });
  // Totale
  var cntTot = keys.reduce(function (s, k) { return s + data[k].cnt; }, 0);
  var avgTot = cntTot > 0 ? totale / cntTot : 0;
  h += '<tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e5e7eb">' +
    '<td style="padding:6px;font-size:11px">Totale</td>' +
    '<td style="padding:6px;font-size:11px;text-align:right">' + cntTot + '</td>' +
    '<td style="padding:6px;font-size:11px;text-align:right">€ ' + fmt(totale, 0) + '</td>' +
    '<td style="padding:6px;font-size:11px;text-align:right">100%</td>' +
    '<td style="padding:6px;font-size:11px;text-align:right">€ ' + fmt(avgTot, 0) + '</td>' +
    '</tr></tbody>';
  tbl.innerHTML = h;
}

// ── CONFRONTO ANNI ────────────────────────────────────────────────────────────
function renderConfronto(recAll, mese) {
  // Raggruppa per promotore × anno, filtrato per mese selezionato
  var anni = [];
  var byPromoAnno = {};
  var totPerAnno = {};

  recAll.forEach(function (r) {
    if (parseInt(r.mese) !== mese) return;
    var a = String(r.anno || '');
    var p = r.promotore || r.a_cura_di || r.acuradi || 'N/D';
    if (!a) return;
    if (anni.indexOf(a) === -1) anni.push(a);
    if (!byPromoAnno[p]) byPromoAnno[p] = {};
    if (!byPromoAnno[p][a]) byPromoAnno[p][a] = { cnt: 0, tot: 0 };
    byPromoAnno[p][a].cnt++;
    byPromoAnno[p][a].tot += parseFloat(r.importo) || 0;
    if (!totPerAnno[a]) totPerAnno[a] = 0;
    totPerAnno[a] += parseFloat(r.importo) || 0;
  });

  anni.sort();
  var promos = Object.keys(byPromoAnno).sort(function (a, b) {
    var la = anni.reduce(function (s, y) { return s + (byPromoAnno[a][y] ? byPromoAnno[a][y].cnt : 0); }, 0);
    var lb = anni.reduce(function (s, y) { return s + (byPromoAnno[b][y] ? byPromoAnno[b][y].cnt : 0); }, 0);
    return lb - la;
  });

  G('rep-badge-confronto').textContent = promos.length + ' promotori';

  // Tabella
  var h = '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb">' +
    '<th style="text-align:left;padding:6px 8px;font-size:10px;color:#666;text-transform:uppercase;white-space:nowrap">Promotore</th>';
  anni.forEach(function (a) {
    h += '<th colspan="2" style="text-align:center;padding:6px 8px;font-size:10px;color:#666;border-left:1px solid #e5e7eb">' + a + '</th>';
  });
  h += '<th style="text-align:right;padding:6px 8px;font-size:10px;color:#666;border-left:2px solid #e5e7eb">Δ ' + (anni[anni.length - 1] || '') + '→' + (anni[anni.length - 2] || '') + '</th></tr>';
  h += '<tr style="border-bottom:1px solid #e5e7eb">' +
    '<th style="padding:4px 8px"></th>';
  anni.forEach(function () {
    h += '<th style="padding:4px 6px;font-size:9px;color:#999;text-align:right;border-left:1px solid #f1f5f9">Nr.</th><th style="padding:4px 6px;font-size:9px;color:#999;text-align:right">% Tot.</th>';
  });
  h += '<th></th></tr></thead><tbody>';

  promos.forEach(function (p) {
    h += '<tr style="border-bottom:1px solid #f1f5f9">';
    h += '<td style="padding:5px 8px;font-size:11px;font-weight:600;white-space:nowrap">' + p + '</td>';
    var lastCnt = 0, prevCnt = 0;
    anni.forEach(function (a, ai) {
      var d = byPromoAnno[p][a] || { cnt: 0, tot: 0 };
      var tot = totPerAnno[a] || 0;
      var pct = tot > 0 ? (d.cnt / tot * 100).toFixed(1) : '0.0';
      if (ai === anni.length - 1) lastCnt = d.cnt;
      if (ai === anni.length - 2) prevCnt = d.cnt;
      h += '<td style="padding:5px 6px;font-size:11px;text-align:right;border-left:1px solid #f1f5f9">' + d.cnt + '</td>';
      h += '<td style="padding:5px 6px;font-size:11px;text-align:right;color:#6366f1">' + pct + '%</td>';
    });
    // Delta
    var delta = prevCnt > 0 ? ((lastCnt - prevCnt) / prevCnt * 100) : (lastCnt > 0 ? 100 : 0);
    var dColor = delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#6B7280';
    var dArrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '–';
    h += '<td style="padding:5px 8px;font-size:11px;text-align:right;font-weight:700;color:' + dColor + ';border-left:2px solid #e5e7eb">' + dArrow + ' ' + Math.abs(delta).toFixed(1) + '%</td>';
    h += '</tr>';
  });

  // Totale riga
  h += '<tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e5e7eb">';
  h += '<td style="padding:6px 8px;font-size:11px">TOTALE</td>';
  var anniTotCnt = {};
  anni.forEach(function (a) {
    var tot = promos.reduce(function (s, p) { return s + (byPromoAnno[p][a] ? byPromoAnno[p][a].cnt : 0); }, 0);
    anniTotCnt[a] = tot;
    h += '<td style="padding:6px;font-size:11px;text-align:right;border-left:1px solid #e5e7eb">' + tot + '</td><td style="padding:6px;font-size:11px;text-align:right">100%</td>';
  });
  var lastA = anni[anni.length - 1], prevA = anni[anni.length - 2];
  var dtot = prevA && anniTotCnt[prevA] > 0 ? ((anniTotCnt[lastA] - anniTotCnt[prevA]) / anniTotCnt[prevA] * 100) : 0;
  var dtColor = dtot > 0 ? '#10B981' : dtot < 0 ? '#EF4444' : '#6B7280';
  var dtArrow = dtot > 0 ? '▲' : dtot < 0 ? '▼' : '–';
  h += '<td style="padding:6px;font-size:11px;text-align:right;font-weight:700;color:' + dtColor + ';border-left:2px solid #e5e7eb">' + dtArrow + ' ' + Math.abs(dtot).toFixed(1) + '%</td>';
  h += '</tr></tbody>';

  G('rep-table-confronto').innerHTML = h;

  // Grafico trend
  var ctxKey = 'repChartTrend';
  if (charts[ctxKey]) { charts[ctxKey].destroy(); delete charts[ctxKey]; }
  var canvas = G('rep-chart-trend');
  if (canvas) {
    charts[ctxKey] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: anni,
        datasets: [{
          label: 'Nr. Contratti',
          data: anni.map(function (a) { return anniTotCnt[a] || 0; }),
          borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.08)',
          tension: 0.4, fill: true, pointBackgroundColor: '#8B5CF6', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }
}

// ── SERIE STORICA ─────────────────────────────────────────────────────────────
function renderSerieStorica(recAll) {
  var anni = [];
  var matrice = {}; // mese → anno → cnt

  recAll.forEach(function (r) {
    var a = String(r.anno || '');
    var m = parseInt(r.mese);
    if (!a || !m) return;
    if (anni.indexOf(a) === -1) anni.push(a);
    if (!matrice[m]) matrice[m] = {};
    if (!matrice[m][a]) matrice[m][a] = 0;
    matrice[m][a]++;
  });

  anni.sort();
  var lastA = anni[anni.length - 1];
  var prevA = anni[anni.length - 2];

  var h = '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb">' +
    '<th style="text-align:left;padding:6px 8px;font-size:10px;color:#666;text-transform:uppercase">Mese</th>';
  anni.forEach(function (a) {
    var isLast = a === lastA;
    h += '<th style="text-align:right;padding:6px 8px;font-size:10px;color:' + (isLast ? 'var(--primary)' : '#666') + ';' + (isLast ? 'font-weight:800' : '') + '">' + a + '</th>';
  });
  if (prevA) {
    h += '<th style="text-align:right;padding:6px 8px;font-size:10px;color:#EF4444">su ' + prevA + '</th>';
    h += '<th style="text-align:right;padding:6px 8px;font-size:10px;color:#6B7280">su ' + (anni[anni.length - 3] || prevA) + '</th>';
  }
  h += '</tr></thead><tbody>';

  for (var m = 1; m <= 12; m++) {
    var row = matrice[m] || {};
    var hasData = Object.keys(row).length > 0;
    if (!hasData && m > new Date().getMonth() + 1) continue; // Nascondi mesi futuri senza dati
    var lastVal = row[lastA] || 0;
    var prevVal = prevA ? (row[prevA] || 0) : 0;
    var prevPrevA = anni[anni.length - 3];
    var prevPrevVal = prevPrevA ? (row[prevPrevA] || 0) : 0;
    var diff1 = prevVal > 0 ? lastVal - prevVal : null;
    var diff2 = prevPrevVal > 0 ? lastVal - prevPrevVal : null;

    var bg = m % 2 === 0 ? 'background:#f8fafc' : '';
    h += '<tr style="border-bottom:1px solid #f1f5f9;' + bg + '">';
    h += '<td style="padding:5px 8px;font-size:11px;font-weight:700">' + MESI[m] + '</td>';
    anni.forEach(function (a) {
      var v = row[a] || 0;
      var isLast = a === lastA;
      h += '<td style="padding:5px 8px;font-size:11px;text-align:right;' + (isLast ? 'font-weight:700;color:var(--primary)' : 'color:var(--text-secondary)') + '">' + (v || (hasData ? '–' : '')) + '</td>';
    });
    if (prevA) {
      var d1c = diff1 === null ? '#6B7280' : diff1 > 0 ? '#10B981' : diff1 < 0 ? '#EF4444' : '#6B7280';
      var d1t = diff1 === null ? '–' : (diff1 > 0 ? '+' : '') + diff1;
      var d2c = diff2 === null ? '#6B7280' : diff2 > 0 ? '#10B981' : diff2 < 0 ? '#EF4444' : '#6B7280';
      var d2t = diff2 === null ? '–' : (diff2 > 0 ? '+' : '') + diff2;
      h += '<td style="padding:5px 8px;font-size:11px;text-align:right;font-weight:700;color:' + d1c + '">' + d1t + '</td>';
      h += '<td style="padding:5px 8px;font-size:11px;text-align:right;color:' + d2c + '">' + d2t + '</td>';
    }
    h += '</tr>';
  }

  // Totale
  h += '<tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e5e7eb">';
  h += '<td style="padding:6px 8px;font-size:11px">Totale</td>';
  var totAnni = {};
  anni.forEach(function (a) {
    var t = Object.values(matrice).reduce(function (s, row) { return s + (row[a] || 0); }, 0);
    totAnni[a] = t;
    var isLast = a === lastA;
    h += '<td style="padding:6px 8px;font-size:11px;text-align:right;' + (isLast ? 'color:var(--primary)' : '') + '">' + t + '</td>';
  });
  if (prevA) {
    var tDiff = totAnni[lastA] - (totAnni[prevA] || 0);
    var tDiff2 = totAnni[lastA] - (totAnni[anni[anni.length - 3]] || 0);
    h += '<td style="padding:6px;font-size:11px;text-align:right;font-weight:700;color:' + (tDiff > 0 ? '#10B981' : '#EF4444') + '">' + (tDiff > 0 ? '+' : '') + tDiff + '</td>';
    h += '<td style="padding:6px;font-size:11px;text-align:right;color:' + (tDiff2 > 0 ? '#10B981' : '#EF4444') + '">' + (tDiff2 > 0 ? '+' : '') + tDiff2 + '</td>';
  }
  h += '</tr></tbody>';

  G('rep-table-storica').innerHTML = h;
}

// ── ATECO PREVIEW ─────────────────────────────────────────────────────────────
function renderAtecoPreview(recAteco, anno) {
  var sec = G('rep-ateco-section');
  if (sec) sec.style.display = 'block';

  var tot = recAteco.length;
  var byUnione = {}, byMestiere = {};
  var donne = 0, stranieri = 0;

  recAteco.forEach(function (r) {
    var u = r.unione || 'N/D';
    var m = r.mestiere || 'N/D';
    if (!byUnione[u]) byUnione[u] = 0;
    byUnione[u]++;
    if (!byMestiere[m]) byMestiere[m] = 0;
    byMestiere[m]++;
    if (String(r.sesso || '').trim() === 'Femmina') donne++;
    if (String(r.nazionalita || '').trim() === 'Straniero') stranieri++;
  });

  // KPI Ateco
  var kpiAteco = [
    { label: 'Imprese Totali', value: tot.toLocaleString('it-IT'), color: '#0D9488' },
    { label: 'Unioni', value: Object.keys(byUnione).length, color: '#0284C7' },
    { label: 'Mestieri', value: Object.keys(byMestiere).length, color: '#7C3AED' },
    { label: '% Donne', value: tot > 0 ? (donne / tot * 100).toFixed(1) + '%' : '0%', color: '#EC4899' },
    { label: '% Stranieri', value: tot > 0 ? (stranieri / tot * 100).toFixed(1) + '%' : '0%', color: '#F59E0B' },
  ];

  G('rep-ateco-kpi').innerHTML = kpiAteco.map(function (k) {
    return '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;border-left:3px solid ' + k.color + '">' +
      '<div style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase">' + k.label + '</div>' +
      '<div style="font-size:20px;font-weight:800;color:#333;margin-top:3px">' + k.value + '</div>' +
      '</div>';
  }).join('');

  // Top unioni
  var topUnioni = Object.entries(byUnione).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  var topMestieri = Object.entries(byMestiere).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);

  function renderTopTable(tableId, items, totale) {
    var tbl = G(tableId);
    if (!tbl) return;
    var h = '<thead><tr style="border-bottom:2px solid #e5e7eb">' +
      '<th style="text-align:left;padding:5px 6px;font-size:10px;color:#666">Nome</th>' +
      '<th style="text-align:right;padding:5px 6px;font-size:10px;color:#666">Nr.</th>' +
      '<th style="text-align:right;padding:5px 6px;font-size:10px;color:#666">%</th>' +
      '</tr></thead><tbody>';
    items.forEach(function (item) {
      var pct = totale > 0 ? (item[1] / totale * 100).toFixed(1) : '0';
      h += '<tr style="border-bottom:1px solid #f1f5f9">' +
        '<td style="padding:4px 6px;font-size:11px">' + item[0] + '</td>' +
        '<td style="padding:4px 6px;font-size:11px;text-align:right;font-weight:700">' + item[1] + '</td>' +
        '<td style="padding:4px 6px;font-size:11px;text-align:right;color:#0D9488">' + pct + '%</td>' +
        '</tr>';
    });
    h += '</tbody>';
    tbl.innerHTML = h;
  }

  renderTopTable('rep-table-unioni', topUnioni, tot);
  renderTopTable('rep-table-mestieri', topMestieri, tot);
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERAZIONE PDF PROFESSIONALE
// ══════════════════════════════════════════════════════════════════════════════

async function generaReportPDFMensile() {
  if (!isAdmin()) { toast('Accesso non autorizzato', 'error'); return; }

  var anno = G('rep-anno').value;
  var mese = parseInt(G('rep-mese').value);
  var tipo = G('rep-tipo').value;

  var btn = G('rep-btn-pdf');
  btn.disabled = true;
  btn.innerHTML = '<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;margin-right:8px"></div> Generazione in corso…';

  showLoad('Preparazione report…');

  try {
    var LOGO_URL = 'https://raw.githubusercontent.com/alessandroparrelli/fileappoggio/17b50df8f22632eb360e1da944d997289a598012/NUOVO-LOGO-CNA-ROMA-SOLO-ROMA.png';
    var meseStr = MESI[mese] + ' ' + anno;
    var oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

    // Carica logo
    var logoDataUrl = await loadImageAsDataUrl(LOGO_URL);

    // Cattura grafici
    var chartTipoRete = captureCanvas('rep-chart-tiporete');
    var chartPromo = captureCanvas('rep-chart-promotore');
    var chartTrend = captureCanvas('rep-chart-trend');

    // Setup jsPDF
    var { jsPDF } = window.jspdf;
    var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var PW = 210, PH = 297, ML = 14, MR = 14, MT = 14;
    var CW = PW - ML - MR;

    var pageNum = 0;
    function newPage() {
      if (pageNum > 0) pdf.addPage();
      pageNum++;
      drawPageFrame(pdf, logoDataUrl, meseStr, oggi, pageNum, PW, PH, ML);
    }

    // ── PAGINA 1: KPI + Dimensioni ──
    newPage();
    var y = 50;

    // Titolo sezione
    pdf.setFillColor(0, 92, 169);
    pdf.rect(ML, y, CW, 7, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
    pdf.text('DATO MENSILE: ' + meseStr.toUpperCase(), ML + 4, y + 5);
    y += 12;

    // KPI Cards row
    var kpiEl = G('rep-kpi-strip');
    if (kpiEl) {
      var kpiCards = kpiEl.querySelectorAll('div[style]');
      var kpiW = CW / Math.min(kpiCards.length, 5);
      var kpiColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];
      kpiCards.forEach(function (card, i) {
        if (i >= 5) return;
        var kx = ML + i * kpiW;
        var labelEl = card.querySelector('div:nth-child(1)');
        var valEl = card.querySelector('div:nth-child(2)');
        var subEl = card.querySelector('div:nth-child(3)');
        var label = labelEl ? labelEl.textContent : '';
        var val = valEl ? valEl.textContent : '';
        var sub = subEl ? subEl.textContent : '';

        pdf.setDrawColor(220, 220, 220);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(kx, y, kpiW - 1, 22, 2, 2, 'FD');
        // top border color
        var rgb = hexToRgb(kpiColors[i]);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(kx, y, kpiW - 1, 1.5, 'F');

        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
        pdf.text(label.toUpperCase(), kx + 3, y + 6);
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
        pdf.text(val, kx + 3, y + 14);
        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
        pdf.text(sub, kx + 3, y + 19);
      });
    }
    y += 27;

    // Sezione "Report per dimensione"
    drawSectionTitle(pdf, 'REPORT PER DIMENSIONE', ML, y, CW); y += 9;

    var halfW = (CW - 4) / 2;

    // Card Tipo Rete
    y = drawDimCard(pdf, 'TIPO RETE', ML, y, halfW, chartTipoRete, 'rep-table-tiporete', '#3B82F6');
    var yAfterTipoRete = y;

    // Card Promotore (stessa riga)
    y = drawDimCard(pdf, 'PROMOTORE', ML + halfW + 4, yAfterTipoRete - (yAfterTipoRete - 91), halfW, chartPromo, 'rep-table-promotore', '#EC4899');
    y = Math.max(y, yAfterTipoRete);

    // ── PAGINA 2: Confronto anni + Serie storica ──
    newPage();
    y = 50;

    drawSectionTitle(pdf, 'RAFFRONTO MESE CON ANNI PRECEDENTI: ' + MESI[mese].toUpperCase(), ML, y, CW); y += 9;

    // Tabella confronto
    y = drawHTMLTable(pdf, 'rep-table-confronto', ML, y, CW, '#8B5CF6');
    y += 6;

    // Grafico trend
    if (chartTrend) {
      pdf.setDrawColor(220, 220, 220);
      pdf.setFillColor(250, 250, 252);
      pdf.roundedRect(ML, y, CW, 38, 2, 2, 'FD');
      pdf.addImage(chartTrend, 'PNG', ML + 2, y + 2, CW - 4, 34);
      y += 42;
    }

    drawSectionTitle(pdf, 'SERIE STORICA MENSILE', ML, y, CW); y += 9;
    y = drawHTMLTable(pdf, 'rep-table-storica', ML, y, CW, '#DC2626');

    // ── PAGINA 3: Ateco (se richiesto) ──
    if (tipo !== 'analisi') {
      newPage();
      y = 50;

      drawSectionTitle(pdf, 'ANALISI ATECO — ANNO ' + anno, ML, y, CW); y += 9;

      // KPI Ateco
      var atecoKpiEl = G('rep-ateco-kpi');
      if (atecoKpiEl) {
        var atecoCards = atecoKpiEl.querySelectorAll('div[style]');
        var akW = CW / Math.min(atecoCards.length, 5);
        var akColors = ['#0D9488', '#0284C7', '#7C3AED', '#EC4899', '#F59E0B'];
        atecoCards.forEach(function (card, i) {
          if (i >= 5) return;
          var ax = ML + i * akW;
          var lbl = card.querySelector('div:nth-child(1)');
          var val = card.querySelector('div:nth-child(2)');
          var rgb = hexToRgb(akColors[i]);

          pdf.setDrawColor(220, 220, 220);
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(ax, y, akW - 1, 16, 2, 2, 'FD');
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.rect(ax, y, 1.5, 16, 'F');

          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
          pdf.text(lbl ? lbl.textContent.toUpperCase() : '', ax + 4, y + 6);
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
          pdf.text(val ? val.textContent : '', ax + 4, y + 13);
        });
        y += 20;
      }

      var halfWA = (CW - 4) / 2;
      drawSectionTitle(pdf, 'TOP 10 UNIONI', ML, y, halfWA); 
      drawSectionTitle(pdf, 'TOP 10 MESTIERI', ML + halfWA + 4, y, halfWA);
      y += 9;

      var yU = drawHTMLTable(pdf, 'rep-table-unioni', ML, y, halfWA, '#0D9488');
      var yM = drawHTMLTable(pdf, 'rep-table-mestieri', ML + halfWA + 4, y, halfWA, '#7C3AED');
      y = Math.max(yU, yM);
    }

    // ── SALVA ──
    var filename = 'Report_CNA_Roma_' + MESI[mese] + '_' + anno + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    pdf.save(filename);

    toast('✓ Report generato: ' + filename, 'success');

  } catch (e) {
    console.error('Errore generazione PDF:', e);
    toast('Errore PDF: ' + e.message, 'error');
  } finally {
    hideLoad();
    btn.disabled = false;
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Genera Report PDF';
  }
}

// ── HELPER: FRAME PAGINA ──────────────────────────────────────────────────────
function drawPageFrame(pdf, logoDataUrl, meseStr, oggi, pageNum, PW, PH, ML) {
  var CW = PW - ML * 2;

  // Sfondo header
  pdf.setFillColor(0, 92, 169);
  pdf.rect(0, 0, PW, 34, 'F');

  // Logo
  if (logoDataUrl) {
    try { pdf.addImage(logoDataUrl, 'PNG', ML, 5, 40, 24); } catch (e) {}
  }

  // Titolo report
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
  pdf.text('Dati tesseramento ' + meseStr, PW - ML, 14, { align: 'right' });
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(200, 220, 240);
  pdf.text('CNA Roma — Report mensile', PW - ML, 20, { align: 'right' });
  pdf.text('Generato il ' + oggi, PW - ML, 26, { align: 'right' });

  // Linea separator
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.3);
  pdf.line(ML, 36, PW - ML, 36);

  // Footer
  pdf.setFillColor(245, 247, 250);
  pdf.rect(0, PH - 10, PW, 10, 'F');
  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
  pdf.text('CNA Roma — Confederazione Nazionale dell\'Artigianato e della Piccola e Media Impresa', ML, PH - 4);
  pdf.text('Pagina ' + pageNum, PW - ML, PH - 4, { align: 'right' });
}

function drawSectionTitle(pdf, title, x, y, w) {
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(220, 220, 220);
  pdf.roundedRect(x, y, w, 7, 1, 1, 'FD');
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text('● ' + title, x + 3, y + 5);
}

function drawDimCard(pdf, title, x, y, w, chartImg, tableId, colorHex) {
  var startY = y;
  var rgb = hexToRgb(colorHex);
  
  // Header card
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.roundedRect(x, y, w, 7, 1, 1, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.text(title, x + 3, y + 5);
  y += 9;

  // Grafico
  if (chartImg) {
    pdf.addImage(chartImg, 'PNG', x, y, w, 35);
    y += 37;
  }

  // Tabella
  y = drawHTMLTable(pdf, tableId, x, y, w, colorHex);
  return y + 2;
}

function drawHTMLTable(pdf, tableId, x, y, w, headerColorHex) {
  var tbl = G(tableId);
  if (!tbl) return y;

  var headerRgb = hexToRgb(headerColorHex || '#3B82F6');
  var rows = tbl.querySelectorAll('tr');
  var ROW_H = 5.5;
  var FONT_SIZE = 7;
  var colCount = 0;
  if (rows.length > 0) colCount = rows[0].querySelectorAll('th, td').length;
  if (colCount === 0) return y;
  var colW = w / colCount;

  rows.forEach(function (row, ri) {
    var cells = row.querySelectorAll('th, td');
    var isHeader = row.parentElement && row.parentElement.tagName === 'THEAD';
    var isTotal = ri === rows.length - 1;
    var bg = isHeader ? headerRgb : (isTotal ? { r: 248, g: 250, b: 252 } : (ri % 2 === 0 ? { r: 255, g: 255, b: 255 } : { r: 248, g: 250, b: 252 }));

    pdf.setFillColor(bg.r, bg.g, bg.b);
    pdf.rect(x, y, w, ROW_H, 'F');

    cells.forEach(function (cell, ci) {
      var cx = x + ci * colW;
      var cellText = (cell.textContent || '').trim();
      var isRight = cell.style.textAlign === 'right' || (ci > 0 && !isHeader);

      if (isHeader) {
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
      } else if (isTotal) {
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setTextColor(60, 60, 60);
        pdf.setFont('helvetica', 'normal');
      }

      pdf.setFontSize(FONT_SIZE);
      var maxLen = Math.floor(colW / 1.5);
      if (cellText.length > maxLen) cellText = cellText.substring(0, maxLen - 1) + '…';

      if (isRight) {
        pdf.text(cellText, cx + colW - 1, y + ROW_H - 1.5, { align: 'right' });
      } else {
        pdf.text(cellText, cx + 1, y + ROW_H - 1.5);
      }
    });

    y += ROW_H;
    // Linea separatrice
    pdf.setDrawColor(235, 235, 235);
    pdf.setLineWidth(0.1);
    pdf.line(x, y, x + w, y);
  });

  return y + 2;
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function captureCanvas(id) {
  var el = G(id);
  if (!el || !el.toDataURL) return null;
  try { return el.toDataURL('image/png'); } catch (e) { return null; }
}

function loadImageAsDataUrl(url) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL('image/png')); }
      catch (e) { resolve(null); }
    };
    img.onerror = function () { resolve(null); };
    img.src = url;
  });
}

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return { r: r, g: g, b: b };
}

// Alias locale per fmt (usa la funzione globale del dashboard)
function fmt(n, dec) {
  if (typeof n !== 'number') n = parseFloat(n) || 0;
  var d = dec !== undefined ? dec : 2;
  return n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
}
