-- Apply once through the database owner after assigning at least one approved
-- healthcare admin in auth.users.raw_app_meta_data. No user is auto-promoted.
begin;
alter table public.patients_visits add column if not exists record_version integer not null default 1;
alter table public.patients_visits enable row level security;
drop policy if exists "Allow public read and upsert" on public.patients_visits;
drop policy if exists "Allow anon read visits" on public.patients_visits;
drop policy if exists "Allow anon insert visits" on public.patients_visits;
drop policy if exists "Allow anon update visits" on public.patients_visits;
revoke all on public.patients_visits from anon;
revoke all on public.patients_visits from authenticated;
grant select on public.patients_visits to authenticated;
grant update (visited_at,bp_sys,bp_dia,pulse,spo2,pi_pct,blood_sugar,temp_c,weight_kg,height_cm,risk_level,sensor_logs,record_version) on public.patients_visits to authenticated;
-- Restrictive policy also constrains any future or overlooked permissive policy.
create policy healthcare_scope_guard on public.patients_visits as restrictive
for all to authenticated using (
  (select auth.uid()) is not null and (
    (select auth.jwt()->'app_metadata'->>'healthcare_role') = 'admin'
    or (
      (select auth.jwt()->'app_metadata'->>'healthcare_role') in ('viewer','clinician')
      and coalesce((select auth.jwt()->'app_metadata'->'healthcare_villages'),'[]'::jsonb) @> jsonb_build_array(village_moo)
    )
  )
) with check (
  (select auth.uid()) is not null and (
    (select auth.jwt()->'app_metadata'->>'healthcare_role') = 'admin'
    or (
      (select auth.jwt()->'app_metadata'->>'healthcare_role') = 'clinician'
      and coalesce((select auth.jwt()->'app_metadata'->'healthcare_villages'),'[]'::jsonb) @> jsonb_build_array(village_moo)
    )
  )
);
create policy healthcare_read on public.patients_visits for select to authenticated using (
 (select auth.jwt()->'app_metadata'->>'healthcare_role') in ('viewer','clinician','admin')
);
create policy healthcare_update on public.patients_visits for update to authenticated using (
 (select auth.jwt()->'app_metadata'->>'healthcare_role') in ('clinician','admin')
) with check (
 (select auth.jwt()->'app_metadata'->>'healthcare_role') in ('clinician','admin')
);
-- Existing history must be preserved even if an authorized user calls REST directly.
create or replace function public.healthcare_preserve_history() returns trigger
language plpgsql security invoker set search_path = '' as $function$
begin
 if auth.uid() is not null then
  if new.record_version <> old.record_version + 1
     or jsonb_typeof(new.sensor_logs) is distinct from 'array'
     or jsonb_array_length(new.sensor_logs) <> jsonb_array_length(coalesce(old.sensor_logs,'[]'::jsonb)) + 1
     or exists (select 1 from generate_series(0,jsonb_array_length(coalesce(old.sensor_logs,'[]'::jsonb))-1) i
                where new.sensor_logs->i is distinct from old.sensor_logs->i)
     or (new.sensor_logs->-1->>'inspector_id') is distinct from auth.uid()::text then
    raise exception 'History must be appended by the current user with the next version';
  end if;
 end if;
 return new;
end;
$function$;
revoke all on function public.healthcare_preserve_history() from public,anon,authenticated;
create trigger healthcare_preserve_history before update on public.patients_visits
for each row execute function public.healthcare_preserve_history();
commit;
