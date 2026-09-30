// ============================================================
//  INCASSI.JS  v7 — Cache tables REST, nessuna RPC, nessun timeout
//  Fonte: incassi_stats_cache (367 righe), incassi_tasso_cache,
//         incassi_top_cache, incassi_clienti_cache
// ============================================================
'use strict';

var incassiLoaded  = false;
var incassiLoading = false;
var allStats    = [];   // {anno,mese,codice_azienda,metodo,avere,n}
var allTasso    = [];   // {anno,codice_azienda,fatturato,incassato}
var allTop      = [];   // {codice_cliente,cliente,codice_azienda,avere}
var allClienti  = [];   // {anno,codice_azienda,clienti_unici}
var filtrati    = [];
var charts      = {};

// ─── Entry point ───────────────────────────────────────────
async function incassiInit() {
  if (incassiLoading) return;
  if (incassiLoaded) { incassiRender(); return; }
  incassiLoading = true;
  showLoad('Caricamento incassi…');
  try { await incassiLoad(); }
  catch(e) { toast('Errore incassi: ' + e.message, 'error'); console.error(e); }
  finally { incassiLoading = false; hideLoad(); }
}

async function incassiLoad(force) {
  if (incassiLoaded && !force) return;
  showLoad('Caricamento statistiche…');

  var [r1,r2,r3,r4] = await Promise.all([
    fetch(SB+'/rest/v1/incassi_stats_cache?select=*&order=anno.asc,mese.asc', {headers:H()}),
    fetch(SB+'/rest/v1/incassi_tasso_cache?select=*&order=anno.desc',          {headers:H()}),
    fetch(SB+'/rest/v1/incassi_top_cache?select=*&order=avere.desc&limit=50',  {headers:H()}),
    fetch(SB+'/rest/v1/incassi_clienti_cache?select=*',                        {headers:H()})
  ]);

  if (!r1.ok) throw new Error('stats_cache HTTP '+r1.status);
  allStats   = await r1.json();
  allTasso   = r2.ok ? await r2.json() : [];
  allTop     = r3.ok ? await r3.json() : [];
  allClienti = r4.ok ? await r4.json() : [];

  incassiLoaded = true;
  incassiBuildFilters();
  incassiApply();
  hideLoad();
}

// ─── Filtri ────────────────────────────────────────────────
function incassiBuildFilters() {
  var anniSet = {};
  allStats.forEach(function(r){ if(r.anno) anniSet[r.anno]=true; });
  var anni = Object.keys(anniSet).map(Number).sort(function(a,b){return b-a;});
  ['inc-f-anno-da','inc-f-anno-a'].forEach(function(id){
    var sel=G(id); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">—</option>';
    anni.forEach(function(a){ sel.innerHTML+='<option value="'+a+'"'+(String(cur)===String(a)?' selected':'')+'>'+a+'</option>'; });
  });
  // Default: anno corrente in entrambi i select (solo al primo caricamento)
  var annoCorrente = String(new Date().getFullYear());
  var da = G('inc-f-anno-da'), ao = G('inc-f-anno-a');
  if (da && !da.value) da.value = annoCorrente;
  if (ao && !ao.value) ao.value = annoCorrente;
}

function filtro() {
  return {
    annoDa:  parseInt((G('inc-f-anno-da')||{}).value||0)||0,
    annoA:   parseInt((G('inc-f-anno-a') ||{}).value||0)||0,
    meseDa:  parseInt((G('inc-f-mese-da')||{}).value||0)||0,
    meseA:   parseInt((G('inc-f-mese-a') ||{}).value||0)||0,
    metodo:  ((G('inc-f-metodo') ||{}).value||'').trim(),
    societa: ((G('inc-f-societa')||{}).value||'').trim()
  };
}

async function incassiApply() {
  _clCache = {};
  var f = filtro();

  // Feedback visivo sul pulsante
  var btn = G('inc-btn-applica');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Calcolo…'; }

  // 1. Filtra i dati aggregati dalla cache locale (istantaneo)
  filtrati = allStats.filter(function(r) {
    var a = r.anno||0, m = r.mese||0;
    if (f.annoDa && a < f.annoDa) return false;
    if (f.annoA  && a > f.annoA)  return false;
    if (f.meseDa && f.meseA) {
      if(f.meseDa<=f.meseA){if(m<f.meseDa||m>f.meseA)return false;}
      else{if(m<f.meseDa&&m>f.meseA)return false;}
    } else if(f.meseDa&&m<f.meseDa) return false;
      else if(f.meseA &&m>f.meseA)  return false;
    if (f.metodo  && r.metodo         !== f.metodo)  return false;
    if (f.societa && r.codice_azienda !== f.societa) return false;
    return true;
  });

  // 2. Carica clienti unici con tutti i filtri attivi PRIMA del render (valore esatto)
  // Nota: passiamo SEMPRE tutti e 5 i parametri (null se non usati) per evitare
  // ambiguità di overloading con PostgREST che causa HTTP 500
  try {
    var body = {
      p_anno_da: f.annoDa || null,
      p_anno_a:  f.annoA  || null,
      p_mese_da: f.meseDa || null,
      p_mese_a:  f.meseA  || null,
      p_societa: f.societa || null
    };
    var rCl = await fetch(SB+'/rest/v1/rpc/get_clienti_unici_filtrati', {
      method:'POST', headers:H(), body:JSON.stringify(body)
    });
    if (rCl.ok) {
      var dCl = await rCl.json();
      _clCache['G1000001'] = parseInt(dCl.g1)||0;
      _clCache['G1000003'] = parseInt(dCl.g3)||0;
    }
  } catch(e) { /* usa fallback dalla cache locale */ }

  // 3. Render completo — tutti i dati sono pronti
  incassiRender();

  // Ripristina pulsante
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Applica filtri';
  }
}

function incassiReset() {
  ['inc-f-anno-da','inc-f-anno-a','inc-f-mese-da','inc-f-mese-a','inc-f-metodo','inc-f-societa'].forEach(function(id){
    var el=G(id); if(el) el.value='';
  });
  incassiApply();
}

// ─── KPI helpers ───────────────────────────────────────────
function sum(arr, key) { return arr.reduce(function(s,r){return s+(parseFloat(r[key])||0);},0); }
function sumN(arr)     { return arr.reduce(function(s,r){return s+(parseInt(r.n)||0);},0); }
function glow(c){return({'var(--blue)':'rgba(0,92,169,.55)','var(--accent2)':'rgba(6,182,212,.55)','#0284C7':'rgba(2,132,199,.55)','#D97706':'rgba(217,119,6,.55)','#059669':'rgba(5,150,105,.55)','#7C3AED':'rgba(124,58,237,.55)','#2563EB':'rgba(37,99,235,.55)','var(--green)':'rgba(16,185,129,.55)'}[c]||'rgba(0,92,169,.5)');}

function kpi(icon,label,value,sub,color) {
  return '<div class="inc-kpi-card" style="border-top:3px solid '+color+';--kpi-glow:'+glow(color)+'">'
    +'<div class="inc-kpi-icon" style="color:'+color+'">'+icon+'</div>'
    +'<div class="inc-kpi-body">'
      +'<div class="inc-kpi-label">'+label+'</div>'
      +'<div class="inc-kpi-value">'+value+'</div>'
      +(sub?'<div class="inc-kpi-sub">'+sub+'</div>':'')
    +'</div></div>';
}

var SVG = {
  euro:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  receipt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  users:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  sepa:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  cal:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

// ─── Clienti unici — RPC con filtro anni ─────────────────
var _clCache = {};  // cache risultati RPC per evitare fetch ripetuti

function clientiUnici(societa) {
  // Restituisce il valore in cache (aggiornato da incassiAggiornaCl)
  var key = societa || 'all';
  if (_clCache[key] !== undefined) return _clCache[key];
  // Fallback: usa la cache per anno singolo
  var f = filtro();
  var src = allClienti.filter(function(r){
    if (r.codice_azienda !== societa) return false;
    if (f.annoDa && f.annoA && f.annoDa === f.annoA) return r.anno === f.annoDa;
    return true;
  });
  if (f.annoDa && f.annoA && f.annoDa === f.annoA) {
    return src.reduce(function(s,r){return s+(parseInt(r.clienti_unici)||0);},0);
  }
  // Senza filtro anno: usa valore massimo anno più recente come stima
  var sorted = src.slice().sort(function(a,b){return b.anno-a.anno;});
  return sorted.length ? (parseInt(sorted[0].clienti_unici)||0) : 0;
}

// incassiAggiornaCl rimossa — logica integrata in incassiApply async


// ─── RENDER ────────────────────────────────────────────────
function incassiRender() {
  incassiRenderKPI();
  incassiRenderStats();
  incassiRenderCharts();
}

function incassiRenderKPI() {
  var f   = filtro();
  var tot = sum(filtrati,'avere');
  var nFat= sumN(filtrati);
  var totG1 = sum(filtrati.filter(function(r){return r.codice_azienda==='G1000001';}),'avere');
  var totG3 = sum(filtrati.filter(function(r){return r.codice_azienda==='G1000003';}),'avere');
  var totSepa=sum(filtrati.filter(function(r){return r.metodo==='SEPA';}),'avere');
  var pctSepa=tot>0?(totSepa/tot*100).toFixed(1):0;
  var clG1=clientiUnici('G1000001');
  var clG3=clientiUnici('G1000003');

  // Trend YoY
  var trendSub='';
  if(f.annoDa&&f.annoA&&f.annoDa===f.annoA){
    var prev=sum(allStats.filter(function(r){return r.anno===f.annoDa-1&&(!f.societa||r.codice_azienda===f.societa)&&(!f.metodo||r.metodo===f.metodo);}), 'avere');
    if(prev>0){var p=((tot-prev)/prev*100).toFixed(1);trendSub='<span style="color:'+(p>=0?'var(--green)':'var(--red)')+'">'+( p>=0?'▲':'▼')+' '+Math.abs(p)+'% vs '+(f.annoDa-1)+'</span>';}
  }

  // Mese migliore
  var mm={}; filtrati.forEach(function(r){if(r.mese)mm[r.mese]=(mm[r.mese]||0)+(parseFloat(r.avere)||0);});
  var mb=Object.entries(mm).sort(function(a,b){return b[1]-a[1];})[0];

  var el=G('inc-kpi-container'); if(!el) return;
  el.innerHTML=
    kpi(SVG.euro,   'Totale Incassato', '€ '+N(tot),          trendSub,                             'var(--blue)')+
    kpi(SVG.receipt,'Fatture Saldate',   I(nFat),             '',                                    'var(--accent2)')+
    kpi(SVG.euro,   'CNA Roma',   '€ '+N(totG1), I(clG1)+' clienti unici', '#0284C7')+
    kpi(SVG.euro,   'CNA CAF Lazio', '€ '+N(totG3), I(clG3)+' clienti unici', '#D97706')+
    kpi(SVG.users,  'Clienti unici CNA',        I(clG1), 'distinti nel periodo', '#059669')+
    kpi(SVG.users,  'Clienti unici CNA CAF Lazio', I(clG3), 'distinti nel periodo', '#7C3AED')+
    kpi(SVG.sepa,   'SEPA',              '€ '+N(totSepa),     pctSepa+'% del totale',                '#2563EB')+
    kpi(SVG.cal,    'Mese Migliore',     mb?MESI[+mb[0]]:'—', mb?'€ '+N(mb[1]):'',                  '#059669')+
    kpi(SVG.euro,   'Ticket Medio',      '€ '+N(nFat>0?tot/nFat:0), I(nFat)+' fatture',             '#8B5CF6')+
    kpi(SVG.users,  'Media per Cliente', '€ '+N((clG1+clG3)>0?tot/(clG1+clG3):0), I(clG1+clG3)+' clienti', '#0D9488');
}

// ─── Stats ─────────────────────────────────────────────────
function incassiRenderStats() {
  var f=filtro();
  var tot=sum(filtrati,'avere');

  // Per sede: rimosso

  // Per metodo + società
  var mBody=G('inc-metodo-body');
  if(mBody){
    var byM={SEPA:{tot:0,n:0},Cassa:{tot:0,n:0},Bonifico:{tot:0,n:0}};
    filtrati.forEach(function(r){var m=r.metodo||'Cassa';if(!byM[m])byM[m]={tot:0,n:0};byM[m].tot+=(parseFloat(r.avere)||0);byM[m].n+=(parseInt(r.n)||0);});
    var byS={G1000001:{tot:0,n:0},G1000003:{tot:0,n:0}};
    filtrati.forEach(function(r){if(byS[r.codice_azienda]){byS[r.codice_azienda].tot+=(parseFloat(r.avere)||0);byS[r.codice_azienda].n+=(parseInt(r.n)||0);}});
    var mHtml='<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">'+
      '<thead><tr style="background:linear-gradient(135deg,#f8fafc,#f1f5f9)">'+
      '<th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">Metodo</th>'+
      '<th style="padding:10px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">Importo</th>'+
      '<th style="padding:10px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">Quota</th>'+
      '<th style="padding:10px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">N° Fatture</th>'+
      '</tr></thead><tbody>';
    [['SEPA','#0284C7'],['Cassa','#059669'],['Bonifico','#7C3AED']].forEach(function(p,i){
      var d=byM[p[0]]||{tot:0,n:0};var pc=tot>0?(d.tot/tot*100).toFixed(1):0;
      mHtml+='<tr style="border-bottom:1px solid var(--border)">'+
        '<td style="padding:10px 12px"><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:3px;background:'+p[1]+'"></span><strong>'+p[0]+'</strong></span></td>'+
        '<td style="padding:10px 10px;text-align:right;color:'+p[1]+';font-weight:600;font-variant-numeric:tabular-nums">€ '+N(d.tot)+'</td>'+
        '<td style="padding:10px 10px;text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><div style="width:50px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:'+pc+'%;height:100%;background:'+p[1]+';border-radius:3px"></div></div><span style="font-weight:600;font-size:11px">'+pc+'%</span></div></td>'+
        '<td style="padding:10px 10px;text-align:right;font-variant-numeric:tabular-nums">'+I(d.n)+'</td></tr>';
    });
    mHtml+='</tbody></table>';

    mHtml+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin:0 0 8px;padding-top:4px;border-top:1px solid var(--border)">Per Società</div>';
    mHtml+='<table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>';
    [['G1000001','CNA Roma','#2563EB'],['G1000003','CAF Lazio','#D97706']].forEach(function(t,i){
      var d=byS[t[0]]||{tot:0,n:0};var pc=tot>0?(d.tot/tot*100).toFixed(1):0;
      mHtml+='<tr style="border-bottom:1px solid var(--border)">'+
        '<td style="padding:10px 12px"><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:3px;background:'+t[2]+'"></span><strong>'+t[1]+'</strong></span></td>'+
        '<td style="padding:10px 10px;text-align:right;color:'+t[2]+';font-weight:600;font-variant-numeric:tabular-nums">€ '+N(d.tot)+'</td>'+
        '<td style="padding:10px 10px;text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><div style="width:50px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:'+pc+'%;height:100%;background:'+t[2]+';border-radius:3px"></div></div><span style="font-weight:600;font-size:11px">'+pc+'%</span></div></td>'+
        '<td style="padding:10px 10px;text-align:right;font-variant-numeric:tabular-nums">'+I(d.n)+'</td></tr>';
    });
    mHtml+='</tbody></table>';
    mBody.innerHTML=mHtml;
  }

  // Riepilogo annuale
  var aWrap=G('inc-anno-wrapper');
  if(aWrap){
    var byAnno={};filtrati.forEach(function(r){var a=r.anno||'?';if(!byAnno[a])byAnno[a]={tot:0,n:0};byAnno[a].tot+=(parseFloat(r.avere)||0);byAnno[a].n+=(parseInt(r.n)||0);});
    var anniS=Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];});
    if(anniS.length>1){
      var aHtml='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="background:linear-gradient(135deg,#f8fafc,#f1f5f9)">'+
        ['Anno','Totale','Variazione','N° Fatture'].map(function(h,i){return '<th style="padding:10px 10px;text-align:'+(i>0?'right':'left')+';font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">'+h+'</th>';}).join('')+
        '</tr></thead><tbody>';
      anniS.forEach(function(e,i){
        var prev=anniS[i+1];var vp=prev&&prev[1].tot>0?((e[1].tot-prev[1].tot)/prev[1].tot*100).toFixed(1):null;
        var vpCol=vp!=null?(vp>=0?'#059669':'#DC2626'):'#94a3b8';
        var vpBg=vp!=null?(vp>=0?'rgba(5,150,105,0.1)':'rgba(220,38,38,0.1)'):'transparent';
        var vh=vp!=null?'<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;color:'+vpCol+';background:'+vpBg+'">'+(vp>=0?'▲ +':'▼ ')+vp+'%</span>':'<span style="color:#94a3b8">—</span>';
        aHtml+='<tr style="border-bottom:1px solid var(--border)">'+
          '<td style="padding:10px 10px;font-weight:700;font-size:13px">'+e[0]+'</td>'+
          '<td style="padding:10px 10px;text-align:right;color:#2563EB;font-weight:600;font-variant-numeric:tabular-nums">€ '+N(e[1].tot)+'</td>'+
          '<td style="padding:10px 10px;text-align:right">'+vh+'</td>'+
          '<td style="padding:10px 10px;text-align:right;font-variant-numeric:tabular-nums">'+I(e[1].n)+'</td></tr>';
      });
      aHtml+='</tbody></table>';
      aWrap.innerHTML=aHtml;
    } else { aWrap.innerHTML='<p style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">Seleziona un range multi-anno per il riepilogo</p>'; }
  }

  // Totale mensile per anno (ex "media" — ora totale effettivo)
  var mmBody=G('inc-mese-stats-body');
  if(mmBody){
    var anniD={};filtrati.forEach(function(r){if(r.anno)anniD[r.anno]=true;});
    var anniL=Object.keys(anniD).map(Number).sort(function(a,b){return b-a;}).slice(0,5);
    var byAM={};anniL.forEach(function(a){byAM[a]={};for(var m=1;m<=12;m++)byAM[a][m]=0;});
    filtrati.forEach(function(r){if(byAM[r.anno]&&r.mese)byAM[r.anno][r.mese]+=(parseFloat(r.avere)||0);});
    var c=['#005CA9','#059669','#D97706','#7C3AED','#DC2626'];
    // Calcola totali per colonna anno
    var totAnno={};anniL.forEach(function(a){totAnno[a]=Object.values(byAM[a]).reduce(function(s,v){return s+v;},0);});

    // Trova il valore massimo per heatmap
    var maxVal=0;
    anniL.forEach(function(a){for(var m=1;m<=12;m++){var v=(byAM[a]||{})[m]||0;if(v>maxVal)maxVal=v;}});

    var righe=[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m,mi){
      return '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:8px 12px;font-weight:600;font-size:12px;white-space:nowrap">'+MESI[m]+'</td>'+
        anniL.map(function(a,i){
          var v=(byAM[a]||{})[m]||0;
          var intensity=maxVal>0?Math.round(v/maxVal*100):0;
          var bg=v>0?'rgba(37,99,235,'+(0.06+0.25*intensity/100).toFixed(2)+')':'transparent';
          return '<td style="padding:8px 10px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;background:'+bg+';color:'+(v>0?c[i]:'var(--text-dim)')+'">'+( v>0?'€ '+N(v):'—')+'</td>';
        }).join('')+
      '</tr>';
    }).join('');

    var rigaTot='<tr style="border-top:2px solid var(--blue);background:rgba(37,99,235,0.04)">'+
      '<td style="padding:10px 12px;font-weight:800;font-size:12px;letter-spacing:.3px">TOTALE</td>'+
      anniL.map(function(a,i){return '<td style="padding:10px 10px;text-align:right;font-weight:800;font-size:12px;color:'+c[i]+';font-variant-numeric:tabular-nums">€ '+N(totAnno[a])+'</td>';}).join('')+
    '</tr>';

    mmBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:linear-gradient(135deg,#f8fafc,#f1f5f9)"><th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">Mese</th>'+
      anniL.map(function(a,i){return '<th style="padding:10px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:'+c[i]+';font-weight:700">'+a+'</th>';}).join('')+
      '</tr></thead>'+
      '<tbody>'+righe+rigaTot+'</tbody>'+
    '</table>';
  }

  // Tasso incasso per anno
  var tBody=G('inc-tasso-body');
  if(tBody){
    var byAnnoT={};
    allTasso.forEach(function(t){
      if(f.societa&&t.codice_azienda!==f.societa) return;
      if(f.annoDa&&t.anno<f.annoDa) return;
      if(f.annoA&&t.anno>f.annoA) return;
      if(!byAnnoT[t.anno]) byAnnoT[t.anno]={fat:0,pag:0};
      byAnnoT[t.anno].fat+=parseFloat(t.fatturato)||0;
      byAnnoT[t.anno].pag+=parseFloat(t.incassato)||0;
    });
    var tr2=Object.entries(byAnnoT).sort(function(a,b){return b[0]-a[0];});
    var tassoHtml='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:linear-gradient(135deg,#f8fafc,#f1f5f9)">'+
      ['Anno','Fatturato','Incassato','Insoluto','Tasso'].map(function(h,i){return '<th style="padding:10px 10px;text-align:'+(i>0?'right':'left')+';font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700">'+h+'</th>';}).join('')+
      '</tr></thead><tbody>';
    tr2.forEach(function(e,i){
      var fat=e[1].fat,pag=e[1].pag,ins=fat-pag,tasso=fat>0?(pag/fat*100).toFixed(1):0;
      var col=tasso>=90?'#059669':tasso>=70?'#D97706':'#DC2626';
      var bgCol=tasso>=90?'rgba(5,150,105,0.1)':tasso>=70?'rgba(217,119,6,0.1)':'rgba(220,38,38,0.1)';
      tassoHtml+='<tr style="border-bottom:1px solid var(--border)">'+
        '<td style="padding:10px 10px;font-weight:700;font-size:13px">'+e[0]+'</td>'+
        '<td style="padding:10px 10px;text-align:right;font-variant-numeric:tabular-nums">€ '+N(fat)+'</td>'+
        '<td style="padding:10px 10px;text-align:right;color:#059669;font-weight:600;font-variant-numeric:tabular-nums">€ '+N(pag)+'</td>'+
        '<td style="padding:10px 10px;text-align:right;color:#DC2626;font-variant-numeric:tabular-nums">€ '+N(ins)+'</td>'+
        '<td style="padding:10px 10px;text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">'+
          '<div style="width:70px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">'+
            '<div style="width:'+tasso+'%;height:100%;background:'+col+';border-radius:4px;transition:width .3s"></div></div>'+
          '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;color:'+col+';background:'+bgCol+'">'+tasso+'%</span>'+
        '</div></td></tr>';
    });
    tassoHtml+='</tbody></table>';
    tBody.innerHTML=tassoHtml;
  }
}

// ─── Chart ─────────────────────────────────────────────────
function incassiRenderCharts() {
  chartMensile();
  chartMetodo();
  chartAnni();
  chartTop();
}

function chartMensile() {
  var ctxEl=G('inc-chart-mensile'); if(!ctxEl) return;
  var tot={};
  for(var m=1;m<=12;m++) tot[m]=0;
  filtrati.forEach(function(r){var m=r.mese;if(m>=1&&m<=12)tot[m]+=(parseFloat(r.avere)||0);});
  var tv=[];for(var i=1;i<=12;i++)tv.push(tot[i]);
  if(charts.mensile){try{charts.mensile.destroy();}catch(e){}}
  var ctx2=ctxEl.getContext('2d');
  var h=ctxEl.offsetHeight||240;
  var grad=ctx2.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'rgba(94,196,210,0.5)');
  grad.addColorStop(1,'rgba(94,196,210,0.0)');
  charts.mensile=new Chart(ctxEl,{type:'line',data:{labels:MESI.slice(1),datasets:[{
    label:'Totale incassato',data:tv,
    borderColor:'rgba(94,196,210,0.9)',borderWidth:1.5,
    backgroundColor:grad,fill:true,tension:0.4,
    pointRadius:0,pointHoverRadius:4,
    pointHoverBackgroundColor:'rgba(94,196,210,1)',
    pointHoverBorderColor:'#fff',pointHoverBorderWidth:2
  }]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return ' €'+I(Math.round(c.raw));}}}},
    scales:{
      x:{grid:{display:false},border:{display:false},ticks:{font:{size:11},color:'#9CA3AF'}},
      y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)',drawBorder:false},border:{display:false},ticks:{callback:function(v){return '€'+I(v);},color:'#9CA3AF',font:{size:11}}}
    }
  }});
}

function chartMetodo() {
  var ctxEl=G('inc-chart-metodo'); if(!ctxEl) return;
  var ts=0,tc=0,tb=0;
  filtrati.forEach(function(r){var m=r.metodo||'Cassa';if(m==='SEPA')ts+=(parseFloat(r.avere)||0);else if(m==='Bonifico')tb+=(parseFloat(r.avere)||0);else tc+=(parseFloat(r.avere)||0);});
  if(charts.metodo){try{charts.metodo.destroy();}catch(e){}}
  var tt=ts+tc+tb||1;
  charts.metodo=new Chart(ctxEl,{type:'doughnut',
    data:{labels:['SEPA','Cassa','Bonifico'],datasets:[{data:[ts,tc,tb],backgroundColor:['rgba(94,196,210,0.85)','rgba(246,173,85,0.85)','rgba(159,122,234,0.85)'],borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},boxWidth:14,padding:12}},
      tooltip:{callbacks:{label:function(c){return c.label+': €'+N(c.raw)+' ('+(c.raw/tt*100).toFixed(1)+'%)';}}}},cutout:'65%'}});
}

function chartTop() {
  var ctxEl=G('inc-chart-top'); if(!ctxEl) return;
  var f=filtro();
  var src=allTop.filter(function(t){return !f.societa||t.codice_azienda===f.societa;}).slice(0,10);
  if(!src.length) return;
  var mx=parseFloat(src[0].avere)||1;
  if(charts.top){try{charts.top.destroy();}catch(e){}}
  charts.top=new Chart(ctxEl,{type:'bar',
    data:{labels:src.map(function(t){var n=t.cliente||t.codice_cliente||'—';return n.length>28?n.substring(0,26)+'…':n;}),
      datasets:[{label:'Importo',data:src.map(function(t){return parseFloat(t.avere)||0;}),
        backgroundColor:src.map(function(t){return 'rgba(37,99,235,'+(0.3+0.7*(parseFloat(t.avere)||0)/mx).toFixed(2)+')';}),borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return '€'+N(c.raw);}}}},
      scales:{x:{ticks:{callback:function(v){return '€'+I(v);}}}}}});
}

function chartAnni() {
  var ctxEl=G('inc-chart-anni'); if(!ctxEl) return;
  var anniD={};filtrati.forEach(function(r){if(r.anno)anniD[r.anno]=true;});
  var anniL=Object.keys(anniD).map(Number).sort(function(a,b){return a-b;}).slice(-6);
  if(!anniL.length) return;

  // Palette vivace — una per anno
  var palette=[
    {line:'rgba(94,196,210,0.95)',fill:'rgba(94,196,210,0.12)'},
    {line:'rgba(99,179,148,0.95)',fill:'rgba(99,179,148,0.12)'},
    {line:'rgba(159,122,234,0.95)',fill:'rgba(159,122,234,0.12)'},
    {line:'rgba(246,173,85,0.95)',fill:'rgba(246,173,85,0.12)'},
    {line:'rgba(252,129,129,0.95)',fill:'rgba(252,129,129,0.12)'},
    {line:'rgba(99,155,234,0.95)',fill:'rgba(99,155,234,0.12)'}
  ];

  var ctx2=ctxEl.getContext('2d');
  var ds=anniL.map(function(anno,idx){
    var col=palette[idx%palette.length];
    var mm={}; for(var m=1;m<=12;m++) mm[m]=null;
    filtrati.filter(function(r){return r.anno===anno;}).forEach(function(r){
      if(r.mese>=1&&r.mese<=12) mm[r.mese]=(mm[r.mese]||0)+(parseFloat(r.avere)||0);
    });

    // Gradiente fill per ogni anno
    var grad=ctx2.createLinearGradient(0,0,0,ctxEl.offsetHeight||280);
    grad.addColorStop(0,col.fill.replace('0.08','0.22'));
    grad.addColorStop(1,col.fill.replace('0.08','0.0'));

    return {
      label: String(anno),
      data: Object.values(mm),
      borderColor: col.line,
      borderWidth: 2.5,
      backgroundColor: anniL.length===1 ? grad : 'transparent',
      fill: anniL.length===1,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: col.line,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2
    };
  });

  if(charts.anni){try{charts.anni.destroy();}catch(e){}}
  charts.anni=new Chart(ctxEl,{type:'line',
    data:{labels:MESI.slice(1),datasets:ds},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          display:true,
          position:'top',
          labels:{
            font:{size:11},
            boxWidth:12,
            padding:12,
            color:'#6B7280',
            usePointStyle:false,
            generateLabels:function(chart){
              return chart.data.datasets.map(function(ds,i){
                return {text:ds.label,fillStyle:ds.borderColor,strokeStyle:ds.borderColor,lineWidth:2,hidden:false,datasetIndex:i};
              });
            }
          }
        },
        tooltip:{callbacks:{
          title:function(items){return items[0].label;},
          label:function(c){return ' '+c.dataset.label+':  €'+I(Math.round(c.raw));}
        }}
      },
      scales:{
        x:{grid:{display:false},border:{display:false},ticks:{font:{size:11},color:'#9CA3AF',maxRotation:30}},
        y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)',drawBorder:false},border:{display:false},ticks:{callback:function(v){return '€'+I(v);},color:'#9CA3AF',font:{size:11}}}
      }
    }
  });
}

// ─── Export ────────────────────────────────────────────────
function incassiExport() {
  if(!filtrati.length){toast('Nessun dato','warning');return;}
  var wb=XLSX.utils.book_new();
  var byAnno={};filtrati.forEach(function(r){var a=r.anno||'?';if(!byAnno[a])byAnno[a]={tot:0,sepa:0,cassa:0,bon:0,n:0};byAnno[a].tot+=(parseFloat(r.avere)||0);byAnno[a].n+=(parseInt(r.n)||0);if(r.metodo==='SEPA')byAnno[a].sepa+=(parseFloat(r.avere)||0);else if(r.metodo==='Bonifico')byAnno[a].bon+=(parseFloat(r.avere)||0);else byAnno[a].cassa+=(parseFloat(r.avere)||0);});
  var s=[['Anno','Totale €','SEPA €','Cassa €','Bonifico €','N° Fatture']];
  Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];}).forEach(function(e){s.push([e[0],e[1].tot,e[1].sepa,e[1].cassa,e[1].bon,e[1].n]);});
  var ws=XLSX.utils.aoa_to_sheet(s);ws['!cols']=[8,16,14,14,14,12].map(function(w){return{wch:w};});
  XLSX.utils.book_append_sheet(wb,ws,'Riepilogo');
  XLSX.writeFile(wb,'CNA_Incassi_'+new Date().toISOString().substring(0,10)+'.xlsx');
  toast('Export completato','success');
}

// ─── Tiny HTML helpers ─────────────────────────────────────
function N(n){return '<span class="amt">'+Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>';}
function I(n){return Number(n||0).toLocaleString('it-IT');}
function bar(pct){return '<div style="display:flex;align-items:center;justify-content:flex-end;gap:5px"><div style="width:44px;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:var(--blue)"></div></div>'+pct+'%</div>';}
function row(i,cells){return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'">'+cells.map(function(c,j){return '<td style="padding:6px 10px'+(j>0?';text-align:right':'')+'">'+c+'</td>';}).join('')+'</tr>';}
function tbl(hdrs,rows){return '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)">'+hdrs.map(function(h,i){return '<th style="padding:7px 10px;text-align:'+(i>0?'right':'left')+'">'+h+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';}

// fmtNum/fmtInt alias per compatibilità
function fmtNum(n){return N(n);}
function fmtInt(n){return I(n);}
