// MediSavings - Form Logic
const params = new URLSearchParams(window.location.search);
const editId = params.get('id');

// ── Τύπος αλλαγής ─────────────────────────────────────────
function getType() {
  return document.querySelector('input[name="change_type"]:checked')?.value || 'substitution';
}

function onTypeChange() {
  const isElim = getType() === 'elimination';

  // Toggle fields
  document.getElementById('field_purchases_2026_h1').style.display = isElim ? 'none' : '';
  document.getElementById('field_estimated_2026').style.display     = isElim ? '' : 'none';

  // Στυλ radio labels
  document.getElementById('lbl_elimination').style.borderColor  = isElim ? 'var(--red)'  : 'var(--gray-200)';
  document.getElementById('lbl_elimination').style.background   = isElim ? 'var(--red-light)' : 'white';

  // Νέο υλικό section τίτλος
  const newTitle = document.querySelector('.form-section-title:nth-of-type(2)');

  recalc();
}

// ── Recalculate ───────────────────────────────────────────
function recalc() {
  const op          = parseFloat(document.getElementById('old_price').value);
  const np          = parseFloat(document.getElementById('new_price').value);
  const purch2025n  = parseFloat(document.getElementById('purchases_2025_new').value);
  const isElim      = getType() === 'elimination';
  const qty2026     = isElim
    ? parseFloat(document.getElementById('estimated_consumption_2026_h1').value)
    : parseFloat(document.getElementById('purchases_2026_h1').value);

  const preview = document.getElementById('savingPreview');

  if (!isNaN(op) && !isNaN(np)) {
    preview.style.display = 'flex';

    const diff = op - np;
    const pct  = op > 0 ? diff / op : 0;

    document.getElementById('prevDiff').textContent = formatEuro(diff);
    document.getElementById('prevPct').textContent  = formatPct(pct);

    // Όφελος 2025
    const sfp = !isNaN(purch2025n) ? purch2025n * diff : null;
    document.getElementById('prevSaving2025').textContent = sfp != null ? formatEuro(sfp) : '—';

    // Όφελος 2026
    let sfp2026 = null;
    if (!isNaN(qty2026)) {
      sfp2026 = isElim ? qty2026 * np : qty2026 * diff;
    }
    const label2026 = isElim ? 'Εξοικονόμηση κατάργησης 2026 Α΄εξ.' : 'Όφελος Αγορών 2026 Α΄εξ.';
    document.getElementById('label2026').textContent = label2026;
    document.getElementById('prevSaving2026').textContent = sfp2026 != null ? formatEuro(sfp2026) : '—';

    // Σύνολο
    const total = (sfp || 0) + (sfp2026 || 0);
    document.getElementById('prevSaving').textContent = (sfp != null || sfp2026 != null) ? formatEuro(total) : '—';

    // Projected
    document.getElementById('prevProjected').textContent = sfp2026 != null ? formatEuro(sfp2026 * 2) : '—';
  } else {
    preview.style.display = 'none';
  }
}

['old_price','new_price','purchases_2025_new','purchases_2026_h1','estimated_consumption_2026_h1'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', recalc);
});

// ── Load for edit ─────────────────────────────────────────
async function loadForEdit(id) {
  document.getElementById('pageTitle').textContent = '✏️ Επεξεργασία Αλλαγής';
  document.getElementById('saveBtn').textContent = '💾 Αποθήκευση Αλλαγών';

  const { data, error } = await db.from('material_changes').select('*').eq('id', id).single();
  if (error || !data) { showToast('Σφάλμα φόρτωσης', 'error'); return; }

  // Τύπος
  const type = data.change_type || 'substitution';
  document.getElementById(type === 'elimination' ? 'type_elimination' : 'type_substitution').checked = true;
  onTypeChange();

  const fields = [
    'old_code','old_description','old_supplier','old_price',
    'new_code','new_description','new_supplier','new_price',
    'purchases_2024','purchases_2025_old','purchases_2025_new','purchases_2026_h1',
    'consumption_2024','consumption_2025','consumption_2026','consumption_2026_h1',
    'estimated_consumption_2026_h1','category','status','change_date','notes'
  ];

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && data[f] != null) el.value = data[f];
  });

  recalc();
}

// ── Save ─────────────────────────────────────────────────
async function saveRecord() {
  const old_code        = document.getElementById('old_code').value.trim();
  const old_description = document.getElementById('old_description').value.trim();
  const new_code        = document.getElementById('new_code').value.trim();
  const old_price       = parseFloat(document.getElementById('old_price').value);
  const new_price       = parseFloat(document.getElementById('new_price').value);
  const type            = getType();

  if (!old_code || !old_description || !new_code) {
    showToast('Συμπλήρωσε τα υποχρεωτικά πεδία (*)', 'error'); return;
  }
  if (isNaN(old_price) || isNaN(new_price)) {
    showToast('Συμπλήρωσε παλιά και νέα τιμή', 'error'); return;
  }

  const g = (id) => {
    const v = document.getElementById(id)?.value;
    if (!v || v.trim() === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? v.trim() : n;
  };

  const diff       = old_price - new_price;
  const pct        = old_price > 0 ? diff / old_price : null;
  const purch2025n = g('purchases_2025_new');
  const sfp        = purch2025n != null ? purch2025n * diff : null;

  const isElim     = type === 'elimination';
  const purch2026  = isElim ? null : g('purchases_2026_h1');
  const est2026    = isElim ? g('estimated_consumption_2026_h1') : null;
  const sfp2026    = isElim
    ? (est2026 != null ? est2026 * new_price : null)
    : (purch2026 != null ? purch2026 * diff : null);

  const record = {
    old_code, old_description, new_code,
    old_supplier:    document.getElementById('old_supplier').value.trim() || null,
    old_price,
    new_description: document.getElementById('new_description').value.trim() || null,
    new_supplier:    document.getElementById('new_supplier').value.trim() || null,
    new_price,
    price_diff:          diff,
    price_reduction_pct: pct,
    change_type:         type,
    purchases_2024:      g('purchases_2024'),
    purchases_2025_old:  g('purchases_2025_old'),
    purchases_2025_new:  purch2025n,
    purchases_2026_h1:   purch2026,
    estimated_consumption_2026_h1: est2026,
    consumption_2024:    g('consumption_2024'),
    consumption_2025:    g('consumption_2025'),
    consumption_2026:    g('consumption_2026'),
    consumption_2026_h1: g('consumption_2026_h1'),
    saving_from_purchases: sfp,
    saving_2026_h1:        sfp2026,
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
  onTypeChange();
}
