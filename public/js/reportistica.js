// ══════════════════════════════════════════════════════════════════════════════
// REPORTISTICA.JS v2 — Tab Reportistica Admin CNA Roma
// Genera report PDF identico al modello allegato
// Approccio: html2canvas su HTML renderizzato → jsPDF
// ══════════════════════════════════════════════════════════════════════════════
console.log('✅ reportistica.js v2 CARICATO');

var reportisticaLoading = false;
var repAllData = [];
var LOGO_URL = 'https://raw.githubusercontent.com/alessandroparrelli/fileappoggio/17b50df8f22632eb360e1da944d997289a598012/NUOVO-LOGO-CNA-ROMA-SOLO-ROMA.png';

// ── INIT ──────────────────────────────────────────────────────────────────────
function reportisticaInit() {
  if (!isAdmin()) return;
  buildReportisticaUI();
}

function buildReportisticaUI() {
  var tab = G('tab-reportistica');
  if (!tab) return;
  var anniOpt = '';
  for (var y = 2026; y >= 2020; y--) {
    anniOpt += '<option value="' + y + '"' + (y === new Date().getFullYear() ? ' selected' : '') + '>' + y + '</option>';
  }
  var mesiOpt = MESI.slice(1).map(function(m, i) {
    var num = i + 1;
    return '<option value="' + num + '"' + (num === new Date().getMonth() + 1 ? ' selected' : '') + '>' + m + '</option>';
  }).join('');

  tab.innerHTML = '<div style="max-width:1100px;margin:0 auto;padding:24px 20px 60px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">'
    + '<div><h2 style="margin:0;font-size:22px;font-weight:800;color:var(--text)">📋 Generatore Report Mensile</h2>'
    + '<p style="margin:4px 0 0;font-size:13px;color:var(--text-secondary)">Report professionale PDF — solo amministratori</p></div>'
    + '<span style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;color:#EF4444">SOLO ADMIN</span></div>'
    + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:var(--shadow-sm)">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px">● Configurazione</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;align-items:end">'
    + '<div><label style="display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase">Anno</label>'
    + '<select id="rep-anno" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px">' + anniOpt + '</select></div>'
    + '<div><label style="display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase">Mese</label>'
    + '<select id="rep-mese" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px">' + mesiOpt + '</select></div>'
    + '<div><button onclick="repCaricaEAnteprima()" id="rep-btn-carica" style="width:100%;padding:10px 16px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">🔄 Carica Dati</button></div>'
    + '<div><button onclick="repGeneraPDF()" id="rep-btn-pdf" style="width:100%;padding:10px 16px;background:#1e293b;color:white;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">📄 Genera PDF</button></div>'
    + '</div></div>'
    + '<div id="rep-status" style="display:none;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">'
    + '<span id="rep-status-text" style="font-size:13px;color:var(--text-secondary)">Caricamento…</span></div>'
    + '<div id="rep-anteprima" style="display:none">'
    + '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px">● Anteprima — <span id="rep-periodo-label" style="color:var(--primary)"></span></div>'
    + '<div id="rep-pages-container"></div></div></div>';

  repCaricaEAnteprima();
}

async function repCaricaEAnteprima() {
  if (reportisticaLoading) return;
  reportisticaLoading = true;
  var anno = parseInt(G('rep-anno').value);
  var mese = parseInt(G('rep-mese').value);
  repSetStatus(true, 'Caricamento dati da Supabase…');
  G('rep-anteprima').style.display = 'none';
  try {
    repAllData = await sbGetAll(TR);
    repSetStatus(true, 'Caricamento serie storica…');
    var repStoricaData = await sbGetAll('serie_storica');
    repSetStatus(true, 'Elaborazione e rendering…');
    G('rep-periodo-label').textContent = MESI[mese] + ' ' + anno;
    G('rep-pages-container').innerHTML = '';
    var pages = repBuildAllPages(repAllData, anno, mese, repStoricaData);
    pages.forEach(function(pageHtml, i) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'margin-bottom:28px;box-shadow:0 4px 24px rgba(0,0,0,0.13);border-radius:4px;overflow:hidden;background:white';
      wrapper.setAttribute('data-page', i + 1);
      wrapper.innerHTML = pageHtml;
      G('rep-pages-container').appendChild(wrapper);
    });
    setTimeout(function(){ repRenderAllCharts(repAllData, anno, mese); }, 150);
    G('rep-anteprima').style.display = 'block';
    repSetStatus(false);
  } catch(e) {
    console.error(e);
    repSetStatus(false);
    toast('Errore: ' + e.message, 'error');
  } finally {
    reportisticaLoading = false;
  }
}

function repSetStatus(show, msg) {
  var el = G('rep-status');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (msg && G('rep-status-text')) G('rep-status-text').textContent = msg;
}

// ══════════════════════════════════════════════════════════════════════════════
// COSTRUZIONE PAGINE
// ══════════════════════════════════════════════════════════════════════════════
var REP_TOTAL_PAGES = 16; // aggiornato dinamicamente in repBuildAllPages // copertina + 14 pagine dati (7 base + 4 Ateco mese + 4 Ateco anno — aggiornato dinamicamente)

function repBuildAllPages(data, anno, mese, storicaData) {
  storicaData = storicaData || [];
  var basePages = [
    repPag0_Copertina(anno, mese),                          // Copertina
    repPag1_Mensile(data, anno, mese),                      // 1
    repPag2_Annuale(data, anno, mese),                      // 2
    repPag3_RaffrontoMese(data, anno, mese),                // 3
    repPag4_RaffrontoYTD(data, anno, mese),                 // 4
    repPag5_SchedeA(data, anno, mese),                      // 5
    repPag6_SchedeB(data, anno, mese),                      // 6
    repPag8_SerieStoricaTabella(storicaData, anno, mese),   // 7
    repPagPrevisione(storicaData, anno),                    // 8 — Previsione
  ];
  // Ateco mese: 4 pagine (KPI, Unione, Mestiere, Settore)
  var atecoMese = repPagAtecoSplit(data, anno, mese, true);
  // Ateco anno: 4 pagine
  var atecoAnno = repPagAtecoSplit(data, anno, mese, false);
  var allPages = basePages.concat(atecoMese).concat(atecoAnno);
  // Raggruppamenti: pagine 15 (mese) e 16 (anno) — calcolate dopo il concat
  var pRaggMese = String(allPages.length + 1);
  var pRaggAnno = String(allPages.length + 2);
  allPages = allPages
    .concat([repPagRaggruppamenti(data, anno, mese, true,  pRaggMese)])
    .concat([repPagRaggruppamenti(data, anno, mese, false, pRaggAnno)]);
  var totale = allPages.length;
  REP_TOTAL_PAGES = totale;
  // Sostituisce il placeholder __TOTPAG__ con il numero reale in tutti i footer
  allPages = allPages.map(function(html) {
    return html.replace(/__TOTPAG__/g, String(totale));
  });
  return allPages;
}

// ── PAGINA 0: COPERTINA ───────────────────────────────────────────────────────
function repPag0_Copertina(anno, mese) {
  var meseStr = MESI[mese] + ' ' + anno;
  return '<div style="background:white;font-family:Inter,Helvetica,Arial,sans-serif;width:1060px;height:740px;display:flex;flex-direction:column">'
    // Contenuto centrato verticalmente — flex:1 occupa lo spazio, footer rimane in fondo
    + '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">'
    + '<img src="' + LOGO_URL + '" style="height:auto;width:240px;object-fit:contain;object-position:center;margin-bottom:44px" crossorigin="anonymous" />'
    + '<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:44px;font-weight:800;color:#0f172a;letter-spacing:-1.5px;text-align:center;line-height:1.05">'
    +   'Analisi adesioni dirette della<br>'
    +   '<span style="color:#005CA9">CNA di Roma</span>'
    + '</div>'
    + '<div style="margin-top:10px;font-size:15px;font-weight:500;color:#64748b;text-align:center;letter-spacing:0">Mese di riferimento: <strong style="color:#0f172a;font-weight:700">' + meseStr + '</strong></div>'
    + '</div>'
    // Footer identico alle altre pagine
    + repFooter('1')
    + '</div>';
}

// HEADER: bianco, logo proporzionato (non deformato), titolo Inter Bold nero
function repHeader(titoloPagina, anno, mese) {
  var meseStr = MESI[mese] + ' ' + anno;
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 28px 9px;border-bottom:1.5px solid #e2e8f0;background:white">'
    + '<img src="' + LOGO_URL + '" style="height:42px;width:auto;max-width:160px;object-fit:contain;object-position:left center" crossorigin="anonymous" />'
    + '<div style="text-align:right"><div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:19px;font-weight:800;color:#0f172a;line-height:1.2">Dati tesseramento ' + meseStr + '</div></div>'
    + '</div>'
    + '<div style="padding:6px 28px 5px;background:white"><div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a">● ' + titoloPagina + '</div></div>';
}

function repFooter(n) {
  // n = numero pagina assoluto (1=copertina, 2=pag1 dati, ecc.)
  // __TOTPAG__ viene sostituito dopo il conteggio in repBuildAllPages
  return '<div style="padding:6px 28px;background:white;display:flex;justify-content:space-between;align-items:center;min-height:28px">'
    + '<span style="font-size:10px;color:#94a3b8;font-family:Inter,Helvetica,Arial,sans-serif;line-height:1">CNA Roma — Confederazione Nazionale dell\'Artigianato</span>'
    + '<span style="font-size:10px;color:#94a3b8;font-family:Inter,Helvetica,Arial,sans-serif;line-height:1">Pagina ' + parseInt(n) + ' di __TOTPAG__</span></div>';
}

// Landscape A4 a 96dpi ≈ 1122×794px — usiamo 1060×748 con margini
// Header fisso in alto, footer fisso in basso, body inizia sotto l'header
function repPage(header, body, footer) {
  return '<div style="background:white;font-family:Inter,Helvetica,Arial,sans-serif;width:1060px;display:flex;flex-direction:column;min-height:748px">'
    + header
    + '<div style="flex:1;padding:10px 28px 14px;background:white;overflow:hidden">' + body + '</div>'
    + footer + '</div>';
}

// Portrait non più necessario — tutte le pagine in landscape
function repPagePortrait(header, body, footer) {
  return repPage(header, body, footer);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function repFiltro(data, anno, mese, soloMese) {
  return data.filter(function(r) {
    if (parseInt(r.anno) !== anno) return false;
    return soloMese ? (parseInt(r.mese) === mese) : (parseInt(r.mese) <= mese);
  });
}

function repGroup(data, campo) {
  var out = {};
  data.forEach(function(r) {
    var k = r[campo] || 'N/D';
    if (!out[k]) out[k] = {cnt:0, tot:0};
    out[k].cnt++;
    out[k].tot += parseFloat(r.importo) || 0;
  });
  return out;
}

function repGetPromo(data) {
  var g = repGroup(data, 'promotore');
  if (Object.keys(g).length < 2) g = repGroup(data, 'a_cura_di');
  return g;
}

function repGetRete(data) {
  var g = repGroup(data, 'tipo_rete');
  if (Object.keys(g).length < 2) g = repGroup(data, 'tiporete');
  return g;
}

function repFmt(n, dec) {
  if (typeof n !== 'number') n = parseFloat(n) || 0;
  var d = dec !== undefined ? dec : 2;
  return n.toLocaleString('it-IT', {minimumFractionDigits:d, maximumFractionDigits:d});
}

function repKPI(label, value, sub, delta, color) {
  var dHtml = '';
  if (delta !== null && delta !== undefined) {
    var dc = delta < 0 ? '#EF4444' : '#10B981';
    var da = delta < 0 ? '▼' : '▲';
    dHtml = '<div style="margin-top:5px"><span style="background:' + dc + ';color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">' + da + ' ' + Math.abs(delta).toFixed(1) + '% vs ' + (new Date().getFullYear()-1) + '</span></div>';
  }
  return '<div style="flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-top:3px solid ' + color + ';background:white">'
    + '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">' + label + '</div>'
    + '<div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1">' + value + '</div>'
    + '<div style="font-size:10px;color:#94a3b8;margin-top:3px">' + sub + '</div>'
    + dHtml + '</div>';
}

function repDimTable(byKey, totale, color) {
  var keys = Object.keys(byKey).sort(function(a,b){return byKey[b].tot-byKey[a].tot;});
  var rows = keys.map(function(k) {
    var d = byKey[k];
    var pct = totale > 0 ? (d.tot/totale*100).toFixed(1) : '0.0';
    var avg = d.cnt > 0 ? d.tot/d.cnt : 0;
    var bw = totale > 0 ? Math.max(4, d.tot/totale*110) : 4;
    return '<tr style="border-bottom:1px solid #f1f5f9">'
      + '<td style="padding:5px 8px;font-size:11px;font-weight:600;color:#0f172a">' + k + '</td>'
      + '<td style="padding:5px 8px;font-size:11px;text-align:right;color:#475569">' + d.cnt + '</td>'
      + '<td style="padding:5px 8px;font-size:11px;text-align:right;color:#475569">€ ' + repFmt(d.tot,0) + '</td>'
      + '<td style="padding:5px 8px"><div style="display:flex;align-items:center;gap:5px"><div style="width:' + bw + 'px;height:4px;background:' + color + ';border-radius:2px;flex-shrink:0"></div><span style="font-size:10px;color:#64748b">' + pct + '%</span></div></td>'
      + '<td style="padding:5px 8px;font-size:11px;text-align:right;color:#475569">€ ' + repFmt(avg,0) + '</td></tr>';
  }).join('');
  var totCnt = keys.reduce(function(s,k){return s+byKey[k].cnt;},0);
  var totAvg = totCnt>0 ? totale/totCnt : 0;
  return '<table style="width:100%;border-collapse:collapse">'
    + '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">'
    + '<th style="padding:5px 8px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase">Categoria</th>'
    + '<th style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase">Nr.</th>'
    + '<th style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase">Importo ↓</th>'
    + '<th style="padding:5px 8px;font-size:10px;color:#64748b;text-transform:uppercase">% Tot.</th>'
    + '<th style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase">Media</th>'
    + '</tr></thead><tbody>' + rows + '</tbody>'
    + '<tfoot><tr style="background:#f8fafc;border-top:2px solid #e2e8f0">'
    + '<td style="padding:5px 8px;font-size:11px;font-weight:700">Totale</td>'
    + '<td style="padding:5px 8px;font-size:11px;font-weight:700;text-align:right">' + totCnt + '</td>'
    + '<td style="padding:5px 8px;font-size:11px;font-weight:700;text-align:right">€ ' + repFmt(totale,0) + '</td>'
    + '<td style="padding:5px 8px;font-size:11px;font-weight:700">100%</td>'
    + '<td style="padding:5px 8px;font-size:11px;font-weight:700;text-align:right">€ ' + repFmt(totAvg,0) + '</td>'
    + '</tr></tfoot></table>';
}

function repCardSezione(titolo, color, icona, badge, tableHtml, chartId) {
  var chartHtml = chartId ? '<div style="padding:8px 12px 4px"><canvas id="' + chartId + '" height="150"></canvas></div>' : '';
  return '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white">'
    + '<div style="background:' + color + ';padding:9px 14px;display:flex;align-items:center;justify-content:space-between">'
    + '<div style="display:flex;align-items:center;gap:7px;color:white;font-size:12px;font-weight:700">' + icona + ' ' + titolo + '</div>'
    + '<span style="background:rgba(255,255,255,0.2);color:white;font-size:10px;padding:2px 10px;border-radius:20px">' + badge + '</span></div>'
    + chartHtml
    + '<div style="padding:0 12px 10px">' + tableHtml + '</div></div>';
}

function repKpiDB(data) {
  return '<div style="flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-top:3px solid #F59E0B;background:white">'
    + '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Totale DB</div>'
    + '<div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1">' + data.length.toLocaleString('it-IT') + '</div>'
    + '<div style="font-size:10px;color:#94a3b8;margin-top:3px">Record su Supabase</div></div>';
}

// ── PAGINA 1: DATO MENSILE ────────────────────────────────────────────────────
function repPag1_Mensile(data, anno, mese) {
  var rec = repFiltro(data, anno, mese, true);
  var tot = rec.reduce(function(s,r){return s+(parseFloat(r.importo)||0);},0);
  var cnt = rec.length;
  var avg = cnt>0?tot/cnt:0;
  var recP = data.filter(function(r){return parseInt(r.anno)===(anno-1)&&parseInt(r.mese)===mese;});
  var totP = recP.reduce(function(s,r){return s+(parseFloat(r.importo)||0);},0);
  var cntP = recP.length;
  var dImp = totP>0?(tot-totP)/totP*100:null;
  var dCnt = cntP>0?(cnt-cntP)/cntP*100:null;
  var dAvg = (totP>0&&cntP>0)?(avg-(totP/cntP))/(totP/cntP)*100:null;

  var byRete = repGetRete(rec);
  var byPromo = repGetPromo(rec);

  var body = '<div style="display:flex;gap:10px;margin-bottom:18px">'
    + repKPI('Totale Importo','€ '+repFmt(tot,0),'vs '+(anno-1),dImp,'#3B82F6')
    + repKPI('Nr. Contratti',cnt,'vs '+(anno-1),dCnt,'#10B981')
    + repKPI('Importo Medio','€ '+repFmt(avg,0),'Per contratto',dAvg,'#8B5CF6')
    + repKpiDB(data) + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px">● Report per dimensione</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
    + repCardSezione('Tipo Rete','#3B82F6','🔗',Object.keys(byRete).length+' voci',repDimTable(byRete,tot,'#3B82F6'),'rep-c1-rete')
    + repCardSezione('Promotore','#EC4899','👤',Object.keys(byPromo).length+' voci',repDimTable(byPromo,tot,'#EC4899'),'rep-c1-promo')
    + '</div>';

  return repPage(repHeader('Dato mensile: '+MESI[mese], anno, mese), body, repFooter('2'));
}

// ── PAGINA 2: DATO ANNUALE ────────────────────────────────────────────────────
function repPag2_Annuale(data, anno, mese) {
  var rec = repFiltro(data, anno, mese, false);
  var tot = rec.reduce(function(s,r){return s+(parseFloat(r.importo)||0);},0);
  var cnt = rec.length;
  var avg = cnt>0?tot/cnt:0;
  var recP = data.filter(function(r){return parseInt(r.anno)===(anno-1)&&parseInt(r.mese)<=mese;});
  var totP = recP.reduce(function(s,r){return s+(parseFloat(r.importo)||0);},0);
  var cntP = recP.length;
  var dImp = totP>0?(tot-totP)/totP*100:null;
  var dCnt = cntP>0?(cnt-cntP)/cntP*100:null;
  var dAvg = (totP>0&&cntP>0)?(avg-(totP/cntP))/(totP/cntP)*100:null;

  var byRete = repGetRete(rec);
  var byPromo = repGetPromo(rec);

  var body = '<div style="display:flex;gap:10px;margin-bottom:18px">'
    + repKPI('Totale Importo','€ '+repFmt(tot,0),'Gen–'+MESI[mese]+' '+anno,dImp,'#3B82F6')
    + repKPI('Nr. Contratti',cnt,'vs '+(anno-1),dCnt,'#10B981')
    + repKPI('Importo Medio','€ '+repFmt(avg,0),'Per contratto',dAvg,'#8B5CF6')
    + repKpiDB(data) + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px">● Report per dimensione</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
    + repCardSezione('Tipo Rete','#3B82F6','🔗',Object.keys(byRete).length+' voci',repDimTable(byRete,tot,'#3B82F6'),'rep-c2-rete')
    + repCardSezione('Promotore','#EC4899','👤',Object.keys(byPromo).length+' voci',repDimTable(byPromo,tot,'#EC4899'),'rep-c2-promo')
    + '</div>';

  return repPage(repHeader('Dato annuale: '+anno, anno, mese), body, repFooter('3'));
}

// ── HELPER: TABELLA CONFRONTO ANNI ───────────────────────────────────────────
function repBuildConfronto(data, anno, mese, soloMese, trendId) {
  var anniSet={};
  data.forEach(function(r){if(r.anno)anniSet[r.anno]=1;});
  var anni = Object.keys(anniSet).map(Number).sort();

  var promoSet={};
  data.forEach(function(r){
    if(soloMese&&parseInt(r.mese)!==mese) return;
    if(!soloMese&&parseInt(r.mese)>mese) return;
    var p=r.promotore||r.a_cura_di||'N/D';
    promoSet[p]=1;
  });
  var promos = Object.keys(promoSet).sort();

  var matrix={}, totPerAnno={};
  data.forEach(function(r){
    var a=parseInt(r.anno), m=parseInt(r.mese);
    if(soloMese&&m!==mese) return;
    if(!soloMese&&m>mese) return;
    var p=r.promotore||r.a_cura_di||'N/D';
    if(!matrix[p]) matrix[p]={};
    if(!matrix[p][a]) matrix[p][a]={cnt:0};
    matrix[p][a].cnt++;
    if(!totPerAnno[a]) totPerAnno[a]=0;
    totPerAnno[a]++;
  });

  // Thead
  var th='<tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">'
    +'<th style="padding:5px 8px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;white-space:nowrap">Promotore</th>';
  anni.forEach(function(a){
    th+='<th colspan="2" style="padding:5px 8px;text-align:center;font-size:10px;color:#64748b;text-transform:uppercase;border-left:1px solid #e2e8f0">'+a+'</th>';
  });
  th+='<th style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;border-left:2px solid #e2e8f0">Δ '+(anno)+'→'+(anno-1)+'</th></tr>';
  th+='<tr style="border-bottom:1px solid #e2e8f0"><th></th>';
  anni.forEach(function(){th+='<th style="padding:3px 6px;font-size:9px;color:#94a3b8;text-align:right;border-left:1px solid #f1f5f9">Nr.</th><th style="padding:3px 6px;font-size:9px;color:#94a3b8;text-align:right">% Tot.</th>';});
  th+='<th></th></tr>';

  var rows = promos.map(function(p){
    var cells='<td style="padding:5px 8px;font-size:11px;font-weight:600;white-space:nowrap;color:#0f172a">'+p+'</td>';
    var lastCnt=0,prevCnt=0;
    anni.forEach(function(a,ai){
      var d=matrix[p]&&matrix[p][a]?matrix[p][a]:{cnt:0};
      var pct=totPerAnno[a]>0?(d.cnt/totPerAnno[a]*100).toFixed(1)+'%':'–';
      if(ai===anni.length-1) lastCnt=d.cnt;
      if(ai===anni.length-2) prevCnt=d.cnt;
      cells+='<td style="padding:5px 6px;font-size:11px;text-align:right;border-left:1px solid #f1f5f9;color:#475569">'+d.cnt+'</td>';
      cells+='<td style="padding:5px 6px;font-size:11px;text-align:right;color:#6366f1">'+pct+'</td>';
    });
    var delta=prevCnt>0?(lastCnt-prevCnt)/prevCnt*100:(lastCnt>0?100:0);
    var dc=delta>0?'#10B981':delta<0?'#EF4444':'#64748b';
    var ds=delta>0?'▲':'▼';
    cells+='<td style="padding:5px 8px;font-size:11px;text-align:right;font-weight:700;color:'+dc+';border-left:2px solid #e2e8f0">'+(Math.abs(delta)>0?ds+' ':'')+Math.abs(delta).toFixed(1)+'%</td>';
    return '<tr style="border-bottom:1px solid #f1f5f9">'+cells+'</tr>';
  }).join('');

  // Totale
  var anniTot={};
  anni.forEach(function(a){anniTot[a]=promos.reduce(function(s,p){return s+(matrix[p]&&matrix[p][a]?matrix[p][a].cnt:0);},0);});
  var totRow='<tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0"><td style="padding:5px 8px;font-size:11px">TOTALE</td>';
  anni.forEach(function(a){
    totRow+='<td style="padding:5px 6px;font-size:11px;text-align:right;border-left:1px solid #e2e8f0">'+anniTot[a]+'</td><td style="padding:5px 6px;font-size:11px;text-align:right">100%</td>';
  });
  var la=anni[anni.length-1],pa=anni[anni.length-2];
  var dt=pa&&anniTot[pa]>0?(anniTot[la]-anniTot[pa])/anniTot[pa]*100:0;
  totRow+='<td style="padding:5px 8px;font-size:11px;text-align:right;font-weight:700;color:'+(dt>0?'#10B981':'#EF4444')+';border-left:2px solid #e2e8f0">'+(dt>0?'▲':'▼')+' '+Math.abs(dt).toFixed(1)+'%</td></tr>';

  var tabella='<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white;margin-bottom:14px">'
    +'<div style="background:#DC2626;padding:9px 14px;display:flex;align-items:center;justify-content:space-between">'
    +'<span style="color:white;font-size:12px;font-weight:700">👤 Dettaglio per promotore — confronto anni</span>'
    +'<span style="background:rgba(255,255,255,0.2);color:white;font-size:10px;padding:2px 10px;border-radius:20px">'+promos.length+' promotori</span></div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead>'+th+'</thead><tbody>'+rows+totRow+'</tbody></table></div></div>';

  var trend='<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white">'
    +'<div style="background:#8B5CF6;padding:9px 14px;display:flex;align-items:center;justify-content:space-between">'
    +'<span style="color:white;font-size:12px;font-weight:700">📈 Trend numerico per anno</span>'
    +'<span style="background:rgba(255,255,255,0.2);color:white;font-size:10px;padding:2px 10px;border-radius:20px">'+(soloMese?MESI[mese]+' → '+MESI[mese]:'Gennaio → '+MESI[mese])+'</span></div>'
    +'<div style="padding:10px"><canvas id="'+trendId+'" height="110"></canvas></div></div>';

  return tabella + trend;
}

// ── PAGINA 3: RAFFRONTO MESE ──────────────────────────────────────────────────
function repPag3_RaffrontoMese(data, anno, mese) {
  return repPage(
    repHeader('Raffronto mesi con anni precedenti: '+MESI[mese], anno, mese),
    repBuildConfronto(data, anno, mese, true, 'rep-c3-trend'),
    repFooter('4')
  );
}

// ── PAGINA 4: RAFFRONTO YTD ───────────────────────────────────────────────────
function repPag4_RaffrontoYTD(data, anno, mese) {
  return repPage(
    repHeader('Raffronto con anni precedenti, periodo di riferimento: gennaio/'+MESI[mese], anno, mese),
    repBuildConfronto(data, anno, mese, false, 'rep-c4-trend'),
    repFooter('5')
  );
}

// ── SCHEDE PROMOTORI ──────────────────────────────────────────────────────────
function repGetPromoCards(data, anno) {
  var anniSet={};
  data.forEach(function(r){if(r.anno)anniSet[r.anno]=1;});
  var anni=Object.keys(anniSet).map(Number).sort();
  var promoSet={};
  data.forEach(function(r){var p=r.promotore||r.a_cura_di||'N/D'; promoSet[p]=1;});
  var promos=Object.keys(promoSet).sort();

  return promos.map(function(p,pi){
    var color=COLORS_PROMO[pi%COLORS_PROMO.length];
    var annData={}, spark=new Array(12).fill(0);
    data.forEach(function(r){
      var rp=r.promotore||r.a_cura_di||'N/D';
      if(rp!==p) return;
      var a=parseInt(r.anno), m=parseInt(r.mese);
      if(!annData[a]) annData[a]={cnt:0,tot:0};
      annData[a].cnt++; annData[a].tot+=parseFloat(r.importo)||0;
      if(a===anno&&m>=1&&m<=12) spark[m-1]++;
    });
    var totTot=Object.values(annData).reduce(function(s,d){return s+d.tot;},0);
    var totCnt=Object.values(annData).reduce(function(s,d){return s+d.cnt;},0);
    var pctGlob=data.length>0?(totCnt/data.length*100).toFixed(1)+'% globale':'';
    return {p:p,color:color,anni:anni,annData:annData,spark:spark,totTot:totTot,totCnt:totCnt,pctGlob:pctGlob};
  });
}

function repSchedaHTML(c, suffix) {
  var media = c.totCnt>0?c.totTot/c.totCnt:0;
  var anniAttivi=Object.values(c.annData).filter(function(d){return d.tot>0;}).length;

  var header='<div style="background:'+c.color+';padding:9px 14px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between">'
    +'<span style="color:white;font-size:12px;font-weight:700">'+c.p+'</span>'
    +'<span style="color:rgba(255,255,255,0.9);font-size:11px">€ '+repFmt(c.totTot,0)+' totale</span></div>';

  var kpis='<div style="display:flex;border-bottom:1px solid #f1f5f9">'
    +'<div style="flex:1;padding:7px 10px;text-align:center;border-right:1px solid #f1f5f9"><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">Contratti</div><div style="font-size:14px;font-weight:800;color:#0f172a">'+c.totCnt+'</div></div>'
    +'<div style="flex:1;padding:7px 10px;text-align:center;border-right:1px solid #f1f5f9"><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">Media</div><div style="font-size:14px;font-weight:800;color:#0f172a">€ '+repFmt(media,0)+'</div></div>'
    +'<div style="flex:1;padding:7px 10px;text-align:center"><div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700">Anni attivi</div><div style="font-size:14px;font-weight:800;color:#0f172a">'+anniAttivi+'</div></div>'
    +'</div>';

  var spark='<div style="padding:4px 8px"><canvas id="rep-spark-'+suffix+'" height="65"></canvas></div>';

  var annRows=c.anni.map(function(a,ai){
    var d=c.annData[a]||{cnt:0,tot:0};
    var delta='';
    if(ai>0){
      var prev=c.annData[c.anni[ai-1]]||{cnt:0};
      if(prev.cnt>0){
        var dv=(d.cnt-prev.cnt)/prev.cnt*100;
        var dc=dv>0?'#10B981':'#EF4444';
        delta='<span style="color:'+dc+';font-size:10px;font-weight:700">'+(dv>0?'▲':'▼')+' '+Math.abs(dv).toFixed(1)+'%</span>';
      }
    }
    var hl=a===new Date().getFullYear()?'font-weight:700;color:#0f172a':'color:#475569';
    return '<tr style="border-bottom:1px solid #f8fafc"><td style="padding:3px 7px;font-size:11px;'+hl+'">'+a+'</td>'
      +'<td style="padding:3px 7px;font-size:11px;text-align:right;color:#475569">€ '+repFmt(d.tot,0)+'</td>'
      +'<td style="padding:3px 7px;font-size:11px;text-align:right;color:#475569">'+d.cnt+'</td>'
      +'<td style="padding:3px 7px;font-size:10px;text-align:right">'+delta+'</td></tr>';
  }).join('');

  var table='<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc">'
    +'<th style="padding:3px 7px;text-align:left;font-size:9px;color:#64748b;text-transform:uppercase">Anno</th>'
    +'<th style="padding:3px 7px;text-align:right;font-size:9px;color:#64748b;text-transform:uppercase">Importo</th>'
    +'<th style="padding:3px 7px;text-align:right;font-size:9px;color:#64748b;text-transform:uppercase">Nr.</th>'
    +'<th style="padding:3px 7px;text-align:right;font-size:9px;color:#64748b;text-transform:uppercase">% anno</th>'
    +'<th style="padding:3px 7px;text-align:right;font-size:9px;color:#64748b;text-transform:uppercase">Δ vs prec.</th>'
    +'</tr></thead><tbody>'+annRows+'</tbody>'
    +'<tfoot><tr style="border-top:1px solid #e2e8f0;background:#f8fafc;font-weight:700">'
    +'<td style="padding:4px 7px;font-size:11px">Totale</td>'
    +'<td style="padding:4px 7px;font-size:11px;text-align:right">€ '+repFmt(c.totTot,0)+'</td>'
    +'<td style="padding:4px 7px;font-size:11px;text-align:right">'+c.totCnt+'</td>'
    +'<td style="padding:4px 7px;font-size:10px;text-align:right"></td>'
    +'<td style="padding:4px 7px;font-size:10px;text-align:right;color:#64748b">'+c.pctGlob+'</td>'
    +'</tr></tfoot></table>';

  return '<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:white">'
    +header+kpis+spark+'<div style="padding:0 0 4px">'+table+'</div></div>';
}

function repPag5_SchedeA(data, anno, mese) {
  var cards=repGetPromoCards(data,anno);
  var first=cards.slice(0,3);
  while(first.length<3) first.push(first[0]||{p:'–',color:'#ccc',anni:[],annData:{},spark:[],totTot:0,totCnt:0,pctGlob:''});
  var body='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
    +first.map(function(c,i){return repSchedaHTML(c,'5-'+i);}).join('')+'</div>';
  return repPage(repHeader('Schede individuali per promotore',anno,mese),body,repFooter('6'));
}

function repPag6_SchedeB(data, anno, mese) {
  var cards=repGetPromoCards(data,anno);
  var second=cards.slice(3,6);
  if(!second.length) return repPage(repHeader('Schede individuali per promotore',anno,mese),'<p style="color:#94a3b8;text-align:center;padding:40px">Meno di 4 promotori presenti.</p>',repFooter('7'));
  while(second.length<3) second.push(second[0]);
  var body='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
    +second.map(function(c,i){return repSchedaHTML(c,'6-'+i);}).join('')+'</div>';
  return repPage(repHeader('Schede individuali per promotore',anno,mese),body,repFooter('7'));
}

// ── PAGINA 7: SERIE STORICA (da tabella serie_storica — ultimi 10 anni) ────────
function repPag8_SerieStoricaTabella(storicaData, anno, mese) {
  var MESI_ORD = [1,2,3,4,5,6,7,9,10,11,12];
  var MESI_NOMI = {1:'Gennaio',2:'Febbraio',3:'Marzo',4:'Aprile',5:'Maggio',6:'Giugno',
    7:'Luglio/Ago',9:'Settembre',10:'Ottobre',11:'Novembre',12:'Dicembre'};

  // Costruisce matrice da serie_storica
  var mat = {};
  var anniSet = {};
  storicaData.forEach(function(r) {
    var a = parseInt(r.anno), m = parseInt(r.mese);
    if (!a || !m) return;
    anniSet[a] = 1;
    if (!mat[m]) mat[m] = {};
    mat[m][a] = r.valore || 0;
  });

  // Prende solo gli ultimi 10 anni disponibili
  var tuttiAnni = Object.keys(anniSet).map(Number).sort(function(a,b){return a-b;});
  var anni = tuttiAnni.slice(-10);

  if (!anni.length) {
    return repPage(repHeader('Serie storica', anno, mese),
      '<div style="padding:40px;text-align:center;color:#94a3b8">Dati serie storica non disponibili</div>',
      repFooter('8'));
  }

  var la = anni[anni.length-1];
  var pa = anni[anni.length-2];
  var ppa = anni[anni.length-3];

  // ── HEADER TABELLA ──
  var colW = Math.floor(900 / (anni.length + 3)); // larghezza colonna dinamica

  var th = '<tr style="background:#1e293b">'
    + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.4px;min-width:90px">Mese</th>';
  anni.forEach(function(a) {
    var isLa = a === la;
    th += '<th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:white;text-transform:uppercase;'
      + (isLa ? 'background:#005CA9;' : '') + 'min-width:'+colW+'px">' + a + '</th>';
  });
  th += '<th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:#FCA5A5;text-transform:uppercase;min-width:50px">su '+pa+'</th>';
  th += '<th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;min-width:50px">su '+ppa+'</th>';
  th += '</tr>';

  // ── RIGHE MESI ──
  // Heat-map: calcola min/max per riga
  function cellStyle(v, m) {
    var vals = anni.map(function(a){ return mat[m]&&mat[m][a]?mat[m][a]:0; }).filter(function(x){return x>0;});
    if (!vals.length || v === 0) return '';
    var mx = Math.max.apply(null,vals), mn = Math.min.apply(null,vals);
    if (mx === mn) return '';
    var pct = (v-mn)/(mx-mn);
    var r = Math.round(255-pct*(255-0));
    var g = Math.round(255-pct*(255-92));
    var b = Math.round(255-pct*(255-169));
    var txtCol = pct > 0.55 ? 'white' : '#0f172a';
    return 'background:rgb('+r+','+g+','+b+');color:'+txtCol+';';
  }

  var rows = '';
  MESI_ORD.forEach(function(m) {
    var row = mat[m] || {};
    var lv = row[la]||0, pv = pa?(row[pa]||0):0, ppv = ppa?(row[ppa]||0):0;
    var d1 = lv-pv, d2 = lv-ppv;
    var c1 = d1>0?'#10B981':d1<0?'#EF4444':'#64748b';
    var c2 = d2>0?'#10B981':d2<0?'#EF4444':'#64748b';
    var rowBg = (MESI_ORD.indexOf(m)%2===0)?'background:#f8fafc':'';

    rows += '<tr style="border-bottom:1px solid #f1f5f9;'+rowBg+'">'
      + '<td style="padding:6px 12px;font-size:11px;font-weight:700;color:#0f172a;white-space:nowrap">'+MESI_NOMI[m]+'</td>';
    anni.forEach(function(a) {
      var v = row[a]||0;
      var isLa = a === la;
      var hs = cellStyle(v, m);
      rows += '<td style="padding:6px 6px;font-size:11px;text-align:right;'
        + (hs || (isLa?'font-weight:700;color:#005CA9':'color:#475569')) + '">'
        + (v || '–') + '</td>';
    });
    rows += '<td style="padding:6px 6px;font-size:11px;text-align:right;font-weight:700;color:'+c1+'">'+(d1!==0?(d1>0?'+':'')+d1:'–')+'</td>';
    rows += '<td style="padding:6px 6px;font-size:11px;text-align:right;color:'+c2+'">'+(d2!==0?(d2>0?'+':'')+d2:'–')+'</td></tr>';
  });

  // ── TOTALE ──
  var anniTot = {};
  anni.forEach(function(a){
    anniTot[a] = MESI_ORD.reduce(function(s,m){ return s+(mat[m]&&mat[m][a]?mat[m][a]:0); }, 0);
  });
  var td1 = anniTot[la]-(anniTot[pa]||0), td2 = anniTot[la]-(anniTot[ppa]||0);
  var totRow = '<tr style="background:#f8fafc;border-top:2px solid #e2e8f0;font-weight:700">'
    + '<td style="padding:7px 12px;font-size:11px;font-weight:800;color:#0f172a">Totale</td>';
  anni.forEach(function(a){
    var isLa = a===la;
    totRow += '<td style="padding:7px 6px;font-size:11px;font-weight:800;text-align:right;'+(isLa?'color:#005CA9':'color:#475569')+'">'+anniTot[a]+'</td>';
  });
  totRow += '<td style="padding:7px 6px;font-size:11px;font-weight:800;text-align:right;color:'+(td1>0?'#10B981':'#EF4444')+'">'+(td1>0?'+':'')+td1+'</td>';
  totRow += '<td style="padding:7px 6px;font-size:11px;font-weight:700;text-align:right;color:'+(td2>0?'#10B981':'#EF4444')+'">'+(td2>0?'+':'')+td2+'</td></tr>';

  // ── LEGENDA ──
  var legenda = '<div style="display:flex;align-items:center;gap:20px;padding:10px 14px;border-top:1px solid #f1f5f9">'
    + '<div style="display:flex;align-items:center;gap:6px">'
    + '<div style="width:36px;height:8px;border-radius:3px;background:linear-gradient(to right,#e0ecfb,#005CA9)"></div>'
    + '<span style="font-size:9px;color:#64748b;font-weight:600">Intensità contratti per riga</span></div>'
    + '<div style="display:flex;align-items:center;gap:6px">'
    + '<div style="width:10px;height:10px;background:#005CA9;border-radius:2px"></div>'
    + '<span style="font-size:9px;color:#64748b;font-weight:600">Anno corrente ('+la+')</span></div>'
    + '<div style="font-size:9px;color:#94a3b8;margin-left:auto">Fonte: Supabase · serie_storica · ultimi 10 anni</div>'
    + '</div>';

  var body = '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white">'
    + '<table style="width:100%;border-collapse:collapse">'
    + '<thead>' + th + '</thead>'
    + '<tbody>' + rows + totRow + '</tbody>'
    + '</table>'
    + legenda
    + '</div>';

  return repPage(repHeader('Serie storica', anno, mese), body, repFooter('8'));
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER CHART.JS
// ══════════════════════════════════════════════════════════════════════════════
function repRenderAllCharts(data, anno, mese) {
  function mkBar(id, labels, values, colors) {
    var el=G(id); if(!el) return;
    var ck='repCh_'+id;
    if(charts[ck]){charts[ck].destroy();delete charts[ck];}
    charts[ck]=new Chart(el.getContext('2d'),{
      type:'bar',
      data:{labels:labels.map(function(l){return l&&l.length>16?l.substring(0,14)+'…':l;}),
        datasets:[{data:values,backgroundColor:colors,borderRadius:4,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{font:{size:9}}},
          y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:9},callback:function(v){return v>=1000?(v/1000).toFixed(0)+'k':v;}}}}}
    });
  }
  function mkLine(id, labels, values, color) {
    var el=G(id); if(!el) return;
    var ck='repCh_'+id;
    if(charts[ck]){charts[ck].destroy();delete charts[ck];}
    charts[ck]=new Chart(el.getContext('2d'),{
      type:'line',
      data:{labels:labels,datasets:[{data:values,borderColor:color,backgroundColor:color+'20',tension:0.4,fill:true,pointBackgroundColor:color,pointRadius:4,pointBorderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{font:{size:9}}},
          y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:9}}}}}
    });
  }
  function mkSparkline(id, labels, values, color) {
    var el=G(id); if(!el) return;
    var ck='repCh_'+id;
    if(charts[ck]){charts[ck].destroy();delete charts[ck];}
    charts[ck]=new Chart(el.getContext('2d'),{
      type:'line',
      data:{labels:labels,datasets:[{data:values,borderColor:color,backgroundColor:color+'18',tension:0.4,fill:true,pointRadius:3,pointBackgroundColor:color,pointBorderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false},ticks:{font:{size:8}}},y:{display:false}}}
    });
  }

  // P1: mensile
  var recM=repFiltro(data,anno,mese,true);
  var rM=repGetRete(recM); var pM=repGetPromo(recM);
  var rkM=Object.keys(rM).sort(function(a,b){return rM[b].tot-rM[a].tot;});
  mkBar('rep-c1-rete',rkM,rkM.map(function(k){return rM[k].tot;}),['#3B82F6','#F59E0B','#10B981','#8B5CF6','#EC4899']);
  var pkM=Object.keys(pM).sort(function(a,b){return pM[b].tot-pM[a].tot;});
  mkBar('rep-c1-promo',pkM,pkM.map(function(k){return pM[k].tot;}),COLORS_PROMO);

  // P2: annuale
  var recY=repFiltro(data,anno,mese,false);
  var rY=repGetRete(recY); var pY=repGetPromo(recY);
  var rkY=Object.keys(rY).sort(function(a,b){return rY[b].tot-rY[a].tot;});
  mkBar('rep-c2-rete',rkY,rkY.map(function(k){return rY[k].tot;}),['#3B82F6','#F59E0B','#10B981','#8B5CF6','#EC4899']);
  var pkY=Object.keys(pY).sort(function(a,b){return pY[b].tot-pY[a].tot;});
  mkBar('rep-c2-promo',pkY,pkY.map(function(k){return pY[k].tot;}),COLORS_PROMO);

  // P3/P4: trend
  var anniSet={};
  data.forEach(function(r){if(r.anno)anniSet[r.anno]=1;});
  var anni=Object.keys(anniSet).map(Number).sort();
  mkLine('rep-c3-trend',anni.map(String),anni.map(function(a){return data.filter(function(r){return parseInt(r.anno)===a&&parseInt(r.mese)===mese;}).length;}),'#8B5CF6');
  mkLine('rep-c4-trend',anni.map(String),anni.map(function(a){return data.filter(function(r){return parseInt(r.anno)===a&&parseInt(r.mese)<=mese;}).length;}),'#8B5CF6');

  // P5/P6: sparklines
  var cards=repGetPromoCards(data,anno);
  cards.forEach(function(c,i){
    var suffix=(i<3?'5':'6')+'-'+(i<3?i:i-3);
    mkSparkline('rep-spark-'+suffix,MESI.slice(1),c.spark,c.color);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERA PDF
// ══════════════════════════════════════════════════════════════════════════════
async function repGeneraPDF() {
  if(!isAdmin()){toast('Accesso non autorizzato','error');return;}
  var btn=G('rep-btn-pdf');
  btn.disabled=true; btn.textContent='⏳ Generazione…';
  showLoad('Preparazione PDF…');
  try {
    var anno=parseInt(G('rep-anno').value);
    var mese=parseInt(G('rep-mese').value);
    var {jsPDF}=window.jspdf;
    var pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    var PW=297, PH=210;
    var container=G('rep-pages-container');
    if(!container) throw new Error('Anteprima non trovata. Clicca prima Carica Dati.');
    var pageDivs=container.querySelectorAll('[data-page]');
    if(!pageDivs.length) throw new Error('Nessuna pagina. Clicca prima Carica Dati.');
    for(var i=0;i<pageDivs.length;i++){
      showLoad('Rendering pagina '+(i+1)+' di '+pageDivs.length+'…');
      await new Promise(function(r){setTimeout(r,400);});
      var pd=pageDivs[i].firstElementChild||pageDivs[i];
      var cv=await html2canvas(pd,{scale:2.4,useCORS:true,allowTaint:true,logging:false,backgroundColor:'#ffffff',width:1060,windowWidth:1060});
      var id=cv.toDataURL('image/jpeg',0.92);
      if(i>0) pdf.addPage('a4','landscape');
      var ratio=cv.width/cv.height;
      var iw=PW, ih=iw/ratio;
      if(ih>PH){ih=PH;iw=ih*ratio;}
      var x=(PW-iw)/2, y=(PH-ih)/2;
      pdf.addImage(id,'JPEG',x,y,iw,ih);
    }
    var fname='Report_CNA_Roma_'+MESI[mese]+'_'+anno+'.pdf';
    pdf.save(fname);
    toast('✓ PDF generato: '+fname,'success');
  } catch(e){
    console.error(e);
    toast('Errore PDF: '+e.message,'error');
  } finally {
    hideLoad();
    btn.disabled=false; btn.textContent='📄 Genera PDF';
  }
}

// ── PAGINA 8: PREVISIONE ANNO CORRENTE ───────────────────────────────────────
function repPagPrevisione(storicaData, anno) {
  var ANNO_CUR = anno;
  var OBIETTIVO = (window.storicaObiettivi && window.storicaObiettivi[ANNO_CUR]) || 1000;
  var MESI_ORD_P = [1,2,3,4,5,6,7,9,10,11,12];
  var NOMI_P = {1:'Gennaio',2:'Febbraio',3:'Marzo',4:'Aprile',5:'Maggio',6:'Giugno',
    7:'Lug/Ago',9:'Settembre',10:'Ottobre',11:'Novembre',12:'Dicembre'};
  var ANNI_RIFE = [ANNO_CUR-5,ANNO_CUR-4,ANNO_CUR-3,ANNO_CUR-2,ANNO_CUR-1];

  // Costruisce matrice da serie_storica
  var matrix = {};
  storicaData.forEach(function(r) {
    if (!matrix[r.mese]) matrix[r.mese] = {};
    matrix[r.mese][r.anno] = {v: r.valore || 0};
  });

  // Valori reali anno corrente
  var realiCur = {};
  storicaData.forEach(function(r) { if (r.anno === ANNO_CUR) realiCur[r.mese] = r.valore || 0; });
  var totReale = Object.values(realiCur).reduce(function(s,v){return s+v;},0);
  var mesiReali = Object.keys(realiCur).map(Number).sort(function(a,b){return a-b;});
  var mesiFuturi = MESI_ORD_P.filter(function(m){ return !realiCur.hasOwnProperty(m); });

  // Regressione lineare per ogni mese
  function stimaMese(m) {
    var vals = ANNI_RIFE.map(function(a){ return matrix[m]&&matrix[m][a]?matrix[m][a].v:0; });
    var n=vals.length, mx=(n-1)/2;
    var my=vals.reduce(function(s,v){return s+v;},0)/n;
    var num=vals.reduce(function(s,v,i){return s+(i-mx)*(v-my);},0);
    var den=vals.reduce(function(s,v,i){return s+(i-mx)*(i-mx);},0);
    var slope=den?num/den:0;
    var trend=Math.max(0,Math.round(my+slope*(5-mx)));
    return Math.round(0.6*trend+0.4*my);
  }

  var stime = {};
  MESI_ORD_P.forEach(function(m){ stime[m]=stimaMese(m); });

  var totStimaNaturale = totReale + mesiFuturi.reduce(function(s,m){return s+stime[m];},0);
  var fabbisogno = OBIETTIVO - totReale;
  var stimaNatFut = mesiFuturi.reduce(function(s,m){return s+stime[m];},0);
  var boost = stimaNatFut > 0 ? fabbisogno / stimaNatFut : 1;

  var piano = {}, cumPiano = totReale;
  mesiFuturi.forEach(function(m){
    var t = Math.round(stime[m] * boost);
    cumPiano += t;
    piano[m] = {target:t, naturale:stime[m], extra:t-stime[m], cum:cumPiano};
  });

  var pctRaggiunta = Math.min(100, Math.round(totReale/OBIETTIVO*100));
  var pctStima = Math.min(100, Math.round(totStimaNaturale/OBIETTIVO*100));
  var mancanti = OBIETTIVO - totReale;
  var mancherannoCon = OBIETTIVO - totStimaNaturale;
  var colStima = totStimaNaturale>=OBIETTIVO ? '#10B981' : '#F59E0B';
  var boostPct = Math.round((boost-1)*100);

  // ── HEADER scuro ──
  var header_block = '<div style="background:linear-gradient(135deg,#0a1628,#0d2d5e,#1a3a6e);border-radius:10px;padding:16px 22px;margin-bottom:14px;display:flex;align-items:center;gap:14px">'
    +'<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
    +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>'
    +'<div>'
    +'<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:white;line-height:1.15">Previsione '+ANNO_CUR+'</div>'
    +'<div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.55);margin-top:2px">Piano mensile · obiettivo '+OBIETTIVO.toLocaleString('it-IT')+' contratti · regressione lineare '+(ANNO_CUR-5)+'–'+(ANNO_CUR-1)+'</div>'
    +'</div></div>';

  // ── 4 KPI ──
  function kpi(label, val, sub, color, subColor) {
    return '<div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;border-left:4px solid '+color+';background:white">'
      +'<div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">'+label+'</div>'
      +'<div style="font-size:26px;font-weight:800;color:#0f172a;line-height:1;font-family:Inter,Helvetica,Arial,sans-serif">'+val+'</div>'
      +'<div style="font-size:10px;font-weight:600;color:'+(subColor||'#94a3b8')+';margin-top:3px">'+sub+'</div>'
      +'</div>';
  }
  var kpiHtml = '<div style="display:flex;gap:10px;margin-bottom:12px">'
    +kpi('Già realizzati', totReale, 'contratti '+ANNO_CUR, '#3B82F6')
    +kpi('Stima fine anno', totStimaNaturale, totStimaNaturale>=OBIETTIVO?'✓ Sopra obiettivo':'▼ '+Math.abs(mancherannoCon)+' sotto', colStima, colStima)
    +kpi('Ancora da fare', mancanti, 'per arrivare a '+OBIETTIVO.toLocaleString('it-IT'), '#EF4444', '#EF4444')
    +kpi('Boost necessario', (boostPct>0?'+':'')+boostPct+'%', 'rispetto al trend naturale', '#8B5CF6')
    +'</div>';

  // ── BARRA PROGRESSO ──
  var barHtml = '<div style="margin-bottom:14px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
    +'<span style="font-size:11px;font-weight:700;color:#0f172a">Avanzamento verso '+OBIETTIVO.toLocaleString('it-IT')+'</span>'
    +'<span style="font-size:11px;font-weight:700;color:#005CA9">'+totReale+' / '+OBIETTIVO+' ('+pctRaggiunta+'%)</span>'
    +'</div>'
    +'<div style="background:#f1f5f9;border-radius:99px;height:12px;overflow:hidden;position:relative">'
    +'<div style="position:absolute;left:0;top:0;height:100%;width:'+pctRaggiunta+'%;background:linear-gradient(90deg,#005CA9,#3B82F6);border-radius:99px"></div>'
    +'<div style="position:absolute;left:'+pctRaggiunta+'%;top:1px;height:calc(100% - 2px);width:'+(pctStima-pctRaggiunta)+'%;background:repeating-linear-gradient(90deg,#F59E0B 0,#F59E0B 7px,transparent 7px,transparent 13px);border-radius:99px;opacity:0.7"></div>'
    +'</div>'
    +'<div style="display:flex;gap:14px;margin-top:4px">'
    +'<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:5px;border-radius:2px;background:linear-gradient(90deg,#005CA9,#3B82F6)"></div><span style="font-size:9px;color:#64748b">Realizzati ('+pctRaggiunta+'%)</span></div>'
    +'<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:5px;border-radius:2px;background:repeating-linear-gradient(90deg,#F59E0B 0,#F59E0B 4px,transparent 4px,transparent 7px)"></div><span style="font-size:9px;color:#64748b">Stima trend (+'+(pctStima-pctRaggiunta)+'%)</span></div>'
    +'</div></div>';

  // ── PIANO MENSILE (griglia compatta) ──
  var pianoTitle = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    +'<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#005CA9,#3B82F6);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
    +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
    +'</div>'
    +'<span style="font-size:12px;font-weight:700;color:#0f172a">Piano mensile per raggiungere '+OBIETTIVO.toLocaleString('it-IT')+'</span>'
    +'</div>';

  var cardsHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';

  mesiReali.forEach(function(m){
    var v = realiCur[m];
    var nat = stime[m];
    var vs = v-nat;
    var vsColor = vs>=0?'#10B981':'#EF4444';
    cardsHtml += '<div style="border:1px solid #d1fae5;border-radius:7px;padding:8px 10px;background:#f0fdf4;display:flex;align-items:center;gap:8px">'
      +'<div style="width:26px;height:26px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
      +'<div style="min-width:0">'
      +'<div style="font-size:9px;font-weight:700;color:#059669;text-transform:uppercase">'+NOMI_P[m]+'</div>'
      +'<div style="font-size:14px;font-weight:800;color:#064e3b">'+v+' <span style="font-size:9px;color:'+vsColor+';font-weight:700">'+(vs>=0?'+':'')+vs+'</span></div>'
      +'</div></div>';
  });

  mesiFuturi.forEach(function(m){
    var p = piano[m];
    var isRaggiunto = p.cum >= OBIETTIVO;
    var barColor = isRaggiunto ? '#10B981' : '#005CA9';
    var pctBar = Math.min(100, Math.round(p.cum/OBIETTIVO*100));
    cardsHtml += '<div style="border:1px solid #dbeafe;border-radius:7px;padding:8px 10px;background:white;display:flex;align-items:center;gap:8px">'
      +'<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#005CA9,#3B82F6);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase">'+NOMI_P[m]+'</div>'
      +'<div style="font-size:14px;font-weight:800;color:#005CA9">'+p.target+' <span style="font-size:9px;color:#8B5CF6;font-weight:700">+'+p.extra+'</span></div>'
      +'<div style="background:#f1f5f9;border-radius:3px;height:3px;margin-top:3px"><div style="height:100%;width:'+pctBar+'%;background:'+barColor+';border-radius:3px"></div></div>'
      +'</div>'
      +'<div style="text-align:right;flex-shrink:0"><div style="font-size:12px;font-weight:800;color:'+barColor+'">'+p.cum+'</div><div style="font-size:8px;color:#94a3b8">cum.</div></div>'
      +'</div>';
  });

  cardsHtml += '</div>';

  var body = header_block + kpiHtml + barHtml + pianoTitle + cardsHtml;

  return repPage(repHeader('Previsione '+ANNO_CUR+' · Piano per '+OBIETTIVO.toLocaleString('it-IT'), anno, 4), body, repFooter('9'));
}

// ── PAGINE ATECO — 3 pagine per periodo ──────────────────────────────────────
function repPagAtecoSplit(data, anno, mese, soloMese) {
  var periodoLabel = soloMese ? MESI[mese] + ' ' + anno : 'Anno ' + anno;
  var prefisso = 'Analisi Ateco · ' + periodoLabel + ' · ';

  var rec = data.filter(function(r) {
    var a = parseInt(r.anno), m = parseInt(r.mese);
    if (a !== anno) return false;
    return soloMese ? m === mese : true;
  });

  var tot = rec.length;
  var byUnione = {}, byMestiere = {}, bySettore = {};
  var donne = 0, stranieri = 0;
  rec.forEach(function(r) {
    var u=r.unione||'N/D', m2=r.mestiere||'N/D', s=r.settore||'N/D';
    var sx=String(r.sesso||'').trim(), naz=String(r.nazionalita||'').trim();
    if(!byUnione[u])    byUnione[u]   ={tot:0,f:0,str:0};
    if(!byMestiere[m2]) byMestiere[m2]={tot:0,f:0,str:0};
    if(!bySettore[s])   bySettore[s]  ={tot:0,f:0,str:0};
    byUnione[u].tot++;   if(sx==='Femmina'){byUnione[u].f++;donne++;}     if(naz==='Straniero'){byUnione[u].str++;stranieri++;}
    byMestiere[m2].tot++; if(sx==='Femmina')byMestiere[m2].f++;            if(naz==='Straniero')byMestiere[m2].str++;
    bySettore[s].tot++;  if(sx==='Femmina')bySettore[s].f++;               if(naz==='Straniero')bySettore[s].str++;
  });

  if (!tot) {
    var pBase0 = soloMese ? 9 : 12;
    var vuota = '<div style="padding:60px;text-align:center;color:#94a3b8;font-size:14px">Nessun dato per questo periodo</div>';
    return [
      repPage(repHeader(prefisso+'Unione',   anno, mese), vuota, repFooter(String(pBase0))),
      repPage(repHeader(prefisso+'Mestiere', anno, mese), vuota, repFooter(String(pBase0+1))),
      repPage(repHeader(prefisso+'Settore',  anno, mese), vuota, repFooter(String(pBase0+2))),
    ];
  }

  // Tabella landscape full-width per una sola card
  function atecoTblFull(byKey, label, color) {
    var allKeys = Object.keys(byKey);
    var sorted = allKeys.sort(function(a,b){return byKey[b].tot-byKey[a].tot;}).slice(0,15);
    var totVoci = allKeys.length;
    var maxTot = byKey[sorted[0]] ? byKey[sorted[0]].tot : 1;
    var totGruppo = allKeys.reduce(function(s,k){return s+byKey[k].tot;},0);
    var totF      = allKeys.reduce(function(s,k){return s+byKey[k].f;},0);
    var totStr    = allKeys.reduce(function(s,k){return s+byKey[k].str;},0);
    var totPct    = tot>0?(totGruppo/tot*100).toFixed(1):'0.0';
    var tpF       = totGruppo>0?(totF/totGruppo*100).toFixed(0):'0';
    var tpS       = totGruppo>0?(totStr/totGruppo*100).toFixed(0):'0';
    var badge = sorted.length < totVoci ? 'Top '+sorted.length+' di '+totVoci : totVoci+' voci';

    var rows = sorted.map(function(k,i){
      var d=byKey[k];
      var pct=tot>0?(d.tot/tot*100).toFixed(1):'0.0';
      var nF=d.f, pF=d.tot>0?(d.f/d.tot*100).toFixed(0):'0';
      var nS=d.str, pS=d.tot>0?(d.str/d.tot*100).toFixed(0):'0';
      var bw=Math.max(5,Math.round(d.tot/maxTot*160));
      var bg=i%2===0?'':'background:#f8fafc';
      return '<tr style="border-bottom:1px solid #f1f5f9;'+bg+'">'
        +'<td style="padding:7px 14px;font-size:12px;font-weight:600;color:#0f172a">'+k+'</td>'
        +'<td style="padding:7px 12px;font-size:13px;font-weight:800;text-align:right;color:#0f172a">'+d.tot+'</td>'
        +'<td style="padding:7px 12px;font-size:11px;text-align:right;color:#6366f1">'+pct+'%</td>'
        +'<td style="padding:7px 14px;width:200px"><div style="width:'+bw+'px;height:6px;background:'+color+';border-radius:3px"></div></td>'
        +'<td style="padding:7px 12px;font-size:12px;text-align:right;color:#EC4899;font-weight:700;border-left:1px solid #f1f5f9">'+nF+'</td>'
        +'<td style="padding:7px 12px;font-size:11px;text-align:right;color:#EC4899">'+pF+'%</td>'
        +'<td style="padding:7px 12px;font-size:12px;text-align:right;color:#8B5CF6;font-weight:700;border-left:1px solid #f1f5f9">'+nS+'</td>'
        +'<td style="padding:7px 12px;font-size:11px;text-align:right;color:#8B5CF6">'+pS+'%</td>'
        +'</tr>';
    }).join('');

    var totRow = '<tr style="background:#f8fafc;border-top:2px solid #e2e8f0">'
      +'<td style="padding:8px 14px;font-size:12px;font-weight:800;color:#0f172a">Totale ('+totVoci+' voci)</td>'
      +'<td style="padding:8px 12px;font-size:13px;font-weight:800;text-align:right;color:#0f172a">'+totGruppo+'</td>'
      +'<td style="padding:8px 12px;font-size:11px;text-align:right;color:#6366f1;font-weight:700">'+totPct+'%</td>'
      +'<td style="padding:8px 14px"></td>'
      +'<td style="padding:8px 12px;font-size:12px;text-align:right;color:#EC4899;font-weight:800;border-left:1px solid #e2e8f0">'+totF+'</td>'
      +'<td style="padding:8px 12px;font-size:11px;text-align:right;color:#EC4899;font-weight:700">'+tpF+'%</td>'
      +'<td style="padding:8px 12px;font-size:12px;text-align:right;color:#8B5CF6;font-weight:800;border-left:1px solid #e2e8f0">'+totStr+'</td>'
      +'<td style="padding:8px 12px;font-size:11px;text-align:right;color:#8B5CF6;font-weight:700">'+tpS+'%</td>'
      +'</tr>';

    return '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white">'
      +'<div style="background:'+color+';padding:11px 18px;display:flex;align-items:center;justify-content:space-between">'
      +'<span style="font-size:14px;font-weight:700;color:white;letter-spacing:0.2px">'+label+'</span>'
      +'<span style="background:rgba(255,255,255,0.2);color:white;font-size:11px;padding:3px 14px;border-radius:20px">'+badge+'</span></div>'
      +'<table style="width:100%;border-collapse:collapse">'
      +'<thead>'
      +'<tr style="background:#f0f2f4;border-bottom:1px solid #e2e8f0">'
      +'<th colspan="4" style="padding:5px 14px;font-size:10px;color:#64748b;text-transform:uppercase;text-align:left">'+label+'</th>'
      +'<th colspan="2" style="padding:5px 12px;font-size:10px;font-weight:700;color:#EC4899;text-transform:uppercase;text-align:center;border-left:1px solid #e2e8f0">♀ Donne</th>'
      +'<th colspan="2" style="padding:5px 12px;font-size:10px;font-weight:700;color:#8B5CF6;text-transform:uppercase;text-align:center;border-left:1px solid #e2e8f0">Stranieri</th>'
      +'</tr>'
      +'<tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">'
      +'<th style="padding:6px 14px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase">Nome</th>'
      +'<th style="padding:6px 12px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase">Nr.</th>'
      +'<th style="padding:6px 12px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase">% Tot.</th>'
      +'<th style="padding:6px 14px;font-size:10px;color:#64748b;text-transform:uppercase">Peso</th>'
      +'<th style="padding:6px 12px;text-align:right;font-size:10px;color:#EC4899;text-transform:uppercase;border-left:1px solid #e2e8f0">Nr.</th>'
      +'<th style="padding:6px 12px;text-align:right;font-size:10px;color:#EC4899;text-transform:uppercase">%</th>'
      +'<th style="padding:6px 12px;text-align:right;font-size:10px;color:#8B5CF6;text-transform:uppercase;border-left:1px solid #e2e8f0">Nr.</th>'
      +'<th style="padding:6px 12px;text-align:right;font-size:10px;color:#8B5CF6;text-transform:uppercase">%</th>'
      +'</tr></thead>'
      +'<tbody>'+rows+totRow+'</tbody></table></div>';
  }

  // KPI strip compatta — va in cima alla pagina Unione
  function kpiStrip(label, val, color) {
    return '<div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;border-top:2px solid '+color+';background:white">'
      +'<div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">'+label+'</div>'
      +'<div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1;font-family:Inter,Helvetica,Arial,sans-serif">'+val+'</div></div>';
  }
  var kpiStrip6 = '<div style="display:flex;gap:10px;margin-bottom:14px">'
    +kpiStrip('Imprese totali', tot.toLocaleString('it-IT'), '#3B82F6')
    +kpiStrip('Unioni', Object.keys(byUnione).length, '#0047AB')
    +kpiStrip('Mestieri', Object.keys(byMestiere).length, '#DC2626')
    +kpiStrip('Settori', Object.keys(bySettore).length, '#F59E0B')
    +kpiStrip('Donne', donne+' ('+(tot>0?(donne/tot*100).toFixed(1):0)+'%)', '#EC4899')
    +kpiStrip('Stranieri', stranieri+' ('+(tot>0?(stranieri/tot*100).toFixed(1):0)+'%)', '#8B5CF6')
    +'</div>';

  // 3 pagine: Unione (con KPI in cima), Mestiere, Settore
  var pBase = soloMese ? 10 : 13;
  return [
    repPage(repHeader(prefisso+'Unione',   anno, mese), kpiStrip6 + atecoTblFull(byUnione,   'Unione',   '#0047AB'), repFooter(String(pBase))),
    repPage(repHeader(prefisso+'Mestiere', anno, mese), atecoTblFull(byMestiere, 'Mestiere', '#DC2626'), repFooter(String(pBase+1))),
    repPage(repHeader(prefisso+'Settore',  anno, mese), atecoTblFull(bySettore,  'Settore',  '#F59E0B'), repFooter(String(pBase+2))),
  ];
}

// ── PAGINE RAGGRUPPAMENTI E ZONE ─────────────────────────────────────────────
function repPagRaggruppamenti(data, anno, mese, soloMese, nPag) {
  var periodoLabel = soloMese ? MESI[mese] + ' ' + anno : 'Anno ' + anno;
  var titolo = 'Raggruppamenti e Zone · ' + periodoLabel;

  // ── Filtra record per periodo ──
  var rec = data.filter(function(r) {
    var a = parseInt(r.anno), m = parseInt(r.mese);
    if (a !== anno) return false;
    return soloMese ? m === mese : true;
  });

  var tot = rec.length;

  // ── Arricchisce ogni record con i flag (campi reali di tesseramento_records) ──
  rec.forEach(function(r) {
    // Sesso: 'Femmina'/'Maschio'
    var sx = String(r.sesso || '').trim().toLowerCase();
    r._isDonna = (sx === 'femmina' || sx === 'f');

    // Nazionalità: 'Italiano'/'Straniero'
    var naz = String(r.nazionalita || '').trim().toLowerCase();
    r._isStraniero = (naz === 'straniero');

    // Giovani: CF non disponibile in tesseramento_records → 0
    r._isGiovane = false;

    // ATECO: campo 'ateco'
    var ateco = String(r.ateco || '').replace(/\./g,'').replace(/\s/g,'');
    r._isCommercio = ateco.startsWith('46') || ateco.startsWith('47');
    r._isTurismo   = ateco.startsWith('55') || ateco.startsWith('56') || ateco.startsWith('79');
    r._isCinema    = ateco.startsWith('591') || ateco.startsWith('592');
  });

  // ── Aggregazione 6 categorie ──
  var cats = {
    commercio: { tot:0, donne:0, stranieri:0 },
    turismo:   { tot:0, donne:0, stranieri:0 },
    cinema:    { tot:0, donne:0, stranieri:0 },
    donne:     { tot:0, stranieri:0, giovani:0 },
    stranieri: { tot:0, donne:0, giovani:0 },
    giovani:   { tot:0, donne:0, stranieri:0 }
  };

  rec.forEach(function(r) {
    if (r._isCommercio) {
      cats.commercio.tot++;
      if (r._isDonna)     cats.commercio.donne++;
      if (r._isStraniero) cats.commercio.stranieri++;
    }
    if (r._isTurismo) {
      cats.turismo.tot++;
      if (r._isDonna)     cats.turismo.donne++;
      if (r._isStraniero) cats.turismo.stranieri++;
    }
    if (r._isCinema) {
      cats.cinema.tot++;
      if (r._isDonna)     cats.cinema.donne++;
      if (r._isStraniero) cats.cinema.stranieri++;
    }
    if (r._isDonna) {
      cats.donne.tot++;
      if (r._isStraniero) cats.donne.stranieri++;
      if (r._isGiovane)   cats.donne.giovani++;
    }
    if (r._isStraniero) {
      cats.stranieri.tot++;
      if (r._isDonna)   cats.stranieri.donne++;
      if (r._isGiovane) cats.stranieri.giovani++;
    }
    if (r._isGiovane) {
      cats.giovani.tot++;
      if (r._isDonna)     cats.giovani.donne++;
      if (r._isStraniero) cats.giovani.stranieri++;
    }
  });

  // ── Funzione card ──
  function card(label, icon, color, n, donne, stranieri, extraLabel, extraVal, extraColor) {
    var pct     = tot > 0 ? (n / tot * 100).toFixed(1) : '0';
    var pctD    = n > 0 ? (donne / n * 100).toFixed(0) : '0';
    var pctS    = n > 0 ? (stranieri / n * 100).toFixed(0) : '0';
    var pctEx   = n > 0 && extraVal !== undefined ? (extraVal / n * 100).toFixed(0) : null;
    return '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:white">'
      +'<div style="background:'+color+';padding:10px 14px;display:flex;align-items:center;gap:8px">'
      +'<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      +icon+'</div>'
      +'<span style="font-size:13px;font-weight:700;color:white">'+label+'</span>'
      +'</div>'
      +'<div style="padding:14px 16px">'
      // Numero grande
      +'<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:38px;font-weight:800;color:#0f172a;line-height:1;letter-spacing:-0.5px">'+n+'</div>'
      +'<div style="font-size:11px;color:#64748b;font-weight:600;margin-top:3px;margin-bottom:12px">'+pct+'% dei nuovi associati</div>'
      // Pill Donne + Stranieri
      +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
      +'<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(236,72,153,0.1);color:#be185d">♀ '+donne+' ('+pctD+'%)</span>'
      +'<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(16,185,129,0.1);color:#065f46">🌍 '+stranieri+' ('+pctS+'%)</span>'
      +(extraLabel && extraVal !== undefined ? '<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(59,130,246,0.1);color:#1e40af">'+extraLabel+' '+extraVal+' ('+pctEx+'%)</span>' : '')
      +'</div>'
      +'</div></div>';
  }

  var icoCommercio = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
  var icoTurismo   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  var icoCinema    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>';
  var icoDonne     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M12 12v8M9 18h6"/></svg>';
  var icoStranieri = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>';
  var icoGiovani   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';

  var body = tot === 0
    ? '<div style="padding:60px;text-align:center;color:#94a3b8">Nessun dato per questo periodo</div>'
    : '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'
        +card('Commercio',        icoCommercio, '#F59E0B', cats.commercio.tot, cats.commercio.donne, cats.commercio.stranieri)
        +card('Turismo',          icoTurismo,   '#3B82F6', cats.turismo.tot,   cats.turismo.donne,   cats.turismo.stranieri)
        +card('Cinema e Audiovisivo', icoCinema,'#8B5CF6', cats.cinema.tot,    cats.cinema.donne,    cats.cinema.stranieri)
        +card('Donne',            icoDonne,     '#EC4899', cats.donne.tot,     cats.donne.stranieri, cats.donne.giovani,     '⚡ Giovani', cats.donne.giovani, '#1d4ed8')
        +card('Stranieri',        icoStranieri, '#10B981', cats.stranieri.tot, cats.stranieri.donne, cats.stranieri.giovani, '⚡ Giovani', cats.stranieri.giovani, '#1d4ed8')
        +card('Giovani ≤40',      icoGiovani,   '#6366F1', cats.giovani.tot,   cats.giovani.donne,   cats.giovani.stranieri)
      +'</div>';

  // Il numero di pagina verrà sostituito da __TOTPAG__ in repBuildAllPages
  return repPage(repHeader(titolo, anno, mese), body, repFooter(nPag || '__'));
}
