import {requireUser,upstream,safeHeaders,fail} from '../lib/server.mjs';
export default async function handler(req,res){safeHeaders(res);try{const {token}=await requireUser(req);await upstream('/rest/v1/patients_visits?select=id&limit=0',{token});res.status(200).json({status:'ok',database:'reachable',timestamp:new Date().toISOString()});}catch(e){fail(res,e);}}
