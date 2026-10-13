-- ROLLBACK de 003_vehicle_catalog (catálogo de vehículos + clasificación de precios).
-- NO EJECUTAR sin autorización explícita.
-- Deja la base exactamente como estaba antes del catálogo. No toca clients, inquiries,
-- appointments, vehicles (salvo la columna catalog_id), services, cobros ni historiales.
-- Pérdida de datos: solo las columnas nuevas (categoría/precio/clasificación por vehículo
-- de cada turno, vehicles.catalog_id, settings.vehicle_prices) y la tabla vehicle_catalog.

begin;

-- 1) Restaurar submit_booking a su versión anterior (no referencia el catálogo).
create or replace function public.submit_booking(payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_client_id uuid;
  v_vehicle_id uuid;
  v_first_vehicle_id uuid;
  v_inquiry_id uuid;
  v_appointment_id uuid;
  v_whatsapp text := payload ->> 'whatsapp';
  v_source text := coalesce(nullif(payload ->> 'source', ''), 'web');
  v_marketing boolean := coalesce((payload ->> 'marketing_consent')::boolean, false);
  v_extras text[] := coalesce(array(select jsonb_array_elements_text(payload -> 'extras')), '{}');
  v_vehicles jsonb;
  v_item jsonb;
  v_pos int := 0;
  v_category text;
  v_brand text;
  v_model text;
  v_recent int;
  v_ids uuid[] := '{}';
begin
  if jsonb_typeof(payload -> 'vehicles') = 'array' then
    v_vehicles := payload -> 'vehicles';
  else
    v_vehicles := jsonb_build_array(jsonb_build_object(
      'category', payload ->> 'category', 'brand', payload ->> 'brand', 'model', payload ->> 'model'));
  end if;

  if jsonb_array_length(v_vehicles) not between 1 and 10 then
    raise exception 'Cantidad de vehículos inválida' using errcode = '22023';
  end if;
  if v_whatsapp !~ '^549[0-9]{10}$' then
    raise exception 'WhatsApp inválido' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_vehicles) e
             where coalesce(e ->> 'category', '') not in ('auto', 'suv', 'pickup')
                or length(coalesce(e ->> 'brand', '')) > 60
                or length(coalesce(e ->> 'model', '')) > 60) then
    raise exception 'Categoría inválida' using errcode = '22023';
  end if;
  if length(coalesce(payload ->> 'full_name', '')) not between 3 and 120
     or length(coalesce(payload ->> 'address', '')) not between 5 and 200
     or (coalesce(payload ->> 'email', '') <> '' and payload ->> 'email' !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Datos inválidos' using errcode = '22023';
  end if;
  if (payload ->> 'requested_start')::timestamptz < now() - interval '1 hour' then
    raise exception 'Fecha inválida' using errcode = '22023';
  end if;

  select count(*) into v_recent
  from public.inquiries i join public.clients c on c.id = i.client_id
  where c.whatsapp = v_whatsapp and i.created_at > now() - interval '1 hour';
  if v_recent >= 3 then
    raise exception 'Demasiadas solicitudes' using errcode = 'P0002';
  end if;

  insert into public.clients (full_name, whatsapp, email, source, privacy_consent_at, marketing_consent, marketing_consent_at)
  values (
    trim(payload ->> 'full_name'), v_whatsapp, nullif(lower(trim(payload ->> 'email')), ''), v_source, now(),
    v_marketing, case when v_marketing then now() end
  )
  on conflict (whatsapp) do update set
    full_name = excluded.full_name,
    email = coalesce(excluded.email, public.clients.email),
    privacy_consent_at = now(),
    marketing_consent = public.clients.marketing_consent or excluded.marketing_consent,
    marketing_consent_at = coalesce(public.clients.marketing_consent_at, excluded.marketing_consent_at),
    last_interaction_at = now()
  returning id into v_client_id;

  for v_item in select * from jsonb_array_elements(v_vehicles) loop
    v_pos := v_pos + 1;
    v_category := v_item ->> 'category';
    v_brand := nullif(trim(v_item ->> 'brand'), '');
    v_model := nullif(trim(v_item ->> 'model'), '');
    v_vehicle_id := null;

    select v.id into v_vehicle_id
    from public.vehicles v
    where v.client_id = v_client_id
      and v.category = v_category
      and lower(coalesce(v.brand, '')) = lower(coalesce(v_brand, ''))
      and lower(coalesce(v.model, '')) = lower(coalesce(v_model, ''))
      and (v_brand is not null or v_model is not null)
      and not (v.id = any(v_ids))
    limit 1;

    if v_vehicle_id is null then
      insert into public.vehicles (client_id, category, brand, model)
      values (v_client_id, v_category, v_brand, v_model)
      returning id into v_vehicle_id;
    end if;

    v_ids := v_ids || v_vehicle_id;
    if v_pos = 1 then v_first_vehicle_id := v_vehicle_id; end if;
  end loop;

  insert into public.inquiries (client_id, vehicle_id, source, service, extras, commercial_status, notes)
  values (v_client_id, v_first_vehicle_id, v_source, payload ->> 'service', v_extras, 'turno_solicitado',
          nullif(trim(payload ->> 'notes'), ''))
  returning id into v_inquiry_id;

  insert into public.appointments (client_id, vehicle_id, inquiry_id, service, extras, address, requested_start, water_supply, duration_minutes)
  values (v_client_id, v_first_vehicle_id, v_inquiry_id, payload ->> 'service', v_extras, trim(payload ->> 'address'),
          (payload ->> 'requested_start')::timestamptz, payload ->> 'water_supply', 60 * v_pos)
  returning id into v_appointment_id;

  insert into public.appointment_vehicles (appointment_id, vehicle_id, position)
  select v_appointment_id, u.vid, u.ord::int from unnest(v_ids) with ordinality as u(vid, ord);

  return v_inquiry_id;
end;
$function$;

-- 2) Quitar columnas agregadas (solo metadatos nuevos; las filas se conservan).
alter table public.appointment_vehicles
  drop column if exists needs_review,
  drop column if exists classification,
  drop column if exists price_applied,
  drop column if exists category;
alter table public.settings drop column if exists vehicle_prices;
alter table public.vehicles drop column if exists catalog_id;

-- 3) Quitar el catálogo.
drop table if exists public.vehicle_catalog;

commit;
