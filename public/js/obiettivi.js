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
    var rows = await obFetch('tesseramento_records?select=acuradi&acuradi=neq.&acuradi=not.is.null&limit=5000');
    var set = {};
    rows.forEach(function(r){ var v=(r.acuradi||'').trim(); if(v) set[v]=1; });
    _acuradiList = Object.keys(set).sort(function(a,b){return a.localeCompare(b,'it');});
    return _acuradiList;
  }

  async function getRaggrList() {
    if (_raggrList) return _raggrList;
    var rows = await obFetch('tesseramento_records?select=promotore&promotore=neq.&promotore=not.is.null&limit=5000');
    var set = {};
    rows.forEach(function(r){ var v=(r.promotore||''  ).trim(); if(v) set[v]=1; });
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

  function pctObjHtml(fatti, obj, calcolato) {
    if (!calcolato || fatti == null || !obj) return '<span class="ob-nc">—</span>';
    var p = (fatti / obj * 100).toFixed(1);
    var cls = p >= 100 ? 'ob-pos' : p >= 70 ? 'ob-blue' : 'ob-neg';
    return '<span class="' + cls + '">' + p + '%</span>';
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

  // Stato ordinamento: { col: 'nome'|'obiettivo'|'fatti'|'delta'|'pct', dir: 1|-1 }
  var sortF = { col: null, dir: 1 };
  var sortP = { col: null, dir: 1 };

  function sortedRows(rows, sort, calcolato, totFatti) {
    if (!sort.col) return rows.slice();
    return rows.slice().sort(function(a, b) {
      var av, bv;
      if (sort.col === 'nome') {
        av = (a.nome_display || '').toLowerCase();
        bv = (b.nome_display || '').toLowerCase();
        return sort.dir * av.localeCompare(bv, 'it');
      }
      if (sort.col === 'obiettivo') {
        av = a.obiettivo || 0; bv = b.obiettivo || 0;
      } else if (sort.col === 'fatti') {
        av = calcolato ? (a._fatti || 0) : 0;
        bv = calcolato ? (b._fatti || 0) : 0;
      } else if (sort.col === 'delta') {
        av = calcolato ? ((a._fatti || 0) - (a.obiettivo || 0)) : 0;
        bv = calcolato ? ((b._fatti || 0) - (b.obiettivo || 0)) : 0;
      } else if (sort.col === 'pct') {
        av = calcolato && a.obiettivo ? (a._fatti || 0) / a.obiettivo : 0;
        bv = calcolato && b.obiettivo ? (b._fatti || 0) / b.obiettivo : 0;
      }
      return sort.dir * (av - bv);
    });
  }

  function sortIcon(sort, col) {
    if (sort.col !== col) return '<span class="ob-sort-icon ob-sort-none">↕</span>';
    return sort.dir === 1
      ? '<span class="ob-sort-icon ob-sort-asc">↑</span>'
      : '<span class="ob-sort-icon ob-sort-desc">↓</span>';
  }

  function thSort(label, col, prefix) {
    return '<th class="ob-col-th ob-col-sortable" data-col="' + col + '" data-prefix="' + prefix + '" style="cursor:pointer;user-select:none">' +
      label + ' ' + sortIcon(prefix === 'f' ? sortF : sortP, col) + '</th>';
  }

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

    async function loadNames() {
      if (!allNames.length) {
        inp.placeholder = 'Caricamento…';
        try { allNames = await listFn(); } catch(e) { console.error(e); }
        inp.placeholder = inputId.includes('-f-') ? 'Cerca funzionario…' : 'Cerca raggruppamento…';
      }
    }
    inp.addEventListener('focus', loadNames);
    inp.addEventListener('click', loadNames);

    inp.addEventListener('input', async function() {
      if (!allNames.length) await loadNames();
      var q = inp.value.trim().toLowerCase();
      if (!q || !allNames.length) { dd.style.display = 'none'; return; }
      var matches = allNames.filter(function(n){ return n.toLowerCase().indexOf(q) !== -1; }).slice(0, 14);
      if (!matches.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = matches.map(function(n){
        return '<div class="ob-dd-item" data-val="' + esc(n) + '">' + esc(n) + '</div>';
      }).join('');
      var rect = inp.getBoundingClientRect();
      dd.style.top  = (rect.bottom + 4) + 'px';
      dd.style.left = rect.left + 'px';
      dd.style.width = rect.width + 'px';
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
    var thead = document.getElementById('ob-f-thead');
    var tbody = document.getElementById('ob-f-tbody');
    var tfoot = document.getElementById('ob-f-tfoot');
    if (!tbody) return;

    // Header con sort
    if (thead) thead.innerHTML = '<tr>' +
      thSort('Funzionario', 'nome', 'f') +
      thSort('Obiettivo', 'obiettivo', 'f') +
      thSort('Fatti', 'fatti', 'f') +
      thSort('% su tot.', 'pct', 'f') +
      thSort('+/−', 'delta', 'f') +
      thSort('% obj.', 'pct', 'f') +
      '<th class="ob-col-bar">Progresso</th>' +
      '<th class="ob-col-act"></th></tr>';

    if (!obF.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="ob-empty">Nessun funzionario aggiunto. Usa il form qui sotto.</td></tr>';
      tfoot.innerHTML = '';
      return;
    }

    var sorted = sortedRows(obF, sortF, calcolatoF, totFattiF);
    var totOb = 0, totF2 = 0;
    // totali sempre sul dataset originale (non sorted)
    obF.forEach(function(r){ totOb += r.obiettivo||0; if(calcolatoF) totF2 += r._fatti||0; });

    tbody.innerHTML = sorted.map(function(row) {
      var fatti = calcolatoF ? (row._fatti || 0) : null;
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
        '<td class="ob-col-num">' + pctObjHtml(fatti, row.obiettivo, calcolatoF) + '</td>' +
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
        '<td class="ob-col-num">' + pctObjHtml(totF2, totOb, calcolatoF) + '</td>' +
        '<td class="ob-col-bar">' + progressBar(totF2, totOb) + '</td>' +
        '<td></td></tr>';
    } else {
      tfoot.innerHTML = '';
    }

    // Click sort header
    if (thead) thead.querySelectorAll('.ob-col-sortable').forEach(function(th) {
      th.addEventListener('click', function() {
        var col = th.dataset.col;
        if (sortF.col === col) sortF.dir *= -1;
        else { sortF.col = col; sortF.dir = 1; }
        renderTableF();
      });
    });

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
    var thead = document.getElementById('ob-p-thead');
    var tbody = document.getElementById('ob-p-tbody');
    var tfoot = document.getElementById('ob-p-tfoot');
    if (!tbody) return;

    if (thead) thead.innerHTML = '<tr>' +
      thSort('Promotore', 'nome', 'p') +
      thSort('Obiettivo', 'obiettivo', 'p') +
      thSort('Fatti', 'fatti', 'p') +
      thSort('% su tot.', 'pct', 'p') +
      thSort('+/−', 'delta', 'p') +
      thSort('% obj.', 'pct', 'p') +
      '<th class="ob-col-bar">Progresso</th>' +
      '<th class="ob-col-act"></th></tr>';

    if (!obP.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="ob-empty">Nessun promotore aggiunto. Usa il form qui sotto.</td></tr>';
      tfoot.innerHTML = '';
      return;
    }

    var sorted = sortedRows(obP, sortP, calcolatoP, totFattiP);
    var totOb = 0, totF2 = 0;
    obP.forEach(function(r){ totOb += r.obiettivo||0; if(calcolatoP) totF2 += r._fatti||0; });

    tbody.innerHTML = sorted.map(function(row) {
      var fatti = calcolatoP ? (row._fatti || 0) : null;
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
        '<td class="ob-col-num">' + pctObjHtml(fatti, row.obiettivo, calcolatoP) + '</td>' +
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
        '<td class="ob-col-num">' + pctObjHtml(totF2, totOb, calcolatoP) + '</td>' +
        '<td class="ob-col-bar">' + progressBar(totF2, totOb) + '</td>' +
        '<td></td></tr>';
    } else {
      tfoot.innerHTML = '';
    }

    if (thead) thead.querySelectorAll('.ob-col-sortable').forEach(function(th) {
      th.addEventListener('click', function() {
        var col = th.dataset.col;
        if (sortP.col === col) sortP.dir *= -1;
        else { sortP.col = col; sortP.dir = 1; }
        renderTableP();
      });
    });

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
    var calcolato = isFun ? calcolatoF : calcolatoP;
    var rows = isFun ? obF : obP;
    var totFatti = isFun ? totFattiF : totFattiP;
    var sort    = isFun ? sortF : sortP;
    var sorted  = sortedRows(rows, sort, calcolato, totFatti);

    var XLSX = window.XLSXStyle || window.XLSX;
    if (!XLSX) { alert('Libreria Excel non disponibile.'); return; }

    // ── Colori identici alla tabella ──
    var C_HEADER_BG  = '1D3557';   // header navy
    var C_HEADER_FG  = 'FFFFFF';
    var C_TOTALE_BG  = 'EFF6FF';   // riga totale azzurrina
    var C_TOTALE_FG  = '1E3A5F';
    var C_POS        = '16A34A';   // verde (raggiunto)
    var C_NEG        = 'DC2626';   // rosso
    var C_BLUE       = '2563EB';   // blu (parziale 70-99%)
    var C_ROW_ALT    = 'F8FAFC';   // righe alternate
    var C_BORDER     = 'E2E8F0';
    var C_TEXT       = '1E293B';
    var C_MUTED      = '94A3B8';

    // ── Colonne: Nome | Obiettivo | Fatti | % su tot. | +/- | Progresso (barra) | % rag. ──
    var ws = {};
    var R = 0; // riga corrente (0-based)

    function enc(r, c) { return XLSX.utils.encode_cell({ r: r, c: c }); }

    function borderAll(extra) {
      var b = { style: 'thin', color: { rgb: C_BORDER } };
      return Object.assign({
        border: { top: b, bottom: b, left: b, right: b }
      }, extra || {});
    }

    function setCell(r, c, v, s) {
      var t = typeof v === 'number' ? 'n' : 's';
      ws[enc(r, c)] = { v: v, t: t, s: s || {} };
    }

    // ── Riga intestazione ──
    var hStyle = function(align) { return borderAll({
      font: { bold: true, color: { rgb: C_HEADER_FG }, sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: C_HEADER_BG } },
      alignment: { horizontal: align || 'left', vertical: 'center' }
    }); };
    var COLS = isFun
      ? ['Funzionario', 'Obiettivo', 'Fatti', '% su tot.', '+/−', '% obj.', 'Progresso', '% ragg.']
      : ['Promotore',   'Obiettivo', 'Fatti', '% su tot.', '+/−', '% obj.', 'Progresso', '% ragg.'];
    var ALIGNS = ['left','center','center','center','center','center','left','center'];
    COLS.forEach(function(h, c) { setCell(R, c, h, hStyle(ALIGNS[c])); });
    R++;

    // ── Righe dati ──
    var totOb = 0, totF2 = 0;
    rows.forEach(function(r){ totOb += r.obiettivo||0; if(calcolato) totF2 += r._fatti||0; });

    sorted.forEach(function(row, idx) {
      var isAlt  = idx % 2 === 1;
      var bgBase = isAlt ? C_ROW_ALT : 'FFFFFF';
      var fatti  = calcolato ? (row._fatti || 0) : null;
      var ob     = row.obiettivo || 0;

      // calcoli
      var pctTotVal  = (calcolato && fatti != null && totFatti) ? (fatti / totFatti * 100) : null;
      var deltaVal   = (calcolato && fatti != null) ? (fatti - ob) : null;
      var pctRagVal  = (calcolato && fatti != null && ob) ? (fatti / ob * 100) : null;
      var barPct     = pctRagVal != null ? Math.min(100, Math.round(pctRagVal)) : 0;
      var barColor   = barPct >= 100 ? C_POS : barPct >= 70 ? C_BLUE : (barPct > 0 ? C_NEG : C_BORDER);

      function cellStyle(align, fgColor) {
        return borderAll({
          font: { sz: 10, color: { rgb: fgColor || C_TEXT } },
          fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
          alignment: { horizontal: align || 'left', vertical: 'center' }
        });
      }

      // Col 0: Nome
      setCell(R, 0, row.nome_display, cellStyle('left'));

      // Col 1: Obiettivo
      setCell(R, 1, ob, borderAll({
        font: { sz: 10, bold: true, color: { rgb: C_TEXT } },
        fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }));

      // Col 2: Fatti
      var fattiColor = (calcolato && fatti != null)
        ? (fatti >= ob ? C_POS : C_TEXT) : C_MUTED;
      setCell(R, 2, calcolato && fatti != null ? fatti : '—', borderAll({
        font: { sz: 10, bold: calcolato, color: { rgb: fattiColor } },
        fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }));

      // Col 3: % su tot.
      setCell(R, 3, pctTotVal != null ? (pctTotVal.toFixed(1) + '%') : '—', cellStyle('center'));

      // Col 4: +/-
      var dColor = deltaVal != null ? (deltaVal >= 0 ? C_POS : C_NEG) : C_MUTED;
      setCell(R, 4, deltaVal != null ? ((deltaVal >= 0 ? '+' : '') + deltaVal) : '—', borderAll({
        font: { sz: 10, bold: true, color: { rgb: dColor } },
        fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }));

      // Col 5: % obiettivo personale
      setCell(R, 5, pctRagVal != null ? (pctRagVal.toFixed(1) + '%') : '—', borderAll({
        font: { sz: 10, bold: pctRagVal != null && pctRagVal >= 100,
                color: { rgb: pctRagVal != null ? (pctRagVal >= 100 ? C_POS : pctRagVal >= 70 ? C_BLUE : C_NEG) : C_MUTED } },
        fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }));

      // Col 6: Barra progresso (testo visuale con sfondo colorato proporzionale)
      // Usiamo un carattere blocco ripetuto per simulare la barra
      var BAR_TOTAL = 20; // caratteri totali barra
      var filled = calcolato ? Math.round(barPct / 100 * BAR_TOTAL) : 0;
      var barText = calcolato
        ? ('█'.repeat(filled) + '░'.repeat(BAR_TOTAL - filled) + '  ' + barPct + '%')
        : '—';
      setCell(R, 6, barText, borderAll({
        font: { sz: 9, color: { rgb: barColor }, name: 'Courier New' },
        fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
        alignment: { horizontal: 'left', vertical: 'center' }
      }));

      // Col 7: % raggiungimento (ridondante — già in col 5, la teniamo per chiarezza)
      setCell(R, 7, pctRagVal != null ? (pctRagVal.toFixed(1) + '%') : '—', borderAll({
        font: { sz: 10, bold: pctRagVal != null && pctRagVal >= 100,
                color: { rgb: pctRagVal != null ? (pctRagVal >= 100 ? C_POS : pctRagVal >= 70 ? C_BLUE : C_NEG) : C_MUTED } },
        fill: { patternType: 'solid', fgColor: { rgb: bgBase } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }));

      R++;
    });

    // ── Riga TOTALE ──
    var totPctRag = totOb ? (totF2 / totOb * 100) : null;
    var totDelta  = totF2 - totOb;
    var totBarPct = totPctRag != null ? Math.min(100, Math.round(totPctRag)) : 0;
    var totBarColor = totBarPct >= 100 ? C_POS : totBarPct >= 70 ? C_BLUE : C_NEG;
    var totBarText  = calcolato
      ? ('█'.repeat(Math.round(totBarPct/100*20)) + '░'.repeat(20-Math.round(totBarPct/100*20)) + '  ' + totBarPct + '%')
      : '—';

    function totStyle(align, fgColor) {
      return borderAll({
        font: { bold: true, sz: 10, color: { rgb: fgColor || C_TOTALE_FG } },
        fill: { patternType: 'solid', fgColor: { rgb: C_TOTALE_BG } },
        alignment: { horizontal: align || 'left', vertical: 'center' }
      });
    }
    setCell(R, 0, 'TOTALE', totStyle('left'));
    setCell(R, 1, totOb, totStyle('center'));
    setCell(R, 2, calcolato ? totF2 : '—', totStyle('center'));
    setCell(R, 3, totOb && calcolato ? (totF2/totOb*100).toFixed(1)+'%' : '—', totStyle('center'));
    setCell(R, 4, calcolato ? ((totDelta>=0?'+':'')+totDelta) : '—',
      totStyle('center', totDelta >= 0 ? C_POS : C_NEG));
    setCell(R, 5, totPctRag != null && calcolato ? totPctRag.toFixed(1)+'%' : '—',
      totStyle('center', totPctRag != null ? (totPctRag >= 100 ? C_POS : totPctRag >= 70 ? C_BLUE : C_NEG) : C_TOTALE_FG));
    setCell(R, 6, calcolato ? totBarText : '—', borderAll({
      font: { bold: true, sz: 9, color: { rgb: totBarColor }, name: 'Courier New' },
      fill: { patternType: 'solid', fgColor: { rgb: C_TOTALE_BG } },
      alignment: { horizontal: 'left', vertical: 'center' }
    }));
    setCell(R, 7, totPctRag != null && calcolato ? totPctRag.toFixed(1)+'%' : '—',
      totStyle('center', totPctRag != null ? (totPctRag >= 100 ? C_POS : totPctRag >= 70 ? C_BLUE : C_NEG) : C_TOTALE_FG));

    // ── Range e colonne ──
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R, c: 7 } });
    ws['!cols'] = [{ wch: 30 }, { wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 8 }, { wch: 10 }, { wch: 28 }, { wch: 12 }];
    ws['!rows'] = [];
    for (var ri = 0; ri <= R; ri++) ws['!rows'].push({ hpt: 18 }); // altezza fissa righe

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isFun ? 'Funzionari' : 'Promotori');
    XLSX.writeFile(wb, 'obiettivi_' + tipo + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  /* ═══════════ HTML PRINCIPALE ═══════════ */
  function renderObiettivi() {
    var el = document.getElementById('ob-page-content');
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
          '<table class="ob-table"><thead id="ob-f-thead"></thead>' +
          '<tbody id="ob-f-tbody"><tr><td colspan="8" class="ob-loading">Caricamento…</td></tr></tbody>' +
          '<tfoot id="ob-f-tfoot"></tfoot></table>' +
          '<div class="ob-add-row">' +
            '<div class="ob-add-inner">' +
              '<div class="ob-add-field">' +
                '<label>Funzionario (da tesseramento)</label>' +
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
          '<table class="ob-table"><thead id="ob-p-thead"></thead>' +
          '<tbody id="ob-p-tbody"><tr><td colspan="8" class="ob-loading">Caricamento…</td></tr></tbody>' +
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
