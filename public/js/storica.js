// storica.js — Tab Serie Storica
console.log('storica.js CARICATO');

var storicaLoaded = false;
var storicaLoading = false;
var storicaData = [];
var storicaMeseSelezionato = 4; // default Aprile

var STORICA_MESI_NOMI = ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio/Ago','','Settembre','Ottobre','Novembre','Dicembre'];
var MESI_ORD = [1,2,3,4,5,6,7,9,10,11,12];
var STORICA_AUTO_DA_ANNO = 2026;
var STORICA_AUTO_DA_MESE = 4;

// ── INIT ──────────────────────────────────────────────────────────────────────
function storicaInit() {
  buildStoricaUI();
}

function buildStoricaUI() {
  var tab = G('tab-storica');
  if (!tab) return;

  // Opzioni mesi per il selettore grafico
  var mesiOpt = MESI_ORD.map(function(m) {
    return '<option value="'+m+'"'+(m===storicaMeseSelezionato?' selected':'')+'>'+STORICA_MESI_NOMI[m]+'</option>';
  }).join('');

  tab.innerHTML =
    '<div style="max-width:1300px;margin:0 auto;padding:24px 20px 60px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
    +'<div><h2 style="margin:0;font-size:22px;font-weight:800;color:var(--text)">📅 Serie Storica</h2>'
    +'<p style="margin:4px 0 0;font-size:13px;color:var(--text-secondary)">Contratti per anno e mese · dal Apr 2026 aggiornati automaticamente da Supabase</p></div>'
    +(isAdmin()?'<button onclick="storicaAggiornaDal2026()" style="padding:9px 16px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">🔄 Ricalcola 2026</button>':'')
    +'</div>'
    +'<div id="storica-status" style="display:none;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">'
    +'<span id="storica-status-text" style="font-size:13px;color:var(--text-secondary)">Caricamento…</span></div>'
    // KPI
    +'<div id="storica-kpi" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px"></div>'
    // TABELLA
    +'<div id="storica-table-wrap" style="border:1px solid #e2e8f0;border-radius:12px;background:white;box-shadow:var(--shadow-sm);margin-bottom:24px;overflow:hidden">'
    +'<div style="overflow-x:auto;overflow-y:auto;max-height:480px;">'
    +'<table id="storica-table" style="border-collapse:collapse;white-space:nowrap"></table>'
    +'</div>'
    +'<div style="padding:10px 16px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:16px">'
    +'<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:50%;background:#10B981"></div><span style="font-size:11px;color:#64748b">Auto-calcolato da Supabase</span></div>'
    +'<div style="display:flex;align-items:center;gap:5px"><div style="width:40px;height:8px;border-radius:2px;background:linear-gradient(to right,#f0f5ff,#005CA9)"></div><span style="font-size:11px;color:#64748b">Intensità</span></div>'
    +'</div></div>'
    // DUE GRAFICI — uno sopra l'altro, compatti
    +'<div style="display:flex;flex-direction:column;gap:16px">'
    // Grafico 1: totale annuale
    +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;box-shadow:var(--shadow-sm)">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">📊 Totale annuale</div>'
    +'<div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px">Contratti totali per ogni anno (anno corrente in rosso)</div>'
    +'<div style="position:relative;height:180px"><canvas id="storica-chart-anni"></canvas></div></div>'
    // Grafico 2: mese selezionato
    +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;box-shadow:var(--shadow-sm)">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text)">📈 Andamento mensile</div>'
    +'<select id="storica-sel-mese" onchange="storicaCambiaMese(this.value)" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;font-weight:600">'+mesiOpt+'</select>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px">Andamento dal 2000 per il mese selezionato</div>'
    +'<div style="position:relative;height:180px"><canvas id="storica-chart-mese"></canvas></div></div>'
    +'</div>'
    +'</div>';

  storicaLoad();
}

function storicaSetStatus(show, msg) {
  var el = G('storica-status');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (msg && G('storica-status-text')) G('storica-status-text').textContent = msg;
}

// ── CARICA ────────────────────────────────────────────────────────────────────
async function storicaLoad() {
  if (storicaLoading) return;
  storicaLoading = true;
  storicaSetStatus(true, 'Caricamento serie storica…');
  try {
    var data = await sbGetAll('serie_storica');
    data.sort(function(a,b){ return a.anno!==b.anno ? a.anno-b.anno : a.mese-b.mese; });
    storicaData = data;
    storicaRender(data);
    storicaSetStatus(false);
    storicaLoaded = true;
  } catch(e) {
    console.error('storicaLoad error:', e);
    storicaSetStatus(false);
    var ct = G('storica-table-wrap');
    if (ct) ct.innerHTML = '<div style="padding:40px;text-align:center;color:#EF4444">Errore: '+e.message+'</div>';
  } finally {
    storicaLoading = false;
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function storicaRender(data) {
  // Costruisce matrice
  var anniSet = {};
  var matrix = {};
  data.forEach(function(r) {
    anniSet[r.anno] = 1;
    if (!matrix[r.mese]) matrix[r.mese] = {};
    matrix[r.mese][r.anno] = { v: r.valore, auto: r.auto_calcolato };
  });
  var anni = Object.keys(anniSet).map(Number).sort(function(a,b){return a-b;});

  // Totale per anno (somma tutti i mesi)
  var totAnno = {};
  anni.forEach(function(a) {
    totAnno[a] = MESI_ORD.reduce(function(s,m){
      return s + (matrix[m]&&matrix[m][a] ? matrix[m][a].v||0 : 0);
    }, 0);
  });

  var annoCorrente = new Date().getFullYear();

  // ── KPI ──
  var totCorr = totAnno[annoCorrente] || 0;
  var totPrecAnno = totAnno[annoCorrente-1] || 0;
  var delta = totPrecAnno>0 ? (totCorr-totPrecAnno)/totPrecAnno*100 : null;
  var dHtml = delta!==null ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+(delta>=0?'#10B981':'#EF4444')+';color:white">'+(delta>=0?'▲':'▼')+' '+Math.abs(delta).toFixed(1)+'%</span>' : '';
  var maxAnno = anni.reduce(function(mx,a){return totAnno[a]>totAnno[mx]?a:mx;},anni[0]);
  var minAnno = anni.reduce(function(mn,a){return totAnno[a]<totAnno[mn]?a:mn;},anni[0]);

  var kpiEl = G('storica-kpi');
  if (kpiEl) kpiEl.innerHTML =
    storicaKPI('Totale '+annoCorrente, totCorr, 'Contratti YTD', '#3B82F6', dHtml)
    +storicaKPI('Anno record', maxAnno+' · '+totAnno[maxAnno], 'Contratti totali', '#10B981', '')
    +storicaKPI('Anno minore', minAnno+' · '+totAnno[minAnno], 'Contratti totali', '#F59E0B', '')
    +storicaKPI('Anni tracciati', anni.length, anni[0]+' → '+anni[anni.length-1], '#8B5CF6', '');

  // ── HEAT-MAP COLORE ──
  function cellBg(v, m) {
    if (v===null||v===undefined) return '';
    var vals = anni.map(function(a){return matrix[m]&&matrix[m][a]?matrix[m][a].v:null;}).filter(function(x){return x!==null;});
    if (!vals.length) return '';
    var mx = Math.max.apply(null,vals), mn = Math.min.apply(null,vals);
    if (mx===mn) return '';
    var pct = (v-mn)/(mx-mn);
    var r = Math.round(255-pct*(255-0));
    var g = Math.round(255-pct*(255-92));
    var b = Math.round(255-pct*(255-169));
    return 'background:rgb('+r+','+g+','+b+');color:'+(pct>0.55?'white':'#0f172a')+';';
  }

  // ── TABELLA ──
  var th = '<thead><tr style="background:#1e293b;position:sticky;top:0;z-index:3">'
    +'<th style="'+thSt()+';position:sticky;left:0;z-index:4;background:#1e293b;min-width:110px;border-right:2px solid #334155">Mese</th>';
  anni.forEach(function(a) {
    var isNow = a===annoCorrente;
    th += '<th style="'+thSt()+';min-width:55px;text-align:center'+(isNow?';background:#005CA9':'')+'">' + a + '</th>';
  });
  th += '</tr></thead>';

  var tbody = '<tbody>';
  MESI_ORD.forEach(function(m) {
    var rowBg = m%2===0?'background:#fafafa':'';
    var tds = '<td style="padding:7px 12px;font-size:12px;font-weight:700;color:#0f172a;position:sticky;left:0;border-right:2px solid #e2e8f0;white-space:nowrap;z-index:1;'+(m%2===0?'background:#fafafa':'background:white')+'">'+STORICA_MESI_NOMI[m]+'</td>';
    anni.forEach(function(a) {
      var cell = matrix[m]&&matrix[m][a]?matrix[m][a]:null;
      var v = cell?cell.v:null;
      var isAuto = cell&&cell.auto;
      var bg = v!==null ? cellBg(v,m) : '';
      var dot = isAuto?'<span title="Auto" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#10B981;margin-left:3px;vertical-align:middle"></span>':'';
      tds += '<td style="padding:5px 8px;font-size:12px;text-align:center;border-bottom:1px solid #f1f5f9;'+bg+'">'+(v!==null?v+''+dot:'<span style="color:#cbd5e1">–</span>')+'</td>';
    });
    tbody += '<tr style="border-bottom:1px solid #f1f5f9;'+rowBg+'">'+tds+'</tr>';
  });

  // Riga Totale
  tbody += '<tr style="background:#f8fafc;border-top:2px solid #e2e8f0;position:sticky;bottom:0;z-index:2">'
    +'<td style="padding:7px 12px;font-size:12px;font-weight:700;position:sticky;left:0;background:#f8fafc;border-right:2px solid #e2e8f0;z-index:3">Totale</td>';
  anni.forEach(function(a) {
    var t = totAnno[a]||0;
    var isNow = a===annoCorrente;
    tbody += '<td style="padding:7px 8px;font-size:12px;font-weight:700;text-align:center;'+(isNow?'color:#005CA9':'color:#475569')+'">'+( t||'–')+'</td>';
  });
  tbody += '</tr></tbody>';

  var tbl = G('storica-table');
  if (tbl) tbl.innerHTML = th + tbody;

  // ── GRAFICI ──
  setTimeout(function(){ storicaRenderGrafici(anni, totAnno, matrix, annoCorrente); }, 120);
}

// ── GRAFICI GRADIENT ─────────────────────────────────────────────────────────
function storicaRenderGrafici(anni, totAnno, matrix, annoCorrente) {
  storicaRenderAnni(anni, totAnno, annoCorrente);
  storicaRenderMese(anni, matrix);
}

function storicaRenderAnni(anni, totAnno, annoCorrente) {
  var el = G('storica-chart-anni');
  if (!el) return;
  var ck = 'storicaAnni';
  if (charts[ck]) { charts[ck].destroy(); delete charts[ck]; }
  var ctx = el.getContext('2d');
  var gradientApplied = false;

  charts[ck] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: anni.map(String),
      datasets: [{
        label: 'Contratti totali',
        data: anni.map(function(a){ return totAnno[a]||0; }),
        backgroundColor: anni.map(function(a){
          return a === annoCorrente ? 'rgba(239,68,68,0.85)' : 'rgba(0,92,169,0.75)';
        }),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c){ return ' '+c.raw+' contratti'; } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } }, beginAtZero: true }
      },
      animation: {
        onComplete: function() {
          if (gradientApplied) return;
          gradientApplied = true;
          var c = charts[ck];
          if (!c || !c.chartArea) return;
          var gCtx = c.ctx;
          var ca = c.chartArea;
          var grad = gCtx.createLinearGradient(0, ca.top, 0, ca.bottom);
          grad.addColorStop(0, 'rgba(0,92,169,0.9)');
          grad.addColorStop(1, 'rgba(0,92,169,0.15)');
          c.data.datasets[0].backgroundColor = anni.map(function(a) {
            return a === annoCorrente ? 'rgba(239,68,68,0.85)' : grad;
          });
          c.update('none');
        }
      }
    }
  });
}

function storicaRenderMese(anni, matrix) {
  var m = storicaMeseSelezionato;

  // Sostituisce il canvas per evitare residui dal chart precedente
  var wrap = G('storica-chart-mese');
  if (!wrap) return;
  var parent = wrap.parentNode;
  parent.removeChild(wrap);
  var newCanvas = document.createElement('canvas');
  newCanvas.id = 'storica-chart-mese';
  parent.appendChild(newCanvas);

  var ck = 'storicaMese';
  if (charts[ck]) { charts[ck].destroy(); delete charts[ck]; }

  var ctx = newCanvas.getContext('2d');
  var vals = anni.map(function(a){ return matrix[m]&&matrix[m][a]?matrix[m][a].v:null; });
  var annoCorr = new Date().getFullYear();
  var gradientApplied = false;

  charts[ck] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: anni.map(String),
      datasets: [{
        label: STORICA_MESI_NOMI[m],
        data: vals,
        borderColor: '#7C3AED',
        backgroundColor: 'rgba(139,92,246,0.15)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: anni.map(function(a){ return a===annoCorr?'#EF4444':'#7C3AED'; }),
        pointRadius: anni.map(function(a){ return a===annoCorr?6:4; }),
        pointBorderWidth: 0,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c){ return ' '+c.raw+' contratti'; } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } }, beginAtZero: true }
      },
      animation: {
        onComplete: function() {
          if (gradientApplied) return; // evita loop infinito
          gradientApplied = true;
          var c = charts[ck];
          if (!c || !c.chartArea) return;
          var gCtx = c.ctx;
          var ca = c.chartArea;
          var grad = gCtx.createLinearGradient(0, ca.top, 0, ca.bottom);
          grad.addColorStop(0, 'rgba(139,92,246,0.6)');
          grad.addColorStop(1, 'rgba(139,92,246,0.02)');
          c.data.datasets[0].backgroundColor = grad;
          c.update('none');
        }
      }
    }
  });
}

function storicaCambiaMese(val) {
  storicaMeseSelezionato = parseInt(val);
  // Ricostruisce matrice dalla cache
  var matrix = {};
  storicaData.forEach(function(r){
    if(!matrix[r.mese]) matrix[r.mese]={};
    matrix[r.mese][r.anno]={v:r.valore,auto:r.auto_calcolato};
  });
  var anniSet={};
  storicaData.forEach(function(r){anniSet[r.anno]=1;});
  var anni=Object.keys(anniSet).map(Number).sort(function(a,b){return a-b;});
  storicaRenderMese(anni, matrix);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function storicaKPI(label, value, sub, color, extraHtml) {
  return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-top:3px solid '+color+';background:var(--surface)">'
    +'<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">'+label+'</div>'
    +'<div style="font-size:20px;font-weight:800;color:var(--text);line-height:1">'+value+'</div>'
    +'<div style="font-size:10px;color:#94a3b8;margin-top:3px">'+sub+'</div>'
    +(extraHtml?'<div style="margin-top:6px">'+extraHtml+'</div>':'')
    +'</div>';
}

function thSt() {
  return 'padding:9px 8px;font-size:11px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap';
}

// ── RICALCOLA 2026 ────────────────────────────────────────────────────────────
async function storicaAggiornaDal2026() {
  if (!isAdmin()) return;
  storicaSetStatus(true, 'Lettura contratti 2026 da Supabase…');
  try {
    var allContratti = await sbGetAll(TR);
    var countMap = {};
    allContratti.forEach(function(r) {
      var a=parseInt(r.anno), m=parseInt(r.mese);
      if(a<STORICA_AUTO_DA_ANNO) return;
      if(a===STORICA_AUTO_DA_ANNO&&m<STORICA_AUTO_DA_MESE) return;
      var key=a+'_'+m;
      countMap[key]=(countMap[key]||0)+1;
    });
    storicaSetStatus(true, 'Aggiornamento serie storica…');
    var upserts = Object.keys(countMap).map(function(key){
      var p=key.split('_');
      return {anno:parseInt(p[0]),mese:parseInt(p[1]),valore:countMap[key],auto_calcolato:true};
    });
    if (!upserts.length) { storicaSetStatus(false); toast('Nessun contratto 2026 trovato','info'); return; }
    await sbPost('serie_storica', upserts, {'Prefer':'resolution=merge-duplicates,return=minimal'});
    storicaSetStatus(false);
    toast('✓ Aggiornati '+upserts.length+' mesi per il 2026','success');
    storicaLoaded = false;
    await storicaLoad();
  } catch(e) {
    console.error(e);
    storicaSetStatus(false);
    toast('Errore: '+e.message,'error');
  }
}
