-- Archivado, restauración y eliminación definitiva de clientes, con registro de auditoría.
-- Solo agrega estructura: no modifica ni borra datos existentes.

alter table public.clients
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text check (archive_reason is null or length(archive_reason) <= 500);

create index if not exists clients_archived_at_idx on public.clients (archived_at);

create table if not exists public.client_audit_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  client_name text not null,
  action text not null check (action in ('archive', 'restore', 'delete')),
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_audit_log_client_idx on public.client_audit_log (client_id, created_at desc);

alter table public.client_audit_log enable row level security;
drop policy if exists client_audit_log_admin_read on public.client_audit_log;
create policy client_audit_log_admin_read on public.client_audit_log for select using (public.is_admin());
revoke insert, update, delete on public.client_audit_log from anon, authenticated;

-- Reasons a client cannot be permanently deleted (real work must be preserved).
create or replace function public.client_delete_blockers(p_id uuid)
returns text[]
language sql
stable
set search_path to ''
as $$
  select array_remove(array[
    case when exists (select 1 from public.services s where s.client_id = p_id)
      then 'Tiene servicios realizados.' end,
    case when exists (select 1 from public.appointments a where a.client_id = p_id and a.status in ('confirmado', 'realizado'))
      then 'Tiene turnos confirmados o realizados.' end
  ], null);
$$;

create or replace function public.archive_client(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.clients%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into c from public.clients where id = p_id for update;
  if not found then
    raise exception 'Cliente inexistente.' using errcode = 'P0001';
  end if;
  if c.archived_at is not null then
    raise exception 'El cliente ya está archivado.' using errcode = 'P0001';
  end if;

  update public.clients
     set archived_at = now(), archived_by = auth.uid(), archive_reason = v_reason
   where id = p_id;

  insert into public.client_audit_log (client_id, client_name, action, reason, actor_id, actor_email)
  values (p_id, c.full_name, 'archive', v_reason, auth.uid(), auth.jwt() ->> 'email');
end;
$$;

create or replace function public.restore_client(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.clients%rowtype;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into c from public.clients where id = p_id for update;
  if not found then
    raise exception 'Cliente inexistente.' using errcode = 'P0001';
  end if;
  if c.archived_at is null then
    raise exception 'El cliente no está archivado.' using errcode = 'P0001';
  end if;

  update public.clients
     set archived_at = null, archived_by = null, archive_reason = null
   where id = p_id;

  insert into public.client_audit_log (client_id, client_name, action, actor_id, actor_email)
  values (p_id, c.full_name, 'restore', auth.uid(), auth.jwt() ->> 'email');
end;
$$;

create or replace function public.delete_client_permanently(
  p_id uuid,
  p_confirmation text default null,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.clients%rowtype;
  v_blockers text[];
  v_vehicles int;
  v_inquiries int;
  v_appointments int;
  v_conf text := trim(coalesce(p_confirmation, ''));
  v_digits text;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into c from public.clients where id = p_id for update;
  if not found then
    raise exception 'Cliente inexistente.' using errcode = 'P0001';
  end if;

  select count(*) into v_vehicles from public.vehicles where client_id = p_id;
  select count(*) into v_inquiries from public.inquiries where client_id = p_id;
  select count(*) into v_appointments from public.appointments where client_id = p_id;

  v_blockers := public.client_delete_blockers(p_id);
  if c.archived_at is null then
    v_blockers := array['Primero hay que archivar al cliente.'] || v_blockers;
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'blocked', cardinality(v_blockers) > 0,
      'reasons', to_jsonb(v_blockers),
      'vehicles', v_vehicles,
      'inquiries', v_inquiries,
      'appointments', v_appointments
    );
  end if;

  if cardinality(v_blockers) > 0 then
    raise exception 'No se puede eliminar: %', array_to_string(v_blockers, ' ') using errcode = 'P0001';
  end if;

  v_digits := regexp_replace(v_conf, '\D', '', 'g');
  if not (
    (v_conf <> '' and lower(v_conf) = lower(trim(c.full_name)))
    or (length(v_digits) >= 10 and right(c.whatsapp, 10) = right(v_digits, 10))
  ) then
    raise exception 'La confirmación no coincide con el nombre ni con el WhatsApp del cliente.' using errcode = 'P0001';
  end if;

  v_snapshot := jsonb_build_object(
    'client', to_jsonb(c),
    'vehicles', coalesce((select jsonb_agg(to_jsonb(v)) from public.vehicles v where v.client_id = p_id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(to_jsonb(i)) from public.inquiries i where i.client_id = p_id), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object(
        'vehicles', coalesce((select jsonb_agg(to_jsonb(av)) from public.appointment_vehicles av where av.appointment_id = a.id), '[]'::jsonb),
        'proposals', coalesce((select jsonb_agg(to_jsonb(pr)) from public.appointment_proposals pr where pr.appointment_id = a.id), '[]'::jsonb),
        'messages', coalesce((select jsonb_agg(to_jsonb(m)) from public.appointment_messages m where m.appointment_id = a.id), '[]'::jsonb)
      ))
      from public.appointments a where a.client_id = p_id), '[]'::jsonb),
    'status_history', coalesce((
      select jsonb_agg(to_jsonb(h)) from public.status_history h
       where (h.entity = 'inquiry' and h.entity_id in (select id from public.inquiries where client_id = p_id))
          or (h.entity = 'appointment' and h.entity_id in (select id from public.appointments where client_id = p_id))
    ), '[]'::jsonb)
  );

  insert into public.client_audit_log (client_id, client_name, action, reason, actor_id, actor_email, snapshot)
  values (p_id, c.full_name, 'delete', c.archive_reason, auth.uid(), auth.jwt() ->> 'email', v_snapshot);

  delete from public.status_history h
   where (h.entity = 'inquiry' and h.entity_id in (select id from public.inquiries where client_id = p_id))
      or (h.entity = 'appointment' and h.entity_id in (select id from public.appointments where client_id = p_id));

  perform set_config('mk.client_delete', 'on', true);
  delete from public.clients where id = p_id;
  perform set_config('mk.client_delete', 'off', true);

  return jsonb_build_object(
    'deleted', true,
    'vehicles', v_vehicles,
    'inquiries', v_inquiries,
    'appointments', v_appointments
  );
end;
$$;

-- Clients can only be deleted through delete_client_permanently, except for the two existing
-- flows: orphan cleanup in delete_appointment_permanently and TEST MK CARS bookings.
create or replace function public.guard_client_delete()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if current_setting('mk.client_delete', true) = 'on' then
    return old;
  end if;
  if not exists (select 1 from public.appointments where client_id = old.id)
     and not exists (select 1 from public.inquiries where client_id = old.id)
     and not exists (select 1 from public.services where client_id = old.id)
     and not exists (select 1 from public.vehicles where client_id = old.id) then
    return old;
  end if;
  if old.full_name ilike 'TEST MK CARS%'
     and not exists (select 1 from public.services where client_id = old.id) then
    return old;
  end if;
  raise exception 'Los clientes solo se eliminan desde el CRM: archivalo y usá "Eliminar definitivamente".'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists clients_guard_delete on public.clients;
create trigger clients_guard_delete
  before delete on public.clients
  for each row execute function public.guard_client_delete();

-- An archived client who books again from the web is restored automatically.
create or replace function public.restore_archived_client_on_inquiry()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text;
begin
  update public.clients
     set archived_at = null, archived_by = null, archive_reason = null
   where id = new.client_id and archived_at is not null
  returning full_name into v_name;
  if found then
    insert into public.client_audit_log (client_id, client_name, action, reason)
    values (new.client_id, v_name, 'restore', 'Restaurado automáticamente: nueva consulta desde la web.');
  end if;
  return new;
end;
$$;

drop trigger if exists inquiries_restore_client on public.inquiries;
create trigger inquiries_restore_client
  after insert on public.inquiries
  for each row execute function public.restore_archived_client_on_inquiry();

revoke all on function public.client_delete_blockers(uuid) from public, anon;
revoke all on function public.archive_client(uuid, text) from public, anon;
revoke all on function public.restore_client(uuid) from public, anon;
revoke all on function public.delete_client_permanently(uuid, text, boolean) from public, anon;
revoke all on function public.guard_client_delete() from public, anon, authenticated;
revoke all on function public.restore_archived_client_on_inquiry() from public, anon, authenticated;
grant execute on function public.client_delete_blockers(uuid) to authenticated;
grant execute on function public.archive_client(uuid, text) to authenticated;
grant execute on function public.restore_client(uuid) to authenticated;
grant execute on function public.delete_client_permanently(uuid, text, boolean) to authenticated;
