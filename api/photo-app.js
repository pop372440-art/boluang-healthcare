import {safeHeaders} from '../lib/server.mjs';
// Retire old bookmarks without exposing the separately managed capture URL.
export default function handler(req,res){safeHeaders(res);return res.status(410).json({error:'แยกชุดถ่ายรูปและพิกัดออกจากเว็บนี้แล้ว กรุณาใช้แอปเจ้าหน้าที่โดยตรง'});}
