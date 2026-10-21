export function connectionConfig(env=process.env){
 const source=env.HEALTHCARE_SOURCE||'google_sheets',provider=env.GOOGLE_SHEETS_PROVIDER||'apps_script';
 const authenticationConfigured=Boolean(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY);
 const sheetConnectionConfigured=provider==='apps_script'?Boolean(env.GOOGLE_SHEETS_BRIDGE_URL&&env.GOOGLE_SHEETS_BRIDGE_TOKEN):provider==='service_account'?Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON):false;
 return {source,provider,authenticationConfigured,sheetConnectionConfigured,configured:authenticationConfigured&&(source==='supabase'||source==='google_sheets'&&sheetConnectionConfigured)};
}
export async function checkConnections({env=process.env,checkSheet,checkDatabase}){
 const config=connectionConfig(env);
 const probe=async(configured,run)=>{if(!configured)return {status:'not_configured'};try{await run();return {status:'reachable'};}catch{return {status:'unavailable'};}};
 const [googleSheets,supabase]=await Promise.all([probe(config.sheetConnectionConfigured,checkSheet),probe(config.authenticationConfigured,checkDatabase)]);
 const selected=config.source==='google_sheets'?googleSheets:config.source==='supabase'?supabase:{status:'invalid_source'};
 return {status:selected.status==='reachable'&&supabase.status==='reachable'?'ok':'degraded',source:config.source,checks:{googleSheets,supabase},timestamp:new Date().toISOString()};
}
