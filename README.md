# บ่อหลวง Health Care — logic / architecture audit

ฐานหน้าตาอ้างอิง `138ca6bf8905d09c0d0d248524e462f11e2181c6` ตามคำสั่งผู้ใช้ **ไม่เปลี่ยน landing page, UX หรือ UI**

## สิ่งที่คงเดิม

HTML และ CSS นอก `<script>` ตรงกับ commit อ้างอิงทุกไบต์ มี automated contract test ตรวจ SHA-256 โครงหน้า เมนู ปุ่ม modal ตาราง canvas แผนที่ สี ฟอนต์ responsive classes และ dependencies เดิมยังอยู่ ไม่มีหน้า login หรือ layout ใหม่ ไฟล์ style.css จากการทดลองก่อนหน้าถูกนำออก

โค้ด renderer และ event bindings เดิมย้ายไป `app.mjs` ส่วน `boluang_audit_patch.js` คงเฉพาะ markup เมนูและสวิตช์ที่เดิมสร้างจาก JavaScript ข้อความสถานะ ตัวเลข และชื่อที่ปกปิดเปลี่ยนได้ตามข้อมูลจริง แต่ไม่ได้ออกแบบส่วนแสดงผลใหม่

## ผลสำรวจ history

- `138ca6b` เพิ่ม listener ปุ่มถ่ายรูปที่เปิด Apps Script URL โดยตรง
- โค้ดก่อนหน้านั้นรวมชุดข้อมูลตัวอย่าง การจัดการแผนที่ renderer แบบฟอร์ม และตัวเชื่อมสองแหล่งไว้ใน index.html
- KPI และกราฟใช้ยอดคงที่ สูตรบันทึกแบบฟอร์มกับ patch ต่างกัน และตัวเชื่อม Sheets เติมค่าตรวจที่ไม่ได้มาจากต้นทาง
- GeoJSON loader เดิมย้ายพิกัดตัวอย่างไปใกล้ศูนย์กลาง polygon ไม่ควรใช้กับทะเบียนจริง

## สิ่งที่แก้เฉพาะ logic และ architecture

- แยก shared screening / validation / GIS functions ใน `lib/health-model.mjs` และ adapter เข้า renderer เดิมใน `lib/legacy-adapter.mjs`
- โหลดทะเบียนจาก API เพียงช่องทางเดียว ตรวจผล HTTP และรอผลบันทึกจริงก่อนรายงานสำเร็จ ไม่เขียนทับด้วยชื่อบุคคล ไม่เติมค่าตรวจหรืออายุ
- ตาราง แผนที่ กราฟ KPI และ CSV ใช้ตัวกรองเดียวกัน ยอดมาจากข้อมูลจริง ค่าว่างเป็นค่าว่างและจำแนก UNKNOWN โดยไม่บังคับเป็นปกติ
- ไม่แก้ค่าตรวจย้อนหลัง ไม่โยกพิกัดจริงตาม polygon และไม่เดาหมายเลขหมู่จากลำดับ feature
- ฟอร์มเดิมเริ่มค่าตรวจว่าง ใช้ server validation, record_version และ append-only history preparation สำหรับการบันทึกพร้อมกัน
- แยกเวลาตรวจกับเวลาซิงค์ ใช้เขตเวลาไทยและประวัติที่มีจริง ไม่สร้างลำดับส่งค่า 6 แถวขึ้นเอง
- สวิตช์เดิมปกปิดชื่อ ที่อยู่และรูปใน renderer/CSV โดยไม่เปลี่ยนชื่อใน object ต้นทาง ป้องกัน HTML injection และสูตรใน CSV
- API ตรวจ session และ app_metadata healthcare role / village scope ไม่ใช้ user_metadata เป็นสิทธิ์ ไม่เก็บ token หรือ config คีย์ใน localStorage
- ถอดปุ่มถ่ายรูปและทางเข้าภาคสนามออกแล้ว ใช้แอปเก็บข้อมูลแยกและกำหนดสิทธิ์รายอีเมลที่แอปนั้น; `/api/photo-app` เดิมตอบ 410
- ปุ่มที่เดิมสร้างผลตรวจสุ่มหรือส่งข้อมูลทั้งหมดขึ้น Cloud ยังอยู่ตำแหน่งเดิม แต่ไม่เขียนค่าจำลองหรือเขียนทับตามชื่อในฐานข้อมูลจริง

## สิ่งที่ยังต้องติดตั้งและตรวจ ก่อน deploy

นี่เป็น Draft PR ยังไม่ได้ deploy หรือรัน schema change บน production และไม่ได้ยืนยันด้วยบัญชีจริงหรือ visual browser test หลัง refactor

1. ตั้ง `SUPABASE_URL` และ `SUPABASE_ANON_KEY` เฉพาะ server ใน Vercel ห้ามใช้ service role key ใน browser
2. บัญชีผู้ดูแลที่ผู้ใช้ระบุได้รับ `app_metadata.healthcare_role=admin` แล้ว บัญชีอื่นต้องกำหนด role viewer/clinician และ healthcare_villages เป็น array ตัวเลขหมู่บ้านจริง ห้ามโปรโมตทุกบัญชีอัตโนมัติ
3. ตรวจและรัน `db/audit-access.sql` แล้วทดสอบ `tests/rls-check.sql` ก่อนเปิด API ให้ใช้งานจริง
4. **ยังไม่ได้เพิ่มหรือเปลี่ยน UX การเข้าสู่ระบบ** ตามขอบเขตที่ผู้ใช้กำหนด หน้าเดิมอ่าน API ได้เฉพาะเมื่อมี session cookie จาก `/api/session` ที่ยืนยันสิทธิ์แล้ว หากไม่มี session จะแสดง toast เดิมและไม่โหลดข้อมูลสุขภาพ ต้องเชื่อม authentication flow กับช่องทางเจ้าหน้าที่ที่ได้รับอนุมัติก่อน rollout ห้ามแก้เป็น anonymous access เพื่อเลี่ยงขั้นตอนนี้
5. แอปถ่ายรูปและเก็บพิกัดเป็นระบบแยก ผู้ดูแลกำหนดสิทธิ์รายอีเมลที่แอปนั้น เว็บนี้ไม่ใช้ `APPS_SCRIPT_URL` หรือ `APPS_SCRIPT_PRIVATE` สำหรับเปิดแอป แต่ยังต้องตั้งค่า Sheets bridge เพื่ออ่านทะเบียนตามคู่มือ
6. ตรวจถ้อยคำ/ตัวอย่างที่ฝังใน HTML เดิมและประวัติ Git ก่อนเปิดข้อมูลสาธารณะ เนื่องจากการแก้ครั้งนี้คงเนื้อหา HTML นอก script ตาม baseline ไม่รับรองการลบข้อมูลทุกจุดในประวัติ Git หรือการปฏิบัติตาม PDPA ครบถ้วน

สูตรคัดกรองคง thresholds เดิมของโครงการและแสดงว่าไม่ครบเมื่อข้อมูลไม่พอ ต้องให้ทีมคลินิกตรวจบริบท โดยเฉพาะน้ำตาลก่อน/หลังอาหาร ไม่ใช่การวินิจฉัย

## Google Sheets ที่ตรวจแล้ว

แท็บ `ผู้มีสุขภาวะพึ่งพิง` มี 6 คอลัมน์ วันเวลา ชื่อ-สกุล ที่อยู่ ละติจูด ลองจิจูด และลิงก์รูปภาพ ไม่มีผลตรวจ จึงห้ามใช้สร้างค่าความดัน/น้ำตาลอัตโนมัติ `google_apps_script.gs` จับคู่ตามหัวคอลัมน์ ไม่เดาตำแหน่ง 21 คอลัมน์ และไม่คืนข้อมูลผ่าน GET สาธารณะ การนำเข้าต้องมีรหัสบุคคลที่ยืนยันแล้ว

## ทดสอบ

```sh
npm test
```

ชุดทดสอบใช้ข้อมูลสังเคราะห์ ครอบคลุมสูตร ค่าว่าง ตัวกรอง GIS API สิทธิ์ ประวัติ การบันทึกพร้อมกัน adapter เดิม และ contract ว่า HTML/CSS ไม่เปลี่ยน

## Blueprint runtime audit

ดู `docs/depa-blueprint-audit.md` สำหรับผลตรวจเมนูจริงและหลักฐานของแต่ละ layer ใน depa Blueprint สถานะในหน้าเดิมอ่านจาก `lib/blueprint.mjs` ไม่รับรองยอด 920, PDPA, PostGIS SQL หรือ realtime แบบคงที่ กรณียังไม่ล็อกอินแสดง “ยังตรวจไม่ได้” แยกจากศูนย์รายการ เกณฑ์ที่อธิบายอ่านจาก shared thresholds เดียวกับ assessor และมีการตรวจโครงสร้าง Blueprint ว่าไม่เปลี่ยน tags/classes

## Google Sheets connection restored

Default source is now Google Sheets via the authenticated server API, with the private Apps Script bridge or optional readonly service-account transport. Setup and deployment checks are in `docs/google-sheets-connection.md`. The existing photo application uses a separate URL. No UI/CSS was redesigned, spreadsheet cells changed or clinical records upserted by name. Unlinked location-only rows remain read-only and have no fabricated readings.
