-- 011 · Solicitudes sin fecha, propuesta con enlace seguro, notas internas, alias de transferencia,
-- pagos verificados por transferencia e ingresos sin duplicados.
-- Aditiva: no borra datos ni reescribe historial. Probar SOLO en la base de pruebas antes de producción.
-- Requiere 001, 002, 004 y 008. No depende de 010 (zonas).
begin;

-- 1. Solicitudes sin fecha: MK Cars propone los horarios ------------------------------------
alter table public.appointments alter column requested_start drop not null;
alter table public.appointments
  add column if not exists neighborhood text check (neighborhood is null or length(neighborhood) <= 120),
  add column if not exists discount numeric(12, 2) not null default 0 check (discount >= 0),
  add column if not exists amount_paid numeric(12, 2) not null default 0,
  add column if not exists payment_status text not null default 'pendiente'
    check (payment_status in ('pendiente', 'parcial', 'pagado')),
  add column if not exists created_by uuid default auth.uid();

-- 2. Alias de transferencia (lo ve el cliente recién cuando el turno está confirmado) --------
alter table public.settings
  add column if not exists transfer_alias text check (transfer_alias is null or length(transfer_alias) between 3 and 60),
  add column if not exists transfer_holder text check (transfer_holder is null or length(transfer_holder) <= 120),
  add column if not exists transfer_bank text check (transfer_bank is null or length(transfer_bank) <= 80);

-- 3. Notas internas: ilimitadas, solo se agregan, nunca se editan ni se borran ---------------
create table if not exists public.appointment_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  author_id uuid default auth.uid(),
  author_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);
create index if not exists appointment_notes_appt_idx on public.appointment_notes (appointment_id, created_at desc);
alter table public.appointment_notes enable row level security;
drop policy if exists appointment_notes_admin_select on public.appointment_notes;
drop policy if exists appointment_notes_admin_insert on public.appointment_notes;
create policy appointment_notes_admin_select on public.appointment_notes for select to authenticated using (public.is_admin());
create policy appointment_notes_admin_insert on public.appointment_notes for insert to authenticated
  with check (public.is_admin() and author_id = auth.uid());

-- 4. Propuesta con enlace seguro: un enlace por turno, versionado --------------------------
create table if not exists public.appointment_offers (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  -- 48 caracteres hex a partir de dos UUID v4 (~180 bits aleatorios); gen_random_uuid es nativo de Postgres.
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 16)),
  version integer not null default 1,
  status text not null default 'enviada'
    check (status in ('enviada', 'aceptada', 'pide_alternativas', 'mas_adelante', 'anulada')),
  service_label text not null check (length(trim(service_label)) between 2 and 200),
  total_price numeric(12, 2) not null check (total_price >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  conditions text check (conditions is null or length(conditions) <= 2000),
  slots jsonb not null check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) between 1 and 6),
  accepted_start timestamptz,
  accepted_version integer,
  accepted_snapshot jsonb,
  accepted_at timestamptz,
  client_message text check (client_message is null or length(client_message) <= 500),
  responded_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount <= total_price)
);
create table if not exists public.appointment_offer_events (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.appointment_offers(id) on delete cascade,
  version integer not null,
  kind text not null check (kind in ('creada', 'actualizada', 'aceptada', 'pide_alternativas', 'mas_adelante', 'reabierta', 'anulada')),
  snapshot jsonb not null,
  actor uuid,
  actor_label text not null,
  created_at timestamptz not null default now()
);
create index if not exists appointment_offer_events_offer_idx on public.appointment_offer_events (offer_id, created_at desc);

alter table public.appointment_offers enable row level security;
alter table public.appointment_offer_events enable row level security;
drop policy if exists appointment_offers_admin_select on public.appointment_offers;
drop policy if exists appointment_offer_events_admin_select on public.appointment_offer_events;
-- Sin políticas de escritura: solo se modifican por las funciones de abajo.
create policy appointment_offers_admin_select on public.appointment_offers for select to authenticated using (public.is_admin());
create policy appointment_offer_events_admin_select on public.appointment_offer_events for select to authenticated using (public.is_admin());

create or replace function public.offer_snapshot(o public.appointment_offers)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('version', o.version, 'service', o.service_label, 'total', o.total_price,
    'discount', o.discount, 'conditions', o.conditions, 'slots', o.slots, 'accepted_start', o.accepted_start)
$$;

-- Valida y normaliza los horarios ofrecidos: [{start, duration}] futuros, en horario laboral, sin repetir.
create or replace function public.offer_normalize_slots(p_slots jsonb, p_default_duration integer)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  s jsonb;
  v_start timestamptz;
  v_duration integer;
  result jsonb := '[]'::jsonb;
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 6 then
    raise exception 'Ofrecé entre 1 y 6 horarios.' using errcode = '22023';
  end if;
  for s in select * from jsonb_array_elements(p_slots) loop
    begin
      v_start := (s ->> 'start')::timestamptz;
    exception when others then
      raise exception 'Hay un horario con formato inválido.' using errcode = '22023';
    end;
    v_duration := coalesce((s ->> 'duration')::integer, p_default_duration);
    if v_start is null then raise exception 'Hay un horario sin fecha.' using errcode = '22023'; end if;
    if v_start < now() then raise exception 'Hay un horario que ya pasó.' using errcode = 'P0001'; end if;
    if v_duration not between 15 and 540 then raise exception 'Duración inválida.' using errcode = '22023'; end if;
    perform public.assert_business_hours(v_start, v_duration);
    if result @> jsonb_build_array(jsonb_build_object('start', v_start)) then
      raise exception 'Hay horarios repetidos.' using errcode = 'P0001';
    end if;
    result := result || jsonb_build_array(jsonb_build_object('start', v_start, 'duration', v_duration));
  end loop;
  return (select jsonb_agg(e order by (e ->> 'start')::timestamptz) from jsonb_array_elements(result) e);
end $$;

-- Crea o actualiza la propuesta. Si ya fue aceptada, bloquea: hay que reabrirla explícitamente.
create or replace function public.save_appointment_offer(
  p_appointment_id uuid, p_slots jsonb, p_total numeric, p_discount numeric, p_conditions text, p_service text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  appt public.appointments%rowtype;
  o public.appointment_offers%rowtype;
  v_slots jsonb;
  v_discount numeric := round(coalesce(p_discount, 0), 2);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  if appt.status not in ('solicitado', 'reprogramado', 'esperando_cliente') then
    raise exception 'Este turno no admite una propuesta nueva. Si ya está confirmado, reabrí la propuesta.' using errcode = 'P0001';
  end if;
  if p_total is null or p_total < 0 or p_total > 100000000 then raise exception 'Importe inválido.' using errcode = '22023'; end if;
  if v_discount < 0 or v_discount > p_total then raise exception 'El descuento no puede superar el importe.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_service, ''))) < 2 then raise exception 'Indicá el servicio.' using errcode = '22023'; end if;
  v_slots := public.offer_normalize_slots(p_slots, appt.duration_minutes);

  select * into o from public.appointment_offers where appointment_id = p_appointment_id for update;
  if found and o.status = 'aceptada' then
    raise exception 'El cliente ya aceptó estas condiciones. Reabrí la propuesta para cambiarlas.' using errcode = 'P0001';
  end if;

  if found then
    update public.appointment_offers
       set version = o.version + 1, status = 'enviada', service_label = trim(p_service), total_price = round(p_total, 2),
           discount = v_discount, conditions = nullif(trim(p_conditions), ''), slots = v_slots,
           client_message = null, responded_at = null, updated_at = now()
     where id = o.id returning * into o;
    insert into public.appointment_offer_events (offer_id, version, kind, snapshot, actor, actor_label)
    values (o.id, o.version, 'actualizada', public.offer_snapshot(o), auth.uid(), coalesce(auth.jwt() ->> 'email', 'admin'));
  else
    insert into public.appointment_offers (appointment_id, service_label, total_price, discount, conditions, slots)
    values (p_appointment_id, trim(p_service), round(p_total, 2), v_discount, nullif(trim(p_conditions), ''), v_slots)
    returning * into o;
    insert into public.appointment_offer_events (offer_id, version, kind, snapshot, actor, actor_label)
    values (o.id, o.version, 'creada', public.offer_snapshot(o), auth.uid(), coalesce(auth.jwt() ->> 'email', 'admin'));
  end if;

  update public.appointment_proposals set status = 'anulada', responded_at = now(), responded_by = auth.uid()
   where appointment_id = p_appointment_id and status = 'pendiente';
  update public.appointments
     set status = 'esperando_cliente', confirmed_start = null, confirmed_at = null,
         agreed_price = round(p_total - v_discount, 2), discount = v_discount
   where id = p_appointment_id;
  update public.inquiries set commercial_status = 'presupuesto_enviado'
   where id = appt.inquiry_id and commercial_status in ('nueva', 'pendiente_respuesta', 'turno_solicitado', 'reprogramado');
  return o.token;
end $$;

-- Reabre una propuesta aceptada: guarda lo aceptado en el historial y libera el horario.
create or replace function public.reopen_appointment_offer(p_appointment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  appt public.appointments%rowtype;
  o public.appointment_offers%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  select * into o from public.appointment_offers where appointment_id = p_appointment_id for update;
  if not found or o.status <> 'aceptada' then raise exception 'No hay una propuesta aceptada para reabrir.' using errcode = 'P0001'; end if;
  if appt.status <> 'confirmado' then raise exception 'Solo se reabren turnos confirmados sin servicio realizado.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payments p where p.appointment_id = p_appointment_id and p.voided_at is null) then
    raise exception 'El turno ya tiene pagos registrados. Anulalos antes de cambiar las condiciones.' using errcode = 'P0001';
  end if;

  insert into public.appointment_offer_events (offer_id, version, kind, snapshot, actor, actor_label)
  values (o.id, o.version, 'reabierta',
          public.offer_snapshot(o) || jsonb_build_object('accepted_snapshot', o.accepted_snapshot, 'reason', nullif(trim(p_reason), '')),
          auth.uid(), coalesce(auth.jwt() ->> 'email', 'admin'));
  update public.appointment_offers
     set version = o.version + 1, status = 'enviada', accepted_start = null, accepted_version = null,
         accepted_at = null, responded_at = null, client_message = null, updated_at = now()
   where id = o.id;
  update public.appointments set status = 'esperando_cliente', confirmed_start = null, confirmed_at = null where id = p_appointment_id;
end $$;

-- Lectura pública por token: solo los datos que el cliente necesita ver.
create or replace function public.get_appointment_offer(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  o public.appointment_offers%rowtype;
  a public.appointments%rowtype;
  st public.settings%rowtype;
  v_name text;
  v_vehicles jsonb;
  v_slots jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then return null; end if;
  select * into o from public.appointment_offers where token = p_token;
  if not found or o.status = 'anulada' then return null; end if;
  select * into a from public.appointments where id = o.appointment_id;
  select * into st from public.settings where id = 1;
  select split_part(trim(c.full_name), ' ', 1) into v_name from public.clients c where c.id = a.client_id;
  select coalesce(jsonb_agg(trim(concat_ws(' ', v.brand, v.model, '(' || v.category || ')'))), '[]'::jsonb)
    into v_vehicles from public.vehicles v
   where v.id = a.vehicle_id;

  -- Cada horario indica si sigue libre ahora mismo; los ocupados se muestran como no disponibles.
  select coalesce(jsonb_agg(jsonb_build_object(
           'start', e ->> 'start', 'duration', (e ->> 'duration')::int,
           'available', (e ->> 'start')::timestamptz > now()
             and (select count(*) from public.appointment_slot_conflicts((e ->> 'start')::timestamptz, (e ->> 'duration')::int, a.id, a.operator))
                 < coalesce(st.operational_capacity, 1))
         order by (e ->> 'start')::timestamptz), '[]'::jsonb)
    into v_slots from jsonb_array_elements(o.slots) e;

  return jsonb_build_object(
    'version', o.version, 'status', o.status, 'appointment_status', a.status,
    'client_first_name', v_name, 'address', a.address, 'service', o.service_label,
    'extras', to_jsonb(a.extras), 'vehicles', v_vehicles,
    'total', o.total_price, 'discount', o.discount, 'final', o.total_price - o.discount,
    'conditions', o.conditions, 'slots', v_slots, 'accepted_start', o.accepted_start,
    'duration', a.duration_minutes,
    'payment', case when o.status = 'aceptada' and a.status in ('confirmado', 'realizado') then jsonb_build_object(
      'alias', st.transfer_alias, 'holder', st.transfer_holder, 'bank', st.transfer_bank,
      'paid', a.amount_paid, 'status', a.payment_status) end
  );
end $$;

-- Respuesta del cliente. Aceptar confirma el turno de forma atómica (el trigger de capacidad
-- impide superposiciones). La versión evita aceptar condiciones que el admin ya cambió.
create or replace function public.respond_appointment_offer(
  p_token text, p_action text, p_version integer, p_start timestamptz default null, p_message text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.appointment_offers%rowtype;
  a public.appointments%rowtype;
  v_slot jsonb;
  v_message text := nullif(trim(left(coalesce(p_message, ''), 500)), '');
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then raise exception 'Enlace inválido.' using errcode = 'P0001'; end if;
  select * into o from public.appointment_offers where token = p_token for update;
  if not found or o.status = 'anulada' then raise exception 'Enlace inválido.' using errcode = 'P0001'; end if;
  if o.status = 'aceptada' then raise exception 'Esta propuesta ya fue aceptada.' using errcode = 'P0001'; end if;
  if p_version is distinct from o.version then
    raise exception 'MK Cars actualizó la propuesta. Recargá la página para ver las condiciones nuevas.' using errcode = 'P0001';
  end if;
  select * into a from public.appointments where id = o.appointment_id for update;
  if a.status <> 'esperando_cliente' then raise exception 'Esta propuesta ya no está disponible.' using errcode = 'P0001'; end if;

  if p_action = 'aceptar' then
    select e into v_slot from jsonb_array_elements(o.slots) e where (e ->> 'start')::timestamptz = p_start;
    if v_slot is null then raise exception 'Elegí uno de los horarios ofrecidos.' using errcode = 'P0001'; end if;
    if p_start < now() then raise exception 'Ese horario ya pasó. Elegí otro.' using errcode = 'P0001'; end if;
    begin
      update public.appointments
         set status = 'confirmado', confirmed_start = p_start, confirmed_at = now(),
             duration_minutes = (v_slot ->> 'duration')::int,
             agreed_price = o.total_price - o.discount, discount = o.discount, service = o.service_label
       where id = a.id;
    exception when sqlstate 'P0001' then
      raise exception 'Ese horario acaba de ocuparse. Elegí otro de la lista.' using errcode = 'P0001';
    end;
    update public.appointment_offers
       set status = 'aceptada', accepted_start = p_start, accepted_version = o.version, accepted_at = now(),
           responded_at = now(), client_message = v_message,
           accepted_snapshot = public.offer_snapshot(o) || jsonb_build_object('accepted_start', p_start)
     where id = o.id returning * into o;
    update public.inquiries set commercial_status = 'convertida'
     where id = a.inquiry_id
       and commercial_status in ('nueva', 'pendiente_respuesta', 'presupuesto_enviado', 'turno_solicitado', 'reprogramado');
  elsif p_action in ('pide_alternativas', 'mas_adelante') then
    update public.appointment_offers set status = p_action, responded_at = now(), client_message = v_message
     where id = o.id returning * into o;
    if p_action = 'mas_adelante' then
      update public.inquiries set commercial_status = 'pendiente_respuesta'
       where id = a.inquiry_id and commercial_status in ('nueva', 'presupuesto_enviado', 'turno_solicitado');
    end if;
  else
    raise exception 'Acción inválida.' using errcode = '22023';
  end if;

  insert into public.appointment_offer_events (offer_id, version, kind, snapshot, actor, actor_label)
  values (o.id, o.version, case when p_action = 'aceptar' then 'aceptada' else p_action end,
          public.offer_snapshot(o) || jsonb_build_object('message', v_message), null, 'cliente');
  return jsonb_build_object('status', o.status, 'accepted_start', o.accepted_start);
end $$;

-- 5. Alta manual de turnos desde el panel (WhatsApp, teléfono, Instagram) -------------------
create or replace function public.admin_create_appointment(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_whatsapp text := regexp_replace(coalesce(p ->> 'whatsapp', ''), '\D', '', 'g');
  v_name text := trim(coalesce(p ->> 'full_name', ''));
  v_category text := p ->> 'vehicle_category';
  v_source text := coalesce(nullif(p ->> 'source', ''), 'whatsapp');
  v_client uuid;
  v_vehicle uuid;
  v_inquiry uuid;
  v_appt uuid;
  v_duration int := coalesce((p ->> 'duration')::int, (select default_duration_minutes from public.settings where id = 1), 90);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if length(v_name) < 2 then raise exception 'Ingresá nombre y apellido.' using errcode = '22023'; end if;
  if length(v_whatsapp) not between 10 and 13 then raise exception 'WhatsApp inválido.' using errcode = '22023'; end if;
  if v_category not in ('auto', 'suv', 'pickup') then raise exception 'Elegí el tipo de vehículo.' using errcode = '22023'; end if;
  if length(trim(coalesce(p ->> 'address', ''))) < 5 then raise exception 'Ingresá el domicilio.' using errcode = '22023'; end if;
  if length(trim(coalesce(p ->> 'service', ''))) < 2 then raise exception 'Indicá el servicio.' using errcode = '22023'; end if;
  if v_source not in ('whatsapp', 'telefono', 'instagram', 'presencial', 'otro') then raise exception 'Origen inválido.' using errcode = '22023'; end if;
  if v_duration not between 15 and 540 then raise exception 'Duración inválida.' using errcode = '22023'; end if;

  select id into v_client from public.clients where whatsapp = v_whatsapp limit 1;
  if v_client is null then
    insert into public.clients (full_name, whatsapp) values (v_name, v_whatsapp) returning id into v_client;
  end if;
  insert into public.vehicles (client_id, category, brand, model)
  values (v_client, v_category, nullif(trim(p ->> 'brand'), ''), nullif(trim(p ->> 'model'), ''))
  returning id into v_vehicle;
  insert into public.inquiries (client_id, vehicle_id, source, service, notes, commercial_status)
  values (v_client, v_vehicle, v_source, trim(p ->> 'service'), nullif(trim(p ->> 'notes'), ''), 'turno_solicitado')
  returning id into v_inquiry;
  insert into public.appointments (client_id, vehicle_id, inquiry_id, service, address, neighborhood, requested_start,
                                   duration_minutes, water_supply, agreed_price, status)
  values (v_client, v_vehicle, v_inquiry, trim(p ->> 'service'), trim(p ->> 'address'), nullif(trim(p ->> 'neighborhood'), ''),
          null, v_duration, case when p ->> 'water_supply' = 'propia' then 'propia' else 'domicilio' end,
          nullif(p ->> 'price', '')::numeric, 'solicitado')
  returning id into v_appt;
  if nullif(trim(p ->> 'internal_note'), '') is not null then
    insert into public.appointment_notes (appointment_id, body) values (v_appt, trim(p ->> 'internal_note'));
  end if;
  return v_appt;
end $$;

-- Edición de los datos de la solicitud. Precio y servicio quedan bloqueados si hay condiciones aceptadas.
create or replace function public.update_appointment_details(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  appt public.appointments%rowtype;
  v_locked boolean;
  v_price numeric := nullif(p ->> 'price', '')::numeric;
  v_duration int := nullif(p ->> 'duration', '')::int;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  if appt.status in ('realizado', 'cancelado', 'rechazado') then
    raise exception 'Este turno ya está cerrado y no se puede editar.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p ->> 'address', ''))) < 5 then raise exception 'Ingresá el domicilio.' using errcode = '22023'; end if;
  if length(trim(coalesce(p ->> 'service', ''))) < 2 then raise exception 'Indicá el servicio.' using errcode = '22023'; end if;
  if v_price is not null and (v_price < 0 or v_price > 100000000) then raise exception 'Precio inválido.' using errcode = '22023'; end if;
  if v_duration is not null and v_duration not between 15 and 540 then raise exception 'Duración inválida.' using errcode = '22023'; end if;
  v_locked := exists (select 1 from public.appointment_offers where appointment_id = p_id and status = 'aceptada');
  if v_locked and (trim(p ->> 'service') <> appt.service or v_price is distinct from appt.agreed_price
                   or coalesce(v_duration, appt.duration_minutes) <> appt.duration_minutes) then
    raise exception 'El cliente ya aceptó servicio, precio y horario. Reabrí la propuesta para cambiarlos.' using errcode = 'P0001';
  end if;

  update public.appointments
     set address = trim(p ->> 'address'), neighborhood = nullif(trim(p ->> 'neighborhood'), ''),
         service = trim(p ->> 'service'), agreed_price = v_price,
         duration_minutes = coalesce(v_duration, duration_minutes),
         water_supply = case when p ->> 'water_supply' = 'propia' then 'propia' else 'domicilio' end,
         operator = nullif(trim(p ->> 'operator'), '')
   where id = p_id;
end $$;

-- 6. Pagos por transferencia verificados por un administrador -------------------------------
alter table public.payments alter column service_id drop not null;
alter table public.payments
  add column if not exists appointment_id uuid references public.appointments(id) on delete restrict,
  add column if not exists reference text check (reference is null or length(reference) between 3 and 80),
  add column if not exists request_id uuid unique,
  add column if not exists verified_by uuid,
  add column if not exists verified_by_email text,
  add column if not exists verified_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_email text,
  add column if not exists void_reason text check (void_reason is null or length(void_reason) <= 300);
alter table public.payments drop constraint if exists payments_target_check;
alter table public.payments add constraint payments_target_check check (service_id is not null or appointment_id is not null);
-- El mismo comprobante de transferencia no se puede cargar dos veces (evita ingresos duplicados).
create unique index if not exists payments_transfer_reference_uniq
  on public.payments (lower(reference)) where reference is not null and voided_at is null;
create index if not exists payments_appointment_idx on public.payments (appointment_id);

-- Los pagos de un turno pasan al servicio cuando se registra como realizado.
update public.payments p set appointment_id = s.appointment_id
  from public.services s where p.service_id = s.id and p.appointment_id is null and s.appointment_id is not null;

create or replace function public.recalculate_appointment_payment(p_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric(12, 2);
  v_total numeric(12, 2);
begin
  if p_appointment_id is null then return; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
   where appointment_id = p_appointment_id and voided_at is null;
  select coalesce((select s.final_price from public.services s where s.appointment_id = a.id order by s.created_at desc limit 1), a.agreed_price)
    into v_total from public.appointments a where a.id = p_appointment_id;
  update public.appointments
     set amount_paid = v_paid,
         payment_status = case when v_paid <= 0 then 'pendiente' when v_total is null or v_paid < v_total then 'parcial' else 'pagado' end
   where id = p_appointment_id;
end $$;

create or replace function public.recalculate_service_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  total numeric(12, 2);
  price numeric(12, 2);
begin
  foreach target in array array_remove(array[new.service_id, old.service_id], null) loop
    select coalesce(sum(amount), 0) into total from public.payments where service_id = target and voided_at is null;
    select final_price into price from public.services where id = target;
    update public.services
       set amount_paid = total,
           payment_status = case when total <= 0 then 'pendiente' when total < price then 'parcial' else 'cobrado' end
     where id = target;
  end loop;
  perform public.recalculate_appointment_payment(new.appointment_id);
  if old.appointment_id is distinct from new.appointment_id then
    perform public.recalculate_appointment_payment(old.appointment_id);
  end if;
  return null;
end $$;

create or replace function public.link_payments_to_service()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.appointment_id is not null then
    update public.payments set service_id = new.id where appointment_id = new.appointment_id and service_id is null;
    perform public.recalculate_appointment_payment(new.appointment_id);
  end if;
  return null;
end $$;
drop trigger if exists services_link_payments on public.services;
create trigger services_link_payments after insert on public.services
  for each row execute function public.link_payments_to_service();

-- Pagos cargados al servicio por el flujo anterior también quedan asociados al turno.
create or replace function public.payments_fill_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.appointment_id is null and new.service_id is not null then
    select appointment_id into new.appointment_id from public.services where id = new.service_id;
  end if;
  return new;
end $$;
drop trigger if exists payments_fill_appointment on public.payments;
create trigger payments_fill_appointment before insert on public.payments
  for each row execute function public.payments_fill_appointment();

create or replace function public.record_transfer_payment(
  p_appointment_id uuid, p_amount numeric, p_paid_at timestamptz, p_reference text, p_notes text,
  p_request_id uuid, p_verified boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_verified is not true then
    raise exception 'Confirmá que verificaste la transferencia en la cuenta antes de registrarla.' using errcode = 'P0001';
  end if;
  if p_request_id is null then raise exception 'Solicitud inválida.' using errcode = '22023'; end if;
  select id into v_id from public.payments where request_id = p_request_id;
  if v_id is not null then return v_id; end if;

  select * into appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  if appt.status not in ('confirmado', 'realizado') then
    raise exception 'Solo se cobran turnos confirmados. No pidas transferencias antes de confirmar.' using errcode = 'P0001';
  end if;
  select id, final_price into v_service, v_total from public.services
   where appointment_id = appt.id order by created_at desc limit 1;
  v_total := coalesce(v_total, appt.agreed_price);
  if v_total is null then raise exception 'El turno no tiene importe acordado.' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El importe debe ser mayor a cero.' using errcode = '22023'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = appt.id and voided_at is null;
  if round(p_amount, 2) > v_total - v_paid then raise exception 'El importe supera el saldo pendiente.' using errcode = 'P0001'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then raise exception 'Fecha de pago inválida.' using errcode = '22023'; end if;
  if nullif(trim(p_reference), '') is not null and exists (
    select 1 from public.payments where lower(reference) = lower(trim(p_reference)) and voided_at is null) then
    raise exception 'Ese comprobante de transferencia ya está registrado.' using errcode = 'P0001';
  end if;

  insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, reference, request_id,
                               verified_by, verified_by_email, verified_at)
  values (v_service, appt.id, round(p_amount, 2), 'transferencia', p_paid_at, nullif(trim(p_notes), ''),
          nullif(trim(p_reference), ''), p_request_id, auth.uid(), auth.jwt() ->> 'email', now())
  returning id into v_id;

  if v_paid + round(p_amount, 2) >= v_total and v_service is not null then
    update public.inquiries set commercial_status = 'cobrado' where id = appt.inquiry_id;
  end if;
  return v_id;
end $$;

-- Anular un pago no lo borra: queda en el historial y deja de sumar como ingreso.
create or replace function public.void_payment(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indicá el motivo de la anulación.' using errcode = '22023'; end if;
  update public.payments set voided_at = now(), voided_by_email = auth.jwt() ->> 'email', void_reason = trim(p_reason)
   where id = p_id and voided_at is null;
  if not found then raise exception 'El pago no existe o ya estaba anulado.' using errcode = 'P0001'; end if;
end $$;

-- El flujo anterior (add_payment) sigue existiendo para el historial y no cuenta anulados.
create or replace function public.add_payment(p_service_id uuid, p_amount numeric, p_method text, p_paid_at timestamptz, p_notes text)
returns void language plpgsql set search_path = '' as $$
declare
  svc public.services%rowtype;
  v_paid numeric(12, 2);
  v_inquiry uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into svc from public.services where id = p_service_id for update;
  if not found then raise exception 'Servicio inexistente' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El importe debe ser mayor a cero.' using errcode = '22023'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
   where (service_id = svc.id or (svc.appointment_id is not null and appointment_id = svc.appointment_id)) and voided_at is null;
  if p_amount > svc.final_price - v_paid then raise exception 'El importe supera el saldo pendiente.' using errcode = 'P0001'; end if;
  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then raise exception 'Medio de pago inválido' using errcode = '22023'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then raise exception 'Fecha de pago inválida' using errcode = '22023'; end if;
  insert into public.payments (service_id, amount, method, paid_at, notes, verified_by, verified_by_email, verified_at)
  values (p_service_id, round(p_amount, 2), p_method, p_paid_at, nullif(trim(p_notes), ''), auth.uid(), auth.jwt() ->> 'email', now());
  if v_paid + p_amount >= svc.final_price then
    select inquiry_id into v_inquiry from public.appointments where id = svc.appointment_id;
    update public.inquiries set commercial_status = 'cobrado' where id = v_inquiry;
  end if;
end $$;

-- 7. Permisos --------------------------------------------------------------------------------
revoke all on function public.offer_snapshot(public.appointment_offers), public.offer_normalize_slots(jsonb, integer),
  public.save_appointment_offer(uuid, jsonb, numeric, numeric, text, text), public.reopen_appointment_offer(uuid, text),
  public.get_appointment_offer(text), public.respond_appointment_offer(text, text, integer, timestamptz, text),
  public.admin_create_appointment(jsonb), public.update_appointment_details(uuid, jsonb),
  public.recalculate_appointment_payment(uuid), public.link_payments_to_service(), public.payments_fill_appointment(),
  public.record_transfer_payment(uuid, numeric, timestamptz, text, text, uuid, boolean), public.void_payment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_appointment_offer(uuid, jsonb, numeric, numeric, text, text),
  public.reopen_appointment_offer(uuid, text), public.admin_create_appointment(jsonb),
  public.update_appointment_details(uuid, jsonb), public.record_transfer_payment(uuid, numeric, timestamptz, text, text, uuid, boolean),
  public.void_payment(uuid, text) to authenticated;
-- El cliente no inicia sesión: entra solo con el token de 48 caracteres de su enlace.
grant execute on function public.get_appointment_offer(text), public.respond_appointment_offer(text, text, integer, timestamptz, text)
  to anon, authenticated;

commit;
