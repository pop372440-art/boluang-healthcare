# Google Sheets → Vercel connection

## Source verified in Drive

Spreadsheet `1sMbr_fqnYrvr-8qZFTbBcAJsu_EGLEtFAvUTc4Tx6fw`, tab `ผู้มีสุขภาวะพึ่งพิง`, timezone `Asia/Bangkok`. Required headers: วันเวลา, ชื่อ-สกุล, ที่อยู่, ละติจูด, ลองจิจูด, ลิงก์รูปภาพ. Header order may change. Other tabs are not read.

The default GET /api/patients source is now google_sheets. The old implementation accidentally read Supabase only. Source selection is explicit, and failures never silently fall back to old data or report a successful sync. HEALTHCARE_SOURCE=supabase keeps an intentional database-only deployment available.

## Preferred path for the existing Apps Script setup

1. Create a **separate** bound or standalone Apps Script bridge project using google_apps_script.gs from this repository. Do not replace the existing photo-app doGet or its HTML: this bridge returns JSON only and must have its own URL.
2. In that project's Script Properties set BRIDGE_TOKEN to a newly generated strong secret. Optional SPREADSHEET_ID/SHEET_NAME override the verified defaults above. Do not store the secret in spreadsheet cells, GitHub, a URL or chat.
3. Deploy a versioned Web App as the account that can read this spreadsheet. A Vercel server must be able to reach the URL without an interactive Google login; access to **data** is then enforced by the BRIDGE_TOKEN on every POST. GET returns no patient data. If organization policy forbids that endpoint configuration, use the service-account path below instead. Do not broaden Drive file sharing to Anyone with the link.
4. Set the following in the intended Vercel environment, then redeploy:

| Variable | Value |
|---|---|
| HEALTHCARE_SOURCE | google_sheets |
| GOOGLE_SHEETS_PROVIDER | apps_script |
| GOOGLE_SHEETS_BRIDGE_URL | New bridge's /macros/s/.../exec URL |
| GOOGLE_SHEETS_BRIDGE_TOKEN | Same secret as BRIDGE_TOKEN, stored as a server secret |
| GOOGLE_SHEETS_ID | Verified spreadsheet ID above; optional because it is the default |
| GOOGLE_SHEETS_TAB | ผู้มีสุขภาวะพึ่งพิง; optional because it is the default |

APPS_SCRIPT_URL remains reserved for the existing photo application. Do not overwrite it with the bridge URL. No Supabase service-role key is required by this read bridge. Apps Script deployments do not update merely because GitHub code changes; deploy a new version explicitly.

## Alternative: Google Sheets API directly from the server

Set GOOGLE_SHEETS_PROVIDER=service_account and GOOGLE_SERVICE_ACCOUNT_JSON as a protected Vercel server-side secret containing the Google service account credentials. Enable Sheets API and grant only Reader access to this exact spreadsheet to the intended service-account email. No domain-wide delegation is used. Do not send private keys through chat or commit them. The server requests only spreadsheets.readonly scope, signs an RS256 JWT for Google's token endpoint, reads metadata for the exact tab, then reads a bounded values range with native serial dates. Timezone and source identity are validated. No public CSV export or browser CORS workaround is used.

The runtime currently accepts up to 10,000 grid rows and the first 26 columns; larger sources fail explicitly instead of silently truncating records.

## Data and authorization contract

- The connected Google Drive account in ChatGPT is not automatically a Google credential available to Vercel. Installing Drive here does not configure the deployed backend.
- An authorized healthcare session is still required for /api/patients. Viewer/clinician responses are limited to assigned villages; records without a resolved village are visible only to admins. No anonymous health-data endpoint is introduced.
- The six-column sheet has no clinical readings. Such fields stay null, screening is UNKNOWN, and no fake age or six-packet history is created. Missing coordinates and dates remain missing.
- Sheet IDs use a source row locator for display, **not** a stable clinical patient identifier. Row reordering does not authorize clinical writes. Unlinked sheet rows are read-only and excluded from the original checkup selector.
- Optional clinical headers are supported only when actually present: SYS, DIA, ชีพจร, SpO2, PI, น้ำตาล, อุณหภูมิ, น้ำหนัก, ส่วนสูง. Optional classification headers: กลุ่มเป้าหมาย, หน่วยบริการ. Their absence never defaults a person to bedridden.
- Optional รหัสผู้รับบริการ is checked for duplicates, but automatic linking/upsert by name remains prohibited. No spreadsheet cells or existing Supabase measurements are modified by this connection work.
- Dates from Sheets API are serial numbers interpreted in the verified Asia/Bangkok timezone; native Apps Script Date cells are ISO timestamps. Ambiguous text dates remain missing instead of guessing day/month order. Format source date cells as real dates to avoid ambiguity.
- Requests have timeouts, upstream HTTP and schema checks, private no-store responses and no patient-data cache shared across users. OAuth token cache contains credentials only, not records. /api/config reports configuration flags without secret values; /api/health probes the selected source after authorization.

## Deployment acceptance

After server secrets and the bridge are configured, sign in through the approved healthcare authentication flow. Confirm the existing sync button reports Google Sheets, source rows render on the existing map/table, unknown group values are not hidden by the old default-bedridden filter, and an unauthorized account cannot retrieve them. Check /api/health using the authorized session. Test clinical writes separately against verified database-linked records; this connection introduces no writes to the sheet.

Automated tests cover both transport paths, signed readonly JWT, exact source identity, header mapping, dates, missing readings, bridge authentication and village-scope filtering. Deployment and Google credentials still require live verification; tests with synthetic credentials are not proof of production connectivity.
