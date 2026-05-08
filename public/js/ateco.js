/**
 * TAB ATECO - Unioni Mestieri e Raggruppamenti
 * Carica tesseramento_records + Anagrafiche + codiciateco e elabora i dati
 */

var atecoTab = {
  allData: [],
  filtered: [],
  charts: {},
  
  init: function() {
    var tab = G('tab-ateco');
    if (!tab) return;
    tab.innerHTML = '<div style="padding:40px;text-align:center"><div style="font-size:18px">📊 Caricamento dati in corso...</div></div>';
    this.load();
  },
  
  load: function() {
    var self = this;
    var headers = {'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY};
    
    // Carica i 3 dataset
    Promise.all([
      fetch(SB + '/rest/v1/tesseramento_records?select=*&limit=10000', {headers: headers}).then(r => r.json()),
      fetch(SB + '/rest/v1/Anagrafiche?select=*&limit=10000', {headers: headers}).then(r => r.json()),
      fetch(SB + '/rest/v1/codiciateco?select=*&limit=10000', {headers: headers}).then(r => r.json())
    ])
    .then(function(res) {
      console.log('✅ Tesseramento_records:', res[0].length);
      console.log('✅ Anagrafiche:', res[1].length);
      console.log('✅ Codiciateco:', res[2].length);
      
      self.processDati(res[0], res[1], res[2]);
    })
    .catch(function(err) {
      console.error('❌ Errore:', err);
      var tab = G('tab-ateco');
      if (tab) tab.innerHTML = '<div style="padding:40px;color:red"><h2>Errore</h2><p>' + err.message + '</p></div>';
    });
  },
  
  processDati: function(tesseramento, anagrafiche, ateco) {
    // Crea lookup tables
    var anaLookup = {};
    anagrafiche.forEach(function(a) {
      var piva = a.partita_iva || a.Partita_IVA || '';
      if (piva) anaLookup[piva] = a;
    });
    
    var atecoLookup = {};
    ateco.forEach(function(a) {
      var code = a.codiceateco || a.Codiceateco || '';
      if (code) atecoLookup[code] = a;
    });
    
    console.log('Ana lookup:', Object.keys(anaLookup).length);
    console.log('Ateco lookup:', Object.keys(atecoLookup).length);
    
    // Elabora tesseramento_records
    this.allData = [];
    
    tesseramento.forEach(function(t) {
      var piva = t.partita_iva || t.Partita_IVA || '';
      if (!piva) return;
      
      var ana = anaLookup[piva];
      if (!ana) return;
      
      // Estrai sesso da CF
      var cf = ana.codice_fiscale_titolare || ana.CF || '';
      var sesso = null;
      if (cf && cf.length >= 10) {
        var gg = parseInt(cf.substr(9, 2), 10);
        sesso = (gg >= 41) ? 'F' : (gg >= 1 && gg <= 31) ? 'M' : null;
      }
      
      // Estrai nazionalità
      var nazionalita = 'IT';
      if (cf && cf.length >= 12 && (cf.charAt(11) === 'Z' || cf.charAt(11) === 'z')) {
        nazionalita = 'ST';
      }
      
      // Estrai anno e mese
      var data = t.data_associazione || t.Data_Associazione || '';
      var parts = data.split('-');
      var anno = parts[0] || '';
      var mese = parts[1] || '';
      
      // Lookup ATECO
      var atecoCode = ana.codiceateco || ana.Codiceateco || '';
      var atecoData = atecoLookup[atecoCode] || {};
      
      this.allData.push({
        piva: piva,
        unione: atecoData.unione || atecoData.Unione || 'N/D',
        mestiere: atecoData.mestiere_denom || atecoData.Mestiere_Denom || 'N/D',
        sesso: sesso,
        nazionalita: nazionalita,
        anno: anno,
        mese: mese
      });
    }.bind(this));
    
    console.log('Record elaborati:', this.allData.length);
    
    this.filtered = this.allData.slice();
    this.buildUI();
  },
  
  buildUI: function() {
    var tab = G('tab-ateco');
    if (!tab) return;
    
    var self = this;
    
    tab.innerHTML = `
      <div style="padding:20px">
        <!-- FILTRI -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">ANNO</label>
              <select id="ateco-anno" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-size:13px">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">MESE DA</label>
              <select id="ateco-mese-da" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-size:13px">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">MESE A</label>
              <select id="ateco-mese-a" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-size:13px">
                <option value="">Tutti</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">SESSO</label>
              <select id="ateco-sesso" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-size:13px">
                <option value="">Tutti</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text-secondary)">NAZIONALITÀ</label>
              <select id="ateco-nazionalita" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-size:13px">
                <option value="">Tutti</option>
                <option value="IT">Italiano</option>
                <option value="ST">Straniero</option>
              </select>
            </div>
            <div style="display:flex;align-items:flex-end">
              <button id="ateco-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px">↻ Reset</button>
            </div>
          </div>
        </div>
        
        <!-- KPI CARDS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          <div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(168,85,247,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px">IMPRESE</div>
            <div style="font-size:32px;font-weight:700" id="kpi-imprese">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(249,115,22,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px">UNIONI</div>
            <div style="font-size:32px;font-weight:700" id="kpi-unioni">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(16,185,129,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px">MESTIERI</div>
            <div style="font-size:32px;font-weight:700" id="kpi-mestieri">0</div>
          </div>
          <div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:18px;border-radius:8px;text-align:center;box-shadow:0 4px 15px rgba(236,72,153,0.25)">
            <div style="font-size:11px;opacity:0.9;margin-bottom:6px">DONNE %</div>
            <div style="font-size:32px;font-weight:700" id="kpi-donne">0</div>
          </div>
        </div>
        
        <!-- GRAFICI -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #A855F7">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Unioni</h3>
            <canvas id="chart-unioni" style="height:280px"></canvas>
          </div>
          <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316">
            <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Top Mestieri</h3>
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
            <canvas id="chart-nazionalita" style="height:280px"></canvas>
          </div>
        </div>
        
        <!-- TABELLE -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">
          <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Unioni</h3>
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
              <tbody id="tbody-unioni"></tbody>
            </table>
          </div>
        </div>
        
        <div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316">
          <h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Mestieri</h3>
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
              <tbody id="tbody-mestieri"></tbody>
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
    this.allData.forEach(function(r) { if (r.anno) anni.add(r.anno); });
    
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
    
    this.filtered = this.allData.filter(function(r) {
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
    this.filtered = this.allData.slice();
    this.render();
  },
  
  render: function() {
    var stats = this.calcStats();
    G('kpi-imprese').textContent = stats.imprese;
    G('kpi-unioni').textContent = stats.unioniUniche;
    G('kpi-mestieri').textContent = stats.mestieriUnici;
    G('kpi-donne').textContent = stats.percentDonne.toFixed(1) + '%';
    
    this.drawCharts(stats);
    this.drawTables(stats);
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
    
    return {
      imprese: pivaSet.size,
      unioniUniche: unioniSet.size,
      mestieriUnici: mestieriSet.size,
      percentDonne: pivaSet.size > 0 ? (donne / pivaSet.size * 100) : 0,
      unioni: unioni,
      mestieri: mestieri,
      sesso: sesso,
      naz: naz
    };
  },
  
  drawCharts: function(stats) {
    var self = this, colors = ['#A855F7','#9333EA','#7E22CE','#6B21A8','#581C87','#9F1239','#BE123C','#DC2626','#EA580C','#F59E0B'];
    
    // Unioni
    if (G('chart-unioni')) {
      if (self.charts.u) self.charts.u.destroy();
      var uLabels = Object.keys(stats.unioni).sort(function(a,b) { return stats.unioni[b].count - stats.unioni[a].count; }).slice(0,10);
      var uData = uLabels.map(function(k) { return stats.unioni[k].count; });
      self.charts.u = new Chart(G('chart-unioni'), {
        type: 'doughnut', data: {labels: uLabels, datasets: [{data: uData, backgroundColor: colors, borderColor: 'var(--surface)', borderWidth: 2}]},
        options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)'}}}}
      });
    }
    
    // Mestieri
    if (G('chart-mestieri')) {
      if (self.charts.m) self.charts.m.destroy();
      var mLabels = Object.keys(stats.mestieri).sort(function(a,b) { return stats.mestieri[b].count - stats.mestieri[a].count; }).slice(0,8);
      var mData = mLabels.map(function(k) { return stats.mestieri[k].count; });
      self.charts.m = new Chart(G('chart-mestieri'), {
        type: 'bar', data: {labels: mLabels, datasets: [{label: 'Imprese', data: mData, backgroundColor: '#F97316', borderRadius: 6}]},
        options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {x: {ticks: {color: 'var(--text-tertiary)'}}, y: {ticks: {color: 'var(--text-tertiary)'}}}}
      });
    }
    
    // Sesso
    if (G('chart-sesso')) {
      if (self.charts.s) self.charts.s.destroy();
      self.charts.s = new Chart(G('chart-sesso'), {
        type: 'pie', data: {labels: ['Maschi', 'Femmine'], datasets: [{data: [stats.sesso.M || 0, stats.sesso.F || 0], backgroundColor: ['#06B6D4', '#EC4899'], borderColor: 'var(--surface)', borderWidth: 2}]},
        options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)'}}}}
      });
    }
    
    // Nazionalità
    if (G('chart-nazionalita')) {
      if (self.charts.n) self.charts.n.destroy();
      self.charts.n = new Chart(G('chart-nazionalita'), {
        type: 'doughnut', data: {labels: ['Italiani', 'Stranieri'], datasets: [{data: [stats.naz.IT || 0, stats.naz.ST || 0], backgroundColor: ['#10B981', '#F59E0B'], borderColor: 'var(--surface)', borderWidth: 2}]},
        options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom', labels: {color: 'var(--text)'}}}}
      });
    }
  },
  
  drawTables: function(stats) {
    var tbodyU = G('tbody-unioni');
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
    
    var tbodyM = G('tbody-mestieri');
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
  if (btn && !atecoTab.allData.length) atecoTab.init();
});
