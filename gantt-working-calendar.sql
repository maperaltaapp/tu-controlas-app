-- Additive, opt-in per-work calendars. Existing plans are not rescheduled by deployment.
begin;
alter table public.elite_work_plans add column if not exists working_calendar jsonb;
create or replace function elite_private.work_calendar_validate(c jsonb) returns void language plpgsql set search_path='' as $$
declare e jsonb;
begin
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'weekdays') is distinct from 'array' or jsonb_array_length(c->'weekdays') not between 1 and 7 or jsonb_typeof(c->'exceptions') is distinct from 'array' or jsonb_array_length(c->'exceptions')>250 or octet_length(c::text)>60000 then raise exception 'Calendario no válido';end if;
 if c->>'anchor' is null or c->>'anchor' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Indica inicio del cronograma';end if;perform (c->>'anchor')::date;
 if exists(select 1 from jsonb_array_elements(c->'weekdays') v where jsonb_typeof(v)<>'number' or v::text !~ '^[0-6]$') or (select count(*) from jsonb_array_elements(c->'weekdays'))<>(select count(distinct v) from jsonb_array_elements(c->'weekdays') v) then raise exception 'Días de semana no válidos';end if;
 if (select count(*) from jsonb_array_elements(c->'exceptions'))<>(select count(distinct v->>'date') from jsonb_array_elements(c->'exceptions') v) then raise exception 'Excepciones duplicadas';end if;
 for e in select value from jsonb_array_elements(c->'exceptions') loop
  if jsonb_typeof(e) is distinct from 'object' or e->>'date' is null or e->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(e->'working') is distinct from 'boolean' or length(btrim(coalesce(e->>'name',''))) not between 1 and 120 then raise exception 'Excepción no válida';end if;perform (e->>'date')::date;
 end loop;
end $$;
create or replace function elite_private.work_day(d date,c jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce((select (e->>'working')::boolean from jsonb_array_elements(c->'exceptions') e where e->>'date'=d::text),exists(select 1 from jsonb_array_elements_text(c->'weekdays') v where v::integer=extract(dow from d)::integer))
$$;
create or replace function elite_private.work_next(d date,c jsonb) returns date language plpgsql immutable set search_path='' as $$
declare i integer;begin for i in 0..3999 loop if elite_private.work_day(d+i,c) then return d+i;end if;end loop;raise exception 'No hay días laborables disponibles';end $$;
create or replace function elite_private.work_add(d date,n integer,c jsonb) returns date language plpgsql immutable set search_path='' as $$
declare result date:=elite_private.work_next(d,c);i integer;begin if n not between 0 and 3660 then raise exception 'Duración no válida';end if;for i in 1..n loop result:=elite_private.work_next(result+1,c);if result-d>3660 then raise exception 'La planificación supera diez años';end if;end loop;return result;end $$;
create or replace function elite_private.work_count(a date,b date,c jsonb) returns integer language plpgsql immutable set search_path='' as $$
declare n integer;result integer:=0;begin if b<a or b-a>3660 then raise exception 'Intervalo no válido';end if;for n in 0..(b-a) loop if elite_private.work_day(a+n,c) then result:=result+1;end if;end loop;return result;end $$;
create or replace function elite_private.gantt_schedule_working(rows jsonb,c jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb:='[]';done text[]:='{}';p jsonb;deps jsonb;start_day date;end_day date;n integer;wait integer;changed boolean;ordered jsonb;lvl integer;
begin
 perform elite_private.work_calendar_validate(c);
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>100 then raise exception 'Planificación no válida';end if;
 while cardinality(done)<jsonb_array_length(rows) loop
  changed:=false;
  for p in select value from jsonb_array_elements(rows) loop
   if p->>'id'=any(done) then continue;end if;
   if exists(select 1 from jsonb_array_elements(rows) child where child->>'parent_id'=p->>'id') then result:=result||jsonb_build_array(p);done:=array_append(done,p->>'id');changed:=true;continue;end if;
   deps:=coalesce(p->'depends_on','[]');
   if exists(select 1 from jsonb_array_elements_text(deps) d where not d=any(done)) then continue;end if;
   n:=case when coalesce((p->>'milestone')::boolean,false) then 0 else coalesce((p->>'duration_days')::integer,greatest(1,elite_private.work_count((p->>'start')::date,(p->>'end')::date,c))) end;wait:=coalesce((p->>'lag_days')::integer,0);
   if n not between 0 and 3660 or (n=0 and not coalesce((p->>'milestone')::boolean,false)) or wait not between 0 and 3660 then raise exception 'Duración o demora no válida';end if;
   p:=p||jsonb_build_object('duration_days',n,'lag_days',wait);
   if coalesce(p->>'activity_status','pending')<>'done' and nullif(p->>'actual_end','') is null then
    if jsonb_array_length(deps)>0 then
     select max((r->>'end')::date)+1 into start_day from jsonb_array_elements(result) r where r->>'id' in(select jsonb_array_elements_text(deps));
     start_day:=elite_private.work_add(start_day,wait,c);
    else start_day:=elite_private.work_next(case when coalesce((p->>'calendar_anchor')::boolean,false) then (c->>'anchor')::date else (p->>'start')::date end,c);end if;
    end_day:=elite_private.work_add(start_day,greatest(0,n-1),c);p:=p||jsonb_build_object('start',start_day,'end',end_day);
   end if;
   result:=result||jsonb_build_array(p);done:=array_append(done,p->>'id');changed:=true;
  end loop;
  if not changed then raise exception 'Dependencia ausente o circular';end if;
 end loop;
 select coalesce(jsonb_agg(r order by o.n),'[]') into ordered from jsonb_array_elements(rows) with ordinality o(p,n) join jsonb_array_elements(result) r on r->>'id'=o.p->>'id';result:=ordered;
 for lvl in reverse 3..1 loop
  select coalesce(jsonb_agg(case when coalesce(nullif(calendar_row->>'level','')::integer,1)=lvl and exists(select 1 from jsonb_array_elements(result) child where child->>'parent_id'=calendar_row->>'id') then calendar_row||jsonb_build_object('start',(select min(child->>'start') from jsonb_array_elements(result) child where child->>'parent_id'=calendar_row->>'id'),'end',(select max(child->>'end') from jsonb_array_elements(result) child where child->>'parent_id'=calendar_row->>'id')) else calendar_row end order by entries.calendar_pos),'[]') into result from jsonb_array_elements(result) with ordinality entries(calendar_row,calendar_pos);
 end loop;return result;
end $$;
create or replace function elite_private.gantt_work_calendar_guard() returns trigger language plpgsql set search_path='' as $$
declare expected jsonb;p jsonb;q jsonb;
begin
 if new.working_calendar is null then return new;end if;
 perform elite_private.work_calendar_validate(new.working_calendar);
 -- A calendar change and the following phase save share one protected RPC transaction.
 if tg_op='UPDATE' and new.phases is not distinct from old.phases and new.working_calendar is distinct from old.working_calendar then return new;end if;
 expected:=elite_private.gantt_schedule_working(new.phases,new.working_calendar);
 for p in select value from jsonb_array_elements(expected) loop
  select value into q from jsonb_array_elements(new.phases) where value->>'id'=p->>'id';
  if (q->>'start',q->>'end',q->>'duration_days') is distinct from (p->>'start',p->>'end',p->>'duration_days') then raise exception 'Fechas o duración no coinciden con el calendario laboral. Actualiza desde Gantt.';end if;
 end loop;return new;
end $$;
drop trigger if exists elite_work_calendar_guard on public.elite_work_plans;
create trigger elite_work_calendar_guard before insert or update on public.elite_work_plans for each row execute function elite_private.gantt_work_calendar_guard();
create or replace function public.elite_save_work_calendar(target_work uuid,expected_revision integer,new_calendar jsonb,new_phases jsonb,exception_reason text default '') returns public.elite_work_plans language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();p public.elite_work_plans;result public.elite_work_plans;scheduled jsonb;
begin
 if uid is null then raise exception 'Inicia sesión';end if;perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into p from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if expected_revision is distinct from coalesce(p.revision,0) then raise exception 'La planificación cambió. Actualiza antes de guardar.';end if;
 perform elite_private.work_calendar_validate(new_calendar);scheduled:=elite_private.gantt_schedule_working(new_phases,new_calendar);
 if exists(select 1 from jsonb_array_elements(scheduled) s join jsonb_array_elements(new_phases) original on original->>'id'=s->>'id' where (s->>'start',s->>'end',s->>'duration_days') is distinct from (original->>'start',original->>'end',original->>'duration_days')) then raise exception 'La propuesta no coincide con el calendario';end if;
 if p.work_id is not null then
  insert into public.elite_plan_versions(work_id,user_id,revision,snapshot) values(target_work,uid,p.revision,to_jsonb(p)||jsonb_build_object('linked_tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.elite_tasks t where t.user_id=uid and t.id::text in(select r->>'task_id' from jsonb_array_elements(p.phases) r)))) on conflict do nothing;
  update public.elite_work_plans set working_calendar=new_calendar where work_id=target_work;
 end if;
 result:=public.elite_save_gantt(target_work,scheduled,expected_revision,false,p.confirmed_at is not null,exception_reason);
 update public.elite_work_plans set working_calendar=new_calendar where work_id=target_work returning * into result;
 insert into public.elite_history(user_id,entity_id,entity_type,action,title,fields) values(uid,target_work,'elite_work_plans','Calendario laboral actualizado','Calendario de obra',jsonb_build_array('working_calendar','phases'));
 return result;
end $$;
revoke all on function public.elite_save_work_calendar(uuid,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.elite_save_work_calendar(uuid,integer,jsonb,jsonb,text) to authenticated;
revoke all on function elite_private.work_calendar_validate(jsonb),elite_private.work_day(date,jsonb),elite_private.work_next(date,jsonb),elite_private.work_add(date,integer,jsonb),elite_private.work_count(date,date,jsonb),elite_private.gantt_schedule_working(jsonb,jsonb),elite_private.gantt_work_calendar_guard() from public,anon,authenticated;
create or replace function elite_private.gantt_task_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare plan public.elite_work_plans;rows jsonb;p jsonb;result public.elite_work_plans;duration integer;old_start date;new_start date;old_flag text:=current_setting('elite.gantt_sync',true);
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

 if new.progress_pct is distinct from old.progress_pct then p:=p||jsonb_build_object('observations',(select coalesce(jsonb_agg(m),'[]') from jsonb_array_elements(coalesce(p->'observations','[]')) m where m->>'date'<>((now() at time zone 'Europe/Madrid')::date)::text)||case when new.progress_pct is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Europe/Madrid')::date,'percent',new.progress_pct)) end);end if;
 if old.status='done' and new.status<>'done' then
  p:=p||jsonb_build_object('observations',(select coalesce(jsonb_agg(m),'[]') from jsonb_array_elements(coalesce(p->'observations','[]')) m where m->>'date'<>((now() at time zone 'Europe/Madrid')::date)::text)||jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Europe/Madrid')::date,'percent',coalesce((select (m->>'percent')::numeric from jsonb_array_elements(coalesce(p->'observations','[]')) m where (m->>'percent')::numeric<100 order by m->>'date' desc limit 1),0))));
 end if;
 if new.status='done' and old.status<>'done' then p:=p||jsonb_build_object('observations',(select coalesce(jsonb_agg(m),'[]') from jsonb_array_elements(coalesce(p->'observations','[]')) m where m->>'date'<>((now() at time zone 'Europe/Madrid')::date)::text)||jsonb_build_array(jsonb_build_object('date',(now() at time zone 'Europe/Madrid')::date,'percent',100)));end if;
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
