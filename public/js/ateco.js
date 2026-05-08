/**
 * TAB ATECO - Analisi Unioni e Mestieri dai contratti
 */

var atecoTab = {
  loaded: false,
  
  load: function() {
    if (this.loaded) return;
    this.loaded = true;
    
    var tab = G('tab-ateco');
    if (!tab) return;
    
    // Mostra loading
    tab.innerHTML = '<div style="padding:40px 20px;text-align:center"><div style="font-size:20px;margin-bottom:20px">⏳ Caricamento...</div></div>';
    
    console.log('🔄 Inizio caricamento dati ATECO...');
    
    // Carica i dati
    Promise.all([
      sbGetAll('tesseramento_records'),
      sbGetAll('Anagrafiche'),
      sbGetAll('codiciateco')
    ])
    .then(res => {
      console.log('✅ Dati caricati:', {contratti: res[0].length, anagrafiche: res[1].length, ateco: res[2].length});
      this.processDati(res[0], res[1], res[2]);
    })
    .catch(err => {
      console.error('❌ Errore caricamento:', err);
      tab.innerHTML = '<div style="padding:40px 20px;text-align:center;color:red"><p>Errore: ' + (err.message || err) + '</p></div>';
    });
  },
  
  processDati: function(contratti, anagrafiche, ateco) {
    // Crea mappe
    var anaMap = {};
    anagrafiche.forEach(a => {
      var piva = a.partita_iva || a.Partita_IVA || a.PARTITA_IVA || '';
      if (piva) anaMap[piva] = a;
    });
    
    var atecoMap = {};
    ateco.forEach(a => {
      var code = a.codiceateco || a.Codiceateco || a.CODICEATECO || '';
      if (code) atecoMap[code] = a;
    });
    
    // Elabora dati
    var unioni = {}, mestieri = {}, sesso = {M:0, F:0}, naz = {IT:0, ST:0};
    var totali = { imprese: 0, donne: 0 };
    var pivas = new Set();
    
    contratti.forEach(c => {
      var piva = c.partita_iva || c.Partita_IVA || c.PARTITA_IVA || '';
      if (!piva) return;
      
      var ana = anaMap[piva];
      if (!ana) return;
      
      pivas.add(piva);
      
      // Estrai sesso da CF
      var cf = ana.codice_fiscale_titolare || ana.CF || ana.Codice_Fiscale || '';
      var s = null;
      if (cf && cf.length >= 10) {
        var gg = parseInt(cf.substr(9, 2), 10);
        s = (gg >= 41) ? 'F' : (gg >= 1 && gg <= 31) ? 'M' : null;
      }
      if (s) {
        sesso[s]++;
        if (s === 'F') totali.donne++;
      }
      
      // Estrai nazionalità da CF
      var n = (cf && cf.length >= 12 && cf.charAt(11) === 'Z') ? 'ST' : 'IT';
      naz[n]++;
      
      // Estrai unione e mestiere
      var atecoCode = ana.codiceateco || ana.Codiceateco || ana.CODICEATECO || '';
      var atecoData = atecoMap[atecoCode];
      
      if (atecoData) {
        var u = atecoData.unione || atecoData.Unione || atecoData.UNIONE || 'N/D';
        var m = atecoData.mestiere_denom || atecoData.Mestiere_Denom || atecoData.MESTIERE_DENOM || 'N/D';
        
        unioni[u] = (unioni[u] || 0) + 1;
        mestieri[m] = (mestieri[m] || 0) + 1;
      }
    });
    
    totali.imprese = pivas.size;
    
    // Renderizza
    this.render(totali, unioni, mestieri, sesso, naz);
  },
  
  render: function(totali, unioni, mestieri, sesso, naz) {
    var html = `
      <div style="padding:20px">
        <!-- KPI CARDS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:30px">
          <div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:20px;border-radius:8px;text-align:center">
            <div style="font-size:12px;opacity:0.9">Imprese</div>
            <div style="font-size:28px;font-weight:700">${totali.imprese}</div>
          </div>
          <div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:20px;border-radius:8px;text-align:center">
            <div style="font-size:12px;opacity:0.9">Unioni</div>
            <div style="font-size:28px;font-weight:700">${Object.keys(unioni).length}</div>
          </div>
          <div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:20px;border-radius:8px;text-align:center">
            <div style="font-size:12px;opacity:0.9">Mestieri</div>
            <div style="font-size:28px;font-weight:700">${Object.keys(mestieri).length}</div>
          </div>
          <div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:20px;border-radius:8px;text-align:center">
            <div style="font-size:12px;opacity:0.9">Donne</div>
            <div style="font-size:28px;font-weight:700">${totali.donne}</div>
          </div>
        </div>
        
        <!-- STATISTICHE -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:30px">
          <h3 style="margin:0 0 15px 0">Statistiche</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:10px 0"><strong>Maschi:</strong></td>
              <td style="padding:10px 0;text-align:right">${sesso.M || 0}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:10px 0"><strong>Femmine:</strong></td>
              <td style="padding:10px 0;text-align:right">${sesso.F || 0}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:10px 0"><strong>Italiani:</strong></td>
              <td style="padding:10px 0;text-align:right">${naz.IT || 0}</td>
            </tr>
            <tr>
              <td style="padding:10px 0"><strong>Stranieri:</strong></td>
              <td style="padding:10px 0;text-align:right">${naz.ST || 0}</td>
            </tr>
          </table>
        </div>
        
        <!-- TOP UNIONI -->
        <div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:30px">
          <h3 style="margin:0 0 15px 0">Top Unioni</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="text-align:left;padding:10px 0">Unione</th>
                <th style="text-align:right;padding:10px 0">Imprese</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(unioni).sort((a,b) => b[1]-a[1]).slice(0,10).map(([u,count]) => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 0">${u}</td>
                  <td style="text-align:right;padding:8px 0"><strong>${count}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- TOP MESTIERI -->
        <div style="background:var(--surface);padding:20px;border-radius:8px">
          <h3 style="margin:0 0 15px 0">Top Mestieri</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="text-align:left;padding:10px 0">Mestiere</th>
                <th style="text-align:right;padding:10px 0">Imprese</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(mestieri).sort((a,b) => b[1]-a[1]).slice(0,10).map(([m,count]) => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 0">${m}</td>
                  <td style="text-align:right;padding:8px 0"><strong>${count}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    var tab = G('tab-ateco');
    if (tab) tab.innerHTML = html;
  }
};

// Trigger quando clicchi il tab
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-tab="tab-ateco"]');
  if (btn) atecoTab.load();
});
