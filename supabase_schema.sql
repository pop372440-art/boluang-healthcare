-- ============================================================================
-- SQL Schema สำหรับระบบ "บ่อหลวง Health Care" บน Supabase (PostgreSQL + PostGIS)
-- วิธีใช้: คัดลอกโค้ดทั้งหมดนี้ไปวางในเมนู SQL Editor บนเว็บ Supabase แล้วกด Run
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. ตารางหลักเก็บข้อมูลผู้มีภาวะพึ่งพิงและพิกัดเยี่ยมบ้าน (ตรงตาม Google Sheets "ระบบบันทึกพิกัด" -> "ผู้มีสุขภาวะพึ่งพิง")
CREATE TABLE IF NOT EXISTS public.patients_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  village_moo INT DEFAULT 7,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  drive_image_url TEXT,
  target_group TEXT DEFAULT 'ผู้ป่วยติดเตียง', -- ปกติ | ผู้ป่วยติดเตียง | ผู้พิการ | กลุ่มเปราะบาง
  risk_level TEXT DEFAULT 'DANGER',           -- NORMAL | RISK | DANGER
  is_out_of_area BOOLEAN DEFAULT false,
  care_unit TEXT DEFAULT 'รพ.สต.บ้านพุย (ม.7)',
  age INT DEFAULT 70,
  temp_c NUMERIC(4,1) DEFAULT 36.5,
  weight_kg NUMERIC(5,1) DEFAULT 50.0,
  height_cm INT DEFAULT 155,
  bp_sys INT DEFAULT 130,
  bp_dia INT DEFAULT 80,
  pulse INT DEFAULT 80,
  spo2 INT DEFAULT 96,
  pi_pct NUMERIC(4,1) DEFAULT 3.5,
  blood_sugar NUMERIC(5,1) DEFAULT 110.0,
  inspector_name TEXT DEFAULT 'ทต.บ่อหลวง',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ตารางเก็บประวัติสัญญาณชีพ 6 แถวจากชุดตรวจ IoT อสม. (เหมือนหน้าจอในภาพที่ 2)
CREATE TABLE IF NOT EXISTS public.vital_sensor_logs (
  log_id BIGSERIAL PRIMARY KEY,
  patient_id UUID REFERENCES public.patients_visits(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_time TIME NOT NULL DEFAULT CURRENT_TIME,
  temp_c NUMERIC(4,1),
  weight_kg NUMERIC(5,1),
  height_cm INT,
  bp_sys INT,
  bp_dia INT,
  bp_pulse INT,
  spo2 INT,
  ox_pulse INT,
  pi_pct NUMERIC(4,1),
  blood_sugar NUMERIC(5,1),
  inspector_name TEXT DEFAULT 'ทต.บ่อหลวง'
);

-- 3. เพิ่มข้อมูลเริ่มต้นของ "นายโด่ย ปู่เป็ง" จากไฟล์ Google Sheets "ระบบบันทึกพิกัด"
INSERT INTO public.patients_visits (
  visited_at, full_name, address, village_moo, latitude, longitude, drive_image_url,
  target_group, risk_level, care_unit, age, temp_c, weight_kg, height_cm,
  bp_sys, bp_dia, pulse, spo2, pi_pct, blood_sugar, inspector_name
) VALUES (
  '2026-10-08 10:44:22+07',
  'นายโด่ย ปู่เป็ง',
  '319 หมู่ 7 บ้านพุย',
  7,
  18.0416137,
  98.30265622,
  'https://drive.google.com/file/d/1dLsgCJbjuULATi6YZnxcAZGk5txbSmKY/view?usp=drivesdk',
  'ผู้ป่วยติดเตียง',
  'DANGER',
  'รพ.สต.บ้านพุย (ม.7)',
  78, 36.6, 48.0, 155, 156, 92, 84, 95, 3.1, 162.0,
  'ศูนย์พัฒนาและฟื้นฟูฯ ทต.บ่อหลวง'
) ON CONFLICT (full_name) DO NOTHING;

-- 4. เปิดใช้งาน Realtime เพื่อให้หน้าจอทีวีที่เทศบาลอัปเดตทันที
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vital_sensor_logs;
