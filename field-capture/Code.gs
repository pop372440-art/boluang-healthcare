// Standalone Apps Script project. Do not paste into the read-only Sheets bridge.
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('บ่อหลวง • เจ้าหน้าที่ภาคสนาม').addMetaTag('viewport','width=device-width, initial-scale=1');}
function doPost(){return ContentService.createTextOutput(JSON.stringify({error:'use_authenticated_collector_ui'})).setMimeType(ContentService.MimeType.JSON);}
function authSettings_(){
 const p=PropertiesService.getScriptProperties();const url=p.getProperty('SUPABASE_URL'),key=p.getProperty('SUPABASE_ANON_KEY');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key||key.indexOf('sb_secret_')===0)throw Error('ผู้ดูแลยังไม่ได้ตั้งค่า Supabase Auth');
 return {url:url,key:key};
}
function authRequest_(path,method,token,body){
 const cfg=authSettings_();let response;
 try{response=UrlFetchApp.fetch(cfg.url+'/auth/v1/'+path,{method:method,muteHttpExceptions:true,followRedirects:false,contentType:'application/json',headers:{apikey:cfg.key,Authorization:'Bearer '+(token||cfg.key)},...(body?{payload:JSON.stringify(body)}:{})});}catch(e){throw Error('บริการเข้าสู่ระบบไม่พร้อมใช้งาน');}
 const status=response.getResponseCode();if(status===429)throw Error('ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอแล้วลองใหม่');
 if(status<200||status>=300)throw Error(status===401||status===400?'เข้าสู่ระบบไม่สำเร็จหรือเซสชันหมดอายุ':'บริการยืนยันบัญชีไม่พร้อมใช้งาน');
 if(status===204)return null;try{return JSON.parse(response.getContentText());}catch(e){throw Error('บริการยืนยันบัญชีตอบกลับไม่ถูกต้อง');}
}
function requireCollector_(token){
 if(typeof token!=='string'||!token||token.length>8192)throw Error('กรุณาเข้าสู่ระบบ');
 const user=authRequest_('user','get',token);const meta=user.app_metadata||{};
 const villages=Array.isArray(meta.field_villages)?meta.field_villages.filter(n=>Number.isInteger(n)&&n>=1&&n<=13):[];
 if(!user.id||!user.email||!user.email_confirmed_at||meta.field_collector!==true||!villages.length)throw Error('บัญชียังไม่ได้รับสิทธิ์เจ้าหน้าที่ภาคสนามและหมู่บ้านรับผิดชอบ');
 return {id:user.id,villages:[...new Set(villages)]};
}
function signInCollector(email,password){
 if(typeof email!=='string'||email.length>254||typeof password!=='string'||!password||password.length>1024)throw Error('กรุณากรอกอีเมลและรหัสผ่าน');
 const session=authRequest_('token?grant_type=password','post',null,{email:email.trim(),password:password});
 const scope=requireCollector_(session.access_token);
 // No refresh token, staff directory, password, or service key is returned.
 return {accessToken:session.access_token,expiresIn:Math.min(session.expires_in||3600,3600),villages:scope.villages};
}
function getCollectorSession(token){const scope=requireCollector_(token);return {villages:scope.villages};}
function signOutCollector(token){
 if(typeof token!=='string'||!token||token.length>8192)return {ok:true};
 authRequest_('logout?scope=local','post',token);return {ok:true};
}
function validateCapture_(payload,scope){
 if(!payload||typeof payload!=='object')throw Error('ข้อมูลไม่ถูกต้อง');
 const text=(value,max)=>typeof value==='string'&&value.trim()&&value.trim().length<=max?value.trim():null;
 const name=text(payload.fullName,160),address=text(payload.address,500),village=payload.village;
 if(!name||!address||!Number.isInteger(village)||!scope.villages.includes(village))throw Error('ข้อมูลชื่อ ที่อยู่ หรือหมู่บ้านไม่ถูกต้องตามสิทธิ์');
 const stated=address.match(/หมู่(?:ที่)?\s*(\d{1,2})(?!\d)/);if(!stated||Number(stated[1])!==village)throw Error('กรุณาระบุหมู่ในที่อยู่ให้ตรงกับหมู่บ้านที่เลือก');
 if(typeof payload.latitude!=='number'||typeof payload.longitude!=='number'||!Number.isFinite(payload.latitude)||!Number.isFinite(payload.longitude)||Math.abs(payload.latitude)>90||Math.abs(payload.longitude)>180)throw Error('กรุณารับพิกัดจริงก่อนบันทึก');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId||''))throw Error('รหัสคำขอไม่ถูกต้อง');
 const match=typeof payload.image==='string'&&payload.image.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
 if(!match||match[2].length>2800000)throw Error('ใช้ภาพ JPEG หรือ PNG ขนาดไม่เกิน 2 MB');
 let bytes;try{bytes=Utilities.base64Decode(match[2]);}catch(e){throw Error('ข้อมูลภาพไม่ถูกต้อง');}
 const b=bytes.map(n=>(n+256)%256);const jpeg=b[0]===255&&b[1]===216&&b[2]===255;const png=[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n);
 if(!bytes.length||bytes.length>2097152||!(match[1]==='jpeg'?jpeg:png))throw Error('ชนิดภาพหรือขนาดภาพไม่ถูกต้อง');
 return {name:name,address:address,village:village,latitude:payload.latitude,longitude:payload.longitude,requestId:payload.requestId,bytes:bytes,mime:'image/'+match[1],extension:match[1]==='jpeg'?'jpg':'png'};
}
function storage_(){
 const props=PropertiesService.getScriptProperties(),sheetId=props.getProperty('CAPTURE_SPREADSHEET_ID'),tab=props.getProperty('CAPTURE_SHEET_NAME'),folderId=props.getProperty('CAPTURE_PHOTO_FOLDER_ID');
 if(!sheetId||!tab||!folderId)throw Error('ผู้ดูแลยังไม่ได้กำหนดพื้นที่บันทึกข้อมูล');
 const sheet=SpreadsheetApp.openById(sheetId).getSheetByName(tab);if(!sheet||sheet.getLastRow()<1)throw Error('ยังไม่ได้เตรียมชีตและหัวคอลัมน์');
 const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(v=>String(v).trim());
 const required=['วันเวลา','ชื่อ-สกุล','ที่อยู่','ละติจูด','ลองจิจูด','ลิงก์รูปภาพ','หมู่ที่','ผู้บันทึก','รหัสรายการ'];
 if(required.some(h=>headers.filter(v=>v===h).length!==1))throw Error('หัวคอลัมน์ไม่ครบหรือซ้ำ กรุณาให้ผู้ดูแลเตรียมชีต');
 if(sheet.getLastRow()>=10000)throw Error('พื้นที่ทะเบียนเต็ม กรุณาติดต่อผู้ดูแล');
 return {sheet:sheet,headers:headers,folder:DriveApp.getFolderById(folderId)};
}
function existingCapture_(store,id,actor){
 const last=store.sheet.getLastRow();if(last<2)return false;
 const found=store.sheet.getRange(2,store.headers.indexOf('รหัสรายการ')+1,last-1,1).createTextFinder(id).matchEntireCell(true).findNext();
 if(!found)return false;
 if(store.sheet.getRange(found.getRow(),store.headers.indexOf('ผู้บันทึก')+1).getValue()!==actor)throw Error('รหัสคำขอซ้ำ กรุณาเริ่มรายการใหม่');return true;
}
function saveCapture(token,payload){
 // Every save revalidates the live user/permission; UI checks alone never authorize writes.
 const scope=requireCollector_(token),capture=validateCapture_(payload,scope);const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('ระบบกำลังบันทึกข้อมูล กรุณาลองใหม่');
 let file,store;
 try{
  store=storage_();if(existingCapture_(store,capture.requestId,scope.id))return {ok:true,id:capture.requestId,duplicate:true};
  file=store.folder.createFile(Utilities.newBlob(capture.bytes,capture.mime,capture.requestId+'.'+capture.extension));
  const safe=value=>/^[=+\-@\t\r]/.test(value)?"'"+value:value;
  const row={'วันเวลา':new Date(),'ชื่อ-สกุล':safe(capture.name),'ที่อยู่':safe(capture.address),'ละติจูด':capture.latitude,'ลองจิจูด':capture.longitude,'ลิงก์รูปภาพ':file.getUrl(),'หมู่ที่':capture.village,'ผู้บันทึก':scope.id,'รหัสรายการ':capture.requestId};
  store.sheet.appendRow(store.headers.map(h=>Object.prototype.hasOwnProperty.call(row,h)?row[h]:''));
  return {ok:true,id:capture.requestId,duplicate:false};
 }catch(e){
  // Confirm a possibly committed append before cleaning up an uploaded file.
  if(file&&store){try{if(existingCapture_(store,capture.requestId,scope.id))return {ok:true,id:capture.requestId,duplicate:true};file.setTrashed(true);}catch(cleanupError){/* Leave private file for owner reconciliation if outcome is uncertain. */}}
  throw Error('บันทึกไม่สำเร็จ กรุณาลองคำขอเดิมอีกครั้งหรือติดต่อผู้ดูแล');
 }finally{lock.releaseLock();}
}
