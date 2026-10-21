import {RULE_VERSION,SCREENING_THRESHOLDS} from './health-model.mjs';
export function screeningText(){
 const d=SCREENING_THRESHOLDS.DANGER,r=SCREENING_THRESHOLDS.RISK;
 return {
 danger:`SYS ≥ ${d.sys} หรือ DIA ≥ ${d.dia} | SpO₂ < ${d.spo2}% | DTX ≥ ${d.sugar} | Temp ≥ ${d.temp}°C`,
 risk:`หากไม่ถึง DANGER: SYS ≥ ${r.sys} หรือ DIA ≥ ${r.dia} | SpO₂ < ${r.spo2}% | DTX ≥ ${r.sugar} | Temp ≥ ${r.temp}°C`,
 normal:`NORMAL เมื่อค่าที่ใช้ประเมินครบและไม่ถึงเกณฑ์ข้างต้น; ค่าขาดหรือใช้ไม่ได้เป็น UNKNOWN (${RULE_VERSION})`
 };
}
export function blueprintEvidence(state={}){
 const counts=state.counts||{};
 const ready=state.phase==='ready';const stale=state.phase==='stale';const available=ready||stale;
 const values=['total','NORMAL','RISK','DANGER','UNKNOWN'].map(k=>counts[k]);
 const consistent=values.every(n=>Number.isInteger(n)&&n>=0)&&counts.total===counts.NORMAL+counts.RISK+counts.DANGER+counts.UNKNOWN;
 let kpiStatus='ยังไม่มีข้อมูลที่ยืนยันได้';
 if(state.phase==='unauthorized')kpiStatus='ยังตรวจยอดไม่ได้: ต้องเข้าสู่ระบบ';
 else if(state.phase==='forbidden')kpiStatus='ยังตรวจยอดไม่ได้: บัญชีไม่มีสิทธิ์';
 else if(state.phase==='error')kpiStatus='ยังตรวจยอดไม่ได้: โหลดข้อมูลไม่สำเร็จ';
 else if(available&&consistent)kpiStatus=`${counts.total} = ${counts.NORMAL} ปกติ + ${counts.RISK} เสี่ยง + ${counts.DANGER} อันตราย + ${counts.UNKNOWN} ไม่ครบ${stale?' (ข้อมูลเดิม; ซิงค์ล่าสุดไม่สำเร็จ)':''}`;
 else if(available)kpiStatus='ยอดไม่สอดคล้องกัน ต้องตรวจข้อมูล';
 const boundaryStatus=state.boundary==='ready'?'โหลด boluang.json แล้ว; คำนวณใน browser':state.boundary==='error'?'โหลดขอบเขตไม่สำเร็จ; ยังไม่สรุปคนนอกเขต':'ยังไม่ได้ยืนยันไฟล์ขอบเขต';
 const privacyStatus=`ปกปิดข้อมูล ${state.masking===false?'OFF':'ON'}; ${state.authorized?'API ยืนยันบัญชีแล้ว':'API ยังไม่ยืนยันบัญชี'}; ยังไม่ได้ตรวจนโยบาย RLS`;
 return {kpiStatus,boundaryStatus,privacyStatus,privacyBadge:`ปกปิดข้อมูล: ${state.masking===false?'OFF':'ON'}`,spatialBadge:state.boundary==='ready'?'GIS: GeoJSON โหลดแล้ว':'GIS: ยังไม่ยืนยัน',kpiLabel:'สมการทะเบียนตามตัวกรอง รวมรายการที่ข้อมูลไม่ครบ',...screeningText()};
}
// Only existing text nodes are updated. No replacement layout or styles.
export function renderBlueprint(root,state){const evidence=blueprintEvidence(state);for(const node of root.querySelectorAll('[data-blueprint]')){const key=node.getAttribute('data-blueprint');if(Object.hasOwn(evidence,key))node.textContent=evidence[key];}}
