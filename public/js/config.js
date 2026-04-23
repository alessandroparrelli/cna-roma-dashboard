var SB='https://ohahuqlfzqckaevaffbt.supabase.co';
var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oYWh1cWxmenFja2FldmFmZmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODI4NzQsImV4cCI6MjA4OTc1ODg3NH0.MG1N3UUIfISDAi_ArFjxN6ZlHJfk5D77vSeE7qZr020';
var session=null;
var allData=[];
var anaFiltered=[];
var currentAnaIdx=0;
var currentCCIAAData=null;
var TR='tesseramento_records';
var MESI=['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
var COLORS_PROMO=['#2563EB','#EA580C','#0D9488','#7C3AED','#CA8A04','#DC2626','#059669','#0284C7','#C2410C','#9333EA'];
var charts={},sortState={};

// SHA-256
async function sha256hex(s){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}

// SESSION
function saveSession(u){session=u;sessionStorage.setItem('cna_s',JSON.stringify(u));}
function loadSession(){try{var s=sessionStorage.getItem('cna_s');if(s)session=JSON.parse(s);}catch(e){}return session;}
function clearSession(){session=null;sessionStorage.removeItem('cna_s');}

// RUOLI E AUTORIZZAZIONI
function isAdmin(){return session&&session.ruolo==='admin';}
function isSupervisore(){return session&&session.ruolo==='supervisore';}
function isUser(){return session&&session.ruolo==='utente';}
function userRole(){return session?session.ruolo:'guest';}
function canAccessTab(tabId){
  if(!session) return false;
  var role = session.ruolo;
  
  console.log('canAccessTab:', tabId, 'role:', role);
  
  // Admin: accesso a tutto
  if(role==='admin') {
    console.log('Admin access granted to', tabId);
    return true;
  }
  
  // Supervisore: overview, promotori, anagrafiche (NO import, NO admin panel)
  if(role==='supervisore') return tabId === 'tab-overview' || tabId === 'tab-promotori' || tabId === 'tab-anagrafiche';
  
  // Utente: overview, promotori, anagrafiche (interroga archivio)
  if(role==='utente') return tabId === 'tab-overview' || tabId === 'tab-promotori' || tabId === 'tab-anagrafiche';
  
  console.log('Access denied to', tabId, 'for role', role);
  return false;
}
function canAccessPanel(panel){
  if(!session) return false;
  var role = session.ruolo;
  
  // Admin: accesso a tutto
  if(role==='admin') return true;
  
  // Supervisore: pannello anagrafiche e log
  if(role==='supervisore') return panel === 'anagrafiche' || panel === 'logs';
  
  // Utente: nulla
  return false;
}

// SUPABASE
function H(ex){return Object.assign({'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY},ex||{});}
async function sbGet(p){var r=await fetch(SB+'/rest/v1/'+p,{headers:H()});if(!r.ok)throw new Error('GET '+r.status);return r.json();}
// Fetch ALL records using Range pagination - no limit
async function sbGetAll(table){
  var all=[],page=0,size=1000;
  while(true){
    var from=page*size,to=from+size-1;
    var r=await fetch(SB+'/rest/v1/'+table+'?select=*&order=created_at.asc',{headers:H({'Range':from+'-'+to,'Prefer':'count=exact'})});
    if(!r.ok)throw new Error('GET '+r.status);
    var rows=await r.json();
    all=all.concat(rows);
    if(rows.length<size)break;
    page++;
  }
  return all;
}
async function sbPost(p,b,ex){var r=await fetch(SB+'/rest/v1/'+p,{method:'POST',headers:H(ex),body:JSON.stringify(b)});if(!r.ok){var t=await r.text();throw new Error(t);}return r;}
async function sbPatch(p,b){var r=await fetch(SB+'/rest/v1/'+p,{method:'PATCH',headers:H({'Prefer':'return=minimal'}),body:JSON.stringify(b)});if(!r.ok)throw new Error('PATCH '+r.status);}
async function sbDel(p){var r=await fetch(SB+'/rest/v1/'+p,{method:'DELETE',headers:H()});if(!r.ok)throw new Error('DEL '+r.status);}
async function dbCount(){var r=await fetch(SB+'/rest/v1/'+TR+'?select=id',{headers:H({'Prefer':'count=exact','Range':'0-0'})});var cr=r.headers.get('content-range');return cr?parseInt(cr.split('/')[1])||0:0;}

// UI
function showLoad(m){document.getElementById('loading-msg').textContent=m||'Caricamento…';document.getElementById('loading-overlay').style.display='flex';}
function hideLoad(){document.getElementById('loading-overlay').style.display='none';}
function toast(m,t){var el=document.getElementById('toast');el.textContent=m;el.className='show'+(t?' '+t:'');clearTimeout(el._t);el._t=setTimeout(function(){el.className='';},3500);}
function G(id){return document.getElementById(id);}
function fmt(n,d){if(d===undefined)d=2;return Number(n).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d});}

// LOGIN