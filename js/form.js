// MediSavings - Form Logic v2 (periods)
const params = new URLSearchParams(window.location.search);
const editId = params.get('id');
let periodCount = 0;
let existingPeriods = []; // για edit mode

const PERIOD_OPTIONS = ['2024','2025','2026-H1','2026-H2','2027-H1','2027-H2','2027'];

function addPeriod(data = {}) {
  periodCount++;
  const idx = periodCount;
  const container = document.getElementById('periodsContainer');
  const div = document.createElement('div');
  div.className = 'period-row';
  div.id = `period_${idx}`;

  const periodOpts = PERIOD_OPTIONS.map(p =>
    `<option value="${p}" ${data.period === p ? 'selected' : ''}>${p}</option>`
  ).join('');

  const saving = data.saving != null ? data.saving : '';
  const isManual = data.saving_manual ? 'checked' : '';

  div.innerHTML = `
    <div class="form-group">
      <select id="p_period_${idx}">
        <option value="">— Επιλογή —</option>
        ${periodOpts}
      </select>
    </div>
    <div class="form-group">
      <input type="number" id="p_purchases_${idx}" placeholder="τεμάχια" value="${data.purchases ?? ''}" oninput="calcPeriodSaving(${idx})">
    </div>
    <div class="form-group">
      <input type="number" id="p_price_${idx}" step="0.0001" placeholder="0.0000" value="${data.price_used ?? ''}" oninput="calcPeriodSaving(${idx})">
    </div>
    <div class="form-group">
      <input type="number" id="p_saving_${idx}" step="0.01" placeholder="αυτόματο" value="${saving}" style="font-weight:600;color:var(--green)">
      <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
        <input type="checkbox" id="p_manual_${idx}" ${isManual} style="accent-color:var(--yellow)">
        <label for="p_manual_${idx}" class="manual-badge">Χειροκίνητο</label>
      </div>
    </div>
    <div class="form-group">
      <input type="text" id="p_notes_${idx}" placeholder="Σχόλια..." value="${data.notes ?? ''}">
    </div>
    <button class="del-period" onclick="removePeriod(${idx})" title="Διαγραφή">✕</button>
  `;
  div.dataset.dbId = data.id || '';
  container.appendChild(div);
  return idx;
}

function calcPeriodSaving(idx) {
  const isManual = document.getElementById(`p_manual_${idx}`)?.checked;
  if (isManual) return; // μην αντικαταστήσεις χειροκίνητο

  const purchases = parseFloat(document.getElementById(`p_purchases_${idx}`)?.value);
  const price     = parseFloat(document.getElementById(`p_price_${idx}`)?.value);
  const oldPrice  = parseFloat(document.getElementById('old_price')?.value);

  if (!isNaN(purchases) && !isNaN(price) && !isNaN(oldPrice)) {
    const diff   = oldPrice - price;
    const saving = purchases * diff;
    const savEl  = document.getElementById(`p_saving_${idx}`);
    if (savEl) savEl.value = saving.toFixed(2);
  }
}

function removePeriod(idx) {
  document.getElementById(`period_${idx}`)?.remove();
}

function getPeriods() {
  const rows = document.querySelectorAll('[id^="period_"]');
  return Array.from(rows).map(row => {
    const idx    = row.id.replace('period_', '');
    const period = document.getElementById(`p_period_${idx}`)?.value;
    if (!period) return null;
    return {
      id:           row.dataset.dbId || null,
      period,
      purchases:    parseFloat(document.getElementById(`p_purchases_${idx}`)?.value) || null,
      price_used:   parseFloat(document.getElementById(`p_price_${idx}`)?.value) || null,
      saving:       parseFloat(document.getElementById(`p_saving_${idx}`)?.value) || null,
      saving_manual:document.getElementById(`p_manual_${idx}`)?.checked || false,
      notes:        document.getElementById(`p_notes_${idx}`)?.value.trim() || null,
    };
  }).filter(Boolean);
}

// ── Load for edit ─────────────────────────────────────────
async function loadForEdit(id) {
  document.getElementById('pageTitle').textContent = '✏️ Επεξεργασία Αλλαγής';
  document.getElementById('saveBtn').textContent   = '💾 Αποθήκευση Αλλαγών';

  const [{ data: rec, error }, { data: periods }] = await Promise.all([
    db.from('material_changes').select('*').eq('id', id).single(),
    db.from('material_periods').select('*').eq('change_id', id).order('period')
  ]);
  if (error || !rec) { showToast('Σφάλμα φόρτωσης', 'error'); return; }

  const fields = [
    'old_code','old_description','old_supplier','old_price',
    'new_code','new_description','new_supplier','new_price',
    'category','status','change_date','notes'
  ];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && rec[f] != null) el.value = rec[f];
  });
  if (rec.is_discontinued) document.getElementById('is_discontinued').checked = true;

  // Φόρτωση περιόδων
  (periods || []).forEach(p => addPeriod(p));
}

// ── Save ─────────────────────────────────────────────────
async function saveRecord() {
  const old_code        = document.getElementById('old_code').value.trim();
  const old_description = document.getElementById('old_description').value.trim();
  const new_code        = document.getElementById('new_code').value.trim();
  const old_price       = parseFloat(document.getElementById('old_price').value);
  const new_price       = parseFloat(document.getElementById('new_price').value) || 0;

  if (!old_code || !old_description || !new_code || isNaN(old_price)) {
    showToast('Συμπλήρωσε τα υποχρεωτικά πεδία (*)', 'error'); return;
  }

  const diff = old_price - new_price;
  const pct  = old_price > 0 ? diff / old_price : null;

  const record = {
    old_code, old_description, new_code,
    old_supplier:    document.getElementById('old_supplier').value.trim() || null,
    old_price, new_price,
    new_description: document.getElementById('new_description').value.trim() || null,
    new_supplier:    document.getElementById('new_supplier').value.trim() || null,
    price_diff:          diff,
    price_reduction_pct: pct,
    is_discontinued:     document.getElementById('is_discontinued').checked,
    category:    document.getElementById('category').value || null,
    status:      document.getElementById('status').value || 'active',
    change_date: document.getElementById('change_date').value || null,
    notes:       document.getElementById('notes').value.trim() || null,
    updated_at:  new Date().toISOString(),
  };

  document.getElementById('saveBtn').disabled = true;
  document.getElementById('saveBtn').textContent = '⏳ Αποθήκευση...';

  let changeId = editId;
  let error;

  if (editId) {
    ({ error } = await db.from('material_changes').update(record).eq('id', editId));
  } else {
    const { data, error: err } = await db.from('material_changes').insert(record).select().single();
    error = err;
    if (data) changeId = data.id;
  }

  if (error) {
    showToast('Σφάλμα: ' + error.message, 'error');
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('saveBtn').textContent = '💾 Αποθήκευση';
    return;
  }

  // Αποθήκευση περιόδων
  const periods = getPeriods();
  for (const p of periods) {
    const pRecord = { change_id: changeId, period: p.period, purchases: p.purchases,
      price_used: p.price_used, saving: p.saving, saving_manual: p.saving_manual, notes: p.notes };
    if (p.id) {
      await db.from('material_periods').update(pRecord).eq('id', p.id);
    } else {
      await db.from('material_periods').insert(pRecord);
    }
  }

  showToast(editId ? 'Αποθηκεύτηκε!' : 'Η αλλαγή καταχωρήθηκε!', 'success');
  setTimeout(() => window.location.href = 'index.html', 1200);
}

// ── Init ─────────────────────────────────────────────────
if (editId) loadForEdit(editId);
if (!editId) {
  document.getElementById('change_date').value = new Date().toISOString().split('T')[0];
  addPeriod({ period: '2025' });
  addPeriod({ period: '2026-H1' });
}

// Recalc on old_price change
document.getElementById('old_price')?.addEventListener('input', () => {
  document.querySelectorAll('[id^="period_"]').forEach(row => {
    const idx = row.id.replace('period_', '');
    calcPeriodSaving(idx);
  });
});
