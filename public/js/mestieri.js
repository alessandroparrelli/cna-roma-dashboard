/**
 * Tab Unioni e Mestieri — Caricamento e gestione Unioni e Mestieri CNA
 */

var unioniData = [];
var unioniFiltered = [];
var mestieriData = [];
var mestieriFiltered = [];

function loadUnioniMestieri() {
  var loader = G('unioni-mestieri-loader');
  var content = G('unioni-mestieri-content');
  
  if (!loader || !content) return;
  
  // Mostra loader
  loader.classList.add('active');
  content.style.display = 'none';
  
  updateProgress('unioni-mestieri-progress', 0);
  updateStatus('unioni-status', 'Caricamento da Supabase…', false);
  updateStatus('mestieri-status', 'Caricamento da Supabase…', false);
  
  // Carica Unioni
  supabase
    .from('cna_unioni')
    .select('*')
    .order('denominazione', { ascending: true })
    .then(function(result) {
      if (result.error) throw result.error;
      
      unioniData = result.data || [];
      unioniFiltered = [...unioniData];
      
      updateProgress('unioni-mestieri-progress', 50);
      updateStatus('unioni-status', unioniData.length + ' unioni caricate', true);
      updateUnioniTable();
      
      // Carica Mestieri
      return supabase
        .from('cna_mestieri')
        .select('*')
        .order('denominazione', { ascending: true });
    })
    .then(function(result) {
      if (result.error) throw result.error;
      
      mestieriData = result.data || [];
      mestieriFiltered = [...mestieriData];
      
      updateProgress('unioni-mestieri-progress', 100);
      updateStatus('mestieri-status', mestieriData.length + ' mestieri caricati', true);
      
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
      
      updateMestieriTable();
      
      // Nascondi loader dopo 1 secondo
      setTimeout(function() {
        loader.classList.remove('active');
        content.style.display = 'block';
      }, 1000);
      
    })
    .catch(function(err) {
      console.error('Errore caricamento unioni/mestieri:', err);
      updateStatus('unioni-status', 'Errore: ' + err.message, false);
      updateStatus('mestieri-status', 'Errore: ' + err.message, false);
      setTimeout(function() {
        loader.classList.remove('active');
        content.style.display = 'block';
      }, 2000);
    });
}

function updateUnioniTable() {
  var tbody = G('unioni-tbody');
  if (!tbody) return;
  
  // Aggiorna conteggio
  G('unioni-count').textContent = unioniFiltered.length + ' unioni';
  G('unioni-info-text').textContent = 'Visualizzando ' + unioniFiltered.length + ' unioni su ' + unioniData.length + ' totali';
  
  // Svuota tabella
  tbody.innerHTML = '';
  
  if (unioniFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="ana-empty">Nessuna unione trovata</td></tr>';
    return;
  }
  
  // Popola tabella
  unioniFiltered.forEach(function(unione) {
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${unione.codice || '–'}</strong></td>
      <td><strong>${unione.denominazione || '–'}</strong></td>
      <td>${unione.provincia || '–'}</td>
      <td>${unione.email || '–'}</td>
      <td>${unione.telefono || '–'}</td>
      <td>${unione.note || '–'}</td>
    `;
    tbody.appendChild(tr);
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

function filterUnioni() {
  var search = G('unioni-search').value.toLowerCase();
  
  unioniFiltered = unioniData.filter(function(u) {
    var matchSearch = !search || 
      (u.codice && u.codice.toLowerCase().includes(search)) ||
      (u.denominazione && u.denominazione.toLowerCase().includes(search)) ||
      (u.provincia && u.provincia.toLowerCase().includes(search));
    
    return matchSearch;
  });
  
  updateUnioniTable();
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
  // Quando tab unioni-mestieri diventa attivo
  var tab = G('tab-unioni-mestieri');
  if (tab) {
    // Carica dati al primo click
    var loaded = false;
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-tab="tab-unioni-mestieri"]');
      if (btn && !loaded) {
        loadUnioniMestieri();
        loaded = true;
      }
    });
    
    // Listener per filtri unioni
    var uniSearch = G('unioni-search');
    var uniReset = G('unioni-reset');
    
    if (uniSearch) uniSearch.addEventListener('input', filterUnioni);
    if (uniReset) uniReset.addEventListener('click', function() {
      if (uniSearch) uniSearch.value = '';
      filterUnioni();
    });
    
    // Listener per filtri mestieri
    var mesSearch = G('mestieri-search');
    var mesCategoria = G('mestieri-categoria');
    var mesReset = G('mestieri-reset');
    
    if (mesSearch) mesSearch.addEventListener('input', filterMestieri);
    if (mesCategoria) mesCategoria.addEventListener('change', filterMestieri);
    if (mesReset) mesReset.addEventListener('click', function() {
      if (mesSearch) mesSearch.value = '';
      if (mesCategoria) mesCategoria.value = '';
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
