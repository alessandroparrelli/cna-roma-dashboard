console.log('✅ ateco.js CARICATO');

// Variabili globali ATECO
var atecoLoaded = false, atecoLoading = false, atecoAllData = [], atecoFiltered = [], atecoCharts = {};

async function atecoFetchAll(table) {
  var all = [], offset = 0, size = 1000;
  while (true) {
    var r = await fetch(SB + '/rest/v1/' + table + '?select=*&offset=' + offset + '&limit=' + size, {headers: H()});
    if (!r.ok) throw new Error(table + ': HTTP ' + r.status);
    var rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    offset += size;
    if (rows.length < size) break;
    await new Promise(function(res) { setTimeout(res, 150); });
  }
  return all;
}

function atecoSetProgress(pct, msg) {
  var el = G('ateco-progress');
  if (el) el.style.width = pct + '%';
  el = G('ateco-load-msg');
  if (el && msg) el.textContent = msg;
}

function atecoJoin(tess, ana, ateco) {
  atecoSetProgress(75, 'Unificazione dati…');
  var res = [];
  
  var anaMap = new Map();
  ana.forEach(function(a) {
    var piva = String(a.partita_iva || a.Partita_IVA || '').trim();
    if (!anaMap.has(piva)) anaMap.set(piva, []);
    anaMap.get(piva).push(a);
  });
  
  var atecoMap = new Map();
  ateco.forEach(function(a) {
    var code = String(a.codiceateco || a.Codiceateco || '').trim();
    if (!atecoMap.has(code)) atecoMap.set(code, []);
    atecoMap.get(code).push(a);
  });
  
  tess.forEach(function(t) {
    var piva = String(t.partita_iva || t.Partita_IVA || '').trim();
    var anaRecs = anaMap.get(piva) || [{}];
    var a = anaRecs[0] || {};
    
    var atecoCode = String(a.codiceateco || a.Codiceateco || '').trim();
    var atecoRecs = atecoMap.get(atecoCode) || [{}];
    var c = atecoRecs[0] || {};
    
    // Estrai sesso da CF
    var cf = a.codice_fiscale_titolare || a.CF || '';
    var sesso = null;
    if (cf && cf.length >= 10) {
      var gg = parseInt(cf.substr(9, 2), 10);
      sesso = (gg >= 41) ? 'F' : (gg >= 1 && gg <= 31) ? 'M' : null;
    }
    
    // Estrai nazionalità
    var naz = (cf && cf.length >= 12 && (cf.charAt(11) === 'Z' || cf.charAt(11) === 'z')) ? 'ST' : 'IT';
    
    // Estrai anno/mese
    var data = t.data_associazione || t.Data_Associazione || '';
    var parts = data.split('-');
    
    res.push({
      piva: piva,
      unione: c.unione || c.Unione || 'N/D',
      mestiere: c.mestiere_denom || c.Mestiere_Denom || 'N/D',
      sesso: sesso,
      nazionalita: naz,
      anno: parts[0] || '',
      mese: parts[1] || ''
    });
  });
  
  atecoSetProgress(90, 'Elaborazione dati…');
  return res;
}

async function atecoLoad(force) {
  console.log('🔄 atecoLoad() CHIAMATA', {force, atecoLoading, atecoLoaded});
  if (atecoLoading) return;
  if (atecoLoaded && !force) return;
  atecoLoading = true;
  
  console.log('✅ atecoLoad() IN PROGRESS');
  
  // BUILD UI SUBITO
  atecoBuildUI();
  
  var loader = G('ateco-loader');
  var content = G('ateco-content');
  console.log('DOM elements:', {loader, content});
  if (loader) loader.classList.add('active');
  if (content) content.style.display = 'none';
  
  atecoSetProgress(0, 'Connessione a Supabase…');
  
  try {
    atecoSetProgress(10, 'Caricamento Tesseramento…');
    var tess = await atecoFetchAll('tesseramento_records');
    atecoSetProgress(40, 'Caricamento Anagrafiche…');
    var ana = await atecoFetchAll('Anagrafiche');
    atecoSetProgress(60, 'Caricamento Codici ATECO…');
    var ateco = await atecoFetchAll('codiciateco');
    
    atecoAllData = atecoJoin(tess, ana, ateco);
    atecoFiltered = atecoAllData.slice();
    
    atecoSetProgress(95, 'Rendering…');
    atecoPopulateFilters();
    atecoRender();
    
    atecoSetProgress(100, 'Completato.');
    atecoLoaded = true;
    
    setTimeout(function() {
      if (loader) loader.classList.remove('active');
      if (content) content.style.display = 'block';
    }, 300);
  } catch (e) {
    console.error(e);
    var msgEl = G('ateco-load-msg');
    if (msgEl) {
      msgEl.textContent = '❌ ' + e.message;
      msgEl.style.color = 'var(--red)';
    }
  } finally {
    atecoLoading = false;
  }
}

function atecoBuildUI() {
  var tab = G('tab-ateco');
  if (!tab) return;
  
  tab.innerHTML = `
    <div style="padding:20px">
      <div id="ateco-loader" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:none;flex-direction:column;justify-content:center;align-items:center;z-index:9999;opacity:0;transition:opacity 0.3s">
        <div style="background:var(--surface);padding:30px;border-radius:12px;text-align:center">
          <div style="font-size:20px;margin-bottom:15px">📊 Caricamento dati</div>
          <div style="width:200px;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
            <div id="ateco-progress" style="height:100%;width:0;background:linear-gradient(90deg,#A855F7,#7E22CE);transition:width 0.2s"></div>
          </div>
          <div id="ateco-load-msg" style="margin-top:15px;font-size:13px;color:var(--text-secondary)">Connessione…</div>
        </div>
      </div>
      <div id="ateco-content" style="display:none">
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">ANNO</label>
              <select id="ateco-anno" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESE DA</label>
              <select id="ateco-mese-da" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESE A</label>
              <select id="ateco-mese-a" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">SESSO</label>
              <select id="ateco-sesso" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">NAZIONALITÀ</label>
              <select id="ateco-nazionalita" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
                <option value="IT">Italiano</option>
                <option value="ST">Straniero</option>
              </select>
            </div>
            <div style="display:flex;align-items:flex-end">
              <button id="ateco-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Reset</button>
            </div>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          <div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:18px;border-radius:8px;text-align:center">
            <div style="font-size:11px;opacity:0.9">IMPRESE</div>
            <div style="font-size:32px;font-weight:700" id="kpi-imprese">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:18px;border-radius:8px;text-align:center">
            <div style="font-size:11px;opacity:0.9">UNIONI</div>
            <div style="font-size:32px;font-weight:700" id="kpi-unioni">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:18px;border-radius:8px;text-align:center">
            <div style="font-size:11px;opacity:0.9">MESTIERI</div>
            <div style="font-size:32px;font-weight:700" id="kpi-mestieri">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:18px;border-radius:8px;text-align:center">
            <div style="font-size:11px;opacity:0.9">DONNE %</div>
            <div style="font-size:32px;font-weight:700" id="kpi-donne">0</div>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #A855F7">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Unioni</h3>
            <canvas id="chart-unioni" style="height:280px"></canvas>
          </div>
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Mestieri</h3>
            <canvas id="chart-mestieri" style="height:280px"></canvas>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #EC4899">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Sesso</h3>
            <canvas id="chart-sesso" style="height:280px"></canvas>
          </div>
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #10B981">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Nazionalità</h3>
            <canvas id="chart-naz" style="height:280px"></canvas>
          </div>
        </div>
        
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">
          <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Unioni</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:rgba(168,85,247,0.1);border-bottom:2px solid var(--border)"><th style="text-align:left;padding:12px;font-weight:700">Unione</th><th style="text-align:center;padding:12px;font-weight:700">Imprese</th><th style="text-align:center;padding:12px;font-weight:700">% Donne</th><th style="text-align:center;padding:12px;font-weight:700">% Stranieri</th></tr></thead>
            <tbody id="tbody-unioni"></tbody>
          </table>
        </div>
        
        <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316">
          <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Mestieri</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:rgba(249,115,22,0.1);border-bottom:2px solid var(--border)"><th style="text-align:left;padding:12px;font-weight:700">Mestiere</th><th style="text-align:center;padding:12px;font-weight:700">Imprese</th><th style="text-align:center;padding:12px;font-weight:700">% Donne</th><th style="text-align:center;padding:12px;font-weight:700">% Stranieri</th></tr></thead>
            <tbody id="tbody-mestieri"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function atecoPopulateFilters() {
  var anni = new Set();
  atecoAllData.forEach(function(r) { if (r.anno) anni.add(r.anno); });
  Array.from(anni).sort().forEach(function(a) {
    var opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    G('ateco-anno').appendChild(opt);
  });
  
  for (var m = 1; m <= 12; m++) {
    var mStr = String(m).padStart(2, '0');
    ['ateco-mese-da', 'ateco-mese-a'].forEach(function(id) {
      var opt = document.createElement('option');
      opt.value = mStr;
      opt.textContent = mStr;
      G(id).appendChild(opt);
    });
  }
  
  ['ateco-anno', 'ateco-mese-da', 'ateco-mese-a', 'ateco-sesso', 'ateco-nazionalita'].forEach(function(id) {
    var el = G(id);
    if (el) el.addEventListener('change', atecoApplyFilters);
  });
  
  var resetBtn = G('ateco-reset');
  if (resetBtn) resetBtn.addEventListener('click', atecoResetFilters);
}

function atecoApplyFilters() {
  var anno = G('ateco-anno').value;
  var meseDa = G('ateco-mese-da').value;
  var meseA = G('ateco-mese-a').value;
  var sesso = G('ateco-sesso').value;
  var naz = G('ateco-nazionalita').value;
  
  atecoFiltered = atecoAllData.filter(function(r) {
    return (!anno || r.anno === anno) && 
           (!meseDa || !r.mese || r.mese >= meseDa) && 
           (!meseA || !r.mese || r.mese <= meseA) && 
           (!sesso || r.sesso === sesso) && 
           (!naz || r.nazionalita === naz);
  });
  
  atecoRender();
}

function atecoResetFilters() {
  ['ateco-anno', 'ateco-mese-da', 'ateco-mese-a', 'ateco-sesso', 'ateco-nazionalita'].forEach(function(id) {
    var el = G(id);
    if (el) el.value = '';
  });
  atecoFiltered = atecoAllData.slice();
  atecoRender();
}

function atecoRender() {
  var stats = atecoCalcStats();
  G('kpi-imprese').textContent = stats.imprese;
  G('kpi-unioni').textContent = stats.unioni;
  G('kpi-mestieri').textContent = stats.mestieri;
  G('kpi-donne').textContent = stats.pctDonne.toFixed(1);
  
  atecoDrawCharts(stats);
  atecoDrawTables(stats);
}

function atecoCalcStats() {
  var pivaSet = new Set(), unioniSet = new Set(), mestieriSet = new Set();
  var unioni = {}, mestieri = {}, sesso = {}, naz = {};
  var donne = 0;
  
  atecoFiltered.forEach(function(r) {
    pivaSet.add(r.piva);
    if (r.sesso) sesso[r.sesso] = (sesso[r.sesso] || 0) + 1;
    if (r.sesso === 'F') donne++;
    naz[r.nazionalita] = (naz[r.nazionalita] || 0) + 1;
    
    if (r.unione !== 'N/D') {
      unioniSet.add(r.unione);
      if (!unioni[r.unione]) unioni[r.unione] = {count: 0, donne: 0, stranieri: 0};
      unioni[r.unione].count++;
      if (r.sesso === 'F') unioni[r.unione].donne++;
      if (r.nazionalita === 'ST') unioni[r.unione].stranieri++;
    }
    
    if (r.mestiere !== 'N/D') {
      mestieriSet.add(r.mestiere);
      if (!mestieri[r.mestiere]) mestieri[r.mestiere] = {count: 0, donne: 0, stranieri: 0};
      mestieri[r.mestiere].count++;
      if (r.sesso === 'F') mestieri[r.mestiere].donne++;
      if (r.nazionalita === 'ST') mestieri[r.mestiere].stranieri++;
    }
  });
  
  return {imprese: pivaSet.size, unioni: unioniSet.size, mestieri: mestieriSet.size, pctDonne: pivaSet.size > 0 ? (donne / pivaSet.size * 100) : 0, unioni: unioni, mestieri: mestieri, sesso: sesso, naz: naz};
}

function atecoDrawCharts(stats) {
  var colors = ['#A855F7','#9333EA','#7E22CE','#6B21A8','#581C87','#9F1239','#BE123C','#DC2626','#EA580C','#F59E0B'];
  
  if (G('chart-unioni') && typeof Chart !== 'undefined') {
    if (atecoCharts.u) atecoCharts.u.destroy();
    var labels = Object.keys(stats.unioni).sort(function(a,b) { return stats.unioni[b].count - stats.unioni[a].count; }).slice(0, 10);
    var data = labels.map(function(k) { return stats.unioni[k].count; });
    atecoCharts.u = new Chart(G('chart-unioni'), {type: 'doughnut', data: {labels: labels, datasets: [{data: data, backgroundColor: colors, borderColor: 'var(--surface)', borderWidth: 2}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)'}}}}});
  }
  
  if (G('chart-mestieri') && typeof Chart !== 'undefined') {
    if (atecoCharts.m) atecoCharts.m.destroy();
    var labels = Object.keys(stats.mestieri).sort(function(a,b) { return stats.mestieri[b].count - stats.mestieri[a].count; }).slice(0, 8);
    var data = labels.map(function(k) { return stats.mestieri[k].count; });
    atecoCharts.m = new Chart(G('chart-mestieri'), {type: 'bar', data: {labels: labels, datasets: [{label: 'Imprese', data: data, backgroundColor: '#F97316', borderRadius: 6}]}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {x: {ticks: {color: 'var(--text-tertiary)'}}, y: {ticks: {color: 'var(--text-tertiary)'}}}}});
  }
  
  if (G('chart-sesso') && typeof Chart !== 'undefined') {
    if (atecoCharts.s) atecoCharts.s.destroy();
    atecoCharts.s = new Chart(G('chart-sesso'), {type: 'pie', data: {labels: ['Maschi', 'Femmine'], datasets: [{data: [stats.sesso.M || 0, stats.sesso.F || 0], backgroundColor: ['#06B6D4', '#EC4899'], borderColor: 'var(--surface)', borderWidth: 2}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)'}}}}});
  }
  
  if (G('chart-naz') && typeof Chart !== 'undefined') {
    if (atecoCharts.n) atecoCharts.n.destroy();
    atecoCharts.n = new Chart(G('chart-naz'), {type: 'doughnut', data: {labels: ['Italiani', 'Stranieri'], datasets: [{data: [stats.naz.IT || 0, stats.naz.ST || 0], backgroundColor: ['#10B981', '#F59E0B'], borderColor: 'var(--surface)', borderWidth: 2}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)'}}}}});
  }
}

function atecoDrawTables(stats) {
  var tbodyU = G('tbody-unioni');
  if (tbodyU) {
    tbodyU.innerHTML = '';
    Object.keys(stats.unioni).sort(function(a,b) { return stats.unioni[b].count - stats.unioni[a].count; }).forEach(function(u) {
      var d = stats.unioni[u];
      var tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      var pD = d.count > 0 ? ((d.donne / d.count) * 100).toFixed(1) : 0;
      var pS = d.count > 0 ? ((d.stranieri / d.count) * 100).toFixed(1) : 0;
      tr.innerHTML = '<td style="padding:12px"><strong>' + u + '</strong></td><td style="text-align:center;padding:12px">' + d.count + '</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">' + pD + '%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">' + pS + '%</td>';
      tbodyU.appendChild(tr);
    });
  }
  
  var tbodyM = G('tbody-mestieri');
  if (tbodyM) {
    tbodyM.innerHTML = '';
    Object.keys(stats.mestieri).sort(function(a,b) { return stats.mestieri[b].count - stats.mestieri[a].count; }).forEach(function(m) {
      var d = stats.mestieri[m];
      var tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      var pD = d.count > 0 ? ((d.donne / d.count) * 100).toFixed(1) : 0;
      var pS = d.count > 0 ? ((d.stranieri / d.count) * 100).toFixed(1) : 0;
      tr.innerHTML = '<td style="padding:12px"><strong>' + m + '</strong></td><td style="text-align:center;padding:12px">' + d.count + '</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">' + pD + '%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">' + pS + '%</td>';
      tbodyM.appendChild(tr);
    });
  }
}
