// ══════════════════════════════════════════════════════════════════════════════
// STORICA.JS — Tab Serie Storica
// Legge serie_storica da Supabase. Dal 2026/mese>=4 i valori sono
// auto-calcolati dal count dei contratti (tabella TR = cnacontratti).
// ══════════════════════════════════════════════════════════════════════════════
console.log('✅ storica.js CARICATO');

var storicaLoaded = false;
var storicaLoading = false;

// Nomi mesi (indice 1-12, indice 7 = Lug/Ago)
var STORICA_MESI = ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio/Ago','','Settembre','Ottobre','Novembre','Dicembre'];

// Anno/mese da cui i valori diventano auto-calcolati
var STORICA_AUTO_DA_ANNO = 2026;
var STORICA_AUTO_DA_MESE = 4;

// ── INIT ──────────────────────────────────────────────────────────────────────
function storicaInit() {
  buildStoricaUI();
}

function buildStoricaUI() {
  var tab = G('tab-storica');
  if (!tab) return;

  tab.innerHTML = '<div style="max-width:1200px;margin:0 auto;padding:24px 20px 60px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
    + '<div><h2 style="margin:0;font-size:22px;font-weight:800;color:var(--text)">📅 Serie Storica</h2>'
    + '<p style="margin:4px 0 0;font-size:13px;color:var(--text-secondary)">Contratti per anno e mese — dal 2026/apr aggiornati automaticamente dai dati Supabase</p></div>'
    + (isAdmin() ? '<button onclick="storicaAggiornaDal2026()" style="padding:9px 16px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">🔄 Ricalcola 2026</button>' : '')
    + '</div>'
    + '<div id="storica-status" style="display:none;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">'
    + '<span id="storica-status-text" style="font-size:13px;color:var(--text-secondary)">Caricamento…</span></div>'
    + '<div id="storica-content"></div>'
    + '</div>';

  storicaLoad();
}

function storicaSetStatus(show, msg) {
  var el = G('storica-status');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (msg && G('storica-status-text')) G('storica-status-text').textContent = msg;
}

// ── CARICA DATI ───────────────────────────────────────────────────────────────
async function storicaLoad() {
  if (storicaLoading) return;
  storicaLoading = true;
  storicaSetStatus(true, 'Caricamento serie storica…');

  try {
    // Carica tutti i record della serie storica tramite fetch diretto
    var data = await sbGetAll('serie_storica');

    // Ordina per anno poi mese
    data.sort(function(a,b){ return a.anno!==b.anno ? a.anno-b.anno : a.mese-b.mese; });

    storicaRender(data || []);
    storicaSetStatus(false);
    storicaLoaded = true;

  } catch(e) {
    console.error('storicaLoad error:', e);
    storicaSetStatus(false);
    var ct = G('storica-content');
    if (ct) ct.innerHTML = '<div style="padding:40px;text-align:center;color:#EF4444">Errore caricamento: ' + e.message + '</div>';
  } finally {
    storicaLoading = false;
  }
}

// ── RENDER TABELLA ────────────────────────────────────────────────────────────
function storicaRender(data) {
  var ct = G('storica-content');
  if (!ct) return;

  // Costruisce matrice: matrix[mese][anno] = valore
  var anni = [];
  var matrix = {};
  var anniSet = {};

  data.forEach(function(r) {
    anniSet[r.anno] = 1;
    if (!matrix[r.mese]) matrix[r.mese] = {};
    matrix[r.mese][r.anno] = { v: r.valore, auto: r.auto_calcolato };
  });

  anni = Object.keys(anniSet).map(Number).sort(function(a,b){return a-b;});

  // Mostra solo gli ultimi anni (ultimi 10 + scorri orizzontalmente)
  var anniVis = anni;

  // Mesi ordinati (indice 7 = luglio/ago, manca 8)
  var mesiOrd = [1,2,3,4,5,6,7,9,10,11,12];

  // Calcola totali per anno
  var totAnno = {};
  anni.forEach(function(a) {
    totAnno[a] = mesiOrd.reduce(function(s,m) {
      return s + (matrix[m] && matrix[m][a] ? (matrix[m][a].v || 0) : 0);
    }, 0);
  });

  // Colore heat-map per cella
  function cellBg(v, mese) {
    if (v === null || v === undefined) return '';
    // Per mese corrente o futuri senza dati
    var allVals = anni.map(function(a){ return matrix[mese]&&matrix[mese][a]?matrix[mese][a].v:null; }).filter(function(x){return x!==null;});
    if (!allVals.length) return '';
    var maxV = Math.max.apply(null, allVals);
    var minV = Math.min.apply(null, allVals);
    if (maxV === minV) return '';
    var pct = (v - minV) / (maxV - minV);
    // Da bianco a blu CNA
    var r = Math.round(255 - pct * (255 - 0));
    var g = Math.round(255 - pct * (255 - 92));
    var b = Math.round(255 - pct * (255 - 169));
    var textColor = pct > 0.55 ? 'white' : '#0f172a';
    return 'background:rgb('+r+','+g+','+b+');color:'+textColor+';';
  }

  // ── KPI strip ──
  var annoCorrente = new Date().getFullYear();
  var recAnnoCorr = data.filter(function(r){return r.anno===annoCorrente;});
  var totCorr = recAnnoCorr.reduce(function(s,r){return s+(r.valore||0);},0);
  var recPrecCorr = data.filter(function(r){return r.anno===annoCorrente-1;});
  var totPrec = recPrecCorr.reduce(function(r,d){return r+(d.valore||0);},0);
  var delta = totPrec>0?(totCorr-totPrec)/totPrec*100:null;
  var deltaHtml = delta!==null ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+(delta>=0?'#10B981':'#EF4444')+';color:white">'+(delta>=0?'▲':'▼')+' '+Math.abs(delta).toFixed(1)+'%</span>' : '';

  var maxAnno = anni.reduce(function(mx,a){return totAnno[a]>totAnno[mx]?a:mx;}, anni[0]);
  var minAnno = anni.reduce(function(mn,a){return totAnno[a]<totAnno[mn]?a:mn;}, anni[0]);

  var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">'
    + storicaKPI('Totale '+annoCorrente, totCorr, 'Contratti YTD', '#3B82F6', deltaHtml)
    + storicaKPI('Anno migliore', maxAnno+' ('+totAnno[maxAnno]+')', 'Contratti totali', '#10B981', '')
    + storicaKPI('Anno minore', minAnno+' ('+totAnno[minAnno]+')', 'Contratti totali', '#F59E0B', '')
    + storicaKPI('Anni tracciati', anni.length, 'Dal '+anni[0]+' al '+anni[anni.length-1], '#8B5CF6', '')
    + '</div>';

  // ── TABELLA ──
  // Header anni
  var thAnni = '<th style="'+thStyle()+';position:sticky;left:0;z-index:2;background:#1e293b;min-width:110px">Mese</th>';
  anniVis.forEach(function(a) {
    var isNow = a === annoCorrente;
    thAnni += '<th style="'+thStyle()+(isNow?';background:#005CA9;':'')+'min-width:60px;text-align:center">' + a + '</th>';
  });
  thAnni += '<th style="'+thStyle()+';text-align:center;min-width:70px">Totale</th>';

  var rows = mesiOrd.map(function(m) {
    var nomeMese = STORICA_MESI[m];
    var isLugAgo = m === 7;

    var tds = '<td style="padding:7px 12px;font-size:12px;font-weight:700;color:#0f172a;position:sticky;left:0;background:white;border-right:2px solid #e2e8f0;white-space:nowrap;z-index:1">' + nomeMese + '</td>';
    var totMese = 0;

    anniVis.forEach(function(a) {
      var cell = matrix[m] && matrix[m][a] ? matrix[m][a] : null;
      var v = cell ? cell.v : null;
      var isAuto = cell && cell.auto;
      // Cella futura (anno>=2026 mese>=auto_da e nessun valore)
      var isFuture = (a > STORICA_AUTO_DA_ANNO || (a === STORICA_AUTO_DA_ANNO && m > STORICA_AUTO_DA_MESE)) && v === null;

      if (v !== null) totMese += v;

      var bg = (v !== null) ? cellBg(v, m) : '';
      var cellContent = v !== null ? v : (isFuture ? '<span style="color:#cbd5e1">–</span>' : '<span style="color:#cbd5e1">–</span>');
      var autoDot = isAuto ? '<span title="Auto-calcolato" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#10B981;margin-left:3px;vertical-align:middle"></span>' : '';

      tds += '<td style="padding:6px 8px;font-size:12px;text-align:center;border-bottom:1px solid #f1f5f9;'+bg+'">' + cellContent + autoDot + '</td>';
    });

    // Totale riga
    tds += '<td style="padding:6px 10px;font-size:12px;font-weight:700;text-align:center;background:#f8fafc;color:#0f172a;border-left:2px solid #e2e8f0">' + (totMese || '–') + '</td>';

    var rowBg = m % 2 === 0 ? 'background:#fafafa' : '';
    return '<tr style="border-bottom:1px solid #f1f5f9;'+rowBg+'">' + tds + '</tr>';
  }).join('');

  // Riga totale
  var totRow = '<tr style="background:#f8fafc;border-top:2px solid #e2e8f0;font-weight:700">'
    + '<td style="padding:7px 12px;font-size:12px;font-weight:700;position:sticky;left:0;background:#f8fafc;border-right:2px solid #e2e8f0;z-index:1">Totale</td>';
  var grandTot = 0;
  anniVis.forEach(function(a) {
    var t = totAnno[a] || 0;
    grandTot += t;
    var isNow = a === annoCorrente;
    totRow += '<td style="padding:7px 8px;font-size:12px;font-weight:700;text-align:center;'+(isNow?'color:#005CA9':'color:#475569')+'">' + (t||'–') + '</td>';
  });
  totRow += '<td style="padding:7px 10px;font-size:12px;font-weight:800;text-align:center;color:#005CA9;border-left:2px solid #e2e8f0">' + grandTot + '</td>';
  totRow += '</tr>';

  var tableHtml = '<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:white;box-shadow:var(--shadow-sm)">'
    + '<div style="overflow-x:auto">'
    + '<table style="width:100%;border-collapse:collapse;min-width:900px">'
    + '<thead><tr style="background:#1e293b">' + thAnni + '</tr></thead>'
    + '<tbody>' + rows + totRow + '</tbody>'
    + '</table></div>'
    + '<div style="padding:10px 16px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:16px">'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:50%;background:#10B981"></div><span style="font-size:11px;color:#64748b">Auto-calcolato da Supabase (dal Apr 2026)</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:16px;height:8px;border-radius:2px;background:linear-gradient(to right,#f0f5ff,#005CA9)"></div><span style="font-size:11px;color:#64748b">Intensità del valore</span></div>'
    + '</div></div>';

  // ── GRAFICO TREND ──
  var chartHtml = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:20px;box-shadow:var(--shadow-sm)">'
    + '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">📈 Trend totale annuale</div>'
    + '<canvas id="storica-chart-trend" height="100"></canvas></div>';

  ct.innerHTML = kpiHtml + tableHtml + chartHtml;

  // Renderizza grafico
  setTimeout(function() {
    var el = G('storica-chart-trend');
    if (!el) return;
    var ck = 'storicaTrend';
    if (charts[ck]) { charts[ck].destroy(); delete charts[ck]; }
    charts[ck] = new Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        labels: anniVis.map(String),
        datasets: [{
          label: 'Totale contratti',
          data: anniVis.map(function(a){ return totAnno[a]||0; }),
          borderColor: '#005CA9',
          backgroundColor: 'rgba(0,92,169,0.07)',
          tension: 0.4, fill: true,
          pointBackgroundColor: anniVis.map(function(a){ return a===annoCorrente?'#EF4444':'#005CA9'; }),
          pointRadius: anniVis.map(function(a){ return a===annoCorrente?6:4; }),
          pointBorderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(c){ return ' '+c.raw+' contratti'; } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }, 100);
}

function storicaKPI(label, value, sub, color, extraHtml) {
  return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-top:3px solid '+color+';background:var(--surface)">'
    + '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">'+label+'</div>'
    + '<div style="font-size:22px;font-weight:800;color:var(--text);line-height:1">'+value+'</div>'
    + '<div style="font-size:10px;color:#94a3b8;margin-top:3px">'+sub+'</div>'
    + (extraHtml ? '<div style="margin-top:6px">'+extraHtml+'</div>' : '')
    + '</div>';
}

function thStyle() {
  return 'padding:9px 8px;font-size:11px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap';
}

// ── RICALCOLA 2026 (solo admin) ───────────────────────────────────────────────
async function storicaAggiornaDal2026() {
  if (!isAdmin()) return;
  storicaSetStatus(true, 'Lettura contratti 2026 da Supabase…');

  try {
    // Conta contratti per anno/mese dalla tabella contratti (TR)
    var allContratti = await sbGetAll(TR);

    // Filtra solo 2026, mese >= 4
    var countMap = {};
    allContratti.forEach(function(r) {
      var a = parseInt(r.anno);
      var m = parseInt(r.mese);
      if (a < STORICA_AUTO_DA_ANNO) return;
      if (a === STORICA_AUTO_DA_ANNO && m < STORICA_AUTO_DA_MESE) return;
      var key = a + '_' + m;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    storicaSetStatus(true, 'Aggiornamento serie storica…');

    // Upsert per ogni combinazione trovata
    var upserts = Object.keys(countMap).map(function(key) {
      var parts = key.split('_');
      return { anno: parseInt(parts[0]), mese: parseInt(parts[1]), valore: countMap[key], auto_calcolato: true };
    });

    if (upserts.length === 0) {
      storicaSetStatus(false);
      toast('Nessun contratto 2026 (mese ≥ Aprile) trovato', 'info');
      return;
    }

    // Upsert tramite POST con Prefer: resolution=merge-duplicates
    await sbPost(
      'serie_storica',
      upserts,
      { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
    );

    storicaSetStatus(false);
    toast('✓ Aggiornati ' + upserts.length + ' mesi per il 2026', 'success');

    // Ricarica
    storicaLoaded = false;
    await storicaLoad();

  } catch(e) {
    console.error(e);
    storicaSetStatus(false);
    toast('Errore aggiornamento: ' + e.message, 'error');
  }
}
