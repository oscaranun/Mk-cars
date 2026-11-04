-- Permite eliminar definitivamente clientes archivados aunque tengan servicios o turnos confirmados.
-- Antes de borrar se guarda una copia completa (incluye servicios y cobros) en client_audit_log.
-- Ya aplicado en la base de datos de producción.

create or replace function public.client_delete_blockers(p_id uuid)
returns text[]
language sql
stable
set search_path to ''
as $$
  select array[]::text[];
$$;

create or replace function public.client_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select jsonb_build_object(
    'client', (select to_jsonb(c) from public.clients c where c.id = p_id),
    'vehicles', coalesce((select jsonb_agg(to_jsonb(v)) from public.vehicles v where v.client_id = p_id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(to_jsonb(i)) from public.inquiries i where i.client_id = p_id), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object(
        'vehicles', coalesce((select jsonb_agg(to_jsonb(av)) from public.appointment_vehicles av where av.appointment_id = a.id), '[]'::jsonb),
        'proposals', coalesce((select jsonb_agg(to_jsonb(pr)) from public.appointment_proposals pr where pr.appointment_id = a.id), '[]'::jsonb),
        'messages', coalesce((select jsonb_agg(to_jsonb(m)) from public.appointment_messages m where m.appointment_id = a.id), '[]'::jsonb)
      ))
      from public.appointments a where a.client_id = p_id), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'payments', coalesce((select jsonb_agg(to_jsonb(p)) from public.payments p where p.service_id = s.id), '[]'::jsonb)
      ))
      from public.services s where s.client_id = p_id), '[]'::jsonb),
    'status_history', coalesce((
      select jsonb_agg(to_jsonb(h)) from public.status_history h
       where (h.entity = 'inquiry' and h.entity_id in (select id from public.inquiries where client_id = p_id))
          or (h.entity = 'appointment' and h.entity_id in (select id from public.appointments where client_id = p_id))
    ), '[]'::jsonb)
  );
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
  v_blockers text[] := array[]::text[];
  v_vehicles int;
  v_inquiries int;
  v_appointments int;
  v_services int;
  v_conf text := trim(coalesce(p_confirmation, ''));
  v_digits text;
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
  select count(*) into v_services from public.services where client_id = p_id;

  if c.archived_at is null then
    v_blockers := array['Primero hay que archivar al cliente.'];
  end if;

  if p_dry_run then
    return jsonb_build_object('blocked', cardinality(v_blockers) > 0, 'reasons', to_jsonb(v_blockers),
      'vehicles', v_vehicles, 'inquiries', v_inquiries, 'appointments', v_appointments, 'services', v_services);
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

  insert into public.client_audit_log (client_id, client_name, action, reason, actor_id, actor_email, snapshot)
  values (p_id, c.full_name, 'delete', c.archive_reason, auth.uid(), auth.jwt() ->> 'email', public.client_snapshot(p_id));

  delete from public.status_history h
   where (h.entity = 'inquiry' and h.entity_id in (select id from public.inquiries where client_id = p_id))
      or (h.entity = 'appointment' and h.entity_id in (select id from public.appointments where client_id = p_id));

  perform set_config('mk.client_delete', 'on', true);
  delete from public.clients where id = p_id;
  perform set_config('mk.client_delete', 'off', true);

  return jsonb_build_object('deleted', true, 'vehicles', v_vehicles, 'inquiries', v_inquiries,
    'appointments', v_appointments, 'services', v_services);
end;
$$;

revoke all on function public.client_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.delete_client_permanently(uuid, text, boolean) from public, anon;
grant execute on function public.delete_client_permanently(uuid, text, boolean) to authenticated;
