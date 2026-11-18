-- Immutable customer-approved snapshots, isolated by owner; execution stays independent.
begin;
create table if not exists public.elite_contract_plan_versions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 work_id uuid not null,
 revision integer not null check(revision>0),
 execution_revision integer not null,
 title text not null check(length(btrim(title)) between 1 and 160),
 approved_date date not null,
 approval_reason text not null check(length(btrim(approval_reason)) between 1 and 2000),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 created_at timestamptz not null default now(),
 foreign key(work_id,user_id) references public.elite_works(id,user_id) on delete cascade,
 unique(work_id,revision)
);
alter table public.elite_contract_plan_versions enable row level security;
create policy elite_contract_plan_owner on public.elite_contract_plan_versions for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.elite_contract_plan_versions from public,anon,authenticated;
grant select on public.elite_contract_plan_versions to authenticated;
create function elite_private.contract_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 -- Explicit deletion of the owning work may purge its dependent records; individual revisions remain immutable.
 if tg_op='DELETE' and not exists(select 1 from public.elite_works where id=old.work_id and user_id=old.user_id) then return old;end if;
 raise exception 'Las revisiones aprobadas son inmutables; crea una nueva revisión';
end $$;
revoke all on function elite_private.contract_immutable() from public,anon,authenticated;
create trigger elite_contract_immutable before update or delete on public.elite_contract_plan_versions for each row execute function elite_private.contract_immutable();
create function public.elite_approve_contract_plan(target_work uuid,expected_plan_revision integer,expected_contract_revision integer,plan_title text,approval_date date,approval_reason text,plan_items jsonb) returns public.elite_contract_plan_versions language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();plan public.elite_work_plans;result public.elite_contract_plan_versions;last_rev integer;item jsonb;source jsonb;ids jsonb;used_ids text[]:='{}';activity_id text;normalized jsonb:='[]';
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into plan from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if not found or expected_plan_revision is distinct from plan.revision then raise exception 'La planificación cambió. Actualiza antes de aprobar.';end if;
 select coalesce(max(revision),0) into last_rev from public.elite_contract_plan_versions where work_id=target_work;
 if expected_contract_revision is distinct from last_rev then raise exception 'La revisión contractual cambió. Actualiza antes de aprobar.';end if;
 if length(btrim(plan_title)) not between 1 and 160 or length(btrim(approval_reason)) not between 1 and 2000 or approval_date is null or approval_date>(now() at time zone 'Europe/Madrid')::date then raise exception 'Completa título, fecha y motivo de aprobación';end if;
 if jsonb_typeof(plan_items) is distinct from 'array' or jsonb_array_length(plan_items) not between 1 and 100 or octet_length(plan_items::text)>250000 then raise exception 'Plan contractual no válido';end if;
 for item in select value from jsonb_array_elements(plan_items) loop
  if jsonb_typeof(item->'activity_ids') is distinct from 'array' or jsonb_array_length(item->'activity_ids')<>1 then raise exception 'Selecciona una fase o hito por elemento';end if;
  activity_id:=item->'activity_ids'->>0;
  select value into source from jsonb_array_elements(plan.phases) where value->>'id'=activity_id;
  if source is null then raise exception 'Actividad no encontrada';end if;
  if (item->>'name',item->>'start',item->>'end') is distinct from (source->>'name',source->>'start',source->>'end') then raise exception 'Los datos contractuales deben coincidir con la revisión presentada';end if;
  with recursive nested(row_data) as (
   select source union all select child from nested n cross join lateral jsonb_array_elements(plan.phases) child where child->>'parent_id'=n.row_data->>'id'
  ) select jsonb_agg(row_data->>'id' order by row_data->>'id') into ids from nested where not exists(select 1 from jsonb_array_elements(plan.phases) child where child->>'parent_id'=row_data->>'id');
  if exists(select 1 from jsonb_array_elements_text(ids) leaf where leaf=any(used_ids)) then raise exception 'Selecciona fases o hitos sin actividades solapadas';end if;
  used_ids:=used_ids||array(select jsonb_array_elements_text(ids));
  normalized:=normalized||jsonb_build_array(jsonb_build_object('name',source->>'name','start',source->>'start','end',source->>'end','milestone',coalesce((source->>'milestone')::boolean,false),'source_activity_id',activity_id,'activity_ids',ids));
 end loop;
 insert into public.elite_contract_plan_versions(user_id,work_id,revision,execution_revision,title,approved_date,approval_reason,items) values(uid,target_work,last_rev+1,plan.revision,btrim(plan_title),approval_date,btrim(approval_reason),normalized) returning * into result;
 insert into public.elite_history(user_id,entity_id,entity_type,action,title,fields) values(uid,target_work,'elite_work_plans','Revisión contractual aprobada',plan_title,jsonb_build_array('contract_revision',last_rev+1));
 return result;
end $$;
revoke all on function public.elite_approve_contract_plan(uuid,integer,integer,text,date,text,jsonb) from public,anon;
grant execute on function public.elite_approve_contract_plan(uuid,integer,integer,text,date,text,jsonb) to authenticated;
commit;
