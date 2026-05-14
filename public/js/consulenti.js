// ============================================================
// CONSULENTI.JS — Tab Gestione Consulenti  v2
// ============================================================

var consulentiAll = [];
var consulentiFiltered = [];
var consulentiLoaded = false;
var consulentiLoading = false;
var consulentiExpandedRow = null;
var consulentiSortKey = 'numContratti';
var consulentiSortDir = -1; // -1 desc, +1 asc

// ---------- Stili iniettati una volta ----------
(function() {
  if (document.getElementById('consulenti-styles')) return;
  var s = document.createElement('style');
  s.id = 'consulenti-styles';
  s.textContent = [
    /* Righe dati */
    '.consulenti-row { transition: background 0.15s, box-shadow 0.15s; }',
    '.consulenti-row:hover { background: rgba(0,92,169,0.05) !important; box-shadow: inset 3px 0 0 #005CA9; }',
    '.consulenti-row:hover .consulenti-nome { color: #003D7A !important; }',
    '.consulenti-row:hover .consulenti-toggle-icon { transform: scale(1.3); }',
    '.consulenti-toggle-icon { display:inline-block; transition: transform 0.2s; }',
    '.consulenti-row.is-expanded { background: rgba(0,92,169,0.07) !important; box-shadow: inset 3px 0 0 #005CA9; }',
    '.consulenti-expand-row td { padding: 0 !important; }',
    /* Header blu CNA */
    '#tab-consulenti thead tr { background: #005CA9; }',
    '#tab-consulenti thead th { color: #fff !important; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.3px; border-bottom: none; padding: 10px 12px; white-space: nowrap; }',
    '#tab-consulenti thead th small { color: rgba(255,255,255,0.7) !important; font-weight:400; }',
    /* Intestazioni ordinabili */
    '#tab-consulenti thead th.sortable { cursor: pointer; user-select: none; transition: background 0.15s; }',
    '#tab-consulenti thead th.sortable:hover { background: rgba(255,255,255,0.15); }',
    '.csort-icon { font-size: 11px; margin-left: 3px; opacity: 0.5; }',
    '#tab-consulenti thead th.sort-active .csort-icon { opacity: 1; color: #7dd3fc; }',
    /* Chip e badge */
    '.consulenti-badge { display:inline-block; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:600; margin:2px; white-space:nowrap; }',
    '.consulenti-assoc-chip { display:inline-flex; align-items:center; gap:5px; border-radius:20px; padding:4px 10px; font-size:12px; font-weight:700; white-space:nowrap; }',
    '.consulenti-pct-bar { height:4px; background:rgba(255,255,255,0.25); border-radius:2px; margin-top:5px; min-width:60px; max-width:100px; }',
    '.consulenti-pct-fill { height:4px; background:#005CA9; border-radius:2px; transition: width 0.4s; }',
    /* Bottone Excel */
    '.btn-consulente-excel { display:inline-flex; align-items:center; gap:4px; background:#16a34a; color:white; border:none; border-radius:5px; padding:4px 9px; font-size:11px; font-weight:700; cursor:pointer; transition:background 0.15s, transform 0.1s; white-space:nowrap; }',
    '.btn-consulente-excel:hover { background:#15803d; transform: scale(1.05); }',
    '.btn-consulente-excel:active { transform: scale(0.97); }',
  ].join('\n');
  document.head.appendChild(s);
})();

// ---------- Progress / Status ----------
function consulentiSetProgress(pct, msg) {
  var p = G('consulenti-progress'); if (p) p.style.width = pct + '%';
  var m = G('consulenti-load-msg'); if (m) m.textContent = msg;
}
function consulentiSetStatus(tipo, msg) {
  var el = G('consulenti-status-' + tipo); if (!el) return;
  var v = el.querySelector('.ana-sval'); if (v) v.textContent = msg;
}

// ---------- Fetch paginato ----------
async function consulentiFetchAll(endpoint) {
  var all = [], offset = 0, size = 1000;
  while (true) {
    var sep = endpoint.indexOf('?') === -1 ? '?' : '&';
    var r = await fetch(SB + '/rest/v1/' + endpoint + sep + 'select=*&offset=' + offset + '&limit=' + size, { headers: H() });
    if (!r.ok) throw new Error(endpoint + ': HTTP ' + r.status);
    var rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < size) break;
    offset += size;
  }
  return all;
}

// ---------- Load ----------
async function consulentiLoad(force) {
  if (consulentiLoading) return;
  if (consulentiLoaded && !force) return;
  consulentiLoading = true;
  G('consulenti-loader').classList.add('active');
  G('consulenti-content').style.display = 'none';
  consulentiExpandedRow = null;
  consulentiSetProgress(0, 'Connessione a Supabase…');
  ['contratti','anagrafiche','diretti','join'].forEach(function(t){ consulentiSetStatus(t,'In attesa…'); });

  try {
    consulentiSetProgress(5, 'Caricamento contratti attivi…'); consulentiSetStatus('contratti','Caricamento…');
    var contratti = await consulentiFetchAll('contrattiservizio?datadisdetta=is.null&tipocontratto=not.eq.SERVIZIO 730&tipocontratto=not.eq.PEC');
    consulentiSetStatus('contratti', contratti.length + ' caricati');

    consulentiSetProgress(35, 'Caricamento anagrafiche…'); consulentiSetStatus('anagrafiche','Caricamento…');
    var anagrafiche = await consulentiFetchAll('Anagrafiche');
    consulentiSetStatus('anagrafiche', anagrafiche.length + ' caricate');

    consulentiSetProgress(60, 'Caricamento diretti…'); consulentiSetStatus('diretti','Caricamento…');
    var diretti = await consulentiFetchAll('diretti');
    consulentiSetStatus('diretti', diretti.length + ' caricati');

    consulentiSetProgress(80, 'Elaborazione dati…'); consulentiSetStatus('join','Aggregazione…');

    var anaMap = {};
    anagrafiche.forEach(function(a) { anaMap[a.codiceanagrafica] = a; });

    var direttiMap = {};
    diretti.forEach(function(d) {
      var k = d.codiceanagrafica;
      if (!direttiMap[k]) direttiMap[k] = [];
      direttiMap[k].push(d);
    });

    var totaleContratti = contratti.length;
    var consulentiMap = {};

    contratti.forEach(function(c) {
      var nome = (c.nomeconsulente || '— Non assegnato —').trim();
      if (!consulentiMap[nome]) {
        consulentiMap[nome] = { nomeconsulente: nome, imprese: new Set(), tipiContratto: {}, sediErogazione: {}, raggruppamenti: {}, zone: {}, contratti: [] };
      }
      var agg = consulentiMap[nome];
      agg.contratti.push(c);
      agg.imprese.add(c.codicecliente);
      var tipo = c.tipocontratto || '—';
      agg.tipiContratto[tipo] = (agg.tipiContratto[tipo] || 0) + 1;
      var sede = c.sedeerogazione || '—';
      if (!agg.sediErogazione[sede]) agg.sediErogazione[sede] = {};
      agg.sediErogazione[sede][tipo] = (agg.sediErogazione[sede][tipo] || 0) + 1;
      agg.raggruppamenti[c.raggruppamento || '—'] = (agg.raggruppamenti[c.raggruppamento || '—'] || 0) + 1;
      agg.zone[c.zonacliente || '—'] = (agg.zone[c.zonacliente || '—'] || 0) + 1;
    });

    consulentiAll = Object.values(consulentiMap).map(function(agg) {
      var numContratti = agg.contratti.length;
      var pctTotale = totaleContratti > 0 ? ((numContratti / totaleContratti) * 100).toFixed(1) : '0.0';

      var mestieriCount = {};
      agg.imprese.forEach(function(cc) {
        var ana = anaMap[cc]; if (!ana) return;
        var m = ana.mestiere || '—';
        mestieriCount[m] = (mestieriCount[m] || 0) + 1;
      });

      var nAssociati = 0, nNonAssociati = 0;
      agg.imprese.forEach(function(cc) {
        var ana = anaMap[cc]; if (!ana) return;
        var dArr = direttiMap[ana.codiceanagrafica] || [];
        var isAssoc = dArr.some(function(d) {
          return d.servizio && d.servizio.toLowerCase().indexOf('iscritto') !== -1 && !d.datadisdetta;
        });
        if (isAssoc) nAssociati++; else nNonAssociati++;
      });

      return {
        nomeconsulente: agg.nomeconsulente,
        numImprese: agg.imprese.size,
        numContratti: numContratti,
        pctTotale: pctTotale,
        tipiContratto: agg.tipiContratto,
        sediErogazione: agg.sediErogazione,
        raggruppamenti: agg.raggruppamenti,
        zone: agg.zone,
        mestieriCount: mestieriCount,
        nAssociati: nAssociati,
        nNonAssociati: nNonAssociati,
        _imprese: Array.from(agg.imprese),
        _contratti: agg.contratti,  // raw per export Excel
        _anaMap: anaMap,
        _direttiMap: direttiMap
      };
    });

    consulentiAll.sort(function(a, b) { return b.numContratti - a.numContratti; });
    consulentiFiltered = consulentiAll.slice();
    consulentiSortKey = 'numContratti';
    consulentiSortDir = -1;

    consulentiSetProgress(100, 'Completato'); consulentiSetStatus('join','OK');
    consulentiPopulateFilters();
    consulentiRender();
    consulentiLoaded = true;
    setTimeout(function() {
      G('consulenti-loader').classList.remove('active');
      G('consulenti-content').style.display = 'block';
    }, 300);

  } catch(e) {
    console.error('Errore caricamento consulenti:', e);
    consulentiSetProgress(0, '❌ ' + e.message);
    toast('Errore consulenti: ' + e.message, 'error');
  } finally {
    consulentiLoading = false;
  }
}

// ---------- Filtri ----------
function consulentiPopulateFilters() {
  var tipiSet = {}, sediSet = {};
  consulentiAll.forEach(function(c) {
    Object.keys(c.tipiContratto).forEach(function(t) { tipiSet[t] = true; });
    Object.keys(c.sediErogazione).forEach(function(s) { sediSet[s] = true; });
  });
  var selTipo = G('consulenti-f-tipo');
  if (selTipo) {
    selTipo.innerHTML = '<option value="">Tutti i tipi…</option>';
    Object.keys(tipiSet).sort().forEach(function(t) {
      var o = document.createElement('option'); o.value = t; o.textContent = t; selTipo.appendChild(o);
    });
  }
  var selSede = G('consulenti-f-sede');
  if (selSede) {
    selSede.innerHTML = '<option value="">Tutte le sedi…</option>';
    Object.keys(sediSet).sort().forEach(function(s) {
      var o = document.createElement('option'); o.value = s; o.textContent = s; selSede.appendChild(o);
    });
  }
}

function consulentiApply() {
  var search = (G('consulenti-f-search') ? G('consulenti-f-search').value.trim().toLowerCase() : '');
  var tipo   = (G('consulenti-f-tipo')   ? G('consulenti-f-tipo').value   : '');
  var sede   = (G('consulenti-f-sede')   ? G('consulenti-f-sede').value   : '');
  consulentiFiltered = consulentiAll.filter(function(c) {
    if (search && c.nomeconsulente.toLowerCase().indexOf(search) === -1) return false;
    if (tipo && !c.tipiContratto[tipo]) return false;
    if (sede && !c.sediErogazione[sede]) return false;
    return true;
  });
  consulentiRender();
}

function consulentiReset() {
  if (G('consulenti-f-search')) G('consulenti-f-search').value = '';
  if (G('consulenti-f-tipo'))   G('consulenti-f-tipo').value   = '';
  if (G('consulenti-f-sede'))   G('consulenti-f-sede').value   = '';
  consulentiFiltered = consulentiAll.slice();
  consulentiRender();
}

// ---------- Sort ----------
function consulentiSort(key) {
  if (consulentiSortKey === key) {
    consulentiSortDir = -consulentiSortDir;
  } else {
    consulentiSortKey = key;
    consulentiSortDir = (key === 'nomeconsulente') ? 1 : -1;
  }

  consulentiFiltered.sort(function(a, b) {
    var va = a[key], vb = b[key];
    if (key === 'pctTotale') { va = parseFloat(va); vb = parseFloat(vb); }
    if (typeof va === 'string') return consulentiSortDir * va.localeCompare(vb, 'it');
    return consulentiSortDir * (va - vb);
  });

  // Aggiorna icone
  ['nomeconsulente','numImprese','pctTotale','nAssociati','nNonAssociati'].forEach(function(k) {
    var th = document.getElementById('cth-' + k);
    var ic = document.getElementById('csort-icon-' + k);
    if (!th || !ic) return;
    if (k === consulentiSortKey) {
      th.classList.add('sort-active');
      ic.textContent = consulentiSortDir === -1 ? '↓' : '↑';
    } else {
      th.classList.remove('sort-active');
      ic.textContent = '↕';
    }
  });

  consulentiRender();
}

// ---------- Render ----------
function consulentiRender() {
  var tbody = G('consulenti-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var totImprese = new Set(), totContratti = 0;
  consulentiAll.forEach(function(c) {
    c._imprese.forEach(function(i) { totImprese.add(i); });
    totContratti += c.numContratti;
  });
  G('consulenti-kpi-consulenti').textContent = consulentiAll.length;
  G('consulenti-kpi-imprese').textContent    = totImprese.size;
  G('consulenti-kpi-contratti').textContent  = totContratti;
  G('consulenti-count').textContent          = consulentiFiltered.length + ' consulenti';

  if (consulentiFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="ana-empty">Nessun consulente trovato</td></tr>';
    return;
  }

  consulentiFiltered.forEach(function(c) {
    var tipiHtml = Object.keys(c.tipiContratto).sort().map(function(t) {
      return '<span class="consulenti-badge" style="background:#EFF6FF;color:#005CA9">' +
        escHtml(t) + ' <b style="font-size:12px">' + c.tipiContratto[t] + '</b></span>';
    }).join('');

    var assocPct    = c.numImprese > 0 ? Math.round((c.nAssociati    / c.numImprese) * 100) : 0;
    var nonAssocPct = c.numImprese > 0 ? Math.round((c.nNonAssociati / c.numImprese) * 100) : 0;

    var tr = document.createElement('tr');
    tr.className = 'consulenti-row';
    tr.setAttribute('data-consulente', c.nomeconsulente);
    tr.style.cssText = 'cursor:pointer;transition:background 0.15s;';

    tr.innerHTML =
      '<td style="min-width:160px;max-width:220px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span class="consulenti-toggle-icon" style="font-size:11px;color:#005CA9;flex-shrink:0">▶</span>' +
          '<span class="consulenti-nome" style="font-weight:700;color:#005CA9;font-size:13px;transition:color 0.15s">' + escHtml(c.nomeconsulente) + '</span>' +
        '</div>' +
      '</td>' +
      '<td style="text-align:center;width:80px">' +
        '<div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1">' + c.numImprese + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:1px">imprese</div>' +
      '</td>' +
      '<td style="text-align:center;width:100px">' +
        '<div style="font-size:16px;font-weight:800;color:#005CA9">' + c.pctTotale + '<span style="font-size:11px;font-weight:500">%</span></div>' +
        '<div class="consulenti-pct-bar" style="margin:4px auto 0"><div class="consulenti-pct-fill" style="background:#005CA9;width:' + Math.min(parseFloat(c.pctTotale), 100) + '%"></div></div>' +
      '</td>' +
      '<td style="min-width:180px"><div style="display:flex;flex-wrap:wrap;gap:2px">' + tipiHtml + '</div></td>' +
      '<td style="text-align:center;width:90px">' +
        '<div class="consulenti-assoc-chip" style="background:#F0FDF4;color:#16a34a;margin:0 auto 4px">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' + c.nAssociati +
        '</div>' +
        '<div style="font-size:10px;color:#16a34a;font-weight:600">' + assocPct + '%</div>' +
      '</td>' +
      '<td style="text-align:center;width:90px">' +
        '<div class="consulenti-assoc-chip" style="background:#F3F4F6;color:#6b7280;margin:0 auto 4px">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' + c.nNonAssociati +
        '</div>' +
        '<div style="font-size:10px;color:#9ca3af;font-weight:600">' + nonAssocPct + '%</div>' +
      '</td>' +
      // COL 7 — Bottone Excel
      '<td style="text-align:center;width:70px">' +
        '<button class="btn-consulente-excel" onclick="event.stopPropagation();consulentiExportExcel(' + "'" + c.nomeconsulente.replace(/'/g,"\\'") + "'" + ')" title="Scarica Excel">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
          'Excel' +
        '</button>' +
      '</td>';

    tr.addEventListener('click', function() { consulentiToggleExpand(c, tr); });
    tbody.appendChild(tr);

    var trExp = document.createElement('tr');
    trExp.className = 'consulenti-expand-row';
    trExp.setAttribute('data-expand-for', c.nomeconsulente);
    trExp.style.display = 'none';
    var tdExp = document.createElement('td');
    tdExp.colSpan = 7;
    tdExp.style.padding = '0';
    trExp.appendChild(tdExp);
    tbody.appendChild(trExp);
  });
}

// ---------- Espansione ----------
function consulentiToggleExpand(consulente, trHeader) {
  var nome = consulente.nomeconsulente;
  var tbody = G('consulenti-tbody');
  var trExp = tbody.querySelector('[data-expand-for="' + CSS.escape(nome) + '"]');
  if (!trExp) return;
  var icon = trHeader.querySelector('.consulenti-toggle-icon');

  if (trExp.style.display === 'none') {
    if (consulentiExpandedRow && consulentiExpandedRow !== nome) {
      var prevExp = tbody.querySelector('[data-expand-for="' + CSS.escape(consulentiExpandedRow) + '"]');
      var prevHdr = tbody.querySelector('[data-consulente="' + CSS.escape(consulentiExpandedRow) + '"]');
      if (prevExp) prevExp.style.display = 'none';
      if (prevHdr) {
        prevHdr.classList.remove('is-expanded');
        var pi = prevHdr.querySelector('.consulenti-toggle-icon');
        if (pi) pi.textContent = '▶';
      }
    }
    trExp.firstChild.innerHTML = consulentiExpandContent(consulente);
    trExp.style.display = '';
    if (icon) icon.textContent = '▼';
    trHeader.classList.add('is-expanded');
    consulentiExpandedRow = nome;
  } else {
    trExp.style.display = 'none';
    if (icon) icon.textContent = '▶';
    trHeader.classList.remove('is-expanded');
    consulentiExpandedRow = null;
  }
}

// ---------- Contenuto espanso ----------
function consulentiExpandContent(consulente) {
  var totaleCons = consulente.numContratti;
  var totImp     = consulente.numImprese;
  var pctAssoc    = totImp > 0 ? ((consulente.nAssociati    / totImp) * 100).toFixed(1) : '0.0';
  var pctNonAssoc = totImp > 0 ? ((consulente.nNonAssociati / totImp) * 100).toFixed(1) : '0.0';

  var html = '<div style="padding:18px 20px 20px;background:linear-gradient(135deg,#f8faff,#EFF6FF);border-left:4px solid #005CA9;border-top:1px solid #DBEAFE;border-bottom:2px solid #DBEAFE">';
  html += '<div style="font-size:12px;font-weight:700;color:#005CA9;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.6px">📊 Dettaglio — ' + escHtml(consulente.nomeconsulente) + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">';

  // BOX 1 — Tipi contratto
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">📋 Contratti per Tipo</div>';
  Object.keys(consulente.tipiContratto).sort(function(a,b){ return consulente.tipiContratto[b]-consulente.tipiContratto[a]; }).forEach(function(tipo) {
    var cnt = consulente.tipiContratto[tipo];
    var pct = totaleCons > 0 ? ((cnt/totaleCons)*100).toFixed(1) : '0.0';
    html += '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">';
    html += '<span style="color:#1e293b;font-weight:500">' + escHtml(tipo) + '</span>';
    html += '<span style="font-weight:700;color:#005CA9">' + cnt + ' <span style="color:#94a3b8;font-weight:400;font-size:11px">(' + pct + '%)</span></span></div>';
    html += '<div style="height:3px;background:#E2E8F0;border-radius:2px"><div style="height:3px;background:#005CA9;border-radius:2px;width:' + Math.min(parseFloat(pct),100) + '%"></div></div></div>';
  });
  html += '</div>';

  // BOX 2 — Sede × Tipo
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🏢 Sede Erogazione × Tipo</div>';
  Object.keys(consulente.sediErogazione).sort().forEach(function(sede) {
    var tipiInSede = consulente.sediErogazione[sede];
    var totaleSede = Object.values(tipiInSede).reduce(function(s,v){return s+v;},0);
    html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:#1e293b;padding:3px 7px;background:#F1F5F9;border-radius:4px;margin-bottom:4px">';
    html += escHtml(sede) + ' <span style="font-weight:400;color:#64748b;font-size:10px">(' + totaleSede + ' contr.)</span></div>';
    Object.keys(tipiInSede).sort().forEach(function(tipo) {
      var cnt = tipiInSede[tipo];
      var pctSede = totaleSede > 0 ? ((cnt/totaleSede)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 7px;color:#64748b">';
      html += '<span>' + escHtml(tipo) + '</span>';
      html += '<span style="font-weight:600;color:#334155">' + cnt + ' <span style="color:#94a3b8;font-weight:400">(' + pctSede + '%)</span></span></div>';
    });
    html += '</div>';
  });
  html += '</div>';

  // BOX 3 — Mestieri
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🔨 Mestieri (Anagrafica)</div>';
  var mestieri = Object.keys(consulente.mestieriCount).sort(function(a,b){ return consulente.mestieriCount[b]-consulente.mestieriCount[a]; });
  if (mestieri.length === 0) {
    html += '<div style="font-size:12px;color:#94a3b8">Nessun mestiere trovato</div>';
  } else {
    mestieri.slice(0,15).forEach(function(m) {
      var cnt = consulente.mestieriCount[m];
      var pct = totImp > 0 ? ((cnt/totImp)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid #F1F5F9">';
      html += '<span style="color:#334155">' + escHtml(m) + '</span>';
      html += '<span style="font-weight:700;color:#7c3aed">' + cnt + ' <span style="color:#94a3b8;font-weight:400">(' + pct + '%)</span></span></div>';
    });
    if (mestieri.length > 15) html += '<div style="font-size:11px;color:#94a3b8;margin-top:5px">… e altri ' + (mestieri.length-15) + ' mestieri</div>';
  }
  html += '</div>';

  // BOX 4 — Stato associativo + Zone
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">👥 Stato Associativo</div>';
  html += '<div style="display:flex;gap:10px;margin-bottom:14px">';
  html += '<div style="flex:1;text-align:center;padding:12px 8px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0">';
  html += '<div style="font-size:24px;font-weight:800;color:#16a34a;line-height:1">' + consulente.nAssociati + '</div>';
  html += '<div style="font-size:11px;font-weight:700;color:#16a34a;margin-top:3px">Associati</div>';
  html += '<div style="font-size:13px;font-weight:800;color:#15803d;margin-top:2px">' + pctAssoc + '%</div></div>';
  html += '<div style="flex:1;text-align:center;padding:12px 8px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">';
  html += '<div style="font-size:24px;font-weight:800;color:#94a3b8;line-height:1">' + consulente.nNonAssociati + '</div>';
  html += '<div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:3px">Non Assoc.</div>';
  html += '<div style="font-size:13px;font-weight:800;color:#64748b;margin-top:2px">' + pctNonAssoc + '%</div></div></div>';
  if (totImp > 0) {
    html += '<div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden">';
    html += '<div style="height:8px;background:linear-gradient(90deg,#16a34a,#4ade80);border-radius:4px;width:' + Math.min(parseFloat(pctAssoc),100) + '%"></div></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:3px"><span>0%</span><span style="font-weight:600;color:#64748b">Associati</span><span>100%</span></div>';
  }
  if (Object.keys(consulente.zone).length > 0) {
    html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #F1F5F9">';
    html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">📍 Zone Cliente</div>';
    Object.keys(consulente.zone).sort().slice(0,8).forEach(function(zona) {
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #F8FAFC">';
      html += '<span style="color:#334155">' + escHtml(zona) + '</span>';
      html += '<span style="font-weight:600;color:#334155">' + consulente.zone[zona] + '</span></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  html += '</div></div>';
  return html;
}

// ---------- Export Excel per singolo consulente ----------
function consulentiExportExcel(nomeconsulente) {
  var consulente = consulentiAll.find(function(c) { return c.nomeconsulente === nomeconsulente; });
  if (!consulente) { toast('Consulente non trovato', 'error'); return; }

  var anaMap     = consulente._anaMap;
  var direttiMap = consulente._direttiMap;

  // Costruisci righe: una per ogni contratto attivo del consulente
  var rows = consulente._contratti.map(function(c) {
    var ana = anaMap[c.codicecliente] || {};
    var dArr = direttiMap[ana.codiceanagrafica] || [];
    var isAssoc = dArr.some(function(d) {
      return d.servizio && d.servizio.toLowerCase().indexOf('iscritto') !== -1 && !d.datadisdetta;
    });
    var serviziDiretti = dArr.filter(function(d){ return !d.datadisdetta; })
                             .map(function(d){ return d.servizio || ''; })
                             .filter(Boolean).join(', ');

    return {
      'Consulente':          consulente.nomeconsulente,
      'Codice Cliente':      c.codicecliente          || '',
      'Ragione Sociale':     ana.ragionesociale        || '',
      'Partita IVA':         ana.partitaiva            || '',
      'Codice Fiscale':      ana.codicefiscale         || '',
      'Telefono':            ana.telefono              || '',
      'Email':               ana.email                 || '',
      'Indirizzo':           ana.indirizzo             || '',
      'CAP':                 ana.cap                   || '',
      'Comune':              ana.comune                || '',
      'Provincia':           ana.provincia             || '',
      'Mestiere':            ana.mestiere              || '',
      'Tipo Contratto':      c.tipocontratto           || '',
      'Data Stipula':        c.datastipulacontratto    || '',
      'Sede Erogazione':     c.sedeerogazione          || '',
      'Raggruppamento':      c.raggruppamento          || '',
      'Zona Cliente':        c.zonacliente             || '',
      'Motivo Inizio':       c.motivoinizio            || '',
      'Stato Associativo':   isAssoc ? 'Associato' : 'Non Associato',
      'Servizi Diretti':     serviziDiretti
    };
  });

  // Foglio riepilogo statistiche
  var riepilogo = [
    { 'Statistica': 'Consulente',          'Valore': consulente.nomeconsulente },
    { 'Statistica': 'N° Imprese Seguite',  'Valore': consulente.numImprese },
    { 'Statistica': 'N° Contratti Attivi', 'Valore': consulente.numContratti },
    { 'Statistica': '% sul Totale',        'Valore': consulente.pctTotale + '%' },
    { 'Statistica': 'Associati',           'Valore': consulente.nAssociati },
    { 'Statistica': 'Non Associati',       'Valore': consulente.nNonAssociati },
    { 'Statistica': '% Associati',         'Valore': consulente.numImprese > 0 ? ((consulente.nAssociati/consulente.numImprese)*100).toFixed(1)+'%' : '0%' },
  ];
  // Aggiunge tipi contratto nel riepilogo
  Object.keys(consulente.tipiContratto).sort().forEach(function(t) {
    riepilogo.push({ 'Statistica': 'Tipo: ' + t, 'Valore': consulente.tipiContratto[t] });
  });
  // Sedi
  Object.keys(consulente.sediErogazione).sort().forEach(function(sede) {
    var tot = Object.values(consulente.sediErogazione[sede]).reduce(function(s,v){return s+v;},0);
    riepilogo.push({ 'Statistica': 'Sede: ' + sede, 'Valore': tot });
  });

  if (typeof XLSX === 'undefined') { toast('Libreria XLSX non disponibile', 'error'); return; }

  var wb = XLSX.utils.book_new();

  // Foglio 1: Dettaglio contratti
  var ws1 = XLSX.utils.json_to_sheet(rows);
  // Larghezze colonne
  ws1['!cols'] = [
    {wch:22},{wch:14},{wch:30},{wch:14},{wch:16},{wch:14},{wch:26},{wch:28},
    {wch:7},{wch:18},{wch:10},{wch:22},{wch:24},{wch:14},{wch:20},{wch:18},
    {wch:16},{wch:18},{wch:16},{wch:30}
  ];
  // Stile header (sfondo blu CNA)
  var hdrRange = XLSX.utils.decode_range(ws1['!ref']);
  for (var C = hdrRange.s.c; C <= hdrRange.e.c; C++) {
    var cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws1[cellAddr]) continue;
    ws1[cellAddr].s = {
      font:    { bold: true, color: { rgb: 'FFFFFF' } },
      fill:    { fgColor: { rgb: '005CA9' } },
      alignment: { horizontal: 'center' }
    };
  }
  XLSX.utils.book_append_sheet(wb, ws1, 'Contratti');

  // Foglio 2: Riepilogo statistiche
  var ws2 = XLSX.utils.json_to_sheet(riepilogo);
  ws2['!cols'] = [{wch:28},{wch:20}];
  var rRange = XLSX.utils.decode_range(ws2['!ref']);
  for (var C2 = rRange.s.c; C2 <= rRange.e.c; C2++) {
    var ca = XLSX.utils.encode_cell({ r: 0, c: C2 });
    if (!ws2[ca]) continue;
    ws2[ca].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '005CA9' } } };
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Riepilogo');

  var ts   = new Date().toISOString().slice(0,10);
  var nome = consulente.nomeconsulente.replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,'_').slice(0,30);
  XLSX.writeFile(wb, 'Consulente_' + nome + '_' + ts + '.xlsx');
  toast('✓ Excel consulente scaricato', 'success');
}

// ---------- Helper ----------
function escHtml(s) {
  if (!s) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
