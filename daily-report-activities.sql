-- Versioned physical reports. Original report fields and Gantt baselines stay intact.
begin;
alter table public.elite_daily_reports add column if not exists activities jsonb not null default '[]'::jsonb;
alter table public.elite_daily_reports add column if not exists format_version integer not null default 1 check(format_version in (1,2));
create or replace function elite_private.daily_activity_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if current_setting('elite.daily_report_sync',true) is distinct from 'on' and
  (new.format_version=2 or new.activities<>'[]'::jsonb or (tg_op='UPDATE' and (old.format_version=2 or new.activities is distinct from old.activities))) then
  raise exception 'Guarda el parte y su avance mediante la operación conjunta';
 end if;
 return new;
end $$;
revoke all on function elite_private.daily_activity_guard() from public,anon,authenticated;
drop trigger if exists elite_daily_activity_guard on public.elite_daily_reports;
create trigger elite_daily_activity_guard before insert or update on public.elite_daily_reports for each row execute function elite_private.daily_activity_guard();
create or replace function public.elite_save_daily_activities(target_report uuid,target_work uuid,report_day date,new_activities jsonb,expected_updated_at timestamptz,expected_plan_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();old_report public.elite_daily_reports;saved public.elite_daily_reports;plan public.elite_work_plans;new_plan public.elite_work_plans;
 item jsonb;previous_item jsonb;row_item jsonb;measurement jsonb;old_measurement jsonb;latest jsonb;phases jsonb;normalized jsonb:='[]';pos integer;percent numeric;new_state text;changed boolean:=false;flag text:=current_setting('elite.daily_report_sync',true);aid text;
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if target_report is null or not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no disponible';end if;
 if report_day is null or report_day<'2000-01-01'::date or report_day>(now() at time zone 'Europe/Madrid')::date then raise exception 'Fecha de parte no válida o futura';end if;
 select * into old_report from public.elite_daily_reports where id=target_report and user_id=uid for update;
 if old_report.id is null then
  if expected_updated_at is not null then raise exception 'El parte cambió. Actualiza antes de guardar.';end if;
  if exists(select 1 from public.elite_daily_reports where work_id=target_work and report_date=report_day) then raise exception 'Ya existe un parte para esa obra y día. Abre el existente.';end if;
 else
  if old_report.updated_at is distinct from expected_updated_at or old_report.work_id<>target_work or old_report.report_date<>report_day then raise exception 'El parte cambió. Actualiza antes de guardar.';end if;
 end if;
 select * into plan from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if expected_plan_revision is distinct from coalesce(plan.revision,0) then raise exception 'El Gantt cambió. Actualiza antes de guardar el parte.';end if;
 if jsonb_typeof(new_activities) is distinct from 'array' or jsonb_array_length(new_activities) not between 1 and 100 or octet_length(new_activities::text)>200000 then raise exception 'Indica al menos una actividad';end if;
 if exists(select 1 from jsonb_array_elements(new_activities) x where jsonb_typeof(x)<>'object') then raise exception 'Actividad no válida';end if;
 if exists(select 1 from jsonb_array_elements(new_activities) x where nullif(x->>'activity_id','') is not null group by x->>'activity_id' having count(*)>1) then raise exception 'Actividad repetida';end if;
 -- A recorded activity is retained as evidence, even after it disappears from the Gantt.
 if exists(select 1 from jsonb_array_elements(coalesce(old_report.activities,'[]')) x where not exists(select 1 from jsonb_array_elements(new_activities) y where (y->>'activity_id',y->>'activity_name') is not distinct from (x->>'activity_id',x->>'activity_name'))) then raise exception 'Conserva las actividades del parte anterior';end if;
 phases:=coalesce(plan.phases,'[]');
 for item in select value from jsonb_array_elements(new_activities) loop
  if exists(select 1 from jsonb_object_keys(item) k where k not in ('activity_id','activity_name','progress_pct','observations','workers','machines')) or
    jsonb_typeof(item->'activity_name') is distinct from 'string' or length(btrim(item->>'activity_name')) not between 1 and 160 or
    jsonb_typeof(item->'observations') is distinct from 'string' or length(item->>'observations')>10000 or
    jsonb_typeof(item->'progress_pct') is distinct from 'number' or (item->>'progress_pct')::numeric not between 0 and 100 or (item->>'progress_pct')::numeric<>round((item->>'progress_pct')::numeric,2) or
    jsonb_typeof(item->'workers') is distinct from 'number' or (item->>'workers')::numeric not between 0 and 500 or (item->>'workers')::numeric<>trunc((item->>'workers')::numeric) or
    jsonb_typeof(item->'machines') is distinct from 'number' or (item->>'machines')::numeric not between 0 and 500 or (item->>'machines')::numeric<>trunc((item->>'machines')::numeric) then raise exception 'Revisa los cuatro datos de cada actividad';end if;
  aid:=nullif(item->>'activity_id','');
  if item ? 'activity_id' and jsonb_typeof(item->'activity_id') not in ('string','null') then raise exception 'Identificador no válido';end if;
  select value into previous_item from jsonb_array_elements(coalesce(old_report.activities,'[]')) x where (x->>'activity_id',x->>'activity_name') is not distinct from (item->>'activity_id',item->>'activity_name') limit 1;
  if aid is not null then
   row_item:=null;pos:=null;
   select x.value,x.n::integer-1 into row_item,pos from jsonb_array_elements(phases) with ordinality x(value,n) where x.value->>'id'=aid;
   if row_item is null or coalesce((row_item->>'is_group')::boolean,false) or exists(select 1 from jsonb_array_elements(phases) child where child->>'parent_id'=aid) then
    if previous_item is distinct from item then raise exception 'La actividad ya no es ejecutable. Conserva su registro histórico sin modificarlo.';end if;
   else
    if previous_item is null and item->>'activity_name' is distinct from row_item->>'name' then raise exception 'El nombre de actividad cambió. Actualiza.';end if;
    percent:=(item->>'progress_pct')::numeric;
    -- Editing notes/resources does not overwrite a newer measurement entered from Gantt.
    if previous_item is null or previous_item->'progress_pct' is distinct from item->'progress_pct' then
     select value into old_measurement from jsonb_array_elements(coalesce(row_item->'observations','[]')) x where x->>'date'=report_day::text;
     if previous_item is not null and (old_measurement is null or old_measurement->'percent' is distinct from previous_item->'progress_pct') then raise exception 'La medición de ese día cambió en Gantt. Actualiza el avance allí antes de corregir el parte.';end if;
     measurement:=coalesce(old_measurement,'{}')||jsonb_build_object('date',report_day,'percent',percent,'report_id',target_report);
     row_item:=row_item||jsonb_build_object('observations',(select coalesce(jsonb_agg(x order by x->>'date'),'[]') from (select value x from jsonb_array_elements(coalesce(row_item->'observations','[]')) where value->>'date'<>report_day::text union all select measurement) obs));
     select value into latest from jsonb_array_elements(row_item->'observations') x where x->>'date'<=(now() at time zone 'Europe/Madrid')::date::text order by x->>'date' desc limit 1;
     if (nullif(row_item->>'actual_end','') is not null or row_item->>'activity_status'='done') and (latest->>'percent')::numeric<100 then raise exception 'La actividad está terminada. Reábrela expresamente desde Gantt antes de cambiar su avance actual.';end if;
     new_state:=case when (latest->>'percent')::numeric=100 then 'done' when row_item->>'activity_status'='blocked' then 'blocked' when (latest->>'percent')::numeric>0 then 'doing' else 'pending' end;
     row_item:=row_item||jsonb_build_object('activity_status',new_state);
     phases:=jsonb_set(phases,array[pos::text],row_item);changed:=true;
    end if;
   end if;
  end if;
  normalized:=normalized||jsonb_build_array(item);
 end loop;
 if changed then
  -- Hydrate task revisions on the locked server snapshot; no client-supplied dates or budgets.
  select coalesce(jsonb_agg(case when nullif(x->>'task_id','') is null then x else x||jsonb_build_object('task_updated_at',(select t.updated_at from public.elite_tasks t where t.id=(x->>'task_id')::uuid and t.user_id=uid)) end order by n),'[]') into phases from jsonb_array_elements(phases) with ordinality q(x,n);
  new_plan:=public.elite_save_gantt(target_work,phases,plan.revision,false,plan.confirmed_at is not null,'');
  if new_plan.baseline is distinct from plan.baseline or new_plan.baseline_at is distinct from plan.baseline_at or new_plan.working_calendar is distinct from plan.working_calendar or exists(select 1 from jsonb_array_elements(new_plan.phases) n join jsonb_array_elements(plan.phases) o on n->>'id'=o->>'id' where (n->>'start',n->>'end',n->>'actual_start',n->>'actual_end',n->'economic_observations',n->'budget') is distinct from (o->>'start',o->>'end',o->>'actual_start',o->>'actual_end',o->'economic_observations',o->'budget')) then raise exception 'El parte no puede cambiar fechas, línea base ni economía';end if;
 else new_plan:=plan;end if;
 perform set_config('elite.daily_report_sync','on',true);
 if old_report.id is null then
  insert into public.elite_daily_reports(id,user_id,work_id,report_date,activities,format_version) values(target_report,uid,target_work,report_day,normalized,2) returning * into saved;
 else
  update public.elite_daily_reports set activities=normalized,format_version=2 where id=target_report and user_id=uid returning * into saved;
 end if;
 perform set_config('elite.daily_report_sync',coalesce(flag,''),true);
 return jsonb_build_object('report',to_jsonb(saved),'plan',case when new_plan.work_id is null then null else to_jsonb(new_plan) end);
end $$;
revoke all on function public.elite_save_daily_activities(uuid,uuid,date,jsonb,timestamptz,integer) from public,anon;
grant execute on function public.elite_save_daily_activities(uuid,uuid,date,jsonb,timestamptz,integer) to authenticated;
commit;
