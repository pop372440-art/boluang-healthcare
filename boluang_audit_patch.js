// Retain legacy UI markup only; application logic lives in app.mjs.
(function(){
let pdpaMaskEnabled=true;
  function ensureAllFiveTabsAndSections() {
    // 5.1 เปิดเมนูย่อยตั้งค่า/สถาปัตยกรรมให้แสดงตลอดเวลา ไม่ถูกซ่อนไว้
    const settingsSubmenu = document.getElementById('settingsSubmenu');
    if (settingsSubmenu) {
      settingsSubmenu.classList.remove('hidden');
    }

    // ตรวจสอบว่ามีปุ่ม `data-nav="sheets"` และ `data-nav="architecture"` ในเมนูซ้ายหรือยัง
    const navContainer = document.getElementById('dashboardsSubmenu') ||
      document.querySelector('aside nav') ||
      document.querySelector('aside');

    if (navContainer && !document.querySelector('[data-nav="sheets"]')) {
      const sheetsBtn = document.createElement('button');
      sheetsBtn.type = 'button';
      sheetsBtn.setAttribute('data-nav', 'sheets');
      sheetsBtn.className = 'nav-tab-btn w-full text-left px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-between text-slate-600 hover:text-purple-900 hover:bg-purple-50 transition-all';
      sheetsBtn.innerHTML = '<span>🔗 เชื่อม Google Sheets / โค้ด</span>';
      navContainer.appendChild(sheetsBtn);
    }

    if (navContainer && !document.querySelector('[data-nav="architecture"]')) {
      const archBtn = document.createElement('button');
      archBtn.type = 'button';
      archBtn.setAttribute('data-nav', 'architecture');
      archBtn.className = 'nav-tab-btn w-full text-left px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-between text-slate-600 hover:text-purple-900 hover:bg-purple-50 transition-all';
      archBtn.innerHTML = '<span>🏛️ พิมพ์เขียวสถาปัตยกรรม (depa)</span>';
      navContainer.appendChild(archBtn);
    }

    // ปรับป้ายชื่อปุ่มที่มีอยู่ให้ชัดเจนตามเมนูทั้ง 5 แท็บ
    const archBtnExisting = document.querySelector('[data-nav="architecture"]');
    if (archBtnExisting && !archBtnExisting.textContent.includes('พิมพ์เขียว')) {
      archBtnExisting.innerHTML = '<span>🏛️ พิมพ์เขียวสถาปัตยกรรม</span>';
    }
    const sheetsBtnExisting = document.querySelector('[data-nav="sheets"]');
    if (sheetsBtnExisting && !sheetsBtnExisting.textContent.includes('โค้ด')) {
      sheetsBtnExisting.innerHTML = '<span>🔗 เชื่อม Google Sheets / โค้ด</span>';
    }

    // 5.2 เติมเนื้อหาใน `#viewArchitectureSection` หากว่างเปล่า
    const archSec = document.getElementById('viewArchitectureSection');
    if (archSec && archSec.innerHTML.trim().length < 50) {
      archSec.className = 'hidden flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50';
      archSec.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-6">
          <div class="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/30 border border-purple-300/40 uppercase tracking-wider">depa Digital Innovation Blueprint</span>
              <h2 class="text-xl lg:text-2xl font-extrabold mt-2">พิมพ์เขียวสถาปัตยกรรมระบบ: บ่อหลวง Health Care (Community Telehealth)</h2>
              <p class="text-xs lg:text-sm text-purple-100 mt-1">เทศบาลตำบลบ่อหลวง อำเภอฮอด จังหวัดเชียงใหม่ — โครงสร้างพื้นฐานดิจิทัลต้นทุนต่ำสำหรับองค์กรปกครองส่วนท้องถิ่น (Zero-to-Low Cloud Cost Architecture)</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold" data-blueprint="privacyBadge">ปกปิดข้อมูล: รอตรวจ</span>
              <span class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold" data-blueprint="spatialBadge">GIS: รอตรวจ</span>
            </div>
          </div>

          <!-- 4-Layer Architecture Pipeline -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs space-y-2">
              <div class="text-xs font-bold text-purple-700 uppercase">Layer 1: Field IoMT & อสม.</div>
              <div class="text-base font-extrabold text-slate-800">ชุดตรวจสุขภาพ 6 รายการ</div>
              <p class="text-xs text-slate-600 leading-relaxed">แบบฟอร์มรับค่าที่เจ้าหน้าที่วัดได้จริง ไม่สร้างค่าที่ขาดขึ้นเอง; การรับค่าจากอุปกรณ์ IoMT อัตโนมัติยังไม่ได้ตรวจยืนยัน</p>
            </div>
            <div class="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs space-y-2">
              <div class="text-xs font-bold text-indigo-700 uppercase">Layer 2: Serverless Bridge</div>
              <div class="text-base font-extrabold text-slate-800">Google Sheets & Apps Script</div>
              <p class="text-xs text-slate-600 leading-relaxed">ชีตต้นทางมี 6 คอลัมน์พิกัดและรูปภาพ ไม่มีผลตรวจ; Apps Script ต้องยืนยันสิทธิ์และจับคู่รหัสบุคคลก่อนนำเข้า ไม่มี Upsert อัตโนมัติตามชื่อ</p>
            </div>
            <div class="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs space-y-2">
              <div class="text-xs font-bold text-emerald-700 uppercase">Layer 3: Cloud Spatial DB</div>
              <div class="text-base font-extrabold text-slate-800">Supabase (PostgreSQL + PostGIS)</div>
              <p class="text-xs text-slate-600 leading-relaxed">จัดเก็บตาราง <code class="bg-slate-100 px-1 rounded">patients_visits</code> และประวัติ <code class="bg-slate-100 px-1 rounded">sensor_logs (JSONB)</code> ตามประวัติที่บันทึกจริง; เตรียม migration สำหรับ RLS แล้ว แต่ยังต้องตรวจการติดตั้งบนฐานข้อมูลจริง</p>
            </div>
            <div class="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs space-y-2">
              <div class="text-xs font-bold text-rose-700 uppercase">Layer 4: Smart Command Center</div>
              <div class="text-base font-extrabold text-slate-800">Vercel Node API + Leaflet GIS</div>
              <p class="text-xs text-slate-600 leading-relaxed">ประมวลผล Point-in-Polygon เทียบขอบเขต <code class="bg-slate-100 px-1 rounded">boluang.json</code> ผ่านฟังก์ชันร่วมและ GeoJSON ใน browser; ข้อมูลเปลี่ยนเมื่อซิงค์ ยังไม่มีระบบแจ้งเตือนหรือ subscription แบบเรียลไทม์</p>
            </div>
          </div>

          <!-- Clinical Triage Rule & Data Integrity Matrix -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 class="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">เกณฑ์คัดกรองความเสี่ยงทางคลินิกอัตโนมัติ (Automated Clinical Triage Rules)</h3>
              <div class="space-y-2 text-xs">
                <div class="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span class="font-bold text-rose-800">ระดับอันตราย (DANGER)</span>
                  <span class="text-rose-700" data-blueprint="danger">กำลังตรวจเกณฑ์จาก shared model</span>
                </div>
                <div class="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span class="font-bold text-amber-800">ระดับมีความเสี่ยง (RISK)</span>
                  <span class="text-amber-700" data-blueprint="risk">กำลังตรวจเกณฑ์จาก shared model</span>
                </div>
                <div class="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span class="font-bold text-emerald-800">ระดับเหมาะสม (NORMAL)</span>
                  <span class="text-emerald-700" data-blueprint="normal">ข้อมูลไม่ครบจะไม่สรุปเป็น NORMAL</span>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 class="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">สถานะความพร้อมด้านวิศวกรรมข้อมูลและความปลอดภัย (System Audit Status)</h3>
              <div class="space-y-2 text-xs">
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span class="text-slate-600" data-blueprint="kpiLabel">สมการทะเบียนตามตัวกรอง รวมข้อมูลไม่ครบ</span>
                  <span class="font-bold text-emerald-600" data-blueprint="kpiStatus">ยังไม่มีข้อมูลที่ยืนยันได้</span>
                </div>
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span class="text-slate-600">การคำนวณขอบเขตพื้นที่ (Ray-Casting Point-in-Polygon)</span>
                  <span class="font-bold text-emerald-600" data-blueprint="boundaryStatus">ยังไม่ได้ตรวจไฟล์ขอบเขต</span>
                </div>
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span class="text-slate-600">การคุ้มครองข้อมูลส่วนบุคคล (PDPA Data Masking & RLS)</span>
                  <span class="font-bold text-purple-700" data-blueprint="privacyStatus">ยังไม่ได้ตรวจสิทธิ์ API และนโยบาย RLS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 5.3 เติมเนื้อหาใน `#viewSheetsSection` หากว่างเปล่า
    const sheetsSec = document.getElementById('viewSheetsSection');
    if (sheetsSec && !sheetsSec.querySelector('[data-sheet-bridge-content]')) {
      const compatibility=sheetsSec.innerHTML;
      sheetsSec.className = 'hidden flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50';
      sheetsSec.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-6" data-sheet-bridge-content>
          <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 class="text-lg font-extrabold text-slate-800">เชื่อมประสานข้อมูล Google Sheets & Supabase Cloud</h2>
                <p class="text-xs text-slate-500">จัดการ Endpointผ่าน <code class="bg-slate-100 px-1.5 py-0.5 rounded">/api/config</code> โดยไม่ฝังคีย์ลับไว้ในซอร์สโค้ดหน้าเว็บ</p>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" id="patchSyncLiveSupabaseBtn" class="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-all">
                  🔄 ดึงข้อมูลจริงจาก Supabase
                </button>
                <button type="button" id="patchPushToSupabaseBtn" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all">
                  ☁️ อัปเดตข้อมูลขึ้น Supabase
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Supabase Project URL (จาก /api/config หรือตั้งค่าเอง)</label>
                <input id="patchSupabaseUrlInput" type="text" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-[11px]" placeholder="https://your-project.supabase.co">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Google Apps Script Webhook URL</label>
                <input id="patchAppsScriptUrlInput" type="text" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-[11px]" placeholder="https://script.google.com/macros/s/.../exec">
              </div>
            </div>
            <div id="patchCloudStatusMsg" class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              สถานะ: การเชื่อมต่อใช้ server configuration และ session ที่ได้รับสิทธิ์; ไม่ส่งทะเบียนทับตามชื่อ
            </div>
          </div>
        </div>
      ` + compatibility;
    }
  }

  function mountPdpaToggleButton() {
    if (document.getElementById('pdpaToggleBtnBadge')) return;
    const headerRight = document.querySelector('header .flex.items-center.gap-3') ||
      document.querySelector('header') ||
      document.querySelector('aside');
    if (!headerRight) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pdpaToggleBtnBadge';
    btn.title = 'คลิกเพื่อเปิด/ปิดการปกปิดชื่อ-นามสกุลผู้ป่วยตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)';
    btn.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 transition-all cursor-pointer';
    btn.textContent = 'PDPA: ปกปิดชื่อ (ON)';
    btn.addEventListener('click', () => {
      pdpaMaskEnabled = !pdpaMaskEnabled;
      btn.textContent=pdpaMaskEnabled?'PDPA: ปกปิดชื่อ (ON)':'PDPA: ปกติ (OFF)';
      window.BoLuangApp?.setPrivacy(pdpaMaskEnabled);
    });
    headerRight.appendChild(btn);
  }


document.addEventListener('DOMContentLoaded',()=>{
 ensureAllFiveTabsAndSections();mountPdpaToggleButton();
 document.getElementById('patchSyncLiveSupabaseBtn')?.addEventListener('click',()=>window.BoLuangApp?.sync());
 document.getElementById('patchPushToSupabaseBtn')?.addEventListener('click',()=>document.getElementById('seedSupabaseBtn')?.click());
 window.dispatchEvent(new Event('boluang:blueprint-ready'));
});
})();
