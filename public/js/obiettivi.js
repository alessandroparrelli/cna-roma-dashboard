/* =========================================================
   obiettivi.js — Tab Obiettivi nel pannello Amministratore
   Calcola il raggiungimento degli obiettivi di tesseramento
   per funzionario e per promotore.
   ========================================================= */

(function () {
  'use strict';

  /* ── Supabase helpers (usano config globale) ── */
  const SB_URL = window.SUPABASE_URL;
  const SB_KEY = window.SUPABASE_ANON_KEY;

  async function sbFetch(path, opts = {}) {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: opts.prefer || 'return=representation',
        ...opts.headers,
      },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error: ${res.status} ${err}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  async function sbRpc(fn, params) {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  /* ── Cache lista nomi dalla tabella diretti ── */
  let _acuradiList = null;
  let _raggruppamentoList = null;

  async function getAcuradiList() {
    if (_acuradiList) return _acuradiList;
    const rows = await sbFetch('diretti?select=acuradi&acuradi=neq.&acuradi=not.is.null&limit=5000');
    const set = new Set(rows.map(r => (r.acuradi || '').trim()).filter(Boolean));
    _acuradiList = [...set].sort((a, b) => a.localeCompare(b, 'it'));
    return _acuradiList;
  }

  async function getRaggruppamentoList() {
    if (_raggruppamentoList) return _raggruppamentoList;
    const rows = await sbFetch('diretti?select=raggruppamento&raggruppamento=neq.&raggruppamento=not.is.null&limit=5000');
    const set = new Set(rows.map(r => (r.raggruppamento || '').trim()).filter(Boolean));
    _raggruppamentoList = [...set].sort((a, b) => a.localeCompare(b, 'it'));
    return _raggruppamentoList;
  }

  /* ── Calcolo anno/range ── */
  function annoParams(annoRif, annoDa, annoA) {
    if (annoRif === 'tutti') return { p_anno_da: null, p_anno_a: null };
    if (annoRif === 'range') return { p_anno_da: annoDa || null, p_anno_a: annoA || null };
    const y = parseInt(annoRif);
    return { p_anno_da: y, p_anno_a: y };
  }

  /* ── Formatter ── */
  function pct(val, tot) {
    if (!tot) return '—';
    return ((val / tot) * 100).toFixed(1) + '%';
  }

  function delta(val, obj) {
    const d = val - obj;
    const cls = d >= 0 ? 'ob-pos' : 'ob-neg';
    const sign = d >= 0 ? '+' : '';
    return `<span class="${cls}">${sign}${d}</span>`;
  }

  /* ── Render barra progresso ── */
  function progressBar(val, obj) {
    if (!obj) return '';
    const p = Math.min(100, Math.round((val / obj) * 100));
    const color = p >= 100 ? '#16a34a' : p >= 70 ? '#2563eb' : '#dc2626';
    return `<div class="ob-bar-wrap"><div class="ob-bar-fill" style="width:${p}%;background:${color}"></div><span class="ob-bar-label">${p}%</span></div>`;
  }

  /* ═══════════════════════════════════════════════
     SEZIONE 1: OBIETTIVI PER FUNZIONARIO
  ════════════════════════════════════════════════ */

  async function loadObiettiviF() {
    return sbFetch('obiettivi_funzionari?select=*&order=ordinamento.asc,id.asc');
  }

  async function saveObiettivoF(data) {
    if (data.id) {
      return sbFetch(`obiettivi_funzionari?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
      });
    }
    return sbFetch('obiettivi_funzionari', { method: 'POST', body: JSON.stringify(data) });
  }

  async function deleteObiettivoF(id) {
    return sbFetch(`obiettivi_funzionari?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  }

  /* ═══════════════════════════════════════════════
     SEZIONE 2: OBIETTIVI PER PROMOTORE
  ════════════════════════════════════════════════ */

  async function loadObiettiviP() {
    return sbFetch('obiettivi_promotori?select=*&order=ordinamento.asc,id.asc');
  }

  async function saveObiettivoP(data) {
    if (data.id) {
      return sbFetch(`obiettivi_promotori?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
      });
    }
    return sbFetch('obiettivi_promotori', { method: 'POST', body: JSON.stringify(data) });
  }

  async function deleteObiettivoP(id) {
    return sbFetch(`obiettivi_promotori?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  }

  /* ═══════════════════════════════════════════════
     RENDER PRINCIPALE
  ════════════════════════════════════════════════ */

  function renderObiettivi() {
    const el = document.getElementById('atab-obiettivi');
    if (!el) return;

    el.innerHTML = `
<div class="ob-wrap">

  <!-- ── TABELLA FUNZIONARI ── -->
  <div class="admin-card-new ob-section">
    <div class="admin-card-head">
      <div class="admin-card-head-icon" style="background:rgba(37,99,235,.1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      </div>
      <span>Obiettivi per Funzionario</span>
      <div class="ob-head-actions">
        <div class="ob-anno-ctrl">
          <label>Periodo:</label>
          <select id="ob-f-anno-tipo">
            <option value="tutti">Tutti gli anni</option>
            <option value="anno">Anno specifico</option>
            <option value="range">Intervallo anni</option>
          </select>
          <div id="ob-f-anno-fields" style="display:none;gap:6px;align-items:center"></div>
        </div>
        <button class="btn btn-sm btn-primary" id="ob-f-ricalcola">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Ricalcola tutto
        </button>
        <button class="btn btn-sm btn-success" id="ob-f-export">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Excel
        </button>
      </div>
    </div>
    <div class="admin-card-body" style="padding:0">
      <div id="ob-f-table-wrap">
        <table class="ob-table" id="ob-f-table">
          <thead>
            <tr>
              <th>Funzionario</th>
              <th class="ob-col-num">Obiettivo</th>
              <th class="ob-col-num">Fatti</th>
              <th class="ob-col-num">% su tot.</th>
              <th class="ob-col-num">+/−</th>
              <th class="ob-col-bar">Progresso</th>
              <th class="ob-col-act"></th>
            </tr>
          </thead>
          <tbody id="ob-f-tbody">
            <tr><td colspan="7" class="ob-loading">Caricamento…</td></tr>
          </tbody>
          <tfoot id="ob-f-tfoot"></tfoot>
        </table>
      </div>
      <!-- Aggiungi riga -->
      <div class="ob-add-row" id="ob-f-add-row">
        <div class="ob-add-inner">
          <div class="ob-add-field">
            <label>Funzionario (da diretti)</label>
            <div style="position:relative">
              <input type="text" id="ob-f-add-nome" placeholder="Cerca nome…" autocomplete="off" class="ob-input">
              <div id="ob-f-dropdown" class="ob-dropdown" style="display:none"></div>
            </div>
          </div>
          <div class="ob-add-field ob-add-field-sm">
            <label>Obiettivo (n. contratti)</label>
            <input type="number" id="ob-f-add-obj" placeholder="es. 50" min="1" class="ob-input">
          </div>
          <button class="btn btn-sm btn-primary" id="ob-f-add-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── TABELLA PROMOTORI ── -->
  <div class="admin-card-new ob-section" style="margin-top:24px">
    <div class="admin-card-head">
      <div class="admin-card-head-icon" style="background:rgba(22,163,74,.1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <span>Obiettivi per Promotore</span>
      <div class="ob-head-actions">
        <div class="ob-anno-ctrl">
          <label>Periodo:</label>
          <select id="ob-p-anno-tipo">
            <option value="tutti">Tutti gli anni</option>
            <option value="anno">Anno specifico</option>
            <option value="range">Intervallo anni</option>
          </select>
          <div id="ob-p-anno-fields" style="display:none;gap:6px;align-items:center"></div>
        </div>
        <button class="btn btn-sm btn-primary" id="ob-p-ricalcola">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Ricalcola tutto
        </button>
        <button class="btn btn-sm btn-success" id="ob-p-export">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Excel
        </button>
      </div>
    </div>
    <div class="admin-card-body" style="padding:0">
      <div id="ob-p-table-wrap">
        <table class="ob-table" id="ob-p-table">
          <thead>
            <tr>
              <th>Promotore</th>
              <th class="ob-col-num">Obiettivo</th>
              <th class="ob-col-num">Fatti</th>
              <th class="ob-col-num">% su tot.</th>
              <th class="ob-col-num">+/−</th>
              <th class="ob-col-bar">Progresso</th>
              <th class="ob-col-act"></th>
            </tr>
          </thead>
          <tbody id="ob-p-tbody">
            <tr><td colspan="7" class="ob-loading">Caricamento…</td></tr>
          </tbody>
          <tfoot id="ob-p-tfoot"></tfoot>
        </table>
      </div>
      <div class="ob-add-row" id="ob-p-add-row">
        <div class="ob-add-inner">
          <div class="ob-add-field">
            <label>Promotore/Raggruppamento (da diretti)</label>
            <div style="position:relative">
              <input type="text" id="ob-p-add-nome" placeholder="Cerca raggruppamento…" autocomplete="off" class="ob-input">
              <div id="ob-p-dropdown" class="ob-dropdown" style="display:none"></div>
            </div>
          </div>
          <div class="ob-add-field ob-add-field-sm">
            <label>Obiettivo (n. contratti)</label>
            <input type="number" id="ob-p-add-obj" placeholder="es. 100" min="1" class="ob-input">
          </div>
          <button class="btn btn-sm btn-primary" id="ob-p-add-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  </div>

</div>`;

    initFunzionari();
    initPromoteri();
  }

  /* ─────── FUNZIONARI ─────── */

  let obiettiviF = [];
  let totaleFattiF = 0;

  function getAnnoParamsFromUI(prefix) {
    const tipo = document.getElementById(`ob-${prefix}-anno-tipo`).value;
    if (tipo === 'tutti') return { p_anno_da: null, p_anno_a: null };
    if (tipo === 'anno') {
      const y = parseInt(document.getElementById(`ob-${prefix}-anno-val`)?.value) || null;
      return { p_anno_da: y, p_anno_a: y };
    }
    if (tipo === 'range') {
      return {
        p_anno_da: parseInt(document.getElementById(`ob-${prefix}-anno-da`)?.value) || null,
        p_anno_a: parseInt(document.getElementById(`ob-${prefix}-anno-a`)?.value) || null,
      };
    }
    return { p_anno_da: null, p_anno_a: null };
  }

  function setupAnnoCtrl(prefix) {
    const sel = document.getElementById(`ob-${prefix}-anno-tipo`);
    const fields = document.getElementById(`ob-${prefix}-anno-fields`);

    function rebuild() {
      const v = sel.value;
      if (v === 'tutti') {
        fields.style.display = 'none';
        fields.innerHTML = '';
      } else if (v === 'anno') {
        fields.style.display = 'flex';
        const y = new Date().getFullYear();
        fields.innerHTML = `<input type="number" id="ob-${prefix}-anno-val" value="${y}" min="2000" max="2099" style="width:80px" class="ob-input">`;
      } else if (v === 'range') {
        fields.style.display = 'flex';
        const y = new Date().getFullYear();
        fields.innerHTML = `
          <input type="number" id="ob-${prefix}-anno-da" value="${y}" min="2000" max="2099" style="width:70px" class="ob-input">
          <span style="color:var(--text-secondary)">–</span>
          <input type="number" id="ob-${prefix}-anno-a" value="${y}" min="2000" max="2099" style="width:70px" class="ob-input">`;
      }
    }

    sel.addEventListener('change', rebuild);
    rebuild();
  }

  async function initFunzionari() {
    setupAnnoCtrl('f');
    obiettiviF = await loadObiettiviF();
    renderTableF(false);

    // Autocomplete
    const inp = document.getElementById('ob-f-add-nome');
    const dd = document.getElementById('ob-f-dropdown');
    let allNames = [];

    inp.addEventListener('focus', async () => {
      if (!allNames.length) allNames = await getAcuradiList();
    });

    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { dd.style.display = 'none'; return; }
      const matches = allNames.filter(n => n.toLowerCase().includes(q)).slice(0, 12);
      if (!matches.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = matches.map(n => `<div class="ob-dd-item" data-val="${escHtml(n)}">${escHtml(n)}</div>`).join('');
      dd.style.display = 'block';
    });

    dd.addEventListener('click', e => {
      const item = e.target.closest('.ob-dd-item');
      if (!item) return;
      inp.value = item.dataset.val;
      dd.style.display = 'none';
    });

    document.addEventListener('click', e => {
      if (!inp.contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none';
    });

    document.getElementById('ob-f-add-btn').addEventListener('click', () => addRowF());
    document.getElementById('ob-f-ricalcola').addEventListener('click', () => ricalcolaF());
    document.getElementById('ob-f-export').addEventListener('click', () => exportExcel('funzionari'));
  }

  function renderTableF(calcolato) {
    const tbody = document.getElementById('ob-f-tbody');
    const tfoot = document.getElementById('ob-f-tfoot');
    if (!obiettiviF.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="ob-empty">Nessun funzionario aggiunto. Usa il form qui sotto.</td></tr>`;
      tfoot.innerHTML = '';
      return;
    }

    let totOb = 0, totFatti = 0;

    tbody.innerHTML = obiettiviF.map(row => {
      totOb += row.obiettivo || 0;
      const fatti = calcolato ? (row._fatti || 0) : (row._fatti != null ? row._fatti : '—');
      if (calcolato) totFatti += row._fatti || 0;

      const fattiNum = typeof fatti === 'number' ? fatti : null;
      const pctTot = calcolato && totaleFattiF ? pct(fattiNum, totaleFattiF) : '—';
      const deltaHtml = calcolato && fattiNum != null ? delta(fattiNum, row.obiettivo) : '—';
      const barHtml = calcolato && fattiNum != null ? progressBar(fattiNum, row.obiettivo) : '';
      const fattiDisp = calcolato
        ? `<span class="ob-fatti-num ${fattiNum >= row.obiettivo ? 'ob-pos' : ''}">${fattiNum}</span>`
        : `<span class="ob-nc">—</span>`;

      return `<tr data-id="${row.id}">
        <td>
          <div class="ob-name-cell">
            <span class="ob-name">${escHtml(row.nome_display)}</span>
            <span class="ob-match" title="match: ${escHtml(row.acuradi_match)}">${escHtml(row.acuradi_match)}</span>
          </div>
        </td>
        <td class="ob-col-num">
          <input type="number" class="ob-input ob-inline-input" value="${row.obiettivo}" min="0"
            data-id="${row.id}" data-field="obiettivo" data-table="f">
        </td>
        <td class="ob-col-num">${fattiDisp}</td>
        <td class="ob-col-num">${pctTot}</td>
        <td class="ob-col-num">${deltaHtml}</td>
        <td class="ob-col-bar">${barHtml}</td>
        <td class="ob-col-act">
          <button class="ob-btn-del" data-id="${row.id}" data-table="f" title="Rimuovi">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('');

    if (calcolato) {
      tfoot.innerHTML = `<tr class="ob-tfoot-row">
        <td><strong>TOTALE</strong></td>
        <td class="ob-col-num"><strong>${totOb}</strong></td>
        <td class="ob-col-num"><strong>${totFatti}</strong></td>
        <td class="ob-col-num">${totOb ? pct(totFatti, totOb) : '—'}</td>
        <td class="ob-col-num">${delta(totFatti, totOb)}</td>
        <td class="ob-col-bar">${progressBar(totFatti, totOb)}</td>
        <td></td>
      </tr>`;
    } else {
      tfoot.innerHTML = '';
    }

    // Inline edit save on blur
    tbody.querySelectorAll('.ob-inline-input').forEach(inp => {
      inp.addEventListener('change', async () => {
        const id = parseInt(inp.dataset.id);
        const row = obiettiviF.find(r => r.id === id);
        if (row) {
          row.obiettivo = parseInt(inp.value) || 0;
          await saveObiettivoF({ id, obiettivo: row.obiettivo });
        }
      });
    });

    // Delete
    tbody.querySelectorAll('.ob-btn-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Rimuovere questo funzionario dagli obiettivi?')) return;
        await deleteObiettivoF(parseInt(btn.dataset.id));
        obiettiviF = obiettiviF.filter(r => r.id !== parseInt(btn.dataset.id));
        renderTableF(calcolato);
      });
    });
  }

  async function addRowF() {
    const nome = document.getElementById('ob-f-add-nome').value.trim();
    const obj = parseInt(document.getElementById('ob-f-add-obj').value) || 0;
    if (!nome) { alert('Inserisci il nome del funzionario.'); return; }

    const list = await getAcuradiList();
    const match = list.find(n => n.toLowerCase() === nome.toLowerCase()) || nome;

    const data = {
      nome_display: match,
      acuradi_match: match,
      obiettivo: obj,
      ordinamento: obiettiviF.length,
    };
    const saved = await saveObiettivoF(data);
    obiettiviF.push(saved[0] || { ...data, id: Date.now() });
    document.getElementById('ob-f-add-nome').value = '';
    document.getElementById('ob-f-add-obj').value = '';
    renderTableF(false);
  }

  async function ricalcolaF() {
    const btn = document.getElementById('ob-f-ricalcola');
    btn.disabled = true;
    btn.textContent = 'Calcolo in corso…';
    try {
      const params = getAnnoParamsFromUI('f');
      const results = await Promise.all(
        obiettiviF.map(row =>
          sbRpc('get_iscritti_per_acuradi', {
            p_acuradi: row.acuradi_match,
            ...params,
          }).then(v => ({ id: row.id, fatti: v }))
        )
      );
      totaleFattiF = 0;
      results.forEach(r => {
        const row = obiettiviF.find(x => x.id === r.id);
        if (row) { row._fatti = r.fatti; totaleFattiF += r.fatti; }
      });
      renderTableF(true);
    } catch (e) {
      alert('Errore nel calcolo: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Ricalcola tutto`;
    }
  }

  /* ─────── PROMOTORI ─────── */

  let obiettiviP = [];
  let totaleFattiP = 0;

  async function initPromoteri() {
    setupAnnoCtrl('p');
    obiettiviP = await loadObiettiviP();
    renderTableP(false);

    const inp = document.getElementById('ob-p-add-nome');
    const dd = document.getElementById('ob-p-dropdown');
    let allNames = [];

    inp.addEventListener('focus', async () => {
      if (!allNames.length) allNames = await getRaggruppamentoList();
    });

    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { dd.style.display = 'none'; return; }
      const matches = allNames.filter(n => n.toLowerCase().includes(q)).slice(0, 12);
      if (!matches.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = matches.map(n => `<div class="ob-dd-item" data-val="${escHtml(n)}">${escHtml(n)}</div>`).join('');
      dd.style.display = 'block';
    });

    dd.addEventListener('click', e => {
      const item = e.target.closest('.ob-dd-item');
      if (!item) return;
      inp.value = item.dataset.val;
      dd.style.display = 'none';
    });

    document.addEventListener('click', e => {
      if (!inp.contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none';
    });

    document.getElementById('ob-p-add-btn').addEventListener('click', () => addRowP());
    document.getElementById('ob-p-ricalcola').addEventListener('click', () => ricalcolaP());
    document.getElementById('ob-p-export').addEventListener('click', () => exportExcel('promotori'));
  }

  function renderTableP(calcolato) {
    const tbody = document.getElementById('ob-p-tbody');
    const tfoot = document.getElementById('ob-p-tfoot');
    if (!obiettiviP.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="ob-empty">Nessun promotore aggiunto. Usa il form qui sotto.</td></tr>`;
      tfoot.innerHTML = '';
      return;
    }

    let totOb = 0, totFatti = 0;

    tbody.innerHTML = obiettiviP.map(row => {
      totOb += row.obiettivo || 0;
      const fatti = calcolato ? (row._fatti || 0) : (row._fatti != null ? row._fatti : '—');
      if (calcolato) totFatti += row._fatti || 0;

      const fattiNum = typeof fatti === 'number' ? fatti : null;
      const pctTot = calcolato && totaleFattiP ? pct(fattiNum, totaleFattiP) : '—';
      const deltaHtml = calcolato && fattiNum != null ? delta(fattiNum, row.obiettivo) : '—';
      const barHtml = calcolato && fattiNum != null ? progressBar(fattiNum, row.obiettivo) : '';
      const fattiDisp = calcolato
        ? `<span class="ob-fatti-num ${fattiNum >= row.obiettivo ? 'ob-pos' : ''}">${fattiNum}</span>`
        : `<span class="ob-nc">—</span>`;

      return `<tr data-id="${row.id}">
        <td>
          <div class="ob-name-cell">
            <span class="ob-name">${escHtml(row.nome_display)}</span>
            <span class="ob-match" title="match: ${escHtml(row.raggruppamento_match)}">${escHtml(row.raggruppamento_match)}</span>
          </div>
        </td>
        <td class="ob-col-num">
          <input type="number" class="ob-input ob-inline-input" value="${row.obiettivo}" min="0"
            data-id="${row.id}" data-field="obiettivo" data-table="p">
        </td>
        <td class="ob-col-num">${fattiDisp}</td>
        <td class="ob-col-num">${pctTot}</td>
        <td class="ob-col-num">${deltaHtml}</td>
        <td class="ob-col-bar">${barHtml}</td>
        <td class="ob-col-act">
          <button class="ob-btn-del" data-id="${row.id}" data-table="p" title="Rimuovi">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('');

    if (calcolato) {
      tfoot.innerHTML = `<tr class="ob-tfoot-row">
        <td><strong>TOTALE</strong></td>
        <td class="ob-col-num"><strong>${totOb}</strong></td>
        <td class="ob-col-num"><strong>${totFatti}</strong></td>
        <td class="ob-col-num">${totOb ? pct(totFatti, totOb) : '—'}</td>
        <td class="ob-col-num">${delta(totFatti, totOb)}</td>
        <td class="ob-col-bar">${progressBar(totFatti, totOb)}</td>
        <td></td>
      </tr>`;
    } else {
      tfoot.innerHTML = '';
    }

    tbody.querySelectorAll('.ob-inline-input').forEach(inp => {
      inp.addEventListener('change', async () => {
        const id = parseInt(inp.dataset.id);
        const row = obiettiviP.find(r => r.id === id);
        if (row) {
          row.obiettivo = parseInt(inp.value) || 0;
          await saveObiettivoP({ id, obiettivo: row.obiettivo });
        }
      });
    });

    tbody.querySelectorAll('.ob-btn-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Rimuovere questo promotore dagli obiettivi?')) return;
        await deleteObiettivoP(parseInt(btn.dataset.id));
        obiettiviP = obiettiviP.filter(r => r.id !== parseInt(btn.dataset.id));
        renderTableP(calcolato);
      });
    });
  }

  async function addRowP() {
    const nome = document.getElementById('ob-p-add-nome').value.trim();
    const obj = parseInt(document.getElementById('ob-p-add-obj').value) || 0;
    if (!nome) { alert('Inserisci il nome del promotore/raggruppamento.'); return; }

    const list = await getRaggruppamentoList();
    const match = list.find(n => n.toLowerCase() === nome.toLowerCase()) || nome;

    const data = {
      nome_display: match,
      raggruppamento_match: match,
      obiettivo: obj,
      ordinamento: obiettiviP.length,
    };
    const saved = await saveObiettivoP(data);
    obiettiviP.push(saved[0] || { ...data, id: Date.now() });
    document.getElementById('ob-p-add-nome').value = '';
    document.getElementById('ob-p-add-obj').value = '';
    renderTableP(false);
  }

  async function ricalcolaP() {
    const btn = document.getElementById('ob-p-ricalcola');
    btn.disabled = true;
    btn.textContent = 'Calcolo in corso…';
    try {
      const params = getAnnoParamsFromUI('p');
      const results = await Promise.all(
        obiettiviP.map(row =>
          sbRpc('get_iscritti_per_raggruppamento', {
            p_raggruppamento: row.raggruppamento_match,
            ...params,
          }).then(v => ({ id: row.id, fatti: v }))
        )
      );
      totaleFattiP = 0;
      results.forEach(r => {
        const row = obiettiviP.find(x => x.id === r.id);
        if (row) { row._fatti = r.fatti; totaleFattiP += r.fatti; }
      });
      renderTableP(true);
    } catch (e) {
      alert('Errore nel calcolo: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Ricalcola tutto`;
    }
  }

  /* ─────── EXPORT EXCEL ─────── */

  function exportExcel(tipo) {
    const isFun = tipo === 'funzionari';
    const rows = isFun ? obiettiviF : obiettiviP;
    const totFatti = isFun ? totaleFattiF : totaleFattiP;
    const XLSX = window.XLSX || window.XLSXStyle;
    if (!XLSX) { alert('Libreria Excel non disponibile.'); return; }

    const headers = ['Nome', 'Obiettivo', 'Fatti', '% su totale', '+/-', '% raggiungimento'];
    const data = rows.map(r => {
      const f = r._fatti != null ? r._fatti : '';
      const d = f !== '' ? f - r.obiettivo : '';
      const pctTot = f !== '' && totFatti ? ((f / totFatti) * 100).toFixed(1) + '%' : '';
      const pctRag = f !== '' && r.obiettivo ? ((f / r.obiettivo) * 100).toFixed(1) + '%' : '';
      return [r.nome_display, r.obiettivo, f, pctTot, d !== '' ? (d >= 0 ? '+' + d : d) : '', pctRag];
    });

    // Totale
    const totOb = rows.reduce((s, r) => s + (r.obiettivo || 0), 0);
    const totF = rows.reduce((s, r) => s + (r._fatti || 0), 0);
    data.push(['TOTALE', totOb, totF,
      totOb ? ((totF / totOb) * 100).toFixed(1) + '%' : '',
      (totF - totOb >= 0 ? '+' : '') + (totF - totOb),
      totOb ? ((totF / totOb) * 100).toFixed(1) + '%' : '']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo === 'funzionari' ? 'Funzionari' : 'Promotori');

    // Stile intestazione se xlsx-js-style
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1D3557' } },
        };
      }
    }
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 16 }];

    XLSX.writeFile(wb, `obiettivi_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /* ─────── UTILITY ─────── */
  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ─────── ATTIVAZIONE ─────── */
  // Aspetta che la tab venga attivata la prima volta
  document.addEventListener('DOMContentLoaded', () => {
    // Observer per rilevare quando la tab obiettivi diventa visibile
    const observer = new MutationObserver(() => {
      const el = document.getElementById('atab-obiettivi');
      if (el && el.classList.contains('active') && !el.dataset.loaded) {
        el.dataset.loaded = '1';
        renderObiettivi();
      }
    });

    const panel = document.getElementById('admin-panel');
    if (panel) observer.observe(panel, { attributes: true, subtree: true, attributeFilter: ['class'] });
  });

  window.ObiettiviFunzionari = { render: renderObiettivi };
})();
