# บ่อหลวง Health Care (เทศบาลตำบลบ่อหลวง อ.ฮอด จ.เชียงใหม่)

ระบบเฝ้าระวังและดูแลสุขภาพผู้ป่วยติดเตียง ผู้พิการ และกลุ่มเปราะบาง เชิงรุกด้วยแผนที่พิกัดหลังคาเรือน (GIS) และชุดตรวจสุขภาพอัจฉริยะ (Smart Telehealth)

## โครงสร้างไฟล์สำหรับอัปโหลดขึ้น GitHub ผ่าน Browser
- `index.html` — หน้าเว็บแอปพลิเคชันหลัก (พร้อมข้อมูลเริ่มต้นของ นายโด่ย ปู่เป็ง หมู่ 7 บ้านพุย)
- `vercel.json` — ไฟล์ตั้งค่าสำหรับ Deploy บน Vercel
- `api/health.js` — Serverless API Endpoint บน Vercel
- `supabase_schema.sql` — โค้ด SQL สำหรับสร้างตารางบน Supabase
- `google_apps_script.gs` — โค้ดสำหรับนำไปวางใน Google Sheets (`ระบบบันทึกพิกัด`)
