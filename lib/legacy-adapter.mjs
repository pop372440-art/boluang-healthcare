import {assess,measurement,numberOrNull,inBoundary} from './health-model.mjs';
export function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function formatNumber(v,digits){const n=numberOrNull(v);return n===null?'—':digits===undefined?String(n):n.toFixed(digits);}
export function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function safePhotoUrl(v){try{const u=new URL(v);return u.protocol==='https:'&&['drive.google.com','lh3.googleusercontent.com'].includes(u.hostname)?u.href:'';}catch{return '';}}
export function toRawPatient(p){return {id:p.id,full_name:p.name,address:p.address,village_moo:p.moo,latitude:p.lat,longitude:p.lng,bp_sys:p.sys,bp_dia:p.dia,pulse:p.pulse,spo2:p.spo2,blood_sugar:p.sugar,temp_c:p.temp,weight_kg:p.weight,height_cm:p.height,pi_pct:p.pi};}
export function toLegacyPatient(row,geo){
 const num=k=>measurement(k,row[k]);
 const when=row.visited_at&&!Number.isNaN(new Date(row.visited_at).getTime())?new Date(row.visited_at):null;
 const parts=when?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(when):[];
 const part=k=>parts.find(p=>p.type===k)?.value;
 const date=when?`${part('year')}-${part('month')}-${part('day')}`:'';
 const time=when?`${part('hour')}:${part('minute')}:${part('second')}`:'';
 const history=Array.isArray(row.sensor_logs)?row.sensor_logs:[];
 const mapLog=log=>{
  const at=log.visited_at?toLegacyDate(log.visited_at):{date:log.date||'',time:log.time||''};
  return {temp:log.temp_c??log.temp??'',weight:log.weight_kg??log.weight??'',height:log.height_cm??log.height??'',sys:log.bp_sys??log.sys??'',dia:log.bp_dia??log.dia??'',pulseBp:log.pulse??log.pulseBp??'',spo2:log.spo2??'',pulseOx:log.pulse??log.pulseOx??'',pi:log.pi_pct??log.pi??'',sugar:log.blood_sugar??log.sugar??'',inspector:log.inspector_id||log.inspector||'ไม่ระบุ',...at};
 };
 const p={id:String(row.id),patientCode:row.patient_code||'',name:String(row.full_name||''),address:String(row.address||''),village:String(row.address||''),moo:numberOrNull(row.village_moo),age:'—',group:String(row.target_group||'ไม่ระบุ'),careUnit:String(row.care_project||'ไม่ระบุ'),lat:numberOrNull(row.latitude),lng:numberOrNull(row.longitude),temp:num('temp_c'),weight:num('weight_kg'),height:num('height_cm'),sys:num('bp_sys'),dia:num('bp_dia'),pulse:num('pulse'),spo2:num('spo2'),pi:num('pi_pct'),sugar:num('blood_sugar'),photoUrl:safePhotoUrl(row.drive_image_url),driveUrl:safePhotoUrl(row.drive_image_url),recordVersion:row.record_version,lastDate:date,lastTime:time,sensorLogs:history.map(mapLog),svgX:null,svgY:null};
 p.bmi=p.weight!==null&&p.height!==null?p.weight/(p.height/100)**2:null;
 const risk=assess(row);p.risk=risk.level;p.condition=risk.reasons.join(' / ');p.outOfArea=inBoundary(row,geo)===false;return p;
}
function toLegacyDate(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return {date:'',time:''};const shifted=new Date(d.getTime()+7*3600000).toISOString();return {date:shifted.slice(0,10),time:shifted.slice(11,19)};}
