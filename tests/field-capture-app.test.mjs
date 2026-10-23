import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../field-capture/Code.gs',import.meta.url),'utf8');
const headers=['วันเวลา','ชื่อ-สกุล','ที่อยู่','ละติจูด','ลองจิจูด','ลิงก์รูปภาพ','หมู่ที่','ผู้บันทึก','รหัสรายการ','รหัสผู้รับบริการ'];
const payload={requestId:'11111111-1111-4111-8111-111111111111',fullName:'synthetic',address:'หมู่ 1',village:1,latitude:18,longitude:98,image:'data:image/jpeg;base64,/9j/2Q=='};
function fixture(){
 const state={user:{id:'synthetic-staff',email:'staff@example.invalid',email_confirmed_at:'2026-01-01',app_metadata:{field_collector:true,field_villages:[1,2]}},rows:[],files:[],sheetCalls:0,locked:false,requests:[],appendFail:false};
 const sheet={getLastRow:()=>state.rows.length+1,getLastColumn:()=>headers.length,getRange:(row,col,numRows,numCols)=>({getValues:()=>[headers],getValue:()=>state.rows[row-2]?.[col-1],createTextFinder:id=>({matchEntireCell(){return this;},findNext(){const i=state.rows.findIndex(r=>r[col-1]===id);return i<0?null:{getRow:()=>i+2};}})}),appendRow:row=>{if(state.appendFail)throw Error('upstream sensitive failure');state.rows.push(row);}};
 const props={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'synthetic-public',CAPTURE_SPREADSHEET_ID:'synthetic-sheet',CAPTURE_SHEET_NAME:'synthetic-tab',CAPTURE_PHOTO_FOLDER_ID:'synthetic-folder'};
 const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},UrlFetchApp:{fetch:(url,options)=>{state.requests.push({url,options});let status=state.authStatus||200;const data=url.includes('/token?')?{access_token:'synthetic-token',refresh_token:'must-not-return',expires_in:3600}:state.user;return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(data)};}},SpreadsheetApp:{openById:()=>{state.sheetCalls++;return {getSheetByName:()=>sheet};}},DriveApp:{getFolderById:()=>({createFile:blob=>{const file={getUrl:()=> 'https://drive.google.com/file/d/synthetic/view',setTrashed:value=>{file.trashed=value;}};state.files.push(file);return file;}})},Utilities:{base64Decode:value=>Array.from(Buffer.from(value,'base64')),newBlob:(bytes,mime,name)=>({bytes,mime,name})},LockService:{getScriptLock:()=>({tryLock:()=>{state.locked=true;return true;},releaseLock:()=>{state.locked=false;}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}});
 vm.runInContext(code,context);return {state,context,props};
}
test('anonymous, expired and editable-only claims fail before storage access',()=>{
 let {context:c,state:s}=fixture();assert.throws(()=>c.saveCapture('',payload),/เข้าสู่ระบบ/);assert.equal(s.sheetCalls,0);
 s.authStatus=401;assert.throws(()=>c.saveCapture('expired',payload));assert.equal(s.sheetCalls,0);
 ({context:c,state:s}=fixture());s.user.app_metadata={healthcare_role:'admin',healthcare_field_collector:true,healthcare_villages:[1]};s.user.user_metadata={field_collector:true,field_villages:[1]};assert.throws(()=>c.saveCapture('token',payload),/สิทธิ์/);assert.equal(s.sheetCalls,0);
});
test('assigned village, address, coordinates and image signature are validated before writes',()=>{
 const {context:c,state:s}=fixture();for(const invalid of [{...payload,village:7},{...payload,address:'หมู่ 2'},{...payload,latitude:999},{...payload,image:'data:image/png;base64,PHNjcmlwdD4='}])assert.throws(()=>c.saveCapture('token',invalid));assert.equal(s.sheetCalls,0);assert.equal(s.files.length,0);
});
test('successful capture is audited and retry is idempotent; each retry revalidates permission',()=>{
 const {context:c,state:s}=fixture();assert.equal(c.saveCapture('token',payload).ok,true);assert.equal(s.rows.length,1);assert.equal(s.files.length,1);assert.equal(s.rows[0][7],'synthetic-staff');assert.equal(s.rows[0][9],'');assert.equal(s.locked,false);
 assert.equal(c.saveCapture('token',payload).duplicate,true);assert.equal(s.files.length,1);s.user.app_metadata.field_collector=false;assert.throws(()=>c.saveCapture('token',payload));assert.equal(s.rows.length,1);assert.equal(s.requests.filter(r=>r.url.endsWith('/user')).length,3);
});
test('formula-like names are quoted and failed append cleans uploaded file',()=>{
 let {context:c,state:s}=fixture();c.saveCapture('token',{...payload,fullName:'=synthetic'});assert.equal(s.rows[0][1],"'=synthetic");
 ({context:c,state:s}=fixture());s.appendFail=true;assert.throws(()=>c.saveCapture('token',payload),/บันทึกไม่สำเร็จ/);assert.equal(s.files[0].trashed,true);assert.equal(s.rows.length,0);assert.equal(s.locked,false);
});
test('login returns no refresh token or directory; user permission is revalidated',()=>{
 const {context:c,state:s}=fixture();const result=c.signInCollector('staff@example.invalid','synthetic');assert.equal(result.accessToken,'synthetic-token');assert.equal(result.refresh_token,undefined);assert.equal(result.password,undefined);assert.equal(s.sheetCalls,0);assert.equal(s.requests.length,2);
});
test('Anyone entry points cannot save anonymously and client never persists credentials',()=>{
 const {context:c,state:s}=fixture();assert.match(c.doPost().text,/use_authenticated/);assert.equal(s.sheetCalls,0);
 const html=readFileSync(new URL('../field-capture/Index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/localStorage|sessionStorage|service_role|refresh_token/);
 const publicNames=[...code.matchAll(/^function ([\w]+)\(/gm)].map(m=>m[1]).filter(n=>!n.endsWith('_'));assert.deepEqual(publicNames,['doGet','doPost','signInCollector','getCollectorSession','signOutCollector','saveCapture']);
});
