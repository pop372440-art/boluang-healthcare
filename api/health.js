import {requireUser,upstream,safeHeaders,fail} from '../lib/server.mjs';
import {readGoogleSheet} from '../lib/google-sheets.mjs';
import {checkConnections} from '../lib/connection-health.mjs';
export default async function handler(req,res){safeHeaders(res);try{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'ไม่รองรับคำขอนี้'});}
 const {token}=await requireUser(req);
 const report=await checkConnections({checkSheet:()=>readGoogleSheet(),checkDatabase:()=>upstream('/rest/v1/patients_visits?select=id&limit=0',{token})});
 return res.status(report.status==='ok'?200:503).json(report);
}catch(e){fail(res,e);}}
