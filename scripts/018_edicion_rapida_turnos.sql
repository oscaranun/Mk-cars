-- Edición rápida desde Consultas: el admin puede cambiar el estado de un turno y marcarlo
-- como pagado o pendiente en cualquier momento, sin seguir el flujo paso a paso.

create or replace function public.admin_set_appointment_status(p_id uuid, p_status text)
returns void
language plpgsql
set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_category text;
  v_price numeric(12, 2);
  v_paid numeric(12, 2);
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_status not in ('solicitado', 'confirmado', 'realizado', 'cancelado', 'rechazado') then
    raise exception 'Estado inválido' using errcode = '22023';
  end if;

  select * into appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Turno inexistente' using errcode = 'P0001';
  end if;
  if appt.status = p_status then
    return;
  end if;

  select id into v_service from public.services where appointment_id = p_id order by created_at limit 1;

  if p_status <> 'realizado' and v_service is not null then
    if exists (select 1 from public.payments where appointment_id = p_id and voided_at is null) then
      raise exception 'El turno tiene pagos registrados: primero pasá el pago a "Pendiente".' using errcode = 'P0001';
    end if;
    update public.payments set service_id = null where service_id = v_service;
    delete from public.services where appointment_id = p_id;
  end if;

  if p_status in ('confirmado', 'cancelado', 'rechazado', 'realizado') then
    update public.appointment_proposals
       set status = 'anulada', responded_at = now(), responded_by = auth.uid()
     where appointment_id = p_id and status = 'pendiente';
  end if;

  if p_status = 'confirmado' then
    if coalesce(appt.confirmed_start, appt.requested_start) is null then
      raise exception 'El turno no tiene horario: abrilo en Turnos y proponé uno.' using errcode = 'P0001';
    end if;
    update public.appointments
       set status = 'confirmado',
           confirmed_start = coalesce(confirmed_start, requested_start),
           confirmed_at = coalesce(confirmed_at, now())
     where id = p_id;

  elsif p_status = 'realizado' then
    update public.appointments
       set status = 'realizado',
           confirmed_start = coalesce(confirmed_start, requested_start),
           confirmed_at = coalesce(confirmed_at, now())
     where id = p_id;
    if v_service is null then
      select category into v_category from public.vehicles where id = appt.vehicle_id;
      insert into public.services (
        appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at,
        agreed_price, final_price, operator
      ) values (
        appt.id, appt.client_id, appt.vehicle_id, v_category, left(coalesce(nullif(trim(appt.service), ''), 'Lavado'), 120),
        least(coalesce(appt.confirmed_start, appt.requested_start, now()), now()),
        appt.agreed_price, greatest(coalesce(appt.agreed_price, 0) - coalesce(appt.discount, 0), 0), appt.operator
      );
    end if;

  else
    update public.appointments
       set status = p_status,
           confirmed_start = case when p_status = 'solicitado' then null else confirmed_start end,
           confirmed_at = case when p_status = 'solicitado' then null else confirmed_at end
     where id = p_id;
  end if;

  select final_price into v_price from public.services where appointment_id = p_id order by created_at limit 1;
  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null;

  update public.inquiries
     set commercial_status = case p_status
       when 'solicitado' then 'turno_solicitado'
       when 'confirmado' then 'turno_confirmado'
       when 'realizado' then case when v_price > 0 and v_paid >= v_price then 'cobrado' else 'servicio_realizado' end
       when 'cancelado' then 'cancelado'
       else 'no_contratado'
     end
   where id = appt.inquiry_id;

  update public.clients set last_interaction_at = now() where id = appt.client_id;
end;
$$;

create or replace function public.admin_set_appointment_payment(
  p_id uuid,
  p_paid boolean,
  p_method text default 'efectivo',
  p_amount numeric default null
)
returns void
language plpgsql
set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  svc public.services%rowtype;
  v_paid numeric(12, 2);
  v_balance numeric(12, 2);
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Turno inexistente' using errcode = 'P0001';
  end if;

  if not p_paid then
    update public.payments
       set voided_at = now(), voided_by_email = auth.jwt() ->> 'email',
           void_reason = 'Marcado como pendiente desde Consultas'
     where appointment_id = p_id and voided_at is null;
    update public.inquiries set commercial_status = 'servicio_realizado'
     where id = appt.inquiry_id and commercial_status = 'cobrado';
    return;
  end if;

  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then
    raise exception 'Medio de pago inválido' using errcode = '22023';
  end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 100000000) then
    raise exception 'Importe inválido' using errcode = '22023';
  end if;

  if appt.status <> 'realizado' then
    perform public.admin_set_appointment_status(p_id, 'realizado');
  end if;

  select * into svc from public.services where appointment_id = p_id order by created_at limit 1 for update;
  if p_amount is not null and p_amount > 0 then
    update public.services set final_price = p_amount where id = svc.id;
    svc.final_price := p_amount;
  end if;
  if coalesce(svc.final_price, 0) <= 0 then
    raise exception 'El turno no tiene precio cargado: ingresá el importe cobrado.' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null;
  v_balance := svc.final_price - v_paid;

  if v_balance > 0 then
    insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, verified_by, verified_by_email, verified_at)
    values (svc.id, p_id, v_balance, p_method, now(), 'Registrado desde Consultas', auth.uid(), auth.jwt() ->> 'email', now());
  end if;

  update public.inquiries set commercial_status = 'cobrado' where id = appt.inquiry_id;
  update public.clients set last_interaction_at = now() where id = appt.client_id;
end;
$$;

grant execute on function public.admin_set_appointment_status(uuid, text) to authenticated;
grant execute on function public.admin_set_appointment_payment(uuid, boolean, text, numeric) to authenticated;
