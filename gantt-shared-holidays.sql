-- Common holidays are private to each account; work exceptions take precedence.
begin;
create table if not exists public.elite_holiday_calendars(user_id uuid primary key references auth.users(id) on delete cascade,revision integer not null default 1 check(revision>0),exceptions jsonb not null,updated_at timestamptz not null default now());
alter table public.elite_holiday_calendars enable row level security;
drop policy if exists holiday_owner_select on public.elite_holiday_calendars;
create policy holiday_owner_select on public.elite_holiday_calendars for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.elite_holiday_calendars from public,anon,authenticated;
grant select on public.elite_holiday_calendars to authenticated;
create or replace function elite_private.official_holidays() returns jsonb language sql immutable set search_path='' as $official$ select '[{"date":"2026-01-01","name":"Año Nuevo","working":false},{"date":"2026-01-06","name":"Epifanía del Señor","working":false},{"date":"2026-03-19","name":"San José","working":false},{"date":"2026-04-03","name":"Viernes Santo","working":false},{"date":"2026-04-06","name":"Lunes de Pascua","working":false},{"date":"2026-05-01","name":"Fiesta del Trabajo","working":false},{"date":"2026-06-24","name":"San Juan","working":false},{"date":"2026-08-15","name":"Asunción de la Virgen","working":false},{"date":"2026-10-09","name":"Día de la Comunitat Valenciana","working":false},{"date":"2026-10-12","name":"Fiesta Nacional de España","working":false},{"date":"2026-12-08","name":"Inmaculada Concepción","working":false},{"date":"2026-12-25","name":"Navidad","working":false},{"date":"2027-01-01","name":"Año Nuevo","working":false},{"date":"2027-01-06","name":"Epifanía del Señor","working":false},{"date":"2027-03-19","name":"San José","working":false},{"date":"2027-03-26","name":"Viernes Santo","working":false},{"date":"2027-03-29","name":"Lunes de Pascua","working":false},{"date":"2027-05-01","name":"Fiesta del Trabajo","working":false},{"date":"2027-10-09","name":"Día de la Comunitat Valenciana","working":false},{"date":"2027-10-12","name":"Fiesta Nacional de España","working":false},{"date":"2027-11-01","name":"Todos los Santos","working":false},{"date":"2027-12-06","name":"Día de la Constitución","working":false},{"date":"2027-12-08","name":"Inmaculada Concepción","working":false},{"date":"2027-12-25","name":"Navidad","working":false}]'::jsonb $official$;
create or replace function elite_private.shared_calendar(c jsonb,anchor_date date,owner_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare common jsonb;local_days jsonb;merged jsonb;rev integer;result jsonb;
begin
 select exceptions,revision into common,rev from public.elite_holiday_calendars where user_id=owner_id;
 common:=coalesce(common,elite_private.official_holidays());rev:=coalesce(rev,0);
 local_days:=coalesce(c->'local_exceptions',c->'exceptions','[]');
 select coalesce(jsonb_agg(e order by e->>'date'),'[]') into merged from (select distinct on (e->>'date') e from (select value e,0 priority from jsonb_array_elements(common) union all select value,1 from jsonb_array_elements(local_days)) entries order by e->>'date',priority desc) chosen;
 result:=jsonb_build_object('anchor',coalesce(c->>'anchor',anchor_date::text),'weekdays',coalesce(c->'weekdays','[1,2,3,4,5]'),'exceptions',merged,'inherit_holidays',true,'holiday_revision',rev,'local_exceptions',(select coalesce(jsonb_agg(value order by value->>'date'),'[]') from jsonb_array_elements(local_days)));
 perform elite_private.work_calendar_validate(result);return result;
end $$;
create or replace function elite_private.gantt_work_calendar_guard() returns trigger language plpgsql set search_path='' as $$
declare expected jsonb;p jsonb;q jsonb;
begin
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
end $$;
create or replace function public.elite_save_work_calendar(target_work uuid,expected_revision integer,new_calendar jsonb,new_phases jsonb,exception_reason text default '') returns public.elite_work_plans language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();p public.elite_work_plans;result public.elite_work_plans;scheduled jsonb;
begin
 if uid is null then raise exception 'Inicia sesión';end if;perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into p from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if expected_revision is distinct from coalesce(p.revision,0) then raise exception 'La planificación cambió. Actualiza antes de guardar.';end if;
 if coalesce((new_calendar->>'inherit_holidays')::boolean,false) and new_calendar is distinct from elite_private.shared_calendar(new_calendar,(new_calendar->>'anchor')::date,uid) then raise exception 'Los festivos comunes cambiaron. Actualiza antes de guardar.';end if;
 if not coalesce((new_calendar->>'inherit_holidays')::boolean,false) then new_calendar:=elite_private.shared_calendar(new_calendar,(new_calendar->>'anchor')::date,uid);end if;
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

create or replace function public.elite_save_shared_holidays(new_exceptions jsonb,expected_revision integer,expected_plans jsonb default null,simulate boolean default true,exception_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();common public.elite_holiday_calendars;actual_plans jsonb;proposals jsonb:='[]';item record;c jsonb;rows jsonb;row_item jsonb;first_id text;proposal jsonb;conflicts jsonb;old_resources jsonb;new_resources jsonb;result jsonb;old_shared jsonb;new_rev integer;
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 if simulate is null then raise exception 'Indica si es vista previa';end if;exception_reason:=coalesce(exception_reason,'');if length(exception_reason)>2000 then raise exception 'Motivo demasiado largo';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 perform 1 from public.elite_works where user_id=uid and archived_at is null order by id for update;
 select * into common from public.elite_holiday_calendars where user_id=uid for update;
 if expected_revision is distinct from coalesce(common.revision,0) then raise exception 'Los festivos cambiaron. Actualiza antes de guardar.';end if;
 perform elite_private.work_calendar_validate(jsonb_build_object('anchor','2026-01-01','weekdays','[1,2,3,4,5]'::jsonb,'exceptions',new_exceptions));
 select coalesce(jsonb_object_agg(p.work_id::text,p.revision),'{}') into actual_plans from public.elite_work_plans p join public.elite_works w on w.id=p.work_id where p.user_id=uid and w.archived_at is null;
 if not simulate and expected_plans is distinct from actual_plans then raise exception 'Las obras cambiaron. Vuelve a ver los cambios de fechas.';end if;
 -- Build against the requested common holidays without persisting during preview.
 new_rev:=coalesce(common.revision,0)+1;
 for item in select p.*,w.name,w.start_date from public.elite_work_plans p join public.elite_works w on w.id=p.work_id where p.user_id=uid and w.archived_at is null order by p.work_id for update of p loop
  c:=elite_private.shared_calendar(coalesce(item.working_calendar,jsonb_build_object('weekdays','[0,1,2,3,4,5,6]'::jsonb,'exceptions','[]'::jsonb)),coalesce((select min((value->>'start')::date) from jsonb_array_elements(item.phases)),item.start_date,current_date),uid);
  select coalesce(jsonb_agg(e order by e->>'date'),'[]') into old_shared from (select distinct on (e->>'date') e from (select value e,0 priority from jsonb_array_elements(new_exceptions) union all select value,1 from jsonb_array_elements(c->'local_exceptions')) entries order by e->>'date',priority desc) chosen;
  c:=c||jsonb_build_object('exceptions',old_shared,'holiday_revision',new_rev);
  rows:='[]';first_id:=null;
  for row_item in select value from jsonb_array_elements(item.phases) loop
   if not exists(select 1 from jsonb_array_elements(item.phases) child where child->>'parent_id'=row_item->>'id') then
    if item.working_calendar is null then row_item:=row_item||jsonb_build_object('duration_days',case when coalesce((row_item->>'milestone')::boolean,false) then 0 else (row_item->>'end')::date-(row_item->>'start')::date+1 end);end if;
    if first_id is null and jsonb_array_length(coalesce(row_item->'depends_on','[]'))=0 then first_id:=row_item->>'id';if item.working_calendar is null then row_item:=row_item||jsonb_build_object('calendar_anchor',true);end if;end if;
   end if;
   rows:=rows||jsonb_build_array(row_item);
  end loop;
  rows:=elite_private.gantt_schedule_working(rows,c);
  proposals:=proposals||jsonb_build_array(jsonb_build_object('id',item.work_id,'name',item.name,'revision',item.revision,'calendar',c,'phases',rows,'moved',(select coalesce(jsonb_agg(jsonb_build_object('id',n->>'id','name',n->>'name','old_start',o->>'start','old_end',o->>'end','start',n->>'start','end',n->>'end')),'[]') from jsonb_array_elements(rows) n join jsonb_array_elements(item.phases) o on o->>'id'=n->>'id' where (n->>'start',n->>'end') is distinct from (o->>'start',o->>'end'))));
 end loop;
 result:=jsonb_build_object('revision',new_rev,'exceptions',new_exceptions,'expected_plans',actual_plans,'works',proposals);
 if simulate then return result;end if;
 -- Validate final combined resource dates, not intermediate per-work updates.
 with intervals as (select p->>'id' work_id,(f->>'contractor_id')::uuid contractor_id,(f->>'start')::date starts,(f->>'end')::date ends from jsonb_array_elements(proposals) p cross join lateral jsonb_array_elements(p->'phases') f where nullif(f->>'contractor_id','') is not null), checks as (select i.contractor_id,i.starts,array_agg(distinct a.work_id) works,c.capacity from intervals i join intervals a on a.contractor_id=i.contractor_id and a.starts<=i.starts and a.ends>=i.starts join public.elite_contractors c on c.id=i.contractor_id and c.user_id=uid group by i.contractor_id,i.starts,c.capacity) select coalesce(jsonb_agg(to_jsonb(checks)),'[]') into conflicts from checks where cardinality(works)>capacity;
 select coalesce(jsonb_agg(jsonb_build_array(p->>'id',f->>'id',f->>'contractor_id',f->>'start',f->>'end') order by p->>'id',f->>'id'),'[]') into new_resources from jsonb_array_elements(proposals) p cross join lateral jsonb_array_elements(p->'phases') f where nullif(f->>'contractor_id','') is not null;
 select coalesce(jsonb_agg(jsonb_build_array(p.work_id,f->>'id',f->>'contractor_id',f->>'start',f->>'end') order by p.work_id,f->>'id'),'[]') into old_resources from public.elite_work_plans p join public.elite_works w on w.id=p.work_id cross join lateral jsonb_array_elements(p.phases) f where p.user_id=uid and w.archived_at is null and nullif(f->>'contractor_id','') is not null;
 if conflicts<>'[]' and old_resources is distinct from new_resources and length(btrim(exception_reason))=0 then raise exception 'CAPACITY_CONFLICT' using detail=conflicts::text;end if;
 insert into public.elite_holiday_calendars(user_id,revision,exceptions) values(uid,new_rev,new_exceptions) on conflict(user_id) do update set revision=excluded.revision,exceptions=excluded.exceptions,updated_at=now();
 for proposal in select value from jsonb_array_elements(proposals) loop
  perform public.elite_save_work_calendar((proposal->>'id')::uuid,(proposal->>'revision')::integer,proposal->'calendar',proposal->'phases','Festivos comunes; capacidad final verificada. '||exception_reason);
 end loop;
 insert into public.elite_history(user_id,entity_id,entity_type,action,title,fields) values(uid,uid,'elite_holiday_calendars','Festivos comunes actualizados','Festivos de España y Comunidad Valenciana',jsonb_build_array('exceptions','revision'));
 return result;
end $$;
revoke all on function public.elite_save_shared_holidays(jsonb,integer,jsonb,boolean,text) from public,anon;
grant execute on function public.elite_save_shared_holidays(jsonb,integer,jsonb,boolean,text) to authenticated;
revoke all on function elite_private.official_holidays(),elite_private.shared_calendar(jsonb,date,uuid) from public,anon,authenticated;

-- Keep the existing canonical task synchronization and baseline behavior.
do $clone$ declare definition text;begin
 if to_regprocedure('elite_private.save_gantt_core(uuid,jsonb,integer,boolean,boolean,text)') is null then
  definition:=pg_get_functiondef('public.elite_save_gantt(uuid,jsonb,integer,boolean,boolean,text)'::regprocedure);
  execute replace(definition,'FUNCTION public.elite_save_gantt(', 'FUNCTION elite_private.save_gantt_core(');
 end if;
end $clone$;
revoke all on function elite_private.save_gantt_core(uuid,jsonb,integer,boolean,boolean,text) from public,anon,authenticated;
create or replace function public.elite_save_gantt(target_work uuid,new_phases jsonb,expected_revision integer,freeze_baseline boolean default false,confirm_work boolean default false,exception_reason text default '') returns public.elite_work_plans language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();old_plan public.elite_work_plans;c jsonb;result public.elite_work_plans;
begin
 if uid is null then raise exception 'Inicia sesión';end if;perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not exists(select 1 from public.elite_works where id=target_work and user_id=uid and archived_at is null) then raise exception 'Obra no encontrada';end if;
 select * into old_plan from public.elite_work_plans where work_id=target_work and user_id=uid for update;
 if expected_revision is distinct from coalesce(old_plan.revision,0) then raise exception 'La planificación cambió. Actualiza antes de guardar.';end if;
 -- Old clients without duration fields retain legacy behavior; current clients always inherit defaults.
 if (old_plan.working_calendar is null or not coalesce((old_plan.working_calendar->>'inherit_holidays')::boolean,false)) and jsonb_array_length(new_phases)>0 and not exists(select 1 from jsonb_array_elements(new_phases) f where not exists(select 1 from jsonb_array_elements(new_phases) child where child->>'parent_id'=f->>'id') and f->>'duration_days' is null) then
  c:=elite_private.shared_calendar(coalesce(old_plan.working_calendar,case when jsonb_array_length(coalesce(old_plan.phases,'[]'))>0 then jsonb_build_object('weekdays','[0,1,2,3,4,5,6]'::jsonb,'exceptions','[]'::jsonb) end),(select min((value->>'start')::date) from jsonb_array_elements(new_phases)),uid);
  if old_plan.work_id is not null then
   insert into public.elite_plan_versions(work_id,user_id,revision,snapshot) values(target_work,uid,old_plan.revision,to_jsonb(old_plan)||jsonb_build_object('linked_tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.elite_tasks t where t.user_id=uid and t.id::text in(select r->>'task_id' from jsonb_array_elements(old_plan.phases) r)))) on conflict do nothing;
   update public.elite_work_plans set working_calendar=c where work_id=target_work;
  end if;
 end if;
 result:=elite_private.save_gantt_core(target_work,new_phases,expected_revision,freeze_baseline,confirm_work,exception_reason);
 if c is not null then update public.elite_work_plans set working_calendar=c where work_id=target_work returning * into result;end if;
 return result;
end $$;
revoke all on function public.elite_save_gantt(uuid,jsonb,integer,boolean,boolean,text) from public,anon;
grant execute on function public.elite_save_gantt(uuid,jsonb,integer,boolean,boolean,text) to authenticated;
commit;
