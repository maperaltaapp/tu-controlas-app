-- TU CONTROLAS V4: ONE consistent snapshot of each authenticated owner's structured data.
-- Read-only, SECURITY INVOKER, subject to table RLS. No files, secrets, or push keys.
begin;
create or replace function public.tc_export_owner_v4()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  uid uuid:=auth.uid();
  tbl text;
  sort_col text;
  rows jsonb;
  tbls jsonb:='{}'::jsonb;
  counts jsonb:='{}'::jsonb;
  total integer:=0;
  allowed text[]:=array[
   'elite_works','elite_contractors','elite_work_contractors',
   'elite_tasks','elite_work_plans','elite_plan_versions','elite_plan_exceptions',
   'elite_work_checklist_items','elite_daily_reports','elite_incidents',
   'elite_capacity_reviews','elite_contract_plan_versions','elite_contract_plan_drafts',
   'elite_holiday_calendars','elite_task_orders','elite_history','elite_work_economic_entries',
   'tc_cost_forecast_snapshots',
   'elite_ai_learnings','elite_ai_corrections','elite_ai_learning_history',
   'elite_ai_correction_history','elite_ai_agent_settings'
  ];
begin
 if uid is null then raise exception 'Sesión requerida';end if;
 foreach tbl in array allowed loop
  sort_col:=case tbl
   when 'elite_work_plans' then 't.work_id'
   when 'elite_contract_plan_drafts' then 't.work_id'
   when 'elite_holiday_calendars' then 't.user_id'
   when 'elite_task_orders' then 't.user_id,t.group_key'
   when 'elite_ai_agent_settings' then 't.user_id'
   else 't.id' end;
  execute pg_catalog.format(
   'select coalesce(jsonb_agg(to_jsonb(t) order by %s),''[]''::jsonb) from public.%I t where t.user_id=$1',
   sort_col,tbl) into rows using uid;
  total:=total+pg_catalog.jsonb_array_length(rows);
  if total>120000 then raise exception 'Copia demasiado grande por cantidad de registros';end if;
  tbls:=tbls||pg_catalog.jsonb_build_object(tbl,rows);
  counts:=counts||pg_catalog.jsonb_build_object(tbl,pg_catalog.jsonb_array_length(rows));
 end loop;
 if pg_catalog.octet_length(tbls::text)>62914560 then raise exception 'Copia demasiado grande por tamaño';end if;
 return pg_catalog.jsonb_build_object(
  'format','tu-controlas-structured-export','version',4,
  'owner_id',uid,'exported_at',pg_catalog.statement_timestamp(),
  'counts',counts,'tables',tbls);
end $$;
revoke all on function public.tc_export_owner_v4() from public,anon;
grant execute on function public.tc_export_owner_v4() to authenticated;
commit;
