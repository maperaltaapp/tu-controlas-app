-- TU CONTROLAS V3: restores ONLY an EMPTY owner's structured data, in one transaction.
-- No DELETE/UPDATE of any other account. Never apply to a live account with works.
-- Requires restore-ai-context-v3.sql to preserve historical AI status/version/time.
begin;
create or replace function public.tc_restore_empty_owner_v3(archive jsonb)
returns jsonb language plpgsql security definer set search_path='' as $restore$
declare
 uid uuid:=auth.uid();
 tbl text; rows jsonb; n integer; total integer:=0; old_count integer;
 task_data jsonb; tasks_done integer:=0;
 collist text; key text;
 approved text[]:=array[
  'elite_works','elite_contractors','elite_work_contractors','elite_tasks',
  'elite_work_plans','elite_plan_versions','elite_plan_exceptions',
  'elite_work_checklist_items','elite_daily_reports','elite_incidents',
  'elite_capacity_reviews','elite_contract_plan_versions','elite_contract_plan_drafts',
  'elite_holiday_calendars','elite_task_orders','elite_history',
  'elite_work_economic_entries','elite_ai_learnings','elite_ai_corrections',
  'elite_ai_learning_history','elite_ai_correction_history','elite_ai_agent_settings'
 ];
begin
 if uid is null then raise exception 'Necesitas iniciar sesión para recuperar una copia.'; end if;
 if archive is null or pg_catalog.jsonb_typeof(archive)<>'object'
  or archive->>'format'<>'tu-controlas-structured-export'
  or archive->>'version'<>'3'
  or archive->>'owner_id'<>uid::text then
  raise exception 'La copia es incompatible o pertenece a otra cuenta.';
 end if;
 if pg_catalog.octet_length(archive::text)>62914560 then
  raise exception 'La copia excede el tamaño permitido.';end if;
 if pg_catalog.jsonb_typeof(archive->'tables')<>'object'
  or pg_catalog.jsonb_typeof(archive->'counts')<>'object'
  or (select count(*) from pg_catalog.jsonb_object_keys(archive->'tables'))<>22
  or (select count(*) from pg_catalog.jsonb_object_keys(archive->'counts'))<>22
  or exists(select 1 from pg_catalog.jsonb_object_keys(archive->'tables') name
     where not (name=any(approved)))
  or exists(select 1 from pg_catalog.jsonb_object_keys(archive->'counts') name
     where not (name=any(approved))) then
  raise exception 'La copia no contiene exactamente las tablas de V3.';
 end if;
 if not exists(select 1 from auth.users where id=uid) then
  raise exception 'No se encontró la cuenta de destino.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,8525));
 -- Row lock serializes inserts referencing the same owner, but not other customers.
 perform 1 from auth.users where id=uid for update;
 foreach tbl in array approved loop
  execute pg_catalog.format('select count(*) from public.%I where user_id=$1',tbl)
    into old_count using uid;
  if old_count<>0 then
   raise exception 'La cuenta ya tiene información. No se sobrescribe ni fusiona nada.';
  end if;
  rows:=archive->'tables'->tbl;
  if pg_catalog.jsonb_typeof(rows)<>'array'
   or archive->'counts'->>tbl is null
   or archive->'counts'->>tbl !~ '^[0-9]+$'
   or (archive->'counts'->>tbl)::integer<>pg_catalog.jsonb_array_length(rows) then
    raise exception 'La copia no tiene datos válidos de la tabla %.',tbl;
  end if;
  if exists(
   select 1 from pg_catalog.jsonb_array_elements(rows) item
   where pg_catalog.jsonb_typeof(item)<>'object'
    or item->>'user_id' is distinct from uid::text
  ) then raise exception 'Se detectó información de otro propietario en %.',tbl; end if;
  total:=total+pg_catalog.jsonb_array_length(rows);
  if total>120000 then raise exception 'La copia tiene demasiados registros.'; end if;
 end loop;
 -- The only other owner data allowed are push-device registrations, deliberately
 -- excluded from backups because they contain per-device authentication keys.
 -- The archive must not contain cross-owner references in AI tables which may
 -- have single-column FKs, even though its own row.user_id is correct.
 if exists(
  select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_learnings') a
  where a->>'work_id' is not null
   and not exists(select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_works') w
     where w->>'id'=a->>'work_id')
 ) then raise exception 'Aprendizaje relacionado con una obra externa.';end if;
 if exists(
  select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_corrections') a
  where (a->>'work_id' is not null and not exists(
    select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_works') w
    where w->>'id'=a->>'work_id'))
   or (a->>'linked_learning_id' is not null and not exists(
    select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_learnings') l
    where l->>'id'=a->>'linked_learning_id'))
 ) then raise exception 'Corrección vinculada a registros ajenos.';end if;
 if exists(
  select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_learning_history') a
  where not exists(select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_learnings') l
    where l->>'id'=a->>'learning_id')
 ) or exists(
  select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_correction_history') a
  where not exists(select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_ai_corrections') c
    where c->>'id'=a->>'correction_id')
 ) then raise exception 'El historial de IA apunta a otros registros.';end if;
 if exists(
  select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_work_economic_entries') a
  where not exists(
   select 1 from pg_catalog.jsonb_array_elements(archive->'tables'->'elite_works') w
   where w->>'id'=a->>'work_id')
 ) then raise exception 'Hay costes que no corresponden a las obras de la copia.';end if;

 -- The table is private, not exposed through REST, and keyed by transaction ID,
 -- backend process and owner. Only this definer can insert a restore context.
 insert into elite_private.tc_restore_context_v3(txid,backend_pid,user_id)
 values(pg_catalog.txid_current(),pg_catalog.pg_backend_pid(),uid);

 foreach tbl in array approved loop
  rows:=archive->'tables'->tbl;
  if tbl='elite_tasks' then
   -- Task previous_task_id uses an actual FK: insert root tasks before descendants.
   for task_data in
    with recursive source as(
     select value as item from pg_catalog.jsonb_array_elements(rows) value
    ), chain as(
     select item,item->>'id' as task_id,0 as depth from source
      where nullif(item->>'previous_task_id','') is null
     union all
     select child.item,child.item->>'id',parent.depth+1
       from source child join chain parent on child.item->>'previous_task_id'=parent.task_id
       where parent.depth<5000
    ) select item from chain order by depth
   loop
    execute 'insert into public.elite_tasks select * from pg_catalog.jsonb_populate_record(null::public.elite_tasks,$1)'
     using task_data;
    tasks_done:=tasks_done+1;
   end loop;
   if tasks_done<>pg_catalog.jsonb_array_length(rows) then
    raise exception 'Faltan tareas o hay un ciclo de dependencias.';
   end if;
  else
   -- Creation triggers generate audit history; replace ONLY this owner's
   -- synthetic events with the archived events in the same transaction.
   if tbl=any(array['elite_history','elite_ai_learning_history','elite_ai_correction_history']) then
    execute pg_catalog.format('delete from public.%I where user_id=$1',tbl) using uid;
   end if;
   if tbl=any(array['elite_history','elite_plan_versions',
      'elite_ai_learning_history','elite_ai_correction_history']) then
    -- These IDs are GENERATED ALWAYS and globally shared. Generate fresh IDs
    -- instead of changing global sequences that also serve other customers.
    select pg_catalog.string_agg(pg_catalog.quote_ident(a.attname),','
     order by a.attnum) into collist
     from pg_catalog.pg_attribute a
     where a.attrelid=pg_catalog.to_regclass('public.'||tbl)
       and a.attnum>0 and not a.attisdropped and a.attname<>'id'
       and a.attgenerated='';
    execute pg_catalog.format(
      'insert into public.%I(%s) select %s from pg_catalog.jsonb_populate_recordset(null::public.%I,$1)',
      tbl,collist,collist,tbl) using rows;
   else
    execute pg_catalog.format(
     'insert into public.%I select * from pg_catalog.jsonb_populate_recordset(null::public.%I,$1)',
      tbl,tbl) using rows;
   end if;
  end if;
 end loop;
 -- Prove the resulting client table counts match all archived row counts.
 foreach tbl in array approved loop
  execute pg_catalog.format('select count(*) from public.%I where user_id=$1',tbl)
   into n using uid;
  if n<>(archive->'counts'->>tbl)::integer then
   raise exception 'Restauración incompleta en %, operación revertida.',tbl;
  end if;
 end loop;
 -- Full round-trip comparison: reject ANY changed row content, not only counts.
 -- Identity IDs from four global history/plan-version sequences are intentionally
 -- regenerated, because reusing them could affect another tenant's sequence.
 foreach tbl in array approved loop
  rows:=archive->'tables'->tbl;
  if tbl=any(array['elite_history','elite_plan_versions',
        'elite_ai_learning_history','elite_ai_correction_history']) then
   execute pg_catalog.format(
    'select count(*) from ((select (value - ''id'') as obj from pg_catalog.jsonb_array_elements($1)
      except all select (to_jsonb(t) - ''id'') as obj from public.%I t where t.user_id=$2)
      union all (select (to_jsonb(t) - ''id'') as obj from public.%I t where t.user_id=$2
      except all select (value - ''id'') as obj from pg_catalog.jsonb_array_elements($1))) differences',
    tbl,tbl) into old_count using rows,uid;
  else
   execute pg_catalog.format(
    'select count(*) from ((select value as obj from pg_catalog.jsonb_array_elements($1)
      except all select to_jsonb(t) as obj from public.%I t where t.user_id=$2)
      union all (select to_jsonb(t) as obj from public.%I t where t.user_id=$2
      except all select value as obj from pg_catalog.jsonb_array_elements($1))) differences',
    tbl,tbl) into old_count using rows,uid;
  end if;
  if old_count>0 then
   raise exception 'El contenido restaurado no coincide con la copia (%); se revierte todo.',tbl;
  end if;
 end loop;
 delete from elite_private.tc_restore_context_v3
  where txid=pg_catalog.txid_current() and backend_pid=pg_catalog.pg_backend_pid() and user_id=uid;
 return pg_catalog.jsonb_build_object(
  'restored',true,'owner_id',uid,'records',total,'tables',22,
  'mode','empty_account_only','history_ids','regenerated_safely','verification','exact_rows_except_identity_ids');
end $restore$;
revoke all on function public.tc_restore_empty_owner_v3(jsonb) from public,anon,authenticated;
grant execute on function public.tc_restore_empty_owner_v3(jsonb) to authenticated;
commit;
