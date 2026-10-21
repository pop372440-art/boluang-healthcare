# Admin login

Open `/login` (or click the existing cloud-status button while signed out). Sign in with the existing Supabase Auth account and its application password; a Google account password is not automatically the application's password. Admin permission is read from server-controlled `app_metadata.healthcare_role`, never from the email address or a browser flag.

After login, click the patient-load button to open the unchanged main page. The existing sync calls `/api/session` and `/api/patients` using the secure HttpOnly cookie and displays source errors if Sheets is unavailable. No patient records are downloaded on the login page. Sign out at `/login`. Expired sessions require another login; refresh tokens and passwords are not stored in the browser.

The admin-only login option is enforced before setting a cookie. Existing authorized clinician/viewer API access and village scopes remain unchanged. No public registration, new password, account role or schema is created by this change.

Verification: automated tests use synthetic accounts and cover admin-only denial, secure cookie, login/logout, explicit navigation and expired sessions. A live account and configured Google bridge are required to confirm production patient loading. Browser rendering verification could not run in this environment because the Playwright browser binary is unavailable.
