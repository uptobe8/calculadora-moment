
(() => {
  'use strict';

  const DB_NAME = 'moment_energia_internal_db';
  const DB_VERSION = 1;
  const STORE = 'leads';
  const OLD_STORE = 'momentenergia_leads_v1';
  const WA = '34621280363';
  const EMAIL = 'momentenergia5.0@gmail.com';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const euro = n => Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:Number(n)%1?2:0,maximumFractionDigits:2}) + ' €';
  const today = () => new Date().toISOString().slice(0,10);

  let dbPromise = null;
  let memoryFallback = [];

  function toast(msg){
    const old=$('.toast'); if(old) old.remove();
    const t=document.createElement('div');
    t.className='toast';
    t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),2400);
  }

  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){
        reject(new Error('IndexedDB no soportado'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = event => {
        const db = event.target.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store = db.createObjectStore(STORE, {keyPath:'id'});
          store.createIndex('created','created',{unique:false});
          store.createIndex('status','status',{unique:false});
          store.createIndex('city','city',{unique:false});
          store.createIndex('service','service',{unique:false});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Error abriendo BBDD'));
    });
    return dbPromise;
  }

  async function withStore(mode, callback){
    try{
      const db = await openDb();
      return await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        try{ result = callback(store); }catch(err){ reject(err); return; }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Error de transacción'));
        tx.onabort = () => reject(tx.error || new Error('Transacción cancelada'));
      });
    }catch(err){
      // Fallback temporal solo si IndexedDB no existe o está bloqueada.
      if(mode === 'readonly') return callback(memoryApi()).result;
      return callback(memoryApi()).result;
    }
  }

  function memoryApi(){
    return {
      result: null,
      getAll(){ return {onsuccess:null, onerror:null}; },
      put(item){ const i=memoryFallback.findIndex(x=>x.id===item.id); if(i>=0) memoryFallback[i]=item; else memoryFallback.push(item); return {}; },
      delete(id){ memoryFallback=memoryFallback.filter(x=>x.id!==id); return {}; },
      clear(){ memoryFallback=[]; return {}; }
    };
  }

  async function getLeads(){
    try{
      const db = await openDb();
      return await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE,'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||''))));
        req.onerror = () => reject(req.error);
      });
    }catch(err){
      return memoryFallback.slice().sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')));
    }
  }

  async function saveLead(lead){
    try{
      const db = await openDb();
      return await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put(lead);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }catch(err){
      const i=memoryFallback.findIndex(x=>x.id===lead.id);
      if(i>=0) memoryFallback[i]=lead; else memoryFallback.push(lead);
    }
  }

  async function saveMany(leads){
    try{
      const db = await openDb();
      return await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE,'readwrite');
        const store = tx.objectStore(STORE);
        leads.forEach(lead=>store.put(lead));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }catch(err){
      leads.forEach(lead=>{ const i=memoryFallback.findIndex(x=>x.id===lead.id); if(i>=0) memoryFallback[i]=lead; else memoryFallback.push(lead); });
    }
  }

  async function deleteLead(id){
    try{
      const db = await openDb();
      return await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }catch(err){
      memoryFallback = memoryFallback.filter(x=>x.id!==id);
    }
  }

  async function clearLeads(){
    try{
      const db = await openDb();
      return await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }catch(err){
      memoryFallback = [];
    }
  }

  async function migrateOldLocalStorage(){
    try{
      const flag = 'momentenergia_indexeddb_migrated_v1';
      if(localStorage.getItem(flag)==='1') return;
      const old = JSON.parse(localStorage.getItem(OLD_STORE) || '[]');
      if(Array.isArray(old) && old.length) await saveMany(old);
      localStorage.setItem(flag,'1');
    }catch(e){}
  }

  function bindMenu(){
    const btn=$('#menuToggle'), links=$('#navLinks'), scrim=$('#navScrim');
    if(!btn||!links)return;
    const close=()=>{document.body.classList.remove('menu-open');links.classList.remove('open');scrim&&scrim.classList.remove('open');btn.setAttribute('aria-expanded','false')};
    const open=()=>{document.body.classList.add('menu-open');links.classList.add('open');scrim&&scrim.classList.add('open');btn.setAttribute('aria-expanded','true')};
    btn.addEventListener('click',()=>links.classList.contains('open')?close():open());
    scrim&&scrim.addEventListener('click',close);
    links.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }

  function leadFromForm(form){
    const data=Object.fromEntries(new FormData(form).entries());
    return {
      id:'lead_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      created:new Date().toISOString(),
      updated:new Date().toISOString(),
      status:'nuevo',
      source:'formulario_web',
      ...data
    };
  }

  function leadMessage(lead){
    return `Hola, quiero información/reserva con Moment Energía.%0A%0ANombre: ${encodeURIComponent(lead.name||'')}%0ATeléfono: ${encodeURIComponent(lead.phone||'')}%0AEmail: ${encodeURIComponent(lead.email||'')}%0AMunicipio: ${encodeURIComponent(lead.city||'')}%0ADirección: ${encodeURIComponent(lead.address||'')}%0AServicio: ${encodeURIComponent(lead.service||'')}%0AProducto: ${encodeURIComponent(lead.product||'')}%0AFecha preferida: ${encodeURIComponent(lead.date||'')}%0AFranja: ${encodeURIComponent(lead.slot||'')}%0AMensaje: ${encodeURIComponent(lead.message||'')}`;
  }

  function bindBooking(){
    const form=$('#bookingForm'); if(!form)return;
    const params=new URLSearchParams(location.search);
    const service=params.get('servicio'), pack=params.get('pack');
    if(service){ const map={estufa:'Mantenimiento de estufa',caldera:'Mantenimiento de caldera'}; if(map[service]) form.service.value=map[service]; }
    if(pack){ if(pack==='invierno') form.product.value='Aspiradora de cenizas 59,95 €'; if(pack==='confort') form.product.value='Ventilador de techo con luz 149,95 €'; }
    try{
      const calc = JSON.parse(sessionStorage.getItem('moment_calc') || 'null');
      if(calc && form.message && !form.message.value){
        form.message.value = `Cálculo previo: total estimado ${euro(calc.total)} · horas ${calc.hours || 0} · km ${calc.km || 0}.`;
      }
    }catch(e){}
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const lead=leadFromForm(form);
      await saveLead(lead);
      toast('Solicitud guardada en la BBDD interna');
      form.reset();
    });
    const wa=$('#bookingWhatsApp');
    if(wa) wa.addEventListener('click',()=>{ const lead=leadFromForm(form); window.location.href=`https://wa.me/${WA}?text=${leadMessage(lead)}`; });
  }

  function bindCalculator(){
    const form=$('#calcForm'); if(!form)return;
    const result=$('#calcResult');
    const calc=()=>{
      const service=Number($('#calcService').value||0), product=Number($('#calcProduct').value||0), hours=Number($('#calcHours').value||0), km=Number($('#calcKm').value||0);
      const travelHours=hours*25, travelKm=km*0.5, total=service+product+travelHours+travelKm;
      result.innerHTML=`<div class="result-line"><span>Servicio</span><strong>${euro(service)}</strong></div><div class="result-line"><span>Producto</span><strong>${euro(product)}</strong></div><div class="result-line"><span>Desplazamiento por tiempo</span><strong>${euro(travelHours)}</strong></div><div class="result-line"><span>Desplazamiento por km</span><strong>${euro(travelKm)}</strong></div><div class="result-line"><span>Total estimado</span><strong class="total">${euro(total)}</strong></div><div class="alert">Estimación orientativa. Se confirma antes de cerrar la visita.</div>`;
      return {service,product,hours,km,total};
    };
    form.addEventListener('submit',e=>{e.preventDefault();calc();});
    ['calcService','calcProduct','calcHours','calcKm','calcInstall'].forEach(id=>{$('#'+id)?.addEventListener('input',calc)});
    calc();
    $('#calcToBooking')?.addEventListener('click',()=>{ const c=calc(); sessionStorage.setItem('moment_calc',JSON.stringify(c)); location.href='reserva.html'; });
  }

  function dbStatusLabel(){
    const node = $('#dbStatus');
    if(!node) return;
    node.textContent = 'BBDD interna activa: IndexedDB';
  }

  async function renderPanel(){
    const table=$('#leadsTable'); if(!table)return;
    await migrateOldLocalStorage();
    const leads=await getLeads();
    dbStatusLabel();
    const stats=$('#panelStats');
    if(stats){
      const nuevo=leads.filter(x=>x.status==='nuevo').length,
            cont=leads.filter(x=>x.status==='contactado').length,
            cerrado=leads.filter(x=>x.status==='cerrado').length;
      stats.innerHTML=`<article class="stat"><span>Total</span><strong>${leads.length}</strong></article><article class="stat"><span>Nuevos</span><strong>${nuevo}</strong></article><article class="stat"><span>Contactados</span><strong>${cont}</strong></article><article class="stat"><span>Cerrados</span><strong>${cerrado}</strong></article>`;
    }
    table.innerHTML = leads.length ? leads.map(l=>`<tr><td>${(l.created||'').slice(0,10)}</td><td><strong>${l.name||''}</strong><br><span class="muted">${l.phone||''}</span></td><td>${l.service||''}</td><td>${l.product||''}</td><td>${l.city||''}</td><td><button class="status ${l.status||'nuevo'}" data-status="${l.id}">${l.status||'nuevo'}</button></td><td><a class="btn btn-small btn-outline" href="https://wa.me/${WA}?text=${leadMessage(l)}">WhatsApp</a> <button class="btn btn-small btn-danger" data-delete="${l.id}">Borrar</button></td></tr>`).join('') : `<tr><td colspan="7">No hay solicitudes todavía.</td></tr>`;
  }

  async function exportCsv(){
    const leads=await getLeads();
    const headers=['created','updated','status','source','name','phone','email','city','address','service','product','date','slot','message'];
    const csv=[headers.join(',')].concat(leads.map(l=>headers.map(h=>'"'+String(l[h]||'').replaceAll('"','""')+'"').join(','))).join('\n');
    downloadBlob(csv,'leads-moment-energia.csv','text/csv;charset=utf-8');
  }

  async function exportDbJson(){
    const leads=await getLeads();
    const backup={app:'Moment Energía',database:DB_NAME,version:DB_VERSION,exportedAt:new Date().toISOString(),leads};
    downloadBlob(JSON.stringify(backup,null,2),'bbdd-moment-energia.json','application/json;charset=utf-8');
  }

  function downloadBlob(content, filename, type){
    const blob=new Blob([content],{type});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importDbJson(file){
    if(!file) return;
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      const leads=Array.isArray(data) ? data : data.leads;
      if(!Array.isArray(leads)) throw new Error('JSON sin leads');
      await saveMany(leads.map(l=>({updated:new Date().toISOString(),...l})));
      toast('BBDD importada');
      await renderPanel();
    }catch(e){
      toast('No se pudo importar la BBDD');
    }
  }

  function bindPanel(){
    if(!$('#leadsTable'))return;
    renderPanel();
    document.addEventListener('click',async e=>{
      const st=e.target.closest('[data-status]');
      if(st){
        const leads=await getLeads();
        const lead=leads.find(x=>x.id===st.dataset.status);
        if(lead){
          lead.status=lead.status==='nuevo'?'contactado':lead.status==='contactado'?'cerrado':'nuevo';
          lead.updated=new Date().toISOString();
          await saveLead(lead);
          await renderPanel();
        }
      }
      const del=e.target.closest('[data-delete]');
      if(del){
        await deleteLead(del.dataset.delete);
        await renderPanel();
        toast('Lead borrado');
      }
    });
    $('#seedLead')?.addEventListener('click',async()=>{
      await saveLead({id:'lead_'+Date.now(),created:new Date().toISOString(),updated:new Date().toISOString(),status:'nuevo',source:'demo',name:'Cliente ejemplo',phone:'600 000 000',email:'cliente@example.com',city:'Sabadell',address:'Dirección ejemplo',service:'Mantenimiento de estufa',product:'Aspiradora de cenizas 59,95 €',date:today(),slot:'Mañana',message:'Quiere confirmar desplazamiento.'});
      await renderPanel();
    });
    $('#clearLeads')?.addEventListener('click',async()=>{ if(confirm('¿Vaciar todas las solicitudes de la BBDD interna?')){ await clearLeads(); await renderPanel(); toast('BBDD vaciada'); }});
    $('#exportCsv')?.addEventListener('click',exportCsv);
    $('#exportJson')?.addEventListener('click',exportDbJson);
    $('#importJsonBtn')?.addEventListener('click',()=>$('#importJson')?.click());
    $('#importJson')?.addEventListener('change',e=>importDbJson(e.target.files && e.target.files[0]));
  }

  async function init(){
    bindMenu();
    bindBooking();
    bindCalculator();
    bindPanel();
    await migrateOldLocalStorage();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
