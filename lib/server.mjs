export function settings() {
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw Object.assign(new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ'),{status:503});
 const parsed=new URL(url);if(parsed.protocol!=='https:')throw Object.assign(new Error('การตั้งค่าไม่ถูกต้อง'),{status:503});
 return {url,key};
}
export function safeHeaders(res){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');}
export function sameOrigin(req){
 const origin=req.headers.origin;const host=req.headers.host;
 let matched=false;try{matched=Boolean(origin)&&new URL(origin).host===host;}catch{}
 if(!matched)throw Object.assign(new Error('คำขอไม่ได้มาจากเว็บไซต์นี้'),{status:403});
}
export async function upstream(path,{token,method='GET',body,headers={},withCount=false}={}) {
 const {url,key}=settings();
 const r=await fetch(url+path,{method,signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:`Bearer ${token||key}`,'Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!r.ok&&path.startsWith('/auth/v1/token'))throw Object.assign(new Error('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบบัญชีหรือรอแล้วลองใหม่'),{status:r.status===429?429:401});
 if(!r.ok)throw Object.assign(new Error(r.status===401?'กรุณาเข้าสู่ระบบใหม่':r.status===403?'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูล':'บริการฐานข้อมูลไม่พร้อมใช้งาน'),{status:r.status===401||r.status===403?r.status:502});
 if(r.status===204)return null;
 const data=await r.json();
 if(withCount){const count=r.headers?.get('content-range')?.match(/\/(\d+)$/);if(!count)throw Object.assign(new Error('ไม่สามารถยืนยันความครบถ้วนของข้อมูลได้'),{status:502});return {data,total:Number(count[1])};}
 return data;
}
export function cookieToken(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-bl_access='))?.slice('__Host-bl_access='.length);}
export function sessionCookie(res,token,maxAge=3600){res.setHeader('Set-Cookie',`__Host-bl_access=${token||''}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);}
export function scopeFor(user){
 const meta=user?.app_metadata||{};const role=meta.healthcare_role;
 if(!['viewer','clinician','admin'].includes(role))throw Object.assign(new Error('บัญชียังไม่ได้รับสิทธิ์ระบบสุขภาพ กรุณาติดต่อผู้ดูแล'),{status:403});
 const villages=Array.isArray(meta.healthcare_villages)?meta.healthcare_villages.filter(n=>Number.isInteger(n)&&n>=1&&n<=13):[];
 if(role!=='admin'&&!villages.length)throw Object.assign(new Error('ยังไม่ได้กำหนดหมู่บ้านที่รับผิดชอบ'),{status:403});
 return {role,villages};
}
export async function requireUser(req){const token=cookieToken(req);if(!token)throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'),{status:401});const user=await upstream('/auth/v1/user',{token});return {token,user,...scopeFor(user)};}
export function fail(res,error){safeHeaders(res);res.status(error.status||500).json({error:error.status?error.message:'ระบบไม่พร้อมใช้งาน กรุณาลองใหม่'});}

// Display capability only; the separate capture app verifies its own session on every save.
export function canCollectFieldData(user){
 const meta=user?.app_metadata||{};
 return Boolean(user?.email_confirmed_at)&&meta.field_collector===true&&Array.isArray(meta.field_villages)&&meta.field_villages.some(n=>Number.isInteger(n)&&n>=1&&n<=13);
}
