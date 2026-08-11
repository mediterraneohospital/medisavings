// MediSavings - Form Logic
const params = new URLSearchParams(window.location.search);
const editId = params.get('id');

function getType() {
  return document.querySelector('input[name="change_type"]:checked')?.value || 'substitution';
}

function onTypeChange() {
  const isElim = getType() === 'elimination';

  document.getElementById('section_substitution').style.display = isElim ? 'none' : '';
  document.getElementById('section_elimination').style.display  = isElim ? '' : 'none';

  // Preview items
  ['prev_diff','prev_pct','prev_s2025','prev_s2026','prev_total','prev_proj'].forEach(id => {
    document.getElementById(id).style.display = isElim ? 'none' : '';
  });
  document.getElementById('prev_elim').style.display = isElim ? '' : 'none';

  document.getElementById('lbl_substitution').style.borderColor = isElim ? 'var(--gray-200)' : 'var(--teal)';
  document.getElementById('lbl_substitution').style.background  = isElim ? 'white' : 'var(--teal-subtle)';
  document.getElementById('lbl_elimination').style.borderColor  = isElim ? 'var(--red)' : 'var(--gray-200)';
  document.getElementById('lbl_elimination').style.background   = isElim ? 'var(--red-light)' : 'white';

  recalc();
}

function recalc() {
  const isElim = getType() === 'elimination';
  const preview = document.getElementById('savingPreview');

  if (isElim) {
    const v = parseFloat(document.getElementById('annual_elimination_saving').value);
    if (!isNaN(v)) {
      preview.style.display = 'flex';
      document.getElementById('prevElimSaving').textContent = formatEuro(v);
    } else {
      preview.style.display = 'none';
    }
    return;
  }

  const op = parseFloat(document.getElementById('old_price').value);
  const np = parseFloat(document.getElementById('new_price').value);
  if (!isNaN(op) && !isNaN(np)) {
    preview.style.display = 'flex';
    const diff      = op - np;
    const pct       = op > 0 ? diff / op : 0;
    const p2025n    = parseFloat(document.getElementById('purchases_2025_new').value);
    const p2026     = parseFloat(document.getElementById('purchases_2026_h1').value);
    const sfp       = !isNaN(p2025n) ? p2025n * diff : null;
    const sfp26     = !isNaN(p2026)  ? p2026  * diff : null;
    const total     = (sfp || 0) + (sfp26 || 0);

    document.getElementById('prevDiff').textContent     = formatEuro(diff);
    document.getElementById('prevPct').textContent      = formatPct(pct);
    document.getElementById('prevSaving2025').textContent = sfp   != null ? formatEuro(sfp)   : '—';
    document.getElementById('prevSaving2026').textContent = sfp26 != null ? formatEuro(sfp26)  : '—';
    document.getElementById('prevSaving').textContent     = (sfp != null || sfp26 != null) ? formatEuro(total) : '—';
    document.getElementById('prevProjected').textContent  = sfp26 != null ? formatEuro(sfp26 * 2) : '—';
  } else {
    preview.style.display = 'none';
  }
}

['old_price','new_price','purchases_2025_new','purchases_2026_h1','annual_elimination_saving'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', recalc);
});

async function loadForEdit(id) {
  document.getElementById('pageTitle').textContent = '✏️ Επεξεργασία Αλλαγής';
  document.getElementById('saveBtn').textContent   = '💾 Αποθήκευση Αλλαγών';

  const { data, error } = await db.from('material_changes').select('*').eq('id', id).single();
  if (error || !data) { showToast('Σφάλμα φόρτωσης', 'error'); return; }

  // Τύπος — πρώτα για να εμφανιστεί το σωστό section
  const type = data.change_type || 'substitution';
  document.getElementById(type === 'elimination' ? 'type_elimination' : 'type_substitution').checked = true;
  onTypeChange();

  // Κοινά πεδία (πάντα υπάρχουν)
  const common = [
    'old_code','old_description','old_supplier','old_price',
    'new_code','new_description','new_supplier','new_price',
    'category','status','change_date','notes'
  ];
  common.forEach(f => {
    const el = document.getElementById(f);
    if (el && data[f] != null) el.value = data[f];
  });

  if (type === 'substitution') {
    // Πεδία αντικατάστασης
    const substFields = [
      'purchases_2024','purchases_2025_old','purchases_2025_new','purchases_2026_h1',
      'consumption_2024','consumption_2025','consumption_2026','consumption_2026_h1'
    ];
    substFields.forEach(f => {
      const el = document.getElementById(f);
      if (el && data[f] != null) el.value = data[f];
    });
  } else {
    // Πεδία κατάργησης
    if (data.consumption_2024 != null) document.getElementById('consumption_2024_elim').value = data.consumption_2024;
    if (data.consumption_2025 != null) document.getElementById('consumption_2025_elim').value = data.consumption_2025;
    if (data.annual_elimination_saving != null) document.getElementById('annual_elimination_saving').value = data.annual_elimination_saving;
  }

  recalc();
}

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

  const isElim = type === 'elimination';
  const diff   = old_price - new_price;
  const pct    = old_price > 0 ? diff / old_price : null;

  const purch2025n = isElim ? null : g('purchases_2025_new');
  const sfp        = purch2025n != null ? purch2025n * diff : null;
  const purch2026  = isElim ? null : g('purchases_2026_h1');
  const sfp2026    = purch2026 != null ? purch2026 * diff : null;

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
    purchases_2024:      isElim ? null : g('purchases_2024'),
    purchases_2025_old:  isElim ? null : g('purchases_2025_old'),
    purchases_2025_new:  purch2025n,
    purchases_2026_h1:   purch2026,
    consumption_2024:    isElim ? g('consumption_2024_elim') : g('consumption_2024'),
    consumption_2025:    isElim ? g('consumption_2025_elim') : g('consumption_2025'),
    consumption_2026:    isElim ? null : g('consumption_2026'),
    consumption_2026_h1: isElim ? null : g('consumption_2026_h1'),
    saving_from_purchases:     sfp,
    saving_2026_h1:            sfp2026,
    annual_elimination_saving: isElim ? g('annual_elimination_saving') : null,
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

if (editId) loadForEdit(editId);
if (!editId) {
  document.getElementById('change_date').value = new Date().toISOString().split('T')[0];
  onTypeChange();
}
