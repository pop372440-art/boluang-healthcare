/** Google Sheets private read bridge, schema v1. No writes or clinical defaults.
 * Script Properties: BRIDGE_TOKEN; optionally SPREADSHEET_ID and SHEET_NAME.
 * Vercel: GOOGLE_SHEETS_BRIDGE_URL, GOOGLE_SHEETS_BRIDGE_TOKEN (same secret).
 * Deploy as a separate bridge project; do not replace the existing photo application. Keep Drive sharing private.
 */
function json_(body){return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return json_({error:'authentication_required'});}
function doPost(e){
 try{
  const props=PropertiesService.getScriptProperties();const secret=props.getProperty('BRIDGE_TOKEN');
  const body=JSON.parse(e&&e.postData?e.postData.contents:'{}');
  if(!secret||typeof body.token!=='string'||body.token!==secret)return json_({error:'unauthorized'});
  if(body.action!=='list')return json_({error:'unsupported_action'});
  const id=props.getProperty('SPREADSHEET_ID')||'1sMbr_fqnYrvr-8qZFTbBcAJsu_EGLEtFAvUTc4Tx6fw';
  const tab=props.getProperty('SHEET_NAME')||'ผู้มีสุขภาวะพึ่งพิง';
  // The shared secret never grants access to arbitrary caller-supplied sheets.
  if(body.spreadsheet_id!==id||body.sheet_name!==tab)return json_({error:'source_mismatch'});
  const book=SpreadsheetApp.openById(id);if(book.getSpreadsheetTimeZone()!=='Asia/Bangkok')return json_({error:'timezone_mismatch'});
  const sheet=book.getSheetByName(tab);if(!sheet)return json_({error:'missing_sheet'});
  const last=sheet.getLastRow();if(last>10000)return json_({error:'too_many_rows'});
  if(last<1)return json_({error:'missing_headers'});
  const width=Math.min(sheet.getLastColumn(),26);if(width<6)return json_({error:'missing_headers'});
  const values=sheet.getRange(1,1,last,width).getValues().map(row=>row.map(v=>v instanceof Date?v.toISOString():v));
  return json_({schema_version:1,spreadsheet_id:id,sheet_name:tab,values,read_at:new Date().toISOString()});
 }catch(err){return json_({error:'bridge_failed'});}
}
