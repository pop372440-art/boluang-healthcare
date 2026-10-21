import test from 'node:test';import assert from 'node:assert/strict';
import photo from '../api/photo-app.js';import session from '../api/session.js';import {scopeFor} from '../lib/server.mjs';import {mountLogin} from '../login.mjs';
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_ANON_KEY='synthetic';
const url='https://script.google.com/macros/s/SYNTHETIC/exec';
const staff={app_metadata:{healthcare_role:'viewer',healthcare_villages:[1],healthcare_field_collector:true}};
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(d){this.body=d;return this;}});
const req={method:'GET',headers:{cookie:'__Host-bl_access=synthetic'}};
function userFetch(user){global.fetch=async()=>({ok:true,status:200,json:async()=>user});}
test('clinical role or user-editable metadata alone never grants field collection',async()=>{
 const user={app_metadata:{healthcare_role:'clinician',healthcare_villages:[1]},user_metadata:{healthcare_field_collector:true}};
 assert.equal(scopeFor(user).canCollectFieldData,false);userFetch(user);let r=res();await photo(req,r);assert.equal(r.code,403);assert.equal(r.body.url,undefined);
 r=res();await photo({...req,headers:{}},r);assert.equal(r.code,401);
});
test('authorized municipal staff still need a private configured capture app',async()=>{
 userFetch(staff);delete process.env.APPS_SCRIPT_PRIVATE;process.env.APPS_SCRIPT_URL=url;
 let r=res();await photo(req,r);assert.equal(r.code,503);assert.equal(r.body.url,undefined);
 process.env.APPS_SCRIPT_PRIVATE='true';r=res();await photo(req,r);assert.equal(r.code,200);assert.equal(r.body.url,url);
 process.env.APPS_SCRIPT_URL='https://script.google.com/not-a-deployment';r=res();await photo(req,r);assert.notEqual(r.code,200);
});
test('field-only login checks trusted permission before setting a cookie',async()=>{
 const body={email:'synthetic@example.invalid',password:'synthetic',fieldOnly:true};
 const request={method:'POST',body,headers:{origin:'https://health.example',host:'health.example'}};
 global.fetch=async()=>({ok:true,status:200,json:async()=>({access_token:'synthetic',user:{app_metadata:{healthcare_role:'viewer',healthcare_villages:[1]}}})});
 let r=res();await session(request,r);assert.equal(r.code,403);assert.equal(r.headers['Set-Cookie'],undefined);
 global.fetch=async()=>({ok:true,status:200,json:async()=>({access_token:'synthetic',user:staff})});r=res();await session(request,r);assert.equal(r.code,200);assert.equal(r.body.canCollectFieldData,true);assert.match(r.headers['Set-Cookie'],/HttpOnly/);
});
test('field login opens capture app only after explicit click and never fetches patients',async()=>{
 const nodes={};const doc={getElementById(id){return nodes[id]??={value:'',hidden:false,dataset:{},listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},focus(){}};}};
 const requests=[],destinations=[];
 global.fetch=async(path,options)=>{requests.push(path);return {ok:true,status:200,json:async()=>path==='/api/session'?{role:'viewer',canCollectFieldData:true}:{url}};};
 await mountLogin(doc,{search:'?mode=field',assign:path=>destinations.push(path)});assert.equal(doc.getElementById('adminActions').hidden,false);assert.deepEqual(destinations,[]);
 doc.getElementById('loadPatients').listeners.click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(destinations,[url]);assert.ok(requests.every(p=>['/api/session','/api/photo-app'].includes(p)));
});
