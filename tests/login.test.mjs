import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLogin,sessionRequest} from '../login.mjs';
import session from '../api/session.js';
function dom(){const nodes={};return {getElementById(id){return nodes[id]??= {hidden:id==='adminActions',value:'',dataset:{},disabled:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},focus(){},click(){return this.listeners.click?.();}};}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(d){this.body=d;return this;}};}
const req=body=>({method:'POST',body,headers:{origin:'https://health.example',host:'health.example'}});
test('admin-only login rejects clinical accounts before setting a session cookie',async()=>{
 process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_ANON_KEY='synthetic';
 global.fetch=async()=>({ok:true,status:200,json:async()=>({access_token:'synthetic',user:{app_metadata:{healthcare_role:'clinician',healthcare_villages:[1]}}})});
 const res=response();await session(req({email:'test@example.invalid',password:'synthetic',adminOnly:true}),res);assert.equal(res.code,403);assert.equal(res.headers['Set-Cookie'],undefined);
});
test('admin login creates secure cookie without returning the token',async()=>{
 global.fetch=async()=>({ok:true,status:200,json:async()=>({access_token:'synthetic',user:{app_metadata:{healthcare_role:'admin'}}})});
 const res=response();await session(req({email:'test@example.invalid',password:'synthetic',adminOnly:true}),res);assert.equal(res.code,200);assert.equal(res.body.role,'admin');assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.equal(res.body.access_token,undefined);
});
test('login requests are same-origin and handle non-JSON failures',async()=>{
 await assert.rejects(sessionRequest('GET',undefined,async(url,opts)=>{assert.equal(url,'/api/session');assert.equal(opts.credentials,'same-origin');assert.equal(opts.cache,'no-store');return {json:async()=>{throw Error();}};}),/ไม่พร้อมใช้งาน/);
});
test('login, explicit patient-load button and logout use session only without fetching records on login page',async()=>{
 const doc=dom(),calls=[],destinations=[];let authenticated=false;
 global.fetch=async(url,options)=>{calls.push({url,options});let status=200,data;
  if(options.method==='POST'){assert.equal(JSON.parse(options.body).adminOnly,undefined);authenticated=true;data={role:'admin'};}
  else if(options.method==='DELETE'){authenticated=false;data={ok:true};}
  else if(authenticated)data={role:'admin'};else{status=401;data={error:'กรุณาเข้าสู่ระบบ'};}
  return {ok:status===200,status,json:async()=>data};};
 await mountLogin(doc,{assign:path=>destinations.push(path)});assert.equal(doc.getElementById('adminActions').hidden,true);
 doc.getElementById('email').value=' test@example.invalid ';doc.getElementById('password').value='synthetic';
 doc.getElementById('loginForm').listeners.submit({preventDefault(){}});await tick();
 assert.equal(doc.getElementById('password').value,'');assert.equal(doc.getElementById('adminActions').hidden,false);assert.deepEqual(destinations,[]);
 doc.getElementById('loadPatients').click();await tick();assert.deepEqual(destinations,['/']);
 doc.getElementById('signOut').click();await tick();assert.equal(doc.getElementById('adminActions').hidden,true);assert.equal(doc.getElementById('loginForm').hidden,false);
 assert.ok(calls.every(c=>c.url==='/api/session'));
});
test('expired session blocks patient-load navigation',async()=>{
 const doc=dom(),destinations=[];let valid=true;
 global.fetch=async()=>({ok:valid,status:valid?200:401,json:async()=>valid?{role:'admin'}:{error:'กรุณาเข้าสู่ระบบ'}});
 await mountLogin(doc,{assign:path=>destinations.push(path)});valid=false;doc.getElementById('loadPatients').click();await tick();assert.deepEqual(destinations,[]);assert.match(doc.getElementById('message').textContent,/เข้าสู่ระบบ/);
});
