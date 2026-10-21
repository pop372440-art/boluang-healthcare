# depa Digital Innovation Blueprint: runtime audit

ตรวจวันที่ 21 ตุลาคม 2569 จากเว็บ production และ source main `192c0062671847d78c5300c7d4db7da85ce7a7cf` โดยไม่มี session เจ้าหน้าที่ ไม่บันทึกผลตรวจ ไม่เปลี่ยนการแชร์ Drive ไม่ใช้ข้อมูลผู้ป่วยเป็นชุดทดสอบ

## ผลตรวจเมนูและขอบเขตการยืนยัน

| เมนู / งาน | ผลที่เห็นบน production | การแก้หรือข้อจำกัด |
|---|---|---|
| Dashboard / แผนที่ | เปิดได้ สลับถนน/ดาวเทียมและชั้นขอบเขตได้ | ไม่ได้ยืนยันพิกัดผู้รับบริการเพราะ API ต้องมี session |
| ตัวกรองหมู่บ้าน / กลุ่ม | เลือกหมู่ 7 และรีเซ็ตทุกกลุ่มได้ | ไม่ใช้ทะเบียนว่างจาก 401 อ้างว่าไม่มีผู้รับบริการ |
| ตารางสุขภาพ | เปิดได้ แสดงแถวไม่พบข้อมูล | ข้อมูลจริงและรายละเอียดรายบุคคลยังทดสอบไม่ได้ก่อน sign-in |
| สถิติรายหมู่บ้าน | เปิด canvas ได้ | ต้องมีข้อมูลที่โหลดสำเร็จจึงยืนยันยอดได้ |
| รับค่าชุดตรวจ อสม. | ปฏิเสธก่อนเปิดฟอร์มเมื่อไม่มี session | ถูกต้องด้านการจำกัดสิทธิ์ ยังไม่ทดสอบ write production |
| ซิงค์ข้อมูลล่าสุด | ไม่สามารถโหลดทะเบียนเมื่อไม่ล็อกอิน | สถานะใหม่แยก unauthenticated / unauthorized / error / stale / ready |
| Cloud settings | modal เดิมเปิดและปิดได้ | ไม่กรอก key หรือบันทึก endpoint จาก browser; config เป็น server-side |
| Google Sheets / โค้ด | เดิมกดแล้วเห็นแผนที่ แต่ไม่มีเนื้อหา Sheets | แก้เงื่อนไขตรวจ template ที่นับ hidden compatibility controls เป็นเนื้อหาจริง ใช้ template เดิมและคง compatibility IDs |
| พิมพ์เขียวสถาปัตยกรรม depa | เปิดได้แต่แสดง 920 และ ✓ PDPA Ready คงที่ทั้งที่อ่านทะเบียนไม่ได้ | เปลี่ยนเฉพาะข้อความ/ข้อมูลสถานะจาก evidence model ไม่มี redesign |
| ส่งออก / รายละเอียด / ถ่ายรูป | ต้องอาศัย session หรือ record ที่ถูกต้อง | ไม่ทดสอบด้วยการสร้างข้อมูลจริง ไม่ยืนยันการเชื่อมต่ออุปกรณ์หรือ Apps Script deployment |
| อัปโหลด JSON / เปลี่ยนโลโก้ | มี input และ handler ในโค้ด | ไม่แทนไฟล์จริงของผู้ใช้เพื่อทดสอบ; ไม่เปลี่ยนส่วนนี้ |

## ความคลาดเคลื่อนใน Blueprint และสิ่งที่แก้

- **KPI 920**: ยกเลิกข้อความรับรองยอดคงที่ ใช้ข้อมูลเดียวกับตัวกรอง รวม UNKNOWN และตรวจสมการครบทุกกลุ่ม แยกข้อมูลไม่พร้อมจากทะเบียนที่อ่านสำเร็จและมีศูนย์แถว
- **PDPA Ready**: masking ไม่พิสูจน์การปฏิบัติตาม PDPA หรือ RLS จะแสดง masking และสถานะบัญชีจาก runtime พร้อมระบุ RLS ยังไม่ตรวจ ห้ามเปลี่ยนเป็นเครื่องหมายผ่านตาม environment flag เพียงอย่างเดียว
- **PostGIS Spatial**: การมี extension ใน project ไม่พิสูจน์ว่าเส้นทางหน้าจอเรียก spatial SQL หน้าเว็บใช้ GeoJSON และ JavaScript point-in-polygon จึงบอกวิธีที่ใช้จริง
- **Layer 1 IoMT**: แบบฟอร์มรับค่าที่กรอกจริงแล้ว แต่ยังไม่ตรวจเส้นทางอุปกรณ์ Bluetooth/LoRa แบบอัตโนมัติ ไม่อ้างว่ารับ sensor packets จริง
- **Layer 2 Sheets**: ต้นทางที่ตรวจมี 6 คอลัมน์ตำแหน่ง/รูป ไม่มีสัญญาณชีพ การนำเข้าต้องจับคู่รหัส ห้ามอ้างว่า upsert ตามชื่ออัตโนมัติ
- **Layer 3 storage**: JSONB เก็บประวัติตามจริง ไม่ใช่ 6 ครั้งล่าสุดโดยนิยาม; migration สิทธิ์ยังต้องตรวจการติดตั้ง ไม่อ้างว่าเตรียม SQL แล้วเท่ากับ production ปลอดภัยแล้ว
- **Layer 4 Edge/realtime**: API ใน repo เป็น Node handler ไม่มี Edge runtime config และยังไม่มี Realtime subscription/notification worker จึงระบุ manual sync ตามจริง
- **เกณฑ์ clinical**: Blueprint และ assessor อ่าน thresholds จาก shared constant เดียวกัน แสดง DANGER ก่อน RISK และ NORMAL ต้องมีข้อมูลครบ ไม่สร้างช่วงอุณหภูมิ 36.0 ที่ไม่มีใน assessor ไม่เปลี่ยน thresholds ทางคลินิกในงานนี้

## การรักษา UI

index.html ไม่เปลี่ยน HTML/CSS เดิมยังผ่าน SHA-256 contract test ข้อความใน Blueprint อัปเดตได้ แต่ลำดับ tags, classes และรูปแบบส่วน Blueprint เท่าเดิม มี structural hash test เพิ่มแยกต่างหาก ไม่มีหน้า login, modal หรือ CSS ใหม่

## สิ่งที่ยังไม่แก้ใน production

- หน้าเดิมไม่มี authentication entry flow ที่อนุมัติแล้ว API จึงถูกปฏิเสธด้วย 401 สำหรับ browser ที่ไม่ได้ล็อกอิน ไม่หลีกเลี่ยงโดยเปิดข้อมูลเป็น anonymous
- db/audit-access.sql ยังต้องตรวจและติดตั้งพร้อม session integration ก่อนยืนยัน RLS/write workflow
- Apps Script deployment, สิทธิ์ไฟล์ Drive, realtime, offline encrypted queue, อุปกรณ์ IoMT และ notification ยังไม่ได้รับรองว่าทำงานจริง
- ไม่ปรับผลตรวจย้อนหลัง ไม่ติดตั้ง migration ไม่สร้าง credentials ไม่ merge หรือ deploy โดยชุดตรวจนี้
