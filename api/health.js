import {requireUser,upstream,safeHeaders,fail} from '../lib/server.mjs';
import {readGoogleSheet} from '../lib/google-sheets.mjs';
export default async function handler(req,res){safeHeaders(res);try{
 const {token}=await requireUser(req);const source=process.env.HEALTHCARE_SOURCE||'google_sheets';
 if(source==='google_sheets'){await readGoogleSheet();return res.status(200).json({status:'ok',source,upstream:'reachable',timestamp:new Date().toISOString()});}
 if(source!=='supabase')return res.status(503).json({error:'ตั้งค่าแหล่งข้อมูลไม่ถูกต้อง'});
 await upstream('/rest/v1/patients_visits?select=id&limit=0',{token});res.status(200).json({status:'ok',source,database:'reachable',timestamp:new Date().toISOString()});
}catch(e){fail(res,e);}}
