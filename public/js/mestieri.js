/**
 * Tab Mestieri — Caricamento e gestione mestieri CNA
 */

var mestieriData = [];
var mestieriFiltered = [];

function loadMestieri() {
  var loader = G('mestieri-loader');
  var content = G('mestieri-content');
  
  if (!loader || !content) return;
  
  // Mostra loader
  loader.classList.add('active');
  content.style.display = 'none';
  
  updateProgress('mestieri-progress', 0);
  updateStatus('mestieri-status-load', 'Caricamento da Supabase…', false);
  
  // Carica da Supabase
  supabase
    .from('cna_mestieri')
    .select('*')
    .order('denominazione', { ascending: true })
    .then(function(result) {
      if (result.error) throw result.error;
      
      mestieriData = result.data || [];
      mestieriFiltered = [...mestieriData];
      
      updateProgress('mestieri-progress', 100);
      updateStatus('mestieri-status-load', mestieriData.length + ' mestieri caricati', true);
      
      // Popola categorie
      var categorie = [...new Set(mestieriData.map(m => m.categoria).filter(Boolean))].sort();
      var selectCat = G('mestieri-categoria');
      if (selectCat) {
        categorie.forEach(cat => {
          var opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          selectCat.appendChild(opt);
        });
      }
      
      // Aggiorna tabella
      updateMestieriTable();
      
      // Nascondi loader dopo 1 secondo
      setTimeout(function() {
        loader.classList.remove('active');
        content.style.display = 'block';
      }, 1000);
      
    })
    .catch(function(err) {
      console.error('Errore caricamento mestieri:', err);
      updateStatus('mestieri-status-load', 'Errore: ' + err.message, false);
      setTimeout(function() {
        loader.classList.remove('active');
        content.style.display = 'block';
      }, 2000);
    });
}

function updateMestieriTable() {
  var tbody = G('mestieri-tbody');
  if (!tbody) return;
  
  // Aggiorna conteggio
  G('mestieri-count').textContent = mestieriFiltered.length + ' mestieri';
  G('mestieri-info-text').textContent = 'Visualizzando ' + mestieriFiltered.length + ' mestieri su ' + mestieriData.length + ' totali';
  
  // Svuota tabella
  tbody.innerHTML = '';
  
  if (mestieriFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="ana-empty">Nessun mestiere trovato</td></tr>';
    return;
  }
  
  // Popola tabella
  mestieriFiltered.forEach(function(mestiere) {
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${mestiere.codice || '–'}</strong></td>
      <td><strong>${mestiere.denominazione || '–'}</strong></td>
      <td>${mestiere.categoria || '–'}</td>
      <td>${mestiere.sottocategoria || '–'}</td>
      <td>${mestiere.note || '–'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterMestieri() {
  var search = G('mestieri-search').value.toLowerCase();
  var categoria = G('mestieri-categoria').value;
  
  mestieriFiltered = mestieriData.filter(function(m) {
    var matchSearch = !search || 
      (m.codice && m.codice.toLowerCase().includes(search)) ||
      (m.denominazione && m.denominazione.toLowerCase().includes(search));
    
    var matchCategoria = !categoria || m.categoria === categoria;
    
    return matchSearch && matchCategoria;
  });
  
  updateMestieriTable();
}

// Event listeners
window.addEventListener('load', function() {
  // Quando tab mestieri diventa attivo
  var mestieri_tab = G('tab-mestieri');
  if (mestieri_tab) {
    // Carica dati al primo click
    var loaded = false;
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-tab="tab-mestieri"]');
      if (btn && !loaded) {
        loadMestieri();
        loaded = true;
      }
    });
    
    // Listener per filtri
    var search = G('mestieri-search');
    var categoria = G('mestieri-categoria');
    var reset = G('mestieri-reset');
    
    if (search) search.addEventListener('input', filterMestieri);
    if (categoria) categoria.addEventListener('change', filterMestieri);
    if (reset) reset.addEventListener('click', function() {
      if (search) search.value = '';
      if (categoria) categoria.value = '';
      filterMestieri();
    });
  }
});

function updateProgress(id, percent) {
  var el = G(id);
  if (el) el.style.width = percent + '%';
}

function updateStatus(id, msg, success) {
  var el = G(id);
  if (el) {
    el.querySelector('.ana-sval').textContent = msg;
    if (success) {
      el.style.opacity = '0.7';
      el.querySelector('.ana-sval').style.color = '#10B981';
    }
  }
}
