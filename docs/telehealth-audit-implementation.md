# Community Telehealth audit implementation

The reference photographs establish the interaction pattern: summary cards, target-group switches, map pins, patient details and dated clinical history. The existing Bo Luang layout, brand, navigation, maps and landing HTML/CSS are retained.

| Area | Implemented behavior |
|---|---|
| Dashboard | Actual authorized records and shared screening model; unknown measurements are not healthy readings. A visible status line shows the source, last successful sync, total/visible counts, missing classification and linkage status. Failed sync explicitly labels retained data as stale. |
| Filters | Bedridden default; rightmost button toggles all groups. Source care units populate the unit filter. Unclassified patients remain unclassified and appear with Show all. |
| Maps | Actual valid source coordinates; admin detail links for Maps, directions and Street View. Google coverage and private image access are not assumed. |
| Identity | Optional Sheets column รหัสผู้รับบริการ matches Supabase patient_code exactly after trimming. No joins by name, address, row position or inferred demographics. Duplicate/ambiguous identities are not linked. |
| Ownership | Sheets retains registry ID, name, address, photo and coordinates. Supabase supplies matched clinical measurements/history. Group/care unit from Sheets wins when present; database supplies it only when absent. |
| Authorization | Existing server-verified session and village scope apply before linkage. The database query uses the same user's token and village filter. No service-role key or public patient endpoint is introduced. |
| History | Actual rows sorted newest first. Empty history is explicit; missing cells show dashes. Incomplete screening uses a neutral banner. |
| Admin | Existing login, visible logout, default full display and masking controls remain. Login itself does not download patient records. |
| Diagnostics | Public config exposes safe configuration flags only, explicitly not live verification. Authenticated health checks Sheets and database independently; the external capture application is excluded because it is managed separately with its own email permissions. |

## Limits and live acceptance

1. Six-column source Sheets do not contain patient codes or clinical readings by default. An authorized custodian must assign/review real unique codes and store the same code in `patients_visits.patient_code`. This code change does not assign identities, alter spreadsheet cells or merge clinical records.
2. Linkage is read-only. The sheet locator remains the UI record ID. A match does not enable clinical writes or bypass optimistic concurrency; the separately prepared database migration and approved write workflow remain necessary for database-linked writes.
3. Up to 1,000 distinct codes are looked up in batches of 100. An exact server count is required and checked against returned rows, so server-side truncation cannot silently create an apparently unique match. A batch exceeding 500 database results is rejected rather than silently truncated. Errors discard all partially retrieved linkage results and retain the registry with an explicit unavailable status.
4. Before production acceptance, sign in as the actual admin and test a reviewed matching code, unmatched/duplicate codes, a restricted village account, stale data, private images, valid/missing coordinates and logout. No patient records or real credentials were retrieved for this implementation.
5. Hardware ingestion and live video consultation are not configured by these UI changes. They require an identified device/provider API and credentials; no synthetic readings, dummy video rooms or claims of live device integration are added.
6. Playwright browser verification could not run: the Chromium download returned an invalid/truncated archive. Automated logic/API and original presentation-contract checks were run instead. Live visual and authenticated Google-to-browser acceptance remains outstanding.
