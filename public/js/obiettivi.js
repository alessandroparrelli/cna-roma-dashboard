/* =========================================================
   obiettivi.js — Tab Obiettivi nel pannello Amministratore
   Usa le variabili globali SB, KEY, H() definite in config.js
   ========================================================= */

(function () {
  'use strict';

  /* ── Fetch helpers che usano SB/KEY globali ── */
  async function obFetch(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var headers = H(opts.extraHeaders || {});
    if (opts.prefer) headers['Prefer'] = opts.prefer;
    var res = await fetch(SB + '/rest/v1/' + path, {
      method: method,
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      var err = await res.text();
      throw new Error('Supabase ' + method + ' ' + path + ': ' + res.status + ' ' + err);
    }
    var text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  async function obRpc(fn, params) {
    var res = await fetch(SB + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: H(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  /* ── Cache nomi da diretti ── */
  var _acuradiList = null;
  var _raggrList = null;

  async function getAcuradiList() {
    if (_acuradiList) return _acuradiList;
    var rows = await obFetch('diretti?select=acuradi&acuradi=neq.&acuradi=not.is.null&limit=5000');
    var set = {};
    rows.forEach(function(r){ var v=(r.acuradi||'').trim(); if(v) set[v]=1; });
    _acuradiList = Object.keys(set).sort(function(a,b){return a.localeCompare(b,'it');});
    return _acuradiList;
  }

  async function getRaggrList() {
    if (_raggrList) return _raggrList;
    var rows = await obFetch('diretti?select=raggruppamento&raggruppamento=neq.&raggruppamento=not.is.null&limit=5000');
    var set = {};
    rows.forEach(function(r){ var v=(r.raggruppamento||'').trim(); if(v) set[v]=1; });
    _raggrList = Object.keys(set).sort(function(a,b){return a.localeCompare(b,'it');});
    return _raggrList;
  }

  /* ── Helpers UI ── */
  function pct(val, tot) {
    if (!tot) return '—';
    return ((val / tot) * 100).toFixed(1) + '%';
  }

  function deltaHtml(val, obj) {
    var d = val - obj;
    var cls = d >= 0 ? 'ob-pos' : 'ob-neg';
    var sign = d >= 0 ? '+' : '';
    return '<span class="' + cls + '">' + sign + d + '</span>';
  }

  function progressBar(val, obj) {
    if (!obj) return '';
    var p = Math.min(100, Math.round((val / obj) * 100));
    var color = p >= 100 ? '#16a34a' : p >= 70 ? '#2563eb' : '#dc2626';
    return '<div class="ob-bar-wrap"><div class="ob-bar-fill" style="width:' + p + '%;background:' + color + '"></div></div>';
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── Stato ── */
  var obF = [];          // righe funzionari
  var obP = [];          // righe promotori
  var totFattiF = 0;
  var totFattiP = 0;
  var calcolatoF = false;
  var calcolatoP = false;

  /* ── Lettura periodo dall'UI ── */
  function getAnnoParams(prefix) {
    var tipo = document.getElementById('ob-' + prefix + '-anno-tipo').value;
    if (tipo === 'tutti') return { p_anno_da: null, p_anno_a: null };
    if (tipo === 'anno') {
      var y = parseInt((document.getElementById('ob-' + prefix + '-anno-val') || {}).value) || null;
      return { p_anno_da: y, p_anno_a: y };
    }
    if (tipo === 'range') {
      return {
        p_anno_da: parseInt((document.getElementById('ob-' + prefix + '-anno-da') || {}).value) || null,
        p_anno_a:  parseInt((document.getElementById('ob-' + prefix + '-anno-a')  || {}).value) || null,
      };
    }
    return { p_anno_da: null, p_anno_a: null };
  }

  function setupAnnoCtrl(prefix) {
    var sel = document.getElementById('ob-' + prefix + '-anno-tipo');
    var fields = document.getElementById('ob-' + prefix + '-anno-fields');
    function rebuild() {
      var v = sel.value;
      if (v === 'tutti') {
        fields.style.display = 'none';
        fields.innerHTML = '';
      } else if (v === 'anno') {
        var y = new Date().getFullYear();
        fields.style.display = 'flex';
        fields.innerHTML = '<input type="number" id="ob-' + prefix + '-anno-val" value="' + y + '" min="2000" max="2099" style="width:80px" class="ob-input">';
      } else if (v === 'range') {
        var y = new Date().getFullYear();
        fields.style.display = 'flex';
        fields.innerHTML =
          '<input type="number" id="ob-' + prefix + '-anno-da" value="' + y + '" min="2000" max="2099" style="width:70px" class="ob-input">' +
          '<span style="color:var(--text-secondary)">–</span>' +
          '<input type="number" id="ob-' + prefix + '-anno-a" value="' + y + '" min="2000" max="2099" style="width:70px" class="ob-input">';
      }
    }
    sel.addEventListener('change', rebuild);
    rebuild();
  }

  /* ═══════════ CRUD SUPABASE ═══════════ */
  async function loadObF()  { return obFetch('obiettivi_funzionari?select=*&order=ordinamento.asc,id.asc'); }
  async function loadObP()  { return obFetch('obiettivi_promotori?select=*&order=ordinamento.asc,id.asc'); }

  async function saveObF(data) {
    if (data.id) {
      data.updated_at = new Date().toISOString();
      return obFetch('obiettivi_funzionari?id=eq.' + data.id, { method: 'PATCH', body: data, prefer: 'return=representation' });
    }
    return obFetch('obiettivi_funzionari', { method: 'POST', body: data, prefer: 'return=representation' });
  }
  async function delObF(id) { return obFetch('obiettivi_funzionari?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' }); }

  async function saveObP(data) {
    if (data.id) {
      data.updated_at = new Date().toISOString();
      return obFetch('obiettivi_promotori?id=eq.' + data.id, { method: 'PATCH', body: data, prefer: 'return=representation' });
    }
    return obFetch('obiettivi_promotori', { method: 'POST', body: data, prefer: 'return=representation' });
  }
  async function delObP(id) { return obFetch('obiettivi_promotori?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' }); }

  /* ═══════════ AUTOCOMPLETE ═══════════ */
  function setupAutocomplete(inputId, dropdownId, listFn, onSelect) {
    var inp = document.getElementById(inputId);
    var dd  = document.getElementById(dropdownId);
    var allNames = [];

    inp.addEventListener('focus', async function() {
      if (!allNames.length) {
        inp.placeholder = 'Caricamento…';
        try { allNames = await listFn(); } catch(e) { console.error(e); }
        inp.placeholder = inputId.includes('-f-') ? 'Cerca funzionario…' : 'Cerca raggruppamento…';
      }
    });

    inp.addEventListener('input', function() {
      var q = inp.value.trim().toLowerCase();
      if (!q || !allNames.length) { dd.style.display = 'none'; return; }
      var matches = allNames.filter(function(n){ return n.toLowerCase().indexOf(q) !== -1; }).slice(0, 14);
      if (!matches.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = matches.map(function(n){
        return '<div class="ob-dd-item" data-val="' + esc(n) + '">' + esc(n) + '</div>';
      }).join('');
      dd.style.display = 'block';
    });

    dd.addEventListener('mousedown', function(e) {
      var item = e.target.closest('.ob-dd-item');
      if (!item) return;
      e.preventDefault();
      inp.value = item.dataset.val;
      dd.style.display = 'none';
      if (onSelect) onSelect(item.dataset.val);
    });

    document.addEventListener('click', function(e) {
      if (!inp.contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none';
    });
  }

  /* ═══════════ RENDER TABELLA FUNZIONARI ═══════════ */
  function renderTableF() {
    var tbody = document.getElementById('ob-f-tbody');
    var tfoot = document.getElementById('ob-f-tfoot');
    if (!tbody) return;

    if (!obF.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="ob-empty">Nessun funzionario aggiunto. Usa il form qui sotto.</td></tr>';
      tfoot.innerHTML = '';
      return;
    }

    var totOb = 0, totF2 = 0;
    tbody.innerHTML = obF.map(function(row) {
      totOb += row.obiettivo || 0;
      var fatti = calcolatoF ? (row._fatti || 0) : null;
      if (calcolatoF) totF2 += fatti;

      var fattiCell = calcolatoF
        ? '<span class="ob-fatti-num' + (fatti >= row.obiettivo ? ' ob-pos' : '') + '">' + fatti + '</span>'
        : '<span class="ob-nc">—</span>';

      var pctTot  = (calcolatoF && totFattiF) ? pct(fatti, totFattiF) : '—';
      var dHtml   = calcolatoF ? deltaHtml(fatti, row.obiettivo) : '—';
      var barHtml = calcolatoF ? progressBar(fatti, row.obiettivo) : '';

      return '<tr data-id="' + row.id + '">' +
        '<td><div class="ob-name-cell">' +
          '<span class="ob-name">' + esc(row.nome_display) + '</span>' +
          '<span class="ob-match">' + esc(row.acuradi_match) + '</span>' +
        '</div></td>' +
        '<td class="ob-col-num"><input type="number" class="ob-input ob-inline-input" value="' + (row.obiettivo||0) + '" min="0" data-id="' + row.id + '" data-kind="f"></td>' +
        '<td class="ob-col-num">' + fattiCell + '</td>' +
        '<td class="ob-col-num">' + pctTot + '</td>' +
        '<td class="ob-col-num">' + dHtml + '</td>' +
        '<td class="ob-col-bar">' + barHtml + '</td>' +
        '<td class="ob-col-act"><button class="ob-btn-del" data-id="' + row.id + '" data-kind="f" title="Rimuovi">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
        '</button></td>' +
      '</tr>';
    }).join('');

    if (calcolatoF) {
      tfoot.innerHTML = '<tr class="ob-tfoot-row">' +
        '<td><strong>TOTALE</strong></td>' +
        '<td class="ob-col-num"><strong>' + totOb + '</strong></td>' +
        '<td class="ob-col-num"><strong>' + totF2 + '</strong></td>' +
        '<td class="ob-col-num">' + (totOb ? pct(totF2, totOb) : '—') + '</td>' +
        '<td class="ob-col-num">' + deltaHtml(totF2, totOb) + '</td>' +
        '<td class="ob-col-bar">' + progressBar(totF2, totOb) + '</td>' +
        '<td></td></tr>';
    } else {
      tfoot.innerHTML = '';
    }

    // Inline edit
    tbody.querySelectorAll('.ob-inline-input').forEach(function(inp) {
      inp.addEventListener('change', async function() {
        var id = parseInt(inp.dataset.id);
        var row = obF.find(function(r){ return r.id === id; });
        if (row) {
          row.obiettivo = parseInt(inp.value) || 0;
          try { await saveObF({ id: id, obiettivo: row.obiettivo }); }
          catch(e) { console.error('Salvataggio obiettivo:', e); }
        }
      });
    });

    // Delete
    tbody.querySelectorAll('.ob-btn-del').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Rimuovere questo funzionario dagli obiettivi?')) return;
        var id = parseInt(btn.dataset.id);
        try {
          await delObF(id);
          obF = obF.filter(function(r){ return r.id !== id; });
          renderTableF();
        } catch(e) { alert('Errore: ' + e.message); }
      });
    });
  }

  /* ═══════════ RENDER TABELLA PROMOTORI ═══════════ */
  function renderTableP() {
    var tbody = document.getElementById('ob-p-tbody');
    var tfoot = document.getElementById('ob-p-tfoot');
    if (!tbody) return;

    if (!obP.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="ob-empty">Nessun promotore aggiunto. Usa il form qui sotto.</td></tr>';
      tfoot.innerHTML = '';
      return;
    }

    var totOb = 0, totF2 = 0;
    tbody.innerHTML = obP.map(function(row) {
      totOb += row.obiettivo || 0;
      var fatti = calcolatoP ? (row._fatti || 0) : null;
      if (calcolatoP) totF2 += fatti;

      var fattiCell = calcolatoP
        ? '<span class="ob-fatti-num' + (fatti >= row.obiettivo ? ' ob-pos' : '') + '">' + fatti + '</span>'
        : '<span class="ob-nc">—</span>';

      var pctTot  = (calcolatoP && totFattiP) ? pct(fatti, totFattiP) : '—';
      var dHtml   = calcolatoP ? deltaHtml(fatti, row.obiettivo) : '—';
      var barHtml = calcolatoP ? progressBar(fatti, row.obiettivo) : '';

      return '<tr data-id="' + row.id + '">' +
        '<td><div class="ob-name-cell">' +
          '<span class="ob-name">' + esc(row.nome_display) + '</span>' +
          '<span class="ob-match">' + esc(row.raggruppamento_match) + '</span>' +
        '</div></td>' +
        '<td class="ob-col-num"><input type="number" class="ob-inline-input ob-input" value="' + (row.obiettivo||0) + '" min="0" data-id="' + row.id + '" data-kind="p"></td>' +
        '<td class="ob-col-num">' + fattiCell + '</td>' +
        '<td class="ob-col-num">' + pctTot + '</td>' +
        '<td class="ob-col-num">' + dHtml + '</td>' +
        '<td class="ob-col-bar">' + barHtml + '</td>' +
        '<td class="ob-col-act"><button class="ob-btn-del" data-id="' + row.id + '" data-kind="p" title="Rimuovi">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
        '</button></td>' +
      '</tr>';
    }).join('');

    if (calcolatoP) {
      tfoot.innerHTML = '<tr class="ob-tfoot-row">' +
        '<td><strong>TOTALE</strong></td>' +
        '<td class="ob-col-num"><strong>' + totOb + '</strong></td>' +
        '<td class="ob-col-num"><strong>' + totF2 + '</strong></td>' +
        '<td class="ob-col-num">' + (totOb ? pct(totF2, totOb) : '—') + '</td>' +
        '<td class="ob-col-num">' + deltaHtml(totF2, totOb) + '</td>' +
        '<td class="ob-col-bar">' + progressBar(totF2, totOb) + '</td>' +
        '<td></td></tr>';
    } else {
      tfoot.innerHTML = '';
    }

    tbody.querySelectorAll('.ob-inline-input').forEach(function(inp) {
      inp.addEventListener('change', async function() {
        var id = parseInt(inp.dataset.id);
        var row = obP.find(function(r){ return r.id === id; });
        if (row) {
          row.obiettivo = parseInt(inp.value) || 0;
          try { await saveObP({ id: id, obiettivo: row.obiettivo }); }
          catch(e) { console.error('Salvataggio obiettivo:', e); }
        }
      });
    });

    tbody.querySelectorAll('.ob-btn-del').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Rimuovere questo promotore dagli obiettivi?')) return;
        var id = parseInt(btn.dataset.id);
        try {
          await delObP(id);
          obP = obP.filter(function(r){ return r.id !== id; });
          renderTableP();
        } catch(e) { alert('Errore: ' + e.message); }
      });
    });
  }

  /* ═══════════ ADD ROW ═══════════ */
  async function addRowF() {
    var nome = (document.getElementById('ob-f-add-nome').value || '').trim();
    var obj  = parseInt(document.getElementById('ob-f-add-obj').value) || 0;
    if (!nome) { alert('Inserisci il nome del funzionario.'); return; }

    var btn = document.getElementById('ob-f-add-btn');
    btn.disabled = true;
    try {
      var data = { nome_display: nome, acuradi_match: nome, obiettivo: obj, ordinamento: obF.length };
      var saved = await saveObF(data);
      var newRow = Array.isArray(saved) ? saved[0] : saved;
      if (newRow && newRow.id) obF.push(newRow);
      else obF.push(Object.assign(data, { id: Date.now() }));
      document.getElementById('ob-f-add-nome').value = '';
      document.getElementById('ob-f-add-obj').value  = '';
      calcolatoF = false;
      renderTableF();
    } catch(e) {
      alert('Errore salvataggio: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function addRowP() {
    var nome = (document.getElementById('ob-p-add-nome').value || '').trim();
    var obj  = parseInt(document.getElementById('ob-p-add-obj').value) || 0;
    if (!nome) { alert('Inserisci il nome del promotore.'); return; }

    var btn = document.getElementById('ob-p-add-btn');
    btn.disabled = true;
    try {
      var data = { nome_display: nome, raggruppamento_match: nome, obiettivo: obj, ordinamento: obP.length };
      var saved = await saveObP(data);
      var newRow = Array.isArray(saved) ? saved[0] : saved;
      if (newRow && newRow.id) obP.push(newRow);
      else obP.push(Object.assign(data, { id: Date.now() }));
      document.getElementById('ob-p-add-nome').value = '';
      document.getElementById('ob-p-add-obj').value  = '';
      calcolatoP = false;
      renderTableP();
    } catch(e) {
      alert('Errore salvataggio: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* ═══════════ RICALCOLA ═══════════ */
  async function ricalcolaF() {
    var btn = document.getElementById('ob-f-ricalcola');
    btn.disabled = true;
    btn.textContent = 'Calcolo…';
    try {
      var params = getAnnoParams('f');
      var results = await Promise.all(obF.map(function(row) {
        return obRpc('get_iscritti_per_acuradi', {
          p_acuradi: row.acuradi_match,
          p_anno_da: params.p_anno_da,
          p_anno_a:  params.p_anno_a,
        }).then(function(v){ return { id: row.id, fatti: v }; });
      }));
      totFattiF = 0;
      results.forEach(function(r) {
        var row = obF.find(function(x){ return x.id === r.id; });
        if (row) { row._fatti = r.fatti || 0; totFattiF += row._fatti; }
      });
      calcolatoF = true;
      renderTableF();
    } catch(e) {
      alert('Errore calcolo: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Ricalcola tutto';
    }
  }

  async function ricalcolaP() {
    var btn = document.getElementById('ob-p-ricalcola');
    btn.disabled = true;
    btn.textContent = 'Calcolo…';
    try {
      var params = getAnnoParams('p');
      var results = await Promise.all(obP.map(function(row) {
        return obRpc('get_iscritti_per_raggruppamento', {
          p_raggruppamento: row.raggruppamento_match,
          p_anno_da: params.p_anno_da,
          p_anno_a:  params.p_anno_a,
        }).then(function(v){ return { id: row.id, fatti: v }; });
      }));
      totFattiP = 0;
      results.forEach(function(r) {
        var row = obP.find(function(x){ return x.id === r.id; });
        if (row) { row._fatti = r.fatti || 0; totFattiP += row._fatti; }
      });
      calcolatoP = true;
      renderTableP();
    } catch(e) {
      alert('Errore calcolo: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Ricalcola tutto';
    }
  }

  /* ═══════════ EXPORT EXCEL ═══════════ */
  function exportExcel(tipo) {
    var isFun = tipo === 'funzionari';
    var rows = isFun ? obF : obP;
    var totFatti = isFun ? totFattiF : totFattiP;
    var XLSX = window.XLSXStyle || window.XLSX;
    if (!XLSX) { alert('Libreria Excel non disponibile.'); return; }

    var headers = ['Nome', 'Obiettivo', 'Fatti', '% su totale', '+/-', '% raggiungimento'];
    var data = rows.map(function(r) {
      var f = (r._fatti != null) ? r._fatti : '';
      var d = f !== '' ? f - r.obiettivo : '';
      var pctTot = (f !== '' && totFatti) ? ((f / totFatti) * 100).toFixed(1) + '%' : '';
      var pctRag = (f !== '' && r.obiettivo) ? ((f / r.obiettivo) * 100).toFixed(1) + '%' : '';
      return [r.nome_display, r.obiettivo, f, pctTot, d !== '' ? (d >= 0 ? '+' + d : d) : '', pctRag];
    });

    var totOb = rows.reduce(function(s, r){ return s + (r.obiettivo || 0); }, 0);
    var totF2 = rows.reduce(function(s, r){ return s + (r._fatti || 0); }, 0);
    data.push(['TOTALE', totOb, totF2,
      totOb ? ((totF2 / totOb) * 100).toFixed(1) + '%' : '',
      (totF2 - totOb >= 0 ? '+' : '') + (totF2 - totOb),
      totOb ? ((totF2 / totOb) * 100).toFixed(1) + '%' : '']);

    var ws = XLSX.utils.aoa_to_sheet([headers].concat(data));
    ws['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 8 }, { wch: 18 }];

    // Stile intestazione
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (var C = range.s.c; C <= range.e.c; C++) {
      var cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D3557' } } };
    }
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isFun ? 'Funzionari' : 'Promotori');
    XLSX.writeFile(wb, 'obiettivi_' + tipo + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  /* ═══════════ HTML PRINCIPALE ═══════════ */
  function renderObiettivi() {
    var el = document.getElementById('atab-obiettivi');
    if (!el) return;

    el.innerHTML =
      '<div class="ob-wrap">' +

      // ── Tabella Funzionari
      '<div class="admin-card-new ob-section">' +
        '<div class="admin-card-head">' +
          '<div class="admin-card-head-icon" style="background:rgba(37,99,235,.1)">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
          '</div>' +
          '<span>Obiettivi per Funzionario</span>' +
          '<div class="ob-head-actions">' +
            '<div class="ob-anno-ctrl">' +
              '<label>Periodo:</label>' +
              '<select id="ob-f-anno-tipo">' +
                '<option value="tutti">Tutti gli anni</option>' +
                '<option value="anno">Anno specifico</option>' +
                '<option value="range">Intervallo anni</option>' +
              '</select>' +
              '<div id="ob-f-anno-fields" style="display:none;gap:6px;align-items:center;display:flex"></div>' +
            '</div>' +
            '<button class="btn btn-sm btn-primary" id="ob-f-ricalcola">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
              ' Ricalcola tutto' +
            '</button>' +
            '<button class="btn btn-sm btn-success" id="ob-f-export">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
              ' Excel' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="admin-card-body" style="padding:0">' +
          '<table class="ob-table"><thead><tr>' +
            '<th>Funzionario</th><th class="ob-col-num">Obiettivo</th><th class="ob-col-num">Fatti</th>' +
            '<th class="ob-col-num">% su tot.</th><th class="ob-col-num">+/−</th><th class="ob-col-bar">Progresso</th><th class="ob-col-act"></th>' +
          '</tr></thead>' +
          '<tbody id="ob-f-tbody"><tr><td colspan="7" class="ob-loading">Caricamento…</td></tr></tbody>' +
          '<tfoot id="ob-f-tfoot"></tfoot></table>' +
          '<div class="ob-add-row">' +
            '<div class="ob-add-inner">' +
              '<div class="ob-add-field">' +
                '<label>Funzionario (da diretti.acuradi)</label>' +
                '<div style="position:relative">' +
                  '<input type="text" id="ob-f-add-nome" placeholder="Cerca funzionario…" autocomplete="off" class="ob-input" style="min-width:240px">' +
                  '<div id="ob-f-dropdown" class="ob-dropdown" style="display:none"></div>' +
                '</div>' +
              '</div>' +
              '<div class="ob-add-field ob-add-field-sm">' +
                '<label>Obiettivo (n. contratti)</label>' +
                '<input type="number" id="ob-f-add-obj" placeholder="es. 50" min="0" class="ob-input">' +
              '</div>' +
              '<button class="btn btn-sm btn-primary" id="ob-f-add-btn">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                ' Aggiungi' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ── Tabella Promotori
      '<div class="admin-card-new ob-section" style="margin-top:24px">' +
        '<div class="admin-card-head">' +
          '<div class="admin-card-head-icon" style="background:rgba(22,163,74,.1)">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
          '</div>' +
          '<span>Obiettivi per Promotore</span>' +
          '<div class="ob-head-actions">' +
            '<div class="ob-anno-ctrl">' +
              '<label>Periodo:</label>' +
              '<select id="ob-p-anno-tipo">' +
                '<option value="tutti">Tutti gli anni</option>' +
                '<option value="anno">Anno specifico</option>' +
                '<option value="range">Intervallo anni</option>' +
              '</select>' +
              '<div id="ob-p-anno-fields" style="display:none;gap:6px;align-items:center;display:flex"></div>' +
            '</div>' +
            '<button class="btn btn-sm btn-primary" id="ob-p-ricalcola">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
              ' Ricalcola tutto' +
            '</button>' +
            '<button class="btn btn-sm btn-success" id="ob-p-export">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
              ' Excel' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="admin-card-body" style="padding:0">' +
          '<table class="ob-table"><thead><tr>' +
            '<th>Promotore / Raggruppamento</th><th class="ob-col-num">Obiettivo</th><th class="ob-col-num">Fatti</th>' +
            '<th class="ob-col-num">% su tot.</th><th class="ob-col-num">+/−</th><th class="ob-col-bar">Progresso</th><th class="ob-col-act"></th>' +
          '</tr></thead>' +
          '<tbody id="ob-p-tbody"><tr><td colspan="7" class="ob-loading">Caricamento…</td></tr></tbody>' +
          '<tfoot id="ob-p-tfoot"></tfoot></table>' +
          '<div class="ob-add-row">' +
            '<div class="ob-add-inner">' +
              '<div class="ob-add-field">' +
                '<label>Promotore (da diretti.raggruppamento)</label>' +
                '<div style="position:relative">' +
                  '<input type="text" id="ob-p-add-nome" placeholder="Cerca raggruppamento…" autocomplete="off" class="ob-input" style="min-width:240px">' +
                  '<div id="ob-p-dropdown" class="ob-dropdown" style="display:none"></div>' +
                '</div>' +
              '</div>' +
              '<div class="ob-add-field ob-add-field-sm">' +
                '<label>Obiettivo (n. contratti)</label>' +
                '<input type="number" id="ob-p-add-obj" placeholder="es. 100" min="0" class="ob-input">' +
              '</div>' +
              '<button class="btn btn-sm btn-primary" id="ob-p-add-btn">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                ' Aggiungi' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '</div>'; // .ob-wrap

    // Carica dati e aggancia eventi
    Promise.all([loadObF(), loadObP()]).then(function(res) {
      obF = res[0]; obP = res[1];
      calcolatoF = false; calcolatoP = false;
      renderTableF();
      renderTableP();
    }).catch(function(e) {
      console.error('Errore caricamento obiettivi:', e);
    });

    setupAnnoCtrl('f');
    setupAnnoCtrl('p');

    setupAutocomplete('ob-f-add-nome', 'ob-f-dropdown', getAcuradiList);
    setupAutocomplete('ob-p-add-nome', 'ob-p-dropdown', getRaggrList);

    document.getElementById('ob-f-add-btn').addEventListener('click', addRowF);
    document.getElementById('ob-p-add-btn').addEventListener('click', addRowP);
    document.getElementById('ob-f-ricalcola').addEventListener('click', ricalcolaF);
    document.getElementById('ob-p-ricalcola').addEventListener('click', ricalcolaP);
    document.getElementById('ob-f-export').addEventListener('click', function(){ exportExcel('funzionari'); });
    document.getElementById('ob-p-export').addEventListener('click', function(){ exportExcel('promotori'); });
  }

  /* ── Esponi globalmente ── */
  window.ObiettiviFunzionari = { render: renderObiettivi };

})();
