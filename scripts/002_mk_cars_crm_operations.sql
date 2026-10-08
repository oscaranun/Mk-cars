-- MK Cars CRM — Etapa 2: operaciones del panel (turnos, servicios, cobros).
-- No elimina datos: solo amplía estados permitidos, agrega columnas opcionales y funciones.

-- Estado comercial "convertida" (consulta convertida en contratación).
alter table public.inquiries drop constraint if exists inquiries_commercial_status_check;
alter table public.inquiries add constraint inquiries_commercial_status_check check (commercial_status in (
  'nueva', 'pendiente_respuesta', 'presupuesto_enviado', 'convertida', 'turno_solicitado', 'turno_confirmado',
  'servicio_realizado', 'cobrado', 'no_contratado', 'cancelado', 'reprogramado'
));

-- Datos del lavado realizado.
alter table public.services add column if not exists vehicle_category text
  check (vehicle_category is null or vehicle_category in ('auto', 'suv', 'pickup'));
alter table public.services add column if not exists operator text;
create unique index if not exists services_appointment_unique on public.services (appointment_id) where appointment_id is not null;
create index if not exists appointments_requested_start_idx on public.appointments (requested_start);

-- Horario de atención: lunes a sábado, 9:00 a 18:00 (Mendoza).
create or replace function public.assert_business_hours(p_start timestamptz, p_duration int)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  local_start timestamp := p_start at time zone 'America/Argentina/Mendoza';
  local_end timestamp := (p_start + make_interval(mins => p_duration)) at time zone 'America/Argentina/Mendoza';
begin
  if extract(isodow from local_start) = 7 then
    raise exception 'Los domingos no se atiende.' using errcode = 'P0001';
  end if;
  if local_start::time < time '09:00' or local_end::time > time '18:00' or local_end::date <> local_start::date then
    raise exception 'El turno debe estar dentro del horario de 9:00 a 18:00.' using errcode = 'P0001';
  end if;
end;
$$;

-- Gestión manual de turnos: confirmar, reprogramar, rechazar o cancelar.
create or replace function public.manage_appointment(
  p_id uuid,
  p_action text,
  p_start timestamptz default null,
  p_duration int default null,
  p_agreed_price numeric default null,
  p_operator text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  appt public.appointments%rowtype;
  v_duration int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Turno inexistente' using errcode = 'P0001';
  end if;

  v_duration := coalesce(p_duration, appt.duration_minutes);
  if v_duration not between 15 and 540 then
    raise exception 'Duración inválida' using errcode = '22023';
  end if;
  if p_agreed_price is not null and p_agreed_price < 0 then
    raise exception 'Precio inválido' using errcode = '22023';
  end if;

  if p_action = 'confirm' then
    if appt.status not in ('solicitado', 'reprogramado') then
      raise exception 'Solo se pueden confirmar turnos solicitados o reprogramados.' using errcode = 'P0001';
    end if;
    if p_start is null then
      raise exception 'Indicá fecha y hora' using errcode = '22023';
    end if;
    perform public.assert_business_hours(p_start, v_duration);
    update public.appointments
    set status = 'confirmado', confirmed_start = p_start, confirmed_at = now(), duration_minutes = v_duration,
        agreed_price = coalesce(p_agreed_price, agreed_price), operator = coalesce(nullif(trim(p_operator), ''), operator)
    where id = p_id;
    update public.inquiries set commercial_status = 'convertida'
    where id = appt.inquiry_id
      and commercial_status in ('nueva', 'pendiente_respuesta', 'presupuesto_enviado', 'turno_solicitado', 'reprogramado');

  elsif p_action = 'reschedule' then
    if appt.status not in ('solicitado', 'confirmado', 'reprogramado') then
      raise exception 'Este turno no se puede reprogramar.' using errcode = 'P0001';
    end if;
    if p_start is null then
      raise exception 'Indicá fecha y hora' using errcode = '22023';
    end if;
    perform public.assert_business_hours(p_start, v_duration);
    update public.appointments
    set status = 'reprogramado', requested_start = p_start, confirmed_start = null, confirmed_at = null,
        duration_minutes = v_duration
    where id = p_id;

  elsif p_action = 'reject' then
    if appt.status not in ('solicitado', 'reprogramado') then
      raise exception 'Solo se pueden rechazar turnos pendientes.' using errcode = 'P0001';
    end if;
    update public.appointments set status = 'rechazado' where id = p_id;
    update public.inquiries set commercial_status = 'no_contratado'
    where id = appt.inquiry_id and commercial_status not in ('servicio_realizado', 'cobrado');

  elsif p_action = 'cancel' then
    if appt.status not in ('solicitado', 'confirmado', 'reprogramado') then
      raise exception 'Este turno no se puede cancelar.' using errcode = 'P0001';
    end if;
    update public.appointments set status = 'cancelado' where id = p_id;
    update public.inquiries set commercial_status = 'cancelado'
    where id = appt.inquiry_id and commercial_status not in ('servicio_realizado', 'cobrado');

  else
    raise exception 'Acción inválida' using errcode = '22023';
  end if;
end;
$$;

-- Marca un turno confirmado como servicio realizado (atómico).
create or replace function public.complete_appointment(
  p_id uuid,
  p_performed_at timestamptz,
  p_vehicle_category text,
  p_wash_type text,
  p_agreed_price numeric,
  p_final_price numeric,
  p_operator text,
  p_notes text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  appt public.appointments%rowtype;
  v_service_id uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Turno inexistente' using errcode = 'P0001';
  end if;
  if appt.status <> 'confirmado' then
    raise exception 'Solo se pueden marcar como realizados los turnos confirmados.' using errcode = 'P0001';
  end if;
  if p_vehicle_category not in ('auto', 'suv', 'pickup') then
    raise exception 'Tipo de vehículo inválido' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_wash_type, ''))) not between 2 and 120 then
    raise exception 'Tipo de lavado inválido' using errcode = '22023';
  end if;
  if p_final_price is null or p_final_price < 0 or (p_agreed_price is not null and p_agreed_price < 0) then
    raise exception 'Precio inválido' using errcode = '22023';
  end if;
  if p_performed_at is null or p_performed_at > now() + interval '1 day' then
    raise exception 'Fecha de lavado inválida' using errcode = '22023';
  end if;

  insert into public.services (
    appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at,
    agreed_price, final_price, operator, notes
  ) values (
    appt.id, appt.client_id, appt.vehicle_id, p_vehicle_category, trim(p_wash_type), p_performed_at,
    coalesce(p_agreed_price, appt.agreed_price), p_final_price,
    coalesce(nullif(trim(p_operator), ''), appt.operator), nullif(trim(p_notes), '')
  ) returning id into v_service_id;

  update public.appointments
  set status = 'realizado', operator = coalesce(nullif(trim(p_operator), ''), operator)
  where id = appt.id;

  update public.inquiries set commercial_status = 'servicio_realizado'
  where id = appt.inquiry_id and commercial_status <> 'cobrado';

  update public.clients set last_interaction_at = now() where id = appt.client_id;

  return v_service_id;
end;
$$;

-- Registra un pago (permite parciales, nunca supera el saldo).
create or replace function public.add_payment(
  p_service_id uuid,
  p_amount numeric,
  p_method text,
  p_paid_at timestamptz,
  p_notes text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  svc public.services%rowtype;
  v_inquiry uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into svc from public.services where id = p_service_id for update;
  if not found then
    raise exception 'Servicio inexistente' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor a cero.' using errcode = '22023';
  end if;
  if p_amount > svc.final_price - svc.amount_paid then
    raise exception 'El importe supera el saldo pendiente.' using errcode = 'P0001';
  end if;
  if p_method not in ('efectivo', 'transferencia', 'otro') then
    raise exception 'Medio de pago inválido' using errcode = '22023';
  end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then
    raise exception 'Fecha de pago inválida' using errcode = '22023';
  end if;

  insert into public.payments (service_id, amount, method, paid_at, notes)
  values (p_service_id, round(p_amount, 2), p_method, p_paid_at, nullif(trim(p_notes), ''));

  if svc.amount_paid + p_amount >= svc.final_price then
    select inquiry_id into v_inquiry from public.appointments where id = svc.appointment_id;
    update public.inquiries set commercial_status = 'cobrado' where id = v_inquiry;
  end if;
end;
$$;

revoke all on function public.assert_business_hours(timestamptz, int) from public, anon;
revoke all on function public.manage_appointment(uuid, text, timestamptz, int, numeric, text) from public, anon;
revoke all on function public.complete_appointment(uuid, timestamptz, text, text, numeric, numeric, text, text) from public, anon;
revoke all on function public.add_payment(uuid, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.assert_business_hours(timestamptz, int) to authenticated;
grant execute on function public.manage_appointment(uuid, text, timestamptz, int, numeric, text) to authenticated;
grant execute on function public.complete_appointment(uuid, timestamptz, text, text, numeric, numeric, text, text) to authenticated;
grant execute on function public.add_payment(uuid, numeric, text, timestamptz, text) to authenticated;
