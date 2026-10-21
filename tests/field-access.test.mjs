import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import photo from '../api/photo-app.js';import session from '../api/session.js';import {scopeFor} from '../lib/server.mjs';import {mountLogin} from '../login.mjs';
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
test('healthcare no longer advertises or grants capture permissions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),login=readFileSync(new URL('../login.html',import.meta.url),'utf8'),app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/openPhotoAppBtn/);assert.doesNotMatch(login,/mode=field/);assert.doesNotMatch(app,/openPhotoAppBtn|\/api\/photo-app|canCollectFieldData/);
 const scope=scopeFor({app_metadata:{healthcare_role:'admin',healthcare_field_collector:true}});assert.equal(scope.canCollectFieldData,undefined);
});
