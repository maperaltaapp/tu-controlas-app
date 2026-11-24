-- TU CONTROLAS V3: restricted restore trigger compatibility (offline, NOT DEPLOYED).
-- Existing functions must match pre-audited versions; fail atomically if changed.
begin;
create table if not exists elite_private.tc_restore_context (
  txid bigint not null, owner_id uuid not null, created_at timestamptz not null default now(),
  primary key(txid,owner_id)
);
revoke all on elite_private.tc_restore_context from public,anon,authenticated;
alter table elite_private.tc_restore_context enable row level security;
create or replace function public.tc_restore_active(expected_owner uuid)
returns boolean language sql stable security definer set search_path='' as $q$
select expected_owner is not null and expected_owner=(select auth.uid()) and exists(
 select 1 from elite_private.tc_restore_context c where c.owner_id=expected_owner and c.txid=pg_catalog.txid_current()
);
$q$;
revoke all on function public.tc_restore_active(uuid) from public,anon,authenticated;
grant execute on function public.tc_restore_active(uuid) to authenticated;

-- Verify source versions BEFORE replacing any function, so no partial deployment occurs.
do $audit$
begin
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.audit_ai_correction()'::pg_catalog.regprocedure))<>'9e4eda5e0cab0f05a7ebaf2bd06ed08c' then raise exception 'Trigger changed since restore audit: elite_private.audit_ai_correction';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.economic_activity_guard()'::pg_catalog.regprocedure))<>'e62b83000d3ed4dc0ebd96fafe920ba2' then raise exception 'Trigger changed since restore audit: elite_private.economic_activity_guard';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.gantt_work_calendar_guard()'::pg_catalog.regprocedure))<>'fb73ccf0ea4e3d5a481375cc9c66cae7' then raise exception 'Trigger changed since restore audit: elite_private.gantt_work_calendar_guard';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.native_guard()'::pg_catalog.regprocedure))<>'278402438cdd2d2ae1d78bcf8c6f73e6' then raise exception 'Trigger changed since restore audit: elite_private.native_guard';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.native_history()'::pg_catalog.regprocedure))<>'b8f9d4029f64b23d08d0aa9574509799' then raise exception 'Trigger changed since restore audit: elite_private.native_history';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.record_ai_learning()'::pg_catalog.regprocedure))<>'e02ac124f873c9cfbd4e09d90aaaffdd' then raise exception 'Trigger changed since restore audit: elite_private.record_ai_learning';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.stamp_ai_correction()'::pg_catalog.regprocedure))<>'230038eb017b9ada0a9c4ecf0c2e15ec' then raise exception 'Trigger changed since restore audit: elite_private.stamp_ai_correction';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.sync_plan_work_dates()'::pg_catalog.regprocedure))<>'5cfbdd679eed6630a4694eeeaafaa6c4' then raise exception 'Trigger changed since restore audit: elite_private.sync_plan_work_dates';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('elite_private.track_ai_learning()'::pg_catalog.regprocedure))<>'72e0be023644c36dbb86009f7a471985' then raise exception 'Trigger changed since restore audit: elite_private.track_ai_learning';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('public.elite_control_registry_snapshot()'::pg_catalog.regprocedure))<>'782fd1769e0c789ab0598fac7ee4c05f' then raise exception 'Trigger changed since restore audit: public.elite_control_registry_snapshot';end if;
 if pg_catalog.md5(pg_catalog.pg_get_functiondef('public.elite_control_task_guard()'::pg_catalog.regprocedure))<>'8974bb3b88b5d58446ed7783c89a72bd' then raise exception 'Trigger changed since restore audit: public.elite_control_task_guard';end if;
end $audit$;

-- Guard elite_private.audit_ai_correction: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.audit_ai_correction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'elite_private'
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return null;end if; -- only trusted owner transaction
 insert into public.elite_ai_correction_history(correction_id,user_id,version,old_status,new_status,snapshot)
 values(new.id,new.user_id,new.version,
   case when TG_OP='UPDATE' then old.status else null end, new.status,to_jsonb(new));
 return null;
end;
$function$


-- Guard elite_private.economic_activity_guard: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.economic_activity_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if new.kind in ('budget','actual') and not exists(
  select 1 from public.elite_work_plans p,
    jsonb_array_elements(p.phases) a
  where p.work_id=new.work_id and p.user_id=new.user_id
    and a->>'id'=new.activity_id
    and coalesce((a->>'is_group')::boolean,false)=false
    and not exists(select 1 from jsonb_array_elements(p.phases) ch where ch->>'parent_id'=new.activity_id)
 ) then raise exception 'La partida económica no pertenece al Gantt de esta obra';end if;
 return new;
end $function$


-- Guard elite_private.gantt_work_calendar_guard: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.gantt_work_calendar_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare expected jsonb;p jsonb;q jsonb;
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if new.working_calendar is null then return new;end if;
 perform elite_private.work_calendar_validate(new.working_calendar);
 if coalesce((new.working_calendar->>'inherit_holidays')::boolean,false) and new.working_calendar is distinct from elite_private.shared_calendar(new.working_calendar,(new.working_calendar->>'anchor')::date,new.user_id) then raise exception 'Los festivos comunes cambiaron. Actualiza antes de guardar.';end if;
 -- A calendar change and the following phase save share one protected RPC transaction.
 if tg_op='UPDATE' and new.phases is not distinct from old.phases and new.working_calendar is distinct from old.working_calendar then return new;end if;
 expected:=elite_private.gantt_schedule_working(new.phases,new.working_calendar);
 for p in select value from jsonb_array_elements(expected) loop
  select value into q from jsonb_array_elements(new.phases) where value->>'id'=p->>'id';
  if (q->>'start',q->>'end',q->>'duration_days') is distinct from (p->>'start',p->>'end',p->>'duration_days') then raise exception 'Fechas o duración no coinciden con el calendario laboral. Actualiza desde Gantt.';end if;
 end loop;return new;
end $function$


-- Guard elite_private.native_guard: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.native_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if tg_op='UPDATE' then new.user_id:=old.user_id; new.created_at:=old.created_at; end if;
 new.updated_at:=now();
 if tg_table_name='elite_tasks' then
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.recurrence_timezone) then raise exception 'Zona horaria no válida'; end if;
  if jsonb_typeof(new.checklists)<>'array' or jsonb_array_length(new.checklists)>100 then raise exception 'Checklists no válidos'; end if;
  if exists(select 1 from jsonb_array_elements(new.checklists) c where jsonb_typeof(c->'items') is distinct from 'array' or jsonb_typeof(c->'name') is distinct from 'string') then raise exception 'Estructura de checklist no válida'; end if;
  if exists(select 1 from jsonb_array_elements(new.checklists) c cross join lateral jsonb_array_elements(c->'items') i where jsonb_typeof(i->'text') is distinct from 'string' or jsonb_typeof(i->'done') is distinct from 'boolean') then raise exception 'Elemento de checklist no válido'; end if;
  if new.recurrence<>'none' and new.due_at is null then raise exception 'La repetición necesita vencimiento'; end if;
  if tg_op='UPDATE' and new.completed is distinct from old.completed then new.status:=case when new.completed then 'done' else 'pending' end;
  else new.completed:=(new.status='done'); end if;
 end if;
 return new;
end $function$


-- Guard elite_private.native_history: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.native_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare changed jsonb; heading text;
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 heading:=coalesce(to_jsonb(new)->>'title',to_jsonb(new)->>'name','');
 if tg_op='UPDATE' then
  select coalesce(jsonb_agg(key),'[]'::jsonb) into changed from jsonb_each(to_jsonb(new)) where value is distinct from to_jsonb(old)->key and key not in ('updated_at','revision');
  if changed='[]'::jsonb then return new; end if;
 end if;
 insert into public.elite_history(user_id,entity_id,entity_type,action,title,fields) values(new.user_id,new.id,tg_table_name,case when tg_op='INSERT' then 'Creación' else 'Actualización' end,heading,coalesce(changed,'[]'::jsonb));
 return new;
end $function$


-- Guard elite_private.record_ai_learning: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.record_ai_learning()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'elite_private'
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return null;end if; -- only trusted owner transaction
  insert into public.elite_ai_learning_history(learning_id,user_id,version,old_status,new_status,snapshot)
  values(new.id,new.user_id,new.version,case when tg_op='UPDATE' then old.status else null end,
         new.status,to_jsonb(new));
  return null;
end;
$function$


-- Guard elite_private.stamp_ai_correction: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.stamp_ai_correction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'elite_private'
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if exists(
  select 1 from elite_private.tc_restore_context_v3 c
  where c.txid=pg_catalog.txid_current_if_assigned()
    and c.backend_pid=pg_catalog.pg_backend_pid()
    and c.user_id=new.user_id
 ) then return new; end if;
 if TG_OP='UPDATE' then
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id
   or new.created_at is distinct from old.created_at then
   raise exception 'Identidad y creación inmutables';
  end if;
  if old.status in ('confirmed','dismissed') and new.status is distinct from old.status then
   raise exception 'La corrección ya fue resuelta. Crea una nueva versión como nueva propuesta.';
  end if;
  new.version:=old.version+1;new.updated_at:=now();
  if new.status='confirmed' then new.confirmed_at:=now();end if;
 else
  new.version:=1;new.status:='awaiting_confirmation';new.confirmed_at:=null;
  new.created_at:=now();new.updated_at:=now();
 end if;
 return new;
end $function$


-- Guard elite_private.sync_plan_work_dates: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.sync_plan_work_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE first_day date; last_day date;
BEGIN
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 SELECT min((p->>'start')::date),max((p->>'end')::date) INTO first_day,last_day
 FROM jsonb_array_elements(NEW.phases) p;
 IF first_day IS NOT NULL AND last_day IS NOT NULL THEN
  UPDATE public.elite_works SET start_date=first_day,end_date=last_day,
   execution_state=CASE WHEN execution_state='planning' AND first_day<(now() AT TIME ZONE 'Europe/Madrid')::date AND archived_at IS NULL THEN 'execution' ELSE execution_state END
  WHERE id=NEW.work_id AND user_id=NEW.user_id AND
   (start_date IS DISTINCT FROM first_day OR end_date IS DISTINCT FROM last_day OR
    execution_state='planning' AND first_day<(now() AT TIME ZONE 'Europe/Madrid')::date AND archived_at IS NULL);
 END IF;
 RETURN NEW;
END $function$


-- Guard elite_private.track_ai_learning: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION elite_private.track_ai_learning()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'elite_private'
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if exists(
  select 1 from elite_private.tc_restore_context_v3 c
  where c.txid=pg_catalog.txid_current_if_assigned()
    and c.backend_pid=pg_catalog.pg_backend_pid()
    and c.user_id=new.user_id
 ) then return new; end if;
 if tg_op='UPDATE' then
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id
    or new.created_at is distinct from old.created_at then
    raise exception 'Identidad y fecha de creación inmutables.';
  end if;
  new.version:=old.version+1;
  new.updated_at:=now();
  if new.status is distinct from old.status then
   if new.status in ('approved','rejected') then new.reviewed_at:=now();
   elsif new.status='pending' then new.reviewed_at:=null;
   end if;
  end if;
 else
  new.version:=1;new.status:='pending';new.created_at:=now();
  new.updated_at:=now();new.reviewed_at:=null;
 end if;
 return new;
end $function$


-- Guard public.elite_control_registry_snapshot: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION public.elite_control_registry_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.elite_contractors;
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if new.contractor_id is null then raise exception 'Selecciona un proveedor o subcontrata del registro';end if;
 select * into p from public.elite_contractors where id=new.contractor_id and user_id=new.user_id;
 if not found then raise exception 'Proveedor no disponible para esta cuenta';end if;
 new.name:=p.name;new.scope:=p.trade;new.kind:=p.kind;return new;
end; $function$


-- Guard public.elite_control_task_guard: only if tc_restore_context contains current owner+txid.
CREATE OR REPLACE FUNCTION public.elite_control_task_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if public.tc_restore_active(new.user_id) then return new;end if; -- only trusted owner transaction
 if tg_op='UPDATE' and (new.control_id,new.control_step) is distinct from (old.control_id,old.control_step) then
  raise exception 'No se puede cambiar la vinculación de una etapa';
 end if;
 if not new.completed then new.control_na:=false; end if;
 return new;
end $function$


commit;
