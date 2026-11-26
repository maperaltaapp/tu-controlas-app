-- Candidate for isolated QA only. Never apply to production without a schema audit.
-- Use the existing private transaction guard, not a client-settable GUC.
begin;
create or replace function public.tc_restore_preserve_v3(expected_owner uuid)
returns boolean language sql stable security definer set search_path='' as $$
select expected_owner is not null and expected_owner=(select auth.uid()) and exists (
 select 1 from elite_private.tc_restore_context_v3 c
 where c.txid=pg_catalog.txid_current_if_assigned()
 and c.backend_pid=pg_catalog.pg_backend_pid() and c.user_id=expected_owner
);
$$;
revoke all on function public.tc_restore_preserve_v3(uuid) from public,anon,authenticated;
grant execute on function public.tc_restore_preserve_v3(uuid) to authenticated;
-- Preserve timestamps only: keep ordinary task validation intact.
CREATE OR REPLACE FUNCTION elite_private.native_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='UPDATE' then new.user_id:=old.user_id; new.created_at:=old.created_at; end if;
 if not public.tc_restore_preserve_v3(new.user_id) then new.updated_at:=now();end if;
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
end $function$;
-- Avoid automatic recomputation of historical work dates during restore.
CREATE OR REPLACE FUNCTION elite_private.sync_plan_work_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE first_day date; last_day date;
BEGIN
 if public.tc_restore_preserve_v3(new.user_id) then return new;end if; -- only trusted owner transaction
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
END $function$;
create or replace function elite_private.checklist_touch() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then new.user_id:=old.user_id;new.created_at:=old.created_at;end if;
 if not public.tc_restore_preserve_v3(new.user_id) then new.updated_at:=now();end if;return new;
end $$;
-- A restored historical report must not replay its measurements into Gantt.
-- Permit only validated INSERT in the private owner/transaction restore context.
create or replace function elite_private.daily_activity_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' and public.tc_restore_preserve_v3(new.user_id) then
  if new.format_version=2 then
   if jsonb_typeof(new.activities) is distinct from 'array' or jsonb_array_length(new.activities) not between 1 and 100 or octet_length(new.activities::text)>200000 then
    raise exception 'Parte histórico no válido';
   end if;
   if exists(select 1 from jsonb_array_elements(new.activities) x where jsonb_typeof(x) is distinct from 'object') then raise exception 'Parte histórico no válido';end if;
   if exists(select 1 from jsonb_array_elements(new.activities) x where
    jsonb_typeof(x->'activity_name') is distinct from 'string' or length(btrim(x->>'activity_name')) not between 1 and 160 or
    jsonb_typeof(x->'observations') is distinct from 'string' or length(x->>'observations')>10000 or
    jsonb_typeof(x->'progress_pct') is distinct from 'number' or (x->>'progress_pct')::numeric not between 0 and 100 or (x->>'progress_pct')::numeric<>round((x->>'progress_pct')::numeric,2) or
    jsonb_typeof(x->'workers') is distinct from 'number' or (x->>'workers')::numeric not between 0 and 500 or (x->>'workers')::numeric<>trunc((x->>'workers')::numeric) or
    jsonb_typeof(x->'machines') is distinct from 'number' or (x->>'machines')::numeric not between 0 and 500 or (x->>'machines')::numeric<>trunc((x->>'machines')::numeric) or
    (x ? 'activity_id' and jsonb_typeof(x->'activity_id') not in ('string','null'))
   ) then raise exception 'Parte histórico no válido';end if;
   if exists(select 1 from jsonb_array_elements(new.activities) x where nullif(x->>'activity_id','') is not null group by x->>'activity_id' having count(*)>1) then raise exception 'Parte histórico con actividad repetida';end if;
  elsif new.activities is distinct from '[]'::jsonb then raise exception 'Parte histórico no válido';end if;
  return new;
 end if;
 if current_setting('elite.daily_report_sync',true) is distinct from 'on' and
  (new.format_version=2 or new.activities<>'[]'::jsonb or (tg_op='UPDATE' and (old.format_version=2 or new.activities is distinct from old.activities))) then
  raise exception 'Guarda el parte y su avance mediante la operación conjunta';
 end if;
 return new;
end $$;
revoke all on function elite_private.daily_activity_guard() from public,anon,authenticated;
commit;
