import {safeHeaders} from '../lib/server.mjs';
import {connectionConfig} from '../lib/connection-health.mjs';
export default function handler(req,res){safeHeaders(res);res.status(200).json({version:'2026.10-connection-health',...connectionConfig(),authenticationRequired:true,connectionVerified:false});}
