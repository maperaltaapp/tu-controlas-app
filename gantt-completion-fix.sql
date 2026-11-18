-- Compatible hotfix for the currently published UI. No data migration.
begin;
CREATE OR REPLACE FUNCTION elite_private.gantt_schedule(rows jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $schedule$
declare result jsonb:='[]';ordered jsonb;done text[]:='{}';p jsonb;deps jsonb;earliest date;duration integer;lag integer;changed boolean;lvl integer;
begin
 while cardinality(done)<jsonb_array_length(rows) loop
  changed:=false;
  for p in select value from jsonb_array_elements(rows) loop
   if p->>'id'=any(done) then continue;end if;
   deps:=coalesce(p->'depends_on','[]');
   if exists(select 1 from jsonb_array_elements_text(deps) d where not d=any(done)) then continue;end if;
   duration:=(p->>'end')::date-(p->>'start')::date;lag:=coalesce((p->>'lag_days')::integer,0);
   if jsonb_array_length(deps)>0 then
    select max((r->>'end')::date)+1+lag into earliest from jsonb_array_elements(result) r where r->>'id' in(select jsonb_array_elements_text(deps));
    p:=p||jsonb_build_object('start',earliest,'end',earliest+duration);
   end if;
   result:=result||jsonb_build_array(p);done:=array_append(done,p->>'id');changed:=true;
  end loop;
  if not changed then raise exception 'Dependencia ausente o circular';end if;
 end loop;
 select coalesce(jsonb_agg(r order by o.n),'[]') into ordered from jsonb_array_elements(rows) with ordinality o(p,n) join jsonb_array_elements(result) r on r->>'id'=o.p->>'id';
 result:=ordered;
 for lvl in reverse 3..1 loop
  select coalesce(jsonb_agg(case when coalesce(nullif(activity_row->>'level','')::integer,1)=lvl and exists(select 1 from jsonb_array_elements(result) child where child->>'parent_id'=activity_row->>'id') then
   activity_row||jsonb_build_object('is_group',true,'weight',0,'milestone',false,'task_id',null,'contractor_id',null,'observations','[]'::jsonb,'economic_observations','[]'::jsonb,'budget',null,'actual_start',null,'actual_end',null,'depends_on','[]'::jsonb,'start',(select min((child->>'start')::date) from jsonb_array_elements(result) child where child->>'parent_id'=activity_row->>'id'),'end',(select max((child->>'end')::date) from jsonb_array_elements(result) child where child->>'parent_id'=activity_row->>'id'))
   else activity_row end order by activity_pos),'[]') into result from jsonb_array_elements(result) with ordinality as activity_item(activity_row,activity_pos);
 end loop;
 return result;
end $schedule$;
REVOKE ALL ON FUNCTION elite_private.gantt_schedule(jsonb) FROM public,anon,authenticated;

create or replace function elite_private.gantt_task_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare plan public.elite_work_plans;rows jsonb;p jsonb;result public.elite_work_plans;duration integer;old_start date;new_start date;old_flag text:=current_setting('elite.gantt_sync',true);
begin
 if old_flag='on' or (new.title,new.start_at,new.due_at,new.status,new.progress_pct,new.work_id,new.deleted_at) is not distinct from (old.title,old.start_at,old.due_at,old.status,old.progress_pct,old.work_id,old.deleted_at) then return new;end if;
 select * into plan from public.elite_work_plans where user_id=new.user_id and exists(select 1 from jsonb_array_elements(phases) linked where linked->>'task_id'=new.id::text) for update;
 if not found then return new;end if;
 if new.work_id is distinct from old.work_id or new.deleted_at is distinct from old.deleted_at then raise exception 'Desvincula la tarea del Gantt antes de moverla o archivarla';end if;
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
 if jsonb_array_length(coalesce(p->'depends_on','[]'))>0 then
 select max((q->>'end')::date)+1 into old_start from jsonb_array_elements(plan.phases) q where q->>'id' in(select jsonb_array_elements_text(p->'depends_on'));
 if (p->>'start')::date<old_start then raise exception 'La fecha incumple una dependencia. Modifica la planificación desde Gantt';end if;
 p:=p||jsonb_build_object('lag_days',(p->>'start')::date-old_start);
 end if;
 end if;
 if nullif(p->>'task_id','') is not null then p:=p||jsonb_build_object('task_updated_at',(select updated_at from public.elite_tasks where id=(p->>'task_id')::uuid));end if;
 rows:=rows||jsonb_build_array(p);
 end loop;
 rows:=elite_private.gantt_schedule(rows);
 result:=public.elite_save_gantt(plan.work_id,rows,plan.revision,false,plan.confirmed_at is not null,'');
 return new;
end $$;
revoke all on function elite_private.gantt_task_changed() from public,anon,authenticated;
commit;
