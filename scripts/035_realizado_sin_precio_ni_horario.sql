-- Lavados marcados como realizados sin precio en el turno (solo en los vehículos) quedaban con
-- precio final 0 y no se podía cobrar. Y si además no tenían horario, no se podían volver atrás.

create or replace function public.appointment_vehicles_total(p_id uuid)
returns numeric
language sql
stable
set search_path to ''
as $$
  select sum(price_applied) from public.appointment_vehicles where appointment_id = p_id and price_applied is not null
$$;

create or replace function public.admin_set_appointment_status(p_id uuid, p_status text)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_category text;
  v_price numeric(12, 2);
  v_paid numeric(12, 2);
  v_agreed numeric(12, 2);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_status not in ('solicitado', 'confirmado', 'realizado', 'cancelado', 'rechazado') then
    raise exception 'Estado inválido' using errcode = '22023';
  end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  if appt.status = p_status then return; end if;

  select id into v_service from public.services where appointment_id = p_id order by created_at limit 1;

  if p_status <> 'realizado' and v_service is not null then
    if exists (select 1 from public.payments where appointment_id = p_id and voided_at is null and kind = 'servicio') then
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
      raise exception 'El turno no tiene horario: cargá la fecha y el horario primero.' using errcode = 'P0001';
    end if;
    update public.appointments
       set status = 'confirmado', confirmed_start = coalesce(confirmed_start, requested_start), confirmed_at = coalesce(confirmed_at, now())
     where id = p_id;

  elsif p_status = 'realizado' then
    v_agreed := coalesce(appt.agreed_price, public.appointment_vehicles_total(p_id));
    update public.appointments
       set status = 'realizado',
           confirmed_start = coalesce(confirmed_start, requested_start),
           confirmed_at = coalesce(confirmed_at, now()),
           agreed_price = v_agreed
     where id = p_id;
    if v_service is null then
      select category into v_category from public.vehicles where id = appt.vehicle_id;
      insert into public.services (
        appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at, agreed_price, final_price, operator
      ) values (
        appt.id, appt.client_id, appt.vehicle_id, v_category, left(coalesce(nullif(trim(appt.service), ''), 'Lavado'), 120),
        least(coalesce(appt.confirmed_start, appt.requested_start, now()), now()),
        v_agreed,
        coalesce(appt.adjusted_price, greatest(coalesce(v_agreed, 0) - coalesce(appt.discount, 0), 0)),
        appt.operator
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
  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null and kind = 'servicio';

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
end $function$;

-- Volver un servicio realizado a pendiente: si el turno no tiene horario vuelve a Solicitado en vez de fallar.
create or replace function public.admin_set_service_progress(p_id uuid, p_state text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  appt public.appointments%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_state not in ('pendiente', 'en_proceso', 'realizado') then
    raise exception 'Estado de servicio inválido' using errcode = '22023';
  end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  if appt.status in ('cancelado', 'rechazado') then
    raise exception 'El turno está cancelado: reactivalo antes de cambiar el servicio.' using errcode = 'P0001';
  end if;

  if p_state = 'realizado' then
    if appt.status <> 'realizado' then
      perform public.admin_set_appointment_status(p_id, 'realizado');
    end if;
    update public.appointments set preparing_since = null where id = p_id;
  else
    if appt.status = 'realizado' then
      perform public.admin_set_appointment_status(
        p_id,
        case when coalesce(appt.confirmed_start, appt.requested_start) is null then 'solicitado' else 'confirmado' end
      );
    end if;
    update public.appointments
       set preparing_since = case when p_state = 'en_proceso' then coalesce(preparing_since, now()) else null end
     where id = p_id;
  end if;
end $function$;

-- Reparar los realizados que quedaron en $0 aunque sus vehículos tienen precio (sin pagos cargados).
with fix as (
  select a.id, public.appointment_vehicles_total(a.id) as total, coalesce(a.discount, 0) as discount
    from public.appointments a
    join public.services s on s.appointment_id = a.id
   where a.status = 'realizado'
     and coalesce(s.final_price, 0) = 0
     and a.agreed_price is null
     and a.adjusted_price is null
     and public.appointment_vehicles_total(a.id) > 0
     and not exists (select 1 from public.payments p where p.appointment_id = a.id and p.voided_at is null)
), upd_appt as (
  update public.appointments a set agreed_price = fix.total from fix where a.id = fix.id returning a.id
)
update public.services s
   set agreed_price = fix.total,
       final_price = greatest(fix.total - fix.discount, 0)
  from fix
 where s.appointment_id = fix.id;
