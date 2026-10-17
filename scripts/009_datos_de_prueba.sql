-- Datos de prueba: clientes, vehículos, turnos, servicios, cobros y gastos ficticios
-- marcados con is_demo = true. Se generan y eliminan desde /admin/pruebas y se
-- eliminan automáticamente el 22/10 a las 00:00 (hora de Mendoza) vía pg_cron.

alter table public.clients add column if not exists is_demo boolean not null default false;
alter table public.expenses add column if not exists is_demo boolean not null default false;
create index if not exists clients_is_demo_idx on public.clients (is_demo) where is_demo;
create index if not exists expenses_is_demo_idx on public.expenses (is_demo) where is_demo;

create or replace function public._purge_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  return jsonb_build_object('clients', cardinality(v_ids), 'expenses', v_expenses);
end;
$$;

create or replace function public._seed_demo_data(p_vehicles_per_month int default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'America/Argentina/Mendoza';
  first_names text[] := array['Lucía','Martín','Sofía','Juan','Valentina','Facundo','Camila','Nicolás','Agustina','Matías',
    'Florencia','Santiago','Julieta','Federico','Micaela','Gonzalo','Carolina','Tomás','Paula','Diego','Belén','Ignacio',
    'Rocío','Joaquín','Milagros','Lautaro','Natalia','Emiliano','Daniela','Franco'];
  last_names text[] := array['Fernández','González','Rodríguez','López','Martínez','García','Pérez','Sánchez','Romero',
    'Díaz','Álvarez','Torres','Ruiz','Gómez','Sosa','Castro','Molina','Ortiz','Herrera','Videla','Lucero','Correa',
    'Quiroga','Ponce','Funes','Aguirre','Morales','Giménez'];
  streets text[] := array['Av. San Martín','Belgrano','Colón','Av. Arístides Villanueva','Paso de los Andes','Emilio Civit',
    'Boulogne Sur Mer','Perú','Rivadavia','Godoy Cruz','Av. Acceso Este','Bandera de los Andes','Ozamis','Pedro Molina',
    'Sarmiento','Av. Champagnat','Viamonte','Tiburcio Benegas','Av. Mitre','Cervantes'];
  zones text[] := array['Capital','Godoy Cruz','Guaymallén','Las Heras','Luján de Cuyo','Maipú','Chacras de Coria'];
  methods text[] := array['efectivo','transferencia','mercadopago','efectivo','transferencia'];
  cancel_reasons text[] := array['El cliente canceló por lluvia','Le surgió un viaje','Reprogramará más adelante',
    'No había agua en el domicilio','No respondió la confirmación'];
  v_prices jsonb;
  v_now timestamptz := now();
  v_today date := (now() at time zone tz)::date;
  v_pool uuid[] := '{}';
  v_old_pool uuid[] := '{}';
  v_client uuid;
  v_month date;
  v_day date;
  v_days date[];
  v_rem int;
  v_target int;
  v_left int;
  v_cursor int;
  v_nveh int;
  v_start timestamptz;
  v_created timestamptz;
  v_dur int;
  v_status text;
  v_inq_status text;
  v_appt uuid;
  v_inq uuid;
  v_srv uuid;
  v_veh uuid;
  v_first_veh uuid;
  v_first_cat text;
  v_used uuid[];
  v_vehs uuid[];
  v_cats text[];
  v_vprices int[];
  v_cat text;
  v_brand text;
  v_model text;
  v_catid uuid;
  v_total numeric;
  v_paid numeric;
  v_extras text[];
  v_water text;
  v_r float8;
  v_n_appts int := 0;
  v_n_veh int := 0;
  v_n_srv int := 0;
  v_n_exp int := 0;
  i int;
  k int;
begin
  if exists (select 1 from public.clients where is_demo) then
    raise exception 'Ya hay datos de prueba cargados. Eliminalos antes de generar nuevos.' using errcode = 'P0001';
  end if;
  if p_vehicles_per_month is null or p_vehicles_per_month not between 10 and 300 then
    raise exception 'La cantidad de vehículos por mes debe estar entre 10 y 300.' using errcode = '22023';
  end if;

  select vehicle_prices into v_prices from public.settings where id = 1;
  v_prices := coalesce(v_prices, '{"auto":25000,"suv":30000,"pickup":35000}'::jsonb);

  -- Clientes ficticios (WhatsApp en el rango 549 2610 xxxxxx, reservado para pruebas).
  for i in 1..90 loop
    v_client := null;
    v_r := random();
    insert into public.clients (full_name, whatsapp, email, source, privacy_consent_at, marketing_consent,
                                marketing_consent_at, is_demo)
    values (
      first_names[1 + floor(random() * cardinality(first_names))::int] || ' '
        || last_names[1 + floor(random() * cardinality(last_names))::int] || ' (demo)',
      '5492610' || lpad(i::text, 6, '0'),
      case when random() < 0.4 then 'demo' || i || '@ejemplo.com' end,
      case when v_r < 0.6 then 'web' when v_r < 0.85 then 'whatsapp' else 'instagram' end,
      v_now,
      v_r < 0.7,
      case when v_r < 0.7 then v_now end,
      true
    )
    on conflict (whatsapp) do nothing
    returning id into v_client;
    if v_client is not null then
      if i <= 78 then v_pool := v_pool || v_client; else v_old_pool := v_old_pool || v_client; end if;
    end if;
  end loop;

  -- Turnos del mes actual y el siguiente.
  for v_month in select generate_series(date_trunc('month', v_today::timestamp), date_trunc('month', v_today::timestamp) + interval '1 month', interval '1 month')::date loop
    select array_agg(d::date order by d) into v_days
      from generate_series(v_month::timestamp, (v_month + interval '1 month' - interval '1 day')::timestamp, interval '1 day') d
     where extract(dow from d) <> 0
       and not exists (select 1 from public.blocked_dates b where b.day = d::date);
    v_rem := p_vehicles_per_month;

    for i in 1..coalesce(cardinality(v_days), 0) loop
      exit when v_rem <= 0;
      v_day := v_days[i];
      v_target := greatest(1, round(v_rem::numeric / (cardinality(v_days) - i + 1) + (random() - 0.5) * 2)::int);
      v_left := least(v_target, v_rem);
      v_cursor := case when random() < 0.3 then 60 else 0 end;

      while v_left > 0 and v_cursor <= 8 * 60 loop
        v_nveh := least(v_left, case when random() < 0.22 then 2 else 1 end);
        v_dur := 60 * v_nveh;
        v_start := (v_day + make_interval(mins => 9 * 60 + v_cursor)) at time zone tz;
        v_cursor := (ceil((v_cursor + v_dur + 30) / 60.0) * 60)::int;
        v_left := v_left - v_nveh;
        v_rem := v_rem - v_nveh;

        v_r := random();
        if v_start < v_now then
          v_status := case when v_r < 0.78 then 'realizado' when v_r < 0.87 then 'cancelado'
                           when v_r < 0.93 then 'rechazado' else 'confirmado' end;
        else
          v_status := case when v_r < 0.55 then 'confirmado' when v_r < 0.78 then 'solicitado'
                           when v_r < 0.88 then 'esperando_cliente' when v_r < 0.94 then 'reprogramado' else 'cancelado' end;
        end if;
        if v_status = 'confirmado' and exists (select 1 from public.appointment_slot_conflicts(v_start, v_dur, null, null)) then
          v_status := 'solicitado';
        end if;

        if v_status in ('solicitado', 'esperando_cliente', 'reprogramado') then
          v_created := v_now - random() * interval '60 hours';
        else
          v_created := least(v_start - (1 + random() * 5) * interval '1 day', v_now - random() * interval '5 days');
        end if;

        v_client := v_pool[1 + floor(random() * cardinality(v_pool))::int];

        v_used := '{}';
        v_vehs := '{}';
        v_cats := '{}';
        v_vprices := '{}';
        for k in 1..v_nveh loop
          v_veh := null;
          if random() < 0.7 then
            select id, category into v_veh, v_cat from public.vehicles
             where client_id = v_client and not (id = any(v_used)) order by random() limit 1;
          end if;
          if v_veh is null then
            select id, brand, model, category into v_catid, v_brand, v_model, v_cat
              from public.vehicle_catalog where active and category is not null order by random() limit 1;
            insert into public.vehicles (client_id, category, brand, model, catalog_id, created_at)
            values (v_client, v_cat, v_brand, v_model, v_catid, v_created)
            returning id into v_veh;
          end if;
          v_used := v_used || v_veh;
          v_vehs := v_vehs || v_veh;
          v_cats := v_cats || v_cat;
          v_vprices := v_vprices || coalesce((v_prices ->> v_cat)::int, 25000);
        end loop;
        v_first_veh := v_vehs[1];
        v_first_cat := v_cats[1];
        select sum(p) into v_total from unnest(v_vprices) p;

        v_r := random();
        v_extras := case when v_r < 0.12 then array['tapizados'] when v_r < 0.2 then array['motor'] else '{}'::text[] end;
        v_water := case when random() < 0.65 then 'domicilio' else 'propia' end;

        v_inq_status := case v_status
          when 'solicitado' then 'turno_solicitado'
          when 'esperando_cliente' then 'turno_solicitado'
          when 'reprogramado' then 'reprogramado'
          when 'confirmado' then 'turno_confirmado'
          when 'realizado' then 'servicio_realizado'
          when 'cancelado' then 'cancelado'
          else 'no_contratado' end;

        insert into public.inquiries (client_id, vehicle_id, source, service, extras, commercial_status, created_at, updated_at)
        values (v_client, v_first_veh, 'web',
                case when v_nveh = 1 then 'Lavado a domicilio · ' || case v_first_cat when 'suv' then 'SUV' when 'pickup' then 'Pick-up' else 'Auto' end
                     else 'Lavado a domicilio · ' || v_nveh || ' vehículos' end,
                v_extras, v_inq_status, v_created, v_created)
        returning id into v_inq;

        insert into public.appointments (client_id, vehicle_id, inquiry_id, service, extras, address, requested_start,
                                         confirmed_start, duration_minutes, status, agreed_price, water_supply,
                                         cancel_reason, created_at, updated_at, confirmed_at)
        values (
          v_client, v_first_veh, v_inq,
          (select service from public.inquiries where id = v_inq),
          v_extras,
          streets[1 + floor(random() * cardinality(streets))::int] || ' ' || (100 + floor(random() * 3900))::int
            || ', ' || zones[1 + floor(random() * cardinality(zones))::int],
          v_start,
          case when v_status in ('confirmado', 'realizado') then v_start end,
          v_dur,
          v_status,
          case when v_status in ('confirmado', 'realizado') then v_total end,
          v_water,
          case when v_status = 'cancelado' then cancel_reasons[1 + floor(random() * cardinality(cancel_reasons))::int] end,
          v_created, v_created,
          case when v_status in ('confirmado', 'realizado') then least(v_created + interval '2 hours', v_now) end
        )
        returning id into v_appt;

        insert into public.appointment_vehicles (appointment_id, vehicle_id, position, category, price_applied, classification, needs_review)
        select v_appt, v_vehs[j], j, v_cats[j], v_vprices[j], 'catalogo', false from generate_subscripts(v_vehs, 1) j;

        if v_status = 'esperando_cliente' then
          insert into public.appointment_proposals (appointment_id, original_start, proposed_start, duration_minutes, status, proposed_at)
          values (v_appt, v_start, v_start + interval '1 day', v_dur, 'pendiente', least(v_created + interval '1 hour', v_now));
        end if;

        if v_status = 'realizado' then
          insert into public.services (appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at,
                                       agreed_price, final_price, created_at)
          values (v_appt, v_client, v_first_veh, v_first_cat,
                  case when v_water = 'propia' then 'Lavado con agua propia' else 'Lavado con agua del domicilio' end,
                  least(v_start + make_interval(mins => v_dur), v_now), v_total, v_total,
                  least(v_start + make_interval(mins => v_dur), v_now))
          returning id into v_srv;
          v_n_srv := v_n_srv + 1;

          v_r := random();
          v_paid := case when v_r < 0.72 then v_total when v_r < 0.84 then round(v_total * 0.5 / 100) * 100 else 0 end;
          if v_paid > 0 then
            insert into public.payments (service_id, amount, method, paid_at)
            values (v_srv, v_paid, methods[1 + floor(random() * cardinality(methods))::int],
                    least(v_start + make_interval(mins => v_dur), v_now));
          end if;
          if v_paid >= v_total then
            update public.inquiries set commercial_status = 'cobrado' where id = v_inq;
          end if;
        end if;

        v_n_appts := v_n_appts + 1;
        v_n_veh := v_n_veh + v_nveh;
      end loop;
    end loop;
  end loop;

  -- Clientes que lavaron hace más de un mes (para la pantalla Recontactar).
  for i in 1..coalesce(cardinality(v_old_pool), 0) loop
    v_client := v_old_pool[i];
    v_start := ((v_today - (35 + floor(random() * 50))::int) + make_interval(hours => 10 + floor(random() * 6)::int)) at time zone tz;
    select id, brand, model, category into v_catid, v_brand, v_model, v_cat
      from public.vehicle_catalog where active and category is not null order by random() limit 1;
    v_total := coalesce((v_prices ->> v_cat)::int, 25000);
    insert into public.vehicles (client_id, category, brand, model, catalog_id, created_at)
    values (v_client, v_cat, v_brand, v_model, v_catid, v_start - interval '3 days') returning id into v_veh;
    insert into public.inquiries (client_id, vehicle_id, source, service, commercial_status, created_at, updated_at)
    values (v_client, v_veh, 'web', 'Lavado a domicilio', 'cobrado', v_start - interval '3 days', v_start)
    returning id into v_inq;
    insert into public.appointments (client_id, vehicle_id, inquiry_id, service, address, requested_start, confirmed_start,
                                     duration_minutes, status, agreed_price, created_at, updated_at, confirmed_at)
    values (v_client, v_veh, v_inq, 'Lavado a domicilio',
            streets[1 + floor(random() * cardinality(streets))::int] || ' ' || (100 + floor(random() * 3900))::int
              || ', ' || zones[1 + floor(random() * cardinality(zones))::int],
            v_start, v_start, 60, 'realizado', v_total, v_start - interval '3 days', v_start, v_start - interval '2 days')
    returning id into v_appt;
    insert into public.appointment_vehicles (appointment_id, vehicle_id, position, category, price_applied, classification)
    values (v_appt, v_veh, 1, v_cat, v_total, 'catalogo');
    insert into public.services (appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at,
                                 agreed_price, final_price, created_at)
    values (v_appt, v_client, v_veh, v_cat, 'Lavado con agua del domicilio', v_start + interval '1 hour', v_total, v_total, v_start)
    returning id into v_srv;
    insert into public.payments (service_id, amount, method, paid_at)
    values (v_srv, v_total, methods[1 + floor(random() * cardinality(methods))::int], v_start + interval '1 hour');
    v_n_appts := v_n_appts + 1;
    v_n_veh := v_n_veh + 1;
    v_n_srv := v_n_srv + 1;
  end loop;

  -- Gastos de los días ya transcurridos del mes actual.
  for v_day in select d::date from generate_series(date_trunc('month', v_today::timestamp), v_today::timestamp, interval '1 day') d
               where extract(dow from d) <> 0 loop
    for k in 1..(case when random() < 0.35 then 2 when random() < 0.6 then 1 else 0 end) loop
      v_r := random();
      insert into public.expenses (spent_on, category, amount, method, description, is_demo)
      values (
        v_day,
        case when v_r < 0.45 then 'combustible' when v_r < 0.75 then 'productos' when v_r < 0.85 then 'mantenimiento'
             when v_r < 0.95 then 'publicidad' else 'otro' end,
        case when v_r < 0.45 then 8000 + round(random() * 12) * 1000 when v_r < 0.75 then 15000 + round(random() * 45) * 1000
             when v_r < 0.85 then 10000 + round(random() * 30) * 1000 when v_r < 0.95 then 20000 + round(random() * 30) * 1000
             else 3000 + round(random() * 7) * 1000 end,
        methods[1 + floor(random() * cardinality(methods))::int],
        case when v_r < 0.45 then 'Nafta camioneta' when v_r < 0.75 then 'Shampoo, cera y microfibras'
             when v_r < 0.85 then 'Service hidrolavadora' when v_r < 0.95 then 'Publicidad Instagram' else 'Varios' end || ' (demo)',
        true
      );
      v_n_exp := v_n_exp + 1;
    end loop;
  end loop;

  update public.clients c
     set created_at = coalesce((select min(a.created_at) from public.appointments a where a.client_id = c.id), v_now - interval '20 days'),
         last_interaction_at = coalesce((select max(greatest(a.created_at, least(a.requested_start, v_now))) from public.appointments a where a.client_id = c.id), v_now - interval '20 days')
   where c.is_demo;

  -- Consultas sueltas, sin turno.
  for i in 1..15 loop
    v_r := random();
    insert into public.inquiries (client_id, source, service, commercial_status, created_at, updated_at)
    values (v_pool[1 + floor(random() * cardinality(v_pool))::int],
            case when random() < 0.5 then 'whatsapp' else 'instagram' end,
            'Consulta de precio · lavado a domicilio',
            case when v_r < 0.35 then 'nueva' when v_r < 0.6 then 'pendiente_respuesta'
                 when v_r < 0.8 then 'presupuesto_enviado' else 'no_contratado' end,
            v_now - random() * interval '6 days', v_now - random() * interval '6 hours');
  end loop;

  return jsonb_build_object('clients', cardinality(v_pool) + cardinality(v_old_pool), 'appointments', v_n_appts,
                            'vehicles', v_n_veh, 'services', v_n_srv, 'expenses', v_n_exp);
end;
$$;

create or replace function public.seed_demo_data(p_vehicles_per_month int default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public._seed_demo_data(p_vehicles_per_month);
end;
$$;

create or replace function public.purge_demo_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public._purge_demo_data();
end;
$$;

create or replace function public.demo_data_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_schedule text;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  begin
    select schedule into v_schedule from cron.job where jobname = 'mk-purge-demo';
  exception when others then v_schedule := null;
  end;
  return jsonb_build_object(
    'clients', (select count(*) from public.clients where is_demo),
    'appointments', (select count(*) from public.appointments a join public.clients c on c.id = a.client_id where c.is_demo),
    'services', (select count(*) from public.services s join public.clients c on c.id = s.client_id where c.is_demo),
    'expenses', (select count(*) from public.expenses where is_demo),
    'auto_purge_scheduled', v_schedule is not null
  );
end;
$$;

revoke all on function public._seed_demo_data(int) from public, anon, authenticated;
revoke all on function public._purge_demo_data() from public, anon, authenticated;
revoke all on function public.seed_demo_data(int) from public, anon;
revoke all on function public.purge_demo_data() from public, anon;
revoke all on function public.demo_data_status() from public, anon;
grant execute on function public.seed_demo_data(int) to authenticated;
grant execute on function public.purge_demo_data() to authenticated;
grant execute on function public.demo_data_status() to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'mk-purge-demo';
-- 03:00 UTC = 00:00 en Mendoza. El job se da de baja solo después de ejecutarse.
select cron.schedule('mk-purge-demo', '0 3 22 10 *',
  $job$select public._purge_demo_data(); select cron.unschedule('mk-purge-demo');$job$);
