/** Private Sheets bridge. Deploy this updated source before using the bridge.
 * Script Properties: BRIDGE_TOKEN (server-only secret), SUPABASE_URL,
 * SUPABASE_KEY (server-side service role key, NEVER placed in a browser).
 * POST {token, action:'list'|'sync'}. GET never returns patient data.
 * The website reads Supabase through authenticated /api/patients only.
 */
function doGet() { return json_({error:'ต้องยืนยันสิทธิ์ผ่านช่องทางสำหรับเจ้าหน้าที่'}); }
function json_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  try {
    const body=JSON.parse(e.postData.contents||'{}');
    const token=PropertiesService.getScriptProperties().getProperty('BRIDGE_TOKEN');
    if(!token||!body.token||body.token!==token)return json_({error:'unauthorized'});
    if(body.action==='list')return json_({data:readPatientsFromSheet_(),synced_at:new Date().toISOString()});
    if(body.action==='sync')return json_(syncSheetToSupabase());
    return json_({error:'unsupported_action'});
  } catch(err) { return json_({error:'bridge_failed'}); }
}
function nullableNumber_(v) {
  if(v===null||v===undefined||String(v).trim()==='')return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
}
function readPatientsFromSheet_() {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ผู้มีสุขภาวะพึ่งพิง');
  if(!sheet)throw new Error('missing_sheet');
  const data=sheet.getDataRange().getValues();
  if(data.length<2)return [];
  const headers=data[0].map(h=>String(h).trim());
  const get=(row,key)=>{const i=headers.indexOf(key);return i<0?null:row[i];};
  for(const key of ['วันเวลา','ชื่อ-สกุล','ที่อยู่','ละติจูด','ลองจิจูด','ลิงก์รูปภาพ']){
    if(headers.indexOf(key)<0)throw new Error('missing_column');
  }
  return data.slice(1).filter(r=>String(get(r,'ชื่อ-สกุล')||'').trim()).map(r=>{
    const raw=get(r,'วันเวลา');const when=raw instanceof Date?raw:null;
    const address=String(get(r,'ที่อยู่')||'').trim();
    const moo=address.match(/หมู่(?:ที่)?\s*(\d+)/);
    // Verified source has location/photo columns only. Never invent clinical data.
    return {full_name:String(get(r,'ชื่อ-สกุล')).trim(),address,
      village_moo:moo?Number(moo[1]):null,
      latitude:nullableNumber_(get(r,'ละติจูด')),longitude:nullableNumber_(get(r,'ลองจิจูด')),
      drive_image_url:get(r,'ลิงก์รูปภาพ')?String(get(r,'ลิงก์รูปภาพ')):null,
      visited_at:when&&!isNaN(when.getTime())?when.toISOString():null,
      temp_c:null,weight_kg:null,height_cm:null,bp_sys:null,bp_dia:null,
      pulse:null,spo2:null,pi_pct:null,blood_sugar:null};
  });
}
function syncSheetToSupabase() {
  // Upsert by full_name was removed: names are not unique patient identifiers.
  // Use an explicitly maintained UUID mapping and the authenticated clinical API
  // to update records, preserving history and optimistic concurrency.
  return {error:'automatic_upsert_disabled',message:'ต้องจับคู่รหัสผู้รับบริการและยืนยันผลตรวจก่อนบันทึกผ่านระบบเจ้าหน้าที่'};
}
