-- V1 economic entries. Additive, client-owned; NO document bytes or customer files.
begin;
create table if not exists public.elite_work_economic_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 work_id uuid not null,
 activity_id text,
 kind text not null check(kind in ('budget','actual','contract','certified')),
 amount numeric(14,2) not null check(amount>=0 and amount<=10000000000),
 entry_date date not null default (now() at time zone 'Europe/Madrid')::date,
 source_name text not null check(length(source_name) between 1 and 160),
 source_line text not null check(length(source_line) between 1 and 160),
 created_at timestamptz not null default now(),
 unique(work_id,kind,source_name,source_line),
 foreign key(work_id,user_id) references public.elite_works(id,user_id) on delete cascade,
 check((kind in ('budget','actual') and length(coalesce(activity_id,'')) between 1 and 80)
   or (kind in ('contract','certified') and activity_id is null))
);
create index if not exists elite_work_economic_entries_owner_work on public.elite_work_economic_entries(user_id,work_id,entry_date);
alter table public.elite_work_economic_entries enable row level security;
revoke all on public.elite_work_economic_entries from public,anon,authenticated;
grant select,insert,update on public.elite_work_economic_entries to authenticated;
grant all on public.elite_work_economic_entries to service_role;
drop policy if exists elite_work_economic_owner on public.elite_work_economic_entries;
create policy elite_work_economic_owner on public.elite_work_economic_entries for all to authenticated
 using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
-- Do not allow a cost entry for a Gantt activity belonging to a different work.
create or replace function elite_private.economic_activity_guard() returns trigger language plpgsql
 set search_path='' as $$
begin
 if new.kind in ('budget','actual') and not exists(
  select 1 from public.elite_work_plans p,
    jsonb_array_elements(p.phases) a
  where p.work_id=new.work_id and p.user_id=new.user_id
    and a->>'id'=new.activity_id
    and coalesce((a->>'is_group')::boolean,false)=false
    and not exists(select 1 from jsonb_array_elements(p.phases) ch where ch->>'parent_id'=new.activity_id)
 ) then raise exception 'La partida económica no pertenece al Gantt de esta obra';end if;
 return new;
end $$;
revoke all on function elite_private.economic_activity_guard() from public,anon,authenticated;
drop trigger if exists elite_work_economic_activity_guard on public.elite_work_economic_entries;
create trigger elite_work_economic_activity_guard before insert or update on public.elite_work_economic_entries
 for each row execute function elite_private.economic_activity_guard();
commit;
