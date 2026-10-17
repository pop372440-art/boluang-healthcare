export default function handler(req, res) {
  // ป้องกันการแคชค่า конฟิก เพื่อให้เปลี่ยน Environment Variable บน Vercel แล้วมีผลทันที
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // ดึงค่าจาก Vercel Environment Variables เท่านั้น (ไม่ฝัง Hardcoded Key/Secret ในซอร์สโค้ด)
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const appsScriptUrl = process.env.APPS_SCRIPT_URL || '';

  res.status(200).json({
    project: "Bo Luang Community Telehealth & Smart Living GIS",
    municipality: "เทศบาลตำบลบ่อหลวง อำเภอฮอด จังหวัดเชียงใหม่",
    version: "2026.10-depa-ready",
    supabaseUrl,
    supabaseAnonKey,
    appsScriptUrl,
    hasCloudCredentials: Boolean(supabaseUrl && supabaseAnonKey),
    pdpaCompliant: true,
    offlineFirstPwa: true
  });
}
