function doGet(e) {
  if (e && e.parameter && e.parameter.mode === 'api') return getPatientsJsonApi();
  
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบรายงานภาคสนาม')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ฟังก์ชันคำนวณระยะห่างพิกัด (เมตร)
function getDistanceInMeters_(lat1, lon1, lat2, lon2) {
  var R = 6371e3;
  var rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad;
  var dLon = (lon2 - lon1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


function collectorConfig_(){var p=PropertiesService.getScriptProperties();var url=p.getProperty('SUPABASE_URL')||'https://uvtjjhvvtaswzhwhowlj.supabase.co';var key=p.getProperty('SUPABASE_ANON_KEY')||p.getProperty('SUPABASE_KEY');if(!/^https:[/][/][a-z0-9-]+[.]supabase[.]co$/.test(url)||!key)throw Error('ผู้ดูแลต้องตั้ง SUPABASE_URL และ SUPABASE_ANON_KEY ใน Script Properties');return {url:url,key:key};}
function collectorAuthRequest_(path,method,token,body){var c=collectorConfig_();var options={method:method,muteHttpExceptions:true,followRedirects:false,contentType:'application/json',headers:{apikey:c.key,Authorization:'Bearer '+(token||c.key)}};if(body)options.payload=JSON.stringify(body);var r;try{r=UrlFetchApp.fetch(c.url+'/auth/v1/'+path,options);}catch(e){throw Error('บริการเข้าสู่ระบบไม่พร้อมใช้งาน');}var s=r.getResponseCode();if(s===429)throw Error('กรุณารอแล้วลองเข้าสู่ระบบใหม่');if(s<200||s>=300)throw Error('เข้าสู่ระบบไม่สำเร็จหรือเซสชันหมดอายุ');if(s===204)return null;try{return JSON.parse(r.getContentText());}catch(e){throw Error('บริการยืนยันบัญชีตอบกลับไม่ถูกต้อง');}}
function requireCollector_(token){if(typeof token!=='string'||!token||token.length>8192)throw Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่');var u=collectorAuthRequest_('user','get',token);var m=u.app_metadata||{};var admin=m.healthcare_role==='admin';var villages=admin?Array.from({length:13},(_,i)=>i+1):(Array.isArray(m.field_villages)?m.field_villages.filter(n=>Number.isInteger(n)&&n>=1&&n<=13):[]);if(!u.id||!u.email_confirmed_at||(!admin&&m.field_collector!==true)||!villages.length)throw Error('บัญชียังไม่มีสิทธิ์ field_collector และ field_villages ที่ผู้ดูแลอนุมัติ');return {id:u.id,villages:villages};}
function collectorSignIn(email,password){if(typeof email!=='string'||email.length>254||typeof password!=='string'||!password||password.length>1024)throw Error('กรุณากรอกอีเมลและรหัสผ่าน');var s=collectorAuthRequest_('token?grant_type=password','post',null,{email:email.trim(),password:password});var scope=requireCollector_(s.access_token);return {token:s.access_token,villages:scope.villages,expiresIn:Math.min(s.expires_in||3600,3600)};}
function collectorSignOut(token){if(typeof token==='string'&&token&&token.length<8193)collectorAuthRequest_('logout?scope=local','post',token);return {ok:true};}
function processForm(data,token){var lock=null,file=null,sheet=null,headers=null,scope=null;try{
 scope=requireCollector_(token);
 if(!data||!['ผู้มีสุขภาวะพึ่งพิง','ถังดับเพลิง','ไฟกิ่ง'].includes(data.sheetName))throw Error('หมวดหมู่ไม่ถูกต้อง');
 if(!['CHECK','FORCE_NEW'].includes(data.mode||'CHECK'))throw Error('ไม่เขียนทับรายการเดิม กรุณาบันทึกเป็นจุดใหม่');
 if(typeof data.field1!=='string'||!data.field1.trim()||data.field1.length>160||typeof data.field2!=='string'||!data.field2.trim()||data.field2.length>500)throw Error('ข้อมูลชื่อหรือสถานที่ไม่ถูกต้อง');
 var moo=data.field2.match(/หมู่(?:ที่)?\s*(\d{1,2})(?!\d)/);var village=moo?Number(moo[1]):null;if(!scope.villages.includes(village))throw Error('หมู่บ้านไม่อยู่ในสิทธิ์รับผิดชอบ');
 var lat=Number(data.lat),lng=Number(data.lng);if(data.lat===''||data.lng===''||data.lat==null||data.lng==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('พิกัดไม่ถูกต้อง');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestId||''))throw Error('กรุณาโหลดหน้าแอปใหม่ก่อนบันทึก');
 var photo=typeof data.photo==='string'&&data.photo.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);if(!photo||photo[2].length>2800000)throw Error('ใช้ภาพ JPEG หรือ PNG ไม่เกิน 2 MB');var bytes=Utilities.base64Decode(photo[2]);var b=bytes.map(n=>(n+256)%256);var valid=photo[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n);if(!valid||bytes.length>2097152)throw Error('ชนิดหรือขนาดภาพไม่ถูกต้อง');
 lock=LockService.getScriptLock();if(!lock.tryLock(10000)){lock=null;throw Error('ระบบกำลังบันทึก กรุณาลองใหม่');}
 sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.sheetName);if(!sheet||sheet.getLastRow()<1||sheet.getLastRow()>=10000)throw Error('ไม่พบชีตหรือชีตเต็ม');
 headers=sheet.getRange(1,1,1,Math.max(6,sheet.getLastColumn())).getValues()[0].map(v=>String(v));var idCol=headers.indexOf('รหัสรายการ'),actorCol=headers.indexOf('ผู้บันทึก(UID)');var values=sheet.getDataRange().getValues();
 if(idCol>=0)for(var r=1;r<values.length;r++){if(values[r][idCol]===data.requestId){if(actorCol<0||values[r][actorCol]!==scope.id)throw Error('รหัสคำขอซ้ำ');return {status:'SUCCESS',message:'คำขอนี้บันทึกไว้แล้ว'};}}
 if((data.mode||'CHECK')==='CHECK')for(var i=1;i<values.length;i++){var oldMoo=String(values[i][2]||'').match(/หมู่(?:ที่)?\s*(\d{1,2})(?!\d)/);if(!oldMoo||Number(oldMoo[1])!==village)continue;var oldLat=values[i][3],oldLng=values[i][4];var distance=oldLat!==''&&oldLng!==''&&Number.isFinite(Number(oldLat))&&Number.isFinite(Number(oldLng))?getDistanceInMeters_(lat,lng,Number(oldLat),Number(oldLng)):Infinity;if(distance<=15||(String(values[i][1]).trim()===data.field1.trim()&&String(values[i][2]).trim()===data.field2.trim()))return {status:'DUPLICATE',rowNumber:i+1,existingField1:String(values[i][1]),existingField2:String(values[i][2]),distance:Number.isFinite(distance)?Math.round(distance):0};}
 var p=PropertiesService.getScriptProperties();var folderId=p.getProperty('CAPTURE_PHOTO_FOLDER_ID');var folder;if(folderId)folder=DriveApp.getFolderById(folderId);else{var folders=DriveApp.getFoldersByName('FieldSurvey_Photos');if(!folders.hasNext())throw Error('ผู้ดูแลต้องตั้ง CAPTURE_PHOTO_FOLDER_ID');folder=folders.next();if(folders.hasNext())throw Error('มีโฟลเดอร์ชื่อซ้ำ กรุณาตั้ง CAPTURE_PHOTO_FOLDER_ID');}if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('โฟลเดอร์รูปต้องจำกัดสิทธิ์เฉพาะบัญชีที่อนุญาตก่อน');
 file=folder.createFile(Utilities.newBlob(bytes,'image/'+photo[1],data.requestId+(photo[1]==='jpeg'?'.jpg':'.png')));
 ['รหัสรายการ','ผู้บันทึก(UID)','หมู่ที่รับผิดชอบ'].forEach(function(h){if(headers.indexOf(h)<0){headers.push(h);sheet.getRange(1,headers.length).setValue(h);}});
 var safe=v=>/^[=+\-@\t\r]/.test(v)?"'"+v:v;var row=Array(headers.length).fill('');row.splice(0,6,new Date(),safe(data.field1.trim()),safe(data.field2.trim()),lat,lng,file.getUrl());row[headers.indexOf('รหัสรายการ')]=data.requestId;row[headers.indexOf('ผู้บันทึก(UID)')]=scope.id;row[headers.indexOf('หมู่ที่รับผิดชอบ')]=village;sheet.appendRow(row);return {status:'SUCCESS',message:'บันทึกข้อมูลจุดใหม่พร้อมผู้บันทึกเรียบร้อยแล้ว'};
 }catch(e){if(file&&sheet&&headers){try{var records=sheet.getDataRange().getValues();var idIndex=headers.indexOf('รหัสรายการ');if(idIndex>=0&&records.slice(1).some(row=>row[idIndex]===data.requestId&&row[headers.indexOf('ผู้บันทึก(UID)')]===scope.id))return {status:'SUCCESS',message:'ตรวจพบว่าคำขอนี้บันทึกแล้ว'};file.setTrashed(true);}catch(cleanupError){}}
 return {status:'ERROR',message:file?'บันทึกไม่สำเร็จ กรุณาลองคำขอเดิมอีกครั้ง':e.message||'บันทึกไม่สำเร็จ'};
 }finally{if(lock)lock.releaseLock();}}
