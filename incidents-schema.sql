-- Independent incidents. Keep the original daily-report JSON as historical evidence.
begin;
create unique index if not exists elite_daily_reports_identity_work_owner on public.elite_daily_reports(id,work_id,user_id);
create table if not exists public.elite_incidents(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 work_id uuid not null,
 report_id uuid,
 incident_date date not null check(incident_date between '2000-01-01' and '2100-12-31'),
 severity text not null default 'warning' check(severity in ('info','warning','critical')),
 status text not null default 'open' check(status in ('open','doing','resolved')),
 description text not null check(length(btrim(description)) between 1 and 10000),
 followup text not null default '' check(length(followup)<=10000),
 legacy_index integer check(legacy_index>0),
 legacy_payload jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(report_id,legacy_index),
 foreign key(work_id,user_id) references public.elite_works(id,user_id) on delete cascade,
 foreign key(report_id,work_id,user_id) references public.elite_daily_reports(id,work_id,user_id) on delete set null (report_id)
);
create index if not exists elite_incidents_owner_work_date on public.elite_incidents(user_id,work_id,incident_date desc,id);
alter table public.elite_incidents enable row level security;
revoke all on public.elite_incidents from public,anon,authenticated;
grant select,insert,update on public.elite_incidents to authenticated;
grant all on public.elite_incidents to service_role;
drop policy if exists elite_incidents_owner on public.elite_incidents;
create policy elite_incidents_owner on public.elite_incidents for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
-- Idempotent copy only: old report records, dates, costs and incident arrays stay untouched.
insert into public.elite_incidents(user_id,work_id,report_id,incident_date,severity,status,description,legacy_index,legacy_payload,created_at,updated_at)
select r.user_id,r.work_id,r.id,r.report_date,e.value->>'severity',e.value->>'state',e.value->>'name',e.n::integer,e.value,r.created_at,r.updated_at
from public.elite_daily_reports r cross join lateral jsonb_array_elements(r.incidents) with ordinality e(value,n)
on conflict(report_id,legacy_index) do nothing;
drop trigger if exists elite_incidents_guard on public.elite_incidents;
create trigger elite_incidents_guard before insert or update on public.elite_incidents for each row execute function elite_private.native_guard();
drop trigger if exists elite_incidents_history on public.elite_incidents;
create trigger elite_incidents_history after insert or update on public.elite_incidents for each row execute function elite_private.native_history();
commit;
