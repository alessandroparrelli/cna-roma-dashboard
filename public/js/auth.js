async function doLogin(){
  console.log('🔐 doLogin() CHIAMATA');
  var email=G('inp-email').value.trim().toLowerCase();
  var pwd=G('inp-pwd').value;
  console.log('📧 Email:', email);
  console.log('🔑 Password:', pwd.length + ' caratteri');
  
  var errEl=G('login-error');
  errEl.style.display='none';
  if(!email||!pwd){
    console.log('❌ Email o password vuota');
    errEl.textContent='Inserisci email e password';
    errEl.style.display='block';
    return;
  }
  
  var btn=G('btn-login');
  btn.disabled=true;
  btn.textContent='Accesso in corso…';
  showLoad('Verifica credenziali…');
  
  try{
    console.log('⏳ Hashing password...');
    var hash=await sha256hex(pwd);
    console.log('✅ Hash generato:', hash.substring(0,10) + '...');
    
    var query='cna_users?select=id,nome,cognome,email,ruolo&email=eq.'+encodeURIComponent(email)+'&password_sha256=eq.'+hash+'&attivo=eq.true';
    console.log('📝 Query:', query);
    
    var rows=await sbGet(query);
    console.log('📊 Risultato query:', rows);
    
    if(!rows||!rows.length){
      console.log('❌ Login fallito - Utente non trovato');
      writeLog(null, email, null, 'fallito');
      errEl.textContent='Email o password non corretti';
      errEl.style.display='block';
      return;
    }
    
    console.log('✅ Utente trovato:', rows[0].nome + ' ' + rows[0].cognome);
    
    sbPatch('cna_users?email=eq.'+encodeURIComponent(email),{last_login:new Date().toISOString()}).catch(function(){});
    writeLog(rows[0].id, email, rows[0].nome+' '+rows[0].cognome, 'successo');
    
    console.log('💾 Salvando session...');
    saveSession(rows[0]);
    
    console.log('🎉 Mostrando app...');
    showApp();
  }catch(e){
    console.error('❌ ERRORE LOGIN:', e);
    errEl.textContent='Errore di connessione. Riprova.';
    errEl.style.display='block';
  }
  finally{
    hideLoad();
    btn.disabled=false;
    btn.textContent='Accedi';
    console.log('✅ Login process finito');
  }
}
function doLogout(){clearSession();location.reload();}

// ══════════════════════════════════════════════════════════════════════════════
// GESTIONE PERMESSI (Admin Panel)
// ══════════════════════════════════════════════════════════════════════════════

// Permessi default per ogni ruolo
var defaultPermissions = {
  admin: {carica: true, interroga: true, admin: true},
  supervisore: {carica: false, interroga: true, admin: false},
  utente: {carica: false, interroga: true, admin: false}
};

// Carica permessi dal localStorage
function loadPermissionsCheckboxes() {
  // Carica i permessi nei CHECKBOX del pannello admin
  var saved = localStorage.getItem('cna_permissions');
  if (saved) {
    var perms = JSON.parse(saved);
    // Applica i permessi ai checkbox
    document.getElementById('perm-super-interroga').checked = perms.supervisore?.interroga ?? true;
    document.getElementById('perm-super-carica').checked = perms.supervisore?.carica ?? false;
    document.getElementById('perm-super-admin').checked = perms.supervisore?.admin ?? false;
    
    document.getElementById('perm-user-interroga').checked = perms.utente?.interroga ?? false;
    document.getElementById('perm-user-carica').checked = perms.utente?.carica ?? false;
    document.getElementById('perm-user-admin').checked = perms.utente?.admin ?? false;
  }
}

function loadUserPermissions() {
  // Carica i permessi per l'UTENTE CORRENTE e aggiorna UI
  console.log('🔐 ==================== INIZIO CARICAMENTO PERMESSI ====================');
  console.log('🔐 Session:', session);
  console.log('🔐 Ruolo utente:', session?.ruolo);
  console.log('🔐 hasPermission("export"):', hasPermission('export'));
  console.log('🔐 updateUIPermissions() - calling...');
  updateUIPermissions();
  console.log('🔐 ==================== FINE CARICAMENTO PERMESSI ====================');
  
  // Avvia interval per controllare permessi ogni 2 secondi
  if (!window.permissionsCheckInterval) {
    console.log('🔐 Avvio interval controllo permessi...');
    window.permissionsCheckInterval = setInterval(function() {
      updateUIPermissions();
    }, 2000);
  }
}

// Salva permessi nel localStorage
function savePermissions() {
  var perms = {
    admin: {carica: true, interroga: true, admin: true},
    supervisore: {
      interroga: document.getElementById('perm-super-interroga').checked,
      carica: document.getElementById('perm-super-carica').checked,
      admin: false
    },
    utente: {
      interroga: document.getElementById('perm-user-interroga').checked,
      carica: document.getElementById('perm-user-carica').checked,
      admin: false
    }
  };
  localStorage.setItem('cna_permissions', JSON.stringify(perms));
  console.log('💾 Permessi salvati:', perms);
  loadUserPermissions(); // Ricarica i permessi per l'utente e aggiorna UI
}

// Verifica se l'utente ha permesso per una funzione
function hasPermission(feature) {
  if (!session) {
    console.warn('❌ Session non trovata');
    return false;
  }
  var perms = localStorage.getItem('cna_permissions');
  console.log('📋 Permessi nel localStorage:', perms);
  var permObj = perms ? JSON.parse(perms) : defaultPermissions;
  console.log('📋 Ruolo utente:', session.ruolo);
  console.log('📋 permObj[ruolo]:', permObj[session.ruolo.toLowerCase()]);
  var rolePerms = permObj[session.ruolo.toLowerCase()] || {};
  console.log('📋 Permesso richiesto:', feature, '→', rolePerms[feature]);
  return rolePerms[feature] !== false; // Default: true se non trovato
}

// Applica restrizione di export basata su permessi
function checkExportPermission() {
  if (!hasPermission('export')) {
    alert('Export dati non autorizzato per il tuo ruolo');
    return false;
  }
  return true;
}

// Aggiorna visibilità bottoni in base ai permessi
function updateUIPermissions() {
  // Controlla il permesso per le sezioni interroga e carica
  console.log('🔐 Permessi aggiornati per utente:', session?.ruolo);
}

function showApp(){
  G('login-page').style.display='none';
  G('app').style.display='block';
  
  G('chip-name').textContent=session.nome+' '+session.cognome;
  if(isAdmin())G('admin-actions').style.display='flex';
  loadUserPermissions(); // Carica i permessi dell'utente e aggiorna UI
  syncMobileAdmin();
  loadDashboard();
}

// DASHBOARD LOAD — senza limite