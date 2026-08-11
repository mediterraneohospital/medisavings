// MediSavings - Form Logic v3
const params  = new URLSearchParams(window.location.search);
const editId  = params.get('id');
let periodCount = 0;

const PERIOD_OPTIONS = ['2024','2025','2026-H1','2026-H2','2027-H1','2027-H2','2027'];

// ── Periods ───────────────────────────────────────────────
function addPeriod(data) {
  data = data || {};
  periodCount++;
  const idx = periodCount;
  const container = document.getElementById('periodsContainer');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'period-row';
  div.id = 'period_' + idx;
  div.dataset.dbId = data.id || '';

  const opts = PERIOD_OPTIONS.map(function(p) {
    return '<option value="' + p + '"' + (data.period === p ? ' selected' : '') + '>' + p + '</option>';
  }).join('');

  const savingVal  = (data.saving  != null) ? data.saving  : '';
  const priceVal   = (data.price_used != null) ? data.price_used : '';
  const purchVal   = (data.purchases  != null) ? data.purchases  : '';
  const notesVal   = (data.notes || '');
  const isManual   = data.saving_manual ? 'checked' : '';

  div.innerHTML =
    '<div class="form-group">' +
      '<label>Περίοδος</label>' +
      '<select id="p_period_' + idx + '">' +
        '<option value="">— Επιλογή —</option>' + opts +
      '</select>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Αγορές</label>' +
      '<input type="number" id="p_purchases_' + idx + '" placeholder="τεμάχια" value="' + purchVal + '">' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Τιμή που ίσχυε (€)</label>' +
      '<input type="number" id="p_price_' + idx + '" step="0.0001" placeholder="0.0000" value="' + priceVal + '">' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Όφελος (€)</label>' +
      '<input type="number" id="p_saving_' + idx + '" step="0.01" placeholder="αυτόματο" value="' + savingVal + '" class="saving-input">' +
      '<div class="manual-row">' +
        '<input type="checkbox" id="p_manual_' + idx + '" ' + isManual + ' style="accent-color:var(--yellow)">' +
        '<label for="p_manual_' + idx + '">✏️ Χειροκίνητο</label>' +
      '</div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Σημειώσεις</label>' +
      '<input type="text" id="p_notes_' + idx + '" placeholder="π.χ. μικτές τιμές" value="' + notesVal + '">' +
    '</div>' +
    '<button type="button" class="del-period" onclick="removePeriod(' + idx + ')" title="Διαγραφή">✕</button>';

  container.appendChild(div);

  // Listeners για αυτόματο υπολογισμό
  document.getElementById('p_purchases_' + idx).addEventListener('input', function() { calcPeriodSaving(idx); });
  document.getElementById('p_price_' + idx).addEventListener('input', function() { calcPeriodSaving(idx); });
}

function removePeriod(idx) {
  var el = document.getElementById('period_' + idx);
  if (el) el.remove();
}

function calcPeriodSaving(idx) {
  var manualEl = document.getElementById('p_manual_' + idx);
  if (manualEl && manualEl.checked) return;

  var purchases = parseFloat(document.getElementById('p_purchases_' + idx).value);
  var price     = parseFloat(document.getElementById('p_price_' + idx).value);
  var oldPrice  = parseFloat(document.getElementById('old_price').value);

  if (!isNaN(purchases) && !isNaN(price) && !isNaN(oldPrice)) {
    var saving = purchases * (oldPrice - price);
    document.getElementById('p_saving_' + idx).value = saving.toFixed(2);
  }
}

function getPeriods() {
  var rows = document.querySelectorAll('[id^="period_"]');
  var result = [];
  rows.forEach(function(row) {
    var idx = row.id.replace('period_', '');
    var period = document.getElementById('p_period_' + idx);
    if (!period || !period.value) return;
    result.push({
      id:           row.dataset.dbId || null,
      period:       period.value,
      purchases:    parseFloat(document.getElementById('p_purchases_' + idx).value) || null,
      price_used:   parseFloat(document.getElementById('p_price_' + idx).value) || null,
      saving:       parseFloat(document.getElementById('p_saving_' + idx).value) || null,
      saving_manual:document.getElementById('p_manual_' + idx).checked || false,
      notes:        document.getElementById('p_notes_' + idx).value.trim() || null,
    });
  });
  return result;
}

// ── Load for edit ─────────────────────────────────────────
async function loadForEdit(id) {
  document.getElementById('pageTitle').textContent = '✏️ Επεξεργασία Αλλαγής';
  document.getElementById('saveBtn').textContent   = '💾 Αποθήκευση Αλλαγών';

  var results = await Promise.all([
    db.from('material_changes').select('*').eq('id', id).single(),
    db.from('material_periods').select('*').eq('change_id', id).order('period')
  ]);

  var rec     = results[0].data;
  var error   = results[0].error;
  var periods = results[1].data;

  if (error || !rec) { showToast('Σφάλμα φόρτωσης', 'error'); return; }

  var fields = [
    'old_code','old_description','old_supplier','old_price',
    'new_code','new_description','new_supplier','new_price',
    'consumption_2024','consumption_2025','consumption_2026_h1','consumption_2026',
    'category','status','change_date','notes'
  ];
  fields.forEach(function(f) {
    var el = document.getElementById(f);
    if (el && rec[f] != null) el.value = rec[f];
  });

  if (rec.is_discontinued) document.getElementById('is_discontinued').checked = true;

  // Φόρτωση περιόδων
  if (periods && periods.length > 0) {
    periods.forEach(function(p) { addPeriod(p); });
  }
}

// ── Save ─────────────────────────────────────────────────
async function saveRecord() {
  var old_code        = document.getElementById('old_code').value.trim();
  var old_description = document.getElementById('old_description').value.trim();
  var new_code        = document.getElementById('new_code').value.trim();
  var old_price       = parseFloat(document.getElementById('old_price').value);
  var new_price       = parseFloat(document.getElementById('new_price').value) || 0;

  if (!old_code || !old_description || !new_code || isNaN(old_price)) {
    showToast('Συμπλήρωσε τα υποχρεωτικά πεδία (*)', 'error'); return;
  }

  var g = function(id) {
    var el = document.getElementById(id);
    if (!el || el.value === '') return null;
    var n = parseFloat(el.value);
    return isNaN(n) ? null : n;
  };

  var diff = old_price - new_price;
  var pct  = old_price > 0 ? diff / old_price : null;

  var record = {
    old_code: old_code,
    old_description: old_description,
    new_code: new_code,
    old_supplier:    document.getElementById('old_supplier').value.trim() || null,
    old_price:       old_price,
    new_description: document.getElementById('new_description').value.trim() || null,
    new_supplier:    document.getElementById('new_supplier').value.trim() || null,
    new_price:       new_price,
    price_diff:          diff,
    price_reduction_pct: pct,
    is_discontinued:     document.getElementById('is_discontinued').checked,
    consumption_2024:    g('consumption_2024'),
    consumption_2025:    g('consumption_2025'),
    consumption_2026_h1: g('consumption_2026_h1'),
    consumption_2026:    g('consumption_2026'),
    category:    document.getElementById('category').value || null,
    status:      document.getElementById('status').value || 'active',
    change_date: document.getElementById('change_date').value || null,
    notes:       document.getElementById('notes').value.trim() || null,
    updated_at:  new Date().toISOString(),
  };

  document.getElementById('saveBtn').disabled = true;
  document.getElementById('saveBtn').textContent = '⏳ Αποθήκευση...';

  var changeId = editId;
  var saveError;

  if (editId) {
    var res = await db.from('material_changes').update(record).eq('id', editId);
    saveError = res.error;
  } else {
    var res = await db.from('material_changes').insert(record).select().single();
    saveError = res.error;
    if (res.data) changeId = res.data.id;
  }

  if (saveError) {
    showToast('Σφάλμα: ' + saveError.message, 'error');
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('saveBtn').textContent = '💾 Αποθήκευση';
    return;
  }

  // Αποθήκευση περιόδων
  var periods = getPeriods();
  for (var i = 0; i < periods.length; i++) {
    var p = periods[i];
    var pRecord = {
      change_id:    changeId,
      period:       p.period,
      purchases:    p.purchases,
      price_used:   p.price_used,
      saving:       p.saving,
      saving_manual:p.saving_manual,
      notes:        p.notes
    };
    if (p.id) {
      await db.from('material_periods').update(pRecord).eq('id', p.id);
    } else {
      await db.from('material_periods').insert(pRecord);
    }
  }

  showToast(editId ? 'Αποθηκεύτηκε!' : 'Καταχωρήθηκε!', 'success');
  setTimeout(function() { window.location.href = 'index.html'; }, 1200);
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('addPeriodBtn').addEventListener('click', function() { addPeriod(); });
  document.getElementById('saveBtn').addEventListener('click', saveRecord);
  document.getElementById('old_price').addEventListener('input', function() {
    document.querySelectorAll('[id^="period_"]').forEach(function(row) {
      var idx = row.id.replace('period_', '');
      calcPeriodSaving(idx);
    });
  });

  if (editId) {
    loadForEdit(editId);
  } else {
    document.getElementById('change_date').value = new Date().toISOString().split('T')[0];
    addPeriod({ period: '2025' });
    addPeriod({ period: '2026-H1' });
  }
});
