// MediSavings - List Logic
let allData = [];
let sortCol = 'total_saving';
let sortDir = 'desc';

async function loadData() {
  const { data, error } = await db
    .from('material_changes')
    .select('*')
    .order('annual_saving_2025', { ascending: false, nullsFirst: false });

  if (error) {
    document.getElementById('loadingState').innerHTML =
      `<p style="color:var(--red)">❌ Σφάλμα σύνδεσης: ${error.message}</p>`;
    return;
  }

  allData = data || [];
  renderStats(allData);
  populateSupplierFilter(allData);
  renderTable(allData);
}

function totalSaving(r) {
  // Πραγματικό όφελος: αγορές 2025 + κατανάλωση Α΄ εξαμήνου 2026 × διαφορά τιμής
  const s2025 = r.saving_from_purchases || 0;
  const s2026h1 = (r.consumption_2026_h1 || 0) * (r.price_diff || 0);
  return s2025 + s2026h1;
}

function renderStats(data) {
  const active = data.filter(r => r.status === 'active');
  const total = active.reduce((s, r) => s + totalSaving(r), 0);
  const total2025 = active.reduce((s, r) => s + (r.saving_from_purchases || 0), 0);
  const pcts = active.filter(r => r.price_reduction_pct).map(r => r.price_reduction_pct);
  const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;

  document.getElementById('statTotal').textContent = data.length;
  document.getElementById('statSaving').textContent = formatEuro(total);
  document.getElementById('statPurchases').textContent = formatEuro(total2025);
  document.getElementById('statAvgPct').textContent = formatPct(avgPct);
}

function populateSupplierFilter(data) {
  const suppliers = [...new Set(data.map(r => r.old_supplier).filter(Boolean))].sort();
  const sel = document.getElementById('filterSupplier');
  suppliers.forEach(s => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    sel.appendChild(o);
  });
}

function getFiltered() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const supplier = document.getElementById('filterSupplier').value;

  return allData.filter(r => {
    if (status && r.status !== status) return false;
    if (supplier && r.old_supplier !== supplier) return false;
    if (search) {
      const hay = [r.old_code, r.old_description, r.new_code, r.new_description,
                   r.old_supplier, r.new_supplier].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function sortData(data) {
  return [...data].sort((a, b) => {
    let va = sortCol === 'total_saving' ? totalSaving(a) : a[sortCol];
    let vb = sortCol === 'total_saving' ? totalSaving(b) : b[sortCol];
    if (va == null) va = sortDir === 'asc' ? '\uffff' : '';
    if (vb == null) vb = sortDir === 'asc' ? '\uffff' : '';
    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb, 'el') : vb.localeCompare(va, 'el');
    }
    if (va == null) va = sortDir === 'asc' ? Infinity : -Infinity;
    if (vb == null) vb = sortDir === 'asc' ? Infinity : -Infinity;
    return sortDir === 'asc' ? va - vb : vb - va;
  });
}

function renderTable(data) {
  const filtered = getFiltered();
  const sorted = sortData(filtered);

  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('countLabel').textContent = `${sorted.length} εγγραφές`;

  if (sorted.length === 0) {
    document.getElementById('mainTable').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('mainTable').style.display = 'table';

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = sorted.map(r => {
    const saving = totalSaving(r);
    const savingHtml = saving != null
      ? `<span class="saving-pill ${saving < 0 ? 'negative' : ''}">${saving >= 0 ? '▼' : '▲'} ${formatEuro(Math.abs(saving))}</span>`
      : '—';

    return `<tr>
      <td>
        <div class="item-code">${esc(r.old_code)}</div>
        <div class="item-desc">${esc(r.old_description)}</div>
        <div class="item-supplier">${esc(r.old_supplier || '')}</div>
      </td>
      <td class="arrow-col">→</td>
      <td>
        <div class="item-code">${esc(r.new_code)}</div>
        <div class="item-desc">${esc(r.new_description || '')}</div>
        <div class="item-supplier">${esc(r.new_supplier || '')}</div>
      </td>
      <td><span class="price-old">${formatEuro(r.old_price)}</span></td>
      <td><span class="price-new">${formatEuro(r.new_price)}</span></td>
      <td>
        ${r.price_reduction_pct != null
          ? `<strong style="color:var(--green)">${formatPct(r.price_reduction_pct)}</strong>`
          : '—'}
      </td>
      <td>${savingHtml}</td>
      <td>${statusBadge(r.status || 'active')}</td>
      <td>
        <button class="btn btn-outline btn-sm btn-icon" onclick="openDetail('${r.id}')" title="Λεπτομέρειες">🔍</button>
        <button class="btn btn-outline btn-sm btn-icon" onclick="editRecord('${r.id}')" title="Επεξεργασία">✏️</button>
      </td>
    </tr>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function openDetail(id) {
  window.location.href = `detail.html?id=${id}`;
}

function editRecord(id) {
  window.location.href = `add.html?id=${id}`;
}

// ── Event Listeners ──────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', () => renderTable(allData));
document.getElementById('filterStatus').addEventListener('change', () => renderTable(allData));
document.getElementById('filterSupplier').addEventListener('change', () => renderTable(allData));
document.getElementById('clearFilters').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterSupplier').value = '';
  renderTable(allData);
});

document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    else { sortCol = col; sortDir = 'asc'; }
    // Update indicators
    document.querySelectorAll('th.sortable').forEach(t => {
      t.textContent = t.textContent.replace(/ [▲▼]$/, '');
    });
    th.textContent += sortDir === 'asc' ? ' ▲' : ' ▼';
    renderTable(allData);
  });
});

// ── Init ─────────────────────────────────────────────────
loadData();
