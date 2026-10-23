import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import photo from '../api/photo-app.js';import session from '../api/session.js';import {scopeFor,canCollectFieldData} from '../lib/server.mjs';import {mountLogin} from '../login.mjs';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(d){this.body=d;return this;}});
test('retired capture endpoint exposes no URL and makes no upstream calls',async()=>{
 global.fetch=()=>assert.fail('must not request capture app');process.env.APPS_SCRIPT_URL='https://script.google.com/macros/s/PRIVATE/exec';const r=response();await photo({method:'GET'},r);assert.equal(r.code,410);assert.equal(r.body.url,undefined);assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE|script.google.com/);
});
test('retired field login never authenticates or sets a cookie',async()=>{
 global.fetch=()=>assert.fail('must not authenticate field requests');const r=response();await session({method:'POST',body:{fieldOnly:true}},r);assert.equal(r.code,410);assert.equal(r.headers['Set-Cookie'],undefined);
});
test('obsolete field login bookmark redirects to admin login without fetching records',async()=>{
 const destinations=[];global.fetch=()=>assert.fail('must not fetch');await mountLogin({}, {search:'?mode=field',replace:path=>destinations.push(path)});assert.deepEqual(destinations,['/login']);
});
test('healthcare keeps capture separate and only links to the dedicated app',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),login=readFileSync(new URL('../login.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/openPhotoAppBtn/);assert.doesNotMatch(login,/mode=field/);assert.doesNotMatch(app,/openPhotoAppBtn|\/api\/photo-app/);
 const scope=scopeFor({app_metadata:{healthcare_role:'admin',healthcare_field_collector:true}});assert.equal(scope.canCollectFieldData,undefined);
});

test('capture navigation requires confirmed trusted field permission and an assigned village',()=>{
 const user={email_confirmed_at:'2026-10-23',app_metadata:{field_collector:true,field_villages:[1,2]}};
 assert.equal(canCollectFieldData(user),true);
 assert.equal(canCollectFieldData({...user,email_confirmed_at:null}),false);
 assert.equal(canCollectFieldData({email_confirmed_at:'2026-10-23',user_metadata:user.app_metadata,app_metadata:{healthcare_role:'viewer'}}),false);
 assert.equal(canCollectFieldData({...user,app_metadata:{field_collector:true,field_villages:[0,14,'1']}}),false);
});

test('session capability is read from a fresh trusted user response',async()=>{
 process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_ANON_KEY='synthetic';
 let permitted=true;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({email_confirmed_at:'2026-10-23',app_metadata:{healthcare_role:'viewer',healthcare_villages:[1,2],field_collector:permitted,field_villages:[1,2]}})});
 const request={method:'GET',headers:{cookie:'__Host-bl_access=synthetic'}};
 let r=response();await session(request,r);assert.equal(r.body.canCollectFieldData,true);assert.equal(r.body.access_token,undefined);
 permitted=false;r=response();await session(request,r);assert.equal(r.body.canCollectFieldData,false);
});

test('confirmed healthcare admins may collect without additional field flags',()=>{
 assert.equal(canCollectFieldData({email_confirmed_at:'2026-10-23',app_metadata:{healthcare_role:'admin'}}),true);
 assert.equal(canCollectFieldData({email_confirmed_at:null,app_metadata:{healthcare_role:'admin'}}),false);
 assert.equal(canCollectFieldData({email_confirmed_at:'2026-10-23',user_metadata:{healthcare_role:'admin'}}),false);
});
