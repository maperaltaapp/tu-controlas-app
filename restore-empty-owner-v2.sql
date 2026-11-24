-- TU CONTROLAS: PREPARACIÓN DEL RESTAURADOR V2. NO APLICAR EN PRODUCCIÓN.
-- Ejecutar solo en BD desechable con dos cuentas ficticias hasta validar A/B real.
-- Una única RPC transaccional: ante cualquier error no se insertan registros.
begin;
create or replace function public.tc_restore_empty_owner_v2(archive jsonb)
returns jsonb language plpgsql security definer set search_path='' as $restore$
declare
 uid uuid := auth.uid();
 table_name text; rows jsonb; owner_count integer; i integer; inserted integer:=0;
 task_data jsonb; tasks_done integer:=0; task_count integer;
 approved text[] := array[
  'elite_works','elite_contractors','elite_work_contractors','elite_tasks',
  'elite_work_plans','elite_plan_versions','elite_plan_exceptions',
  'elite_work_checklist_items','elite_daily_reports','elite_incidents',
  'elite_capacity_reviews','elite_contract_plan_versions','elite_contract_plan_drafts',
  'elite_holiday_calendars','elite_task_orders','elite_history'];
begin
 if uid is null then raise exception 'Debes iniciar sesión para restaurar.'; end if;
 if archive is null or jsonb_typeof(archive)<>'object' or archive->>'format'<>'tu-controlas-structured-export'
 or archive->>'version'<>'2' or archive->>'owner_id'<>uid::text then
  raise exception 'Copia incompatible o de otra cuenta.';
 end if;
 if octet_length(archive::text)>62914560 then raise exception 'Copia demasiado grande.';end if;
 if jsonb_typeof(archive->'tables')<>'object' or jsonb_object_length(archive->'tables')<>array_length(approved,1)
 or jsonb_typeof(archive->'counts')<>'object' then raise exception 'La copia no contiene las tablas permitidas.';end if;
 if not exists(select 1 from auth.users u where u.id=uid) then raise exception 'Cuenta de destino no disponible.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,8524));
 -- No merging, no updates and no deletions. All owner tables must be empty.
 foreach table_name in array approved loop
  execute pg_catalog.format('select count(*) from public.%I where user_id=$1',table_name)
   into owner_count using uid;
  if owner_count<>0 then raise exception 'Esta cuenta ya contiene datos. No se permite sobrescribir ni fusionar.';end if;
 end loop;
 foreach table_name in array array['elite_work_economic_entries','elite_ai_learnings','elite_ai_corrections'] loop
  if pg_catalog.to_regclass('public.'||table_name) is not null then
   execute pg_catalog.format('select count(*) from public.%I where user_id=$1',table_name)
    into owner_count using uid;
   if owner_count<>0 then raise exception 'Hay datos adicionales no incluidos en el archivo. Restauración bloqueada.';end if;
  end if;
 end loop;
 foreach table_name in array approved loop
  rows:=archive->'tables'->table_name;
  if jsonb_typeof(rows)<>'array' then raise exception 'Falta la tabla %.',table_name;end if;
  if archive->'counts'->>table_name is null or
    (archive->'counts'->>table_name)!~'^[0-9]+$' or
    (archive->'counts'->>table_name)::integer<>jsonb_array_length(rows) then
    raise exception 'Recuento de registros incorrecto en %.',table_name;
  end if;
  if exists(select 1 from jsonb_array_elements(rows) item
    where jsonb_typeof(item)<>'object' or item->>'user_id' is distinct from uid::text) then
    raise exception 'La copia contiene registros de otra cuenta en %.',table_name;
  end if;
  inserted:=inserted+jsonb_array_length(rows);
  if inserted>120000 then raise exception 'Demasiados registros en la copia.';end if;
 end loop;
 -- Dependency-safe order: works -> contractors -> assignments -> tasks -> plans/reports.
 foreach table_name in array approved loop
  rows:=archive->'tables'->table_name;
  if table_name='elite_tasks' then
   task_count:=jsonb_array_length(rows);
   -- Task predecessors are foreign keys and must be inserted before children.
   for task_data in
    with recursive source as(
     select value as item from jsonb_array_elements(rows) value
    ), chain as(
     select item,item->>'id' as task_id,0 as depth from source
      where nullif(item->>'previous_task_id','') is null
     union all
     select child.item,child.item->>'id',parent.depth+1
      from source child join chain parent on child.item->>'previous_task_id'=parent.task_id
      where parent.depth<5000
    ) select item from chain order by depth
   loop
    execute 'insert into public.elite_tasks select * from jsonb_populate_record(null::public.elite_tasks,$1)'
     using task_data;
    tasks_done:=tasks_done+1;
   end loop;
   if tasks_done<>task_count then raise exception 'Dependencias cíclicas o incompletas entre tareas.';end if;
  else
   execute pg_catalog.format(
    'insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)',
    table_name,table_name) using rows;
  end if;
 end loop;
 return jsonb_build_object('restored',true,'owner_id',uid,'records',inserted,
   'tables',array_length(approved,1),'mode','empty_account_only');
end $restore$;
revoke all on function public.tc_restore_empty_owner_v2(jsonb) from public,anon,authenticated;
grant execute on function public.tc_restore_empty_owner_v2(jsonb) to authenticated;
commit;
