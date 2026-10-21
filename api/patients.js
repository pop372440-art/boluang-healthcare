import {requireUser,upstream,sameOrigin,safeHeaders,fail} from '../lib/server.mjs';
import {assess,validateCheckup} from '../lib/health-model.mjs';
const fields='id,patient_code,full_name,address,drive_image_url,village_moo,latitude,longitude,target_group,care_project,visited_at,bp_sys,bp_dia,pulse,spo2,pi_pct,blood_sugar,temp_c,weight_kg,height_cm,sensor_logs,record_version';
export default async function handler(req,res){
 safeHeaders(res);try{
 const {token,user,role,villages}=await requireUser(req);
 const scope=role==='admin'?'':`&village_moo=in.(${villages.join(',')})`;
 if(req.method==='GET'){
  const rows=[];let offset=0;
  while(true){const batch=await upstream(`/rest/v1/patients_visits?select=${fields}&order=id.asc&limit=500&offset=${offset}${scope}`,{token});rows.push(...batch);if(batch.length<500)break;offset+=500;if(offset>=100000)throw Object.assign(new Error('ข้อมูลมากเกินขอบเขต กรุณาติดต่อผู้ดูแล'),{status:503});}
  return res.status(200).json({data:rows,synced_at:new Date().toISOString()});
 }
 if(req.method==='POST'){
  sameOrigin(req);if(!['clinician','admin'].includes(role))return res.status(403).json({error:'บัญชีนี้ดูข้อมูลได้อย่างเดียว'});
  const body=req.body||{};
  if(!/^[0-9a-f-]{36}$/i.test(body.id||'')||!Number.isInteger(body.record_version))return res.status(400).json({error:'รหัสรายการไม่ถูกต้อง'});
  let values;try{values=validateCheckup(body);}catch(e){return res.status(400).json({error:e.message});}
  const match=`id=eq.${body.id}&record_version=eq.${body.record_version}${scope}`;
  const rows=await upstream(`/rest/v1/patients_visits?select=${fields}&${match}`,{token});
  if(rows.length!==1)return res.status(409).json({error:'ข้อมูลเปลี่ยนแล้ว กรุณาซิงค์ใหม่ก่อนบันทึก'});
  const previous=rows[0];if(previous.sensor_logs!==null&&!Array.isArray(previous.sensor_logs))return res.status(409).json({error:'รูปแบบประวัติเดิมไม่ถูกต้อง กรุณาให้ผู้ดูแลตรวจสอบก่อนบันทึก'});if(new Date(values.visited_at)<new Date(previous.visited_at))return res.status(400).json({error:'วันเวลาตรวจต้องไม่ก่อนรายการล่าสุด'});
  const risk=assess(values);const log={...values,inspector_id:user.id,recorded_at:new Date().toISOString(),risk: risk.level,rule_version:risk.version};
  const history=Array.isArray(previous.sensor_logs)?previous.sensor_logs:[];
  const saved=await upstream(`/rest/v1/patients_visits?${match}`,{token,method:'PATCH',headers:{Prefer:'return=representation'},body:{...values,risk_level:risk.level==='UNKNOWN'?null:risk.level,sensor_logs:[...history,log],record_version:body.record_version+1}});
  if(saved.length!==1)return res.status(409).json({error:'มีผู้บันทึกข้อมูลพร้อมกัน กรุณาซิงค์ใหม่'});
  return res.status(200).json({ok:true});
 }
 res.setHeader('Allow','GET, POST');return res.status(405).json({error:'ไม่รองรับคำขอนี้'});
 }catch(e){fail(res,e);}
}
