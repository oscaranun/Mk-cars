-- MK Cars CRM — Etapa 1: estructura, relaciones, seguridad (RLS) y captura de consultas.
-- Todas las fechas se guardan como timestamptz (UTC) y se muestran en America/Argentina/Mendoza.

create extension if not exists pgcrypto;

-- ADMINISTRADORES (sin registro público: se agregan manualmente)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- CONFIGURACIÓN OPERATIVA (capacidad = vehículos de trabajo / operarios simultáneos)
create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  operational_capacity int not null default 1 check (operational_capacity > 0),
  default_duration_minutes int not null default 90 check (default_duration_minutes > 0),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- CLIENTES
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  whatsapp text not null unique,
  email text,
  source text not null default 'web',
  privacy_consent_at timestamptz,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now()
);
create index if not exists clients_full_name_idx on public.clients (lower(full_name));
create index if not exists clients_email_idx on public.clients (lower(email));

-- VEHÍCULOS (un cliente puede tener varios)
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null check (category in ('auto', 'suv', 'pickup')),
  brand text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists vehicles_client_idx on public.vehicles (client_id);

-- CONSULTAS (estado comercial)
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  source text not null default 'web',
  service text not null,
  extras text[] not null default '{}',
  commercial_status text not null default 'nueva' check (commercial_status in (
    'nueva', 'pendiente_respuesta', 'presupuesto_enviado', 'turno_solicitado', 'turno_confirmado',
    'servicio_realizado', 'cobrado', 'no_contratado', 'cancelado', 'reprogramado'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_client_idx on public.inquiries (client_id);
create index if not exists inquiries_created_idx on public.inquiries (created_at desc);

-- TURNOS (estado del turno; nunca se confirman automáticamente)
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  service text not null,
  extras text[] not null default '{}',
  address text not null,
  requested_start timestamptz not null,
  confirmed_at timestamptz,
  confirmed_start timestamptz,
  duration_minutes int not null default 90 check (duration_minutes > 0),
  status text not null default 'solicitado' check (status in (
    'solicitado', 'confirmado', 'rechazado', 'reprogramado', 'cancelado', 'realizado'
  )),
  agreed_price numeric(12, 2) check (agreed_price is null or agreed_price >= 0),
  operator text,
  water_supply text not null default 'domicilio' check (water_supply in ('domicilio', 'propia')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint confirmed_requires_start check (status <> 'confirmado' or confirmed_start is not null)
);
create index if not exists appointments_status_idx on public.appointments (status);
create index if not exists appointments_confirmed_start_idx on public.appointments (confirmed_start);

-- SERVICIOS REALIZADOS (precio histórico) y PAGOS (permite parciales)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  wash_type text not null,
  performed_at timestamptz not null default now(),
  agreed_price numeric(12, 2) check (agreed_price is null or agreed_price >= 0),
  final_price numeric(12, 2) not null check (final_price >= 0),
  amount_paid numeric(12, 2) not null default 0,
  payment_status text not null default 'pendiente' check (payment_status in ('pendiente', 'parcial', 'cobrado')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists services_client_idx on public.services (client_id);
create index if not exists services_performed_idx on public.services (performed_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('efectivo', 'transferencia', 'otro')),
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists payments_service_idx on public.payments (service_id);
create index if not exists payments_paid_idx on public.payments (paid_at desc);

-- HISTORIAL DE CAMBIOS DE ESTADO
create table if not exists public.status_history (
  id bigint generated always as identity primary key,
  entity text not null check (entity in ('inquiry', 'appointment', 'service')),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists status_history_entity_idx on public.status_history (entity, entity_id, changed_at desc);

-- TRIGGERS ---------------------------------------------------------------

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text;
  new_status text;
  kind text := tg_argv[0];
  col text := tg_argv[1];
begin
  new_status := to_jsonb(new) ->> col;
  if tg_op = 'UPDATE' then
    old_status := to_jsonb(old) ->> col;
    if old_status is not distinct from new_status then
      return new;
    end if;
  end if;
  insert into public.status_history (entity, entity_id, from_status, to_status, changed_by)
  values (kind, new.id, old_status, new_status, auth.uid());
  return new;
end;
$$;

drop trigger if exists inquiries_status_log on public.inquiries;
create trigger inquiries_status_log after insert or update of commercial_status on public.inquiries
  for each row execute function public.log_status_change('inquiry', 'commercial_status');

drop trigger if exists appointments_status_log on public.appointments;
create trigger appointments_status_log after insert or update of status on public.appointments
  for each row execute function public.log_status_change('appointment', 'status');

drop trigger if exists services_status_log on public.services;
create trigger services_status_log after insert or update of payment_status on public.services
  for each row execute function public.log_status_change('service', 'payment_status');

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inquiries_touch on public.inquiries;
create trigger inquiries_touch before update on public.inquiries
  for each row execute function public.touch_updated_at();
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- Evita superposición de turnos confirmados según la capacidad operativa.
create or replace function public.check_appointment_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  capacity int;
  overlapping int;
begin
  if new.status <> 'confirmado' then
    return new;
  end if;
  if new.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  select operational_capacity into capacity from public.settings where id = 1;
  select count(*) into overlapping
  from public.appointments a
  where a.status = 'confirmado'
    and a.id <> new.id
    and tstzrange(a.confirmed_start, a.confirmed_start + make_interval(mins => a.duration_minutes))
        && tstzrange(new.confirmed_start, new.confirmed_start + make_interval(mins => new.duration_minutes));
  if overlapping >= coalesce(capacity, 1) then
    raise exception 'El horario se superpone con otro turno confirmado (capacidad: %).', capacity
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_capacity on public.appointments;
create trigger appointments_capacity before insert or update of status, confirmed_start, duration_minutes
  on public.appointments for each row execute function public.check_appointment_capacity();

-- Recalcula importe cobrado y estado de pago a partir de los pagos registrados.
create or replace function public.recalculate_service_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.service_id, old.service_id);
  total numeric(12, 2);
  price numeric(12, 2);
begin
  select coalesce(sum(amount), 0) into total from public.payments where service_id = target;
  select final_price into price from public.services where id = target;
  update public.services
  set amount_paid = total,
      payment_status = case when total <= 0 then 'pendiente' when total < price then 'parcial' else 'cobrado' end
  where id = target;
  return null;
end;
$$;

drop trigger if exists payments_recalculate on public.payments;
create trigger payments_recalculate after insert or update or delete on public.payments
  for each row execute function public.recalculate_service_payment();

-- CAPTURA PÚBLICA DE CONSULTAS -------------------------------------------
-- Única puerta de entrada pública. Valida, deduplica por WhatsApp normalizado,
-- limita envíos abusivos y crea cliente + vehículo + consulta + solicitud de turno.
create or replace function public.submit_booking(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_vehicle_id uuid;
  v_inquiry_id uuid;
  v_whatsapp text := payload ->> 'whatsapp';
  v_category text := payload ->> 'category';
  v_brand text := nullif(trim(payload ->> 'brand'), '');
  v_model text := nullif(trim(payload ->> 'model'), '');
  v_source text := coalesce(nullif(payload ->> 'source', ''), 'web');
  v_marketing boolean := coalesce((payload ->> 'marketing_consent')::boolean, false);
  v_extras text[] := coalesce(array(select jsonb_array_elements_text(payload -> 'extras')), '{}');
  v_recent int;
begin
  if v_whatsapp !~ '^549[0-9]{10}$' then
    raise exception 'WhatsApp inválido' using errcode = '22023';
  end if;
  if v_category not in ('auto', 'suv', 'pickup') then
    raise exception 'Categoría inválida' using errcode = '22023';
  end if;
  if length(coalesce(payload ->> 'full_name', '')) not between 3 and 120
     or length(coalesce(payload ->> 'address', '')) not between 5 and 200
     or coalesce(payload ->> 'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
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
    trim(payload ->> 'full_name'), v_whatsapp, lower(trim(payload ->> 'email')), v_source, now(),
    v_marketing, case when v_marketing then now() end
  )
  on conflict (whatsapp) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    privacy_consent_at = now(),
    marketing_consent = public.clients.marketing_consent or excluded.marketing_consent,
    marketing_consent_at = coalesce(public.clients.marketing_consent_at, excluded.marketing_consent_at),
    last_interaction_at = now()
  returning id into v_client_id;

  select v.id into v_vehicle_id
  from public.vehicles v
  where v.client_id = v_client_id
    and v.category = v_category
    and lower(coalesce(v.brand, '')) = lower(coalesce(v_brand, ''))
    and lower(coalesce(v.model, '')) = lower(coalesce(v_model, ''))
  limit 1;

  if v_vehicle_id is null then
    insert into public.vehicles (client_id, category, brand, model)
    values (v_client_id, v_category, v_brand, v_model)
    returning id into v_vehicle_id;
  end if;

  insert into public.inquiries (client_id, vehicle_id, source, service, extras, commercial_status, notes)
  values (v_client_id, v_vehicle_id, v_source, payload ->> 'service', v_extras, 'turno_solicitado',
          nullif(trim(payload ->> 'notes'), ''))
  returning id into v_inquiry_id;

  insert into public.appointments (client_id, vehicle_id, inquiry_id, service, extras, address, requested_start, water_supply)
  values (v_client_id, v_vehicle_id, v_inquiry_id, payload ->> 'service', v_extras, trim(payload ->> 'address'),
          (payload ->> 'requested_start')::timestamptz, payload ->> 'water_supply');

  return v_inquiry_id;
end;
$$;

revoke all on function public.submit_booking(jsonb) from public;
grant execute on function public.submit_booking(jsonb) to anon, authenticated;

-- ROW LEVEL SECURITY: solo administradores leen y modifican datos -------
do $$
declare t text;
begin
  foreach t in array array['clients', 'vehicles', 'inquiries', 'appointments', 'services', 'payments', 'status_history', 'settings', 'admins']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

revoke all on all tables in schema public from anon;
