import {assess,LABELS,LIMITS,measurement,filtered,summarize,validCoordinates,inBoundary,thaiTime,validateCheckup} from './lib/health-model.mjs';
const $=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
let rows=[],visible=[],geo=null,map=null,markers=null,border=null,villageBorder=null,street=null,satellite=null,page=0,masked=true,active=null,session=null,loadedAt=null;
const colors={NORMAL:'#187047',RISK:'#c08900',DANGER:'#c12a53',UNKNOWN:'#667085'};
const fieldNames={bp_sys:'ความดัน SYS (mmHg)',bp_dia:'ความดัน DIA (mmHg)',pulse:'ชีพจร (ครั้ง/นาที)',spo2:'SpO₂ (%)',blood_sugar:'น้ำตาล (mg/dL)',temp_c:'อุณหภูมิ (°C)',weight_kg:'น้ำหนัก (kg)',height_cm:'ส่วนสูง (cm)',pi_pct:'PI (%)'};
const nameOf=p=>masked?`ผู้รับบริการ ${p.id.slice(0,8)}`:p.full_name;
const value=(p,k)=>measurement(k,p[k])??'—';
function clock(){$('clock').textContent=thaiTime(new Date().toISOString());}clock();setInterval(clock,60000);
// Remove legacy browser caches. Health records are kept in memory only.
for(const key of ['boluang_cloud_cfg','boluang_patients','boluang_offline_queue'])localStorage.removeItem(key);
async function api(path,options={}){
 const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...options});
 const data=await r.json();if(!r.ok){if(r.status===401)lock();throw new Error(data.error||'เชื่อมต่อไม่สำเร็จ');}return data;
}
function lock(){rows=[];visible=[];session=null;loadedAt=null;active=null;$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;$('rows').replaceChildren();$('detailBody').replaceChildren();$('details').close();$('checkup').close();$('checkupForm').reset();if(markers)markers.clearLayers();}
async function unlock(s){session=s;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;initMap();map?.invalidateSize();await sync();}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;$('loginError').textContent='';try{const s=await api('/api/session',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});$('password').value='';await unlock(s);}catch(err){$('password').value='';$('loginError').textContent=err.message;}finally{btn.disabled=false;}});
$('logout').onclick=async()=>{try{await api('/api/session',{method:'DELETE'});}catch(e){$('loginError').textContent=e.message;}finally{lock();}};
async function sync(){
 $('sync').disabled=true;$('syncStatus').textContent='กำลังโหลดข้อมูลจริง…';
 try{const data=await api('/api/patients');rows=data.data;loadedAt=data.synced_at;page=0;populateFilters();render();$('syncStatus').textContent=`ซิงค์สำเร็จ ${thaiTime(loadedAt)} · ${rows.length} รายการในสิทธิ์ของคุณ`;}catch(e){$('syncStatus').textContent=`ซิงค์ไม่สำเร็จ: ${e.message}${loadedAt?' · ข้อมูลเดิม ณ '+thaiTime(loadedAt):''}`;}finally{$('sync').disabled=false;}
}
$('sync').onclick=sync;
function populateFilters(){
 for(const [id,key] of [['moo','village_moo'],['unit','care_project'],['group','target_group']]){
  const select=$(id),current=select.value;while(select.options.length>1)select.remove(1);
  for(const v of [...new Set(rows.map(p=>p[key]).filter(v=>v!==null&&v!==undefined&&v!==''))].sort((a,b)=>String(a).localeCompare(String(b),'th',{numeric:true}))){const op=new Option(id==='moo'?`หมู่ ${v}`:v,v);select.add(op);}select.value=current;
 }
}
function filters(){return Object.fromEntries(['query','moo','unit','group','risk'].map(k=>[k,$(k).value]));}
for(const id of ['query','moo','unit','group','risk'])$(id).addEventListener(id==='query'?'input':'change',()=>{page=0;render();});
$('reset').onclick=()=>{for(const id of ['query','moo','unit','group','risk'])$(id).value='';page=0;render();};
$('mask').onclick=()=>{masked=!masked;$('mask').textContent=`ปกปิดข้อมูล: ${masked?'เปิด':'ปิด'}`;$('mask').setAttribute('aria-pressed',String(masked));render();if(active)detail(active);};
function render(){
 visible=filtered(rows,filters());const s=summarize(visible,geo);$('kpis').replaceChildren();
 for(const [key,label] of [['total','รายการตามตัวกรอง'],['NORMAL','เหมาะสมตามเกณฑ์ระบบ'],['RISK','มีความเสี่ยง'],['DANGER','อันตราย'],['UNKNOWN','ข้อมูลไม่ครบ'],['outside','พิกัดนอกขอบเขต']]){
  const box=text('div','',`kpi ${key}`);box.append(text('span',label),text('strong',s[key].toLocaleString('th-TH')),text('small',key==='total'?'จากทะเบียนจริง':key==='outside'?`ยังระบุเขตไม่ได้ ${s.spatialUnknown} รายการ`:`${s.total?(s[key]/s.total*100).toFixed(1):'0.0'}%`));$('kpis').append(box);
 }
 renderTable();renderStats();renderMarkers();
}
function renderTable(){
 $('rows').replaceChildren();const pages=Math.max(1,Math.ceil(visible.length/25));page=Math.min(page,pages-1);
 for(const p of visible.slice(page*25,(page+1)*25)){
  const tr=document.createElement('tr');const a=assess(p);const bmi=measurement('weight_kg',p.weight_kg)!==null&&measurement('height_cm',p.height_cm)!==null?(p.weight_kg/(p.height_cm/100)**2).toFixed(1):'—';
  for(const v of [nameOf(p),p.village_moo??'—',p.target_group||'ไม่ระบุ',LABELS[a.level],`${value(p,'bp_sys')}/${value(p,'bp_dia')}`,value(p,'pulse'),value(p,'spo2'),value(p,'blood_sugar'),value(p,'temp_c'),value(p,'weight_kg'),bmi,thaiTime(p.visited_at)])tr.append(text('td',v));
  tr.children[3].className=a.level;const td=document.createElement('td'),btn=text('button','ดูรายละเอียด');btn.onclick=()=>detail(p.id);td.append(btn);tr.append(td);$('rows').append(tr);
 }
 if(!visible.length){const td=text('td','ไม่พบข้อมูลตามตัวกรอง');td.colSpan=13;const tr=document.createElement('tr');tr.append(td);$('rows').append(tr);}
 $('page').textContent=`หน้า ${page+1} / ${pages} · ${visible.length} รายการ`;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;
}
$('prev').onclick=()=>{page--;renderTable();};$('next').onclick=()=>{page++;renderTable();};
function renderStats(){
 $('statsRows').replaceChildren();for(let moo=1;moo<=13;moo++){
  if(session?.role!=='admin'&&!session?.villages.includes(moo))continue;
  const s=summarize(visible.filter(p=>p.village_moo===moo),geo),tr=document.createElement('tr');for(const v of [moo,s.total,s.NORMAL,s.RISK,s.DANGER,s.UNKNOWN])tr.append(text('td',v));$('statsRows').append(tr);
 }
 const unknown=visible.filter(p=>!Number.isInteger(p.village_moo)||p.village_moo<1||p.village_moo>13);if(unknown.length){const s=summarize(unknown,geo),tr=document.createElement('tr');for(const v of ['ไม่ระบุหมู่',s.total,s.NORMAL,s.RISK,s.DANGER,s.UNKNOWN])tr.append(text('td',v));$('statsRows').append(tr);}
}
function initMap(){
 if(map)return;if(!window.L){$('mapStatus').textContent='โหลดเครื่องมือแผนที่ไม่สำเร็จ ยังดูข้อมูลในตารางได้';return;}
 map=L.map('map').setView([18.16,98.38],11);markers=L.layerGroup().addTo(map);
 street=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
 satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'© Esri World Imagery'});
 for(const layer of [street,satellite]){layer.on('tileerror',()=>{$('mapStatus').textContent='โหลดภาพแผนที่บางส่วนไม่สำเร็จ ลองเปลี่ยนชั้นแผนที่หรือตรวจเครือข่าย';});layer.on('load',()=>{$('mapStatus').textContent='';});}
 if(geo){border=L.geoJSON(geo,{style:{color:'#535c90',weight:2,fillOpacity:.03}}).addTo(map);map.fitBounds(border.getBounds());}
 fetch('/block.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(g=>{villageBorder=L.geoJSON(g,{style:{color:'#718797',weight:1,fillOpacity:0}});if($('villageBoundary').checked)villageBorder.addTo(map);}).catch(()=>{$('mapStatus').textContent='โหลดขอบเขตหมู่บ้านไม่สำเร็จ';});
 renderMarkers();
}
function renderMarkers(){
 const located=visible.filter(validCoordinates);$('mapCount').textContent=`มีพิกัด ${located.length} / ${visible.length} รายการ · ไม่มีพิกัด ${visible.length-located.length}`;
 if(!markers)return;markers.clearLayers();
 for(const p of located){
  const color=colors[assess(p).level],marker=L.circleMarker([p.latitude,p.longitude],{radius:8,color,fillColor:color,fillOpacity:.8});
  const box=document.createElement('div');box.append(text('strong',nameOf(p)),text('div',LABELS[assess(p).level]));const btn=text('button','ดูรายละเอียด');btn.onclick=()=>detail(p.id);box.append(btn);marker.bindPopup(box).addTo(markers);
 }
}
$('fit').onclick=()=>{if(!map)return;const points=visible.filter(validCoordinates).map(p=>[p.latitude,p.longitude]);if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[40,40],maxZoom:16});else if(border)map.fitBounds(border.getBounds());};
$('baseMap').onclick=()=>{if(!map)return;const isStreet=map.hasLayer(street);map.removeLayer(isStreet?street:satellite);(isStreet?satellite:street).addTo(map);$('baseMap').textContent=isStreet?'แผนที่ถนน':'ภาพดาวเทียม';};
$('boundary').onchange=()=>{if(map&&border){if($('boundary').checked)border.addTo(map);else map.removeLayer(border);}};
$('villageBoundary').onchange=()=>{if(map&&villageBorder){if($('villageBoundary').checked)villageBorder.addTo(map);else map.removeLayer(villageBorder);}};
for(const btn of document.querySelectorAll('[data-view]'))btn.onclick=()=>{for(const id of ['map','table','stats'])$(id+'View').hidden=id!==btn.dataset.view;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===btn));if(btn.dataset.view==='map'){initMap();map?.invalidateSize();}};
function detail(id){
 const p=rows.find(p=>p.id===id);if(!p)return;active=id;const a=assess(p);$('detailTitle').textContent=nameOf(p);$('detailBody').replaceChildren();
 $('detailBody').append(text('p',masked?'ปกปิดชื่อและที่อยู่แล้ว':p.address||'ไม่ระบุที่อยู่'),text('p',`ตรวจล่าสุด: ${thaiTime(p.visited_at)} · ซิงค์ล่าสุด: ${thaiTime(loadedAt)}`),text('p',`${LABELS[a.level]} — ${a.reasons.join(' / ')}`,a.level));
 const grid=text('div','','detailsGrid');for(const [k,label] of Object.entries(fieldNames)){const cell=document.createElement('div');cell.append(text('small',label),text('strong',value(p,k)));grid.append(cell);}$('detailBody').append(grid,text('h3','ประวัติที่บันทึกจริง'));
 const history=Array.isArray(p.sensor_logs)?p.sensor_logs:[];
 if(!history.length)$('detailBody').append(text('p','ยังไม่มีประวัติการตรวจ ไม่มีการสร้างลำดับการส่งค่าจำลอง'));
 else{const wrap=text('div','','table-scroll'),table=document.createElement('table');const head=document.createElement('tr');for(const l of ['เวลาตรวจ','SYS','DIA','SpO₂','น้ำตาล','°C','ผู้บันทึก'])head.append(text('th',l));table.append(head);
 for(const log of [...history].reverse()){const tr=document.createElement('tr');for(const v of [thaiTime(log.visited_at||(log.date&&log.time?`${log.date}T${log.time}+07:00`:null)),log.bp_sys??log.sys??'—',log.bp_dia??log.dia??'—',log.spo2??'—',log.blood_sugar??log.sugar??'—',log.temp_c??log.temp??'—',masked?'เจ้าหน้าที่':log.inspector_id||log.inspector||'ไม่ระบุ'])tr.append(text('td',v));table.append(tr);}wrap.append(table);$('detailBody').append(wrap);}
 $('newCheckup').hidden=!['clinician','admin'].includes(session?.role);if(!$('details').open)$('details').showModal();
}
$('closeDetails').onclick=()=>{$('details').close();active=null;};
for(const [key,label] of Object.entries(fieldNames)){
 const input=document.createElement('input');input.name=key;input.type='number';input.min=LIMITS[key][0];input.max=LIMITS[key][1];input.step=['temp_c','weight_kg','pi_pct','blood_sugar'].includes(key)?'0.1':'1';input.placeholder='ไม่ได้วัด';const labelEl=text('label',label);labelEl.append(input);$('measurements').append(labelEl);
}
$('newCheckup').onclick=()=>{
 const p=rows.find(p=>p.id===active);$('checkupForm').reset();$('recordId').value=p.id;$('recordVersion').value=p.record_version;$('visited').value=new Date(Date.now()+7*3600000).toISOString().slice(0,16);$('saveError').textContent='';$('details').close();$('checkup').showModal();
};
$('cancelCheckup').onclick=()=>{$('checkup').close();};
$('checkupForm').onsubmit=async e=>{
 e.preventDefault();const btn=e.submitter;btn.disabled=true;$('saveError').textContent='';
 try{const body=Object.fromEntries(new FormData(e.target));body.visited_at=new Date($('visited').value+':00+07:00').toISOString();validateCheckup(body);body.id=$('recordId').value;body.record_version=Number($('recordVersion').value);await api('/api/patients',{method:'POST',body:JSON.stringify(body)});$('checkup').close();await sync();$('syncStatus').textContent='บันทึกผลตรวจสำเร็จ · '+$('syncStatus').textContent;}catch(err){$('saveError').textContent=err.message;}finally{btn.disabled=false;}
};
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('csv').onclick=()=>{
 const data=[['ผู้รับบริการ','หมู่','กลุ่ม','ระดับ','SYS','DIA','SpO2','น้ำตาล','เวลาตรวจ'],...visible.map(p=>[nameOf(p),p.village_moo,p.target_group,LABELS[assess(p).level],value(p,'bp_sys'),value(p,'bp_dia'),value(p,'spo2'),value(p,'blood_sugar'),thaiTime(p.visited_at)])];
 const url=URL.createObjectURL(new Blob(['\ufeff'+data.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='boluang-healthcare.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{const r=await fetch('/boluang.json');if(!r.ok)throw Error();geo=await r.json();}catch{$('mapStatus').textContent='โหลดขอบเขตตำบลไม่สำเร็จ จึงยังระบุพิกัดนอกเขตไม่ได้';}
try{await unlock(await api('/api/session'));initMap();}catch(e){lock();if(e.message!=='กรุณาเข้าสู่ระบบ')$('loginError').textContent=e.message;}
