-- Allow permanently deleting a turno (e.g. one loaded twice by mistake) once all its payments are voided.
-- Active payments still block the delete. Voided payments and the turno's service records are removed with it;
-- the audit triggers on payments/services keep a record of what was deleted.
create or replace function public.delete_appointment_permanently(p_id uuid, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  appt public.appointments%rowtype;
  v_services int;
  v_active_payments int;
  v_voided_payments int;
  v_vehicle_ids uuid[];
  v_av int := 0;
  v_hist int := 0;
  v_n int;
  v_inquiry boolean := false;
  v_vehicles int := 0;
  v_client boolean := false;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Turno inexistente' using errcode = 'P0001';
  end if;

  select count(*) into v_services from public.services where appointment_id = p_id;

  select count(*) filter (where p.voided_at is null), count(*) filter (where p.voided_at is not null)
    into v_active_payments, v_voided_payments
    from public.payments p
   where p.appointment_id = p_id
      or p.service_id in (select s.id from public.services s where s.appointment_id = p_id);

  if v_active_payments > 0 then
    if p_dry_run then
      return jsonb_build_object('blocked', true, 'services', v_services, 'payments', v_active_payments);
    end if;
    raise exception 'No se puede eliminar: la reserva tiene % pago(s) activo(s). Primero tocá "Anular pagos" y después eliminá el turno.',
      v_active_payments using errcode = 'P0001';
  end if;

  select array_agg(distinct x.v) into v_vehicle_ids
    from (select appt.vehicle_id as v
          union select av.vehicle_id from public.appointment_vehicles av where av.appointment_id = p_id) x
   where x.v is not null;

  begin
    select count(*) into v_av from public.appointment_vehicles where appointment_id = p_id;

    delete from public.payments p
     where p.appointment_id = p_id
        or p.service_id in (select s.id from public.services s where s.appointment_id = p_id);

    delete from public.status_history
     where entity = 'service' and entity_id in (select s.id from public.services s where s.appointment_id = p_id);
    get diagnostics v_n = row_count; v_hist := v_hist + v_n;

    delete from public.services where appointment_id = p_id;

    delete from public.status_history where entity = 'appointment' and entity_id = p_id;
    get diagnostics v_n = row_count; v_hist := v_hist + v_n;

    delete from public.appointments where id = p_id;

    if appt.inquiry_id is not null
       and not exists (select 1 from public.appointments a where a.inquiry_id = appt.inquiry_id) then
      delete from public.status_history where entity = 'inquiry' and entity_id = appt.inquiry_id;
      get diagnostics v_n = row_count; v_hist := v_hist + v_n;
      delete from public.inquiries where id = appt.inquiry_id;
      get diagnostics v_n = row_count; v_inquiry := v_n > 0;
    end if;

    delete from public.vehicles v
     where v.id = any(coalesce(v_vehicle_ids, '{}'))
       and not exists (select 1 from public.appointments a where a.vehicle_id = v.id)
       and not exists (select 1 from public.appointment_vehicles av where av.vehicle_id = v.id)
       and not exists (select 1 from public.inquiries i where i.vehicle_id = v.id)
       and not exists (select 1 from public.services s where s.vehicle_id = v.id);
    get diagnostics v_vehicles = row_count;

    if not exists (select 1 from public.appointments a where a.client_id = appt.client_id)
       and not exists (select 1 from public.inquiries i where i.client_id = appt.client_id)
       and not exists (select 1 from public.services s where s.client_id = appt.client_id)
       and not exists (select 1 from public.vehicles v where v.client_id = appt.client_id) then
      delete from public.clients where id = appt.client_id;
      get diagnostics v_n = row_count; v_client := v_n > 0;
    end if;

    v_result := jsonb_build_object(
      'blocked', false,
      'appointment', 1,
      'appointment_vehicles', v_av,
      'services', v_services,
      'voided_payments', v_voided_payments,
      'inquiry', v_inquiry,
      'vehicles', v_vehicles,
      'client', v_client,
      'history', v_hist
    );

    if p_dry_run then
      raise exception 'dry run' using errcode = 'MK001';
    end if;
  exception when sqlstate 'MK001' then
    null;
  end;

  return v_result;
end;
$function$;
