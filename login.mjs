async function apiRequest(path,method='GET',body,fetcher=fetch){
 const response=await fetcher(path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 let result;try{result=await response.json();}catch{throw Object.assign(new Error('ระบบเข้าสู่ระบบไม่พร้อมใช้งาน กรุณาลองใหม่'),{status:502});}
 if(!response.ok)throw Object.assign(new Error(result.error||'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'),{status:response.status});
 return result;
}
export const sessionRequest=(method='GET',body,fetcher=fetch)=>apiRequest('/api/session',method,body,fetcher);
export function mountLogin(doc=document,location=window.location){
 const fieldMode=new URLSearchParams(location.search||'').get('mode')==='field';
 if(fieldMode){doc.title='เจ้าหน้าที่ภาคสนาม | บ่อหลวง Health Care';doc.getElementById('loginIntro').textContent='สำหรับเจ้าหน้าที่เทศบาลที่ออกเก็บข้อมูลตามหมู่บ้านเท่านั้น';doc.getElementById('loginTitle').textContent='เจ้าหน้าที่เก็บข้อมูลภาคสนาม';doc.getElementById('loadPatients').textContent='เปิดชุดถ่ายรูปและพิกัด';}
 const form=doc.getElementById('loginForm'),actions=doc.getElementById('adminActions'),message=doc.getElementById('message');
 const email=doc.getElementById('email'),password=doc.getElementById('password');
 const buttons=['signIn','loadPatients','signOut'].map(id=>doc.getElementById(id));let busy=false;
 function show(text,error=false){message.textContent=text;message.dataset.error=String(error);}
 function signedIn(scope){const admin=fieldMode?scope?.canCollectFieldData===true:scope?.role==='admin';form.hidden=admin;actions.hidden=!admin;return admin;}
 async function run(task){if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);try{await task();}catch(e){if(e.status===401)signedIn(null);show(e.message,true);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}}
 form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  show('กำลังเข้าสู่ระบบ…');try{const scope=await sessionRequest('POST',{email:email.value.trim(),password:password.value,...(fieldMode?{fieldOnly:true}:{adminOnly:true})});
   if(!signedIn(scope))throw Error(fieldMode?'เฉพาะเจ้าหน้าที่เทศบาลที่ได้รับสิทธิ์เท่านั้น':'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ');show(fieldMode?'เข้าสู่ระบบแล้ว กดเปิดชุดถ่ายรูปและพิกัด':'เข้าสู่ระบบแล้ว กดปุ่มเพื่อดึงข้อมูลผู้ป่วย');
  }finally{password.value='';}
 });});
 doc.getElementById('loadPatients').addEventListener('click',()=>run(async()=>{
  const scope=await sessionRequest();if(!signedIn(scope)){show(fieldMode?'เฉพาะเจ้าหน้าที่เทศบาลที่ได้รับสิทธิ์เท่านั้น':'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ',true);return;}
  // The existing main-page sync reads patients once, using the HttpOnly session.
  if(fieldMode){const result=await apiRequest('/api/photo-app');const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='script.google.com')throw Error('ที่อยู่ชุดเก็บข้อมูลไม่ถูกต้อง');location.assign(url.href);}else location.assign('/');
 }));
 doc.getElementById('signOut').addEventListener('click',()=>run(async()=>{
  try{await sessionRequest('DELETE');signedIn(null);show('ออกจากระบบแล้ว');email.focus();}catch(e){if(e.status===401){signedIn(null);show('เซสชันหมดอายุแล้ว');}else throw e;}
 }));
 return run(async()=>{try{const scope=await sessionRequest();if(signedIn(scope))show(fieldMode?'เข้าสู่ระบบแล้ว กดเปิดชุดถ่ายรูปและพิกัด':'เข้าสู่ระบบแล้ว กดปุ่มเพื่อดึงข้อมูลผู้ป่วย');else show(fieldMode?'เฉพาะเจ้าหน้าที่เทศบาลที่ได้รับสิทธิ์เท่านั้น':'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ',true);}catch(e){if(e.status===401){signedIn(null);show('กรุณาเข้าสู่ระบบ');}else throw e;}});
}
if(typeof document!=='undefined')mountLogin();
