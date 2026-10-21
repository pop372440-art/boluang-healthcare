import test from 'node:test';import assert from 'node:assert/strict';
import {linkClinicalRecords,enrichRegistry} from '../lib/patient-link.mjs';
import {syncStatus,sortHistory} from '../lib/telehealth-status.mjs';
const id='11111111-1111-4111-8111-111111111111';
const sheet={id:'sheet:row',patient_code:'BL001',full_name:'synthetic',address:'location',latitude:18,longitude:98,visited_at:'2026-01-01T00:00:00Z',read_only:true};
const visit={id,patient_code:'BL001',full_name:'different',latitude:0,longitude:0,bp_sys:154,visited_at:'2026-02-01T00:00:00Z',target_group:'ผู้ป่วยติดเตียง',sensor_logs:[{bp_sys:154}]};
test('exact unique code links clinical fields without replacing registry identity or enabling writes',()=>{
 const result=linkClinicalRecords([sheet],[visit]);const p=result.data[0];assert.equal(result.linkage.linked,1);assert.equal(p.id,sheet.id);assert.equal(p.full_name,'synthetic');assert.equal(p.latitude,18);assert.equal(p.bp_sys,154);assert.equal(p.spo2,null);assert.equal(p.clinical_record_id,id);assert.equal(p.read_only,true);assert.equal(p.registry_recorded_at,sheet.visited_at);
});
test('same name never authorizes linkage and duplicate codes remain ambiguous',()=>{
 let result=linkClinicalRecords([{...sheet,patient_code:null}],[visit]);assert.equal(result.linkage.linked,0);assert.equal(result.data[0].bp_sys,undefined);
 result=linkClinicalRecords([sheet],[visit,{...visit,id:'22222222-2222-4222-8222-222222222222'}]);assert.equal(result.linkage.ambiguous,1);assert.equal(result.data[0].bp_sys,undefined);
 result=linkClinicalRecords([sheet,{...sheet,id:'second'}],[visit]);assert.equal(result.linkage.ambiguous,2);
});
test('missing codes skip database; failed linkage retains registry with an explicit unavailable status',async()=>{
 const result=await enrichRegistry([{...sheet,patient_code:null}],{read:()=>assert.fail()});assert.equal(result.linkage.status,'missing_codes');
 const unavailable=await enrichRegistry([sheet],{read:async()=>{throw Error('sensitive upstream error');}});assert.equal(unavailable.linkage.status,'unavailable');assert.equal(unavailable.data[0].bp_sys,undefined);assert.doesNotMatch(JSON.stringify(unavailable),/sensitive upstream/);
});
test('lookup encodes filter values and retains server village scope',async()=>{
 let url;await enrichRegistry([{...sheet,patient_code:'BL"),id.gt.0'}],{scope:'&village_moo=in.(1,2)',read:async path=>{url=path;return [];}});
 const query=new URL('https://example.invalid'+url).searchParams;assert.equal(query.get('village_moo'),'in.(1,2)');assert.equal(query.get('patient_code'),'in.("BL\\"),id.gt.0")');assert.equal(query.get('id'),null);
});
test('bounded lookup never silently uses truncated clinical results',async()=>{
 const result=await enrichRegistry([sheet],{read:async()=>Array.from({length:501},()=>visit)});assert.equal(result.linkage.status,'unavailable');assert.equal(result.linkage.linked,0);
});
test('history is ordered newest first and invalid dates remain after dated results',()=>{
 const result=sortHistory([{id:'old',visited_at:'2026-01-01'},{id:'unknown'},{id:'new',visited_at:'2026-02-01'}]);assert.deepEqual(result.map(r=>r.id),['new','old','unknown']);
});
test('status distinguishes failed reads, unknown measurements and missing identity codes',()=>{
 assert.match(syncStatus({phase:'unauthorized'}),/เข้าสู่ระบบ/);
 const text=syncStatus({phase:'stale',source:'google_sheets',syncedAt:'2026-01-01',total:10,visible:2,unknown:7,unclassified:3,linkage:{status:'missing_codes'}});assert.match(text,/ข้อมูลเดิม/);assert.match(text,/ไม่มีรหัสผู้รับบริการ/);assert.match(text,/กำลังแสดง 2/);assert.match(text,/ประเมิน 7/);
});
