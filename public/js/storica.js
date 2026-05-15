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
    // HERO — stile Home
    +'<div class="home-hero" style="padding:20px 0 22px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px">'
    +'<div>'
    +'<p class="hero-sub" style="margin-bottom:8px">TESSERAMENTO · CNA ROMA</p>'
    +'<h2 class="hero-title" style="font-size:clamp(28px,3.5vw,44px);margin-bottom:8px">Serie storica<br>Lo storico degli associati diretti di <span class="hero-accent">CNA Roma</span><br>dal 2000 ad oggi</h2>'
    +'</div>'
    +(isAdmin()?'<button onclick="storicaAggiornaDal2026()" style="padding:9px 16px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;flex-shrink:0">🔄 Ricalcola 2026</button>':'')
    +'</div>'
    +'<div id="storica-status" style="display:none;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">'
    +'<span id="storica-status-text" style="font-size:13px;color:var(--text-secondary)">Caricamento…</span></div>'
    // KPI
    +'<div id="storica-kpi" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px"></div>'
    // TABELLA
    +'<div id="storica-table-wrap" style="border:1px solid #e2e8f0;border-radius:12px;background:white;box-shadow:var(--shadow-sm);margin-bottom:24px;overflow:hidden">'
    +'<div id="storica-scroll-body" style="overflow-x:auto;overflow-y:auto;max-height:440px;">'
    +'<table id="storica-table" style="border-collapse:collapse;white-space:nowrap"></table>'
    +'</div>'
    // Riga Totale fuori dallo scroll — non coperta dalla scrollbar
    +'<div id="storica-scroll-tot" style="overflow-x:hidden;border-top:2px solid #e2e8f0;">'
    +'<table id="storica-table-tot" style="border-collapse:collapse;white-space:nowrap"></table>'
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
    // ── SEZIONE PREVISIONALE ──
    +'<div id="storica-previsione" style="margin-top:24px"></div>'
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
  // Header
  var thCells = '<th style="'+thSt()+';position:sticky;left:0;z-index:4;background:#1e293b;min-width:110px;border-right:2px solid #334155">Mese</th>';
  anni.forEach(function(a) {
    var isNow = a===annoCorrente;
    thCells += '<th style="'+thSt()+';min-width:55px;text-align:center'+(isNow?';background:#005CA9':'')+'">' + a + '</th>';
  });

  // Righe mesi (senza Totale)
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
  tbody += '</tbody>';

  // Riga Totale separata (fuori dallo scroll)
  var totCells = '<td style="padding:7px 12px;font-size:12px;font-weight:700;position:sticky;left:0;background:#f8fafc;border-right:2px solid #e2e8f0;z-index:1;white-space:nowrap;min-width:110px">Totale</td>';
  anni.forEach(function(a) {
    var t = totAnno[a]||0;
    var isNow = a===annoCorrente;
    totCells += '<td style="padding:7px 8px;font-size:12px;font-weight:700;text-align:center;min-width:55px;'+(isNow?'color:#005CA9':'color:#475569')+'">'+t+'</td>';
  });

  var tbl = G('storica-table');
  if (tbl) tbl.innerHTML = '<thead><tr style="background:#1e293b;position:sticky;top:0;z-index:3">'+thCells+'</tr></thead>' + tbody;

  // Inserisce riga Totale nella tabella separata sotto
  var totTbl = G('storica-table-tot');
  if (totTbl) totTbl.innerHTML = '<tbody><tr style="background:#f8fafc;border-top:2px solid #e2e8f0">'+totCells+'</tr></tbody>';

  // Sincronizza scroll orizzontale tra le due tabelle
  var scrollDiv = G('storica-scroll-body');
  var scrollTot = G('storica-scroll-tot');
  if (scrollDiv && scrollTot) {
    scrollDiv.onscroll = function() { scrollTot.scrollLeft = scrollDiv.scrollLeft; };
  }

  // ── GRAFICI ──
  setTimeout(function(){ storicaRenderGrafici(anni, totAnno, matrix, annoCorrente); }, 120);

  // ── PREVISIONE ──
  storicaRenderPrevisione(data, matrix, anni);
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

// ── SEZIONE PREVISIONALE ─────────────────────────────────────────────────────
function storicaRenderPrevisione(data, matrix, anni) {
  var el = G('storica-previsione');
  if (!el) return;

  var OBIETTIVO = 1000;
  var ANNO_CUR = 2026;
  var ANNI_RIFE = [2021,2022,2023,2024,2025];
  var MESI_ORD_P = [1,2,3,4,5,6,7,9,10,11,12];
  var NOMI_P = {1:'Gennaio',2:'Febbraio',3:'Marzo',4:'Aprile',5:'Maggio',6:'Giugno',
    7:'Lug/Ago',9:'Settembre',10:'Ottobre',11:'Novembre',12:'Dicembre'};

  // Valori reali 2026 già disponibili
  var reali2026 = {};
  data.forEach(function(r){ if(r.anno===ANNO_CUR) reali2026[r.mese]=r.valore; });
  var totReale = Object.values(reali2026).reduce(function(s,v){return s+v;},0);
  var mesiReali = Object.keys(reali2026).map(Number);
  var mesiFuturi = MESI_ORD_P.filter(function(m){ return !reali2026.hasOwnProperty(m); });

  // Regressione lineare per ogni mese sugli ultimi 5 anni
  function stimaMese(m) {
    var vals = ANNI_RIFE.map(function(a){ return matrix[m]&&matrix[m][a]?matrix[m][a].v||0:0; });
    var n=vals.length, xs=vals.map(function(_,i){return i;}),
        mx=(n-1)/2, my=vals.reduce(function(s,v){return s+v;},0)/n;
    var num=xs.reduce(function(s,x,i){return s+(x-mx)*(vals[i]-my);},0);
    var den=xs.reduce(function(s,x){return s+(x-mx)*(x-mx);},0);
    var slope=den?num/den:0;
    var trend=Math.max(0,Math.round(my+slope*(5-mx)));
    var media=Math.round(my);
    var stima=Math.round(0.6*trend+0.4*media);
    return {stima:stima,trend:trend,media:media,slope:Math.round(slope*10)/10,vals:vals};
  }

  // Calcola stime per tutti i mesi
  var stime = {};
  MESI_ORD_P.forEach(function(m){ stime[m]=stimaMese(m); });

  // Stima totale naturale 2026
  var totStimaNaturale = totReale + mesiFuturi.reduce(function(s,m){return s+stime[m].stima;},0);

  // Piano per arrivare a 1000
  var fabbisogno = OBIETTIVO - totReale;
  var stimaNaturaleFutura = mesiFuturi.reduce(function(s,m){return s+stime[m].stima;},0);
  var boost = stimaNaturaleFutura>0 ? fabbisogno/stimaNaturaleFutura : 1;

  var piano = {};
  var cumPiano = totReale;
  mesiFuturi.forEach(function(m){
    var t = Math.round(stime[m].stima * boost);
    cumPiano += t;
    piano[m] = {target:t, naturale:stime[m].stima, extra:t-stime[m].stima, cum:cumPiano};
  });

  // Percentuale raggiunta
  var pctRaggiunta = Math.min(100, Math.round(totReale/OBIETTIVO*100));
  var pctStima = Math.min(100, Math.round(totStimaNaturale/OBIETTIVO*100));
  var gapStima = OBIETTIVO - totStimaNaturale;

  // ── HTML ──
  var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">';

  // Header
  html += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:18px 24px">'
    +'<div style="font-size:16px;font-weight:800;color:white;margin-bottom:2px">🎯 Previsione 2026 & Piano per 1.000 contratti</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,0.6)">Stima basata su regressione lineare degli ultimi 5 anni (2021-2025)</div>'
    +'</div>';

  html += '<div style="padding:20px 24px">';

  // ── KPI principali ──
  var mancanti = OBIETTIVO - totReale;
  var mancherannoCon = OBIETTIVO - totStimaNaturale;
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:24px">';

  // Già fatti
  html += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-left:4px solid #3B82F6;background:white">'
    +'<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Già realizzati</div>'
    +'<div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1.1;margin-top:4px">'+totReale+'</div>'
    +'<div style="font-size:11px;color:#94a3b8;margin-top:2px">gen–apr 2026</div></div>';

  // Stima a fine anno
  var colStima = totStimaNaturale>=OBIETTIVO?'#10B981':'#F59E0B';
  html += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-left:4px solid '+colStima+';background:white">'
    +'<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Stima a fine anno</div>'
    +'<div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1.1;margin-top:4px">'+totStimaNaturale+'</div>'
    +'<div style="font-size:11px;color:'+colStima+';margin-top:2px;font-weight:600">'+(totStimaNaturale>=OBIETTIVO?'✓ Sopra obiettivo':'▼ '+Math.abs(mancherannoCon)+' sotto obiettivo')+'</div></div>';

  // Mancanti per 1000
  html += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-left:4px solid #EF4444;background:white">'
    +'<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Ancora da fare</div>'
    +'<div style="font-size:28px;font-weight:800;color:#EF4444;line-height:1.1;margin-top:4px">'+mancanti+'</div>'
    +'<div style="font-size:11px;color:#94a3b8;margin-top:2px">per arrivare a 1.000</div></div>';

  // Boost necessario
  html += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-left:4px solid #8B5CF6;background:white">'
    +'<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Boost necessario</div>'
    +'<div style="font-size:28px;font-weight:800;color:#8B5CF6;line-height:1.1;margin-top:4px">+'+Math.round((boost-1)*100)+'%</div>'
    +'<div style="font-size:11px;color:#94a3b8;margin-top:2px">rispetto al trend naturale</div></div>';

  html += '</div>';

  // ── Barra progresso ──
  html += '<div style="margin-bottom:24px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<span style="font-size:12px;font-weight:700;color:var(--text)">Avanzamento verso 1.000</span>'
    +'<span style="font-size:12px;font-weight:700;color:#005CA9">'+totReale+' / '+OBIETTIVO+' ('+pctRaggiunta+'%)</span>'
    +'</div>'
    +'<div style="background:#f1f5f9;border-radius:99px;height:16px;overflow:hidden;position:relative">'
    // Barra reale
    +'<div style="position:absolute;left:0;top:0;height:100%;width:'+pctRaggiunta+'%;background:linear-gradient(90deg,#005CA9,#3B82F6);border-radius:99px;transition:width 0.6s ease"></div>'
    // Barra stima (tratteggiata)
    +'<div style="position:absolute;left:'+pctRaggiunta+'%;top:2px;height:calc(100% - 4px);width:'+(pctStima-pctRaggiunta)+'%;background:repeating-linear-gradient(90deg,#F59E0B 0px,#F59E0B 8px,transparent 8px,transparent 14px);border-radius:99px;opacity:0.7"></div>'
    +'</div>'
    +'<div style="display:flex;gap:16px;margin-top:6px">'
    +'<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:6px;border-radius:3px;background:linear-gradient(90deg,#005CA9,#3B82F6)"></div><span style="font-size:10px;color:#64748b">Realizzati ('+pctRaggiunta+'%)</span></div>'
    +'<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:6px;border-radius:3px;background:repeating-linear-gradient(90deg,#F59E0B 0,#F59E0B 4px,transparent 4px,transparent 7px)"></div><span style="font-size:10px;color:#64748b">Stima trend (+'+(pctStima-pctRaggiunta)+'%)</span></div>'
    +'</div></div>';

  // ── PIANO MENSILE ──
  html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">📅 Piano mensile per raggiungere 1.000</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-bottom:20px">';

  // Mesi già realizzati
  mesiReali.sort(function(a,b){return a-b;}).forEach(function(m){
    var v = reali2026[m];
    var nat = stime[m].stima;
    var vs = v-nat;
    var vsColor = vs>=0?'#10B981':'#EF4444';
    var vsSign = vs>=0?'+':'';
    html += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;background:#f8fafc;display:flex;align-items:center;gap:12px">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:#10B981;flex-shrink:0"></div>'
      +'<div style="flex:1">'
      +'<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">'+NOMI_P[m]+'</div>'
      +'<div style="font-size:15px;font-weight:800;color:#0f172a">'+v+' <span style="font-size:11px;font-weight:600;color:'+vsColor+'">'+vsSign+vs+' vs trend</span></div>'
      +'</div>'
      +'<div style="text-align:right;font-size:11px;color:#94a3b8">trend: '+nat+'</div>'
      +'</div>';
  });

  // Mesi futuri con target piano
  mesiFuturi.forEach(function(m){
    var p = piano[m];
    var extra = p.extra;
    var pctBar = Math.min(100, Math.round(p.cum/OBIETTIVO*100));
    var barColor = p.cum>=OBIETTIVO?'#10B981':'#005CA9';
    html += '<div style="border:1px solid #dbeafe;border-radius:8px;padding:10px 14px;background:white;display:flex;align-items:center;gap:12px">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:#005CA9;border:2px solid #bfdbfe;flex-shrink:0"></div>'
      +'<div style="flex:1">'
      +'<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">'+NOMI_P[m]+'</div>'
      +'<div style="font-size:15px;font-weight:800;color:#005CA9">'+p.target+' '
        +'<span style="font-size:11px;font-weight:600;color:#8B5CF6">+'+extra+' extra</span></div>'
      +'<div style="background:#f1f5f9;border-radius:4px;height:4px;margin-top:4px">'
        +'<div style="height:100%;width:'+pctBar+'%;background:'+barColor+';border-radius:4px"></div>'
      +'</div></div>'
      +'<div style="text-align:right">'
        +'<div style="font-size:13px;font-weight:800;color:'+barColor+'">'+p.cum+'</div>'
        +'<div style="font-size:9px;color:#94a3b8">cum.</div>'
      +'</div></div>';
  });

  html += '</div>';

  // ── Grafico piano ──
  html += '<div style="position:relative;height:200px;margin-top:4px"><canvas id="storica-chart-piano"></canvas></div>';

  html += '</div></div>';

  el.innerHTML = html;

  // Grafico piano mensile
  setTimeout(function() {
    var cvs = G('storica-chart-piano');
    if (!cvs) return;
    var ck = 'storicaPiano';
    if (charts[ck]) { charts[ck].destroy(); delete charts[ck]; }

    var labelsAll = MESI_ORD_P.map(function(m){ return NOMI_P[m].substring(0,3); });
    var datiReali = MESI_ORD_P.map(function(m){ return reali2026[m]!==undefined ? reali2026[m] : null; });
    var datiTarget = MESI_ORD_P.map(function(m){ return piano[m] ? piano[m].target : null; });
    var datiNaturale = MESI_ORD_P.map(function(m){ return stime[m].stima; });
    var gradientApplied = false;
    var ctx = cvs.getContext('2d');

    charts[ck] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labelsAll,
        datasets: [
          {
            label: 'Realizzati',
            data: datiReali,
            backgroundColor: 'rgba(0,92,169,0.85)',
            borderRadius: 4,
            borderSkipped: false,
            order: 1
          },
          {
            label: 'Target piano',
            data: datiTarget,
            backgroundColor: 'rgba(139,92,246,0.7)',
            borderRadius: 4,
            borderSkipped: false,
            order: 2
          },
          {
            label: 'Trend naturale',
            data: datiNaturale,
            type: 'line',
            borderColor: '#F59E0B',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5,4],
            pointBackgroundColor: '#F59E0B',
            pointRadius: 4,
            tension: 0.3,
            order: 0
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 12, padding: 12 }
          },
          tooltip: { callbacks: { label: function(c){ return ' '+c.dataset.label+': '+c.raw; } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } }, beginAtZero: true }
        },
        animation: {
          onComplete: function() {
            if (gradientApplied) return;
            gradientApplied = true;
            var c = charts[ck];
            if (!c||!c.chartArea) return;
            var ca = c.chartArea;
            var grad = ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
            grad.addColorStop(0, 'rgba(0,92,169,0.9)');
            grad.addColorStop(1, 'rgba(0,92,169,0.2)');
            c.data.datasets[0].backgroundColor = grad;
            var grad2 = ctx.createLinearGradient(0, ca.top, 0, ca.bottom);
            grad2.addColorStop(0, 'rgba(139,92,246,0.85)');
            grad2.addColorStop(1, 'rgba(139,92,246,0.2)');
            c.data.datasets[1].backgroundColor = grad2;
            c.update('none');
          }
        }
      }
    });
  }, 200);
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
