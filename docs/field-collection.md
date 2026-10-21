# Municipal field collection

Photo and location capture is an internal workflow for municipal officers collecting village data, not a public submission form.

- Admins may open/manage the capture workflow. Other existing authorized healthcare accounts require `healthcare_field_collector: true` in server-controlled Supabase `app_metadata` and their assigned villages. A clinician role alone does not grant collection access. User-editable metadata, email text and URL parameters never grant this permission.
- No account is granted or modified by this code change. An authorized administrator must verify municipal staff identity before assigning the permission. Existing viewer/clinician patient access is unchanged; the permission does not grant clinical writes or administrator privileges.
- Staff enter at `/login?mode=field`. The server checks collection permission before setting a session cookie. After login, an explicit button requests `/api/photo-app` and opens the capture app. This login path never downloads patient records.
- The main header labels capture as a staff function and hides it until the session confirms collection permission. The API independently enforces the permission.
- The existing photo app must itself restrict Google access to authorized staff/accounts (or enforce a verified allowlist). Hiding the button or protecting the URL-discovery API does not protect an otherwise public Apps Script deployment.
- `APPS_SCRIPT_URL` remains the existing capture application's `/exec` URL. `APPS_SCRIPT_PRIVATE=true` is an administrator assertion after verifying the app's access restrictions, not a mechanism that changes Google permissions. It is intentionally not enabled automatically. Missing verification returns a staff-specific unavailable message.
- The separate token-protected Sheets JSON bridge is not the capture application. Keep its URL and token configuration separate.

Automated tests verify anonymous and non-staff denial, rejection of user-editable claims, trusted staff permission, private-app readiness, field-only login, and no patient fetch on the staff login page. Deployment access and real Google-account permissions require live verification by the owner.
