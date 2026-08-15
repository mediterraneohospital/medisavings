// MediSavings - List Logic v2 (periods)
let allData = [];
let periodsMap = {}; // change_id → [periods]
let sortCol = 'sort_order';
let sortDir = 'asc';

async function loadData() {
  const [{ data, error }, { data: periods }] = await Promise.all([
    db.from('material_changes').select('*').order('sort_order', { ascending: true, nullsFirst: false }),
    db.from('material_periods').select('*')
  ]);

  if (error) {
    document.getElementById('loadingState').innerHTML =
      `<p style="color:var(--red)">❌ Σφάλμα σύνδεσης: ${error.message}</p>`;
    return;
  }

  allData = data || [];
  periodsMap = {};
  (periods || []).forEach(p => {
    if (!periodsMap[p.change_id]) periodsMap[p.change_id] = [];
    periodsMap[p.change_id].push(p);
  });

  renderStats(allData);
  populateSupplierFilter(allData);
  renderTable(allData);

  // Επαναφορά scroll position
  var savedScroll = sessionStorage.getItem('listScroll');
  if (savedScroll) {
    setTimeout(function() {
      window.scrollTo(0, parseInt(savedScroll));
      sessionStorage.removeItem('listScroll');
    }, 100);
  }
}

function totalSaving(r) {
  const periods = periodsMap[r.id] || [];
  if (periods.length > 0) {
    return periods.reduce((s, p) => s + (p.saving || 0), 0);
  }
  // Fallback για παλιές εγγραφές χωρίς περιόδους
  return (r.saving_from_purchases || 0) + (r.saving_2026_h1 || 0);
}

function renderStats(data) {
  const active = data.filter(r => r.status === 'active');
  const total  = active.reduce((s, r) => s + totalSaving(r), 0);
  const pcts   = active.filter(r => r.price_reduction_pct).map(r => r.price_reduction_pct);
  const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const count2025 = active.reduce((s, r) => {
    const p = (periodsMap[r.id] || []).find(p => p.period === '2025');
    return s + (p?.saving || 0);
  }, 0);

  document.getElementById('statTotal').textContent     = data.length;
  document.getElementById('statSaving').textContent    = formatEuro(total);
  document.getElementById('statPurchases').textContent = formatEuro(count2025);
  document.getElementById('statAvgPct').textContent    = formatPct(avgPct);
}

function populateSupplierFilter(data) {
  const suppliers = [...new Set(data.map(r => r.old_supplier).filter(Boolean))].sort();
  const sel = document.getElementById('filterSupplier');
  suppliers.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    sel.appendChild(o);
  });

  const categories = [...new Set(data.map(r => r.category).filter(Boolean))].sort();
  const catSel = document.getElementById('filterCategory');
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    catSel.appendChild(o);
  });
}

function getFiltered() {
  const search   = document.getElementById('searchInput').value.toLowerCase();
  const status   = document.getElementById('filterStatus').value;
  const supplier = document.getElementById('filterSupplier').value;
  const category = document.getElementById('filterCategory').value;
  return allData.filter(r => {
    if (status   && r.status       !== status)   return false;
    if (supplier && r.old_supplier !== supplier)  return false;
    if (category && r.category     !== category)  return false;
    if (search) {
      const hay = [r.old_code, r.old_description, r.new_code, r.new_description,
                   r.old_supplier, r.new_supplier, r.category].join(' ').toLowerCase();
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
    if (typeof va === 'string' && typeof vb === 'string')
      return sortDir === 'asc' ? va.localeCompare(vb, 'el') : vb.localeCompare(va, 'el');
    if (va == null) va = sortDir === 'asc' ? Infinity : -Infinity;
    if (vb == null) vb = sortDir === 'asc' ? Infinity : -Infinity;
    return sortDir === 'asc' ? va - vb : vb - va;
  });
}

function renderTable(data) {
  const filtered = getFiltered();
  const sorted   = sortData(filtered);

  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('countLabel').textContent = `${sorted.length} εγγραφές`;

  const cardList = document.getElementById('cardList');

  if (sorted.length === 0) {
    cardList.style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  cardList.style.display = 'flex';

  cardList.innerHTML = sorted.map((r, idx) => {
    const aa       = idx + 1;
    const saving   = totalSaving(r);
    const isDisc   = r.is_discontinued;
    const rPeriods = periodsMap[r.id] || [];
    const uniquePeriods = [...new Set(rPeriods.map(p => p.period))];
    const periodBadges  = uniquePeriods.map(p =>
      `<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:var(--teal-subtle);color:var(--teal-dark);margin-right:4px">${p}</span>`
    ).join('');

    const statusHtml = isDisc
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:var(--red-light);color:var(--red)"><i class="ti ti-ban" style="font-size:11px;margin-right:3px"></i>Καταργημένο</span>`
      : r.status === 'active'
        ? `<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:var(--green-light);color:var(--green)"><i class="ti ti-circle-check" style="font-size:11px;margin-right:3px"></i>Ενεργό</span>`
        : `<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:#fef9c3;color:#a16207">Εκκρεμεί</span>`;

    const pct = r.price_reduction_pct != null
      ? `<span style="font-size:13px;font-weight:500;color:var(--green)">−${formatPct(r.price_reduction_pct)}</span>`
      : '—';

          const sameDesc = r.old_description === r.new_description;
    const descHtml = sameDesc
      ? `<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px">${esc(r.old_description)}</div>`
      : `<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px">${esc(r.old_description)} <span style="font-weight:400;color:#94a3b8">→</span> ${esc(r.new_description || r.old_description)}</div>`;

    return `<div onclick="openDetail('${r.id}')" style="background:white;border:0.5px solid #e2e8f0;border-radius:16px;padding:14px 16px;cursor:pointer" onmouseover="this.style.background='#f0fdf4';this.style.borderColor='#86efac'" onmouseout="this.style.background='white';this.style.borderColor='#e2e8f0'">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <span style="font-size:11px;font-weight:500;color:#64748b;min-width:20px;padding-top:2px">${aa}</span>
        <div style="flex:1">
          ${descHtml}
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:#f1f5f9;color:#64748b;border:0.5px solid #e2e8f0">${esc(r.old_supplier || '')} → ${esc(r.new_supplier || '')}</span>
            ${periodBadges}
            ${r.category ? `<span style="font-size:11px;color:#475569">${esc(r.category)}</span>` : ''}
            ${statusHtml}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;white-space:nowrap;padding-top:1px">
          <span style="font-size:12px;color:#475569">${formatEuro(r.old_price)} → ${formatEuro(r.new_price)}</span>
          ${pct}
          <div style="font-size:15px;font-weight:600;color:#16a34a">▼ ${formatEuro(Math.abs(saving))}</div>
          <button onclick="event.stopPropagation();editRecord('${r.id}')" style="background:none;border:0.5px solid #e2e8f0;border-radius:8px;padding:4px 8px;cursor:pointer;color:#64748b;font-size:13px" title="Επεξεργασία"><i class="ti ti-pencil"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function openDetail(id) {
  sessionStorage.setItem('listScroll', window.scrollY);
  window.location.href = `detail.html?id=${id}`;
}
function editRecord(id) {
  sessionStorage.setItem('listScroll', window.scrollY);
  window.location.href = `add.html?id=${id}`;
}
function goToList() {
  sessionStorage.removeItem('listScroll');
  window.location.href = 'index.html';
}

document.getElementById('searchInput').addEventListener('input', function() {
  var clearBtn = document.getElementById('clearSearch');
  if (clearBtn) clearBtn.style.display = this.value ? 'block' : 'none';
  renderTable(allData);
});
document.getElementById('filterStatus').addEventListener('change',  () => renderTable(allData));
document.getElementById('filterSupplier').addEventListener('change',() => renderTable(allData));
document.getElementById('filterCategory').addEventListener('change',() => renderTable(allData));
document.getElementById('clearFilters').addEventListener('click', () => {
  document.getElementById('searchInput').value    = '';
  document.getElementById('filterStatus').value   = '';
  document.getElementById('filterSupplier').value = '';
  document.getElementById('filterCategory').value = '';
  renderTable(allData);
});

document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    else { sortCol = col; sortDir = 'asc'; }
    document.querySelectorAll('th.sortable').forEach(t =>
      t.textContent = t.textContent.replace(/ [▲▼]$/, ''));
    th.textContent += sortDir === 'asc' ? ' ▲' : ' ▼';
    renderTable(allData);
  });
});

loadData();
