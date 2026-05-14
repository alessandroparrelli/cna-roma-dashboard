// ============================================================
// CONSULENTI.JS — Tab Analisi Consulenti
// Statistiche per nomeconsulente dalla tabella contrattiservizio
// con espansione riga per dettagli da anagrafiche + diretti
// ============================================================

var consulentiAll = [];
var consulentiFiltered = [];
var consulentiLoaded = false;
var consulentiLoading = false;
var consulentiExpandedRow = null; // nome consulente attualmente espanso

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
    // 1) Contratti attivi (datadisdetta IS NULL)
    consulentiSetProgress(5, 'Caricamento contratti attivi…');
    consulentiSetStatus('contratti', 'Caricamento…');
    var contratti = await consulentiFetchAll('contrattiservizio?datadisdetta=is.null');
    consulentiSetStatus('contratti', contratti.length + ' caricati');

    // 2) Anagrafiche
    consulentiSetProgress(35, 'Caricamento anagrafiche…');
    consulentiSetStatus('anagrafiche', 'Caricamento…');
    var anagrafiche = await consulentiFetchAll('Anagrafiche');
    consulentiSetStatus('anagrafiche', anagrafiche.length + ' caricate');

    // 3) Diretti
    consulentiSetProgress(60, 'Caricamento diretti…');
    consulentiSetStatus('diretti', 'Caricamento…');
    var diretti = await consulentiFetchAll('diretti');
    consulentiSetStatus('diretti', diretti.length + ' caricati');

    // 4) Join e aggregazione
    consulentiSetProgress(80, 'Elaborazione dati…');
    consulentiSetStatus('join', 'Aggregazione…');

    // Mappe ausiliarie
    var anaMap = {};   // codiceanagrafica → record anagrafica
    anagrafiche.forEach(function(a) {
      anaMap[a.codiceanagrafica] = a;
    });

    // diretti per codiceanagrafica → array di record
    var direttiMap = {};
    diretti.forEach(function(d) {
      var k = d.codiceanagrafica;
      if (!direttiMap[k]) direttiMap[k] = [];
      direttiMap[k].push(d);
    });

    // Totale contratti attivi (per percentuale globale)
    var totaleContratti = contratti.length;

    // Aggregazione per consulente
    // struttura: { nomeconsulente → { imprese: Set<codicecliente>, tipiContratto: {tipo: count}, sediErogazione: {sede: {tipo: count}}, contratti: [raw] } }
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

      // per tipo contratto
      var tipo = c.tipocontratto || '—';
      agg.tipiContratto[tipo] = (agg.tipiContratto[tipo] || 0) + 1;

      // per sede erogazione + tipo
      var sede = c.sedeerogazione || '—';
      if (!agg.sediErogazione[sede]) agg.sediErogazione[sede] = {};
      agg.sediErogazione[sede][tipo] = (agg.sediErogazione[sede][tipo] || 0) + 1;

      // raggruppamenti
      var rg = c.raggruppamento || '—';
      agg.raggruppamenti[rg] = (agg.raggruppamenti[rg] || 0) + 1;

      // zone
      var zona = c.zonacliente || '—';
      agg.zone[zona] = (agg.zone[zona] || 0) + 1;
    });

    // Converti in array e arricchisci con dati aggregati da anagrafiche + diretti
    consulentiAll = Object.values(consulentiMap).map(function(agg) {
      var numContratti = agg.contratti.length;
      var pctTotale = totaleContratti > 0 ? ((numContratti / totaleContratti) * 100).toFixed(1) : '0.0';

      // Mestieri: conta per le imprese seguite (da anagrafica)
      var mestieriCount = {};
      agg.imprese.forEach(function(codicecliente) {
        var ana = anaMap[codicecliente];
        if (!ana) return;
        var mestiere = ana.mestiere || '—';
        mestieriCount[mestiere] = (mestieriCount[mestiere] || 0) + 1;
      });

      // Stato associativo: da diretti
      var nAssociati = 0, nNonAssociati = 0;
      agg.imprese.forEach(function(codicecliente) {
        var ana = anaMap[codicecliente];
        if (!ana) return;
        var dArr = direttiMap[ana.codiceanagrafica] || [];
        // Associato = ha in diretti: servizio contiene "iscritto" (case-insensitive) e datadisdetta nulla
        var isAssociato = dArr.some(function(d) {
          return d.servizio && d.servizio.toLowerCase().indexOf('iscritto') !== -1 && !d.datadisdetta;
        });
        if (isAssociato) nAssociati++; else nNonAssociati++;
      });

      // Sedi con distribuzione per tipo (per %)
      var sediDettaglio = [];
      Object.keys(agg.sediErogazione).sort().forEach(function(sede) {
        var tipiInSede = agg.sediErogazione[sede];
        var totaleSede = Object.values(tipiInSede).reduce(function(s, v) { return s + v; }, 0);
        Object.keys(tipiInSede).sort().forEach(function(tipo) {
          var cnt = tipiInSede[tipo];
          sediDettaglio.push({
            sede: sede,
            tipo: tipo,
            count: cnt,
            pctSede: totaleSede > 0 ? ((cnt / totaleSede) * 100).toFixed(1) : '0.0',
            pctTotale: totaleContratti > 0 ? ((cnt / totaleContratti) * 100).toFixed(1) : '0.0'
          });
        });
      });

      return {
        nomeconsulente: agg.nomeconsulente,
        numImprese: agg.imprese.size,
        numContratti: numContratti,
        pctTotale: pctTotale,
        tipiContratto: agg.tipiContratto,
        sediErogazione: agg.sediErogazione,
        sediDettaglio: sediDettaglio,
        raggruppamenti: agg.raggruppamenti,
        zone: agg.zone,
        mestieriCount: mestieriCount,
        nAssociati: nAssociati,
        nNonAssociati: nNonAssociati,
        // raw per espansione
        _imprese: Array.from(agg.imprese),
        _anaMap: anaMap,
        _direttiMap: direttiMap
      };
    });

    // Ordina per numero contratti decrescente
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
  // Popola filtro tipo contratto
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

  // Popola filtro sede erogazione
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

// ---------- Render tabella principale ----------

function consulentiRender() {
  var tbody = G('consulenti-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // KPI summary in cima
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
    tbody.innerHTML = '<tr><td colspan="7" class="ana-empty">Nessun consulente trovato</td></tr>';
    return;
  }

  consulentiFiltered.forEach(function(c) {
    // Prima riga: riepilogo consulente
    var tipiHtml = Object.keys(c.tipiContratto).sort().map(function(t) {
      return '<span style="display:inline-block;background:var(--blue-light,#EFF6FF);color:var(--blue,#005CA9);border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;margin:1px">' + escHtml(t) + ' <b>' + c.tipiContratto[t] + '</b></span>';
    }).join(' ');

    var assocPct = (c.numImprese > 0) ? Math.round((c.nAssociati / c.numImprese) * 100) : 0;

    var tr = document.createElement('tr');
    tr.className = 'consulenti-row';
    tr.setAttribute('data-consulente', c.nomeconsulente);
    tr.style.cursor = 'pointer';
    tr.innerHTML =
      '<td style="font-weight:700;color:var(--blue,#005CA9);white-space:nowrap">' +
        '<span style="margin-right:6px;font-size:12px" class="consulenti-toggle-icon">▶</span>' +
        escHtml(c.nomeconsulente) +
      '</td>' +
      '<td style="text-align:center;font-weight:700;font-size:15px">' + c.numImprese + '</td>' +
      '<td>' + tipiHtml + '</td>' +
      '<td style="text-align:center">' +
        '<span style="font-weight:700;color:var(--blue,#005CA9)">' + c.pctTotale + '%</span>' +
        '<div style="height:4px;background:#E5E7EB;border-radius:2px;margin-top:4px;width:80px">' +
          '<div style="height:4px;background:var(--blue,#005CA9);border-radius:2px;width:' + Math.min(parseFloat(c.pctTotale), 100) + '%"></div>' +
        '</div>' +
      '</td>' +
      '<td style="text-align:center">' +
        '<span style="color:#16a34a;font-weight:600">' + c.nAssociati + '</span> / ' +
        '<span style="color:#9ca3af">' + c.nNonAssociati + '</span>' +
        '<div style="font-size:10px;color:var(--text-secondary)">' + assocPct + '% assoc.</div>' +
      '</td>' +
      '<td style="text-align:center">' + c.numContratti + '</td>' +
      '<td style="text-align:center">' +
        Object.keys(c.raggruppamenti).sort().map(function(rg) {
          return '<span style="font-size:11px;color:var(--text-secondary)">' + escHtml(rg) + '</span>';
        }).join('<br>') +
      '</td>';

    tr.addEventListener('click', function() {
      consulentiToggleExpand(c, tr);
    });
    tbody.appendChild(tr);

    // Riga espansione (inizialmente nascosta)
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

// ---------- Espansione riga ----------

function consulentiToggleExpand(consulente, trHeader) {
  var nome = consulente.nomeconsulente;
  var trExp = G('consulenti-tbody').querySelector('[data-expand-for="' + CSS.escape(nome) + '"]');
  if (!trExp) return;

  var icon = trHeader.querySelector('.consulenti-toggle-icon');

  if (trExp.style.display === 'none') {
    // Chiudi eventuale altra espansione aperta
    if (consulentiExpandedRow && consulentiExpandedRow !== nome) {
      var prevTrExp = G('consulenti-tbody').querySelector('[data-expand-for="' + CSS.escape(consulentiExpandedRow) + '"]');
      var prevTrHdr = G('consulenti-tbody').querySelector('[data-consulente="' + CSS.escape(consulentiExpandedRow) + '"]');
      if (prevTrExp) prevTrExp.style.display = 'none';
      if (prevTrHdr) {
        var prevIcon = prevTrHdr.querySelector('.consulenti-toggle-icon');
        if (prevIcon) prevIcon.textContent = '▶';
        prevTrHdr.style.background = '';
      }
    }

    // Popola e apri
    trExp.firstChild.innerHTML = consulentiExpandContent(consulente);
    trExp.style.display = '';
    if (icon) icon.textContent = '▼';
    trHeader.style.background = 'rgba(0,92,169,0.06)';
    consulentiExpandedRow = nome;
  } else {
    trExp.style.display = 'none';
    if (icon) icon.textContent = '▶';
    trHeader.style.background = '';
    consulentiExpandedRow = null;
  }
}

// ---------- Contenuto espanso ----------

function consulentiExpandContent(consulente) {
  var html = '<div style="padding:16px 20px;background:linear-gradient(135deg,#f8faff,#EFF6FF);border-left:4px solid var(--blue,#005CA9);border-top:1px solid #DBEAFE;border-bottom:1px solid #DBEAFE">';

  // Titolo
  html += '<div style="font-size:13px;font-weight:700;color:var(--blue,#005CA9);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px">📊 Dettaglio: ' + escHtml(consulente.nomeconsulente) + '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">';

  // ── BOX 1: Tipi di contratto ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.07)">';
  html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">📋 Contratti per Tipo</div>';
  var totaleCons = consulente.numContratti;
  Object.keys(consulente.tipiContratto).sort(function(a,b){ return consulente.tipiContratto[b]-consulente.tipiContratto[a]; }).forEach(function(tipo) {
    var cnt = consulente.tipiContratto[tipo];
    var pct = totaleCons > 0 ? ((cnt/totaleCons)*100).toFixed(1) : '0.0';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
    html += '<div style="flex:1;font-size:12px;color:var(--text);font-weight:500">' + escHtml(tipo) + '</div>';
    html += '<div style="font-size:12px;font-weight:700;color:var(--blue,#005CA9);white-space:nowrap">' + cnt + ' <span style="color:var(--text-secondary);font-weight:400">(' + pct + '%)</span></div>';
    html += '</div>';
    html += '<div style="height:3px;background:#E5E7EB;border-radius:2px;margin-bottom:8px"><div style="height:3px;background:var(--blue,#005CA9);border-radius:2px;width:' + Math.min(parseFloat(pct), 100) + '%"></div></div>';
  });
  html += '</div>';

  // ── BOX 2: Sedi + tipo ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.07)">';
  html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🏢 Sede Erogazione × Tipo</div>';
  Object.keys(consulente.sediErogazione).sort().forEach(function(sede) {
    var tipiInSede = consulente.sediErogazione[sede];
    var totaleSede = Object.values(tipiInSede).reduce(function(s,v){return s+v;},0);
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:4px;padding:3px 6px;background:#F3F4F6;border-radius:4px">' + escHtml(sede) + ' <span style="font-weight:400;color:var(--text-secondary)">(' + totaleSede + ' contratti)</span></div>';
    Object.keys(tipiInSede).sort().forEach(function(tipo) {
      var cnt = tipiInSede[tipo];
      var pctSede = totaleSede > 0 ? ((cnt/totaleSede)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 6px;color:var(--text-secondary)">';
      html += '<span>' + escHtml(tipo) + '</span>';
      html += '<span style="font-weight:600;color:var(--text)">' + cnt + ' <span style="color:#9ca3af">(' + pctSede + '% sede)</span></span>';
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';

  // ── BOX 3: Mestieri ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.07)">';
  html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🔨 Mestieri (da Anagrafica)</div>';
  var mestieri = Object.keys(consulente.mestieriCount).sort(function(a,b){ return consulente.mestieriCount[b]-consulente.mestieriCount[a]; });
  if (mestieri.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-secondary)">Nessun mestiere trovato</div>';
  } else {
    var totMest = consulente.numImprese;
    mestieri.slice(0, 15).forEach(function(m) {
      var cnt = consulente.mestieriCount[m];
      var pct = totMest > 0 ? ((cnt/totMest)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      html += '<div style="flex:1;font-size:11px;color:var(--text)">' + escHtml(m) + '</div>';
      html += '<div style="font-size:11px;font-weight:700;color:#7c3aed;white-space:nowrap">' + cnt + ' <span style="color:#9ca3af;font-weight:400">(' + pct + '%)</span></div>';
      html += '</div>';
    });
    if (mestieri.length > 15) {
      html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">… e altri ' + (mestieri.length - 15) + ' mestieri</div>';
    }
  }
  html += '</div>';

  // ── BOX 4: Stato associativo + Zone ──
  html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.07)">';
  html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">👥 Stato Associativo</div>';
  var totImp = consulente.numImprese;
  var pctAssoc = totImp > 0 ? ((consulente.nAssociati/totImp)*100).toFixed(1) : '0.0';
  var pctNonAssoc = totImp > 0 ? ((consulente.nNonAssociati/totImp)*100).toFixed(1) : '0.0';
  html += '<div style="display:flex;gap:12px;margin-bottom:12px">';
  html += '<div style="flex:1;text-align:center;padding:10px;background:#F0FDF4;border-radius:6px">';
  html += '<div style="font-size:20px;font-weight:800;color:#16a34a">' + consulente.nAssociati + '</div>';
  html += '<div style="font-size:11px;color:#16a34a;font-weight:600">Associati</div>';
  html += '<div style="font-size:10px;color:#6b7280">' + pctAssoc + '%</div>';
  html += '</div>';
  html += '<div style="flex:1;text-align:center;padding:10px;background:#F9FAFB;border-radius:6px">';
  html += '<div style="font-size:20px;font-weight:800;color:#9ca3af">' + consulente.nNonAssociati + '</div>';
  html += '<div style="font-size:11px;color:#9ca3af;font-weight:600">Non Associati</div>';
  html += '<div style="font-size:10px;color:#6b7280">' + pctNonAssoc + '%</div>';
  html += '</div>';
  html += '</div>';

  // Barra associativi
  if (totImp > 0) {
    html += '<div style="height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden">';
    html += '<div style="height:6px;background:#16a34a;width:' + Math.min(parseFloat(pctAssoc), 100) + '%"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-top:3px"><span>0%</span><span>Associati</span><span>100%</span></div>';
  }

  // Zone
  if (Object.keys(consulente.zone).length > 0) {
    html += '<div style="margin-top:12px">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">📍 Zone Cliente</div>';
    Object.keys(consulente.zone).sort().slice(0, 8).forEach(function(zona) {
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #F3F4F6">';
      html += '<span style="color:var(--text)">' + escHtml(zona) + '</span>';
      html += '<span style="font-weight:600;color:var(--text)">' + consulente.zone[zona] + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>'; // fine box 4

  // ── BOX 5: Raggruppamenti ──
  if (Object.keys(consulente.raggruppamenti).length > 0) {
    html += '<div style="background:white;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.07)">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🗂️ Raggruppamenti</div>';
    Object.keys(consulente.raggruppamenti).sort(function(a,b){ return consulente.raggruppamenti[b]-consulente.raggruppamenti[a]; }).forEach(function(rg) {
      var cnt = consulente.raggruppamenti[rg];
      var pct = totaleCons > 0 ? ((cnt/totaleCons)*100).toFixed(1) : '0.0';
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid #F3F4F6">';
      html += '<span style="color:var(--text)">' + escHtml(rg) + '</span>';
      html += '<span style="font-weight:600;color:#EA580C">' + cnt + ' <span style="color:#9ca3af;font-weight:400">(' + pct + '%)</span></span>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>'; // fine grid
  html += '</div>'; // fine container
  return html;
}

// ---------- Helper escape HTML ----------
function escHtml(s) {
  if (!s) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
