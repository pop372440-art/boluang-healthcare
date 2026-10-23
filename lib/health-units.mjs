// Public facility locations only. These records are independent of patient access.
// Coordinates are map-provider reference points, not a new field survey.
export const HEALTH_UNITS = Object.freeze([
 {id:'municipal',name:'กองสาธารณสุขและสิ่งแวดล้อม ทต.บ่อหลวง',site:'สำนักงานเทศบาลตำบลบ่อหลวง',lat:18.1477924,lng:98.3489706,color:'#2563eb',source:'https://www.openstreetmap.org/node/3247319513'},
 {id:'na-fon',name:'รพ.สต.บ้านนาฟ่อน',site:'ตำบลบ่อหลวง อำเภอฮอด จังหวัดเชียงใหม่',lat:18.09336,lng:98.36518,color:'#059669',source:'https://map.longdo.com/p/A00024559'},
 {id:'phui',name:'รพ.สต.บ้านพุย',site:'หมู่ที่ 7 ตำบลบ่อหลวง อำเภอฮอด',lat:18.076099079,lng:98.313300285,color:'#7c3aed',source:'https://map.longdo.com/p/A10308103'},
 {id:'bo-phawaen',name:'รพ.สต.บ้านบ่อพะแวน',site:'หมู่ที่ 12 ตำบลบ่อหลวง อำเภอฮอด',lat:18.14915,lng:98.35529,color:'#d97706',source:'https://map.longdo.com/p/A00024622'}
].map(unit=>Object.freeze({...unit,checkedAt:'2026-10-23'})));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validFacility(unit){return Number.isFinite(unit?.lat)&&Number.isFinite(unit?.lng)&&unit.lat>=-90&&unit.lat<=90&&unit.lng>=-180&&unit.lng<=180;}
export function facilityPopup(unit){
 const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('destination',`${unit.lat},${unit.lng}`);
 const source=new URL(unit.source);
 if(source.protocol!=='https:'||!['www.openstreetmap.org','map.longdo.com'].includes(source.hostname))throw Error('Invalid facility source');
 return `<div style="min-width:190px;max-width:260px"><strong>${escape(unit.name)}</strong><p>${escape(unit.site)}</p><p style="font-size:11px;color:#64748b">พิกัดอ้างอิงจากแผนที่สาธารณะ</p><a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">นำทาง Google Maps</a> · <a href="${escape(source.href)}" target="_blank" rel="noopener noreferrer">แหล่งพิกัด</a></div>`;
}
export function mountHealthUnitLayer({L,map,checkbox,units=HEALTH_UNITS}){
 const layer=L.layerGroup();let count=0;
 for(const unit of units){
  if(!validFacility(unit))continue;
  const color=/^#[0-9a-f]{6}$/i.test(unit.color)?unit.color:'#059669';
  const icon=L.divIcon({className:'health-unit-marker',html:`<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:${color};border:2px solid white;box-shadow:0 2px 6px #0005;color:white;font:bold 23px sans-serif">+</span>`,iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-18]});
  const marker=L.marker([unit.lat,unit.lng],{icon,title:unit.name,alt:unit.name,keyboard:true,zIndexOffset:500});
  marker.bindTooltip(escape(unit.name),{direction:'top',offset:[0,-16]});marker.bindPopup(facilityPopup(unit));layer.addLayer(marker);count++;
 }
 const sync=()=>{if(!checkbox||checkbox.checked){if(!map.hasLayer(layer))map.addLayer(layer);}else if(map.hasLayer(layer))map.removeLayer(layer);};
 if(checkbox){checkbox.title=`หน่วยบริการ ${count} แห่ง — เปิดดูได้โดยไม่ต้องเข้าสู่ระบบ`;checkbox.addEventListener('change',sync);}
 sync();return {layer,count};
}
