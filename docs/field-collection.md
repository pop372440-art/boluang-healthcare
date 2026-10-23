# Field collection navigation

The Healthcare sidebar contains “เก็บข้อมูลภาคสนาม” below village statistics. It opens the separate municipal Apps Script capture application in a new tab with noopener/noreferrer, without forwarding dashboard tokens, patient records or credentials.

The link starts hidden. The authenticated server session returns canCollectFieldData only for an email-confirmed account with trusted app_metadata.field_collector=true and at least one numeric field_villages entry from 1 through 13. Healthcare admin status, user_metadata and the retired healthcare_field_collector flag do not grant capture permission. The link is hidden again on session denial.

This navigation does not grant Healthcare access to field-only accounts or create a shared login. Existing Healthcare login and village scopes remain required to use the dashboard. Officers without dashboard access should use the capture app directly. The Apps Script app independently authenticates officers and enforces assigned villages on every save. Its URL is a navigation destination, not a secret or access control.

The read-only Google Sheets bridge and its configuration remain separate. Legacy /api/photo-app and field-only dashboard login stay retired. No staff permissions, data or Google sharing settings are modified by this navigation change.
