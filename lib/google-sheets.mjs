import {createHash,createSign} from 'node:crypto';
import {measurement,numberOrNull,validCoordinates} from './health-model.mjs';
export const DEFAULT_SPREADSHEET='1sMbr_fqnYrvr-8qZFTbBcAJsu_EGLEtFAvUTc4Tx6fw';
export const DEFAULT_TAB='ผู้มีสุขภาวะพึ่งพิง';
const required=['วันเวลา','ชื่อ-สกุล','ที่อยู่','ละติจูด','ลองจิจูด','ลิงก์รูปภาพ'];
const optional={patient_code:'รหัสผู้รับบริการ',patient_id:'รหัสฐานข้อมูล',target_group:'กลุ่มเป้าหมาย',care_project:'หน่วยบริการ',bp_sys:'SYS',bp_dia:'DIA',pulse:'ชีพจร',spo2:'SpO2',pi_pct:'PI',blood_sugar:'น้ำตาล',temp_c:'อุณหภูมิ',weight_kg:'น้ำหนัก',height_cm:'ส่วนสูง'};
const error=(message,status=503)=>Object.assign(new Error(message),{status});
export function sheetTimestamp(value){
 if(typeof value==='number'&&Number.isFinite(value)&&value>0){const d=new Date(Date.UTC(1899,11,30)+value*86400000-7*3600000);return Number.isNaN(d.getTime())?null:d.toISOString();}
 if(typeof value!=='string'||!value.trim())return null;
 const s=value.trim();let d;
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))d=new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(s)?s:s+'+07:00');
 else return null; // Never guess locale-dependent date strings.
 return Number.isNaN(d.getTime())?null:d.toISOString();
}
export function parseSheet(values,{spreadsheetId=DEFAULT_SPREADSHEET,tab=DEFAULT_TAB}={}){
 if(!Array.isArray(values)||!Array.isArray(values[0]))throw error('ชีตไม่ส่งหัวคอลัมน์ที่ระบบรองรับ',502);
 const headers=values[0].map(v=>String(v??'').replace(/^\uFEFF/,'').trim());
 for(const h of required)if(headers.filter(v=>v===h).length!==1)throw error(`หัวคอลัมน์ชีตไม่ถูกต้อง: ${h}`,502);
 const get=(row,h)=>{const i=headers.indexOf(h);return i<0?null:row[i]??null;};
 const data=[],warnings={missing_coordinates:0,missing_timestamp:0,unmatched_records:0};const codes=new Set();
 for(let i=1;i<values.length;i++){
  const r=values[i];if(!Array.isArray(r)||r.every(v=>v===null||v===undefined||String(v).trim()===''))continue;
  const name=String(get(r,'ชื่อ-สกุล')??'').trim();if(!name)continue;
  const addr=String(get(r,'ที่อยู่')??'').trim(),moo=addr.match(/หมู่(?:ที่)?\s*(\d{1,2})(?!\d)/);
  const p={id:'sheet:'+createHash('sha256').update(`${spreadsheetId}:${tab}:${i+1}`).digest('hex').slice(0,24),full_name:name,address:addr,village_moo:moo&&Number(moo[1])>=1&&Number(moo[1])<=13?Number(moo[1]):null,latitude:numberOrNull(get(r,'ละติจูด')),longitude:numberOrNull(get(r,'ลองจิจูด')),drive_image_url:get(r,'ลิงก์รูปภาพ'),visited_at:sheetTimestamp(get(r,'วันเวลา')),sensor_logs:[],source:'google_sheets',source_row:i+1,read_only:true};
  for(const [key,header]of Object.entries(optional)){const v=get(r,header);p[key]=['patient_code','patient_id','target_group','care_project'].includes(key)?(v===null||String(v).trim()===''?null:String(v).trim()):measurement(key,v);}
  if(p.patient_code){if(codes.has(p.patient_code))throw error('รหัสผู้รับบริการในชีตซ้ำ กรุณาตรวจต้นทาง',502);codes.add(p.patient_code);}
  if(!validCoordinates(p)){p.latitude=null;p.longitude=null;warnings.missing_coordinates++;}
  if(!p.visited_at)warnings.missing_timestamp++;
  if(!p.patient_code)warnings.unmatched_records++;
  data.push(p);
 }
 return {data,warnings};
}
export function sheetsConfiguration(){
 const provider=process.env.GOOGLE_SHEETS_PROVIDER||'apps_script';
 if(!['apps_script','service_account'].includes(provider))throw error('รูปแบบการเชื่อม Google Sheets ไม่ถูกต้อง');
 return {provider,spreadsheetId:process.env.GOOGLE_SHEETS_ID||DEFAULT_SPREADSHEET,tab:process.env.GOOGLE_SHEETS_TAB||DEFAULT_TAB};
}
async function readJson(response){if(!response.ok)throw error(response.status===403?'Google ไม่อนุญาตให้อ่านชีต กรุณาตรวจสิทธิ์บัญชีที่เชื่อมต่อ':'อ่านข้อมูล Google Sheets ไม่สำเร็จ',502);try{return await response.json();}catch{throw error('Google ส่งข้อมูลที่ไม่ใช่ JSON กรุณาตรวจ deployment',502);}}
let cachedToken=null;
async function serviceToken(){
 let account;try{account=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'{}');}catch{throw error('ตั้งค่าบัญชี Google ฝั่งเซิร์ฟเวอร์ไม่ถูกต้อง');}
 if(!account.client_email||!account.private_key)throw error('ยังไม่ได้ตั้งค่าบัญชีสำหรับอ่าน Google Sheets');
 const keyId=createHash('sha256').update(account.client_email+account.private_key).digest('hex');
 if(cachedToken?.keyId===keyId&&cachedToken.expires>Date.now()+60000)return cachedToken.token;
 const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const message=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const signature=createSign('RSA-SHA256').update(message).sign(account.private_key,'base64url');
 const json=await readJson(await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:message+'.'+signature})}));
 if(typeof json.access_token!=='string')throw error('Google ไม่คืน token สำหรับอ่านชีต',502);
 cachedToken={keyId,token:json.access_token,expires:Date.now()+Math.min(Number(json.expires_in)||3600,3600)*1000};return cachedToken.token;
}
export async function readGoogleSheet(){
 const cfg=sheetsConfiguration();let values;
 if(cfg.provider==='apps_script'){
  const token=process.env.GOOGLE_SHEETS_BRIDGE_TOKEN;if(!token)throw error('ยังไม่ได้ตั้งค่า GOOGLE_SHEETS_BRIDGE_TOKEN ฝั่งเซิร์ฟเวอร์');
  let url;try{url=new URL(process.env.GOOGLE_SHEETS_BRIDGE_URL);}catch{throw error('ยังไม่ได้ตั้งค่า Apps Script URL');}
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||url.search||url.hash||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw error('Apps Script URL ไม่ถูกต้อง');
  const json=await readJson(await fetch(url,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:'list',spreadsheet_id:cfg.spreadsheetId,sheet_name:cfg.tab})}));
  if(json.error)throw error('Apps Script ปฏิเสธการอ่าน กรุณาตรวจ BRIDGE_TOKEN และ deployment',502);
  if(json.schema_version!==1||!Array.isArray(json.values))throw error('กรุณาอัปเดต Apps Script เป็น bridge schema version 1',502);
  if(json.spreadsheet_id!==cfg.spreadsheetId||json.sheet_name!==cfg.tab)throw error('Apps Script ตอบกลับจากชีตที่ไม่ตรงกับการตั้งค่า',502);
  values=json.values;
 }else{
  const token=await serviceToken(),headers={Authorization:`Bearer ${token}`};const base=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}`;
  const meta=await readJson(await fetch(base+'?fields=properties(timeZone),sheets(properties(title,gridProperties))',{headers,signal:AbortSignal.timeout(15000)}));
  if(meta.properties?.timeZone!=='Asia/Bangkok')throw error('ชีตต้องกำหนดเขตเวลา Asia/Bangkok เพื่ออ่านวันที่อย่างถูกต้อง',502);
  const tab=meta.sheets?.find(s=>s.properties.title===cfg.tab)?.properties;if(!tab)throw error('ไม่พบแท็บชีตที่กำหนด',502);
  if(!Number.isInteger(tab.gridProperties.rowCount)||tab.gridProperties.rowCount>10000)throw error('ชีตเกินขอบเขตการอ่าน กรุณากำหนดช่วงข้อมูลก่อน',502);
  const endColumn=String.fromCharCode(64+Math.min(26,tab.gridProperties.columnCount||26));
  const range=`'${cfg.tab.replace(/'/g,"''")}'!A1:${endColumn}${tab.gridProperties.rowCount}`;
  const json=await readJson(await fetch(base+'/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',{headers,signal:AbortSignal.timeout(15000)}));values=json.values;
 }
 const result=parseSheet(values,cfg);return {...result,source:'google_sheets',provider:cfg.provider,read_at:new Date().toISOString()};
}
