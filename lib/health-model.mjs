// Existing project screening thresholds, now shared by API and UI. Not a diagnosis.
export const RULE_VERSION = 'screening-2026-10-v1';
export const LIMITS = {bp_sys:[40,300],bp_dia:[20,200],pulse:[20,250],spo2:[1,100],blood_sugar:[10,1000],temp_c:[25,45],weight_kg:[1,400],height_cm:[30,250],pi_pct:[0,30]};
export const LABELS = {NORMAL:'เหมาะสมตามเกณฑ์ระบบ',RISK:'มีความเสี่ยง',DANGER:'อันตราย',UNKNOWN:'ข้อมูลไม่ครบ'};
export function numberOrNull(v) {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim()) || typeof v === 'boolean') return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}
export function measurement(key,value) {
  const n=numberOrNull(value), range=LIMITS[key];
  return n !== null && range && n >= range[0] && n <= range[1] ? n : null;
}
export function assess(row) {
  const p=Object.fromEntries(Object.keys(LIMITS).map(k=>[k,measurement(k,row[k])]));
  const reasons=[];
  if (p.bp_sys >=160 || p.bp_dia >=100) reasons.push('ความดันถึงเกณฑ์อันตราย');
  if (p.spo2 !== null && p.spo2 <93) reasons.push('ออกซิเจนถึงเกณฑ์อันตราย');
  if (p.blood_sugar >=180) reasons.push('น้ำตาลถึงเกณฑ์อันตราย');
  if (p.temp_c >=38.5) reasons.push('อุณหภูมิถึงเกณฑ์อันตราย');
  if(reasons.length) return {level:'DANGER',reasons,version:RULE_VERSION};
  if(p.bp_sys >=140 || p.bp_dia >=90) reasons.push('ความดันถึงเกณฑ์เสี่ยง');
  if(p.spo2 !== null && p.spo2 <95) reasons.push('ออกซิเจนถึงเกณฑ์เสี่ยง');
  if(p.blood_sugar >=126) reasons.push('น้ำตาลถึงเกณฑ์เสี่ยง');
  if(p.temp_c >=37.5) reasons.push('อุณหภูมิถึงเกณฑ์เสี่ยง');
  if(reasons.length) return {level:'RISK',reasons,version:RULE_VERSION};
  const complete=['bp_sys','bp_dia','spo2','blood_sugar','temp_c'].every(k=>p[k]!==null);
  return {level:complete?'NORMAL':'UNKNOWN',reasons:[complete?'ไม่ถึงเกณฑ์เสี่ยงของระบบ':'ข้อมูลที่ใช้ประเมินยังไม่ครบ'],version:RULE_VERSION};
}
export function validCoordinates(p) {
  const lat=numberOrNull(p.latitude),lng=numberOrNull(p.longitude);
  return lat!==null && lng!==null && Math.abs(lat)<=90 && Math.abs(lng)<=180 && !(lat===0 && lng===0);
}
export function inBoundary(p,geo) {
  if(!validCoordinates(p)||!geo) return null;
  const x=Number(p.longitude),y=Number(p.latitude);
  function ring(coords) {
    let inside=false;
    for(let i=0,j=coords.length-1;i<coords.length;j=i++) {
      const [xi,yi]=coords[i],[xj,yj]=coords[j];
      const cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
      if(Math.abs(cross)<1e-10 && x>=Math.min(xi,xj)&&x<=Math.max(xi,xj)&&y>=Math.min(yi,yj)&&y<=Math.max(yi,yj)) return true;
      if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  }
  const geometries=geo.type==='FeatureCollection'?geo.features.map(f=>f.geometry):[geo.type==='Feature'?geo.geometry:geo];
  const polygons=geometries.flatMap(g=>g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[]);
  if(!polygons.length) return null;
  return polygons.some(poly=>ring(poly[0])&&!poly.slice(1).some(ring));
}
export function filtered(rows,f={}) {
  const q=(f.query||'').trim().toLocaleLowerCase('th');
  return rows.filter(p=>(!f.moo||String(p.village_moo)===String(f.moo))&&(!f.unit||p.care_project===f.unit)&&(!f.group||p.target_group===f.group)&&(!f.risk||assess(p).level===f.risk)&&(!q||[p.full_name,p.address,p.patient_code,p.care_project].join(' ').toLocaleLowerCase('th').includes(q)));
}
export function summarize(rows,geo) {
  const s={total:rows.length,NORMAL:0,RISK:0,DANGER:0,UNKNOWN:0,located:0,outside:0,spatialUnknown:0};
  for(const p of rows){s[assess(p).level]++;if(validCoordinates(p))s.located++;const inside=inBoundary(p,geo);if(inside===false)s.outside++;if(inside===null)s.spatialUnknown++;}return s;
}
export function thaiTime(v) {
  if(!v||Number.isNaN(new Date(v).getTime())) return 'ไม่ระบุ';
  return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(v));
}
export function validateCheckup(body) {
  const values={};
  for(const key of Object.keys(LIMITS)) {
    const raw=body[key];values[key]=measurement(key,raw);
    if(raw!==null&&raw!==undefined&&String(raw).trim()!==''&&values[key]===null) throw new Error(`ค่าตรวจ ${key} ไม่อยู่ในช่วงที่รับได้`);
    if(['bp_sys','bp_dia','pulse','spo2','height_cm'].includes(key)&&values[key]!==null&&!Number.isInteger(values[key]))throw new Error(`ค่าตรวจ ${key} ต้องเป็นจำนวนเต็ม`);
  }
  if(Object.values(values).every(v=>v===null))throw new Error('กรุณากรอกค่าที่วัดได้อย่างน้อยหนึ่งรายการ');
  if(values.bp_sys!==null&&values.bp_dia!==null&&values.bp_sys<=values.bp_dia)throw new Error('SYS ต้องมากกว่า DIA');
  const time=new Date(body.visited_at);
  if(!body.visited_at||Number.isNaN(time.getTime())||time.getTime()>Date.now()+300000)throw new Error('วันเวลาตรวจไม่ถูกต้อง');
  return {...values,visited_at:time.toISOString()};
}
