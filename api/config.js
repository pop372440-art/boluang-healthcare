import {safeHeaders} from '../lib/server.mjs';
export default function handler(req,res){safeHeaders(res);res.status(200).json({version:'2026.10-audit',configured:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY),authenticationRequired:true});}
