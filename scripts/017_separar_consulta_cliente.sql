-- Separa una consulta (con sus turnos, servicios y vehículos propios) en un cliente nuevo,
-- para cuando dos personas distintas quedaron unidas en un mismo cliente.
create or replace function public.split_inquiry_to_new_client(p_inquiry_id uuid, p_full_name text, p_whatsapp text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old public.clients%rowtype;
  v_old_id uuid;
  v_new_id uuid;
  v_name text := trim(coalesce(p_full_name, ''));
  v_whatsapp text := trim(coalesce(p_whatsapp, ''));
  v_appts uuid[];
  v_vehicles uuid[];
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Ingresá nombre y apellido.' using errcode = 'P0001';
  end if;
  if v_whatsapp = '' then
    raise exception 'Ingresá el WhatsApp del nuevo cliente.' using errcode = 'P0001';
  end if;

  select client_id into v_old_id from public.inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception 'Consulta inexistente.' using errcode = 'P0001';
  end if;
  select * into v_old from public.clients where id = v_old_id for update;

  if (select count(*) from public.inquiries where client_id = v_old_id) < 2 then
    raise exception 'Este cliente tiene una sola consulta: editá sus datos directamente.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clients where whatsapp = v_whatsapp) then
    raise exception 'Ya existe un cliente con ese WhatsApp. Usá otro número.' using errcode = 'P0001';
  end if;

  insert into public.clients (full_name, whatsapp, source, privacy_consent_at)
  values (v_name, v_whatsapp, v_old.source, v_old.privacy_consent_at)
  returning id into v_new_id;

  select coalesce(array_agg(id), '{}') into v_appts
    from public.appointments where inquiry_id = p_inquiry_id and client_id = v_old_id;

  -- Vehículos de esta consulta y sus turnos/servicios, que no use ninguna otra consulta del cliente original.
  select coalesce(array_agg(distinct v), '{}') into v_vehicles from (
    select vehicle_id v from public.inquiries where id = p_inquiry_id
    union select vehicle_id from public.appointments where id = any(v_appts)
    union select vehicle_id from public.appointment_vehicles where appointment_id = any(v_appts)
    union select vehicle_id from public.services where appointment_id = any(v_appts)
  ) x
  where v is not null
    and not exists (select 1 from public.inquiries i where i.client_id = v_old_id and i.id <> p_inquiry_id and i.vehicle_id = x.v)
    and not exists (select 1 from public.appointments a where a.client_id = v_old_id and a.id <> all(v_appts) and a.vehicle_id = x.v)
    and not exists (
      select 1 from public.appointment_vehicles av join public.appointments a on a.id = av.appointment_id
       where a.client_id = v_old_id and a.id <> all(v_appts) and av.vehicle_id = x.v)
    and not exists (
      select 1 from public.services s where s.client_id = v_old_id
         and (s.appointment_id is null or s.appointment_id <> all(v_appts)) and s.vehicle_id = x.v);

  update public.inquiries set client_id = v_new_id where id = p_inquiry_id;
  update public.appointments set client_id = v_new_id, contact_name = null where id = any(v_appts);
  update public.services set client_id = v_new_id where appointment_id = any(v_appts);
  update public.vehicles set client_id = v_new_id where id = any(v_vehicles) and client_id = v_old_id;

  return v_new_id;
end;
$$;

revoke all on function public.split_inquiry_to_new_client(uuid, text, text) from public, anon;
grant execute on function public.split_inquiry_to_new_client(uuid, text, text) to authenticated;
