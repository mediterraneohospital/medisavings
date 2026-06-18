// MediSavings - Form Logic
const params = new URLSearchParams(window.location.search);
const editId = params.get('id');

// ── Auto-recalculate when prices/consumption change ──────
function recalc() {
  const op = parseFloat(document.getElementById('old_price').value);
  const np = parseFloat(document.getElementById('new_price').value);
  const cons2026h1 = parseFloat(document.getElementById('consumption_2026_h1').value);
  const purch2025new = parseFloat(document.getElementById('purchases_2025_new').value);
  const purch2025old = parseFloat(document.getElementById('purchases_2025_old').value);

  const preview = document.getElementById('savingPreview');

  if (!isNaN(op) && !isNaN(np)) {
    preview.style.display = 'flex';

    const diff = op - np;
    const pct = op > 0 ? diff / op : 0;

    document.getElementById('prevDiff').textContent = formatEuro(diff);
    document.getElementById('prevPct').textContent = formatPct(pct);

    // Όφελος από αγορές 2025
    const purchNew = isNaN(purch2025new) ? 0 : purch2025new;
    const purchOld = isNaN(purch2025old) ? 0 : purch2025old;
    const sfp = (purchNew + purchOld) > 0 ? purchNew * diff : null;
    if (sfp !== null) document.getElementById('saving_from_purchases').value = sfp.toFixed(2);

    // Όφελος Α΄ εξαμήνου 2026
    const saving2026h1 = !isNaN(cons2026h1) ? cons2026h1 * diff : 0;
    document.getElementById('prevSaving2026').textContent = saving2026h1 ? formatEuro(saving2026h1) : '—';

    // Συνολική εξοικονόμηση
    const total = (sfp || 0) + saving2026h1;
    document.getElementById('prevSaving').textContent = formatEuro(total);

    // Κόστη
    document.getElementById('prevOldCost').textContent = '—';
    document.getElementById('prevNewCost').textContent = '—';
  } else {
    preview.style.display = 'none';
  }
}

['old_price','new_price','consumption_2026_h1','purchases_2025_new','purchases_2025_old'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', recalc);
});

// ── Load for edit ─────────────────────────────────────────
async function loadForEdit(id) {
  document.getElementById('pageTitle').textContent = '✏️ Επεξεργασία Αλλαγής';
  document.getElementById('saveBtn').textContent = '💾 Αποθήκευση Αλλαγών';

  const { data, error } = await db.from('material_changes').select('*').eq('id', id).single();
  if (error || !data) { showToast('Σφάλμα φόρτωσης', 'error'); return; }

  const fields = [
    'old_code','old_description','old_supplier','old_price',
    'new_code','new_description','new_supplier','new_price',
    'purchases_2024','purchases_2025_old','purchases_2025_new','purchases_2026_h1',
    'consumption_2024','consumption_2025','consumption_2026',
    'saving_from_purchases','category','status','change_date','notes'
  ];

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && data[f] != null) el.value = data[f];
  });

  recalc();
}

// ── Save ─────────────────────────────────────────────────
async function saveRecord() {
  const old_code = document.getElementById('old_code').value.trim();
  const old_description = document.getElementById('old_description').value.trim();
  const new_code = document.getElementById('new_code').value.trim();
  const old_price = parseFloat(document.getElementById('old_price').value);
  const new_price = parseFloat(document.getElementById('new_price').value);

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

  const diff = old_price - new_price;
  const pct  = old_price > 0 ? diff / old_price : null;
  const cons = g('consumption_2025');
  const costOld = cons ? cons * old_price : null;
  const costNew = cons ? cons * new_price : null;
  const saving  = costOld != null && costNew != null ? costOld - costNew : null;

  const record = {
    old_code, old_description, new_code,
    old_supplier:    document.getElementById('old_supplier').value.trim() || null,
    old_price,
    new_description: document.getElementById('new_description').value.trim() || null,
    new_supplier:    document.getElementById('new_supplier').value.trim() || null,
    new_price,
    price_diff:           diff,
    price_reduction_pct:  pct,
    purchases_2024:       g('purchases_2024'),
    purchases_2025_old:   g('purchases_2025_old'),
    purchases_2025_new:   g('purchases_2025_new'),
    purchases_2026_h1:    g('purchases_2026_h1'),
    consumption_2024:     g('consumption_2024'),
    consumption_2025:     cons,
    consumption_2026:     g('consumption_2026'),
    consumption_2026_h1:  g('consumption_2026_h1'),
    cost_old_price_2025:  costOld,
    cost_new_price_2025:  costNew,
    annual_saving_2025:   saving,
    saving_from_purchases: g('saving_from_purchases'),
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

// Set today as default date
if (!editId) {
  document.getElementById('change_date').value = new Date().toISOString().split('T')[0];
}
