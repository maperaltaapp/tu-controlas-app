-- Safe restore context: no public access, exists only during the restoring transaction.
-- Preserves historical AI status/version/date without changing ordinary app behavior.
begin;
create table if not exists elite_private.tc_restore_context_v3 (
 txid bigint primary key,
 backend_pid integer not null,
 user_id uuid not null,
 created_at timestamptz not null default pg_catalog.now()
);
revoke all on elite_private.tc_restore_context_v3 from public,anon,authenticated;

create or replace function elite_private.track_ai_learning()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog','public','elite_private'
as $function$
begin
 if exists(
  select 1 from elite_private.tc_restore_context_v3 c
  where c.txid=pg_catalog.txid_current_if_assigned()
    and c.backend_pid=pg_catalog.pg_backend_pid()
    and c.user_id=new.user_id
 ) then return new; end if;
 if tg_op='UPDATE' then
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id
    or new.created_at is distinct from old.created_at then
    raise exception 'Identidad y fecha de creación inmutables.';
  end if;
  new.version:=old.version+1;
  new.updated_at:=now();
  if new.status is distinct from old.status then
   if new.status in ('approved','rejected') then new.reviewed_at:=now();
   elsif new.status='pending' then new.reviewed_at:=null;
   end if;
  end if;
 else
  new.version:=1;new.status:='pending';new.created_at:=now();
  new.updated_at:=now();new.reviewed_at:=null;
 end if;
 return new;
end $function$;

create or replace function elite_private.stamp_ai_correction()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog','public','elite_private'
as $function$
begin
 if exists(
  select 1 from elite_private.tc_restore_context_v3 c
  where c.txid=pg_catalog.txid_current_if_assigned()
    and c.backend_pid=pg_catalog.pg_backend_pid()
    and c.user_id=new.user_id
 ) then return new; end if;
 if TG_OP='UPDATE' then
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id
   or new.created_at is distinct from old.created_at then
   raise exception 'Identidad y creación inmutables';
  end if;
  if old.status in ('confirmed','dismissed') and new.status is distinct from old.status then
   raise exception 'La corrección ya fue resuelta. Crea una nueva versión como nueva propuesta.';
  end if;
  new.version:=old.version+1;new.updated_at:=now();
  if new.status='confirmed' then new.confirmed_at:=now();end if;
 else
  new.version:=1;new.status:='awaiting_confirmation';new.confirmed_at:=null;
  new.created_at:=now();new.updated_at:=now();
 end if;
 return new;
end $function$;
commit;
