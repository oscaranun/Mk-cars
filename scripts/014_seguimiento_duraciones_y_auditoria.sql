-- 014: seguimiento de clientes, duraciones predeterminadas, etapa "preparando propuesta"
-- y registro de modificaciones importantes de turnos. Solo agrega; no borra datos.

alter table public.clients
  add column if not exists follow_up_at date,
  add column if not exists follow_up_note text,
  add column if not exists last_contacted_at timestamptz;

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  note text,
  next_follow_up date,
  author_id uuid default auth.uid(),
  author_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);
create index if not exists client_contacts_client_idx on public.client_contacts (client_id, created_at desc);
alter table public.client_contacts enable row level security;
drop policy if exists client_contacts_admin_all on public.client_contacts;
create policy client_contacts_admin_all on public.client_contacts for all using (public.is_admin()) with check (public.is_admin());

alter table public.settings
  add column if not exists duration_defaults jsonb not null default '{"auto": 60, "suv": 75, "pickup": 90}'::jsonb;

alter table public.appointments
  add column if not exists preparing_since timestamptz;

create table if not exists public.appointment_changes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid default auth.uid(),
  changed_by_email text default (auth.jwt() ->> 'email'),
  changed_at timestamptz not null default now()
);
create index if not exists appointment_changes_appt_idx on public.appointment_changes (appointment_id, changed_at desc);
alter table public.appointment_changes enable row level security;
drop policy if exists appointment_changes_admin_select on public.appointment_changes;
create policy appointment_changes_admin_select on public.appointment_changes for select using (public.is_admin());

create or replace function public.log_appointment_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  foreach k in array array['service', 'address', 'neighborhood', 'agreed_price', 'duration_minutes',
                           'confirmed_start', 'water_supply', 'operator', 'vehicle_id'] loop
    if o -> k is distinct from n -> k then
      insert into public.appointment_changes (appointment_id, field, old_value, new_value)
      values (new.id, k, o ->> k, n ->> k);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists appointments_log_changes on public.appointments;
create trigger appointments_log_changes after update on public.appointments
  for each row execute function public.log_appointment_changes();

-- Reutiliza un vehículo existente del cliente cuando se elige desde el buscador.
create or replace function public.admin_create_appointment(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare
  v_whatsapp text := regexp_replace(coalesce(p ->> 'whatsapp', ''), '\D', '', 'g');
  v_name text := trim(coalesce(p ->> 'full_name', ''));
  v_category text := p ->> 'vehicle_category';
  v_source text := coalesce(nullif(p ->> 'source', ''), 'whatsapp');
  v_client uuid;
  v_vehicle uuid;
  v_inquiry uuid;
  v_appt uuid;
  v_duration int := coalesce(nullif(p ->> 'duration', '')::int, (select default_duration_minutes from public.settings where id = 1), 90);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if length(v_name) < 2 then raise exception 'Ingresá nombre y apellido.' using errcode = '22023'; end if;
  if length(v_whatsapp) not between 10 and 13 then raise exception 'WhatsApp inválido.' using errcode = '22023'; end if;
  if length(trim(coalesce(p ->> 'address', ''))) < 5 then raise exception 'Ingresá el domicilio.' using errcode = '22023'; end if;
  if length(trim(coalesce(p ->> 'service', ''))) < 2 then raise exception 'Indicá el servicio.' using errcode = '22023'; end if;
  if v_source not in ('whatsapp', 'telefono', 'instagram', 'presencial', 'otro') then raise exception 'Origen inválido.' using errcode = '22023'; end if;
  if v_duration not between 15 and 540 then raise exception 'Duración inválida.' using errcode = '22023'; end if;

  select id into v_client from public.clients where whatsapp = v_whatsapp limit 1;
  if v_client is null then
    insert into public.clients (full_name, whatsapp) values (v_name, v_whatsapp) returning id into v_client;
  end if;

  if nullif(p ->> 'vehicle_id', '') is not null then
    select id into v_vehicle from public.vehicles where id = (p ->> 'vehicle_id')::uuid and client_id = v_client;
    if v_vehicle is null then raise exception 'El vehículo elegido no pertenece a este cliente.' using errcode = '22023'; end if;
  else
    if v_category not in ('auto', 'suv', 'pickup') then raise exception 'Elegí el tipo de vehículo.' using errcode = '22023'; end if;
    insert into public.vehicles (client_id, category, brand, model)
    values (v_client, v_category, nullif(trim(p ->> 'brand'), ''), nullif(trim(p ->> 'model'), ''))
    returning id into v_vehicle;
  end if;

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
end $function$;
