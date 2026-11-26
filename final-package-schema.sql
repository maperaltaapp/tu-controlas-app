-- Additive UI metadata on existing owner-scoped tables. No existing row is rewritten.
begin;
alter table public.elite_works add column if not exists workspace_layout jsonb;
alter table public.elite_work_checklist_items add column if not exists cell_values jsonb;
alter table public.elite_work_contractors add column if not exists cell_values jsonb;
alter table public.elite_works add constraint tc_workspace_layout_size check
 (workspace_layout is null or (jsonb_typeof(workspace_layout)='object' and octet_length(workspace_layout::text)<=150000));
alter table public.elite_work_checklist_items add constraint tc_checklist_cells_size check
 (cell_values is null or (jsonb_typeof(cell_values)='object' and octet_length(cell_values::text)<=50000));
alter table public.elite_work_contractors add constraint tc_provider_cells_size check
 (cell_values is null or (jsonb_typeof(cell_values)='object' and octet_length(cell_values::text)<=50000));
alter table public.elite_work_checklist_items drop constraint elite_work_checklist_items_section_check;
alter table public.elite_work_checklist_items add constraint elite_work_checklist_items_section_check
 check(section in ('prep','providers','execution','close') or section ~ '^custom_[a-f0-9-]{36}$');

-- Set a manual cell total, preserving all source rows. Imported cells are immutable here.
-- SECURITY INVOKER retains owner RLS and composite foreign-key checks.
create or replace function public.tc_set_manual_cost(target_work uuid,target_activity text,
 target_kind text,expected_rows jsonb,new_total numeric) returns numeric
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); current_rows jsonb; first_id uuid;
begin
 if uid is null then raise exception 'Inicia sesión.';end if;
 if target_kind not in ('budget','actual','contract','certified') or new_total is null
  or new_total<0 or new_total>10000000000 or new_total<>round(new_total,2) then raise exception 'Importe no válido.';end if;
 perform 1 from public.elite_works where id=target_work and user_id=uid for update;
 if not found then raise exception 'Obra no disponible.';end if;
 perform 1 from public.elite_work_economic_entries where work_id=target_work and user_id=uid
  and activity_id is not distinct from target_activity and kind=target_kind for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'source_name',source_name)
  order by id),'[]'::jsonb),min(id::text)::uuid into current_rows,first_id
 from public.elite_work_economic_entries where work_id=target_work and user_id=uid
  and activity_id is not distinct from target_activity and kind=target_kind;
 if current_rows is distinct from expected_rows then raise exception 'Los costes cambiaron. Actualiza antes de editar.';end if;
 if exists(select 1 from public.elite_work_economic_entries where work_id=target_work and user_id=uid
  and activity_id is not distinct from target_activity and kind=target_kind and source_name<>'Entrada manual')
  then raise exception 'Los importes procedentes de documentos no se editan manualmente.';end if;
 if first_id is null then
  insert into public.elite_work_economic_entries(work_id,activity_id,kind,amount,source_name,source_line)
   values(target_work,target_activity,target_kind,new_total,'Entrada manual',gen_random_uuid()::text);
 else
  update public.elite_work_economic_entries set amount=case when id=first_id then new_total else 0 end
   where work_id=target_work and user_id=uid and activity_id is not distinct from target_activity and kind=target_kind;
 end if;
 return new_total;
end $$;
revoke all on function public.tc_set_manual_cost(uuid,text,text,jsonb,numeric) from public,anon;
grant execute on function public.tc_set_manual_cost(uuid,text,text,jsonb,numeric) to authenticated;
commit;
