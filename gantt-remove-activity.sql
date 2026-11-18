create or replace function public.elite_remove_gantt_activity(target_work uuid,new_phases jsonb,expected_revision integer,remove_activity uuid,freeze_baseline boolean default false,confirm_work boolean default false,exception_reason text default '') returns public.elite_work_plans language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();old_plan public.elite_work_plans;result public.elite_work_plans;p jsonb;o jsonb;t public.elite_tasks;tid uuid;previous_flag text:=current_setting('elite.gantt_sync',true);normalized jsonb:='[]';
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into old_plan from public.elite_work_plans where work_id=target_work for update;
 if expected_revision is null or coalesce(old_plan.revision,0)<>expected_revision then raise exception 'La planificación cambió. Actualiza antes de guardar.';end if;
 if jsonb_typeof(new_phases) is distinct from 'array' or jsonb_array_length(new_phases)>100 or octet_length(new_phases::text)>250000 then raise exception 'Planificación no válida';end if;
 if remove_activity is null or not exists (
   select 1 from jsonb_array_elements(coalesce(old_plan.phases,'[]')) old
   where old->>'id'=remove_activity::text
 ) or exists (
   select 1 from jsonb_array_elements(new_phases) candidate
   where candidate->>'id'=remove_activity::text
 ) or exists (
   select 1 from jsonb_array_elements(coalesce(old_plan.phases,'[]')) old
   where old->>'id'<>remove_activity::text and not exists (
     select 1 from jsonb_array_elements(new_phases) candidate where candidate->>'id'=old->>'id'
   )
 ) then raise exception 'Indica una única actividad existente para eliminar';end if;
 if exists(select 1 from jsonb_array_elements(new_phases) candidate where nullif(candidate->>'task_id','') is not null group by candidate->>'task_id' having count(*)>1) then raise exception 'Una tarea no puede vincularse dos veces';end if;
 for p in select value from jsonb_array_elements(new_phases) loop
 if coalesce(p->>'section','')<>'' and length(p->>'section')>160 then raise exception 'Fase demasiado larga';end if;
 if coalesce(p->>'activity_status','pending') not in ('pending','doing','blocked','done') then raise exception 'Estado no válido';end if;
 if p->>'lag_days' is not null and ((p->>'lag_days')::numeric<0 or (p->>'lag_days')::numeric<>trunc((p->>'lag_days')::numeric)) then raise exception 'Espera no válida';end if;
 if coalesce((p->>'milestone')::boolean,false) and p->>'start'<>p->>'end' then raise exception 'Un hito tiene una única fecha';end if;
 if p->>'actual_start' is not null and (p->>'actual_start')::date>(now() at time zone 'Europe/Madrid')::date then raise exception 'Inicio real futuro';end if;
 if p->>'actual_end' is not null and ((p->>'actual_start') is null or (p->>'actual_end')::date<(p->>'actual_start')::date or (p->>'actual_end')::date>(now() at time zone 'Europe/Madrid')::date) then raise exception 'Fechas reales no válidas';end if;
 if p->>'budget' is not null and (jsonb_typeof(p->'budget')<>'number' or (p->>'budget')::numeric<0 or (p->>'budget')::numeric>100000000000) then raise exception 'Presupuesto no válido';end if;
 for o in select value from jsonb_array_elements(coalesce(p->'economic_observations','[]')) loop
 if o->>'date' is null or (o->>'date')::date>(now() at time zone 'Europe/Madrid')::date or jsonb_typeof(o->'amount') is distinct from 'number' or (o->>'amount')::numeric<0 then raise exception 'Medición económica no válida';end if;
 end loop;
 tid:=nullif(p->>'task_id','')::uuid;
 select value into o from jsonb_array_elements(coalesce(old_plan.phases,'[]')) where value->>'id'=p->>'id';
 if nullif(o->>'task_id','') is not null and not exists(select 1 from jsonb_array_elements(new_phases) child where child->>'parent_id'=p->>'id') then
  if tid is not null and tid<>(o->>'task_id')::uuid then raise exception 'Conserva el vínculo original de la actividad';end if;
  if tid is null then tid:=(o->>'task_id')::uuid;p:=p||jsonb_build_object('task_id',tid,'task_updated_at',(select updated_at from public.elite_tasks where id=tid));end if;
 end if;
 if tid is not null then
 select * into t from public.elite_tasks where id=tid and user_id=uid and work_id=target_work and deleted_at is null for update;
 if not found or t.control_id is not null or t.recurrence<>'none' then raise exception 'Tarea no disponible para vincular';end if;
 if p->>'task_updated_at' is null or (p->>'task_updated_at')::timestamptz<>t.updated_at then raise exception 'La tarea vinculada cambió. Actualiza antes de guardar.';end if;
 end if;
 -- One canonical task for each executable activity; containers remain projections.
 if not exists(select 1 from jsonb_array_elements(new_phases) child where child->>'parent_id'=p->>'id') then
  if tid is null then
   insert into public.elite_tasks(user_id,work_id,work_name,category,title,stage,start_at,due_at,status,completed,progress_pct)
   values(uid,target_work,(select name from public.elite_works where id=target_work),'work',p->>'name','Gantt',
    ((p->>'start')::date+'09:00'::time) at time zone 'Europe/Madrid',((p->>'end')::date+'18:00'::time) at time zone 'Europe/Madrid',
    coalesce(p->>'activity_status','pending'),coalesce(p->>'activity_status','pending')='done',case when p->>'activity_status'='done' then 100 else null end) returning * into t;
   tid:=t.id;p:=p||jsonb_build_object('task_id',tid,'task_updated_at',t.updated_at);
  elsif exists(select 1 from public.elite_work_plans other cross join lateral jsonb_array_elements(other.phases) linked where other.work_id<>target_work and linked->>'task_id'=tid::text) then
   raise exception 'La tarea ya pertenece a otra planificación';
  end if;
 end if;
 normalized:=normalized||jsonb_build_array(p);
 end loop;
 if exists(select 1 from jsonb_array_elements(normalized) entry where nullif(entry->>'task_id','') is not null group by entry->>'task_id' having count(*)>1) then raise exception 'Una tarea no puede vincularse dos veces';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(old_plan.phases,'[]')) prior where nullif(prior->>'task_id','') is not null and prior->>'id'<>remove_activity::text and not exists(select 1 from jsonb_array_elements(normalized) current_row where current_row->>'task_id'=prior->>'task_id')) then raise exception 'Conserva las tareas vinculadas al reorganizar actividades';end if;
 if old_plan.work_id is not null then insert into public.elite_plan_versions(work_id,user_id,revision,snapshot) values(target_work,uid,old_plan.revision,to_jsonb(old_plan)) on conflict do nothing;end if;
 result:=elite_private.gantt_save_core(target_work,normalized,expected_revision,freeze_baseline,confirm_work,exception_reason);
 perform set_config('elite.gantt_sync','on',true);
 for p in select value from jsonb_array_elements(result.phases) loop
 tid:=nullif(p->>'task_id','')::uuid;
 if tid is not null then
 select * into t from public.elite_tasks where id=tid;
 update public.elite_tasks set start_at=((p->>'start')::date+coalesce((t.start_at at time zone 'Europe/Madrid')::time,'09:00'::time)) at time zone 'Europe/Madrid',
 due_at=((p->>'end')::date+coalesce((t.due_at at time zone 'Europe/Madrid')::time,'18:00'::time)) at time zone 'Europe/Madrid',
 stage='Gantt',title=p->>'name',status=coalesce(p->>'activity_status',t.status),completed=coalesce(p->>'activity_status',t.status)='done',progress_pct=case when coalesce(p->>'activity_status',t.status)='done' then 100 else (select (measurement->>'percent')::numeric from jsonb_array_elements(coalesce(p->'observations','[]')) measurement where measurement->>'date'<=(now() at time zone 'Europe/Madrid')::date::text order by measurement->>'date' desc limit 1) end
 where id=tid and (stage is distinct from 'Gantt' or (start_at at time zone 'Europe/Madrid')::date is distinct from (p->>'start')::date or (due_at at time zone 'Europe/Madrid')::date is distinct from (p->>'end')::date or title is distinct from p->>'name' or status is distinct from coalesce(p->>'activity_status',t.status) or progress_pct is distinct from case when coalesce(p->>'activity_status',t.status)='done' then 100 else (select (measurement->>'percent')::numeric from jsonb_array_elements(coalesce(p->'observations','[]')) measurement where measurement->>'date'<=(now() at time zone 'Europe/Madrid')::date::text order by measurement->>'date' desc limit 1) end);
 end if;
 end loop;
 select nullif(value->>'task_id','')::uuid into tid from jsonb_array_elements(old_plan.phases) where value->>'id'=remove_activity::text;
 if tid is not null and not exists(select 1 from public.elite_work_plans wp cross join lateral jsonb_array_elements(wp.phases) linked where linked->>'task_id'=tid::text) then
  update public.elite_tasks set deleted_at=now() where id=tid and user_id=uid and work_id=target_work and deleted_at is null;
 end if;
 select coalesce(jsonb_agg(case when nullif(entry->>'task_id','') is null then entry else entry||jsonb_build_object('task_updated_at',(select updated_at from public.elite_tasks where id=(entry->>'task_id')::uuid)) end order by n),'[]') into normalized from jsonb_array_elements(result.phases) with ordinality entries(entry,n);
 update public.elite_work_plans set phases=normalized where work_id=target_work returning * into result;
 perform set_config('elite.gantt_sync',coalesce(previous_flag,''),true);
 return result;
end $$;
revoke all on function public.elite_remove_gantt_activity(uuid,jsonb,integer,uuid,boolean,boolean,text) from public,anon;
grant execute on function public.elite_remove_gantt_activity(uuid,jsonb,integer,uuid,boolean,boolean,text) to authenticated;
