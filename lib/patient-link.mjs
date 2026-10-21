// Registry identity/location remains owned by Sheets; clinical fields remain owned by Supabase.
export const CLINICAL_FIELDS=['bp_sys','bp_dia','pulse','spo2','pi_pct','blood_sugar','temp_c','weight_kg','height_cm'];
export const CLINICAL_SELECT=['id','patient_code','village_moo','target_group','care_project','visited_at','sensor_logs',...CLINICAL_FIELDS].join(',');
const code=value=>typeof value==='string'?value.trim():'';
export function linkClinicalRecords(registry,clinical){
 const sheetCounts=new Map(),byCode=new Map();
 for(const row of registry){const key=code(row.patient_code);if(key)sheetCounts.set(key,(sheetCounts.get(key)||0)+1);}
 for(const row of clinical){const key=code(row.patient_code);if(key){const list=byCode.get(key)||[];list.push(row);byCode.set(key,list);}}
 const report={status:'ready',linked:0,unmatched:0,ambiguous:0};
 const data=registry.map(row=>{
  const key=code(row.patient_code),matches=byCode.get(key)||[];
  if(!key||matches.length===0){report.unmatched++;return {...row,link_status:'unmatched'};}
  if(sheetCounts.get(key)!==1||matches.length!==1||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(matches[0].id||'')){report.ambiguous++;return {...row,link_status:'ambiguous'};}
  const visit=matches[0];report.linked++;
  return {...row,...Object.fromEntries(CLINICAL_FIELDS.map(field=>[field,visit[field]??null])),registry_recorded_at:row.visited_at,visited_at:visit.visited_at??null,sensor_logs:Array.isArray(visit.sensor_logs)?visit.sensor_logs:[],target_group:row.target_group||visit.target_group||null,care_project:row.care_project||visit.care_project||null,clinical_record_id:visit.id,clinical_source:'supabase',link_status:'linked',read_only:true};
 });
 return {data,linkage:report};
}
export async function enrichRegistry(registry,{read,scope=''}){
 const codes=[...new Set(registry.map(row=>code(row.patient_code)).filter(Boolean))];
 if(!codes.length)return {data:registry.map(row=>({...row,link_status:'unmatched'})),linkage:{status:'missing_codes',linked:0,unmatched:registry.length,ambiguous:0}};
 if(codes.length>1000)return {data:registry,linkage:{status:'capacity_exceeded',linked:0,unmatched:registry.length,ambiguous:0}};
 const rows=[];
 try{for(let i=0;i<codes.length;i+=100){
  const quoted=codes.slice(i,i+100).map(c=>'"'+c.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(',');
  const query=new URLSearchParams({select:CLINICAL_SELECT,patient_code:`in.(${quoted})`,order:'id.asc',limit:'501'});
  const batch=await read('/rest/v1/patients_visits?'+query+scope);
  if(!Array.isArray(batch)||batch.length>500)throw Error('unbounded clinical response');rows.push(...batch);
 }
 return linkClinicalRecords(registry,rows);
 }catch{return {data:registry,linkage:{status:'unavailable',linked:0,unmatched:registry.length,ambiguous:0}};}
}
