import {upstream,requireUser,sameOrigin,sessionCookie,safeHeaders,fail} from '../lib/server.mjs';
export default async function handler(req,res){
 safeHeaders(res);
 try{
  if(req.method==='POST'){
   sameOrigin(req);const {email,password}=req.body||{};
   if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>1024)return res.status(400).json({error:'กรุณากรอกอีเมลและรหัสผ่าน'});
   const session=await upstream('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   // Check authorization before setting any cookie.
   const {scopeFor}=await import('../lib/server.mjs');const scope=scopeFor(session.user);
   if(req.body?.fieldOnly===true&&!scope.canCollectFieldData)return res.status(403).json({error:'เฉพาะเจ้าหน้าที่เทศบาลที่ได้รับสิทธิ์เก็บข้อมูลภาคสนามเท่านั้น'});
   if(req.body?.adminOnly===true&&scope.role!=='admin')return res.status(403).json({error:'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น'});
   sessionCookie(res,session.access_token,Math.min(session.expires_in||3600,3600));return res.status(200).json(scope);
  }
  if(req.method==='DELETE'){
   sameOrigin(req);const {token}=await requireUser(req);try{await upstream('/auth/v1/logout',{method:'POST',token});}finally{sessionCookie(res,'',0);}return res.status(200).json({ok:true});
  }
  if(req.method==='GET'){const {role,villages,canCollectFieldData}=await requireUser(req);return res.status(200).json({role,villages,canCollectFieldData});}
  res.setHeader('Allow','GET, POST, DELETE');return res.status(405).json({error:'ไม่รองรับคำขอนี้'});
 }catch(e){if(e.status===401||req.method==='DELETE')sessionCookie(res,'',0);fail(res,e);}
}
