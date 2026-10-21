import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
test('landing HTML/CSS retains the baseline except removal of the capture button',()=>{
 const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 assert.equal(createHash('sha256').update(staticHtml).digest('hex'),'4fae48b672da71256bdd005876be0b0b347ba90482d8c6458ec9df46496758ab');
});
test('restored controls remain bound to existing baseline element ids',()=>{
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 const used=[...app.matchAll(/getElementById\('([^']+)'\)/g)].map(m=>m[1]);
 const dynamicIds=['adminLogoutBtn','adminPatientLocation','telehealthSyncStatus'];
 for(const id of dynamicIds)assert.ok(app.includes(".id='"+id+"'"),`Dynamic control not created: ${id}`);
 for(const id of used)assert.ok(ids.has(id)||dynamicIds.includes(id)||id==='quickPushSupabaseBtn',`Missing original control: ${id}`);
});
test('original four visual dependencies and styles remain in place',()=>{for(const name of ['tailwindcss.com/3.4.17','leaflet@1.9.4','chart.js@4.4.1','<style>'])assert.ok(html.includes(name));assert.ok(!html.includes('/style.css'));});
