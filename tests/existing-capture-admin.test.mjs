import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../field-capture-existing/Code.gs',import.meta.url),'utf8');
const auth=source.slice(source.indexOf('function requireCollector_'),source.indexOf('function collectorSignIn'));
function authorize(user){const context=vm.createContext({collectorAuthRequest_:()=>user});vm.runInContext(auth,context);return JSON.parse(JSON.stringify(context.requireCollector_('synthetic')));}
test('existing capture grants verified trusted admin all thirteen villages',()=>{
 const result=authorize({id:'synthetic',email_confirmed_at:'2026-10-23',app_metadata:{healthcare_role:'admin',field_villages:[2]}});
 assert.deepEqual(result.villages,Array.from({length:13},(_,i)=>i+1));
});
test('existing capture retains staff village scope and rejects forged or unconfirmed admin',()=>{
 assert.deepEqual(authorize({id:'synthetic',email_confirmed_at:'2026-10-23',app_metadata:{field_collector:true,field_villages:[3,4]}}).villages,[3,4]);
 assert.throws(()=>authorize({id:'synthetic',email_confirmed_at:'2026-10-23',user_metadata:{healthcare_role:'admin'}}));
 assert.throws(()=>authorize({id:'synthetic',app_metadata:{healthcare_role:'admin'}}));
 assert.throws(()=>authorize({id:'synthetic',email_confirmed_at:'2026-10-23',app_metadata:{field_collector:true,field_villages:[]}}));
});
