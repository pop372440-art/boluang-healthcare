-- Apply db/audit-access.sql first; read-only verification, no patient data output.
begin;
set local role anon;
-- Must be false after migration; no SELECT is permitted to anonymous users.
select has_table_privilege(current_user,'public.patients_visits','select') as anonymous_can_read;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}',true);
-- Must be 0: ordinary signed-in accounts have no healthcare authorization.
select count(*) as unauthorized_visible_rows from public.patients_visits;
reset role;
rollback;
