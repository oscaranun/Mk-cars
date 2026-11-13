-- Datos de prueba: suma las novedades al generador del panel /admin/pruebas.
-- Pick-up XL, estado del vehículo con presupuesto estimado, flyer de evento,
-- WhatsApp internacionales y turnos manuales con datos incompletos.
-- Todo queda marcado como prueba (is_demo) y se borra con "Eliminar datos de prueba".

-- Las reservas desde un flyer de evento guardan "evento:<slug>"; la restricción vieja las rechazaba.
alter table public.inquiries drop constraint if exists inquiries_origen_reserva_check;
alter table public.inquiries add constraint inquiries_origen_reserva_check
  check (origen_reserva in ('web', 'whatsapp_flyer') or origen_reserva ~ '^evento:[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.events add column if not exists is_demo boolean not null default false;

create or replace function public._demo_money(p numeric)
returns text language sql immutable set search_path = '' as $$
  select '$ ' || replace(to_char(round(p), 'FM999,999,999'), ',', '.')
$$;

create or replace function public._demo_condition_notes(p_last_wash text, p_conditions text[], p_base numeric)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_n int := coalesce(cardinality(p_conditions), 0);
  v_base int := case p_last_wash when '60' then 10 when '90' then 15 when 'more' then 20 else 0 end;
  v_raw int;
  v_inc int;
  v_notice text;
  v_labels text;
  v_max numeric;
begin
  if v_n >= 3 then v_inc := 25;
  elsif 'stains' = any(p_conditions) then v_inc := 20;
  else
    v_raw := v_base + v_n * 5;
    v_inc := case when v_raw <= 0 then 0 when v_raw <= 10 then 10 when v_raw <= 15 then 15 else 20 end;
  end if;

  v_notice := case
    when v_n >= 3 then 'Al marcar 3 o más condiciones puede existir un incremento del 25%.'
    when 'stains' = any(p_conditions) then 'Las manchas en tapizados pueden generar un incremento del 20%.'
    when v_inc = 0 then 'Sin incremento estimado por el estado del vehículo.'
    when v_inc = 10 then 'Puede existir un incremento estimado de hasta el 10% según el estado del vehículo.'
    when v_inc = 15 then 'Puede existir un incremento estimado del 10% al 15% según el estado del vehículo.'
    else 'Puede existir un incremento estimado del 15% al 20% según el estado del vehículo.' end;

  select string_agg(label, ', ' order by ord) into v_labels
  from (values (1, 'pets', 'Pelos de mascota'), (2, 'mud', 'Barro o tierra en exceso'), (3, 'sand', 'Arena'),
               (4, 'stains', 'Manchas en tapizados'), (5, 'trash', 'Restos de comida o basura'), (6, 'odor', 'Olores fuertes')) o(ord, id, label)
  where o.id = any(p_conditions);

  v_max := round(p_base * (1 + v_inc / 100.0) / 100) * 100;

  return concat_ws(E'\n',
    'Estado del vehículo:',
    'Último lavado: ' || case p_last_wash when '60' then 'Dentro de los últimos 60 días' when '90' then 'Hace más de 60 días'
                                          when 'more' then 'Hace más de 90 días' else 'Dentro de los últimos 30 días' end,
    'Condiciones: ' || coalesce(v_labels, 'Ninguna seleccionada'),
    'Aviso: ' || v_notice,
    case when p_base > 0 then 'Presupuesto estimado: ' ||
      case when v_inc = 0 or v_max = p_base then public._demo_money(p_base)
           else public._demo_money(p_base) || ' a ' || public._demo_money(v_max) end end);
end $$;

create or replace function public._seed_demo_extras()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  tz constant text := 'America/Argentina/Mendoza';
  v_slug constant text := 'palmares-demo';
  v_today date := (now() at time zone tz)::date;
  v_saturday date := v_today + ((6 - extract(dow from v_today)::int + 7) % 7);
  v_prices jsonb;
  r record;
  v_wash text;
  v_conds text[];
  v_client uuid;
  v_veh uuid;
  v_catid uuid;
  v_brand text;
  v_model text;
  v_cat text;
  v_price numeric;
  v_inq uuid;
  v_appt uuid;
  v_day date;
  v_n_cond int := 0;
  v_n_event int := 0;
  v_n_intl int := 0;
  v_n_manual int := 0;
  v_n int;
begin
  select vehicle_prices into v_prices from public.settings where id = 1;
  v_prices := coalesce(v_prices, '{"auto":25000,"suv":30000,"pickup":35000,"pickup_xl":40000}'::jsonb);
  if v_saturday = v_today then v_saturday := v_today + 7; end if;

  -- Servicio con la etiqueta correcta para Pick-up XL.
  update public.inquiries i set service = 'Lavado a domicilio · Pick-up XL'
    from public.vehicles v, public.clients c
   where v.id = i.vehicle_id and c.id = i.client_id and c.is_demo and v.category = 'pickup_xl'
     and i.service = 'Lavado a domicilio · Auto';
  update public.appointments a set service = i.service
    from public.inquiries i, public.clients c
   where i.id = a.inquiry_id and c.id = a.client_id and c.is_demo and a.service <> i.service
     and i.service = 'Lavado a domicilio · Pick-up XL';

  -- Flyer de evento de prueba.
  insert into public.events (slug, title, event_date, place, description, button_label, active, is_demo)
  values (v_slug, 'El sábado estamos en Palmares (demo)', v_saturday, 'Palmares Open Mall',
          'Flyer de prueba: reservá tu lavado mientras hacés las compras.', 'Reservá tu turno', true, true)
  on conflict (slug) do nothing;

  -- Origen de reserva: web, flyer de WhatsApp y flyer del evento.
  update public.inquiries i set origen_reserva = 'web'
    from public.clients c where c.id = i.client_id and c.is_demo and i.source = 'web' and i.origen_reserva is null;
  update public.inquiries set origen_reserva = 'whatsapp_flyer'
   where id in (select i.id from public.inquiries i join public.clients c on c.id = i.client_id
                 where c.is_demo and i.source = 'web' order by random() limit 8);
  with picked as (
    select i.id from public.inquiries i
      join public.clients c on c.id = i.client_id
      join public.appointments a on a.inquiry_id = i.id
     where c.is_demo and a.status in ('solicitado', 'confirmado', 'esperando_cliente') and a.requested_start >= now()
     order by random() limit 10)
  update public.inquiries i set origen_reserva = 'evento:' || v_slug from picked p where p.id = i.id;
  get diagnostics v_n_event = row_count;

  -- Estado del vehículo con presupuesto estimado en ~40% de las reservas.
  for r in
    select i.id, coalesce((select sum(av.price_applied) from public.appointment_vehicles av where av.appointment_id = a.id), 0) base
      from public.inquiries i
      join public.appointments a on a.inquiry_id = i.id
      join public.clients c on c.id = i.client_id
     where c.is_demo and random() < 0.4
  loop
    v_wash := (array['30', '60', '60', '90', 'more'])[1 + floor(random() * 5)::int];
    select coalesce(array_agg(x), '{}') into v_conds
      from unnest(array['pets', 'mud', 'sand', 'stains', 'trash', 'odor']) x where random() < 0.2;
    update public.inquiries set notes = public._demo_condition_notes(v_wash, v_conds, r.base) where id = r.id;
    v_n_cond := v_n_cond + 1;
  end loop;

  -- Clientes con WhatsApp de otros países (y uno de Buenos Aires).
  for r in
    select * from (values
      (1, 'Camila Rojas (demo)', '56912000001', 'pickup_xl', 'Hotel Diplomatic, Belgrano 1041, Capital', array['mud', 'sand']),
      (2, 'Javier Martín (demo)', '34600000001', 'suv', 'Av. Arístides Villanueva 450, Capital', array['pets']),
      (3, 'Lucía Pereira (demo)', '59899000001', 'auto', 'Ruta 7 km 1050, Luján de Cuyo', array['stains']),
      (4, 'Bruno Costa (demo)', '5511990000001', 'pickup', 'Emilio Civit 600, Capital', array['pets', 'trash', 'odor']),
      (5, 'Mariano Vidal (demo)', '5491100000001', 'pickup_xl', 'Boulogne Sur Mer 1200, Capital', array[]::text[])
    ) t(n, name, whatsapp, cat, address, conds)
  loop
    v_client := null;
    insert into public.clients (full_name, whatsapp, source, privacy_consent_at, is_demo)
    values (r.name, r.whatsapp, 'web', now(), true)
    on conflict (whatsapp) do nothing
    returning id into v_client;
    continue when v_client is null;

    select id, brand, model into v_catid, v_brand, v_model
      from public.vehicle_catalog where active and category = r.cat order by random() limit 1;
    insert into public.vehicles (client_id, category, brand, model, catalog_id)
    values (v_client, r.cat, v_brand, v_model, v_catid) returning id into v_veh;
    v_price := coalesce((v_prices ->> r.cat)::int, 25000);

    v_day := v_today + 2 + r.n;
    if extract(dow from v_day) = 0 then v_day := v_day + 1; end if;

    insert into public.inquiries (client_id, vehicle_id, source, origen_reserva, service, extras, notes, commercial_status)
    values (v_client, v_veh, 'web', case when r.n = 1 then 'evento:' || v_slug else 'web' end,
            'Lavado a domicilio · ' || case r.cat when 'suv' then 'SUV' when 'pickup' then 'Pick-up' when 'pickup_xl' then 'Pick-up XL' else 'Auto' end,
            '{}', public._demo_condition_notes(case when r.n = 4 then '90' else '60' end, r.conds, v_price), 'turno_solicitado')
    returning id into v_inq;

    insert into public.appointments (client_id, vehicle_id, inquiry_id, service, extras, address, requested_start,
                                     duration_minutes, status, water_supply)
    values (v_client, v_veh, v_inq, (select service from public.inquiries where id = v_inq), '{}', r.address,
            (v_day + time '11:00') at time zone tz, 60, 'solicitado', 'domicilio')
    returning id into v_appt;

    insert into public.appointment_vehicles (appointment_id, vehicle_id, position, category, price_applied, classification, needs_review)
    values (v_appt, v_veh, 1, r.cat, v_price, 'catalogo', false);
    v_n_intl := v_n_intl + 1;
  end loop;

  -- Turnos cargados a mano desde el panel con datos incompletos.
  for r in
    select * from (values
      (1, 'Ezequiel Díaz (demo)', '5492610999001', 'telefono', 'pickup_xl', 'Ford', 'Raptor', '', 'Llamó por teléfono, pasa la dirección por WhatsApp.'),
      (2, 'Señora del barrio Dalvian (demo)', null, 'presencial', 'suv', null, null, 'Barrio Dalvian, Mendoza', 'Nos frenó en la calle, no dejó WhatsApp.'),
      (3, 'Sin nombre (demo)', '5492610999003', 'whatsapp', null, null, null, '', null),
      (4, 'Rodrigo Funes (demo)', '5492610999004', 'instagram', 'auto', 'Peugeot', '208', 'Cervantes 1500, Godoy Cruz', 'Escribió por Instagram, falta confirmar día.')
    ) t(n, name, whatsapp, source, cat, brand, model, address, comment)
  loop
    insert into public.clients (full_name, whatsapp, source, is_demo)
    values (r.name, r.whatsapp, r.source, true)
    returning id into v_client;

    v_veh := null;
    v_price := null;
    if r.cat is not null then
      insert into public.vehicles (client_id, category, brand, model) values (v_client, r.cat, r.brand, r.model)
      returning id into v_veh;
      v_price := coalesce((v_prices ->> r.cat)::int, 25000);
    end if;

    insert into public.inquiries (client_id, vehicle_id, source, service, extras, notes, commercial_status)
    values (v_client, v_veh, r.source, 'Lavado completo', '{}', r.comment, 'turno_solicitado')
    returning id into v_inq;

    insert into public.appointments (client_id, vehicle_id, inquiry_id, service, extras, address, requested_start,
                                     duration_minutes, status, water_supply, created_at, updated_at)
    values (v_client, v_veh, v_inq, 'Lavado completo', '{}', r.address, null,
            case r.cat when 'pickup_xl' then 105 when 'suv' then 75 when 'pickup' then 90 when 'auto' then 60 else 90 end,
            'solicitado', 'domicilio', now() - make_interval(hours => r.n), now() - make_interval(hours => r.n))
    returning id into v_appt;

    if v_veh is not null then
      insert into public.appointment_vehicles (appointment_id, vehicle_id, position, category, price_applied, classification, needs_review)
      values (v_appt, v_veh, 1, r.cat, v_price, 'manual', true);
    end if;
    v_n_manual := v_n_manual + 1;
  end loop;

  select count(*) into v_n from public.appointment_vehicles av
    join public.appointments a on a.id = av.appointment_id join public.clients c on c.id = a.client_id
   where c.is_demo and av.category = 'pickup_xl';

  return jsonb_build_object('condition_notes', v_n_cond, 'event_bookings', v_n_event + 1,
                            'international_clients', v_n_intl, 'manual_bookings', v_n_manual, 'pickup_xl_vehicles', v_n);
end $$;

create or replace function public._purge_demo_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_expenses int;
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.clients where is_demo;

  delete from public.status_history h
   where (h.entity = 'inquiry' and h.entity_id in (select id from public.inquiries where client_id = any(v_ids)))
      or (h.entity = 'appointment' and h.entity_id in (select id from public.appointments where client_id = any(v_ids)))
      or (h.entity = 'service' and h.entity_id in (select id from public.services where client_id = any(v_ids)));
  delete from public.client_audit_log where client_id = any(v_ids);

  perform set_config('mk.client_delete', 'on', true);
  delete from public.clients where id = any(v_ids);
  perform set_config('mk.client_delete', 'off', true);

  delete from public.expenses where is_demo;
  get diagnostics v_expenses = row_count;

  delete from public.events where is_demo;

  return jsonb_build_object('clients', cardinality(v_ids), 'expenses', v_expenses);
end;
$$;

create or replace function public.seed_demo_data(p_vehicles_per_month int default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_result := public._seed_demo_data(p_vehicles_per_month);
  return v_result || jsonb_build_object('extras', public._seed_demo_extras());
end;
$$;

revoke all on function public._demo_money(numeric) from public, anon, authenticated;
revoke all on function public._demo_condition_notes(text, text[], numeric) from public, anon, authenticated;
revoke all on function public._seed_demo_extras() from public, anon, authenticated;
revoke all on function public._purge_demo_data() from public, anon, authenticated;
revoke all on function public.seed_demo_data(int) from public, anon;
grant execute on function public.seed_demo_data(int) to authenticated;
