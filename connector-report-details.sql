-- Update descriptive report fields without changing its physical measurements.
begin;
create or replace function public.tc_update_report_details(target_report uuid,expected_updated_at timestamptz,changes jsonb)
returns public.elite_daily_reports language plpgsql security invoker set search_path='' as $$
declare saved public.elite_daily_reports;previous_setting text:=current_setting('elite.daily_report_sync',true);
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if jsonb_typeof(changes) is distinct from 'object' or changes='{}'::jsonb or
  exists(select 1 from jsonb_object_keys(changes) k where k not in ('notes','progress_note','labor','machines')) then
  raise exception 'Campos no permitidos';
 end if;
 select r.* into saved from public.elite_daily_reports r join public.elite_works w on w.id=r.work_id and w.user_id=r.user_id
 where r.id=target_report and r.user_id=auth.uid() and w.archived_at is null for update of r;
 if not found or saved.updated_at is distinct from expected_updated_at then raise exception 'El parte cambió o no está disponible. Consulta antes de guardar.';end if;
 if (changes ? 'notes' and jsonb_typeof(changes->'notes') is distinct from 'string') or
  (changes ? 'progress_note' and jsonb_typeof(changes->'progress_note') is distinct from 'string') then raise exception 'Texto no válido';end if;
 perform set_config('elite.daily_report_sync','on',true);
 update public.elite_daily_reports set notes=case when changes ? 'notes' then changes->>'notes' else notes end,
 progress_note=case when changes ? 'progress_note' then changes->>'progress_note' else progress_note end,
 labor=case when changes ? 'labor' then changes->'labor' else labor end,
 machines=case when changes ? 'machines' then changes->'machines' else machines end
 where id=target_report and user_id=auth.uid() returning * into saved;
 perform set_config('elite.daily_report_sync',coalesce(previous_setting,''),true);
 return saved;
end $$;
revoke all on function public.tc_update_report_details(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.tc_update_report_details(uuid,timestamptz,jsonb) to authenticated;
commit;
