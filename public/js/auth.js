// Gestione autenticazione e permessi
import { SB, H } from './utils.js';

let currentSession = null;
let currentUser = null;

async function login(email, password) {
  try {
    const resp = await fetch(SB + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oYWh1cWxmenFja2FldmFmZmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODI4NzQsImV4cCI6MjA4OTc1ODg3NH0.MG1N3UUIfISDAi_ArFjxN6ZlHJfk5D77vSeE7qZr020' },
      body: JSON.stringify({ email, password })
    });
    if (resp.ok) {
      currentSession = await resp.json();
      currentUser = { email };
      localStorage.setItem('session', JSON.stringify(currentSession));
      return true;
    }
  } catch(e) {
    console.error('❌ Login error:', e);
  }
  return false;
}

function logout() {
  currentSession = null;
  currentUser = null;
  localStorage.removeItem('session');
}

function hasPermission(perm) {
  return currentSession && currentUser;
}

export { login, logout, hasPermission };
