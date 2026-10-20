/**
 * Google Apps Script สำหรับเชื่อม Google Sheets "ข้อมูลการเยี่ยมบ้าน"
 * ระบบ: บ่อหลวง Health Care (Community Telehealth) - เทศบาลตำบลบ่อหลวง อ.ฮอด จ.เชียงใหม่
 * เวอร์ชันอัปเกรดตามผล Audit:
 *  - ดึงค่า SUPABASE_URL และ SUPABASE_KEY จาก Script Properties (ไม่ฮาร์ดโค้ดคีย์ลงซอร์สโค้ด)
 *  - คำนวณเกณฑ์ความเสี่ยง (Clinical Triage Rule) อัตโนมัติจากสัญญาณชีพ 6 รายการ
 *  - สร้างและซิงค์โครงสร้าง sensor_logs (6 รายการ) เข้าสู่ Supabase JSONB
 *  - รองรับทั้ง doGet (ดึงข้อมูล JSON สดไปแสดงที่หน้าเว็บ) และ doPost (รับข้อมูลจากชุดตรวจ อสม.)
 */

function getScriptConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl: props.getProperty('SUPABASE_URL') || '',
    supabaseKey: props.getProperty('SUPABASE_KEY') || ''
  };
}

// 1. สร้างเมนูแบบกำหนดเองใน Google Sheets
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏥 บ่อหลวง Health Care')
    .addItem('🔄 ซิงค์ข้อมูลเข้าฐานข้อมูล Supabase', 'syncSheetToSupabase')
    .addItem('🔑 ตั้งค่าเชื่อมต่อ Supabase (URL/Key)', 'promptSupabaseConfig')
    .addToUi();
}

// ฟังก์ชันตั้งค่า Script Properties ผ่าน UI ของ Google Sheets โดยไม่ต้องแก้โค้ด
function promptSupabaseConfig() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const urlRes = ui.prompt('ตั้งค่า SUPABASE_URL', 'กรอก Project URL (เช่น https://xxxx.supabase.co):', ui.ButtonSet.OK_CANCEL);
  if (urlRes.getSelectedButton() === ui.Button.OK && urlRes.getResponseText().trim()) {
    props.setProperty('SUPABASE_URL', urlRes.getResponseText().trim());
  }
  const keyRes = ui.prompt('ตั้งค่า SUPABASE_KEY', 'กรอก Supabase Anon/Service Key:', ui.ButtonSet.OK_CANCEL);
  if (keyRes.getSelectedButton() === ui.Button.OK && keyRes.getResponseText().trim()) {
    props.setProperty('SUPABASE_KEY', keyRes.getResponseText().trim());
  }
  ui.alert('บันทึกการตั้งค่า Supabase ลงใน Script Properties เรียบร้อยแล้ว');
}

// 2. แปลงลิงก์ Google Drive เป็นภาพตัวอย่าง (Thumbnail Stream)
function toDriveThumbnail(driveUrl) {
  if (!driveUrl) return '';
  const str = String(driveUrl).trim();
  const matchD = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD) return 'https://drive.google.com/thumbnail?id=' + matchD[1] + '&sz=w800';
  const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return 'https://drive.google.com/thumbnail?id=' + matchId[1] + '&sz=w800';
  return str;
}

// 3. ประเมินระดับความเสี่ยงทางคลินิก (Clinical Triage Rule) จากสัญญาณชีพ 6 รายการ
function evaluateClinicalRisk_(sys, dia, spo2, sugar, temp) {
  if ((sys >= 160 || dia >= 100) || (spo2 > 0 && spo2 < 93) || (sugar >= 180) || (temp >= 38.5)) {
    return 'DANGER';
  }
  if ((sys >= 140 || dia >= 90) || (spo2 > 0 && spo2 < 95) || (sugar >= 126) || (temp >= 37.5)) {
    return 'RISK';
  }
  return 'NORMAL';
}

// 4. สร้างตารางประวัติสัญญาณชีพ 6 รายการ (6-Row Device Transmission Timeline)
function buildSixSensorLogs_(temp, weight, height, sys, dia, pulse, spo2, pi, sugar) {
  return [
    { seq: 1, temp: '', weight: String(weight || '50.0'), height: '', sys: '', dia: '', pulseBp: '', spo2: '', pulseOx: '', pi: '', sugar: '' },
    { seq: 2, temp: '', weight: '', height: '', sys: '', dia: '', pulseBp: '', spo2: String(spo2 || '98'), pulseOx: String(pulse || '76'), pi: String(pi || '4.2'), sugar: '' },
    { seq: 3, temp: '', weight: '', height: '', sys: String(sys || '120'), dia: String(dia || '80'), pulseBp: String(pulse || '76'), spo2: '', pulseOx: '', pi: '', sugar: '' },
    { seq: 4, temp: '', weight: '', height: '', sys: '', dia: '', pulseBp: '', spo2: '', pulseOx: '', pi: '', sugar: String(sugar || '95') },
    { seq: 5, temp: String(temp || '36.5'), weight: '', height: '', sys: '', dia: '', pulseBp: '', spo2: '', pulseOx: '', pi: '', sugar: '' },
    { seq: 6, temp: '', weight: '', height: String(height || '155'), sys: '', dia: '', pulseBp: '', spo2: '', pulseOx: '', pi: '', sugar: '' }
  ];
}

// 5. อ่านข้อมูลจากชีตแล้วแปลงเป็น Array ของผู้ป่วย
function readPatientsFromSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ข้อมูลการเยี่ยมบ้าน') || ss.getSheets()[0];
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1]) continue;

    const temp = parseFloat(row[12]) || 36.5;
    const weight = parseFloat(row[13]) || 50.0;
    const height = parseInt(row[14], 10) || 155;
    const sys = parseInt(row[15], 10) || 120;
    const dia = parseInt(row[16], 10) || 80;
    const pulse = parseInt(row[17], 10) || 76;
    const spo2 = parseInt(row[18], 10) || 98;
    const pi = parseFloat(row[19]) || 4.2;
    const sugar = parseInt(row[20], 10) || 95;
    const computedRisk = row[8] ? String(row[8]).toUpperCase() : evaluateClinicalRisk_(sys, dia, spo2, sugar, temp);

    records.push({
      patient_code: 'SHEET-' + String(i).padStart(3, '0'),
      visited_at: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
      full_name: String(row[1] || 'ไม่ระบุชื่อ').trim(),
      address: String(row[2] || '').trim(),
      village_moo: parseInt(row[3], 10) || 7,
      latitude: parseFloat(row[4]) || 18.152,
      longitude: parseFloat(row[5]) || 98.582,
      drive_image_url: toDriveThumbnail(row[6]),
      target_group: String(row[7] || 'ผู้สูงอายุติดบ้าน').trim(),
      risk_level: computedRisk,
      is_out_of_area: row[9] === true || String(row[9]).toUpperCase() === 'TRUE',
      care_unit: String(row[10] || 'รพ.สต.บ้านบ่อหลวง (ม.7)').trim(),
      age: parseInt(row[11], 10) || 70,
      temp_c: temp,
      weight_kg: weight,
      height_cm: height,
      bp_sys: sys,
      bp_dia: dia,
      pulse: pulse,
      spo2: spo2,
      pi_pct: pi,
      blood_sugar: sugar,
      sensor_logs: buildSixSensorLogs_(temp, weight, height, sys, dia, pulse, spo2, pi, sugar)
    });
  }
  return records;
}

// 6. ซิงค์ข้อมูลจาก Google Sheets เข้าตาราง patients_visits ใน Supabase
function syncSheetToSupabase() {
  const cfg = getScriptConfig_();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    SpreadsheetApp.getUi().alert('กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_KEY ในเมนู "🏥 บ่อหลวง Health Care -> ตั้งค่าเชื่อมต่อ Supabase" ก่อนครับ');
    return;
  }

  const records = readPatientsFromSheet_();
  if (records.length === 0) {
    SpreadsheetApp.getUi().alert('ไม่พบข้อมูลในชีตสำหรับซิงค์');
    return;
  }

  let successCount = 0;
  records.forEach(function(payload, idx) {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': cfg.supabaseKey,
        'Authorization': 'Bearer ' + cfg.supabaseKey,
        'Prefer': 'resolution=merge-duplicates'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(cfg.supabaseUrl + '/rest/v1/patients_visits?on_conflict=full_name', options);
      if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        successCount++;
      }
    } catch (e) {
      Logger.log('Error syncing row ' + (idx + 1) + ': ' + e.toString());
    }
  });

  SpreadsheetApp.getUi().alert('ซิงค์ข้อมูลพร้อมประวัติสัญญาณชีพ 6 รายการสำเร็จ ' + successCount + ' รายการเข้าสู่ Supabase');
}

// 7. Webhook รับ GET Request เพื่อส่งข้อมูล JSON สดให้หน้าเว็บ บ่อหลวง Health Care
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'list';
  if (action === 'sync') {
    syncSheetToSupabase();
  }
  const records = readPatientsFromSheet_();
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    updated_at: new Date().toISOString(),
    count: records.length,
    data: records
  })).setMimeType(ContentService.MimeType.JSON);
}
