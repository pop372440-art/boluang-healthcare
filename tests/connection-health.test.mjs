import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionConfig,checkConnections} from '../lib/connection-health.mjs';
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'secret',GOOGLE_SHEETS_BRIDGE_URL:'https://script.google.com/macros/s/example/exec',GOOGLE_SHEETS_BRIDGE_TOKEN:'private'};
test('invalid source/provider cannot report configured',()=>{
 assert.equal(connectionConfig({...env,GOOGLE_SHEETS_PROVIDER:'typo'}).configured,false);
 assert.equal(connectionConfig({...env,HEALTHCARE_SOURCE:'typo'}).configured,false);
});
test('both sources checked without disclosing records or upstream errors',async()=>{
 let db=false;const result=await checkConnections({env,checkSheet:async()=>{throw Error('private patient');},checkDatabase:async()=>{db=true;return [{id:'secret'}];}});
 assert.equal(db,true);assert.equal(result.status,'degraded');assert.equal(result.checks.googleSheets.status,'unavailable');assert.equal(result.checks.supabase.status,'reachable');assert.doesNotMatch(JSON.stringify(result),/secret|private patient/);
});
test('photo configuration is not proof of reachability',async()=>{
 const result=await checkConnections({env:{...env,APPS_SCRIPT_URL:env.GOOGLE_SHEETS_BRIDGE_URL,APPS_SCRIPT_PRIVATE:'true'},checkSheet:async()=>{},checkDatabase:async()=>{}});
 assert.equal(result.status,'ok');assert.equal(result.checks.photoApp.status,'configured_unverified');
});
test('missing configuration skips upstream probes',async()=>{
 const unexpected=()=>assert.fail('must not execute');const result=await checkConnections({env:{},checkSheet:unexpected,checkDatabase:unexpected});assert.equal(result.checks.googleSheets.status,'not_configured');assert.equal(result.checks.supabase.status,'not_configured');assert.equal(result.status,'degraded');
});
