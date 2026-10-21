# Separate municipal field collection application

Photo/location capture is a separate municipal staff application. Its owner manages the authorized email allowlist in that application. Healthcare dashboard accounts, sessions and app_metadata do not grant access to it.

The Healthcare site no longer contains a capture button or a field-login link. Old `/login?mode=field` bookmarks redirect to the admin login without fetching data. Legacy field-only login requests and `/api/photo-app` return 410 and do not expose the capture URL, set a session, or call the external app.

`APPS_SCRIPT_URL`, `APPS_SCRIPT_PRIVATE`, and `healthcare_field_collector` are no longer used to authorize or launch capture from this site. Existing deployment values and account metadata are not automatically deleted. No external Apps Script project, Google sharing setting, email allowlist or collected record was modified.

Keep the token-protected read-only Sheets bridge and its GOOGLE_SHEETS_BRIDGE_URL / GOOGLE_SHEETS_BRIDGE_TOKEN configuration. Registry reads, clinical-code linkage, patient photos, coordinates, Maps and Street View are independent of the removed capture launcher.

Tests cover absent UI links, retired endpoints, old-bookmark redirects, unchanged admin login and independent Google Sheets access. Deployment of the removal still requires merging the PR.
