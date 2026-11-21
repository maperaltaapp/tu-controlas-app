-- Preserve the measured pre-completion value, including same-day measurements.
begin;
create or replace function elite_private.gantt_task_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare plan public.elite_work_plans;rows jsonb;p jsonb;result public.elite_work_plans;duration integer;old_start date;new_start date;restore_pct numeric;old_flag text:=current_setting('elite.gantt_sync',true);
begin
 if old_flag='on' or (new.title,new.start_at,new.due_at,new.status,new.progress_pct,new.work_id,new.deleted_at) is not distinct from (old.title,old.start_at,old.due_at,old.status,old.progress_pct,old.work_id,old.deleted_at) then return new;end if;
 select * into plan from public.elite_work_plans where user_id=new.user_id and exists(select 1 from jsonb_array_elements(phases) linked where linked->>'task_id'=new.id::text) for update;
 if not found then return new;end if;
 if new.work_id is distinct from old.work_id or new.deleted_at is distinct from old.deleted_at then raise exception 'Desvincula la tarea del Gantt antes de moverla o archivarla';end if;
 if plan.working_calendar is not null and (new.start_at,new.due_at) is distinct from (old.start_at,old.due_at) then raise exception 'Modifica las fechas vinculadas desde Gantt usando su calendario laboral';end if;
 if new.start_at is null or new.due_at is null then raise exception 'La tarea vinculada necesita inicio y fin';end if;
 rows:='[]';
 for p in select value from jsonb_array_elements(plan.phases) loop
 if p->>'task_id'=new.id::text then
 p:=p||jsonb_build_object('name',new.title,'start',(new.start_at at time zone 'Europe/Madrid')::date,'end',(new.due_at at time zone 'Europe/Madrid')::date,'activity_status',new.status);

 if new.status='done' and old.status<>'done' then
  p:=p||jsonb_build_object('completion_restore_percent',old.progress_pct);
  p:=p||jsonb_build_object('observations',(select coalesce(jsonb_agg(m),'[]') from jsonb_array_elements(coalesce(p->'observations','[]')) m where m->>'date'<>((now() at time zone 'Europe/Madrid')::date)::text)||jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Europe/Madrid')::date,'percent',100)));
 elsif old.status='done' and new.status<>'done' then
  restore_pct:=case when new.progress_pct is distinct from old.progress_pct then new.progress_pct else coalesce((p->>'completion_restore_percent')::numeric,(select (m->>'percent')::numeric from jsonb_array_elements(coalesce(p->'observations','[]')) m where (m->>'percent')::numeric<100 and m->>'date'<=((now() at time zone 'Europe/Madrid')::date)::text order by m->>'date' desc limit 1)) end;
  if restore_pct is null or restore_pct<0 or restore_pct>=100 then raise exception 'Indica un avance entre 0 y 99,99 para reabrir esta actividad';end if;
  p:=(p-'completion_restore_percent')||jsonb_build_object('observations',(select coalesce(jsonb_agg(m),'[]') from jsonb_array_elements(coalesce(p->'observations','[]')) m where m->>'date'<>((now() at time zone 'Europe/Madrid')::date)::text)||jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Europe/Madrid')::date,'percent',restore_pct)));
 elsif new.progress_pct is distinct from old.progress_pct then
  p:=p||jsonb_build_object('observations',(select coalesce(jsonb_agg(m),'[]') from jsonb_array_elements(coalesce(p->'observations','[]')) m where m->>'date'<>((now() at time zone 'Europe/Madrid')::date)::text)||case when new.progress_pct is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Europe/Madrid')::date,'percent',new.progress_pct)) end);
 end if;
 if plan.working_calendar is null and jsonb_array_length(coalesce(p->'depends_on','[]'))>0 then
 select max((q->>'end')::date)+1 into old_start from jsonb_array_elements(plan.phases) q where q->>'id' in(select jsonb_array_elements_text(p->'depends_on'));
 if (p->>'start')::date<old_start then raise exception 'La fecha incumple una dependencia. Modifica la planificación desde Gantt';end if;
 p:=p||jsonb_build_object('lag_days',(p->>'start')::date-old_start);
 end if;
 end if;
 if nullif(p->>'task_id','') is not null then p:=p||jsonb_build_object('task_updated_at',(select updated_at from public.elite_tasks where id=(p->>'task_id')::uuid));end if;
 rows:=rows||jsonb_build_array(p);
 end loop;
 if plan.working_calendar is null then rows:=elite_private.gantt_schedule(rows);else rows:=elite_private.gantt_schedule_working(rows,plan.working_calendar);end if;
 result:=public.elite_save_gantt(plan.work_id,rows,plan.revision,false,plan.confirmed_at is not null,'');
 return new;
end $$;
revoke all on function elite_private.gantt_task_changed() from public,anon,authenticated;

commit;

commit;
