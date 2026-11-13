-- Manual appointments from the panel use the same form as the web booking,
-- but every field is optional. Clients created without WhatsApp keep it NULL.
alter table public.clients alter column whatsapp drop not null;

create or replace function public.admin_create_booking(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_whatsapp text := nullif(regexp_replace(coalesce(p ->> 'whatsapp', ''), '\D', '', 'g'), '');
  v_name text := trim(coalesce(p ->> 'full_name', ''));
  v_source text := coalesce(nullif(p ->> 'source', ''), 'whatsapp');
  v_service text := coalesce(nullif(trim(p ->> 'service'), ''), 'Lavado completo');
  v_extras text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'extras', '[]'::jsonb))), '{}');
  v_vehicles jsonb := case when jsonb_typeof(p -> 'vehicles') = 'array' then p -> 'vehicles' else '[]'::jsonb end;
  v_prices jsonb;
  v_durations jsonb;
  v_default_duration int;
  v_duration int := 0;
  v_client uuid;
  v_inquiry uuid;
  v_appt uuid;
  v_item jsonb;
  v_category text;
  v_brand text;
  v_model text;
  v_catalog_id uuid;
  v_cat_category text;
  v_classification text;
  v_review boolean;
  v_vehicle uuid;
  v_ids uuid[] := '{}';
  v_cats text[] := '{}';
  v_prices_applied int[] := '{}';
  v_classes text[] := '{}';
  v_reviews boolean[] := '{}';
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v_whatsapp is not null and v_whatsapp !~ '^[1-9][0-9]{7,14}$' then
    raise exception 'WhatsApp inválido.' using errcode = '22023';
  end if;
  if v_source not in ('whatsapp', 'telefono', 'instagram', 'presencial', 'otro') then
    raise exception 'Origen inválido.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_vehicles) > 10 then
    raise exception 'Cantidad de vehículos inválida.' using errcode = '22023';
  end if;
  if length(v_name) < 2 then v_name := 'Sin nombre'; end if;

  select s.vehicle_prices, s.duration_defaults, s.default_duration_minutes
    into v_prices, v_durations, v_default_duration
  from public.settings s where s.id = 1;
  v_prices := coalesce(v_prices, '{"auto":25000,"suv":30000,"pickup":35000,"pickup_xl":40000}'::jsonb);
  v_durations := coalesce(v_durations, '{"auto":60,"suv":75,"pickup":90,"pickup_xl":105}'::jsonb);

  if v_whatsapp is not null then
    select id into v_client from public.clients where whatsapp = v_whatsapp limit 1;
  end if;
  if v_client is null then
    insert into public.clients (full_name, whatsapp) values (v_name, v_whatsapp) returning id into v_client;
  end if;

  for v_item in select * from jsonb_array_elements(v_vehicles) loop
    v_category := nullif(v_item ->> 'category', '');
    v_brand := nullif(left(trim(coalesce(v_item ->> 'brand', '')), 60), '');
    v_model := nullif(left(trim(coalesce(v_item ->> 'model', '')), 60), '');
    v_catalog_id := case when coalesce(v_item ->> 'catalog_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         then (v_item ->> 'catalog_id')::uuid end;
    v_cat_category := null;
    v_classification := 'manual';
    v_review := true;

    if v_catalog_id is not null then
      select vc.brand, vc.model, vc.category into v_brand, v_model, v_cat_category
      from public.vehicle_catalog vc where vc.id = v_catalog_id and vc.active;
      if not found then
        v_catalog_id := null;
      elsif v_cat_category is not null then
        v_category := v_cat_category;
        v_classification := 'catalogo';
        v_review := false;
      end if;
    end if;

    continue when v_category is null or v_category not in ('auto', 'suv', 'pickup', 'pickup_xl');

    v_vehicle := null;
    select v.id into v_vehicle from public.vehicles v
    where v.client_id = v_client and v.category = v_category
      and lower(coalesce(v.brand, '')) = lower(coalesce(v_brand, ''))
      and lower(coalesce(v.model, '')) = lower(coalesce(v_model, ''))
      and (v_brand is not null or v_model is not null)
      and not (v.id = any(v_ids))
    limit 1;
    if v_vehicle is null then
      insert into public.vehicles (client_id, category, brand, model, catalog_id)
      values (v_client, v_category, v_brand, v_model, v_catalog_id)
      returning id into v_vehicle;
    end if;

    v_ids := v_ids || v_vehicle;
    v_cats := v_cats || v_category;
    v_prices_applied := v_prices_applied || coalesce((v_prices ->> v_category)::int, 0);
    v_classes := v_classes || v_classification;
    v_reviews := v_reviews || v_review;
    v_duration := v_duration + coalesce((v_durations ->> v_category)::int, 60);
  end loop;

  if v_duration = 0 then v_duration := coalesce(v_default_duration, 90); end if;
  v_duration := least(greatest(v_duration, 15), 540);

  insert into public.inquiries (client_id, vehicle_id, source, service, extras, notes, commercial_status)
  values (v_client, v_ids[1], v_source, v_service, v_extras, nullif(left(trim(coalesce(p ->> 'notes', '')), 2000), ''), 'turno_solicitado')
  returning id into v_inquiry;

  insert into public.appointments (client_id, vehicle_id, inquiry_id, service, extras, address, neighborhood,
                                   requested_start, duration_minutes, water_supply, agreed_price, status)
  values (v_client, v_ids[1], v_inquiry, v_service, v_extras, left(trim(coalesce(p ->> 'address', '')), 200),
          nullif(left(trim(coalesce(p ->> 'neighborhood', '')), 120), ''), null, v_duration,
          case when p ->> 'water_supply' = 'propia' then 'propia' else 'domicilio' end,
          nullif(p ->> 'price', '')::numeric, 'solicitado')
  returning id into v_appt;

  if array_length(v_ids, 1) > 0 then
    insert into public.appointment_vehicles (appointment_id, vehicle_id, position, category, price_applied, classification, needs_review)
    select v_appt, v_ids[i], i, v_cats[i], v_prices_applied[i], v_classes[i], v_reviews[i]
    from generate_subscripts(v_ids, 1) as i;
  end if;

  if nullif(trim(p ->> 'internal_note'), '') is not null then
    insert into public.appointment_notes (appointment_id, body) values (v_appt, left(trim(p ->> 'internal_note'), 4000));
  end if;
  return v_appt;
end $$;

revoke all on function public.admin_create_booking(jsonb) from public, anon;
grant execute on function public.admin_create_booking(jsonb) to authenticated;
