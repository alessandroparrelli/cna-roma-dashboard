// ============================================================
// CONSULENTI.JS — Tab Gestione Consulenti
// Statistiche per nomeconsulente dalla tabella contrattiservizio
// con espansione riga per dettagli da anagrafiche + diretti
// ============================================================

var consulentiAll = [];
var consulentiFiltered = [];
var consulentiLoaded = false;
var consulentiLoading = false;
var consulentiExpandedRow = null;

// ---------- Stili hover iniettati una volta sola ----------

(function() {
  if (document.getElementById('consulenti-styles')) return;
  var s = document.createElement('style');
  s.id = 'consulenti-styles';
  s.textContent = [
    '.consulenti-row { transition: background 0.15s, box-shadow 0.15s; }',
    '.consulenti-row:hover { background: rgba(0,92,169,0.05) !important; box-shadow: inset 3px 0 0 #005CA9; }',
    '.consulenti-row:hover .consulenti-nome { color: #003D7A !important; }',
    '.consulenti-row:hover .consulenti-toggle-icon { transform: scale(1.3); }',
    '.consulenti-toggle-icon { display:inline-block; transition: transform 0.2s; }',
    '.consulenti-row.is-expanded { background: rgba(0,92,169,0.07) !important; box-shadow: inset 3px 0 0 #005CA9; }',
    '.consulenti-badge { display:inline-block; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:600; margin:2px; white-space:nowrap; }',
    '.consulenti-expand-row td { padding: 0 !important; }',
    '.consulenti-assoc-chip { display:inline-flex; align-items:center; gap:5px; border-radius:20px; padding:4px 10px; font-size:12px; font-weight:700; white-space:nowrap; }',
    '.consulenti-pct-bar { height:4px; background:#E5E7EB; border-radius:2px; margin-top:5px; min-width:60px; max-width:100px; }',
    '.consulenti-pct-fill { height:4px; background:#005CA9; border-radius:2px; transition: width 0.4s; }',
  ].join('\n');
  document.head.appendChild(s);
})();

// ---------- Utility progress/status ----------

function consulentiSetProgress(pct, msg) {
  var prog = G('consulenti-progress');
  if (prog) prog.style.width = pct + '%';
  var el = G('consulenti-load-msg');
  if (el) el.textContent = msg;
}

function consulentiSetStatus(tipo, msg) {
  var el = G('consulenti-status-' + tipo);
  if (!el) return;
  var val = el.querySelector('.ana-sval');
  if (val) val.textContent = msg;
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

// ---------- Load principale ----------

async function consulentiLoad(force) {
  if (consulentiLoading) return;
  if (consulentiLoaded && !force) return;
  consulentiLoading = true;

  G('consulenti-loader').classList.add('active');
  G('consulenti-content').style.display = 'none';
  consulentiExpandedRow = null;

  consulentiSetProgress(0, 'Connessione a Supabase…');
  consulentiSetStatus('contratti', 'In attesa…');
  consulentiSetStatus('anagrafiche', 'In attesa…');
  consulentiSetStatus('diretti', 'In attesa…');
  consulentiSetStatus('join', 'In attesa…');

  try {
    consulentiSetProgress(5, 'Caricamento contratti attivi…');
    consulentiSetStatus('contratti', 'Caricamento…');
    var contratti = await consulentiFetchAll('contrattiservizio?datadisdetta=is.null');
    consulentiSetStatus('contratti', contratti.length + ' caricati');

    consulentiSetProgress(35, 'Caricamento anagrafiche…');
    consulentiSetStatus('anagrafiche', 'Caricamento…');
    var anagrafiche = await consulentiFetchAll('Anagrafiche');
    consulentiSetStatus('anagrafiche', anagrafiche.length + ' caricate');

    consulentiSetProgress(60, 'Caricamento diretti…');
    consulentiSetStatus('diretti', 'Caricamento…');
    var diretti = await consulentiFetchAll('diretti');
    consulentiSetStatus('diretti', diretti.length + ' caricati');

    consulentiSetProgress(80, 'Elaborazione dati…');
    consulentiSetStatus('join', 'Aggregazione…');

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
        consulentiMap[nome] = {
          nomeconsulente: nome,
          imprese: new Set(),
          tipiContratto: {},
          sediErogazione: {},
          raggruppamenti: {},
          zone: {},
          contratti: []
        };
      }
      var agg = consulentiMap[nome];
      agg.contratti.push(c);
      agg.imprese.add(c.codicecliente);

      var tipo = c.tipocontratto || '—';
      agg.tipiContratto[tipo] = (agg.tipiContratto[tipo] || 0) + 1;

      var sede = c.sedeerogazione || '—';
      if (!agg.sediErogazione[sede]) agg.sediErogazione[sede] = {};
      agg.sediErogazione[sede][tipo] = (agg.sediErogazione[sede][tipo] || 0) + 1;

      var rg = c.raggruppamento || '—';
      agg.raggruppamenti[rg] = (agg.raggruppamenti[rg] || 0) + 1;

      var zona = c.zonacliente || '—';
      agg.zone[zona] = (agg.zone[zona] || 0) + 1;
    });

    consulentiAll = Object.values(consulentiMap).map(function(agg) {
      var numContratti = agg.contratti.length;
      var pctTotale = totaleContratti > 0 ? ((numContratti / totaleContratti) * 100).toFixed(1) : '0.0';

      var mestieriCount = {};
      agg.imprese.forEach(function(codicecliente) {
        var ana = anaMap[codicecliente];
        if (!ana) return;
        var mestiere = ana.mestiere || '—';
        mestieriCount[mestiere] = (mestieriCount[mestiere] || 0) + 1;
      });

      var nAssociati = 0, nNonAssociati = 0;
      agg.imprese.forEach(function(codicecliente) {
        var ana = anaMap[codicecliente];
        if (!ana) return;
        var dArr = direttiMap[ana.codiceanagrafica] || [];
        var isAssociato = dArr.some(function(d) {
          return d.servizio && d.servizio.toLowerCase().indexOf('iscritto') !== -1 && !d.datadisdetta;
        });
        if (isAssociato) nAssociati++; else nNonAssociati++;
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
        _anaMap: anaMap,
        _direttiMap: direttiMap
      };
    });

    consulentiAll.sort(function(a, b) { return b.numContratti - a.numContratti; });
    consulentiFiltered = consulentiAll.slice();

    consulentiSetProgress(100, 'Completato');
    consulentiSetStatus('join', 'OK');

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
  var tipiSet = {};
  consulentiAll.forEach(function(c) {
    Object.keys(c.tipiContratto).forEach(function(t) { tipiSet[t] = true; });
  });
  var selTipo = G('consulenti-f-tipo');
  if (selTipo) {
    selTipo.innerHTML = '<option value="">Tutti i tipi…</option>';
    Object.keys(tipiSet).sort().forEach(function(t) {
      var opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      selTipo.appendChild(opt);
    });
  }

  var sediSet = {};
  consulentiAll.forEach(function(c) {
    Object.keys(c.sediErogazione).forEach(function(s) { sediSet[s] = true; });
  });
  var selSede = G('consulenti-f-sede');
  if (selSede) {
    selSede.innerHTML = '<option value="">Tutte le sedi…</option>';
    Object.keys(sediSet).sort().forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      selSede.appendChild(opt);
    });
  }
}

function consulentiApply() {
  var search = (G('consulenti-f-search') ? G('consulenti-f-search').value.trim().toLowerCase() : '');
  var tipo = (G('consulenti-f-tipo') ? G('consulenti-f-tipo').value : '');
  var sede = (G('consulenti-f-sede') ? G('consulenti-f-sede').value : '');

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
  if (G('consulenti-f-tipo')) G('consulenti-f-tipo').value = '';
  if (G('consulenti-f-sede')) G('consulenti-f-sede').value = '';
  consulentiFiltered = consulentiAll.slice();
  consulentiRender();
}

// ---------- Render tabella ----------

function consulentiRender() {
  var tbody = G('consulenti-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var totImprese = new Set();
  var totContratti = 0;
  consulentiAll.forEach(function(c) {
    c._imprese.forEach(function(i) { totImprese.add(i); });
    totContratti += c.numContratti;
  });

  G('consulenti-kpi-consulenti').textContent = consulentiAll.length;
  G('consulenti-kpi-imprese').textContent = totImprese.size;
  G('consulenti-kpi-contratti').textContent = totContratti;
  G('consulenti-count').textContent = consulentiFiltered.length + ' consulenti';

  if (consulentiFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="ana-empty">Nessun consulente trovato</td></tr>';
    return;
  }

  consulentiFiltered.forEach(function(c) {
    // Badge tipi contratto — compatti
    var tipiHtml = Object.keys(c.tipiContratto).sort().map(function(t) {
      return '<span class="consulenti-badge" style="background:#EFF6FF;color:#005CA9">' +
        escHtml(t) + ' <b style="font-size:12px">' + c.tipiContratto[t] + '</b></span>';
    }).join('');

    // Chip associati separati
    var assocPct = c.numImprese > 0 ? Math.round((c.nAssociati / c.numImprese) * 100) : 0;
    var nonAssocPct = 100 - assocPct;

    var tr = document.createElement('tr');
    tr.className = 'consulenti-row';
    tr.setAttribute('data-consulente', c.nomeconsulente);
    tr.style.cssText = 'cursor:pointer;transition:background 0.15s;';

    tr.innerHTML =
      // COL 1 — Nome
      '<td style="min-width:160px;max-width:220px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span class="consulenti-toggle-icon" style="font-size:11px;color:#005CA9;flex-shrink:0">▶</span>' +
          '<span class="consulenti-nome" style="font-weight:700;color:#005CA9;font-size:13px;transition:color 0.15s">' + escHtml(c.nomeconsulente) + '</span>' +
        '</div>' +
      '</td>' +
      // COL 2 — Imprese
      '<td style="text-align:center;width:80px">' +
        '<div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1">' + c.numImprese + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:1px">imprese</div>' +
      '</td>' +
      // COL 3 — Tipi contratto
      '<td style="min-width:180px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:2px">' + tipiHtml + '</div>' +
      '</td>' +
      // COL 4 — % totale con barra
      '<td style="text-align:center;width:100px">' +
        '<div style="font-size:16px;font-weight:800;color:#005CA9">' + c.pctTotale + '<span style="font-size:11px;font-weight:500">%</span></div>' +
        '<div class="consulenti-pct-bar" style="margin:4px auto 0">' +
          '<div class="consulenti-pct-fill" style="width:' + Math.min(parseFloat(c.pctTotale), 100) + '%"></div>' +
        '</div>' +
      '</td>' +
      // COL 5 — Associati (chip verde)
      '<td style="text-align:center;width:90px">' +
        '<div class="consulenti-assoc-chip" style="background:#F0FDF4;color:#16a34a;margin:0 auto 4px">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' +
          c.nAssociati +
        '</div>' +
        '<div style="font-size:10px;color:#16a34a;font-weight:600">' + assocPct + '%</div>' +
      '</td>' +
      // COL 6 — Non Associati (chip grigio)
      '<td style="text-align:center;width:90px">' +
        '<div class="consulenti-assoc-chip" style="background:#F3F4F6;color:#6b7280;margin:0 auto 4px">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          c.nNonAssociati +
        '</div>' +
        '<div style="font-size:10px;color:#9ca3af;font-weight:600">' + nonAssocPct + '%</div>' +
      '</td>';

    tr.addEventListener('click', function() { consulentiToggleExpand(c, tr); });
    tbody.appendChild(tr);

    // Riga espansione
    var trExp = document.createElement('tr');
    trExp.className = 'consulenti-expand-row';
    trExp.setAttribute('data-expand-for', c.nomeconsulente);
    trExp.style.display = 'none';
    var tdExp = document.createElement('td');
    tdExp.colSpan = 6;
    tdExp.style.padding = '0';
    trExp.appendChild(tdExp);
    tbody.appendChild(trExp);
  });
}

// ---------- Espansione riga ----------

function consulentiToggleExpand(consulente, trHeader) {
  var nome = consulente.nomeconsulente;
  var tbody = G('consulenti-tbody');
  var trExp = tbody.querySelector('[data-expand-for="' + CSS.escape(nome) + '"]');
  if (!trExp) return;

  var icon = trHeader.querySelector('.consulenti-toggle-icon');

  if (trExp.style.display === 'none') {
    // Chiudi precedente
    if (consulentiExpandedRow && consulentiExpandedRow !== nome) {
      var prevExp = tbody.querySelector('[data-expand-for="' + CSS.escape(consulentiExpandedRow) + '"]');
      var prevHdr = tbody.querySelector('[data-consulente="' + CSS.escape(consulentiExpandedRow) + '"]');
      if (prevExp) prevExp.style.display = 'none';
      if (prevHdr) {
        prevHdr.classList.remove('is-expanded');
        var prevIcon = prevHdr.querySelector('.consulenti-toggle-icon');
        if (prevIcon) prevIcon.textContent = '▶';
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
  var totImp = consulente.numImprese;
  var pctAssoc = totImp > 0 ? ((consulente.nAssociati / totImp) * 100).toFixed(1) : '0.0';
  var pctNonAssoc = totImp > 0 ? ((consulente.nNonAssociati / totImp) * 100).toFixed(1) : '0.0';

  var html = '<div style="padding:18px 20px 20px;background:linear-gradient(135deg,#f8faff,#EFF6FF);border-left:4px solid #005CA9;border-top:1px solid #DBEAFE;border-bottom:2px solid #DBEAFE">';
  html += '<div style="font-size:12px;font-weight:700;color:#005CA9;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.6px">📊 Dettaglio — ' + escHtml(consulente.nomeconsulente) + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">';

  // ── BOX 1: Tipi contratto ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">📋 Contratti per Tipo</div>';
  Object.keys(consulente.tipiContratto)
    .sort(function(a,b){ return consulente.tipiContratto[b] - consulente.tipiContratto[a]; })
    .forEach(function(tipo) {
      var cnt = consulente.tipiContratto[tipo];
      var pct = totaleCons > 0 ? ((cnt/totaleCons)*100).toFixed(1) : '0.0';
      html += '<div style="margin-bottom:9px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">';
      html += '<span style="color:#1e293b;font-weight:500">' + escHtml(tipo) + '</span>';
      html += '<span style="font-weight:700;color:#005CA9">' + cnt + ' <span style="color:#94a3b8;font-weight:400;font-size:11px">(' + pct + '%)</span></span>';
      html += '</div>';
      html += '<div style="height:3px;background:#E2E8F0;border-radius:2px"><div style="height:3px;background:#005CA9;border-radius:2px;width:' + Math.min(parseFloat(pct),100) + '%"></div></div>';
      html += '</div>';
    });
  html += '</div>';

  // ── BOX 2: Sedi × Tipo ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🏢 Sede Erogazione × Tipo</div>';
  Object.keys(consulente.sediErogazione).sort().forEach(function(sede) {
    var tipiInSede = consulente.sediErogazione[sede];
    var totaleSede = Object.values(tipiInSede).reduce(function(s,v){return s+v;},0);
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:11px;font-weight:700;color:#1e293b;padding:3px 7px;background:#F1F5F9;border-radius:4px;margin-bottom:4px">';
    html += escHtml(sede) + ' <span style="font-weight:400;color:#64748b;font-size:10px">(' + totaleSede + ' contr.)</span>';
    html += '</div>';
    Object.keys(tipiInSede).sort().forEach(function(tipo) {
      var cnt = tipiInSede[tipo];
      var pctSede = totaleSede > 0 ? ((cnt/totaleSede)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 7px;color:#64748b">';
      html += '<span>' + escHtml(tipo) + '</span>';
      html += '<span style="font-weight:600;color:#334155">' + cnt + ' <span style="color:#94a3b8;font-weight:400">(' + pctSede + '%)</span></span>';
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';

  // ── BOX 3: Mestieri ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🔨 Mestieri (Anagrafica)</div>';
  var mestieri = Object.keys(consulente.mestieriCount)
    .sort(function(a,b){ return consulente.mestieriCount[b] - consulente.mestieriCount[a]; });
  if (mestieri.length === 0) {
    html += '<div style="font-size:12px;color:#94a3b8">Nessun mestiere trovato</div>';
  } else {
    mestieri.slice(0, 15).forEach(function(m) {
      var cnt = consulente.mestieriCount[m];
      var pct = totImp > 0 ? ((cnt/totImp)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid #F1F5F9">';
      html += '<span style="color:#334155">' + escHtml(m) + '</span>';
      html += '<span style="font-weight:700;color:#7c3aed">' + cnt + ' <span style="color:#94a3b8;font-weight:400">(' + pct + '%)</span></span>';
      html += '</div>';
    });
    if (mestieri.length > 15) {
      html += '<div style="font-size:11px;color:#94a3b8;margin-top:5px">… e altri ' + (mestieri.length - 15) + ' mestieri</div>';
    }
  }
  html += '</div>';

  // ── BOX 4: Stato associativo ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
  html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">👥 Stato Associativo</div>';

  html += '<div style="display:flex;gap:10px;margin-bottom:14px">';
  // Associati
  html += '<div style="flex:1;text-align:center;padding:12px 8px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0">';
  html += '<div style="font-size:24px;font-weight:800;color:#16a34a;line-height:1">' + consulente.nAssociati + '</div>';
  html += '<div style="font-size:11px;font-weight:700;color:#16a34a;margin-top:3px">Associati</div>';
  html += '<div style="font-size:13px;font-weight:800;color:#15803d;margin-top:2px">' + pctAssoc + '%</div>';
  html += '</div>';
  // Non Associati
  html += '<div style="flex:1;text-align:center;padding:12px 8px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">';
  html += '<div style="font-size:24px;font-weight:800;color:#94a3b8;line-height:1">' + consulente.nNonAssociati + '</div>';
  html += '<div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:3px">Non Assoc.</div>';
  html += '<div style="font-size:13px;font-weight:800;color:#64748b;margin-top:2px">' + pctNonAssoc + '%</div>';
  html += '</div>';
  html += '</div>';

  // Barra
  if (totImp > 0) {
    html += '<div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden">';
    html += '<div style="height:8px;background:linear-gradient(90deg,#16a34a,#4ade80);border-radius:4px;width:' + Math.min(parseFloat(pctAssoc), 100) + '%"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:3px"><span>0%</span><span style="font-weight:600;color:#64748b">Associati</span><span>100%</span></div>';
  }

  // Zone
  if (Object.keys(consulente.zone).length > 0) {
    html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #F1F5F9">';
    html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">📍 Zone Cliente</div>';
    Object.keys(consulente.zone).sort().slice(0, 8).forEach(function(zona) {
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #F8FAFC">';
      html += '<span style="color:#334155">' + escHtml(zona) + '</span>';
      html += '<span style="font-weight:600;color:#334155">' + consulente.zone[zona] + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // ── BOX 5: Raggruppamenti (solo nel dettaglio espanso) ──
  if (Object.keys(consulente.raggruppamenti).length > 0) {
    html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)">';
    html += '<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🗂️ Raggruppamenti</div>';
    Object.keys(consulente.raggruppamenti)
      .sort(function(a,b){ return consulente.raggruppamenti[b] - consulente.raggruppamenti[a]; })
      .forEach(function(rg) {
        var cnt = consulente.raggruppamenti[rg];
        var pct = totaleCons > 0 ? ((cnt/totaleCons)*100).toFixed(1) : '0.0';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:3px 0;border-bottom:1px solid #F1F5F9">';
        html += '<span style="color:#334155">' + escHtml(rg) + '</span>';
        html += '<span style="font-weight:700;color:#EA580C">' + cnt + ' <span style="color:#94a3b8;font-weight:400">(' + pct + '%)</span></span>';
        html += '</div>';
      });
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

// ---------- Helper ----------
function escHtml(s) {
  if (!s) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
