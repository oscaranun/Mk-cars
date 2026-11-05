-- 013: horario de atención 07:00 a 20:00 todos los días (incluye domingos y feriados)
-- y carga directa de un lavado "realizado y cobrado" sin reserva previa.

create or replace function public.assert_business_hours(p_start timestamptz, p_duration integer)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  local_start time := (p_start at time zone 'America/Argentina/Mendoza')::time;
begin
  if p_start is null then
    raise exception 'Indicá fecha y hora.' using errcode = '22023';
  end if;
  if local_start < time '07:00' or local_start > time '20:00' then
    raise exception 'El horario debe estar entre las 07:00 y las 20:00.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_register_completed_service(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_whatsapp text := regexp_replace(coalesce(p ->> 'whatsapp', ''), '\D', '', 'g');
  v_name text := trim(coalesce(p ->> 'full_name', ''));
  v_category text := p ->> 'vehicle_category';
  v_source text := coalesce(nullif(p ->> 'source', ''), 'whatsapp');
  v_service text := trim(coalesce(p ->> 'service', ''));
  v_start timestamptz := nullif(p ->> 'performed_at', '')::timestamptz;
  v_price numeric(12, 2) := round(nullif(p ->> 'final_price', '')::numeric, 2);
  v_paid numeric(12, 2) := coalesce(round(nullif(p ->> 'amount_paid', '')::numeric, 2), 0);
  v_method text := nullif(p ->> 'method', '');
  v_duration int := coalesce(nullif(p ->> 'duration', '')::int, (select default_duration_minutes from public.settings where id = 1), 90);
  v_client uuid;
  v_vehicle uuid;
  v_inquiry uuid;
  v_appt uuid;
  v_srv uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if length(v_name) < 2 then raise exception 'Ingresá nombre y apellido.' using errcode = '22023'; end if;
  if length(v_whatsapp) not between 10 and 13 then raise exception 'WhatsApp inválido.' using errcode = '22023'; end if;
  if v_category not in ('auto', 'suv', 'pickup') then raise exception 'Elegí el tipo de vehículo.' using errcode = '22023'; end if;
  if length(trim(coalesce(p ->> 'address', ''))) < 5 then raise exception 'Ingresá el domicilio.' using errcode = '22023'; end if;
  if length(v_service) not between 2 and 120 then raise exception 'Indicá el tipo de lavado.' using errcode = '22023'; end if;
  if v_source not in ('whatsapp', 'telefono', 'instagram', 'presencial', 'otro') then raise exception 'Origen inválido.' using errcode = '22023'; end if;
  if v_duration not between 15 and 540 then raise exception 'Duración inválida.' using errcode = '22023'; end if;
  if v_start is null or v_start > now() + interval '1 day' then raise exception 'Fecha de lavado inválida.' using errcode = '22023'; end if;
  perform public.assert_business_hours(v_start, v_duration);
  if v_price is null or v_price < 0 then raise exception 'Ingresá el importe del servicio.' using errcode = '22023'; end if;
  if v_paid < 0 or v_paid > v_price then raise exception 'El importe cobrado no puede superar el del servicio.' using errcode = '22023'; end if;
  if v_paid > 0 and coalesce(v_method, '') not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then
    raise exception 'Elegí el medio de pago.' using errcode = '22023';
  end if;

  select id into v_client from public.clients where whatsapp = v_whatsapp limit 1;
  if v_client is null then
    insert into public.clients (full_name, whatsapp) values (v_name, v_whatsapp) returning id into v_client;
  end if;
  insert into public.vehicles (client_id, category, brand, model)
  values (v_client, v_category, nullif(trim(p ->> 'brand'), ''), nullif(trim(p ->> 'model'), ''))
  returning id into v_vehicle;
  insert into public.inquiries (client_id, vehicle_id, source, service, commercial_status)
  values (v_client, v_vehicle, v_source, v_service,
          case when v_paid >= v_price then 'cobrado' else 'servicio_realizado' end)
  returning id into v_inquiry;
  insert into public.appointments (client_id, vehicle_id, inquiry_id, service, address, neighborhood,
                                   confirmed_start, confirmed_at, duration_minutes, water_supply, agreed_price, operator, status)
  values (v_client, v_vehicle, v_inquiry, v_service, trim(p ->> 'address'), nullif(trim(p ->> 'neighborhood'), ''),
          v_start, now(), v_duration, case when p ->> 'water_supply' = 'propia' then 'propia' else 'domicilio' end,
          v_price, nullif(trim(p ->> 'operator'), ''), 'realizado')
  returning id into v_appt;
  insert into public.services (appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at,
                               agreed_price, final_price, operator, notes)
  values (v_appt, v_client, v_vehicle, v_category, v_service, v_start, v_price, v_price,
          nullif(trim(p ->> 'operator'), ''), nullif(trim(p ->> 'notes'), ''))
  returning id into v_srv;
  if v_paid > 0 then
    insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, verified_by, verified_by_email, verified_at)
    values (v_srv, v_appt, v_paid, v_method, v_start, 'Carga manual: servicio realizado', auth.uid(), auth.jwt() ->> 'email', now());
  end if;
  if nullif(trim(p ->> 'internal_note'), '') is not null then
    insert into public.appointment_notes (appointment_id, body) values (v_appt, trim(p ->> 'internal_note'));
  end if;
  update public.clients set last_interaction_at = now() where id = v_client;
  return v_appt;
end;
$$;

revoke all on function public.admin_register_completed_service(jsonb) from public, anon;
grant execute on function public.admin_register_completed_service(jsonb) to authenticated;
