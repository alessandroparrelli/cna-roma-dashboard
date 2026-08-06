// ══════════════════════════════════════════════════════════════════════════════
// ARCHIVIO IMPRESE — Query on-demand via vista_archivio_imprese
// Nessun caricamento automatico: l'utente imposta i filtri e clicca Cerca
// ══════════════════════════════════════════════════════════════════════════════

var anaAll = [];        // risultati correnti
var anaFiltered = [];   // alias (per compatibilità export/scheda)
var anaSelected = new Set();
var anaLoaded = false;  // sempre false — non usiamo più il caricamento bulk
var anaLoading = false;
var anaPage = 0;
var allDiretti = [];    // per compatibilità scheda.js (CCIAA map)
var anaCCIAAMap = {};   // partitaiva → cciaa row (popolata dopo ricerca)
var anaContratti = {};  // per compatibilità export
var anaServiziSet = {};
var ANA_PAGE_SIZE = 50;

// ── Stub no-op per compatibilità con codice che chiama anaLoad ──
function anaLoad(force) { /* no-op: ora si usa anaSearch() */ }
function anaSetStatus() {}
function anaSetProgress(pct, msg) {
  var bar = G('ana-progress');
  var msgEl = G('ana-load-msg');
  if (bar) bar.style.width = pct + '%';
  if (msgEl && msg) msgEl.textContent = msg;
}
function anaPopulateFilters() {}

// ── Escape HTML ──
function anaEsc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ── Formatta data ──
function anaFmtDate(v) {
  if (!v || String(v).trim() === '') return '';
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    var d = new Date(s);
    if (!isNaN(d)) return d.toLocaleDateString('it-IT');
  }
  return s;
}

// ── Costruisce query params dalla vista ──
function anaBuildQuery() {
  var params = [];
  var rs     = (G('ana-f-rs')           ? G('ana-f-rs').value           : '').trim();
  var piva   = (G('ana-f-piva')         ? G('ana-f-piva').value         : '').trim();
  var cf     = (G('ana-f-cf-real')      ? G('ana-f-cf-real').value      : (G('ana-f-cf') ? G('ana-f-cf').value : '')).trim();
  var cap    = (G('ana-f-cap')          ? G('ana-f-cap').value          : '').trim();
  var comune = (G('ana-f-comune-text')  ? G('ana-f-comune-text').value  : '').trim();
  var sesso  = (G('ana-f-sesso')        ? G('ana-f-sesso').value        : '').trim();
  var ateco  = (G('ana-f-ateco-text')   ? G('ana-f-ateco-text').value   : '').trim();
  var sede   = (G('ana-f-sede-text')    ? G('ana-f-sede-text').value    : '').trim();
  var acuradi= (G('ana-f-acuradi-text') ? G('ana-f-acuradi-text').value : '').trim();
  var mestiere=(G('ana-f-mestiere-text')? G('ana-f-mestiere-text').value: '').trim();
  var raggA  = (G('ana-f-raggr-analisi')? G('ana-f-raggr-analisi').value: '').trim();
  var disdetta=(G('ana-f-disdetta-status')?G('ana-f-disdetta-status').value:'').trim();

  if (rs)      params.push('ragionesociale=ilike.*' + encodeURIComponent(rs) + '*');
  if (piva)    params.push('partitaiva=ilike.*' + encodeURIComponent(piva) + '*');
  if (cf)      params.push('codicefiscale=ilike.*' + encodeURIComponent(cf) + '*');
  if (cap)     params.push('cap=eq.' + encodeURIComponent(cap));
  if (comune)  params.push('comune=ilike.*' + encodeURIComponent(comune) + '*');
  if (sesso)   params.push('sesso=eq.' + encodeURIComponent(sesso));
  if (ateco)   params.push('codiceateco=ilike.*' + encodeURIComponent(ateco) + '*');
  if (sede)    params.push('sedeerogazione=ilike.*' + encodeURIComponent(sede) + '*');
  if (acuradi) params.push('acuradi=ilike.*' + encodeURIComponent(acuradi) + '*');
  if (mestiere)params.push('mestiere=ilike.*' + encodeURIComponent(mestiere) + '*');
  if (disdetta === 'empty')   params.push('datadisdetta=is.null');
  if (disdetta === 'present') params.push('datadisdetta=not.is.null');
  // Raggruppamento analisi — filtrato lato client dopo fetch (flag booleani nella vista)
  // (non mappabili direttamente a query params senza funzioni SQL)

  return { params: params, raggA: raggA };
}

// ── Ricerca principale on-demand ──
async function anaSearch() {
  if (!hasPermission('interroga')) {
    alert('❌ Non hai il permesso per interrogare l\'archivio.');
    return;
  }

  var qb = anaBuildQuery();
  if (qb.params.length === 0 && !qb.raggA) {
    // Nessun filtro: avvisa ma permetti comunque (mostra max 200)
    var ok = confirm('Nessun filtro impostato.\nVerranno mostrate le prime 200 imprese. Continuare?');
    if (!ok) return;
  }

  anaLoading = true;
  anaAll = [];
  anaFiltered = [];
  anaSelected.clear();
  anaPage = 0;

  // Mostra loader
  var loader = G('ana-loader');
  var content = G('ana-content');
  if (loader) loader.style.display = 'flex';
  if (content) content.style.display = 'none';

  var hint = G('ana-search-hint');
  if (hint) { hint.textContent = 'Ricerca in corso…'; hint.style.color = '#7C3AED'; }

  try {
    anaSetProgress(10, 'Interrogazione archivio…');

    // Query sulla vista con limit 500 (paginazione server-side)
    var url = SB + '/rest/v1/vista_archivio_imprese?select=*&limit=500&order=ragionesociale.asc';
    if (qb.params.length) url += '&' + qb.params.join('&');

    var r = await fetch(url, { headers: H() });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + await r.text());
    var rows = await r.json();

    anaSetProgress(50, 'Elaborazione risultati…');

    // Filtro lato client per raggruppamento analisi (flags booleani)
    if (qb.raggA) {
      rows = rows.filter(function(row) {
        if (qb.raggA === 'commercio') return row.is_commercio;
        if (qb.raggA === 'turismo')   return row.is_turismo;
        if (qb.raggA === 'cinema')    return row.is_cinema;
        if (qb.raggA === 'donne')     return row.is_donna;
        if (qb.raggA === 'stranieri') return row.is_straniero;
        return true;
      });
    }

    anaSetProgress(70, 'Caricamento dati CCIAA…');

    // Carica CCIAA solo per le partite IVA trovate (batch da 50)
    anaCCIAAMap = {};
    var pivaList = rows.map(function(r){ return r.partitaiva; }).filter(Boolean);
    var pivaUniq = [];
    var pivaSet = {};
    pivaList.forEach(function(p){ var k=String(p).trim(); if(k&&!pivaSet[k]){pivaSet[k]=true;pivaUniq.push(k);} });

    if (pivaUniq.length > 0) {
      var batches = [];
      for (var b = 0; b < pivaUniq.length; b += 50) batches.push(pivaUniq.slice(b, b+50));
      var cciaaResults = await Promise.all(batches.map(function(batch) {
        return fetch(SB + '/rest/v1/cciaa?select=partita_iva,num_addetti_sub,num_addetti_fam_ul,stato_attivita,art_com_tur&partita_iva=in.(' + batch.join(',') + ')', { headers: H() })
          .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
      }));
      cciaaResults.forEach(function(chunk) {
        chunk.forEach(function(cc) {
          if (cc.partita_iva) anaCCIAAMap[String(cc.partita_iva).trim()] = cc;
        });
      });
    }

    anaSetProgress(90, 'Rendering tabella…');

    // Arricchisce con CCIAA e normalizza
    anaAll = rows.map(function(row) {
      var piva = String(row.partitaiva || '').trim();
      var cc = anaCCIAAMap[piva] || null;
      row.addetti_sub    = cc ? (parseInt(cc.num_addetti_sub)    || 0) : 0;
      row.addetti_fam    = cc ? (parseInt(cc.num_addetti_fam_ul) || 0) : 0;
      row.totale_addetti = row.addetti_sub + row.addetti_fam;
      if (cc && cc.art_com_tur) {
        var tc = String(cc.art_com_tur).trim().toUpperCase();
        row.tipoimpresa = tc === 'A' ? 'Artigiano' : tc === 'C' ? 'Commerciante' : tc;
      } else {
        row.tipoimpresa = row.tipoimpresa || '';
      }
      // Campi compatibilità scheda
      row.iscritto_data      = row.datastipula || null;
      row.iscritto_consulente = row.acuradi || '';
      row.contratti_attivi   = {};
      row.servizi_tutti      = row.servizio ? [row.servizio] : [];
      row._isCommercio = !!row.is_commercio;
      row._isTurismo   = !!row.is_turismo;
      row._isCinema    = !!row.is_cinema;
      row._isDonna     = !!row.is_donna;
      row._isStraniero = !!row.is_straniero;
      return row;
    });

    anaFiltered = anaAll.slice();
    anaPage = 0;

    anaSetProgress(100, 'Completato.');

    // Mostra risultati
    if (loader) loader.style.display = 'none';
    if (content) content.style.display = 'block';

    anaRender();

    var total = anaAll.length;
    if (hint) {
      hint.textContent = total + ' imprese trovate';
      hint.style.color = total > 0 ? '#16A34A' : '#DC2626';
    }

  } catch(e) {
    console.error(e);
    if (loader) loader.style.display = 'none';
    toast('Errore ricerca: ' + e.message, 'error');
    if (hint) { hint.textContent = 'Errore: ' + e.message; hint.style.color = '#DC2626'; }
  } finally {
    anaLoading = false;
  }
}

// ── Alias per compatibilità con import.js che chiama anaApply ──
function anaApply() { anaSearch(); }

// ── Reset ──
function anaReset() {
  ['ana-f-rs','ana-f-piva','ana-f-cap','ana-f-sesso',
   'ana-f-comune-text','ana-f-ateco-text','ana-f-sede-text',
   'ana-f-acuradi-text','ana-f-mestiere-text',
   'ana-f-raggr-analisi','ana-f-disdetta-status'].forEach(function(id) {
    var el = G(id); if (el) el.value = '';
  });
  anaAll = []; anaFiltered = []; anaSelected.clear();
  anaPage = 0;
  var content = G('ana-content');
  if (content) content.style.display = 'none';
  var tb = G('ana-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="10" class="ana-empty" style="padding:52px 24px;text-align:center;color:#9CA3AF">🔍 Imposta i criteri di ricerca sopra e clicca <strong style="color:#7C3AED">Cerca</strong></td></tr>';
  var hint = G('ana-search-hint');
  if (hint) { hint.textContent = 'Premi Cerca o Invio per avviare la ricerca'; hint.style.color = '#9CA3AF'; }
  G('ana-count').textContent = '0 record';
  G('ana-info-text').textContent = '–';
}

// ── Render tabella risultati ──
function anaRender() {
  var total = anaFiltered.length;
  G('ana-count').textContent = total.toLocaleString('it-IT') + ' record';
  G('ana-info-text').textContent = total < anaAll.length
    ? 'Trovati: ' + total.toLocaleString('it-IT') + ' di ' + anaAll.length.toLocaleString('it-IT')
    : total.toLocaleString('it-IT') + ' imprese trovate';

  var totalPages = Math.max(1, Math.ceil(total / ANA_PAGE_SIZE));
  if (anaPage > totalPages - 1) anaPage = totalPages - 1;
  if (anaPage < 0) anaPage = 0;
  var start = anaPage * ANA_PAGE_SIZE;
  var end = Math.min(start + ANA_PAGE_SIZE, total);
  var rows = anaFiltered.slice(start, end);

  var info = G('ana-limit-info');
  if (info) info.textContent = total ? ('Pagina ' + (anaPage+1) + ' di ' + totalPages) : '';

  var tb = G('ana-tbody');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="10" class="ana-empty">Nessun risultato</td></tr>';
    anaRenderPagination(totalPages, start, end);
    anaUpdateSelCount();
    return;
  }

  var html = [];
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var i = start + j;
    var sel = anaSelected.has(i) ? ' class="selected"' : '';
    var chk = anaSelected.has(i) ? ' checked' : '';

    // Badge tipo impresa
    var tipoBg  = r.tipoimpresa === 'Artigiano' ? '#FEE2E2' : r.tipoimpresa === 'Commerciante' ? '#FEF3C7' : '';
    var tipoCol = r.tipoimpresa === 'Artigiano' ? '#B91C1C' : r.tipoimpresa === 'Commerciante' ? '#92400E' : '#999';

    html.push(
      '<tr' + sel + ' data-idx="' + i + '" style="cursor:pointer" onclick="anaRowClick(event,' + i + ')">',
      '<td class="col-check"><input type="checkbox" data-idx="' + i + '"' + chk + ' onclick="event.stopPropagation()"></td>',
      '<td class="mono" style="font-size:12px">' + anaEsc(r.partitaiva) + '</td>',
      '<td style="font-weight:600;color:#005CA9;max-width:260px">' + anaEsc(r.ragionesociale) + '</td>',
      '<td style="font-size:13px">' + anaEsc(r.comune) + '</td>',
      '<td style="font-size:12px">' + anaEsc(r.mestiere) + '</td>',
      '<td style="text-align:center;font-size:11px;font-weight:700;' + (r.tipoimpresa ? 'background:'+tipoBg+';color:'+tipoCol : 'color:#999') + '">' + (r.tipoimpresa || '–') + '</td>'
    );
    // Iscritto
    if (r.datastipula) {
      html.push('<td style="text-align:center;font-size:11px;font-weight:700;color:#fff;background:#10B981">✓ Attivo</td>');
    } else {
      html.push('<td style="text-align:center;font-size:11px;color:#9CA3AF">–</td>');
    }
    html.push(
      '<td style="font-size:12px">' + anaEsc(r.sedeerogazione) + '</td>',
      '<td style="font-size:12px">' + anaEsc(r.acuradi) + '</td>',
      '<td style="font-size:12px;white-space:nowrap">' + anaFmtDate(r.datastipula) + '</td>',
      '</tr>'
    );
  }
  tb.innerHTML = html.join('');

  // Click su checkbox
  tb.querySelectorAll('input[type=checkbox]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var idx = parseInt(this.getAttribute('data-idx'));
      if (this.checked) anaSelected.add(idx); else anaSelected.delete(idx);
      var tr = this.closest('tr');
      if (tr) tr.className = this.checked ? 'selected' : '';
      anaUpdateSelCount();
    });
  });

  anaRenderPagination(totalPages, start, end);
  anaUpdateSelCount();
}

// Click su riga → apre scheda (non su checkbox)
function anaRowClick(event, idx) {
  if (event.target.type === 'checkbox') return;
  openAnagraficaModal(idx);
}

function anaUpdateSelCount() {
  var chip = G('ana-selcount');
  if (!chip) return;
  if (anaSelected.size > 0) {
    chip.style.display = 'inline-flex';
    chip.textContent = anaSelected.size + ' selezionat' + (anaSelected.size === 1 ? 'a' : 'e');
  } else {
    chip.style.display = 'none';
  }
}

function anaToggleAll(e) {
  var start = anaPage * ANA_PAGE_SIZE;
  var end = Math.min(start + ANA_PAGE_SIZE, anaFiltered.length);
  for (var i = start; i < end; i++) {
    if (e.target.checked) anaSelected.add(i); else anaSelected.delete(i);
  }
  anaRender();
}

// ── Paginazione ──
function anaRenderPagination(totalPages, start, end) {
  var pag = G('ana-pagination');
  var info = G('ana-pag-info');
  var btns = G('ana-pag-buttons');
  if (!pag) return;

  if (totalPages <= 1) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';
  if (info) info.textContent = (start+1) + '–' + end + ' di ' + anaFiltered.length.toLocaleString('it-IT');

  var html = '';
  html += '<button onclick="anaGoPage(' + (anaPage-1) + ')" ' + (anaPage===0?'disabled':'') + ' class="btn btn-sm btn-secondary" style="padding:4px 10px">‹</button>';
  var from = Math.max(0, anaPage-2), to = Math.min(totalPages-1, anaPage+2);
  if (from > 0) html += '<button onclick="anaGoPage(0)" class="btn btn-sm btn-secondary" style="padding:4px 8px">1</button>' + (from>1?'<span style="padding:0 4px;color:var(--text-dim)">…</span>':'');
  for (var p = from; p <= to; p++) {
    html += '<button onclick="anaGoPage(' + p + ')" class="btn btn-sm ' + (p===anaPage?'btn-primary':'btn-secondary') + '" style="padding:4px 10px">' + (p+1) + '</button>';
  }
  if (to < totalPages-1) html += (to<totalPages-2?'<span style="padding:0 4px;color:var(--text-dim)">…</span>':'') + '<button onclick="anaGoPage(' + (totalPages-1) + ')" class="btn btn-sm btn-secondary" style="padding:4px 8px">' + totalPages + '</button>';
  html += '<button onclick="anaGoPage(' + (anaPage+1) + ')" ' + (anaPage>=totalPages-1?'disabled':'') + ' class="btn btn-sm btn-secondary" style="padding:4px 10px">›</button>';
  if (btns) btns.innerHTML = html;
}

function anaGoPage(p) {
  anaPage = p;
  anaRender();
  G('tab-anagrafiche').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Export (semplificato: esporta i selezionati o tutti i risultati) ──
function anaExport() {
  var indices = anaSelected.size > 0 ? Array.from(anaSelected).sort(function(a,b){return a-b;}) : anaFiltered.map(function(_,i){return i;});
  if (!indices.length) { toast('Nessun record da esportare', 'error'); return; }

  try {
    var wsData = [['Archivio Imprese CNA Roma — ' + new Date().toLocaleDateString('it-IT')]];
    var headerRow = ['PARTITA IVA','CODICE FISCALE','RAGIONE SOCIALE','COMUNE','CAP','TELEFONO','EMAIL','MESTIERE','TIPO IMPRESA','ISCRITTO','DATA STIPULA','SEDE EROGAZIONE','A CURA DI','DIP. SUBORDINATI','DIP. FAMILIARI','TOT. DIPENDENTI'];
    wsData.push(headerRow);

    indices.forEach(function(idx) {
      var r = anaFiltered[idx];
      if (!r) return;
      wsData.push([
        r.partitaiva||'', r.codicefiscale||'', r.ragionesociale||'',
        r.comune||'', r.cap||'', r.telefono||'', r.email||'',
        r.mestiere||'', r.tipoimpresa||'',
        r.datastipula ? 'Attivo' : '',
        r.datastipula ? new Date(r.datastipula).toLocaleDateString('it-IT') : '',
        r.sedeerogazione||'', r.acuradi||'',
        r.addetti_sub > 0 ? r.addetti_sub : '',
        r.addetti_fam > 0 ? r.addetti_fam : '',
        r.totale_addetti > 0 ? r.totale_addetti : ''
      ]);
    });

    var ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:headerRow.length-1}}];
    ws['!cols'] = [13,14,50,18,7,13,32,20,16,10,12,18,18,14,12,12].map(function(w){return{wch:w};});
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Imprese');
    XLSX.writeFile(wb, 'cna_imprese_' + new Date().toISOString().slice(0,10) + '.xlsx');
    toast('✅ Esportati ' + indices.length + ' record', 'success');
  } catch(e) { toast('Errore export: ' + e.message, 'error'); }
}

// Alias compatibilità
function anaJoin() {}
function anaFetchAll() { return Promise.resolve([]); }
function anaFetchAllFiltered() { return Promise.resolve([]); }
