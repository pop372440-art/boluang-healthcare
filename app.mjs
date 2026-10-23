import {interfaceAccess,emptyState,connectionPresentation,toggleAllGroups,resetFilters,sessionDescription} from './lib/interface.mjs';
import {mountHealthUnitLayer} from './lib/health-units.mjs';
import {syncStatus} from './lib/telehealth-status.mjs';
import {groupIsVisible,toggleGroup,patientMapLinks} from './lib/admin-view.mjs';
import {renderBlueprint} from './lib/blueprint.mjs';
import {assess, summarize, inBoundary, validCoordinates, thaiTime, validateCheckup} from './lib/health-model.mjs';
import {toLegacyPatient, toRawPatient, escapeHtml, formatNumber, csvCell} from './lib/legacy-adapter.mjs';
const patientsData = [];
let boundaryData = null, cloudSession = null, syncedAt = null, loadingPromise = null;
let privacyEnabled = true;
let healthUnitOverlay = null;
const dataEvidence={source:null,linkage:null,phase:'loading',boundary:'loading',authorized:false,masking:true};
function refreshBlueprint(){dataEvidence.counts=summarize(getFilteredPatients().map(toRawPatient),boundaryData);dataEvidence.masking=privacyEnabled;dataEvidence.authorized=Boolean(cloudSession);renderBlueprint(document,dataEvidence);}
      function updateFieldCaptureLink(){
       const link=document.getElementById('fieldCaptureLink');
       const allowed=cloudSession?.canCollectFieldData===true;
       if(link){link.hidden=!allowed;link.style.display=allowed?'flex':'none';}
      }
function updateAccessControls(){
 const access=interfaceAccess(cloudSession);
 const mapLabel=document.querySelector('[data-nav="map"] span');if(mapLabel)mapLabel.textContent=access.staff?'แผนที่ผู้รับบริการ':'แผนที่หน่วยบริการ';
 for(const node of document.querySelectorAll('[data-access]'))node.hidden=!access[node.dataset.access];
 const login=document.getElementById('staffLoginLink');if(login)login.hidden=access.staff;
 const identity=document.getElementById('accountSummary');if(identity){identity.hidden=!access.staff;identity.textContent=sessionDescription(cloudSession);}
 const intro=document.getElementById('publicMapIntro');if(intro)intro.hidden=access.staff;
 const technical=['architecture','sheets'].includes(appState.activeNav);
 for(const selector of ['[aria-label="สรุปสถิติผู้รับการตรวจ"]','[aria-label="ค้นหาและกรองกลุ่มเป้าหมาย"]','#activeFilters','#kpiEvidenceNote','[data-registry-filters]']){const node=document.querySelector(selector);if(node)node.hidden=!access.staff||technical;}
 const summary=document.getElementById('activeFilters');if(summary){const groups=appState.selectedGroups===null?'ทุกกลุ่ม':Array.from(appState.selectedGroups).map(g=>g==='ปกติ'?'กลุ่มทั่วไป':g).join(', ')||'ไม่ได้เลือกกลุ่ม';summary.textContent=`กำลังแสดง: ${groups} · ${appState.villageFilter==='ALL'?'ทุกหมู่บ้าน':'หมู่ '+appState.villageFilter} · ${appState.careUnitFilter==='ALL'?'ทุกหน่วยบริการ':appState.careUnitFilter} · ${appState.riskFilter==='ALL'?'ทุกผลคัดกรอง':'ผลคัดกรอง '+appState.riskFilter}${appState.searchQuery?' · ค้นหา: '+appState.searchQuery:''}`;}
 const writable=document.getElementById('openAddCheckupBtn');if(writable){writable.disabled=!access.write||!patientsData.some(p=>p.writable);writable.title=writable.disabled?'ต้องมีสิทธิ์บันทึกและทะเบียนที่ผูกรหัสผู้รับบริการแล้ว':'บันทึกค่าที่ตรวจวัดได้จริง';}
 if(!access.staff){for(const id of ['viewSummarySection','viewAnalyticsSection','patientDetailModal','addCheckupModal','cloudConfigModal'])document.getElementById(id)?.classList.add('hidden');if(['summary','analytics'].includes(appState.activeNav)){appState.activeNav='map';document.getElementById('viewMapSection')?.classList.remove('hidden');}}
 const sheets=document.getElementById('viewSheetsSection');if(!access.admin&&appState.activeNav==='sheets'){sheets?.classList.add('hidden');appState.activeNav='map';document.getElementById('viewMapSection')?.classList.remove('hidden');}
}
function displayPatient(p) { return privacyEnabled ? {...p,name:`ผู้รับบริการ ${String(p.id).slice(0,8)}`,address:'ปกปิดที่อยู่',photoUrl:'',driveUrl:''} : p; }
async function requestApi(path, options={}) {
 const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 let data;try{data=await res.json();}catch{throw Object.assign(new Error('บริการตอบกลับไม่ใช่ข้อมูลที่ระบบรองรับ'),{status:502});}
 if(!res.ok){
  if(res.status===401||res.status===403){dataEvidence.phase=res.status===401?'unauthorized':'forbidden';patientsData.splice(0);cloudSession=null;updateFieldCaptureLink();updateAccessControls();syncedAt=null;privacyEnabled=true;document.getElementById('patientDetailModal')?.classList.add('hidden');document.getElementById('adminLogoutBtn')?.setAttribute('hidden','');window.dispatchEvent(new CustomEvent('boluang:privacy-change',{detail:{masked:true}}));populateFormSelect();refreshAllViews();}
  throw Object.assign(new Error(data.error||'ไม่สามารถเชื่อมต่อระบบได้'),{status:res.status});
 }
 return data;
}
    const appState = {
      activeNav: 'map',
      searchQuery: '',
      selectedGroups: new Set(['ผู้ป่วยติดเตียง']),
      riskFilter: 'ALL',
      careUnitFilter: 'ALL',
      villageFilter: 'ALL',
      mapMode: 'street',
      isOnline: true,
      offlineQueue: 0,
      activePatientId: null,
      baseTotals: {total:0,normal:0,risk:0,danger:0,outArea:0,unknown:0}
    };

    // ============================================================================
    // 3. MAP INITIALIZATION (Leaflet + Street/Satellite Layers + Tactical Highland SVG)
    // ============================================================================
    let mapInstance = null;
    let streetLayer = null;
    let satelliteLayer = null;
    let markersLayerGroup = null;
    let tambonBoundaryLayer = null;
    let villageBoundaryLayer = null;

    function initMap() {
      const container = document.getElementById('leafletMapContainer');
      if (!container || typeof L === 'undefined') return;

      mapInstance = L.map('leafletMapContainer', {
        center: [18.1680, 98.3550],
        zoom: 13,
        zoomControl: true
      });

      streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap • เทศบาลตำบลบ่อหลวง อ.ฮอด จ.เชียงใหม่'
      });

      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri World Imagery • เทศบาลตำบลบ่อหลวง'
      });

      streetLayer.on('tileerror', () => showToast('โหลดภาพแผนที่ไม่สำเร็จ กรุณาตรวจเครือข่ายหรือเปลี่ยนชั้นแผนที่'));
      satelliteLayer.on('tileerror', () => showToast('โหลดภาพดาวเทียมไม่สำเร็จ'));
      streetLayer.addTo(mapInstance);
      tambonBoundaryLayer = L.layerGroup().addTo(mapInstance);
      villageBoundaryLayer = L.layerGroup().addTo(mapInstance);
      markersLayerGroup = L.layerGroup().addTo(mapInstance);
      healthUnitOverlay=mountHealthUnitLayer({L,map:mapInstance,checkbox:document.getElementById('toggleHealthUnitsChk')});

      // โหลดไฟล์ขอบเขตตำบล (boluang.json) และขอบเขตหมู่บ้าน (block.json) อัตโนมัติเมื่อวางไว้ในโฟลเดอร์เดียวกัน
      loadGeoJsonFromUrl('./boluang.json', 'tambon');
      loadGeoJsonFromUrl('./block.json', 'village');
    }

    function formatGeoPropertiesPopup(props, titlePrefix) {
      titlePrefix=escapeHtml(titlePrefix);
      if (!props || typeof props !== 'object') return `<div class="text-xs font-bold">${titlePrefix}</div>`;
      const rows = Object.entries(props)
        .filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .slice(0, 8)
        .map(([k, v]) => `<tr><td class="pr-2 py-0.5 font-semibold text-slate-600">${escapeHtml(k)}:</td><td class="py-0.5 text-slate-900 font-bold">${escapeHtml(v)}</td></tr>`)
        .join('');
      return `<div class="text-xs space-y-1"><div class="font-bold text-indigo-900 border-b border-slate-200 pb-1">${titlePrefix}</div><table>${rows}</table></div>`;
    }

    // ข้อมูลทางการของทั้ง 13 หมู่บ้านในตำบลบ่อหลวง อำเภอฮอด จังหวัดเชียงใหม่
    const BO_LUANG_13_VILLAGES = [
      { moo: 1, name: 'บ้านบ่อหลวง', pop: 876, unit: 'กองสาธารณสุข ทต.บ่อหลวง' },
      { moo: 2, name: 'บ้านวังกอง', pop: 716, unit: 'กองสาธารณสุข ทต.บ่อหลวง' },
      { moo: 3, name: 'บ้านขุน', pop: 936, unit: 'กองสาธารณสุข ทต.บ่อหลวง' },
      { moo: 4, name: 'บ้านนาฟ่อน', pop: 1434, unit: 'รพ.สต.บ้านนาฟ่อน (ม.4)' },
      { moo: 5, name: 'บ้านแม่ลายเหนือ', pop: 1236, unit: 'รพ.สต.บ้านนาฟ่อน (ม.4)' },
      { moo: 6, name: 'บ้านแม่ลายใต้', pop: 1583, unit: 'รพ.สต.บ้านนาฟ่อน (ม.4)' },
      { moo: 7, name: 'บ้านพุย', pop: 1078, unit: 'รพ.สต.บ้านพุย (ม.7)' },
      { moo: 8, name: 'บ้านกิ่วลม', pop: 575, unit: 'รพ.สต.บ้านพุย (ม.7)' },
      { moo: 9, name: 'บ้านแม่สะนาม', pop: 259, unit: 'รพ.สต.บ้านพุย (ม.7)' },
      { moo: 10, name: 'บ้านเตียนอาง', pop: 936, unit: 'รพ.สต.บ้านพุย (ม.7)' },
      { moo: 11, name: 'บ้านบ่อสะแง๋', pop: 637, unit: 'รพ.สต.บ้านบ่อพะแวน (ม.12)' },
      { moo: 12, name: 'บ้านบ่อพะแวน', pop: 1456, unit: 'รพ.สต.บ้านบ่อพะแวน (ม.12)' },
      { moo: 13, name: 'บ้านแม่หืด', pop: 265, unit: 'รพ.สต.บ้านบ่อพะแวน (ม.12)' }
    ];

    const villagePolygonLayersByMoo = {};

    function detectMooFromProperties(props, fallbackIdx) {
      if (props && typeof props === 'object') {
        // 1. Check direct Moo number fields
        const mooKeys = ['MOO', 'moo', 'Moo', 'VILL_MOO', 'VILL_NO', 'MOO_NO', 'BLK_MOO', 'FID'];
        for (const k of mooKeys) {
          if (props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== '') {
            const n = parseInt(String(props[k]).replace(/\D+/g, ''), 10);
            if (n >= 1 && n <= 13) return n;
          }
        }
        // 2. Check 8-digit / 10-digit DOPA village code (e.g., 50160401 .. 50160413)
        const codeKeys = ['VILL_CODE', 'VILL_ID', 'CODE', 'TAM_CODE', 'AMP_CODE', 'ID'];
        for (const k of codeKeys) {
          if (props[k] !== undefined && props[k] !== null) {
            const s = String(props[k]).trim();
            if (s.length >= 6) {
              const last2 = parseInt(s.slice(-2), 10);
              if (last2 >= 1 && last2 <= 13) return last2;
            }
          }
        }
        // 3. Check Thai village name match across all property values
        const allText = Object.values(props).map((v) => String(v || '')).join(' ');
        for (const vMeta of BO_LUANG_13_VILLAGES) {
          const shortName = vMeta.name.replace(/^บ้าน/, '');
          if (allText.includes(vMeta.name) || (shortName.length >= 2 && allText.includes(shortName))) {
            return vMeta.moo;
          }
        }
        const mooTextMatch = allText.match(/หมู่(?:ที่)?\s*(\d{1,2})/);
        if (mooTextMatch) {
          const mNum = parseInt(mooTextMatch[1], 10);
          if (mNum >= 1 && mNum <= 13) return mNum;
        }
      }
      return null; // A feature index is not a verified village identifier.
    }

    function renderGeoJsonLayer(geojsonData, layerType, fitMap) {
      if (!mapInstance || !geojsonData) return;
      const isTambon = layerType === 'tambon';
      if(isTambon){dataEvidence.boundary='ready';boundaryData=geojsonData;for(const p of patientsData)p.outOfArea=inBoundary(toRawPatient(p),boundaryData)===false;}
      const targetGroup = isTambon ? tambonBoundaryLayer : villageBoundaryLayer;
      if (!targetGroup) return;

      targetGroup.clearLayers();
      const palette = [
        '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899',
        '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4',
        '#e11d48', '#a855f7', '#eab308'
      ];
      let featureIndex = 0;
      const usedMoos = new Set();
      const detectedVillagesForDropdown = [];

      const geoLayer = L.geoJSON(geojsonData, {
        style: () => {
          if (isTambon) {
            return {
              color: '#312e81',
              weight: 3.5,
              dashArray: '8, 4',
              fillColor: '#4f46e5',
              fillOpacity: 0.04
            };
          }
          const c = palette[featureIndex % palette.length];
          return {
            color: c,
            weight: 2.2,
            fillColor: c,
            fillOpacity: 0.16
          };
        },
        onEachFeature: (feature, layer) => {
          const idx = featureIndex++;
          const p = (feature && feature.properties) ? feature.properties : {};
          if (isTambon) {
            const tamName = p.TAM_NAM_T || p.TAMBON_T || p.NAME || 'ตำบลบ่อหลวง (13 หมู่บ้าน)';
            layer.bindPopup(formatGeoPropertiesPopup(p, `ขอบเขตตำบล: ${tamName}`));
            return;
          }

          let mooNum = detectMooFromProperties(p, idx);
          usedMoos.add(mooNum);

          const officialMeta = BO_LUANG_13_VILLAGES.find((v) => v.moo === mooNum) || {
            moo: mooNum,
            name: mooNum===null?'ไม่ระบุหมู่บ้าน':`หมู่ที่ ${mooNum}`,
            pop: 0,
            unit: 'ทต.บ่อหลวง'
          };
          const jsonLabel = p.VILL_NAME || p.VILLAGE || p.VILL_T || p.NAME_T || p.NAME || p.BLK_NAME || '';
          const displayVillageName = (jsonLabel && !/^\d+$/.test(String(jsonLabel).trim()))
            ? String(jsonLabel).trim()
            : officialMeta.name;

          const fullTitle = `หมู่ที่ ${mooNum} ${displayVillageName.startsWith('บ้าน') ? displayVillageName : officialMeta.name}`;
          if(mooNum!==null){villagePolygonLayersByMoo[String(mooNum)] = layer;detectedVillagesForDropdown.push({moo:mooNum,label:fullTitle});}

          // Enrich popup with official 13-village metadata + JSON properties
          const enrichedProps = Object.assign({
            'หมู่ที่': `หมู่ที่ ${mooNum}`,
            'ชื่อหมู่บ้าน': officialMeta.name,
            'หน่วยบริการรับผิดชอบ': officialMeta.unit,
            'ประชากร (คน)': officialMeta.pop ? officialMeta.pop.toLocaleString() : '-'
          }, p);

          layer.bindPopup(formatGeoPropertiesPopup(enrichedProps, `${fullTitle}`));
          layer.bindTooltip(`ม.${mooNum} ${officialMeta.name}`, {
            sticky: true,
            direction: 'center',
            className: 'text-[11px] font-bold'
          });

          // Click on a village polygon in block.json to filter or inspect
          layer.on('click', () => {
            layer.openPopup();
          });

          // Boundary loading must never move or invent a patient coordinate.

        }
      });

      targetGroup.addLayer(geoLayer);

      // If this was block.json (village boundaries), refresh dropdown and re-render markers so pins sit inside the 13 village polygons!
      if (!isTambon && detectedVillagesForDropdown.length > 0) {
        const sel = document.getElementById('villageSelect');
        if (sel) {
          const currentVal = sel.value || 'ALL';
          detectedVillagesForDropdown.sort((a, b) => a.moo - b.moo);
          // Ensure all 13 villages are present in dropdown
          const byMoo = new Map();
          BO_LUANG_13_VILLAGES.forEach((v) => byMoo.set(v.moo, `หมู่ที่ ${v.moo} ${v.name}`));
          detectedVillagesForDropdown.forEach((d) => byMoo.set(d.moo, d.label));

          sel.innerHTML = `<option value="ALL">ทุกหมู่บ้าน (หมู่ 1 - หมู่ ${byMoo.size})</option>` +
            Array.from(byMoo.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([m, lbl]) => `<option value="${m}">${escapeHtml(lbl)}</option>`)
              .join('');
          sel.value = currentVal;
        }
        renderMapAndSidebar();
      }

      if (fitMap) {
        try {
          const b = geoLayer.getBounds();
          if (b && b.isValid()) mapInstance.fitBounds(b, { padding: [24, 24] });
        } catch (e) {}
      }
    }

    async function loadGeoJsonFromUrl(url, layerType) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('geojson_load_failed');
        const data = await res.json();
        if(layerType==='tambon'){boundaryData=data;for(const p of patientsData)p.outOfArea=inBoundary(toRawPatient(p),data)===false;}
        renderGeoJsonLayer(data, layerType, true);
        refreshAllViews();
      } catch (e) {if(layerType==='tambon'){dataEvidence.boundary='error';refreshBlueprint();}showToast('โหลดขอบเขตแผนที่ไม่สำเร็จ ยังยืนยันพิกัดนอกเขตไม่ได้');}
    }

    function getRiskBadgeMeta(risk) {
      if(risk==='UNKNOWN')return {label:'ข้อมูลไม่ครบสำหรับประเมิน',short:'ข้อมูลไม่ครบ',colorHex:'#64748b',bgClass:'bg-slate-50 text-slate-600 border-slate-200'};
      if (risk === 'DANGER') {
        return { label: 'เกณฑ์สุขภาพอันตราย', short: 'อันตราย', colorHex: '#e11d48', bgClass: 'bg-rose-50 text-rose-700 border-rose-200' };
      }
      if (risk === 'RISK') {
        return { label: 'เกณฑ์สุขภาพมีความเสี่ยง', short: 'มีความเสี่ยง', colorHex: '#d97706', bgClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
      return { label: 'เกณฑ์สุขภาพเหมาะสม', short: 'เหมาะสม', colorHex: '#059669', bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    function getFilteredPatients() {
      return patientsData.filter((p) => {
        if (!groupIsVisible(appState.selectedGroups,p.group)) {
          return false;
        }
        if (appState.riskFilter === 'NORMAL' && p.risk !== 'NORMAL') return false;
        if (appState.riskFilter === 'RISK' && p.risk !== 'RISK') return false;
        if (appState.riskFilter === 'DANGER' && p.risk !== 'DANGER') return false;
        if (appState.riskFilter === 'OUTAREA' && !p.outOfArea) return false;
        if (appState.careUnitFilter !== 'ALL' && p.careUnit !== appState.careUnitFilter) return false;
        if (appState.villageFilter !== 'ALL' && String(p.moo) !== String(appState.villageFilter)) return false;

        if (appState.searchQuery.trim() !== '') {
          const q = appState.searchQuery.trim().toLowerCase();
          const matchText = `${escapeHtml(p.name)} ${escapeHtml(p.address)} ${escapeHtml(p.village)} ${escapeHtml(p.group)} ${escapeHtml(p.careUnit)}`.toLowerCase();
          if (!matchText.includes(q)) return false;
        }
        return true;
      });
    }

    // ============================================================================
    // 4. RENDER FUNCTIONS (KPIs, Toggles, Map Markers, Tactical SVG, Summary Table)
    // ============================================================================
    function renderSyncStatus(){
      let panel=document.getElementById('telehealthSyncStatus');
      if(!panel){panel=document.createElement('p');panel.id='telehealthSyncStatus';panel.className='px-4 py-2 text-xs text-slate-600 bg-white border-b border-slate-200';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');document.querySelector('main').prepend(panel);}
      const summary=summarize(patientsData.map(toRawPatient),boundaryData);
      const detail=syncStatus({phase:dataEvidence.phase,source:dataEvidence.source,syncedAt,total:patientsData.length,visible:getFilteredPatients().length,unknown:summary.UNKNOWN,unclassified:patientsData.filter(p=>p.group==='ไม่ระบุ').length,linkage:dataEvidence.linkage});
      panel.replaceChildren();const text=document.createElement('span');
      text.textContent=!cloudSession&&dataEvidence.phase==='unauthorized'?'ดูแผนที่หน่วยบริการได้โดยไม่ต้องเข้าสู่ระบบ':connectionPresentation(dataEvidence.phase).text;panel.append(text);
      const action=document.createElement('button');action.type='button';action.className='ml-3 underline font-semibold';action.textContent=!cloudSession?'เข้าสู่ระบบเจ้าหน้าที่':'ลองโหลดข้อมูลอีกครั้ง';action.addEventListener('click',()=>{if(!cloudSession)window.location.assign('/login');else window.BoLuangApp?.sync();});
      if(!cloudSession||['error','stale','forbidden'].includes(dataEvidence.phase))panel.append(action);
      if(cloudSession){const details=document.createElement('details'),title=document.createElement('summary'),body=document.createElement('p');title.textContent='รายละเอียดข้อมูลและเวลาปรับปรุง';body.textContent=detail;details.append(title,body);panel.append(details);}
    }
    function populateSourceUnits(){
      const select=document.getElementById('WaitUnitSelect');select.replaceChildren();
      for(const unit of ['ALL',...new Set(patientsData.map(p=>p.careUnit))]){const option=document.createElement('option');option.value=unit;option.textContent=unit==='ALL'?'ทุกหน่วยบริการ':unit;select.appendChild(option);}
      if(!Array.from(select.options).some(o=>o.value===appState.careUnitFilter))appState.careUnitFilter='ALL';select.value=appState.careUnitFilter;
    }
    function renderKPIs() {
      const summary=summarize(getFilteredPatients().map(toRawPatient),boundaryData);
      appState.baseTotals={total:summary.total,normal:summary.NORMAL,risk:summary.RISK,danger:summary.DANGER,outArea:summary.outside,unknown:summary.UNKNOWN};
      let note=document.getElementById('kpiEvidenceNote');if(!note){note=document.createElement('p');note.id='kpiEvidenceNote';note.className='px-4 py-2 text-sm';note.dataset.access='staff';document.querySelector('[aria-label="สรุปสถิติผู้รับการตรวจ"]').after(note);}note.hidden=!interfaceAccess(cloudSession).staff||['architecture','sheets'].includes(appState.activeNav);note.textContent=['ready','stale'].includes(dataEvidence.phase)?`ตามตัวกรอง ${summary.total} คน · ข้อมูลไม่ครบ ${summary.UNKNOWN} คน · ยังระบุเขตไม่ได้ ${summary.spatialUnknown} คน`:emptyState(dataEvidence.phase);
      document.getElementById('kpiTotalCount').title=`ข้อมูลไม่ครบสำหรับประเมิน ${summary.UNKNOWN} รายการ • ยังระบุเขตไม่ได้ ${summary.spatialUnknown} รายการ`;
      const totalEl = document.getElementById('kpiTotalCount');
      const normalEl = document.getElementById('kpiNormalCount');
      const riskEl = document.getElementById('kpiRiskCount');
      const dangerEl = document.getElementById('kpiDangerCount');
      const outEl = document.getElementById('kpiOutCount');

      totalEl.textContent = appState.baseTotals.total.toLocaleString();
      normalEl.textContent = appState.baseTotals.normal.toLocaleString();
      riskEl.textContent = appState.baseTotals.risk.toLocaleString();
      dangerEl.textContent = appState.baseTotals.danger.toLocaleString();
      outEl.textContent = appState.baseTotals.outArea.toLocaleString();

      document.getElementById('kpiNormalPct').textContent = ((appState.baseTotals.normal / (appState.baseTotals.total || 1)) * 100).toFixed(2) + ' %';
      document.getElementById('kpiRiskPct').textContent = ((appState.baseTotals.risk / (appState.baseTotals.total || 1)) * 100).toFixed(2) + ' %';
      document.getElementById('kpiDangerPct').textContent = ((appState.baseTotals.danger / (appState.baseTotals.total || 1)) * 100).toFixed(2) + ' %';
      document.getElementById('kpiOutPct').textContent = ((appState.baseTotals.outArea / (appState.baseTotals.total || 1)) * 100).toFixed(2) + ' %';

      if(!['ready','stale'].includes(dataEvidence.phase)){
       for(const id of ['kpiTotalCount','kpiNormalCount','kpiRiskCount','kpiDangerCount','kpiOutCount','kpiNormalPct','kpiRiskPct','kpiDangerPct','kpiOutPct'])document.getElementById(id).textContent='—';
      }

      document.querySelectorAll('.kpi-card').forEach((btn) => {
        const filterKey = btn.getAttribute('data-risk-filter');
        if (filterKey === appState.riskFilter) {
          btn.classList.add('bg-slate-50/90', 'ring-1', 'ring-slate-400');
        } else {
          btn.classList.remove('bg-slate-50/90', 'ring-1', 'ring-slate-400');
        }
      });
    }

    function renderGroupToggles() {
      const allButton=document.getElementById('showAllGroupsBtn');
      allButton.setAttribute('aria-pressed',String(appState.selectedGroups===null));
      allButton.textContent=appState.selectedGroups===null?'แสดงทุกกลุ่ม: เปิด':'แสดงทุกกลุ่ม: ปิด';
      document.querySelectorAll('.group-toggle-btn').forEach((btn) => {
        const groupName = btn.getAttribute('data-group-toggle');
        const isActive = groupIsVisible(appState.selectedGroups,groupName);
        btn.setAttribute('role','switch');btn.setAttribute('aria-checked',String(isActive));btn.title=(groupName==='ปกติ'?'กลุ่มทั่วไป':groupName)+': '+(isActive?'แสดง':'ซ่อน');
        const track = btn.querySelector('.toggle-track');
        const thumb = btn.querySelector('.toggle-thumb');
        if (isActive) {
          track.classList.remove('bg-slate-200', 'border-slate-300');
          track.classList.add('bg-slate-800', 'border-slate-800');
          thumb.classList.remove('translate-x-0');
          thumb.classList.add('translate-x-5');
        } else {
          track.classList.add('bg-slate-200', 'border-slate-300');
          track.classList.remove('bg-slate-800', 'border-slate-800');
          thumb.classList.add('translate-x-0');
          thumb.classList.remove('translate-x-5');
        }
      });
    }

    function renderMapAndSidebar() {
      const filtered = getFilteredPatients();
      document.getElementById('visiblePinCount').textContent = filtered.filter(p=>validCoordinates(toRawPatient(p))).length;
      document.getElementById('sidebarListCountBadge').textContent = `${filtered.length} ราย`;

      // 1. Render Leaflet Markers (Matching Image 1 InfoWindow with patient name link & address)
      if (mapInstance && markersLayerGroup) {
        markersLayerGroup.clearLayers();
        filtered.filter(p=>validCoordinates(toRawPatient(p))).forEach((rawPatient) => {
          const p=displayPatient(rawPatient);
          const meta = getRiskBadgeMeta(p.risk);
          const pinHtml = `
            <div style="
              width: 28px; height: 28px;
              background: ${meta.colorHex};
              border: 3px solid #ffffff;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex; align-items: center; justify-content: center;
            ">
              <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%; transform: rotate(45deg);"></div>
            </div>
          `;
          const icon = L.divIcon({
            className: 'custom-pin-icon',
            html: pinHtml,
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -24]
          });

          const marker = L.marker([p.lat, p.lng], { icon });
          const popupContent = document.createElement('div');
          popupContent.className = 'w-64 text-xs space-y-1.5';
          popupContent.innerHTML = `
            <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>${escapeHtml(p.group)}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] ${meta.bgClass}">${meta.short}</span>
            </div>
            <div class="flex items-start gap-2.5 pt-1">
              ${p.photoUrl ? `<img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.name)}" class="w-14 h-12 rounded-lg object-cover shrink-0 border border-slate-300 shadow-sm" />` : `<div class="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0 border border-indigo-200">${escapeHtml(p.name.slice(0, 2))}</div>`}
              <div class="min-w-0">
                <button type="button" class="popup-open-modal-btn font-bold text-indigo-700 hover:text-indigo-900 underline text-left block">${escapeHtml(p.name)} (${escapeHtml(p.age)} ปี)</button>
                <p class="text-[11px] text-slate-600 leading-snug mt-0.5">${escapeHtml(p.address)}</p>
              </div>
            </div>
            <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>BP: <strong class="text-slate-800">${formatNumber(p.sys)}/${formatNumber(p.dia)}</strong> • DTX: <strong class="text-rose-600">${formatNumber(p.sugar)}</strong></span>
              <button type="button" class="popup-open-modal-btn2 px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700">ดูข้อมูลล่าสุด</button>
            </div>
          `;
          popupContent.querySelector('.popup-open-modal-btn').addEventListener('click', () => openPatientModal(p.id));
          popupContent.querySelector('.popup-open-modal-btn2').addEventListener('click', () => openPatientModal(p.id));

          marker.bindPopup(popupContent);
          markersLayerGroup.addLayer(marker);

        });
      }

      // 2. Render Offline Tactical SVG Map Pins
      const tacticalLayer = document.getElementById('tacticalPinsLayer');
      if (tacticalLayer) {
        tacticalLayer.innerHTML = '';
        filtered.filter(p=>Number.isFinite(p.svgX)&&Number.isFinite(p.svgY)).forEach((rawPatient) => {
          const p=displayPatient(rawPatient);
          const meta = getRiskBadgeMeta(p.risk);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${p.svgX}, ${p.svgY})`);
          g.setAttribute('class', 'cursor-pointer');
          g.innerHTML = `
            <circle cx="0" cy="0" r="14" fill="${meta.colorHex}" fill-opacity="0.28" />
            <circle cx="0" cy="0" r="7.5" fill="${meta.colorHex}" stroke="#ffffff" stroke-width="2" />
            <rect x="-58" y="11" width="116" height="19" rx="4" fill="#0f172a" fill-opacity="0.88" stroke="#334155" stroke-width="1" />
            <text x="0" y="24" text-anchor="middle" fill="#f8fafc" font-size="9.5" font-weight="bold">ม.${escapeHtml(p.moo)} ${escapeHtml(p.name)}</text>
          `;
          g.addEventListener('click', () => openPatientModal(p.id));
          tacticalLayer.appendChild(g);
        });
      }

      // 3. Render Right Sidebar Patient Cards
      const listEl = document.getElementById('mapSidePatientList');
      listEl.innerHTML = '';
      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">${escapeHtml(emptyState(dataEvidence.phase))}</div>`;
        return;
      }

      filtered.forEach((rawPatient) => {
        const p=displayPatient(rawPatient);
        const meta = getRiskBadgeMeta(p.risk);
        const card = document.createElement('div');
        card.className = 'p-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 shadow-sm transition flex flex-col gap-1.5';
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <button type="button" class="card-name-btn text-left font-bold text-xs text-indigo-800 hover:underline">${escapeHtml(p.name)} (${escapeHtml(p.age)} ปี)</button>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.bgClass}">${meta.short}</span>
          </div>
          <p class="text-[11px] text-slate-600 leading-snug">หมู่ที่ ${escapeHtml(p.moo)} ${escapeHtml(p.village)} • <span class="font-semibold text-slate-700">${escapeHtml(p.group)}</span></p>
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
            <span class="text-slate-600">BP <strong>${formatNumber(p.sys)}/${formatNumber(p.dia)}</strong> • SpO2 <strong>${formatNumber(p.spo2)}%</strong> • น้ำตาล <strong>${formatNumber(p.sugar)}</strong></span>
            <div class="flex items-center gap-1">
              <button type="button" class="card-zoom-btn px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">พิกัด</button>
              <button type="button" class="card-modal-btn px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold">6 แถว</button>
            </div>
          </div>
        `;
        card.querySelector('.card-name-btn').addEventListener('click', () => openPatientModal(p.id));
        card.querySelector('.card-modal-btn').addEventListener('click', () => openPatientModal(p.id));
        card.querySelector('.card-zoom-btn').addEventListener('click', () => {
          if (mapInstance && appState.mapMode !== 'tactical' && validCoordinates(toRawPatient(p))) {
            mapInstance.setView([p.lat, p.lng], 15, { animate: true });
          } else {
            openPatientModal(p.id);
          }
        });
        listEl.appendChild(card);
      });
    }

    // Render Summary Table (Matching Image 2 Background Table with all Vital Signs columns)
    function renderSummaryTable() {
      const tbody = document.getElementById('patientSummaryTableBody');
      tbody.innerHTML = '';
      const filtered = getFilteredPatients();

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16" class="py-8 text-center text-slate-600">${escapeHtml(emptyState(dataEvidence.phase))}</td></tr>`;
        return;
      }

      filtered.forEach((rawPatient, idx) => {
        const p=displayPatient(rawPatient);
        const meta = getRiskBadgeMeta(p.risk);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-indigo-50/60 transition cursor-pointer text-center';
        tr.innerHTML = `
          <td class="py-2.5 px-3 text-left font-semibold text-slate-600">${filtered.length - idx}</td>
          <td class="py-2.5 px-3 text-left">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[11px] shrink-0 border border-indigo-200">
                ${escapeHtml(p.name.slice(0, 2))}
              </div>
              <div>
                <div class="font-bold text-slate-900 hover:text-indigo-700 underline">${escapeHtml(p.name)}</div>
                <div class="text-[11px] text-slate-500">หมู่ ${escapeHtml(p.moo)} ${escapeHtml(p.village)} (${escapeHtml(p.careUnit)})</div>
              </div>
            </div>
          </td>
          <td class="py-2.5 px-2 font-semibold">${escapeHtml(p.age)}</td>
          <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-semibold text-[11px]">${escapeHtml(p.group)}</span></td>
          <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded-full border text-[11px] font-bold ${meta.bgClass}">${meta.short}</span></td>
          <td class="py-2.5 px-2 font-medium">${formatNumber(p.temp,1)}</td>
          <td class="py-2.5 px-2 font-medium">${formatNumber(p.weight,1)}</td>
          <td class="py-2.5 px-2 font-medium">${formatNumber(p.bmi,1)}</td>
          <td class="py-2.5 px-2 font-bold ${p.sys >= 140 ? 'text-rose-600' : 'text-slate-800'}">${formatNumber(p.sys)}</td>
          <td class="py-2.5 px-2 font-bold ${p.dia >= 90 ? 'text-rose-600' : 'text-slate-800'}">${formatNumber(p.dia)}</td>
          <td class="py-2.5 px-2">${formatNumber(p.pulse)}</td>
          <td class="py-2.5 px-2 font-bold ${p.spo2 !== null && p.spo2 < 95 ? 'text-rose-600' : 'text-emerald-700'}">${formatNumber(p.spo2)}</td>
          <td class="py-2.5 px-2">${formatNumber(p.pi,1)}</td>
          <td class="py-2.5 px-2 font-bold ${p.sugar >= 140 ? 'bg-rose-100 text-rose-700 rounded' : 'text-slate-800'}">${formatNumber(p.sugar,1)}</td>
          <td class="py-2.5 px-3">${escapeHtml(p.lastDate||'ยังไม่มีวันตรวจ')} ${escapeHtml(p.lastTime||'')}</td>
          <td class="py-2.5 px-3">
            <button type="button" class="row-open-modal-btn px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-sm">
              ดูรายละเอียด
            </button>
          </td>
        `;
        tr.addEventListener('click', () => openPatientModal(p.id));tr.querySelector('.row-open-modal-btn').setAttribute('aria-label','ดูรายละเอียด '+p.name);
        tbody.appendChild(tr);
      });
    }

    // ============================================================================
    // 5. PATIENT DETAIL MODAL (Exact 6-Row Sparse Sensor Table from Image 2)
    // ============================================================================
    function openPatientModal(patientId) {
      const rawPatient = patientsData.find((item) => item.id === patientId);
      if (!rawPatient) return;
      const p=displayPatient(rawPatient);
      appState.activePatientId = p.id;

      const meta = getRiskBadgeMeta(p.risk);
      const headerBanner = document.getElementById('modalHeaderBanner');
      const riskDot = document.getElementById('modalRiskDot');
      const riskTitle = document.getElementById('modalRiskTitle');

      headerBanner.className = 'px-6 py-4 flex items-center justify-between border-b ' +
        (p.risk === 'UNKNOWN' ? 'bg-slate-50 border-slate-200' : p.risk === 'DANGER' ? 'bg-rose-50/70 border-rose-200/80' : p.risk === 'RISK' ? 'bg-amber-50/70 border-amber-200/80' : 'bg-emerald-50/70 border-emerald-200/80');
      riskDot.className = 'w-2.5 h-2.5 rounded-full ' +
        (p.risk === 'UNKNOWN' ? 'bg-slate-400' : p.risk === 'DANGER' ? 'bg-rose-500' : p.risk === 'RISK' ? 'bg-amber-500' : 'bg-emerald-500');
      riskTitle.textContent = meta.label;
      riskTitle.className = 'text-sm font-bold tracking-tight ' +
        (p.risk === 'UNKNOWN' ? 'text-slate-700' : p.risk === 'DANGER' ? 'text-rose-900' : p.risk === 'RISK' ? 'text-amber-900' : 'text-emerald-900');

      document.getElementById('modalGroupBadge').textContent = p.group;
      const photoImgEl = document.getElementById('modalPatientPhotoImg');
      const avatarBoxEl = document.getElementById('modalPatientAvatar');
      const driveLinkEl = document.getElementById('modalDrivePhotoLink');
      if (p.photoUrl) {
        photoImgEl.referrerPolicy='no-referrer';photoImgEl.onerror=()=>{photoImgEl.classList.add('hidden');avatarBoxEl.classList.remove('hidden');avatarBoxEl.textContent='ไม่มีภาพ';};photoImgEl.src = p.photoUrl;
        photoImgEl.classList.remove('hidden');
        avatarBoxEl.classList.add('hidden');
      } else {
        photoImgEl.removeAttribute('src');photoImgEl.classList.add('hidden');
        avatarBoxEl.classList.remove('hidden');
        avatarBoxEl.textContent = p.name.replace(/^(นาย|นางสาว|นาง|แม่อุ๊ย)/, '').trim().slice(0, 2);
      }
      if (p.driveUrl) {
        driveLinkEl.href = p.driveUrl;
        driveLinkEl.classList.remove('hidden');
      } else {
        driveLinkEl.classList.add('hidden');
      }
      document.getElementById('modalPatientName').textContent = p.name;
      document.getElementById('modalPatientAge').textContent = `อายุ ${escapeHtml(p.age)} ปี`;
      document.getElementById('modalCareUnitBadge').textContent = p.careUnit;
      document.getElementById('modalPatientAddress').textContent = p.address;
      document.getElementById('modalPatientCondition').textContent = `ข้อมูลทางคลินิก: ${p.condition||'ยังไม่มีข้อมูลเพียงพอ'} • วันที่ข้อมูล: ${p.lastDate||'—'} ${p.lastTime||''}${p.linkStatus==='linked'?' • ประวัติจาก Supabase':p.linkStatus==='ambiguous'?' • รหัสซ้ำ: ไม่รวมประวัติตรวจ':p.linkStatus==='unmatched'?' • ยังไม่เชื่อมประวัติตรวจ':''}`;
      let locationBox=document.getElementById('adminPatientLocation');
      if(!locationBox){locationBox=document.createElement('div');locationBox.id='adminPatientLocation';locationBox.className='mt-3 flex flex-wrap gap-3 text-sm';document.getElementById('modalPatientAddress').after(locationBox);}
      locationBox.replaceChildren();locationBox.hidden=cloudSession?.role!=='admin'||privacyEnabled;
      if(!locationBox.hidden){const links=patientMapLinks(p);const coordinates=document.createElement('span');coordinates.textContent=links?'พิกัด: '+links.coordinates:'ยังไม่มีพิกัด';locationBox.appendChild(coordinates);
       if(links)for(const [key,label] of [['map','ดูบน Google Maps'],['directions','นำทาง'],['streetView','Google Street View']]){const a=document.createElement('a');a.href=links[key];a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';a.className='text-emerald-700 underline';locationBox.appendChild(a);}
       if(links){const hint=document.createElement('small');hint.textContent='Street View ขึ้นอยู่กับภาพที่ Google มีในพื้นที่';locationBox.appendChild(hint);}
      }


      // Consolidated single-row summary
      document.getElementById('modalSummaryBp').innerHTML = `${formatNumber(p.sys)}/${formatNumber(p.dia)} <span class="text-[10px] font-normal">mmHg (P ${formatNumber(p.pulse)})</span>`;
      document.getElementById('modalSummarySpo2').innerHTML = `${formatNumber(p.spo2)}% <span class="text-[10px] font-normal">(PI ${formatNumber(p.pi)})</span>`;
      document.getElementById('modalSummarySugar').innerHTML = `${formatNumber(p.sugar,1)} <span class="text-[10px] font-normal">mg/dL</span>`;
      document.getElementById('modalSummaryTempWeight').textContent = `${formatNumber(p.temp,1)} °C • ${formatNumber(p.weight,1)} Kg (${formatNumber(p.height)} Cm)`;

      // Populate 6-row sensor table matching Image 2
      const logBody = document.getElementById('modalSensorLogBody');
      logBody.innerHTML = '';
      if(!p.sensorLogs.length){const empty=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=14;cell.className='py-4 text-center text-slate-500';cell.textContent='ยังไม่มีประวัติผลตรวจในแหล่งข้อมูลที่เชื่อมอยู่';empty.appendChild(cell);logBody.appendChild(empty);}
      p.sensorLogs.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
          <td class="border-r border-slate-200 py-2 px-2 font-semibold text-slate-700">${index + 1}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-semibold ${row.temp ? 'text-slate-900 bg-amber-50/40' : 'text-slate-300'}">${escapeHtml(row.temp === '' ? '—' : row.temp ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-semibold ${row.weight ? 'text-slate-900 bg-indigo-50/40' : 'text-slate-300'}">${escapeHtml(row.weight === '' ? '—' : row.weight ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-semibold ${row.height ? 'text-slate-900 bg-indigo-50/40' : 'text-slate-300'}">${escapeHtml(row.height === '' ? '—' : row.height ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-bold ${row.sys ? 'text-indigo-950 bg-indigo-50/70' : 'text-slate-300'}">${escapeHtml(row.sys === '' ? '—' : row.sys ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-bold ${row.dia ? 'text-indigo-950 bg-indigo-50/70' : 'text-slate-300'}">${escapeHtml(row.dia === '' ? '—' : row.dia ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-semibold ${row.pulseBp ? 'text-indigo-900 bg-indigo-50/70' : 'text-slate-300'}">${escapeHtml(row.pulseBp === '' ? '—' : row.pulseBp ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-bold ${row.spo2 ? 'text-sky-900 bg-sky-50/70' : 'text-slate-300'}">${escapeHtml(row.spo2 === '' ? '—' : row.spo2 ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-semibold ${row.pulseOx ? 'text-sky-900 bg-sky-50/70' : 'text-slate-300'}">${escapeHtml(row.pulseOx === '' ? '—' : row.pulseOx ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-semibold ${row.pi ? 'text-sky-900 bg-sky-50/70' : 'text-slate-300'}">${escapeHtml(row.pi === '' ? '—' : row.pi ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 font-extrabold ${row.sugar ? 'text-rose-700 bg-rose-50/80' : 'text-slate-300'}">${escapeHtml(row.sugar === '' ? '—' : row.sugar ?? '—')}</td>
          <td class="border-r border-slate-200 py-2 px-2 text-slate-700 font-medium">${escapeHtml(row.inspector)}</td>
          <td class="border-r border-slate-200 py-2 px-2 text-slate-700">${escapeHtml(row.date || '—')}</td>
          <td class="py-2 px-2 text-slate-700 font-mono">${escapeHtml(row.time || '—')}</td>
        `;
        logBody.appendChild(tr);
      });

      document.getElementById('patientDetailModal').classList.remove('hidden');
    }

    // ============================================================================
    // 6. CHARTS INITIALIZATION (Analytics Tab)
    // ============================================================================
    let villageChartInstance = null;
    let riskChartInstance = null;

    function initCharts() {
      if (typeof Chart === 'undefined') return;
      const pts=getFilteredPatients();
      const available=['ready','stale'].includes(dataEvidence.phase)&&pts.length>0;
      for(const id of ['villageDistributionChart','riskBreakdownChart']){const chart=document.getElementById(id);if(chart)chart.hidden=!available;}
      const notice=document.getElementById('analyticsNotice');if(notice)notice.textContent=available?`ผู้รับบริการ ${pts.length} คนตามตัวกรอง · อัปเดต ${thaiTime(syncedAt)}`:emptyState(dataEvidence.phase);
      if(!available)return;
      const countGroup=g=>Array.from({length:13},(_,i)=>pts.filter(p=>p.moo===i+1&&p.group===g).length);
      const summary=summarize(pts.map(toRawPatient),boundaryData);
      const ctx1 = document.getElementById('villageDistributionChart');
      const ctx2 = document.getElementById('riskBreakdownChart');
      if (!ctx1 || !ctx2) return;

      if (villageChartInstance) villageChartInstance.destroy();
      if (riskChartInstance) riskChartInstance.destroy();

      villageChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: [
            'ม.1 บ่อหลวง', 'ม.2 วังกอง', 'ม.3 บ้านขุน', 'ม.4 นาฟ่อน', 'ม.5 แม่ลายเหนือ',
            'ม.6 แม่ลายใต้', 'ม.7 บ้านพุย', 'ม.8 กิ่วลม', 'ม.9 แม่สะนาม', 'ม.10 เตียนอาง',
            'ม.11 บ่อสะแง๋', 'ม.12 บ่อพะแวน', 'ม.13 แม่หืด'
          ],
          datasets: [
            { label: 'ผู้ป่วยติดเตียง', data: countGroup('ผู้ป่วยติดเตียง'), backgroundColor: '#e11d48', borderRadius: 4 },
            { label: 'ผู้พิการ', data: countGroup('ผู้พิการ'), backgroundColor: '#4f46e5', borderRadius: 4 },
            { label: 'กลุ่มเปราะบาง', data: countGroup('กลุ่มเปราะบาง'), backgroundColor: '#f59e0b', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
      });

      riskChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: [`เกณฑ์สุขภาพอันตราย (${summary.DANGER} ราย)`, `เกณฑ์สุขภาพมีความเสี่ยง (${summary.RISK} ราย)`, `เกณฑ์สุขภาพเหมาะสม (${summary.NORMAL} ราย)`, `ข้อมูลไม่ครบ (${summary.UNKNOWN} ราย)`],
          datasets: [{
            data: [summary.DANGER,summary.RISK,summary.NORMAL,summary.UNKNOWN],
            backgroundColor: ['#e11d48', '#f59e0b', '#65a30d', '#64748b'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    // ============================================================================
    // 7. HELPER UI & EVENT LISTENERS
    // ============================================================================
    function showToast(msg) {
      const banner = document.getElementById('toastBanner');
      document.getElementById('toastMessage').textContent = msg;
      banner.classList.remove('hidden');
      setTimeout(() => {
        banner.classList.add('hidden');
      }, 3600);
    }

    function refreshAllViews() {
      updateAccessControls();
      renderSyncStatus();
      renderKPIs();
      renderGroupToggles();
      renderMapAndSidebar();
      renderSummaryTable();
      if(villageChartInstance||riskChartInstance)initCharts();
      refreshBlueprint();
    }

    function populateFormSelect() {
      const sel = document.getElementById('formPatientSelect');
      sel.innerHTML = '';
      patientsData.filter(p=>p.writable).map(displayPatient).forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (หมู่ ${p.moo} ${p.village} - ${p.group})`;
        sel.appendChild(opt);
      });
    }

    window.addEventListener('DOMContentLoaded', () => {
      const clock=()=>document.getElementById('liveClockText').textContent=thaiTime(new Date().toISOString());clock();setInterval(clock,60000);
      try{localStorage.removeItem('boluang_cloud_cfg');}catch{}
      initMap();

      const dashBtn = document.getElementById('toggleDashboardMenuBtn');
      const dashSub = document.getElementById('dashboardSubmenu');
      const dashArr = document.getElementById('dashboardMenuArrow');
      if (dashBtn && dashSub) {
        dashBtn.addEventListener('click', () => {
          const isHidden = dashSub.classList.toggle('hidden');
          if (dashArr) dashArr.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
        });
      }

      const setBtn = document.getElementById('toggleSettingsMenuBtn');
      const setSub = document.getElementById('settingsSubmenu');
      const setArr = document.getElementById('settingsMenuArrow');
      if (setBtn && setSub) {
        setBtn.addEventListener('click', () => {
          const isHidden = setSub.classList.toggle('hidden');
          if (setArr) setArr.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(90deg)';
        });
      }

      populateFormSelect();
      refreshAllViews();
      initCharts();

      // Sidebar Navigation Tabs
      document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-nav');
          const access=interfaceAccess(cloudSession);if(['summary','analytics'].includes(target)&&!access.staff)return window.location.assign('/login');if(target==='sheets'&&!access.admin)return showToast('เมนูนี้สำหรับผู้ดูแลระบบ');
          appState.activeNav = target;updateAccessControls();
          refreshBlueprint();

          document.querySelectorAll('.nav-tab-btn').forEach((b) => {
            b.classList.remove('bg-slate-100', 'text-slate-900', 'font-semibold', 'border-slate-200');
            b.classList.add('text-slate-600', 'border-transparent');
          });
          btn.classList.remove('text-slate-600', 'border-transparent');
          btn.classList.add('bg-slate-100', 'text-slate-900', 'font-semibold', 'border-slate-200');

          const mapSec = document.getElementById('viewMapSection');
          const sumSec = document.getElementById('viewSummarySection');
          const anaSec = document.getElementById('viewAnalyticsSection');
          const archSec = document.getElementById('viewArchitectureSection');
          const sheetsSec = document.getElementById('viewSheetsSection');

          if (target === 'map') {
            mapSec.classList.remove('hidden');
            sumSec.classList.add('hidden');
            anaSec.classList.add('hidden');
            archSec.classList.add('hidden');
            sheetsSec.classList.add('hidden');
            if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 150);
          } else if (target === 'summary') {
            mapSec.classList.add('hidden');
            sumSec.classList.remove('hidden');
            anaSec.classList.add('hidden');
            archSec.classList.add('hidden');
            sheetsSec.classList.add('hidden');
          } else if (target === 'analytics') {
            mapSec.classList.add('hidden');
            sumSec.classList.add('hidden');
            anaSec.classList.remove('hidden');
            archSec.classList.add('hidden');
            sheetsSec.classList.add('hidden');
            initCharts();
          } else if (target === 'architecture') {
            mapSec.classList.add('hidden');
            sumSec.classList.add('hidden');
            anaSec.classList.add('hidden');
            archSec.classList.remove('hidden');
            sheetsSec.classList.add('hidden');
          } else if (target === 'sheets') {
            mapSec.classList.add('hidden');
            sumSec.classList.add('hidden');
            anaSec.classList.add('hidden');
            archSec.classList.add('hidden');
            sheetsSec.classList.remove('hidden');
            if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 150);
          }
        });
      });

      // KPI Filter Click
      document.querySelectorAll('.kpi-card').forEach((card) => {
        card.addEventListener('click', () => {
          const filter = card.getAttribute('data-risk-filter');
          appState.riskFilter = (appState.riskFilter === filter && filter !== 'ALL') ? 'ALL' : filter;
          refreshAllViews();
        });
      });

      // Target Group Pill Toggles
      document.querySelectorAll('.group-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const group = btn.getAttribute('data-group-toggle');
          const groups=[...patientsData.map(p=>p.group),...Array.from(document.querySelectorAll('.group-toggle-btn'),b=>b.getAttribute('data-group-toggle'))];
          appState.selectedGroups=toggleGroup(appState.selectedGroups,group,groups);
          refreshAllViews();
        });
      });

      document.getElementById('showAllGroupsBtn').addEventListener('click', () => {
        Object.assign(appState,toggleAllGroups(appState));
        refreshAllViews();
        showToast(appState.selectedGroups===null?'แสดงทุกกลุ่มแล้ว':'แสดงเฉพาะผู้ป่วยติดเตียงแล้ว');
      });

      // Search Input
      const searchInput = document.getElementById('patientSearchInput');
      const clearBtn = document.getElementById('clearSearchBtn');
      searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value;
        clearBtn.classList.toggle('hidden', appState.searchQuery === '');
        refreshAllViews();
      });
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        appState.searchQuery = '';
        clearBtn.classList.add('hidden');
        refreshAllViews();
      });

      // Sidebar Dropdown Filters
      document.getElementById('WaitUnitSelect').addEventListener('change', (e) => {
        appState.careUnitFilter = e.target.value;
        refreshAllViews();
      });
      document.getElementById('villageSelect').addEventListener('change', (e) => {
        appState.villageFilter = e.target.value;
        refreshAllViews();
        if (mapInstance && appState.mapMode !== 'tactical') {
          if (e.target.value === 'ALL') {
            try {
              const allBounds = villageBoundaryLayer && villageBoundaryLayer.getLayers().length > 0
                ? villageBoundaryLayer.getLayers()[0].getBounds()
                : null;
              if (allBounds && allBounds.isValid()) mapInstance.fitBounds(allBounds, { padding: [24, 24] });
            } catch (err) {}
          } else {
            const poly = villagePolygonLayersByMoo[String(e.target.value)];
            if (poly && poly.getBounds) {
              try {
                mapInstance.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 15 });
                poly.openPopup();
              } catch (err) {}
            }
          }
        }
      });

      // Map Mode Switcher (แผนที่ | ดาวเทียม | แผนที่โครงข่าย 12 หมู่บ้าน Offline GIS)
      document.querySelectorAll('.map-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-map-mode');
          appState.mapMode = mode;

          document.querySelectorAll('.map-mode-btn').forEach((b) => {
            b.className = 'map-mode-btn px-3.5 py-1.5 text-xs font-medium bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition';
          });
          btn.className = 'map-mode-btn px-3.5 py-1.5 text-xs font-semibold bg-slate-100/90 text-slate-900 transition';

          const leafletDiv = document.getElementById('leafletMapContainer');
          const tacticalDiv = document.getElementById('tacticalSvgContainer');

          if (mode === 'tactical') {
            leafletDiv.classList.add('hidden');
            tacticalDiv.classList.remove('hidden');
          } else {
            leafletDiv.classList.remove('hidden');
            tacticalDiv.classList.add('hidden');
            if (mapInstance) {
              if (mode === 'satellite') {
                mapInstance.removeLayer(streetLayer);
                satelliteLayer.addTo(mapInstance);
              } else {
                mapInstance.removeLayer(satelliteLayer);
                streetLayer.on('tileerror', () => showToast('โหลดภาพแผนที่ไม่สำเร็จ กรุณาตรวจเครือข่ายหรือเปลี่ยนชั้นแผนที่'));
      satelliteLayer.on('tileerror', () => showToast('โหลดภาพดาวเทียมไม่สำเร็จ'));
      streetLayer.addTo(mapInstance);
              }
              setTimeout(() => mapInstance.invalidateSize(), 100);
            }
          }
        });
      });

      // เปิด-ปิด เลเยอร์ขอบเขตตำบล (boluang.json) และขอบเขตหมู่บ้าน (block.json)
      document.getElementById('toggleTambonBoundaryChk').addEventListener('change', (e) => {
        if (!mapInstance || !tambonBoundaryLayer) return;
        if (e.target.checked) mapInstance.addLayer(tambonBoundaryLayer);
        else mapInstance.removeLayer(tambonBoundaryLayer);
      });
      document.getElementById('toggleVillageBoundaryChk').addEventListener('change', (e) => {
        if (!mapInstance || !villageBoundaryLayer) return;
        if (e.target.checked) mapInstance.addLayer(villageBoundaryLayer);
        else mapInstance.removeLayer(villageBoundaryLayer);
      });

      // ปุ่มเลือกไฟล์ boluang.json / block.json จากเครื่องคอมพิวเตอร์เพื่อแสดงผลทันที
      const geoInput = document.getElementById('geoJsonFileInput');
      document.getElementById('uploadGeoJsonBtn').addEventListener('click', () => {
        if(!interfaceAccess(cloudSession).admin)return;
        geoInput.click();
      });
      geoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const json = JSON.parse(ev.target.result);
              const fname = file.name.toLowerCase();
              const isTambon = fname.includes('boluang') || fname.includes('tambon');
              renderGeoJsonLayer(json, isTambon ? 'tambon' : 'village', true);
              showToast(`แสดงเส้นขอบเขตจากไฟล์ ${file.name} บนแผนที่สำเร็จ!`);
            } catch (err) {
              showToast(`ไฟล์ ${file.name} ไม่ใช่รูปแบบ GeoJSON ที่ถูกต้อง`);
            }
          };
          reader.readAsText(file);
        });
      });

      // คลิกที่โลโก้เพื่ออัปโหลดเปลี่ยนโลโก้เทศบาลตำบลบ่อหลวงได้ทันที
      const logoBox = document.getElementById('logoContainerBox');
      const logoInput = document.getElementById('logoFileInput');
      const customLogoImg = document.getElementById('customLogoImg');
      const defaultLogoSvg = document.getElementById('defaultLogoSvg');

      try {
        const savedLogo = localStorage.getItem('boluang_custom_logo');
        if (savedLogo) {
          customLogoImg.src = savedLogo;
          customLogoImg.classList.remove('hidden');
          defaultLogoSvg.classList.add('hidden');
        }
      } catch (e) {}

      logoBox.addEventListener('click', () => {
        logoInput.click();
      });
      logoInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          customLogoImg.src = dataUrl;
          customLogoImg.classList.remove('hidden');
          defaultLogoSvg.classList.add('hidden');
          try {
            localStorage.setItem('boluang_custom_logo', dataUrl);
          } catch (err) {}
          showToast('เปลี่ยนโลโก้เทศบาลตำบลบ่อหลวงเรียบร้อยแล้ว!');
        };
        reader.readAsDataURL(file);
      });

      document.getElementById('resetMapCenterBtn').addEventListener('click', () => {
        if (mapInstance && appState.mapMode !== 'tactical') {
          mapInstance.setView([18.1680, 98.3550], 13, { animate: true });
        }
        showToast('รีเซ็ตพิกัดกึ่งกลางเทศบาลตำบลบ่อหลวงแล้ว');
      });

      // Network Online/Offline Simulation for Highland Villages
      const updateNetwork=()=>{appState.isOnline=navigator.onLine;};
      window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);updateNetwork();
      document.getElementById('toggleNetworkBtn').addEventListener('click',()=>showToast(navigator.onLine?'เครือข่ายพร้อมใช้งาน':'เครือข่ายออฟไลน์'));
      document.getElementById('syncQueueBtn').addEventListener('click',()=>syncFromLiveCloud(false));
      // Modal 1 Controls
      document.getElementById('closePatientModalBtn').addEventListener('click', () => {
        document.getElementById('patientDetailModal').classList.add('hidden');
      });

      function downloadCsv(filename,rows){if(!interfaceAccess(cloudSession).staff)return showToast('กรุณาเข้าสู่ระบบเพื่อดาวน์โหลดข้อมูล');const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      document.getElementById('downloadPatientReportBtn').addEventListener('click',()=>{
       const p=patientsData.find(p=>p.id===appState.activePatientId);if(!p)return;
       downloadCsv('vital_signs.csv',[['ลำดับ','อุณหภูมิ','น้ำหนัก','ส่วนสูง','SYS','DIA','ชีพจร','SpO2','น้ำตาล','ผู้ตรวจ','วันที่','เวลา'],...p.sensorLogs.map((r,i)=>[i+1,r.temp,r.weight,r.height,r.sys,r.dia,r.pulseBp,r.spo2,r.sugar,privacyEnabled?'เจ้าหน้าที่':r.inspector,r.date,r.time])]);
      });

      document.getElementById('simulateNewReadingForPatientBtn').addEventListener('click',()=>showToast('ไม่สร้างผลตรวจจำลองในทะเบียนจริง กรุณารับค่าที่วัดได้ผ่านแบบฟอร์มเดิม'));
      // Export Full Summary CSV
      document.getElementById('exportCsvBtn').addEventListener('click',()=>downloadCsv('bo_luang_healthcare_summary.csv',[
       ['รหัส','ชื่อ-สกุล','อายุ','กลุ่มเป้าหมาย','เกณฑ์สุขภาพ','หมู่','หน่วยบริการ','อุณหภูมิ','น้ำหนัก','BMI','SYS','DIA','ชีพจร','SpO2','น้ำตาล'],
       ...getFilteredPatients().map(displayPatient).map(p=>[p.id,p.name,p.age,p.group,p.risk,p.moo,p.careUnit,p.temp,p.weight,p.bmi,p.sys,p.dia,p.pulse,p.spo2,p.sugar])
      ]));

      // Modal 2: Add Checkup Form
      const addModal = document.getElementById('addCheckupModal');
      document.getElementById('openAddCheckupBtn').addEventListener('click', () => {
        if(!interfaceAccess(cloudSession).write)return showToast('บัญชีนี้ไม่มีสิทธิ์บันทึกผลตรวจ');
        if(!patientsData.some(p=>p.writable))return showToast('ชีตนี้มีเฉพาะข้อมูลต้นทางที่ยังไม่ผูกกับรหัสทะเบียนสำหรับบันทึกผลตรวจ');
        for(const id of ['Sys','Dia','Pulse','Spo2','Sugar','Temp','Weight'])document.getElementById('form'+id+'Input').value='';
        addModal.classList.remove('hidden');
      });
      document.getElementById('closeAddCheckupModalBtn').addEventListener('click', () => {
        addModal.classList.add('hidden');
      });
      document.getElementById('cancelCheckupBtn').addEventListener('click', () => {
        addModal.classList.add('hidden');
      });

      document.getElementById('checkupForm').addEventListener('submit',async e=>{
       e.preventDefault();const p=patientsData.find(p=>p.id===document.getElementById('formPatientSelect').value);if(!p)return;
       const btn=e.submitter;btn.disabled=true;
       try{
        const payload={id:p.id,record_version:p.recordVersion,visited_at:new Date().toISOString()};
        for(const [id,key] of Object.entries({Sys:'bp_sys',Dia:'bp_dia',Pulse:'pulse',Spo2:'spo2',Sugar:'blood_sugar',Temp:'temp_c',Weight:'weight_kg'}))payload[key]=document.getElementById('form'+id+'Input').value;
        validateCheckup(payload);
        await requestApi('/api/patients',{method:'POST',body:JSON.stringify(payload)});
        addModal.classList.add('hidden');await syncFromLiveCloud(true);openPatientModal(p.id);showToast('บันทึกผลตรวจสำเร็จ');
       }catch(err){showToast(err.message);}finally{btn.disabled=false;}
      });

      document.getElementById('focusDoiPupengBtn').addEventListener('click',()=>{
       const p=patientsData.find(p=>p.id===appState.activePatientId)||patientsData.find(p=>p.patientCode==='SHEET-001');
       if(!p)return showToast('ยังไม่มีรายการที่เลือก');if(mapInstance&&validCoordinates(toRawPatient(p)))mapInstance.setView([p.lat,p.lng],15);openPatientModal(p.id);
      });
      document.getElementById('importSheetRowsBtn').addEventListener('click',()=>showToast('ข้อมูลพิกัดต้องจับคู่รหัสผู้รับบริการก่อนนำเข้า ไม่มีการเติมค่าตรวจหรือเขียนทับตามชื่อ'));

      function copyTextWithFallback(text, label) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast(`คัดลอก ${label} เรียบร้อยแล้ว`));
            return;
          }
        } catch (err) {}
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`คัดลอก ${label} เรียบร้อยแล้ว`);
      }

      document.getElementById('copySqlCodeBtn').addEventListener('click', () => {
        fetch('/db/audit-access.sql').then(r=>{if(!r.ok)throw Error();return r.text();}).then(code=>copyTextWithFallback(code,'โค้ด SQL สำหรับ Supabase')).catch(()=>showToast('โหลดโค้ด SQL ไม่สำเร็จ'));
      });
      document.getElementById('copyGasCodeBtn').addEventListener('click', () => {
        fetch('/google_apps_script.gs').then(r=>{if(!r.ok)throw Error();return r.text();}).then(code=>copyTextWithFallback(code,'โค้ด Google Apps Script')).catch(()=>showToast('โหลด Apps Script ไม่สำเร็จ'));
      });

      function updateCloudBadge(){const state=connectionPresentation(dataEvidence.phase);document.getElementById('cloudStatusBtnLabel').textContent=state.text;document.getElementById('openCloudConfigBtn').dataset.tone=state.tone;}
      function syncFromLiveCloud(silent){
       if(loadingPromise)return loadingPromise;
       loadingPromise=(async()=>{
        dataEvidence.phase=syncedAt?'stale':'loading';refreshAllViews();updateCloudBadge('กำลังเชื่อมต่อ');
        try{
         cloudSession=await requestApi('/api/session');
         updateAdminSessionControls();updateAccessControls();
         const result=await requestApi('/api/patients');
         const next=result.data.map(row=>toLegacyPatient(row,boundaryData));
         if(!syncedAt){window.BoLuangApp.setPrivacy(cloudSession.role!=='admin');}
         patientsData.splice(0,patientsData.length,...next);syncedAt=result.synced_at;dataEvidence.phase='ready';dataEvidence.source=result.source;dataEvidence.linkage=result.linkage||null;populateSourceUnits();
         populateFormSelect();refreshAllViews();updateCloudBadge(result.source==='google_sheets'?'เชื่อมต่อ Google Sheets แล้ว':'เชื่อมต่อฐานข้อมูลแล้ว');
         if(!silent)showToast(`ซิงค์สำเร็จ ${patientsData.length} รายการ • ${thaiTime(syncedAt)}`);
         return true;
        }catch(err){if(err.status!==401&&err.status!==403)dataEvidence.phase=syncedAt?'stale':'error';refreshAllViews();updateCloudBadge(err.status===401?'กรุณาเข้าสู่ระบบ':err.status===403?'บัญชีไม่มีสิทธิ์':'ยังเชื่อมต่อไม่สำเร็จ');if(!silent)showToast(err.message);return false;}
        finally{loadingPromise=null;}
       })();return loadingPromise;
      }
      function updateAdminSessionControls(){
       updateFieldCaptureLink();updateAccessControls();
       let button=document.getElementById('adminLogoutBtn');
       if(!button){button=document.createElement('button');button.id='adminLogoutBtn';button.type='button';button.className='px-3 py-1.5 rounded-lg bg-white text-rose-700 border border-rose-200 font-medium';button.textContent='ออกจากระบบ';
        document.getElementById('openCloudConfigBtn').after(button);
        button.addEventListener('click',async()=>{button.disabled=true;try{await requestApi('/api/session',{method:'DELETE'});window.location.replace('/login');}catch(e){if(e.status===401)window.location.replace('/login');else{showToast(e.message);button.disabled=false;}}});
       }
       button.hidden=!cloudSession;
      }
      const cloudModal=document.getElementById('cloudConfigModal');
      async function checkSystem(){
       if(!interfaceAccess(cloudSession).admin)return;
       const report=document.getElementById('connectionReport'),button=document.getElementById('testFetchCloudBtn');button.disabled=true;report.textContent='กำลังตรวจสอบ…';
       try{const response=await fetch('/api/health',{credentials:'same-origin',cache:'no-store'});const result=await response.json();if(!response.ok&&!result.checks)throw Object.assign(Error(result.error||'ตรวจการเชื่อมต่อไม่สำเร็จ'),{status:response.status});
        if(!interfaceAccess(cloudSession).admin)return;
        const labels={reachable:'เชื่อมต่อได้',unavailable:'เชื่อมต่อไม่ได้',not_configured:'ยังไม่ได้ตั้งค่า',invalid_source:'แหล่งข้อมูลไม่ถูกต้อง'};
        report.textContent=`Google Sheets: ${labels[result.checks.googleSheets.status]||'ยังไม่ยืนยัน'} · ฐานข้อมูลประวัติผลตรวจ: ${labels[result.checks.supabase.status]||'ยังไม่ยืนยัน'} · ตรวจเมื่อ ${thaiTime(result.timestamp)}`;
       }catch(e){report.textContent=e.message;if(e.status===401||e.status===403){cloudModal.classList.add('hidden');await syncFromLiveCloud(true);}}finally{button.disabled=false;}
      }
      function openConnections(){if(!interfaceAccess(cloudSession).admin)return;cloudModal.classList.remove('hidden');document.getElementById('connectionReport').textContent='กดตรวจสอบเพื่อรับสถานะล่าสุด';}
      document.getElementById('openCloudConfigBtn').addEventListener('click',()=>{if(interfaceAccess(cloudSession).admin)openConnections();else syncFromLiveCloud(false);});
      for(const id of ['closeCloudConfigModalBtn','cancelCloudConfigBtn'])document.getElementById(id).addEventListener('click',()=>cloudModal.classList.add('hidden'));
      document.getElementById('testFetchCloudBtn').addEventListener('click',checkSystem);
      document.getElementById('seedSupabaseBtn').addEventListener('click',()=>showToast('ทะเบียนต้นทางอ่านอย่างเดียว บันทึกผลตรวจผ่านรายการที่ผูกรหัสแล้ว'));
      document.getElementById('quickPullSupabaseBtn')?.addEventListener('click',()=>syncFromLiveCloud(false));
      document.getElementById('quickOpenConfigBtn')?.addEventListener('click',openConnections);
      document.getElementById('clearAllFiltersBtn').addEventListener('click',()=>{Object.assign(appState,resetFilters(appState));document.getElementById('patientSearchInput').value='';document.getElementById('clearSearchBtn').classList.add('hidden');document.getElementById('WaitUnitSelect').value='ALL';document.getElementById('villageSelect').value='ALL';refreshAllViews();});
      document.getElementById('fitHealthUnitsBtn').addEventListener('click',()=>{const checkbox=document.getElementById('toggleHealthUnitsChk');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));const markers=healthUnitOverlay?.layer.getLayers()||[];if(markers.length)mapInstance.fitBounds(L.latLngBounds(markers.map(m=>m.getLatLng())),{padding:[65,65],maxZoom:13});});

      window.BoLuangApp={getPrivacy:()=>privacyEnabled,setPrivacy(enabled){privacyEnabled=Boolean(enabled);window.dispatchEvent(new CustomEvent('boluang:privacy-change',{detail:{masked:privacyEnabled}}));populateFormSelect();refreshAllViews();if(appState.activePatientId&&!document.getElementById('patientDetailModal').classList.contains('hidden'))openPatientModal(appState.activePatientId);},sync:()=>syncFromLiveCloud(false)};
      window.addEventListener('boluang:blueprint-ready',()=>{refreshBlueprint();updateAccessControls();});
      refreshBlueprint();updateAccessControls();updateCloudBadge();syncFromLiveCloud(true);
    });
