// MediSavings - Supabase Config
// ΣΥΜΠΛΗΡΩΣΕ ΤΑ ΣΤΟΙΧΕΙΑ ΣΟΥ
const SUPABASE_URL = 'https://odtbtugzilxsfqxlpofq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ch-7C1ihpZRrxEhXFqV1xA_hXPwq61S';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ────────────────────────────────────────────────
function formatEuro(v) {
  if (v == null || isNaN(v)) return '—';
  // Έλεγχος αν χρειάζονται περισσότερα δεκαδικά (π.χ. 0.028 αντί 0.03)
  const num = parseFloat(v);
  const rounded2 = Math.round(num * 100) / 100;
  let decimals = 2;
  if (Math.abs(num - rounded2) > 0.0001) {
    // Βρες πόσα δεκαδικά χρειάζονται (max 4)
    for (let d = 3; d <= 4; d++) {
      const roundedD = Math.round(num * Math.pow(10, d)) / Math.pow(10, d);
      if (Math.abs(num - roundedD) < 0.00001) { decimals = d; break; }
      decimals = 4;
    }
  }
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
}
function formatPct(v) {
  if (v == null || isNaN(v)) return '—';
  return (v * 100).toFixed(1) + '%';
}
function formatNum(v) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('el-GR').format(v);
}

function showToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

function statusBadge(s) {
  const map = { active: ['badge-active','Ενεργό'], discontinued: ['badge-discontinued','Ανενεργό'], pending: ['badge-pending','Εκκρεμεί'] };
  const [cls, label] = map[s] || ['badge-pending', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Αποτροπή αλλαγής τιμής με scroll σε number inputs
document.addEventListener('wheel', function(e) {
  if (document.activeElement && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: false });
