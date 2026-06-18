// MediSavings - Supabase Config
// ΣΥΜΠΛΗΡΩΣΕ ΤΑ ΣΤΟΙΧΕΙΑ ΣΟΥ
const SUPABASE_URL = 'https://odtbtugzilxsfqxlpofq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ch-7C1ihpZRrxEhXFqV1xA_hXPwq61S';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ────────────────────────────────────────────────
function formatEuro(v) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
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
