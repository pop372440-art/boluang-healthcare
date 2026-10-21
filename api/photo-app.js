import {requireUser,safeHeaders,fail} from '../lib/server.mjs';
export default async function handler(req,res){safeHeaders(res);try{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'ไม่รองรับคำขอนี้'});}
 const {role}=await requireUser(req);if(!['admin','clinician'].includes(role))return res.status(403).json({error:'บัญชีนี้ไม่มีสิทธิ์เปิดชุดบันทึกพิกัด'});
 if(process.env.APPS_SCRIPT_PRIVATE!=='true')return res.status(503).json({error:'ต้องตรวจสิทธิ์ Apps Script และอัปเดต deployment ให้เป็นส่วนตัวก่อนเปิดใช้งาน'});
 const url=new URL(process.env.APPS_SCRIPT_URL||'');if(url.protocol!=='https:'||url.hostname!=='script.google.com')throw Error('invalid_photo_app');
 res.status(200).json({url:url.href});
}catch(e){fail(res,e);}}
