-- El panel puede registrar turnos y propuestas con fechas/horarios ya pasados (lavados hechos
-- antes de cargarlos). El cliente, desde su enlace, sigue sin poder aceptar horarios vencidos.

create or replace function public.offer_normalize_slots(p_slots jsonb, p_default_duration integer)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
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
    if v_duration not between 15 and 540 then raise exception 'Duración inválida.' using errcode = '22023'; end if;
    if v_start >= now() then
      perform public.assert_business_hours(v_start, v_duration);
    end if;
    if result @> jsonb_build_array(jsonb_build_object('start', v_start)) then
      raise exception 'Hay horarios repetidos.' using errcode = 'P0001';
    end if;
    result := result || jsonb_build_array(jsonb_build_object('start', v_start, 'duration', v_duration));
  end loop;
  return (select jsonb_agg(e order by (e ->> 'start')::timestamptz) from jsonb_array_elements(result) e);
end $function$;

-- Turnos ya pasados son registros administrativos: no compiten por capacidad.
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
  if new.confirmed_start < now() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmado'
     and old.confirmed_start is not distinct from new.confirmed_start
     and old.duration_minutes is not distinct from new.duration_minutes
     and old.operator is not distinct from new.operator then
    return new;
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
end $function$;

create or replace function public.respond_appointment_offer(p_token text, p_action text, p_version integer, p_start timestamp with time zone default null::timestamp with time zone, p_message text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  o public.appointment_offers%rowtype;
  a public.appointments%rowtype;
  v_slot jsonb;
  v_message text := nullif(trim(left(coalesce(p_message, ''), 500)), '');
  v_is_admin boolean := public.is_admin();
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
    if p_start < now() and not v_is_admin then raise exception 'Ese horario ya pasó. Elegí otro.' using errcode = 'P0001'; end if;
    begin
      update public.appointments
         set status = 'confirmado', confirmed_start = p_start, confirmed_at = now(),
             duration_minutes = (v_slot ->> 'duration')::int,
             agreed_price = o.total_price - o.discount, discount = o.discount, service = o.service_label
       where id = a.id;
    exception when sqlstate 'P0001' then
      if v_is_admin then
        raise exception '%', sqlerrm using errcode = 'P0001';
      end if;
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
          public.offer_snapshot(o) || jsonb_build_object('message', v_message),
          case when v_is_admin then auth.uid() end,
          case when v_is_admin then coalesce(auth.jwt() ->> 'email', 'admin') else 'cliente' end);
  return jsonb_build_object('status', o.status, 'accepted_start', o.accepted_start);
end $function$;
