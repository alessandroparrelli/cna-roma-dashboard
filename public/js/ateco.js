/**
 * TAB ATECO - Unioni v1778273808 Mestieri e Raggruppamenti
 * Analisi completa con filtri, grafici e tabelle
 */

var atecoTab = {
  allRecords: [],
  filtered: [],
  charts: {},
  
  init: function() {
    var tab = G('tab-ateco');
    if (!tab) return;
    
    tab.innerHTML = '<div style="padding:40px;text-align:center"><div style="font-size:20px;margin-bottom:10px">📊 Caricamento dati...</div></div>';
    
    this.load();
  },
  
  load: function() {
    var self = this;
    var headers = {'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY};
    
    Promise.all([
      fetch(SB + '/rest/v1/tesseramento_records?select=*&limit=10000', {headers: headers}).then(r => r.json()),
      fetch(SB + '/rest/v1/Anagrafiche?select=*&limit=10000', {headers: headers}).then(r => r.json()),
      fetch(SB + '/rest/v1/codiciateco?select=*&limit=10000', {headers: headers}).then(r => r.json())
    ])
    .then(function(res) {
      console.log('Dati ricevuti:', {t: typeof res[0], a: typeof res[1], c: typeof res[2]});
      console.log('Tesseramento:', res[0]);
      console.log('Anagrafiche:', res[1]);
      console.log('Codiciateco:', res[2]);
      self.processDati(res[0], res[1], res[2]);
    })
    .catch(function(err) {
      console.error('Errore:', err);
      var tab = G('tab-ateco');
      if (tab) tab.innerHTML = '<div style="padding:40px;color:red"><h2>Errore caricamento dati</h2><p>' + err.message + '</p></div>';
    });
  },
  
  processDati: function(tesseramento, anagrafiche, ateco) {
    // Assicurati che siano array
    if (!Array.isArray(tesseramento)) tesseramento = tesseramento ? [tesseramento] : [];
    if (!Array.isArray(anagrafiche)) anagrafiche = anagrafiche ? [anagrafiche] : [];
    if (!Array.isArray(ateco)) ateco = ateco ? [ateco] : [];
    
    console.log('Dopo conversione:', {t: tesseramento.length, a: anagrafiche.length, c: ateco.length});
    
    var anaMap = {}, atecoMap = {};
    
    // Costruisci mappa anagrafiche
    anagrafiche.forEach(function(a) {
      if (!a) return;
      var piva = a.partita_iva || a.Partita_IVA || a.PARTITA_IVA || '';
      if (piva) anaMap[piva] = a;
    });
    
    // Costruisci mappa ATECO
    ateco.forEach(function(a) {
      if (!a) return;
      var code = a.codiceateco || a.Codiceateco || a.CODICEATECO || '';
      if (code) atecoMap[code] = a;
    });
    
    console.log('Mappe create:', {ana: Object.keys(anaMap).length, ateco: Object.keys(atecoMap).length});
    
    // Elabora tesseramento_records
    this.allRecords = [];
    
    tesseramento.forEach(function(t) {
      if (!t) return;
      
      var piva = t.partita_iva || t.Partita_IVA || t.PARTITA_IVA || '';
      if (!piva) return;
      
      var ana = anaMap[piva];
      if (!ana) return;
      
      // Estrai sesso da CF
      var cf = ana.codice_fiscale_titolare || ana.CF || ana.Codice_Fiscale || '';
      var sesso = null;
      if (cf && cf.length >= 10) {
        var gg = parseInt(cf.substr(9, 2), 10);
        sesso = (gg >= 41) ? 'F' : (gg >= 1 && gg <= 31) ? 'M' : null;
      }
      
      // Estrai nazionalità (12° char = Z)
      var nazionalita = 'IT';
      if (cf && cf.length >= 12 && (cf.charAt(11) === 'Z' || cf.charAt(11) === 'z')) {
        nazionalita = 'ST';
      }
      
      // Estrai anno e mese
      var data = t.data_associazione || t.Data_Associazione || t.DATA_ASSOCIAZIONE || '';
      var parts = data.split('-');
      var anno = parts[0] || '';
      var mese = parts[1] || '';
      
      // Estrai unione e mestiere da ATECO
      var atecoCode = ana.codiceateco || ana.Codiceateco || ana.CODICEATECO || '';
      var atecoData = atecoMap[atecoCode] || {};
      
      var unione = atecoData.unione || atecoData.Unione || atecoData.UNIONE || 'N/D';
      var mestiere = atecoData.mestiere_denom || atecoData.Mestiere_Denom || atecoData.MESTIERE_DENOM || atecoData.mestiere || atecoData.Mestiere || 'N/D';
      
      this.allRecords.push({
        piva: piva,
        unione: unione,
        mestiere: mestiere,
        sesso: sesso,
        nazionalita: nazionalita,
        anno: anno,
        mese: mese
      });
    }.bind(this));
    
    console.log('Record elaborati:', this.allRecords.length);
    
    this.filtered = this.allRecords.slice();
    this.renderUI();
  },
  
  renderUI: function() {
    var tab = G('tab-ateco');
    if (!tab) return;
    
    var self = this;
    
    tab.innerHTML = `
      <div style="padding:20px">
        <!-- FILTRI -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">ANNO</label>
              <select id="ateco-anno" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">MESE DA</label>
              <select id="ateco-mese-da" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">MESE A</label>
              <select id="ateco-mese-a" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">SESSO</label>
              <select id="ateco-sesso" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                <option value="">Tutti</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">NAZIONALITÀ</label>
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
        
        <!-- KPI CARDS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          <div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(168,85,247,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px;font-weight:600">IMPRESE</div>
            <div style="font-size:32px;font-weight:700" id="ateco-kpi-imprese">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(249,115,22,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px;font-weight:600">UNIONI</div>
            <div style="font-size:32px;font-weight:700" id="ateco-kpi-unioni">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(16,185,129,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px;font-weight:600">MESTIERI</div>
            <div style="font-size:32px;font-weight:700" id="ateco-kpi-mestieri">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(236,72,153,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px;font-weight:600">DONNE</div>
            <div style="font-size:32px;font-weight:700" id="ateco-kpi-donne">0</div>
          </div>
        </div>
        
        <!-- GRAFICI -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #A855F7">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Distribuzione Unioni</h3>
            <canvas id="ateco-chart-unioni" style="height:300px"></canvas>
          </div>
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Top Mestieri</h3>
            <canvas id="ateco-chart-mestieri" style="height:300px"></canvas>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #EC4899">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Sesso Titolare</h3>
            <canvas id="ateco-chart-sesso" style="height:300px"></canvas>
          </div>
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #10B981">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Nazionalità</h3>
            <canvas id="ateco-chart-nazionalita" style="height:300px"></canvas>
          </div>
        </div>
        
        <!-- TABELLA UNIONI -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">
          <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Dettaglio Unioni</h3>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:rgba(168,85,247,0.1);border-bottom:2px solid var(--border)">
                  <th style="text-align:left;padding:12px;font-weight:700">Unione</th>
                  <th style="text-align:center;padding:12px;font-weight:700">Imprese</th>
                  <th style="text-align:center;padding:12px;font-weight:700">% Donne</th>
                  <th style="text-align:center;padding:12px;font-weight:700">% Stranieri</th>
                </tr>
              </thead>
              <tbody id="ateco-tbody-unioni"></tbody>
            </table>
          </div>
        </div>
        
        <!-- TABELLA MESTIERI -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316">
          <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Dettaglio Mestieri</h3>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:rgba(249,115,22,0.1);border-bottom:2px solid var(--border)">
                  <th style="text-align:left;padding:12px;font-weight:700">Mestiere</th>
                  <th style="text-align:center;padding:12px;font-weight:700">Imprese</th>
                  <th style="text-align:center;padding:12px;font-weight:700">% Donne</th>
                  <th style="text-align:center;padding:12px;font-weight:700">% Stranieri</th>
                </tr>
              </thead>
              <tbody id="ateco-tbody-mestieri"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.setupFilters();
    this.render();
  },
  
  setupFilters: function() {
    var anni = new Set(), mesi = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    this.allRecords.forEach(function(r) { if (r.anno) anni.add(r.anno); });
    
    var selAnno = G('ateco-anno');
    Array.from(anni).sort().forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      selAnno.appendChild(opt);
    });
    
    mesi.forEach(function(m) {
      ['ateco-mese-da', 'ateco-mese-a'].forEach(function(id) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        G(id).appendChild(opt);
      });
    });
    
    var self = this;
    [G('ateco-anno'), G('ateco-mese-da'), G('ateco-mese-a'), G('ateco-sesso'), G('ateco-nazionalita')].forEach(function(el) {
      if (el) el.addEventListener('change', function() { self.applyFilters(); });
    });
    
    var resetBtn = G('ateco-reset');
    if (resetBtn) resetBtn.addEventListener('click', function() { self.resetFilters(); });
  },
  
  applyFilters: function() {
    var anno = G('ateco-anno').value;
    var meseDa = G('ateco-mese-da').value;
    var meseA = G('ateco-mese-a').value;
    var sesso = G('ateco-sesso').value;
    var nazionalita = G('ateco-nazionalita').value;
    
    this.filtered = this.allRecords.filter(function(r) {
      return (!anno || r.anno === anno) &&
             (!meseDa || !r.mese || r.mese >= meseDa) &&
             (!meseA || !r.mese || r.mese <= meseA) &&
             (!sesso || r.sesso === sesso) &&
             (!nazionalita || r.nazionalita === nazionalita);
    });
    
    this.render();
  },
  
  resetFilters: function() {
    ['ateco-anno', 'ateco-mese-da', 'ateco-mese-a', 'ateco-sesso', 'ateco-nazionalita'].forEach(function(id) {
      var el = G(id);
      if (el) el.value = '';
    });
    this.filtered = this.allRecords.slice();
    this.render();
  },
  
  render: function() {
    var stats = this.calcStats();
    G('ateco-kpi-imprese').textContent = stats.imprese;
    G('ateco-kpi-unioni').textContent = stats.unioniUniche;
    G('ateco-kpi-mestieri').textContent = stats.mestieriUnici;
    G('ateco-kpi-donne').textContent = stats.donne;
    
    this.renderCharts(stats);
    this.renderTables(stats);
  },
  
  calcStats: function() {
    var pivaSet = new Set(), unioniSet = new Set(), mestieriSet = new Set();
    var unioni = {}, mestieri = {}, sesso = {M:0, F:0}, naz = {IT:0, ST:0};
    var donne = 0;
    
    this.filtered.forEach(function(r) {
      pivaSet.add(r.piva);
      if (r.sesso) sesso[r.sesso]++;
      if (r.sesso === 'F') donne++;
      naz[r.nazionalita]++;
      
      if (r.unione !== 'N/D') {
        unioniSet.add(r.unione);
        if (!unioni[r.unione]) unioni[r.unione] = {count:0, donne:0, stranieri:0};
        unioni[r.unione].count++;
        if (r.sesso === 'F') unioni[r.unione].donne++;
        if (r.nazionalita === 'ST') unioni[r.unione].stranieri++;
      }
      
      if (r.mestiere !== 'N/D') {
        mestieriSet.add(r.mestiere);
        if (!mestieri[r.mestiere]) mestieri[r.mestiere] = {count:0, donne:0, stranieri:0};
        mestieri[r.mestiere].count++;
        if (r.sesso === 'F') mestieri[r.mestiere].donne++;
        if (r.nazionalita === 'ST') mestieri[r.mestiere].stranieri++;
      }
    });
    
    return {imprese: pivaSet.size, unioniUniche: unioniSet.size, mestieriUnici: mestieriSet.size, donne: donne, unioni: unioni, mestieri: mestieri, sesso: sesso, naz: naz};
  },
  
  renderCharts: function(stats) {
    var self = this;
    var colors = ['#A855F7','#9333EA','#7E22CE','#6B21A8','#581C87','#9F1239','#BE123C','#DC2626','#EA580C','#F59E0B'];
    
    // Unioni
    var ctxU = G('ateco-chart-unioni');
    if (ctxU && typeof Chart !== 'undefined') {
      if (self.charts.u) self.charts.u.destroy();
      var uLabels = Object.keys(stats.unioni).sort(function(a,b) { return stats.unioni[b].count - stats.unioni[a].count; }).slice(0, 10);
      var uData = uLabels.map(function(k) { return stats.unioni[k].count; });
      self.charts.u = new Chart(ctxU, {
        type: 'doughnut',
        data: {labels: uLabels, datasets: [{data: uData, backgroundColor: colors, borderColor: 'var(--surface)', borderWidth: 2}]},
        options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)', font: {size: 11}}}}}
      });
    }
    
    // Mestieri
    var ctxM = G('ateco-chart-mestieri');
    if (ctxM && typeof Chart !== 'undefined') {
      if (self.charts.m) self.charts.m.destroy();
      var mLabels = Object.keys(stats.mestieri).sort(function(a,b) { return stats.mestieri[b].count - stats.mestieri[a].count; }).slice(0, 8);
      var mData = mLabels.map(function(k) { return stats.mestieri[k].count; });
      self.charts.m = new Chart(ctxM, {
        type: 'bar',
        data: {labels: mLabels, datasets: [{label: 'Imprese', data: mData, backgroundColor: '#F97316', borderRadius: 6}]},
        options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {x: {ticks: {color: 'var(--text-tertiary)'}}, y: {ticks: {color: 'var(--text-tertiary)'}}}}
      });
    }
    
    // Sesso
    var ctxS = G('ateco-chart-sesso');
    if (ctxS && typeof Chart !== 'undefined') {
      if (self.charts.s) self.charts.s.destroy();
      self.charts.s = new Chart(ctxS, {
        type: 'pie',
        data: {labels: ['Maschi', 'Femmine'], datasets: [{data: [stats.sesso.M || 0, stats.sesso.F || 0], backgroundColor: ['#06B6D4', '#EC4899'], borderColor: 'var(--surface)', borderWidth: 2}]},
        options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)', font: {size: 11}}}}}
      });
    }
    
    // Nazionalità
    var ctxN = G('ateco-chart-nazionalita');
    if (ctxN && typeof Chart !== 'undefined') {
      if (self.charts.n) self.charts.n.destroy();
      self.charts.n = new Chart(ctxN, {
        type: 'doughnut',
        data: {labels: ['Italiani', 'Stranieri'], datasets: [{data: [stats.naz.IT || 0, stats.naz.ST || 0], backgroundColor: ['#10B981', '#F59E0B'], borderColor: 'var(--surface)', borderWidth: 2}]},
        options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)', font: {size: 11}}}}}
      });
    }
  },
  
  renderTables: function(stats) {
    var tbodyU = G('ateco-tbody-unioni');
    if (tbodyU) {
      tbodyU.innerHTML = '';
      Object.keys(stats.unioni).sort(function(a,b) { return stats.unioni[b].count - stats.unioni[a].count; }).forEach(function(u) {
        var d = stats.unioni[u];
        var tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        var pD = ((d.donne / d.count) * 100).toFixed(1);
        var pS = ((d.stranieri / d.count) * 100).toFixed(1);
        tr.innerHTML = '<td style="padding:12px"><strong>' + u + '</strong></td><td style="text-align:center;padding:12px">' + d.count + '</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">' + pD + '%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">' + pS + '%</td>';
        tbodyU.appendChild(tr);
      });
    }
    
    var tbodyM = G('ateco-tbody-mestieri');
    if (tbodyM) {
      tbodyM.innerHTML = '';
      Object.keys(stats.mestieri).sort(function(a,b) { return stats.mestieri[b].count - stats.mestieri[a].count; }).forEach(function(m) {
        var d = stats.mestieri[m];
        var tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        var pD = ((d.donne / d.count) * 100).toFixed(1);
        var pS = ((d.stranieri / d.count) * 100).toFixed(1);
        tr.innerHTML = '<td style="padding:12px"><strong>' + m + '</strong></td><td style="text-align:center;padding:12px">' + d.count + '</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">' + pD + '%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">' + pS + '%</td>';
        tbodyM.appendChild(tr);
      });
    }
  }
};

document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-tab="tab-ateco"]');
  if (btn && !atecoTab.allRecords.length) atecoTab.init();
});
