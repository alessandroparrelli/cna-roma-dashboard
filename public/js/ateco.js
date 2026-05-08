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
    
    tab.innerHTML = '<div style="padding:40px 20px;text-align:center"><div style="font-size:20px;margin-bottom:20px">⏳ Caricamento...</div></div>';
    
    console.log('🔄 Inizio caricamento ATECO...');
    console.log('KEY disponibile?', typeof KEY !== 'undefined');
    console.log('SB disponibile?', typeof SB !== 'undefined');
    
    // Carica i dati - usa le variabili globali KEY e SB
    var headers = {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY
    };
    
    var self = this;
    
    Promise.all([
      fetch(SB + '/rest/v1/tesseramento_records?select=*', {headers: headers}).then(r => {
        console.log('tesseramento_records status:', r.status);
        if (!r.ok) throw new Error('tesseramento_records: ' + r.status);
        return r.json();
      }),
      fetch(SB + '/rest/v1/Anagrafiche?select=*', {headers: headers}).then(r => {
        console.log('Anagrafiche status:', r.status);
        if (!r.ok) throw new Error('Anagrafiche: ' + r.status);
        return r.json();
      }),
      fetch(SB + '/rest/v1/codiciateco?select=*', {headers: headers}).then(r => {
        console.log('codiciateco status:', r.status);
        if (!r.ok) throw new Error('codiciateco: ' + r.status);
        return r.json();
      })
    ])
    .then(function(res) {
      console.log('✅ Dati caricati:', {
        contratti: res[0].length,
        anagrafiche: res[1].length,
        ateco: res[2].length
      });
      self.processDati(res[0], res[1], res[2]);
    })
    .catch(function(err) {
      console.error('❌ Errore:', err);
      tab.innerHTML = '<div style="padding:40px 20px;text-align:center;color:red"><h3>Errore caricamento</h3><p>' + err.message + '</p></div>';
    });
  },
  
  processDati: function(contratti, anagrafiche, ateco) {
    var anaMap = {};
    anagrafiche.forEach(function(a) {
      var piva = a.partita_iva || a.Partita_IVA || a.PARTITA_IVA || '';
      if (piva) anaMap[piva] = a;
    });
    
    var atecoMap = {};
    ateco.forEach(function(a) {
      var code = a.codiceateco || a.Codiceateco || a.CODICEATECO || '';
      if (code) atecoMap[code] = a;
    });
    
    var unioni = {}, mestieri = {}, sesso = {M:0, F:0}, naz = {IT:0, ST:0};
    var totali = { imprese: 0, donne: 0 };
    var pivas = new Set();
    
    contratti.forEach(function(c) {
      var piva = c.partita_iva || c.Partita_IVA || c.PARTITA_IVA || '';
      if (!piva) return;
      
      var ana = anaMap[piva];
      if (!ana) return;
      
      pivas.add(piva);
      
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
      
      var n = (cf && cf.length >= 12 && cf.charAt(11) === 'Z') ? 'ST' : 'IT';
      naz[n]++;
      
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
    this.render(totali, unioni, mestieri, sesso, naz);
  },
  
  render: function(totali, unioni, mestieri, sesso, naz) {
    var html = '<div style="padding:20px">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:30px">';
    html += '<div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:20px;border-radius:8px;text-align:center"><div style="font-size:12px;opacity:0.9">Imprese</div><div style="font-size:28px;font-weight:700">' + totali.imprese + '</div></div>';
    html += '<div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:20px;border-radius:8px;text-align:center"><div style="font-size:12px;opacity:0.9">Unioni</div><div style="font-size:28px;font-weight:700">' + Object.keys(unioni).length + '</div></div>';
    html += '<div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:20px;border-radius:8px;text-align:center"><div style="font-size:12px;opacity:0.9">Mestieri</div><div style="font-size:28px;font-weight:700">' + Object.keys(mestieri).length + '</div></div>';
    html += '<div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:20px;border-radius:8px;text-align:center"><div style="font-size:12px;opacity:0.9">Donne</div><div style="font-size:28px;font-weight:700">' + totali.donne + '</div></div>';
    html += '</div>';
    
    html += '<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:30px">';
    html += '<h3 style="margin:0 0 15px 0">Statistiche</h3>';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0"><strong>Maschi:</strong></td><td style="padding:10px 0;text-align:right">' + (sesso.M || 0) + '</td></tr>';
    html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0"><strong>Femmine:</strong></td><td style="padding:10px 0;text-align:right">' + (sesso.F || 0) + '</td></tr>';
    html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0"><strong>Italiani:</strong></td><td style="padding:10px 0;text-align:right">' + (naz.IT || 0) + '</td></tr>';
    html += '<tr><td style="padding:10px 0"><strong>Stranieri:</strong></td><td style="padding:10px 0;text-align:right">' + (naz.ST || 0) + '</td></tr>';
    html += '</table></div>';
    
    html += '<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:30px">';
    html += '<h3 style="margin:0 0 15px 0">Top Unioni</h3>';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr style="border-bottom:2px solid var(--border)"><th style="text-align:left;padding:10px 0">Unione</th><th style="text-align:right;padding:10px 0">Imprese</th></tr></thead>';
    html += '<tbody>';
    
    var unioniSorted = Object.entries(unioni).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
    unioniSorted.forEach(function(item) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0">' + item[0] + '</td><td style="text-align:right;padding:8px 0"><strong>' + item[1] + '</strong></td></tr>';
    });
    
    html += '</tbody></table></div>';
    
    html += '<div style="background:var(--surface);padding:20px;border-radius:8px">';
    html += '<h3 style="margin:0 0 15px 0">Top Mestieri</h3>';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr style="border-bottom:2px solid var(--border)"><th style="text-align:left;padding:10px 0">Mestiere</th><th style="text-align:right;padding:10px 0">Imprese</th></tr></thead>';
    html += '<tbody>';
    
    var mestieriSorted = Object.entries(mestieri).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
    mestieriSorted.forEach(function(item) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0">' + item[0] + '</td><td style="text-align:right;padding:8px 0"><strong>' + item[1] + '</strong></td></tr>';
    });
    
    html += '</tbody></table></div></div>';
    
    var tab = G('tab-ateco');
    if (tab) tab.innerHTML = html;
  }
};

// Trigger al click
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-tab="tab-ateco"]');
  if (btn) atecoTab.load();
});
