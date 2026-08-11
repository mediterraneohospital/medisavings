// MediSavings - Form Logic
const params = new URLSearchParams(window.location.search);
const editId = params.get('id');

// ── Υπολογισμός οφέλους 2026 ─────────────────────────────
// Αν αγορές 2026 = 0 (καταργήθηκε): (αγορές 2025 νέο / 2) × (νέα τιμή ή παλιά αν νέα=0)
// Αν αγορές 2026 > 0 (κανονικό): αγορές 2026 × διαφορά τιμής
function calc2026(p2026, p2025n, p2025old, diff, np, op) {
  if (p2026 === 0) {
    // Καταργήθηκε: (συνολικές αγορές 2025) / 2 × (νέα τιμή ή παλιά αν νέα=0)
    const totalPurch2025 = (p2025n || 0) + (p2025old || 0);
    const price = (np > 0) ? np : op;
    return Math.round((totalPurch2025 / 2) * price * 100) / 100;
  }
  return Math.round(p2026 * diff * 100) / 100;
}

function recalc() {
  const op     = parseFloat(document.getElementById('old_price').value);
  const np     = parseFloat(document.getElementById('new_price').value) || 0;
  const p2025n   = parseFloat(document.getElementById('purchases_2025_new').value) || 0;
  const p2025old = parseFloat(document.getElementById('purchases_2025_old').value) || 0;
  const p2026raw = document.getElementById('purchases_2026_h1').value;
  const p2026    = p2026raw === '' ? null : parseFloat(p2026raw);

  const preview = document.getElementById('savingPreview');

  if (!isNaN(op) && op > 0) {
    preview.style.display = 'flex';

    const diff = op - np;
    const pct  = op > 0 ? diff / op : 0;

    document.getElementById('prevDiff').textContent = formatEuro(diff);
    document.getElementById('prevPct').textContent  = formatPct(pct);

    // Όφελος 2025
    const sfp = p2025n * diff;
    document.getElementById('prevSaving2025').textContent = formatEuro(sfp);

    // Όφελος 2026
    let sfp26 = null;
    let isDiscontinued = false;
    if (p2026 !== null) {
      sfp26 = calc2026(p2026, p2025n, p2025old, diff, np, op);
      isDiscontinued = p2026 === 0;
    }
    document.getElementById('prevSaving2026').textContent = sfp26 !== null ? formatEuro(sfp26) : '—';

    // Projected — μόνο αν ΔΕΝ είναι καταργημένο
    const projWrap = document.getElementById('prev_proj');
    if (isDiscontinued) {
      projWrap.style.display = 'none';
    } else {
      projWrap.style.display = '';
      document.getElementById('prevProjected').textContent = sfp26 !== null ? formatEuro(sfp26 * 2) : '—';
    }

    // Σύνολο
    const total = sfp + (sfp26 || 0);
    document.getElementById('prevSaving').textContent = formatEuro(total);
  } else {
    preview.style.display = 'none';
  }
}

['old_price','new_price','purchases_2025_new','purchases_2026_h1'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', recalc);
});

// ── Load for edit ─────────────────────────────────────────
async function loadForEdit(id) {
  document.getElementById('pageTitle').textContent = '✏️ Επεξεργασία Αλλαγής';
  document.getElementById('saveBtn').textContent   = '💾 Αποθήκευση Αλλαγών';

  const { data, error } = await db.from('material_changes').select('*').eq('id', id).single();
  if (error || !data) { showToast('Σφάλμα φόρτωσης', 'error'); return; }

  const fields = [
    'old_code','old_description','old_supplier','old_price',
    'new_code','new_description','new_supplier','new_price',
    'purchases_2024','purchases_2025_old','purchases_2025_new','purchases_2026_h1',
    'consumption_2024','consumption_2025','consumption_2026','consumption_2026_h1',
    'category','status','change_date','notes'
  ];

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && data[f] != null) el.value = data[f];
  });

  // Checkbox κατάργησης
  if (data.is_discontinued) {
    document.getElementById('is_discontinued').checked = true;
  }

  recalc();
}

// ── Save ─────────────────────────────────────────────────
async function saveRecord() {
  const old_code        = document.getElementById('old_code').value.trim();
  const old_description = document.getElementById('old_description').value.trim();
  const new_code        = document.getElementById('new_code').value.trim();
  const old_price       = parseFloat(document.getElementById('old_price').value);
  const new_price       = parseFloat(document.getElementById('new_price').value) || 0;

  if (!old_code || !old_description || !new_code) {
    showToast('Συμπλήρωσε τα υποχρεωτικά πεδία (*)', 'error'); return;
  }
  if (isNaN(old_price)) {
    showToast('Συμπλήρωσε την παλιά τιμή', 'error'); return;
  }

  const g = (id) => {
    const v = document.getElementById(id)?.value;
    if (v === '' || v == null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const diff    = old_price - new_price;
  const pct     = old_price > 0 ? diff / old_price : null;
  const p2025n  = g('purchases_2025_new');
  const p2026raw = document.getElementById('purchases_2026_h1').value;
  const p2026   = p2026raw === '' ? null : parseFloat(p2026raw);

  const p2025old = g('purchases_2025_old') || 0;
  const sfp   = p2025n != null ? p2025n * diff : null;
  const sfp26 = p2026  != null ? calc2026(p2026, p2025n || 0, p2025old, diff, new_price, old_price) : null;

  const record = {
    old_code, old_description, new_code,
    old_supplier:    document.getElementById('old_supplier').value.trim() || null,
    old_price,
    new_description: document.getElementById('new_description').value.trim() || null,
    new_supplier:    document.getElementById('new_supplier').value.trim() || null,
    new_price,
    price_diff:          diff,
    price_reduction_pct: pct,
    is_discontinued:     document.getElementById('is_discontinued').checked,
    purchases_2024:      g('purchases_2024'),
    purchases_2025_old:  g('purchases_2025_old'),
    purchases_2025_new:  p2025n,
    purchases_2026_h1:   p2026,
    consumption_2024:    g('consumption_2024'),
    consumption_2025:    g('consumption_2025'),
    consumption_2026:    g('consumption_2026'),
    consumption_2026_h1: g('consumption_2026_h1'),
    saving_from_purchases: sfp,
    saving_2026_h1:        sfp26,
    category:    document.getElementById('category').value || null,
    status:      document.getElementById('status').value || 'active',
    change_date: document.getElementById('change_date').value || null,
    notes:       document.getElementById('notes').value.trim() || null,
    updated_at:  new Date().toISOString(),
  };

  document.getElementById('saveBtn').disabled = true;
  document.getElementById('saveBtn').textContent = '⏳ Αποθήκευση...';

  let error;
  if (editId) {
    ({ error } = await db.from('material_changes').update(record).eq('id', editId));
  } else {
    ({ error } = await db.from('material_changes').insert(record));
  }

  if (error) {
    showToast('Σφάλμα: ' + error.message, 'error');
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('saveBtn').textContent = '💾 Αποθήκευση';
    return;
  }

  showToast(editId ? 'Αποθηκεύτηκε!' : 'Η αλλαγή καταχωρήθηκε!', 'success');
  setTimeout(() => window.location.href = 'index.html', 1200);
}

// ── Init ─────────────────────────────────────────────────
if (editId) loadForEdit(editId);
if (!editId) {
  document.getElementById('change_date').value = new Date().toISOString().split('T')[0];
}
