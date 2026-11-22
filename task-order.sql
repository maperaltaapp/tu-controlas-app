-- Per-user presentation order. Task/checklist dates and contents remain canonical.
begin;
create table public.elite_task_orders (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 group_key text not null check(group_key in ('today','overdue','future','undated')),
 revision integer not null check(revision>0),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=2000),
 updated_at timestamptz not null default now(),
 primary key(user_id,group_key)
);
alter table public.elite_task_orders enable row level security;
create policy task_orders_owner on public.elite_task_orders for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.elite_task_orders from public,anon,authenticated;
grant select on public.elite_task_orders to authenticated;
create function public.elite_save_task_order(target_group text,new_order jsonb,expected_revision integer) returns public.elite_task_orders language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();saved public.elite_task_orders;item jsonb;ref text;item_id uuid;day date;today date:=(now() at time zone 'Europe/Madrid')::date;actual_group text;
begin
 if uid is null then raise exception 'Inicia sesión';end if;
 if target_group is null or target_group not in ('today','overdue','future','undated') then raise exception 'Grupo no disponible para ordenar';end if;
 if jsonb_typeof(new_order) is distinct from 'array' or jsonb_array_length(new_order)>2000 or octet_length(new_order::text)>100000 then raise exception 'Orden no válido';end if;
 if (select count(*)<>count(distinct value) from jsonb_array_elements(new_order)) then raise exception 'No repitas tareas en el orden';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into saved from public.elite_task_orders where user_id=uid and group_key=target_group for update;
 if coalesce(saved.revision,0) is distinct from expected_revision then raise exception 'El orden cambió en otro dispositivo. Actualiza antes de mover.';end if;
 for item in select value from jsonb_array_elements(new_order) loop
  if jsonb_typeof(item)<>'string' then raise exception 'Referencia no válida';end if;
  ref:=item#>>'{}';
  if ref !~ '^(task|checklist):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Referencia no válida';end if;
  item_id:=split_part(ref,':',2)::uuid;
  if split_part(ref,':',1)='task' then
   select (coalesce(t.due_at,t.start_at) at time zone 'Europe/Madrid')::date into day from public.elite_tasks t
   where t.id=item_id and t.user_id=uid and not t.completed and t.deleted_at is null and coalesce(t.stage,'')<>'Gantt'
   and (t.work_id is null or exists(select 1 from public.elite_works w where w.id=t.work_id and w.user_id=uid and w.archived_at is null));
  else
   select c.due_date into day from public.elite_work_checklist_items c join public.elite_works w on w.id=c.work_id and w.user_id=c.user_id
   where c.id=item_id and c.user_id=uid and c.completed_at is null and c.due_date is not null and w.archived_at is null;
  end if;
  if not found then raise exception 'La tarea ya no está disponible en este grupo';end if;
  actual_group:=case when day is null then 'undated' when day<today then 'overdue' when day>today then 'future' else 'today' end;
  if actual_group<>target_group then raise exception 'Las fechas cambiaron. Actualiza antes de ordenar.';end if;
 end loop;
 insert into public.elite_task_orders(user_id,group_key,revision,items) values(uid,target_group,coalesce(saved.revision,0)+1,new_order)
 on conflict(user_id,group_key) do update set revision=excluded.revision,items=excluded.items,updated_at=now() returning * into saved;
 return saved;
end $$;
revoke all on function public.elite_save_task_order(text,jsonb,integer) from public,anon;
grant execute on function public.elite_save_task_order(text,jsonb,integer) to authenticated;
commit;
