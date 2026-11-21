-- Client dates are independently editable; approved versions remain immutable.
begin;
create or replace function elite_private.contract_items(phases jsonb,plan_items jsonb) returns jsonb language plpgsql set search_path='' as $$
declare item jsonb;source jsonb;ids jsonb;used_ids text[]:='{}';activity_id text;normalized jsonb:='[]';
begin
 if jsonb_typeof(plan_items) is distinct from 'array' or jsonb_array_length(plan_items) not between 1 and 100 or octet_length(plan_items::text)>250000 then raise exception 'Plan contractual no válido';end if;
 for item in select value from jsonb_array_elements(plan_items) loop
  if jsonb_typeof(item->'activity_ids') is distinct from 'array' or jsonb_array_length(item->'activity_ids')<>1 then raise exception 'Selecciona una fase o hito por elemento';end if;
  activity_id:=item->'activity_ids'->>0;
  select value into source from jsonb_array_elements(phases) where value->>'id'=activity_id;
  if source is null then raise exception 'Actividad no encontrada';end if;
  if item->>'name' is distinct from source->>'name' then raise exception 'El nombre de la actividad cambió. Actualiza la propuesta.';end if;
  if coalesce(item->>'start','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'end','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Indica inicio y fin del cliente';end if;
  if (item->>'start')::date::text<>item->>'start' or (item->>'end')::date::text<>item->>'end' or (item->>'end')::date<(item->>'start')::date or (item->>'end')::date-(item->>'start')::date>3660 then raise exception 'Fechas del cliente no válidas';end if;
  if coalesce((source->>'milestone')::boolean,false) and item->>'start'<>item->>'end' then raise exception 'Un hito tiene una sola fecha';end if;
  with recursive nested(row_data) as (
   select source union all select child from nested n cross join lateral jsonb_array_elements(phases) child where child->>'parent_id'=n.row_data->>'id'
  ) select jsonb_agg(row_data->>'id' order by row_data->>'id') into ids from nested where not exists(select 1 from jsonb_array_elements(phases) child where child->>'parent_id'=row_data->>'id');
  if exists(select 1 from jsonb_array_elements_text(ids) leaf where leaf=any(used_ids)) then raise exception 'Selecciona fases o hitos sin actividades solapadas';end if;
  used_ids:=used_ids||array(select jsonb_array_elements_text(ids));
  normalized:=normalized||jsonb_build_array(jsonb_build_object('name',source->>'name','start',item->>'start','end',item->>'end','milestone',coalesce((source->>'milestone')::boolean,false),'source_activity_id',activity_id,'activity_ids',ids));
 end loop;
 return normalized;
end $$;
revoke all on function elite_private.contract_items(jsonb,jsonb) from public,anon,authenticated;
create or replace function public.elite_approve_contract_plan(target_work uuid,expected_plan_revision integer,expected_contract_revision integer,plan_title text,approval_date date,approval_reason text,plan_items jsonb) returns public.elite_contract_plan_versions language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();plan public.elite_work_plans;result public.elite_contract_plan_versions;last_rev integer;item jsonb;source jsonb;ids jsonb;used_ids text[]:='{}';activity_id text;normalized jsonb:='[]';
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into plan from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if not found or expected_plan_revision is distinct from plan.revision then raise exception 'La planificación cambió. Actualiza antes de aprobar.';end if;
 select coalesce(max(revision),0) into last_rev from public.elite_contract_plan_versions where work_id=target_work;
 if expected_contract_revision is distinct from last_rev then raise exception 'La revisión contractual cambió. Actualiza antes de aprobar.';end if;
 if plan_title is null or approval_reason is null or length(btrim(plan_title)) not between 1 and 160 or length(btrim(approval_reason)) not between 1 and 2000 or approval_date is null or approval_date>(now() at time zone 'Europe/Madrid')::date then raise exception 'Completa título, fecha y motivo de aprobación';end if;
 if jsonb_typeof(plan_items) is distinct from 'array' or jsonb_array_length(plan_items) not between 1 and 100 or octet_length(plan_items::text)>250000 then raise exception 'Plan contractual no válido';end if;
 normalized:=elite_private.contract_items(plan.phases,plan_items);
 insert into public.elite_contract_plan_versions(user_id,work_id,revision,execution_revision,title,approved_date,approval_reason,items) values(uid,target_work,last_rev+1,plan.revision,btrim(plan_title),approval_date,btrim(approval_reason),normalized) returning * into result;
 insert into public.elite_history(user_id,entity_id,entity_type,action,title,fields) values(uid,target_work,'elite_work_plans','Revisión contractual aprobada',plan_title,jsonb_build_array('contract_revision',last_rev+1));
 return result;
end $$;
revoke all on function public.elite_approve_contract_plan(uuid,integer,integer,text,date,text,jsonb) from public,anon;
grant execute on function public.elite_approve_contract_plan(uuid,integer,integer,text,date,text,jsonb) to authenticated;

create table if not exists public.elite_contract_plan_drafts (
 work_id uuid primary key,
 user_id uuid not null default auth.uid() references auth.users(id),
 revision integer not null check(revision>0),
 execution_revision integer not null,
 title text not null check(length(btrim(title)) between 1 and 160),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 updated_at timestamptz not null default now(),
 foreign key(work_id,user_id) references public.elite_works(id,user_id) on delete cascade
);
alter table public.elite_contract_plan_drafts enable row level security;
create policy contract_drafts_owner on public.elite_contract_plan_drafts for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.elite_contract_plan_drafts from public,anon,authenticated;
grant select on public.elite_contract_plan_drafts to authenticated;
create or replace function public.elite_save_contract_draft(target_work uuid,expected_plan_revision integer,expected_draft_revision integer,plan_title text,plan_items jsonb) returns public.elite_contract_plan_drafts language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();plan public.elite_work_plans;draft public.elite_contract_plan_drafts;normalized jsonb;
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into plan from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if not found or plan.revision is distinct from expected_plan_revision then raise exception 'La planificación cambió. Actualiza antes de guardar.';end if;
 select * into draft from public.elite_contract_plan_drafts where work_id=target_work and user_id=uid for update;
 if coalesce(draft.revision,0) is distinct from expected_draft_revision then raise exception 'La propuesta cambió. Actualiza antes de guardar.';end if;
 if plan_title is null or length(btrim(plan_title)) not between 1 and 160 then raise exception 'Indica un título';end if;
 normalized:=elite_private.contract_items(plan.phases,plan_items);
 select jsonb_agg(jsonb_build_object('name',v->>'name','start',v->>'start','end',v->>'end','activity_ids',jsonb_build_array(v->>'source_activity_id'),'milestone',v->'milestone')) into normalized from jsonb_array_elements(normalized) v;
 insert into public.elite_contract_plan_drafts(work_id,user_id,revision,execution_revision,title,items) values(target_work,uid,coalesce(draft.revision,0)+1,plan.revision,btrim(plan_title),normalized)
 on conflict(work_id) do update set revision=excluded.revision,execution_revision=excluded.execution_revision,title=excluded.title,items=excluded.items,updated_at=now() returning * into draft;
 return draft;
end $$;
revoke all on function public.elite_save_contract_draft(uuid,integer,integer,text,jsonb) from public,anon;
grant execute on function public.elite_save_contract_draft(uuid,integer,integer,text,jsonb) to authenticated;
commit;
