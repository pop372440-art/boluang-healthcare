import test from 'node:test';import assert from 'node:assert/strict';
import {HEALTH_UNITS,mountHealthUnitLayer,facilityPopup} from '../lib/health-units.mjs';
function fixture(checked=true){const layers=new Set(),events={},markers=[];const map={hasLayer:l=>layers.has(l),addLayer:l=>layers.add(l),removeLayer:l=>layers.delete(l)};const checkbox={checked,addEventListener:(n,f)=>events[n]=f};const L={layerGroup:()=>({markers:[],addLayer(m){this.markers.push(m);}}),divIcon:x=>x,marker:(point,options)=>{const m={point,options,bindTooltip(){},bindPopup(p){this.popup=p;}};markers.push(m);return m;}};return {L,map,checkbox,layers,events,markers};}
test('public health layer opens without auth and toggles independently of patient layers',()=>{
 const f=fixture(),patients={};f.layers.add(patients);const {layer,count}=mountHealthUnitLayer(f);assert.equal(count,4);assert.ok(f.layers.has(layer));
 f.checkbox.checked=false;f.events.change();assert.ok(!f.layers.has(layer));assert.ok(f.layers.has(patients));
 f.checkbox.checked=true;f.events.change();f.events.change();assert.equal(layer.markers.length,4);assert.ok(f.layers.has(layer));
});
test('initially disabled layer stays disabled until explicitly enabled',()=>{const f=fixture(false);const {layer}=mountHealthUnitLayer(f);assert.ok(!f.layers.has(layer));f.checkbox.checked=true;f.events.change();assert.ok(f.layers.has(layer));});
test('every facility has a bounded point and public source; invalid coordinates are not invented',()=>{
 const f=fixture();const {count}=mountHealthUnitLayer({...f,units:[...HEALTH_UNITS,{lat:null,lng:null},{lat:NaN,lng:98},{lat:100,lng:200}]});assert.equal(count,4);
 for(const unit of HEALTH_UNITS){assert.ok(unit.lat>18&&unit.lat<18.5&&unit.lng>98&&unit.lng<99);assert.match(unit.source,/^https:\/\//);}
});
test('facility popups escape content and navigate without patient or session information',()=>{
 const popup=facilityPopup({...HEALTH_UNITS[0],name:'<img onerror=bad>'});assert.ok(popup.includes('&lt;img'));assert.ok(!popup.includes('<img'));assert.match(popup,/destination=18.1477924%2C98.3489706/);assert.doesNotMatch(popup,/token=|patient=|origin=/);
 assert.throws(()=>facilityPopup({...HEALTH_UNITS[0],source:'javascript:alert(1)'}));
});
