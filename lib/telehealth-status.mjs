export function syncStatus({phase,source,syncedAt,total,visible,unknown,unclassified,linkage}){
 if(phase==='unauthorized')return 'กรุณาเข้าสู่ระบบเพื่อดึงข้อมูลผู้ป่วย';
 if(phase==='forbidden')return 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูล';
 if(phase==='loading')return 'กำลังดึงข้อมูลจากแหล่งข้อมูลจริง…';
 if(!syncedAt)return 'ยังไม่ได้รับข้อมูลจริง กรุณากดเชื่อมต่อหรือซิงค์';
 const time=new Date(syncedAt);const stamp=Number.isNaN(time.getTime())?'ไม่ทราบเวลา':time.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 const parts=[phase==='stale'?'ข้อมูลเดิม: ซิงค์ครั้งล่าสุดไม่สำเร็จ':'ข้อมูลที่ซิงค์ล่าสุด',source==='google_sheets'?'ทะเบียน Google Sheets':'ทะเบียน Supabase',`ซิงค์ ${stamp}`,`ทั้งหมด ${total} รายการ • กำลังแสดง ${visible} รายการ`,`ข้อมูลไม่ครบสำหรับประเมิน ${unknown} รายการ`,`ยังไม่ระบุกลุ่ม ${unclassified} รายการ`];
 if(source==='google_sheets'){
  const messages={missing_codes:'ยังเชื่อมประวัติตรวจไม่ได้: ไม่มีรหัสผู้รับบริการ',unavailable:'ประวัติตรวจ Supabase ไม่พร้อมใช้งาน',capacity_exceeded:'ทะเบียนเกินขอบเขตการเชื่อมประวัติ กรุณาแบ่งชุดข้อมูล'};
  parts.push(linkage?.status==='ready'?`เชื่อมประวัติตรวจ ${linkage.linked} • ไม่พบคู่ ${linkage.unmatched} • รหัสกำกวม ${linkage.ambiguous}`:messages[linkage?.status]||'ยังไม่ได้ตรวจการเชื่อมประวัติตรวจ');
 }
 return parts.join(' | ');
}
export function sortHistory(logs){return logs.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).map((row,index)=>({row,index,time:Date.parse(row.visited_at||(/^\d{4}-\d{2}-\d{2}$/.test(row.date||'')?row.date+'T'+(row.time||'00:00:00')+'+07:00':''))})).sort((a,b)=>(Number.isFinite(b.time)?b.time:-Infinity)-(Number.isFinite(a.time)?a.time:-Infinity)||a.index-b.index).map(item=>item.row);}
