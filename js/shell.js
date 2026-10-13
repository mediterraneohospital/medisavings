(function(){
  const shapes={list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',chart:'<path d="M4 19h16M7 15V9m5 6V5m5 10v-4"/>',file:'<path d="M14 3H6v18h12V7zM14 3v5h5M9 12h6m-6 4h6"/>',plus:'<path d="M12 5v14M5 12h14"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',arrow:'<path d="m9 5 7 7-7 7"/>',box:'<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9"/>'};
  window.appIcon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[name]||shapes.file)+'</svg>';
  const mode=()=>localStorage.getItem('medisavingsEditMode')==='1';
  function apply(){document.body.classList.toggle('edit-mode',mode());const label=document.getElementById('shellEditLabel');if(label)label.textContent=mode()?'Έξοδος επεξεργασίας':'Λειτουργία επεξεργασίας';}
  apply();
  document.getElementById('shellEditToggle')?.addEventListener('click',()=>{if(mode()){localStorage.removeItem('medisavingsEditMode');apply();if(['purchases.html','add.html'].includes(location.pathname.split('/').pop()))location.href='index.html';}else{const password=prompt('Κωδικός επεξεργασίας:');if(password===null)return;if(password!=='mediterraneo'){showToast('Λάθος κωδικός.','error');return;}localStorage.setItem('medisavingsEditMode','1');apply();}});
  document.getElementById('shellMenu')?.addEventListener('click',()=>document.body.classList.toggle('sidebar-open'));
  window.addEventListener('storage',event=>{if(event.key==='medisavingsEditMode'){apply();if(!mode()&&location.pathname.endsWith('purchases.html'))location.replace('index.html');}});
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=appIcon(el.dataset.icon));
  document.querySelectorAll('.today-label').forEach(el=>el.textContent=new Date().toLocaleDateString('el-GR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Athens'}));
})();
