-- MK Cars — Confirmación de turnos, propuestas de horario y control de avisos por WhatsApp.
-- PENDIENTE DE AUTORIZACIÓN: no ejecutar sin aprobación explícita.
-- No borra ni modifica datos existentes: solo agrega estructuras y reemplaza funciones.

-- 1. Nuevo estado "esperando_cliente" y motivo de cancelación ---------------------------
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status = any (array[
  'solicitado', 'confirmado', 'esperando_cliente', 'rechazado', 'reprogramado', 'cancelado', 'realizado'
]));
alter table public.appointments add column if not exists cancel_reason text;

-- 2. Tiempo de traslado configurable entre turnos ------------------------------------------
alter table public.settings add column if not exists travel_minutes int not null default 30
  check (travel_minutes between 0 and 240);

-- 3. Propuestas de horario (conserva el horario original y cada alternativa enviada) -------
create table if not exists public.appointment_proposals (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  original_start timestamptz,
  proposed_start timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aceptada', 'rechazada', 'anulada')),
  proposed_at timestamptz not null default now(),
  proposed_by uuid default auth.uid(),
  responded_at timestamptz,
  responded_by uuid
);
create unique index if not exists appointment_proposals_one_pending
  on public.appointment_proposals (appointment_id) where status = 'pendiente';
create index if not exists appointment_proposals_appointment
  on public.appointment_proposals (appointment_id, proposed_at desc);

-- 4. Registro manual de mensajes enviados por WhatsApp --------------------------------------
-- Solo indica que un administrador marcó el mensaje como enviado; no implica recepción ni lectura.
create table if not exists public.appointment_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('confirmacion', 'propuesta')),
  proposal_id uuid references public.appointment_proposals(id) on delete cascade,
  marked_sent_at timestamptz not null default now(),
  marked_sent_by uuid default auth.uid(),
  marked_sent_by_email text,
  constraint proposal_message_needs_proposal check (kind <> 'propuesta' or proposal_id is not null)
);
create index if not exists appointment_messages_appointment
  on public.appointment_messages (appointment_id, marked_sent_at desc);

alter table public.appointment_proposals enable row level security;
alter table public.appointment_messages enable row level security;
create policy appointment_proposals_admin_all on public.appointment_proposals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy appointment_messages_admin_all on public.appointment_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. Disponibilidad: duración + traslado + mismo operario -----------------------------------
create or replace function public.appointment_slot_conflicts(
  p_start timestamptz,
  p_duration int,
  p_exclude uuid default null,
  p_operator text default null
)
returns table (id uuid, confirmed_start timestamptz, duration_minutes int, operator text, same_operator boolean)
language sql
stable
set search_path to ''
as $function$
  select a.id, a.confirmed_start, a.duration_minutes, a.operator,
         (nullif(trim(p_operator), '') is not null
           and lower(trim(a.operator)) = lower(trim(p_operator))) as same_operator
    from public.appointments a
   cross join (select coalesce(travel_minutes, 0) as travel from public.settings where id = 1) s
   where a.status = 'confirmado'
     and a.id is distinct from p_exclude
     and tstzrange(a.confirmed_start, a.confirmed_start + make_interval(mins => a.duration_minutes))
         && tstzrange(p_start - make_interval(mins => s.travel),
                      p_start + make_interval(mins => p_duration + s.travel));
$function$;

create or replace function public.check_appointment_capacity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  capacity int;
  overlapping int;
  operator_busy boolean;
begin
  if new.status <> 'confirmado' then
    return new;
  end if;
  if new.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  select operational_capacity into capacity from public.settings where id = 1;
  select count(*), coalesce(bool_or(c.same_operator), false) into overlapping, operator_busy
    from public.appointment_slot_conflicts(new.confirmed_start, new.duration_minutes, new.id, new.operator) c;
  if operator_busy then
    raise exception 'El operario % ya tiene un turno confirmado en ese horario (incluye tiempo de traslado).', new.operator
      using errcode = 'P0001';
  end if;
  if overlapping >= coalesce(capacity, 1) then
    raise exception 'El horario se superpone con otro turno confirmado, considerando duración y traslado (capacidad: %).', capacity
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists appointments_capacity on public.appointments;
create trigger appointments_capacity
  before insert or update of status, confirmed_start, duration_minutes, operator on public.appointments
  for each row execute function public.check_appointment_capacity();

-- 6. Acciones de turno ----------------------------------------------------------------------
drop function if exists public.manage_appointment(uuid, text, timestamptz, integer, numeric, text);

create or replace function public.manage_appointment(
  p_id uuid,
  p_action text,
  p_start timestamptz default null,
  p_duration integer default null,
  p_agreed_price numeric default null,
  p_operator text default null,
  p_reason text default null
)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  appt public.appointments%rowtype;
  prop public.appointment_proposals%rowtype;
  v_action text := case when p_action = 'reschedule' then 'propose' else p_action end;
  v_duration int;
  v_capacity int;
  v_overlap int;
  v_operator_busy boolean;
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

  if v_action = 'confirm' then
    if appt.status not in ('solicitado', 'reprogramado') then
      raise exception 'Solo se pueden confirmar turnos solicitados.' using errcode = 'P0001';
    end if;
    if appt.requested_start is null then
      raise exception 'El turno no tiene horario solicitado: usá "Proponer otro horario".' using errcode = 'P0001';
    end if;
    if p_start is not null and p_start <> appt.requested_start then
      raise exception 'El horario difiere del solicitado: usá "Proponer otro horario" para que el cliente lo acepte.'
        using errcode = 'P0001';
    end if;
    perform public.assert_business_hours(appt.requested_start, v_duration);
    update public.appointments
       set status = 'confirmado', confirmed_start = appt.requested_start, confirmed_at = now(),
           duration_minutes = v_duration,
           agreed_price = coalesce(p_agreed_price, agreed_price),
           operator = coalesce(nullif(trim(p_operator), ''), operator)
     where id = p_id;
    update public.inquiries set commercial_status = 'convertida'
     where id = appt.inquiry_id
       and commercial_status in ('nueva', 'pendiente_respuesta', 'presupuesto_enviado', 'turno_solicitado', 'reprogramado');

  elsif v_action = 'propose' then
    if appt.status not in ('solicitado', 'confirmado', 'esperando_cliente', 'reprogramado') then
      raise exception 'Este turno no admite una propuesta de horario.' using errcode = 'P0001';
    end if;
    if p_start is null then
      raise exception 'Indicá la nueva fecha y hora' using errcode = '22023';
    end if;
    if appt.status = 'solicitado' and p_start = appt.requested_start then
      raise exception 'Es el mismo horario solicitado: usá "Confirmar turno".' using errcode = 'P0001';
    end if;
    perform public.assert_business_hours(p_start, v_duration);

    select operational_capacity into v_capacity from public.settings where id = 1;
    select count(*), coalesce(bool_or(c.same_operator), false) into v_overlap, v_operator_busy
      from public.appointment_slot_conflicts(p_start, v_duration, p_id,
                                             coalesce(nullif(trim(p_operator), ''), appt.operator)) c;
    if v_operator_busy or v_overlap >= coalesce(v_capacity, 1) then
      raise exception 'Ese horario ya está ocupado por otro turno confirmado (incluye traslado). Elegí otra alternativa.'
        using errcode = 'P0001';
    end if;

    update public.appointment_proposals
       set status = 'anulada', responded_at = now(), responded_by = auth.uid()
     where appointment_id = p_id and status = 'pendiente';
    insert into public.appointment_proposals (appointment_id, original_start, proposed_start, duration_minutes)
    values (p_id, appt.requested_start, p_start, v_duration);

    -- requested_start se conserva: es el horario original pedido por el cliente.
    update public.appointments
       set status = 'esperando_cliente', confirmed_start = null, confirmed_at = null,
           duration_minutes = v_duration,
           agreed_price = coalesce(p_agreed_price, agreed_price),
           operator = coalesce(nullif(trim(p_operator), ''), operator)
     where id = p_id;

  elsif v_action = 'client_accepted' then
    if appt.status <> 'esperando_cliente' then
      raise exception 'El turno no está esperando la aceptación del cliente.' using errcode = 'P0001';
    end if;
    select * into prop from public.appointment_proposals
     where appointment_id = p_id and status = 'pendiente' for update;
    if not found then
      raise exception 'No hay una propuesta pendiente para aceptar.' using errcode = 'P0001';
    end if;
    perform public.assert_business_hours(prop.proposed_start, prop.duration_minutes);
    -- El trigger appointments_capacity vuelve a verificar la disponibilidad en este momento.
    update public.appointments
       set status = 'confirmado', confirmed_start = prop.proposed_start, confirmed_at = now(),
           duration_minutes = prop.duration_minutes
     where id = p_id;
    update public.appointment_proposals
       set status = 'aceptada', responded_at = now(), responded_by = auth.uid()
     where id = prop.id;
    update public.inquiries set commercial_status = 'convertida'
     where id = appt.inquiry_id
       and commercial_status in ('nueva', 'pendiente_respuesta', 'presupuesto_enviado', 'turno_solicitado', 'reprogramado');

  elsif v_action = 'client_rejected' then
    if appt.status <> 'esperando_cliente' then
      raise exception 'El turno no está esperando la aceptación del cliente.' using errcode = 'P0001';
    end if;
    update public.appointment_proposals
       set status = 'rechazada', responded_at = now(), responded_by = auth.uid()
     where appointment_id = p_id and status = 'pendiente';
    if not found then
      raise exception 'No hay una propuesta pendiente.' using errcode = 'P0001';
    end if;

  elsif v_action = 'reject' then
    if appt.status not in ('solicitado', 'reprogramado', 'esperando_cliente') then
      raise exception 'Solo se pueden rechazar turnos pendientes.' using errcode = 'P0001';
    end if;
    update public.appointment_proposals
       set status = 'anulada', responded_at = now(), responded_by = auth.uid()
     where appointment_id = p_id and status = 'pendiente';
    update public.appointments
       set status = 'rechazado', cancel_reason = coalesce(nullif(trim(p_reason), ''), cancel_reason)
     where id = p_id;
    update public.inquiries set commercial_status = 'no_contratado'
     where id = appt.inquiry_id and commercial_status not in ('servicio_realizado', 'cobrado');

  elsif v_action = 'cancel' then
    if appt.status not in ('solicitado', 'confirmado', 'reprogramado', 'esperando_cliente') then
      raise exception 'Este turno no se puede cancelar.' using errcode = 'P0001';
    end if;
    update public.appointment_proposals
       set status = 'anulada', responded_at = now(), responded_by = auth.uid()
     where appointment_id = p_id and status = 'pendiente';
    update public.appointments
       set status = 'cancelado', cancel_reason = coalesce(nullif(trim(p_reason), ''), cancel_reason)
     where id = p_id;
    update public.inquiries set commercial_status = 'cancelado'
     where id = appt.inquiry_id and commercial_status not in ('servicio_realizado', 'cobrado');

  else
    raise exception 'Acción inválida' using errcode = '22023';
  end if;
end;
$function$;

-- 7. Marcar manualmente un mensaje de WhatsApp como enviado ---------------------------------
create or replace function public.mark_whatsapp_sent(p_appointment_id uuid, p_kind text)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  appt public.appointments%rowtype;
  v_proposal uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into appt from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Turno inexistente' using errcode = 'P0001';
  end if;

  if p_kind = 'confirmacion' then
    if appt.status <> 'confirmado' then
      raise exception 'Solo se puede registrar la confirmación de un turno confirmado.' using errcode = 'P0001';
    end if;
  elsif p_kind = 'propuesta' then
    select id into v_proposal from public.appointment_proposals
     where appointment_id = p_appointment_id and status = 'pendiente';
    if v_proposal is null then
      raise exception 'No hay una propuesta pendiente para registrar.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Tipo de mensaje inválido' using errcode = '22023';
  end if;

  insert into public.appointment_messages (appointment_id, kind, proposal_id, marked_sent_by_email)
  values (p_appointment_id, p_kind, v_proposal, auth.jwt() ->> 'email');
end;
$function$;

-- 8. Permisos -------------------------------------------------------------------------------
revoke all on function public.manage_appointment(uuid, text, timestamptz, integer, numeric, text, text) from public, anon;
grant execute on function public.manage_appointment(uuid, text, timestamptz, integer, numeric, text, text) to authenticated;
revoke all on function public.mark_whatsapp_sent(uuid, text) from public, anon;
grant execute on function public.mark_whatsapp_sent(uuid, text) to authenticated;
revoke all on function public.appointment_slot_conflicts(timestamptz, integer, uuid, text) from public, anon;
grant execute on function public.appointment_slot_conflicts(timestamptz, integer, uuid, text) to authenticated;
revoke all on table public.appointment_proposals, public.appointment_messages from anon;
