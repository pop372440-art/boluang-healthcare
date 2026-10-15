/**
 * Google Apps Script สำหรับไฟล์ Google Sheets "ระบบบันทึกพิกัด"
 * (Spreadsheet ID: 1sMbr_fqnYrvr-8qZFTbBcAJsu_EGLEtFAvUTc4Tx6fw)
 * วิธีใช้: เปิดไฟล์ Google Sheets -> ส่วนขยาย (Extensions) -> Apps Script -> วางโค้ดนี้แล้วกด Save
 */

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_OR_SERVICE_ROLE_KEY';

// 1. สร้างเมนูบนหัวตาราง Google Sheets ให้เจ้าหน้าที่กดซิงค์ได้ในคลิกเดียว
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏥 บ่อหลวง Health Care')
    .addItem('🔄 ซิงค์ข้อมูลผู้มีภาวะพึ่งพิงขึ้น Supabase ทันที', 'syncSheetToSupabase')
    .addToUi();
}

// 2. ฟังก์ชันแปลงลิงก์ Google Drive เป็นลิงก์รูปภาพตรงสำหรับแสดงบนแผนที่
function toDriveThumbnail(driveUrl) {
  if (!driveUrl) return '';
  const match = String(driveUrl).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w800' : driveUrl;
}

// 3. ฟังก์ชันส่งข้อมูลจากแท็บ "ผู้มีสุขภาวะพึ่งพิง" เข้าตาราง patients_visits บน Supabase
function syncSheetToSupabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ผู้มีสุขภาวะพึ่งพิง');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('ไม่พบแท็บชื่อ "ผู้มีสุขภาวะพึ่งพิง"');
    return;
  }

  const rows = sheet.getDataRange().getValues().slice(1); // ข้ามแถวหัวตาราง A1:F1
  let count = 0;

  rows.forEach((r) => {
    const visitedAt = r[0];
    const fullName = String(r[1] || '').trim();
    const address = String(r[2] || '').trim();
    const lat = Number(r[3]);
    const lng = Number(r[4]);
    const driveUrl = String(r[5] || '').trim();

    if (!fullName || isNaN(lat) || isNaN(lng)) return;

    const mooMatch = address.match(/หมู่(?:ที่)?\s*(\d+)/);
    const villageMoo = mooMatch ? Number(mooMatch[1]) : 7;

    const payload = {
      visited_at: visitedAt ? new Date(visitedAt).toISOString() : new Date().toISOString(),
      full_name: fullName,
      address: address,
      village_moo: villageMoo,
      latitude: lat,
      longitude: lng,
      drive_image_url: driveUrl
    };

    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/patients_visits?on_conflict=full_name', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'resolution=merge-duplicates'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    count++;
  });

  SpreadsheetApp.getUi().alert('ซิงค์ข้อมูลเข้าสู่ระบบ บ่อหลวง Health Care สำเร็จ ' + count + ' รายการ');
}

// 4. Web App API (doGet) กรณีต้องการดึงข้อมูลจาก Google Sheets เข้าหน้าเว็บ Vercel โดยตรง
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ผู้มีสุขภาวะพึ่งพิง');
  const rows = sheet ? sheet.getDataRange().getValues().slice(1) : [];
  const data = rows.filter(r => r[1]).map((r, idx) => ({
    id: 'SHEET-' + (idx + 1),
    visited_at: r[0],
    full_name: r[1],
    address: r[2],
    latitude: Number(r[3]),
    longitude: Number(r[4]),
    drive_image_url: r[5],
    thumbnail_url: toDriveThumbnail(r[5])
  }));

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', count: data.length, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}
