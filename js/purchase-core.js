/* Monthly Excel snapshots. Never writes material_changes or material_periods. */
(function(root) {
  'use strict';
  const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
  const EXCLUDED = new Set(['10293000']);
  const norm = v => String(v ?? '').normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase();
  const text = v => String(v ?? '').trim();
  function number(v, row) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    throw new Error('Μη αριθμητική ποσότητα ή αξία στη γραμμή ' + row + '.');
  }
  const close = (a,b) => Math.abs(a-b) <= 0.011;
  function parseRows(rows, year) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Επίλεξε έγκυρο έτος.');
    let current = null, columns = [], coverage = null;
    const items = [], excluded = [], warnings = [], seen = new Set();
    function finish() {
      if (!current) return;
      if (EXCLUDED.has(current.code)) { excluded.push({code:current.code,description:current.description,reason:'Εξαίρεση κατόπιν επιλογής σας'}); current=null; return; }
      if (seen.has(current.code)) throw new Error('Διπλός κωδικός είδους: ' + current.code);
      seen.add(current.code);
      if (!current.hasDetail) {
        warnings.push({code:current.code,message:'Χωρίς αναλυτικές αγορές — δεν εισάγεται.'}); current=null; return;
      }
      current.months = [...current.monthMap.values()].sort((a,b)=>a.month-b.month);
      if (current.reported) {
        for (const col of columns) {
          const actual = current.monthMap.get(col.month) || {quantity:0,value:0};
          if (!close(actual.quantity,number(current.reported[col.index],current.totalRow)) || !close(actual.value,number(current.reported[col.index+1],current.totalRow))) {
            warnings.push({code:current.code,message:'Διαφορά μεταξύ προμηθευτών και συνόλου ('+MONTHS[col.month-1]+'). Διατηρείται η γραμμή συνόλου του Excel.'});
          }
          const m=current.monthMap.get(col.month);
          if(m){m.quantity=number(current.reported[col.index],current.totalRow);m.value=number(current.reported[col.index+1],current.totalRow);}
        }
      } else warnings.push({code:current.code,message:'Χωρίς γραμμή συνόλων· χρησιμοποιούνται οι αναλυτικές γραμμές.'});
      const totalCol = columns.at(-1)?.index + 2;
      if (current.reported && totalCol && norm(current.monthHeader[totalCol]).startsWith('συνολα')) {
        const q=current.months.reduce((s,m)=>s+m.quantity,0), v=current.months.reduce((s,m)=>s+m.value,0);
        current.reportedTotal={quantity:number(current.reported[totalCol],current.totalRow),value:number(current.reported[totalCol+1],current.totalRow)};
        if (!close(q,current.reportedTotal.quantity) || !close(v,current.reportedTotal.value)) warnings.push({code:current.code,message:'Το άθροισμα μηνών διαφέρει από το συνολικό ποσό/ποσότητα του Excel. Οι υπολογισμοί βασίζονται στους μήνες.'});
      }
      const {monthMap,reported,monthHeader,totalRow,hasDetail,...item}=current;
      items.push(item); current=null;
    }
    for (let i=0;i<rows.length;i++) {
      const r=rows[i];
      if (typeof r[0] === 'number' && r[1]!=null && text(r[2])) {
        finish(); columns=[];
        current={code:text(r[1]),description:text(r[2]),supplier:text(r[3]),category:text(r[4]),group:text(r[5]),monthMap:new Map(),hasDetail:false};
        continue;
      }
      if (!current) continue;
      const found=[];
      r.forEach((cell,index)=>{ const month=MONTHS.findIndex(m=>norm(m)===norm(cell)); if(month>=0) found.push({month:month+1,index}); });
      if (found.length) {
        const months=found.map(c=>c.month);
        if (new Set(months).size!==months.length) throw new Error('Επαναλαμβανόμενος μήνας στη γραμμή '+(i+1));
        if (coverage && coverage.join(',')!==months.join(',')) throw new Error('Οι περίοδοι των ειδών δεν συμφωνούν.');
        coverage=months; columns=found; current.monthHeader=r;
      } else if (norm(r[2])==='συνολα') {
        if(current.reported) throw new Error('Διπλή γραμμή συνόλων για '+current.code);
        current.reported=r;current.totalRow=i+1;
      } else if (typeof r[1]==='number' && r[2]!=null && columns.length) {
        current.hasDetail=true;
        for (const c of columns) {
          const quantity=number(r[c.index],i+1), value=number(r[c.index+1],i+1);
          if (!current.monthMap.has(c.month)) current.monthMap.set(c.month,{month:c.month,quantity:0,value:0,suppliers:[]});
          const m=current.monthMap.get(c.month); m.quantity+=quantity; m.value+=value;
          if(quantity!==0 || value!==0) m.suppliers.push({code:text(r[2]),name:text(r[3]),quantity,value});
        }
      }
    }
    finish();
    if (!coverage?.length || !items.length) throw new Error('Δεν αναγνωρίστηκε αναλυτικό Excel αγορών ανά μήνα. Χρησιμοποίησε το αναλυτικό αρχείο.');
    const negativeCount=items.reduce((s,item)=>s+item.months.reduce((n,m)=>n+m.suppliers.filter(p=>p.quantity<0||p.value<0).length,0),0);
    return {version:1,year,months:coverage,items,excluded,warnings,negativeCount};
  }
  function parseWorkbook(workbook,year,XLSX) {
    if(workbook.SheetNames.length!==1) throw new Error('Απαιτείται αρχείο με ένα φύλλο αναλυτικών αγορών.');
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null});
    // Preserve formatted numeric material codes, including leading zeroes.
    rows.forEach((r,i)=>{if(typeof r[0]==='number') {const cell=sheet[XLSX.utils.encode_cell({r:i,c:1})]; if(cell?.t==='n') r[1]=cell.w || XLSX.utils.format_cell(cell);}});
    return parseRows(rows,year);
  }
  function aggregate(item,months) {
    const entries=item.months.filter(m=>months.includes(m.month));
    const quantity=entries.reduce((s,m)=>s+m.quantity,0),value=entries.reduce((s,m)=>s+m.value,0);
    const hasReturns=entries.some(m=>m.suppliers.some(p=>p.quantity<0||p.value<0));
    return {quantity,value,price:quantity>0&&value>=0 ? value/quantity : null,hasReturns};
  }
  function priceChange(item,months) {
    const valid=item.months.filter(m=>months.includes(m.month)&&m.quantity>0&&m.value>0&&m.suppliers.every(p=>p.quantity>=0&&p.value>=0));
    if(valid.length<2) return null;
    const first=valid[0],last=valid.at(-1),base=first.value/first.quantity;
    return {pct:(last.value/last.quantity-base)/base,first:first.month,last:last.month};
  }
  const api={MONTHS,EXCLUDED,norm,parseRows,parseWorkbook,aggregate,priceChange};
  root.PurchaseCore=api;
  if(typeof module!=='undefined') module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
