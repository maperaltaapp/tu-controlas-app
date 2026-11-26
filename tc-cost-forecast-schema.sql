-- TU CONTROLAS · immutable economic snapshots for PM forecasts and approved cost baselines.
-- Additive only; does not rewrite, migrate or delete legacy offers/costs.
begin;
create table if not exists public.tc_cost_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  work_id uuid not null,
  snapshot_type text not null check(snapshot_type in ('offer','pm_initial','baseline','forecast')),
  as_of date not null,
  total_cost numeric(14,2) not null check(total_cost between 0 and 10000000000),
  forecast_revenue numeric(14,2) check(forecast_revenue > 0 and forecast_revenue <= 10000000000),
  actual_cost numeric(14,2) check(actual_cost between 0 and 10000000000),
  remaining_cost numeric(14,2) check(remaining_cost between 0 and 10000000000),
  activity_costs jsonb not null default '[]'::jsonb,
  approval_reference text check(length(approval_reference) <= 160),
  source_note text check(length(source_note) <= 300),
  created_at timestamptz not null default now(),
  foreign key(work_id,user_id) references public.elite_works(id,user_id) on delete cascade,
  constraint tc_cost_forecast_kind_check check(
    (
      snapshot_type in ('offer','pm_initial')
      and forecast_revenue is not null
      and actual_cost is null and remaining_cost is null
      and activity_costs = '[]'::jsonb and approval_reference is null
    ) or (
      snapshot_type = 'forecast'
      and forecast_revenue is not null
      and actual_cost is not null and remaining_cost is not null
      and abs(total_cost - (actual_cost + remaining_cost)) < 0.01
      and activity_costs = '[]'::jsonb and approval_reference is null
    ) or (
      snapshot_type = 'baseline'
      and total_cost > 0 and forecast_revenue is null
      and actual_cost is null and remaining_cost is null
      and approval_reference is not null and length(btrim(approval_reference)) > 0
      and jsonb_typeof(activity_costs) = 'array'
      and jsonb_array_length(activity_costs) > 0
    )
  )
);
create index if not exists tc_cost_forecast_owner_work_date
  on public.tc_cost_forecast_snapshots(user_id,work_id,as_of,created_at);
alter table public.tc_cost_forecast_snapshots enable row level security;
revoke all on public.tc_cost_forecast_snapshots from public,anon,authenticated;
grant select,insert on public.tc_cost_forecast_snapshots to authenticated;
grant all on public.tc_cost_forecast_snapshots to service_role;
drop policy if exists tc_cost_forecast_owner_read on public.tc_cost_forecast_snapshots;
create policy tc_cost_forecast_owner_read on public.tc_cost_forecast_snapshots
 for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists tc_cost_forecast_owner_insert on public.tc_cost_forecast_snapshots;
create policy tc_cost_forecast_owner_insert on public.tc_cost_forecast_snapshots
 for insert to authenticated with check ((select auth.uid()) = user_id);

-- Each approved baseline must cover exactly the current executable activities
-- and those activity IDs must also exist in the frozen schedule. No partial BAC.
create or replace function elite_private.tc_check_cost_baseline()
returns trigger language plpgsql security definer set search_path = '' as $
declare p record;line jsonb;item_id text;item_amount numeric;cost_sum numeric:=0;items integer:=0;leaves integer:=0;
begin
 if new.snapshot_type <> 'baseline' then return new; end if;
 -- A validated empty-account recovery must preserve historical baselines even
 -- when old activities are no longer in the CURRENT Gantt. The private
 -- restore context is written only by the owner-scoped transaction of the
 -- established V3/V4 recovery function, never by client roles.
 if new.user_id = auth.uid() and exists (
  select 1 from elite_private.tc_restore_context_v3 c
   where c.user_id=new.user_id and c.txid=pg_catalog.txid_current()
     and c.backend_pid=pg_catalog.pg_backend_pid()
 ) then return new; end if;
 select phases,baseline,baseline_at into p
 from public.elite_work_plans
 where work_id=new.work_id and user_id=new.user_id;
 if not found or p.baseline_at is null then
   raise exception 'Fija primero la línea base de fechas del Gantt.';
 end if;
 if jsonb_typeof(new.activity_costs) <> 'array' or jsonb_array_length(new.activity_costs)>100 then
   raise exception 'El presupuesto aprobado debe distribuirse por actividades.';
 end if;
 select count(*) into leaves
 from jsonb_array_elements(p.phases) a
 where not coalesce((a->>'is_group')::boolean,false)
   and not coalesce((a->>'milestone')::boolean,false)
   and not exists(select 1 from jsonb_array_elements(p.phases) child
                  where child->>'parent_id'=a->>'id');
 if leaves=0 or leaves<>jsonb_array_length(new.activity_costs) then
   raise exception 'La línea base de costes debe cubrir todas las partidas ejecutables.';
 end if;
 if (select count(distinct value->>'activity_id') from jsonb_array_elements(new.activity_costs)) <> leaves then
   raise exception 'Hay partidas económicas duplicadas o sin identificador.';
 end if;
 for line in select value from jsonb_array_elements(new.activity_costs) loop
   item_id:=nullif(line->>'activity_id','');
   if item_id is null or jsonb_typeof(line->'amount')<>'number' then
     raise exception 'Partida o importe no válido.';
   end if;
   item_amount:=(line->>'amount')::numeric;
   if item_amount<0 or item_amount>10000000000 then
     raise exception 'Importe de partida no válido.';
   end if;
   if not exists(
     select 1 from jsonb_array_elements(p.phases) a
     where a->>'id'=item_id
       and not coalesce((a->>'is_group')::boolean,false)
       and not coalesce((a->>'milestone')::boolean,false)
       and not exists(select 1 from jsonb_array_elements(p.phases) child where child->>'parent_id'=item_id)
   ) or not exists(select 1 from jsonb_array_elements(p.baseline) b where b->>'id'=item_id) then
     raise exception 'Partida no incluida en el Gantt de esta obra y su línea base.';
   end if;
   cost_sum:=cost_sum+item_amount;items:=items+1;
 end loop;
 if abs(cost_sum-new.total_cost)>.01 then
   raise exception 'El total aprobado no coincide con la suma de partidas.';
 end if;
 return new;
end $$;
revoke all on function elite_private.tc_check_cost_baseline() from public,anon,authenticated;
drop trigger if exists tc_cost_forecast_baseline_guard on public.tc_cost_forecast_snapshots;
create trigger tc_cost_forecast_baseline_guard before insert on public.tc_cost_forecast_snapshots
 for each row execute function elite_private.tc_check_cost_baseline();

-- Immutable history: UPDATE and DELETE are not granted, and no broad owner policy.
-- Depends on the existing private context of tc_restore_empty_owner_v3 in the
-- configured TU CONTROLAS Supabase project. Verify before migration.
-- New revisions are INSERTs; reverting the frontend never removes saved snapshots.
commit;
