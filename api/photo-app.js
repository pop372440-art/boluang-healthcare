import {requireUser,safeHeaders,fail} from '../lib/server.mjs';
export default async function handler(req,res){safeHeaders(res);try{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'ไม่รองรับคำขอนี้'});}
 const {canCollectFieldData}=await requireUser(req);if(!canCollectFieldData)return res.status(403).json({error:'เฉพาะเจ้าหน้าที่เทศบาลที่ได้รับสิทธิ์เก็บข้อมูลภาคสนามเท่านั้น'});
 if(process.env.APPS_SCRIPT_PRIVATE!=='true')return res.status(503).json({error:'ชุดเก็บข้อมูลของเจ้าหน้าที่ยังไม่พร้อม ผู้ดูแลต้องจำกัดสิทธิ์ Apps Script ให้เฉพาะเจ้าหน้าที่ก่อนเปิดใช้งาน'});
 const url=new URL(process.env.APPS_SCRIPT_URL||'');if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)||url.search||url.hash)throw Error('invalid_photo_app');
 res.status(200).json({url:url.href});
}catch(e){fail(res,e);}}
