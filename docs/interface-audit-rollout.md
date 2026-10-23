# Interface audit implementation — 2026-10-23

This update implements the approved copy, menu, typography and state audit across the existing dashboard. No patient records, accounts, permissions, clinical thresholds, database schema or Apps Script deployments are changed.

- Public users see facility maps, directions, project architecture and clear staff login. No new anonymous patient or aggregate endpoint is introduced. Registry tables, statistics, filters and downloads appear only for a server-approved Healthcare session.
- Existing viewer/clinician/admin accounts may use the Healthcare login with their existing scope. Viewers cannot see write controls; clinicians can write linked records; admin-only menus are separately scoped. Field-only accounts use the dedicated Apps Script link on the login page; no Healthcare role is granted automatically.
- Account email, role and village scope come from the authenticated session response. Admin status continues to grant the existing field collection capability; staff retain their assigned villages. Tokens stay HttpOnly and are never forwarded to capture.
- Anonymous session rejection no longer throws a frontend ReferenceError: the field link function is available to the global API request handler. Login denial, missing permissions, loading, failed fetch, stale data and successful empty filters have distinct messages. Badge colors follow the state. Source evidence and update time are expandable.
- All-groups changes only the group filter; a separate clear-all restores the requested bedridden default. Current village/unit/search/risk/group filters are summarized visibly.
- False URL/key editors and non-operational upload controls are removed from the visible connection views. Admin diagnostics checks Sheets and Supabase independently using the authenticated health API. No key input or localStorage configuration is added.
- Main labels use consistent Thai wording. Menu/body typography is larger, text contrast is stronger and focus states are visible. Mobile controls wrap and tables scroll with sticky name columns.
- Tables show actual date/time values when present; missing data stays explicit. CSV exports apply the existing current filters and masking. Charts describe counts, percentage denominators and unavailable/empty states. Patient details no longer start with demo identities or measurements.
- The public health unit layer has a separate count, legend, fit-all action and zoom-dependent labels. It is independent of record filters and base maps.
- Architecture/coupling documentation is separate from daily workflows, preserves actual readiness limitations and avoids claiming automatic IoMT or realtime synchronization.

Verification: automated permission/state/filter/login tests and existing model, API, Sheets, authorization, capture and map layer tests. Real staff credentials and patient writes are not used for testing. Live public UI and deployment verification are recorded in the implementation session.
