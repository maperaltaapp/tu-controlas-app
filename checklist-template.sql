-- Atomic owner-scoped copy of a checklist structure, not its operational data.
begin;
create or replace function public.tc_copy_checklist_template(source_work uuid,source_section text,target_work uuid,target_section text,expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); src public.elite_works%rowtype; dst public.elite_works%rowtype;
 next_layout jsonb; source_sheet jsonb; sheet_map jsonb; type_map jsonb; dest_section text:=target_section;
 copied jsonb:='[]'::jsonb; source_name text; provider_mode boolean:=source_section='providers';
begin
 if uid is null or source_work is null or target_work is null or source_work=target_work or source_section is null then raise exception 'Selecciona dos obras de tu cuenta.';end if;
 select * into src from public.elite_works where id=source_work and user_id=uid;
 if not found then raise exception 'Plantilla no disponible.';end if;
 select * into dst from public.elite_works where id=target_work and user_id=uid and archived_at is null for update;
 if not found or dst.updated_at is distinct from expected_updated_at then raise exception 'La obra de destino cambió. Actualiza antes de copiar.';end if;
 if source_section not in ('prep','providers','execution','close') and
  (source_section !~ '^custom_[a-f0-9-]{36}$' or not coalesce((src.workspace_layout->'checklist_types') ? source_section,false)) then raise exception 'Plantilla no disponible.';end if;
 next_layout:=coalesce(dst.workspace_layout,'{}'::jsonb);
 if provider_mode then
  if dest_section is distinct from 'providers' then raise exception 'El formato de proveedores solo se puede copiar al cuadro de proveedores.';end if;
  if exists(select 1 from public.elite_work_contractors where work_id=target_work and user_id=uid) then raise exception 'El cuadro de proveedores ya contiene registros.';end if;
 elsif dest_section is null then
  type_map:=case when jsonb_typeof(next_layout->'checklist_types')='object' then next_layout->'checklist_types' else '{}'::jsonb end;
  if (select count(*) from jsonb_object_keys(type_map))+
     (select count(*) from jsonb_object_keys(case when jsonb_typeof(next_layout->'archived_checklist_types')='object' then next_layout->'archived_checklist_types' else '{}'::jsonb end))>=20 then raise exception 'Máximo 20 tipos adicionales por obra.';end if;
  source_name:=coalesce(nullif(btrim(src.workspace_layout->'checklist_type_labels'->>source_section),''),nullif(btrim(src.workspace_layout->'checklist_types'->>source_section),''),case source_section when 'prep' then 'Planificación' when 'execution' then 'Control de ejecución' when 'close' then 'Cierre de obra' else 'Checklist' end);
  dest_section:='custom_'||gen_random_uuid()::text;
  next_layout:=jsonb_set(next_layout,'{checklist_types}',type_map||jsonb_build_object(dest_section,left(source_name,100)),true);
 elsif dest_section not in ('prep','execution','close') and
  (dest_section !~ '^custom_[a-f0-9-]{36}$' or not coalesce((dst.workspace_layout->'checklist_types') ? dest_section,false)) then raise exception 'Checklist de destino no disponible.';
 end if;
 if not provider_mode and exists(select 1 from public.elite_work_checklist_items where work_id=target_work and user_id=uid and section=dest_section) then raise exception 'El checklist de destino ya contiene filas. Actualiza antes de copiar.';end if;
 source_sheet:=src.workspace_layout->'sheets'->source_section;
 sheet_map:=case when jsonb_typeof(next_layout->'sheets')='object' then next_layout->'sheets' else '{}'::jsonb end;
 -- Only the layout keys understood by the renderer are copied, not cell values.
 next_layout:=jsonb_set(next_layout,'{sheets}',sheet_map||jsonb_build_object(dest_section,jsonb_strip_nulls(jsonb_build_object('columns',source_sheet->'columns','hidden_columns',source_sheet->'hidden_columns','widths',source_sheet->'widths','scale',source_sheet->'scale'))),true);
 update public.elite_works set workspace_layout=next_layout where id=target_work and user_id=uid returning * into dst;
 if not found then raise exception 'No se pudo guardar la plantilla.';end if;
 if not provider_mode then
  with inserted as (
   insert into public.elite_work_checklist_items(user_id,work_id,section,title,position)
   select uid,target_work,dest_section,i.title,row_number() over(order by i.position,i.created_at,i.id)-1
   from public.elite_work_checklist_items i where i.user_id=uid and i.work_id=source_work and i.section=source_section
   returning *
  ) select coalesce(jsonb_agg(to_jsonb(inserted) order by position),'[]'::jsonb) into copied from inserted;
 end if;
 return jsonb_build_object('work',to_jsonb(dst),'section',dest_section,'rows',copied);
end $$;
revoke all on function public.tc_copy_checklist_template(uuid,text,uuid,text,timestamptz) from public,anon;
grant execute on function public.tc_copy_checklist_template(uuid,text,uuid,text,timestamptz) to authenticated;
commit;
