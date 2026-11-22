-- TU CONTROLAS: prevent cross-tenant relational links in operational tables.
-- PREPARED ONLY. Run in a cloned/staging database, with preflight backup and
-- two authenticated test accounts, before considering production.
-- It contains no data migration and never deletes existing rows.
begin;

do $guard$
begin
 if exists(
  select 1 from public.elite_tasks t
  join public.elite_tasks p on p.id=t.previous_task_id
  where t.user_id is distinct from p.user_id
 ) then
  raise exception 'Tenant reference preflight failed: previous task belongs to another user';
 end if;
 if exists(
  select 1 from public.elite_plan_versions v
  join public.elite_works w on w.id=v.work_id
  where v.user_id is distinct from w.user_id
 ) then
  raise exception 'Tenant reference preflight failed: plan revision belongs to another user';
 end if;
end $guard$;

do $constrain$
begin
 if not exists(
  select 1 from pg_constraint
  where conrelid='public.elite_tasks'::regclass
    and conname='elite_tasks_id_user_id_unique'
 ) then
  alter table public.elite_tasks
   add constraint elite_tasks_id_user_id_unique unique(id,user_id);
 end if;
 if not exists(
  select 1 from pg_constraint
  where conrelid='public.elite_tasks'::regclass
    and conname='elite_tasks_previous_owner_fk'
 ) then
  alter table public.elite_tasks
   add constraint elite_tasks_previous_owner_fk
   foreign key(previous_task_id,user_id)
   references public.elite_tasks(id,user_id);
 end if;
 if not exists(
  select 1 from pg_constraint
  where conrelid='public.elite_plan_versions'::regclass
    and conname='elite_plan_versions_work_owner_fk'
 ) then
  alter table public.elite_plan_versions
   add constraint elite_plan_versions_work_owner_fk
   foreign key(work_id,user_id)
   references public.elite_works(id,user_id);
 end if;
end $constrain$;
commit;
