-- Retire obsolete external-board integration metadata, preserving every work/task.
-- Execute only after publishing the frontend that no longer reads these columns.
-- Transactional and deliberately no CASCADE, no DELETE FROM works/tasks.
begin;
create or replace function pg_temp.tc_retire_meta(value jsonb)
returns jsonb language plpgsql as $body$
declare result jsonb; k text; v jsonb;
begin
 if value is null then return null; end if;
 if jsonb_typeof(value)='object' then
  result:='{}'::jsonb;
  for k,v in select key, val from jsonb_each(value) as e(key,val) loop
   if lower(k)='trello_id' then continue; end if;
   if lower(k) in ('source_url','url') and jsonb_typeof(v)='string'
    and v #>> '{}' ilike '%trello%' then
    v:='""'::jsonb;
   else
    v:=pg_temp.tc_retire_meta(v);
   end if;
   result:=result||jsonb_build_object(k,v);
  end loop;
  return result;
 elsif jsonb_typeof(value)='array' then
  return coalesce((select jsonb_agg(pg_temp.tc_retire_meta(e.value) order by e.pos)
    from jsonb_array_elements(value) with ordinality as e(value,pos)),'[]'::jsonb);
 else
  return value;
 end if;
end $body$;

-- Never remove the original work or task, only its former provider identifiers.
update public.elite_tasks set source_url='' where source_url ilike '%trello%';
update public.elite_plan_versions
 set snapshot=pg_temp.tc_retire_meta(snapshot)
 where snapshot::text ilike '%trello_id%' or snapshot::text ilike '%trello.com%';
update public.elite_history
 set title=regexp_replace(title,'trello','servicio anterior','gi')
 where title ilike '%trello%';
update public.elite_history
 set fields=pg_temp.tc_retire_meta(fields)
 where fields::text ilike '%trello_id%' or fields::text ilike '%trello.com%';

-- RESTRICT intentionally fails atomically if other schema objects still need the fields.
alter table public.elite_tasks drop column if exists trello_id restrict;
alter table public.elite_works drop column if exists trello_id restrict;

drop function pg_temp.tc_retire_meta(jsonb);
commit;
