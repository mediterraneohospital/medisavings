/* Append-only purchases snapshots. Existing savings are never changed. */
'use strict';
const PC=PurchaseCore, $=id=>document.getElementById(id);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'—':new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(v);
const price=v=>v==null?'—':new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:4}).format(v);
const date=v=>new Date(v).toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Athens'});
const periodText=(year,months)=>months.length?PC.MONTHS[months[0]-1]+'–'+PC.MONTHS[months.at(-1)-1]+' '+year:'—';
let imports=[],dataset=null,selectedImport=null,preview=null,page=0,filtered=[],cloudReady=false,reading=false,saving=false,readToken=0;
const PAGE_SIZE=25, snapshots=new Map();
let itemOpenToken=0;
function renderItemValues(item,year,comparison=null){
  const series=[{year,item,months:dataset.months}];
  if(comparison)series.push(comparison);
  series.sort((a,b)=>a.year-b.year);
  const months=[...new Set(series.flatMap(s=>s.months))].sort((a,b)=>a-b);
  const value=(s,m)=>s.months.includes(m)?PC.aggregate(s.item,[m]).value:null;
  const max=Math.max(1,...series.flatMap(s=>months.map(m=>Math.abs(value(s,m)||0))));
  $('itemChartLegend').textContent=series.map(s=>s.year).join(' / ')+' · Αξία αγορών (€)';
  $('itemPriceBars').innerHTML=months.map(m=>'<div class="month-bar-cell"><div class="month-values">'+series.map(s=>'<span class="month-value">'+(series.length>1?s.year+': ':'')+(value(s,m)==null?'—':money(value(s,m)))+'</span>').join('')+'</div><div class="value-bar-group">'+series.map(s=>{const v=value(s,m);return '<div class="month-bar-track" title="'+s.year+' · '+PC.MONTHS[m-1]+': '+(v==null?'Δεν καλύπτεται από το αρχείο':money(v))+'"><div class="month-bar year-'+s.year+(v<0?' negative':'')+'" style="height:'+(v?Math.max(1,Math.abs(v)/max*100):0)+'%"></div></div>';}).join('')+'</div><span class="month-bar-label">'+PC.MONTHS[m-1].slice(0,3)+'</span></div>').join('');
  $('itemComparison').textContent='';
  if(comparison){const common=series[0].months.filter(m=>series[1].months.includes(m));if(!common.length){$('itemComparison').textContent='Τα αρχεία δεν καλύπτουν κοινούς μήνες.';return;}
    const totals=series.map(s=>({year:s.year,value:PC.aggregate(s.item,common).value}));
    const delta=totals[1].value-totals[0].value;
    $('itemComparison').textContent='Κοινοί μήνες: '+common.map(m=>PC.MONTHS[m-1].slice(0,3)).join(', ')+' · '+totals.map(t=>t.year+': '+money(t.value)).join(' · ')+' · Διαφορά: '+money(delta)+(totals[0].value>0?' ('+(delta>0?'+':'')+(delta/totals[0].value*100).toFixed(1)+'%)':'')+'. Η σύγκριση αφορά δαπάνη, όχι εξοικονόμηση.';
  }
}
const metadataColumns='id,file_name,file_hash,content_hash,purchase_year,months,item_count,total_value,warning_count,negative_count,imported_at';
function setError(message){$('loadError').textContent=message;$('loadError').hidden=!message;}
function checkedMode(){if(localStorage.getItem('medisavingsEditMode')!=='1'){location.replace('index.html');return false;}return true;}
function updateSave(){const duplicate=preview&&imports.some(i=>i.purchase_year===preview.data.year&&(i.file_hash===preview.fileHash||i.content_hash===preview.contentHash));$('saveImport').disabled=!cloudReady||!preview||duplicate||!$('reviewAccepted').checked||saving||reading;}
async function allImports(){let result=[];for(let offset=0;;offset+=500){const {data,error}=await db.from('medisavings_purchase_imports').select(metadataColumns).order('imported_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+499);if(error)throw error;result.push(...data);if(data.length<500)break;}return result;}
async function refresh(loadLatest=false){
  if(!checkedMode())return;
  try{imports=await allImports();cloudReady=true;setError('');renderHistory();updateSave();if(loadLatest&&!preview&&imports.length)await selectImport(imports[0].id);}
  catch(error){cloudReady=false;updateSave();setError('Η σύνδεση με το ιστορικό εισαγωγών δεν είναι ακόμη διαθέσιμη. Μπορείς να εξετάσεις το Excel σε προεπισκόπηση· η αποθήκευση θα ενεργοποιηθεί όταν συνδεθεί η νέα ενότητα.');console.error('Purchase history unavailable',error);}
}
function renderHistory(){
  const latest=imports[0];
  $('importSummary').textContent=latest?'Τελευταία εισαγωγή · '+date(latest.imported_at):'Δεν υπάρχει εισαγωγή ακόμη';
  if(latest)$('lastImport').innerHTML='<span class="history-status-dot" style="background:#69a78f"></span><div><strong>Τελευταία εισαγωγή · '+date(latest.imported_at)+'</strong><p>'+escapeHtml(latest.file_name)+'<br>'+periodText(latest.purchase_year,latest.months)+' · '+formatNum(latest.item_count)+' είδη</p></div>';
  $('importHistory').innerHTML=imports.map(i=>'<button class="history-entry '+(selectedImport?.id===i.id?'active':'')+'" data-import="'+i.id+'"><div><strong>'+periodText(i.purchase_year,i.months)+'</strong><small>'+date(i.imported_at)+' · '+formatNum(i.item_count)+' είδη</small></div>'+appIcon('arrow')+'</button>').join('');
  $('importHistory').querySelectorAll('[data-import]').forEach(b=>b.addEventListener('click',()=>selectImport(b.dataset.import)));
}
async function getSnapshot(id){if(snapshots.has(id))return snapshots.get(id);const {data,error}=await db.from('medisavings_purchase_imports').select('dataset').eq('id',id).single();if(error)throw error;snapshots.set(id,data.dataset);return data.dataset;}
async function selectImport(id){if(saving||reading)return;if(preview&&!confirm('Να κλείσει η μη αποθηκευμένη προεπισκόπηση;'))return;try{const data=await getSnapshot(id);preview=null;selectedImport=imports.find(i=>i.id===id);$('reviewChecks').hidden=true;$('previewStatus').hidden=true;$('excelFile').value='';displayDataset(data,false);renderHistory();updateSave();}catch(error){showToast('Δεν φορτώθηκε η εισαγωγή. Δοκίμασε ξανά.','error');console.error(error);}}
async function digest(data){const buffer=typeof data==='string'?new TextEncoder().encode(data):data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');}
async function readFile(file){
  if(!file||!checkedMode()||saving)return;
  $('importControls').open=true;
  const token=++readToken;reading=true;if(preview){dataset=null;$('purchaseData').hidden=true;$('emptyPurchases').hidden=false;}preview=null;updateSave();$('reviewAccepted').checked=false;$('reviewChecks').hidden=true;
  $('previewStatus').hidden=false;$('previewStatus').textContent='Ανάγνωση αρχείου…';
  try{
    if(!/\.xlsx$/i.test(file.name))throw new Error('Επίλεξε αναλυτικό αρχείο .xlsx.');
    if(file.size>25*1024*1024)throw new Error('Το αρχείο ξεπερνά το όριο των 25 MB.');
    const year=Number($('importYear').value),buffer=await file.arrayBuffer();
    if(typeof XLSX==='undefined')throw new Error('Δεν φορτώθηκε η βιβλιοθήκη Excel. Κάνε ανανέωση.');
    const data=PC.parseWorkbook(XLSX.read(buffer,{type:'array',cellText:true}),year,XLSX);
    const [fileHash,contentHash]=await Promise.all([digest(buffer),digest(JSON.stringify(data))]);
    if(token!==readToken)return;
    preview={fileName:file.name,fileHash,contentHash,fileSize:file.size,data};selectedImport=null;
    const duplicate=imports.some(i=>i.purchase_year===year&&(i.file_hash===fileHash||i.content_hash===contentHash));
    $('previewStatus').innerHTML='<strong>'+escapeHtml(file.name)+'</strong><br>'+formatNum(data.items.length)+' είδη · '+periodText(year,data.months)+'. '+(duplicate?'Το αρχείο έχει ήδη εισαχθεί.':'Έτοιμο για έλεγχο πριν την αποθήκευση.');
    $('reviewChecks').hidden=false;displayDataset(data,true);renderHistory();
  }catch(error){if(token===readToken){$('previewStatus').textContent=error.message;showToast(error.message,'error');}}
  finally{if(token===readToken){reading=false;updateSave();}}
}
function displayDataset(data,isPreview){
  dataset=data;page=0;$('purchaseData').hidden=false;$('emptyPurchases').hidden=true;
  $('datasetMode').textContent=isPreview?'ΠΡΟΕΠΙΣΚΟΠΗΣΗ · ΔΕΝ ΕΧΕΙ ΑΠΟΘΗΚΕΥΤΕΙ':'ΑΠΟΘΗΚΕΥΜΕΝΗ ΕΙΣΑΓΩΓΗ';
  $('datasetTitle').textContent=periodText(data.year,data.months);
  $('datasetSource').textContent=(isPreview?preview.fileName:selectedImport.file_name)+(isPreview?'':' · Ανέβηκε '+date(selectedImport.imported_at));
  $('metricItems').textContent=formatNum(data.items.length);
  const sum=months=>data.items.reduce((s,i)=>s+PC.aggregate(i,months).value,0);
  $('metricValue').textContent=money(sum(data.months));$('metricCoverage').textContent='καθαρή αξία · '+data.months.length+' μήνες';
  for(const half of [1,2]){const months=data.months.filter(m=>half===1?m<=6:m>6);$('metricH'+half).textContent=months.length?money(sum(months)):'—';$('metricH'+half+'Coverage').textContent=months.length?periodText(data.year,months)+(months.length<6?' · έως διαθέσιμο μήνα':''):'Δεν καλύπτεται από το αρχείο';}
  const monthly=data.months.map(month=>({month,value:sum([month])}));const max=Math.max(1,...monthly.map(m=>Math.abs(m.value)));
  $('monthlyBars').innerHTML=monthly.map(m=>'<div class="month-bar-cell" title="'+PC.MONTHS[m.month-1]+': '+money(m.value)+'"><span class="month-value">'+new Intl.NumberFormat('el-GR',{notation:'compact',maximumFractionDigits:0}).format(m.value)+' €</span><div class="month-bar-track"><div class="month-bar '+(m.month>6?'h2':'')+'" style="height:'+Math.max(1,Math.abs(m.value)/max*100)+'%"></div></div><span class="month-bar-label">'+PC.MONTHS[m.month-1].slice(0,3)+'</span></div>').join('');
  const movements=PC.movementCounts(data);
  $('qualitySummary').innerHTML='<div class="quality-line"><span>Περίοδος</span><strong>'+data.months.length+' μήνες</strong></div><div class="quality-line"><span>Εξαιρούμενα είδη</span><strong>'+data.excluded.length+'</strong></div><div class="quality-line"><span>Αρνητικές κινήσεις προμηθευτών</span><strong>'+movements.returns+'</strong></div><div class="quality-line"><span>Μεταφορές στις μονάδες</span><strong>'+movements.transfers+'</strong></div><div class="quality-line"><span>Παρατηρήσεις ελέγχου</span><strong>'+data.warnings.length+'</strong></div>';
  $('qualityList').innerHTML=data.excluded.map(e=>'<div class="quality-detail"><strong>'+escapeHtml(e.code)+'</strong> · '+escapeHtml(e.description)+'<br>Δεν εισάγεται.</div>').join('')+data.warnings.map(w=>'<div class="quality-detail"><strong>'+escapeHtml(w.code)+'</strong> · '+escapeHtml(w.message)+'</div>').join('');
  $('purchasePeriod').innerHTML='<option value="all">Όλοι οι μήνες</option>'+([1,2].map(h=>data.months.some(m=>h===1?m<=6:m>6)?'<option value="h'+h+'">'+(h===1?'Α΄':'Β΄')+' εξάμηνο'+(data.months.filter(m=>h===1?m<=6:m>6).length<6?' (διαθέσιμοι μήνες)':'')+'</option>':'').join(''))+data.months.map(m=>'<option value="'+m+'">'+PC.MONTHS[m-1]+'</option>').join('');
  $('purchaseCategory').innerHTML='<option value="">Όλες οι κατηγορίες</option>'+[...new Set(data.items.map(i=>i.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).map(c=>'<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>').join('');
  $('purchaseSearch').value='';$('purchaseSort').value='value:desc';renderItems();
}
function selectedMonths(){const value=$('purchasePeriod').value;return dataset.months.filter(m=>value==='all'||value==='h1'&&m<=6||value==='h2'&&m>6||Number(value)===m);}
function pctHtml(change){if(!change)return '<span class="muted">—</span>';const pct=change.pct*100;return '<span class="price-pct '+(pct>.05?'up':pct<-.05?'down':'flat')+'" title="'+PC.MONTHS[change.first-1]+' → '+PC.MONTHS[change.last-1]+'">'+(pct>0?'+':'')+pct.toFixed(1)+'%</span>';}
function renderItems(){
  if(!dataset)return;
  const query=PC.norm($('purchaseSearch').value),category=$('purchaseCategory').value,months=selectedMonths();
  filtered=dataset.items.filter(i=>(!category||i.category===category)&&(!query||PC.norm([i.code,i.description,i.supplier,...i.months.flatMap(m=>m.suppliers.map(s=>s.name))].join(' ')).includes(query))).map(item=>({item,...PC.aggregate(item,months),change:PC.priceChange(item,months),latest:PC.latestPrice(item,months)}));
  const [sort,direction]=$('purchaseSort').value.split(':');
  const sortValue=r=>sort==='description'?r.item.description:sort==='supplier'?r.item.supplier:sort==='change'?r.change?.pct:sort==='latest'?r.latest?.price:r[sort];
  filtered.sort((a,b)=>{
    const av=sortValue(a),bv=sortValue(b);
    const aEmpty=av==null||av==='',bEmpty=bv==null||bv==='';
    if(aEmpty!==bEmpty)return aEmpty?1:-1;
    const comparison=aEmpty?0:typeof av==='string'?av.localeCompare(bv,'el',{numeric:true,sensitivity:'base'}):av-bv;
    return (direction==='asc'?comparison:-comparison)||a.item.description.localeCompare(b.item.description,'el')||a.item.code.localeCompare(b.item.code);
  });
  document.querySelectorAll('[data-sort-header]').forEach(th=>{
    const active=th.dataset.sortHeader===sort;
    th.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');
    th.querySelector('.sort-arrow').textContent=active?(direction==='asc'?'↑':'↓'):'↕';
  });
  page=Math.min(page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
  $('itemCount').textContent='· '+formatNum(filtered.length)+' είδη';
  $('purchaseRows').innerHTML=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(r=>'<tr data-code="'+escapeHtml(r.item.code)+'" tabindex="0" role="button" aria-label="Ιστορικό '+escapeHtml(r.item.description)+'"><td><span class="item-desc" title="'+escapeHtml(r.item.description)+'">'+escapeHtml(r.item.description)+'</span><span class="item-code">'+escapeHtml(r.item.code)+(r.hasReturns?' <span class="return-tag">περιλαμβάνει επιστροφές</span>':'')+(r.hasTransfers?' <span class="transfer-tag">μεταφορές στις μονάδες · '+formatNum(r.transferQuantity)+' τεμ.</span>':'')+'</span></td><td><div class="supplier-name" title="'+escapeHtml(r.item.supplier)+'">'+escapeHtml(r.item.supplier||'—')+'</div></td><td class="right num">'+formatNum(r.quantity)+'</td><td class="right money num">'+money(r.value)+'</td><td class="right num">'+price(r.price)+'</td><td class="right num">'+(r.latest?price(r.latest.price)+'<span class="item-code">'+PC.MONTHS[r.latest.month-1]+(r.latest.hasReturns?' · με επιστροφές':'')+'</span>':'—')+'</td><td class="right">'+pctHtml(r.change)+'</td><td>›</td></tr>').join('')||'<tr><td colspan="8" class="empty-panel">Δεν βρέθηκαν είδη.</td></tr>';
  $('purchaseRows').querySelectorAll('[data-code]').forEach(row=>{row.addEventListener('click',()=>openItem(row.dataset.code));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openItem(row.dataset.code);}});});
  $('pageLabel').textContent=(filtered.length?page*PAGE_SIZE+1:0)+'–'+Math.min(filtered.length,(page+1)*PAGE_SIZE)+' / '+formatNum(filtered.length);$('prevPage').disabled=page===0;$('nextPage').disabled=(page+1)*PAGE_SIZE>=filtered.length;
}
async function saveImport(){
  if(!checkedMode()||$('saveImport').disabled)return;
  const draft=preview;saving=true;updateSave();$('saveImport').textContent='Αποθήκευση…';$('excelFile').disabled=true;$('importYear').disabled=true;
  try{
    // A single database INSERT commits the complete snapshot atomically.
    const data=draft.data,total=data.items.reduce((s,i)=>s+PC.aggregate(i,data.months).value,0);
    const record={file_name:draft.fileName,file_hash:draft.fileHash,content_hash:draft.contentHash,purchase_year:data.year,months:data.months,item_count:data.items.length,total_value:Math.round(total*100)/100,warning_count:data.warnings.length,negative_count:data.negativeCount,dataset:data};
    const {data:saved,error}=await db.from('medisavings_purchase_imports').insert(record).select(metadataColumns).single();
    if(error){if(error.code==='23505')throw new Error('Το ίδιο αρχείο ή τα ίδια δεδομένα έχουν ήδη εισαχθεί.');throw error;}
    snapshots.set(saved.id,data);imports.unshift(saved);selectedImport=saved;preview=null;$('reviewChecks').hidden=true;$('previewStatus').textContent='Η εισαγωγή αποθηκεύτηκε επιτυχώς · '+date(saved.imported_at);$('excelFile').value='';displayDataset(data,false);renderHistory();$('importControls').open=false;showToast('Αποθηκεύτηκε το ιστορικό αγορών.');
  }catch(error){showToast(error.message||'Η εισαγωγή δεν αποθηκεύτηκε. Δοκίμασε ξανά.','error');console.error(error);}
  finally{saving=false;$('excelFile').disabled=false;$('importYear').disabled=false;$('saveImport').innerHTML=appIcon('plus')+' Αποθήκευση εισαγωγής';updateSave();}
}
async function openItem(code){
  const openToken=++itemOpenToken;
  const item=dataset.items.find(i=>i.code===code);if(!item)return;
  $('itemCode').textContent=code+' · '+dataset.year;$('itemTitle').textContent=item.description;$('itemSupplier').textContent=item.supplier||'—';
  const total=PC.aggregate(item,dataset.months),latest=PC.latestPrice(item,dataset.months);
  $('itemMetrics').innerHTML=[['Ποσότητα',formatNum(total.quantity)],['Αξία αγορών',money(total.value)],['Μέση τιμή',price(total.price)],['Τιμή τελευταίου μήνα'+(latest?' · '+PC.MONTHS[latest.month-1]:''),latest?price(latest.price):'—']].map(([label,value])=>'<div class="item-metric"><span class="muted">'+label+'</span><strong class="num">'+value+'</strong></div>').join('');
  renderItemValues(item,dataset.year);
  $('itemMonths').innerHTML=item.months.map(m=>{const a=PC.aggregate(item,[m.month]);return '<tr><td>'+PC.MONTHS[m.month-1]+'</td><td class="right num">'+formatNum(a.quantity)+'</td><td class="right money">'+money(a.value)+'</td><td class="right">'+price(a.price)+'</td><td class="month-supplier">'+m.suppliers.map(s=>(PC.isTransfer(s)?'<span class="transfer-tag">Μεταφορά στις μονάδες</span> ':'')+escapeHtml(s.name)+' ('+formatNum(s.quantity)+' / '+money(s.value)+')').join('<br>')+'</td></tr>';}).join('');
  $('itemVersions').textContent=imports.length?'Φόρτωση ιστορικού…':'Το ιστορικό αρχείων θα εμφανιστεί μετά την πρώτη αποθήκευση.';
  $('itemDialog').showModal();
  $('itemDialog').scrollTop=0;
  $('itemPriceBars').scrollLeft=0;
  $('itemDialog').querySelector('.purchase-table-wrap').scrollLeft=0;
  const otherYear=dataset.year===2026?2025:dataset.year===2025?2026:null;
  const otherImport=imports.find(i=>i.purchase_year===otherYear);
  if(otherYear&&!otherImport)$('itemComparison').textContent='Ανέβασε το αναλυτικό Excel του '+otherYear+' για σύγκριση του ίδιου κωδικού.';
  if(otherImport){$('itemComparison').textContent='Φόρτωση σύγκρισης '+otherYear+'…';try{const other=await getSnapshot(otherImport.id);if(openToken!==itemOpenToken)return;const match=other.items.find(i=>i.code===code);if(match){renderItemValues(item,dataset.year,{year:otherYear,item:match,months:other.months});$('itemComparison').textContent+=' Πηγή '+otherYear+': '+otherImport.file_name+' · '+date(otherImport.imported_at)+'.';}else $('itemComparison').textContent='Ο κωδικός '+code+' δεν περιλαμβάνεται στο τελευταίο αρχείο του '+otherYear+'.';}catch(error){if(openToken===itemOpenToken)$('itemComparison').textContent='Δεν φορτώθηκε η σύγκριση. Κλείσε και άνοιξε ξανά το είδος.';}}
  try{const versions=await Promise.all(imports.filter(i=>i.purchase_year===dataset.year).map(async i=>{const d=await getSnapshot(i.id),match=d.items.find(it=>it.code===code);return {meta:i,item:match};}));if($('itemCode').textContent!==code+' · '+dataset.year)return;
    $('itemVersions').innerHTML=versions.map(v=>{const a=v.item?PC.aggregate(v.item,v.meta.months):null;return '<div class="version-row"><div>'+escapeHtml(v.meta.file_name)+'<small>'+date(v.meta.imported_at)+' · '+periodText(v.meta.purchase_year,v.meta.months)+'</small></div><div>'+(a?money(a.value)+' · '+formatNum(a.quantity):'Δεν περιλαμβάνεται')+'<small>'+(a?'Μέση τιμή '+price(a.price):'')+'</small></div></div>';}).join('')||'<p class="muted">Δεν υπάρχει προηγούμενη εισαγωγή για το έτος.</p>';
  }catch(error){$('itemVersions').textContent='Δεν φορτώθηκε το ιστορικό αρχείων.';}
}
function exportReport(){
  if(!dataset)return;
  const months=selectedMonths(),label=periodText(dataset.year,months);
  const rows=[['Περίοδος',label],['Πηγή',preview?.fileName||selectedImport?.file_name||''],['Κατάσταση',preview?'Μη αποθηκευμένη προεπισκόπηση':'Αποθηκευμένη εισαγωγή'],[],['Κωδικός','Περιγραφή','Εταιρεία','Κατηγορία','Ποσότητα','Αξία','Μέση τιμή αγοράς','Τιμή τελευταίου μήνα (μηνιαία μέση)','Τελευταίος μήνας','Μεταβολή μέσης τιμής %','Επιστροφές','Μεταφορές μονάδων (τεμ.)','Ποσότητα χωρίς μεταφορές','Αξία χωρίς μεταφορές']];
  filtered.forEach(r=>rows.push([r.item.code,r.item.description,r.item.supplier,r.item.category,r.quantity,r.value,r.price,r.latest?.price??null,r.latest?PC.MONTHS[r.latest.month-1]:'',r.change?r.change.pct*100:null,r.hasReturns?'Ναι':'Όχι',r.transferQuantity,r.purchaseQuantity,r.purchaseValue]));
  const monthly=[['Έτος','Μήνας','Κωδικός','Περιγραφή','Καθαρή ποσότητα Excel','Αξία Excel','Μέση τιμή αγοράς χωρίς μεταφορές','Μεταφορές μονάδων (τεμ.)','Ποσότητα χωρίς μεταφορές','Αξία χωρίς μεταφορές']];
  filtered.forEach(r=>r.item.months.filter(m=>months.includes(m.month)).forEach(m=>{const a=PC.aggregate(r.item,[m.month]);monthly.push([dataset.year,PC.MONTHS[m.month-1],r.item.code,r.item.description,a.quantity,a.value,a.price,a.transferQuantity,a.purchaseQuantity,a.purchaseValue]);}));
  const audit=[['Κωδικός','Παρατήρηση'],...dataset.excluded.map(e=>[e.code,'Εξαιρείται: '+e.reason]),...dataset.warnings.map(w=>[w.code,w.message])];
  const wb=XLSX.utils.book_new();for(const [name,data] of [['Σύνοψη',rows],['Ανά μήνα',monthly],['Έλεγχοι',audit]]){const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=[{wch:18},{wch:52},{wch:35},{wch:24},{wch:16},{wch:18},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,name);}XLSX.writeFile(wb,'MediSavings-αγορές-'+dataset.year+'-'+$('purchasePeriod').value+'.xlsx');
}
$('chooseExcel').addEventListener('click',()=>{if(!saving&&checkedMode()){$('importControls').open=true;$('excelFile').click();}});
$('excelFile').addEventListener('change',e=>readFile(e.target.files[0]));
$('importYear').addEventListener('change',()=>{const file=$('excelFile').files[0];if(file)readFile(file);else if(preview){preview=null;updateSave();$('reviewChecks').hidden=true;$('previewStatus').textContent='Επίλεξε ξανά το αρχείο για το νέο έτος.';}});
for(const event of ['dragenter','dragover'])$('dropZone').addEventListener(event,e=>{e.preventDefault();$('dropZone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('dropZone').addEventListener(event,e=>{e.preventDefault();$('dropZone').classList.remove('dragging');if(event==='drop')readFile(e.dataTransfer.files[0]);});
$('reviewAccepted').addEventListener('change',updateSave);$('saveImport').addEventListener('click',saveImport);
$('cancelPreview').addEventListener('click',()=>{if(saving)return;readToken++;reading=false;preview=null;$('excelFile').value='';$('reviewChecks').hidden=true;$('previewStatus').hidden=true;updateSave();if(imports.length)selectImport(imports[0].id);else{dataset=null;$('purchaseData').hidden=true;$('emptyPurchases').hidden=false;}});
$('refreshHistory').addEventListener('click',()=>refresh(!preview));
for(const id of ['purchaseSearch','purchasePeriod','purchaseCategory','purchaseSort'])$(id).addEventListener(id==='purchaseSearch'?'input':'change',()=>{page=0;renderItems();});
document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{const [key,direction]=$('purchaseSort').value.split(':');$('purchaseSort').value=button.dataset.sort+':'+(key===button.dataset.sort&&direction==='asc'?'desc':'asc');page=0;renderItems();}));
$('prevPage').addEventListener('click',()=>{page--;renderItems();});$('nextPage').addEventListener('click',()=>{page++;renderItems();});$('exportReport').addEventListener('click',exportReport);$('closeItem').addEventListener('click',()=>$('itemDialog').close());
refresh(true);
