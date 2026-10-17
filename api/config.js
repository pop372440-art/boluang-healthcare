export default function handler(req, res) {
  res.status(200).json({
    project: "Bo Luang Community Telehealth & Smart Living GIS",
    municipality: "เทศบาลตำบลบ่อหลวง อำเภอฮอด จังหวัดเชียงใหม่",
    supabaseUrl: process.env.SUPABASE_URL || "https://zjcggffdwmmfqvjyzxre.supabase.co",
    appsScriptUrl: process.env.APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyt2CAVOAleKVPWBopV5WCaU3YXEfRZZcIu0Yb7aI0H_X9qfPgYOB-kPQW-yHagCSCSBg/exec",
    pdpaCompliant: true,
    offlineFirstPwa: true
  });
}
