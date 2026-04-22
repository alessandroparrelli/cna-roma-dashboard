// Funzioni di utilità globali
import { SB, KEY } from './config.js';

function H() {
  return {
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'apikey': KEY
  };
}

async function fetchJSON(url, options = {}) {
  const resp = await fetch(url, { ...options, headers: { ...H(), ...options.headers } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function formatDate(date) {
  if (!date) return 'N.D.';
  return new Date(date).toLocaleDateString('it-IT');
}

export { H, fetchJSON, formatDate, SB };
