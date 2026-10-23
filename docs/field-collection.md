# Field collection navigation

The Healthcare sidebar contains “เก็บข้อมูลภาคสนาม” below village statistics. It opens the separate municipal Apps Script capture application in a new tab with noopener/noreferrer, without forwarding dashboard tokens, patient records or credentials.

The link starts hidden. The authenticated server session returns canCollectFieldData for an email-confirmed account with trusted app_metadata.healthcare_role=admin, or field_collector=true and at least one numeric field_villages entry from 1 through 13. Only trusted app_metadata grants permissions; user_metadata and the retired healthcare_field_collector flag do not. The link is hidden again on session denial.

This navigation does not grant Healthcare access to field-only accounts or create a shared login. Existing Healthcare login and village scopes remain required to use the dashboard. Officers without dashboard access should use the capture app directly. The prepared existing-project source in field-capture-existing/Code.gs authenticates every save: confirmed healthcare admins receive villages 1–13, while field staff retain assigned villages. This source must be saved and deployed in the existing Google project separately from GitHub/Vercel. Until that deployment, the previous field_collector requirement remains active. Its URL is a navigation destination, not a secret or access control.

The read-only Google Sheets bridge and its configuration remain separate. Legacy /api/photo-app and field-only dashboard login stay retired. No staff permissions, data or Google sharing settings are modified by this navigation change.
