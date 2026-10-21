import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
test('all non-script HTML and CSS are byte-identical to commit 138ca6b',()=>{
 const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 assert.equal(createHash('sha256').update(staticHtml).digest('hex'),'6e2fee19a0aa457a0ff342fd5c260b6eac7bcfa389883cef74101fc1cb19d47b');
});
test('restored controls remain bound to existing baseline element ids',()=>{
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 const used=[...app.matchAll(/getElementById\('([^']+)'\)/g)].map(m=>m[1]);
 const dynamicIds=['adminLogoutBtn','adminPatientLocation'];
 for(const id of dynamicIds)assert.ok(app.includes(".id='"+id+"'"),`Dynamic control not created: ${id}`);
 for(const id of used)assert.ok(ids.has(id)||dynamicIds.includes(id)||id==='quickPushSupabaseBtn',`Missing original control: ${id}`);
});
test('original four visual dependencies and styles remain in place',()=>{for(const name of ['tailwindcss.com/3.4.17','leaflet@1.9.4','chart.js@4.4.1','<style>'])assert.ok(html.includes(name));assert.ok(!html.includes('/style.css'));});
