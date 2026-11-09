-- 021: edición operativa (estados rápidos, fechas históricas, correcciones de precio/cobro,
-- ingresos y egresos editables con rectificación). Solo agrega columnas, tablas y funciones.

-- 1. Columnas nuevas -------------------------------------------------------------------------

alter table public.appointments
  add column if not exists adjusted_price numeric(12, 2) check (adjusted_price is null or adjusted_price >= 0);

alter table public.payments
  add column if not exists kind text not null default 'servicio',
  add column if not exists rectifies_id uuid references public.payments (id) on delete set null,
  add column if not exists concept text,
  add column if not exists updated_at timestamptz;

do $$ begin
  alter table public.payments add constraint payments_kind_check check (kind in ('servicio', 'propina'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_concept_check check (concept is null or length(concept) <= 200);
exception when duplicate_object then null; end $$;

alter table public.expenses
  add column if not exists supplier text,
  add column if not exists notes text,
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_email text,
  add column if not exists void_reason text,
  add column if not exists rectifies_id uuid references public.expenses (id) on delete set null,
  add column if not exists updated_at timestamptz;

do $$ begin
  alter table public.expenses add constraint expenses_supplier_check check (supplier is null or length(supplier) <= 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.expenses add constraint expenses_notes_check check (notes is null or length(notes) <= 1000);
exception when duplicate_object then null; end $$;

create index if not exists payments_rectifies_idx on public.payments (rectifies_id);
create index if not exists expenses_appointment_idx on public.expenses (appointment_id);

-- 2. Historial de correcciones administrativas -----------------------------------------------

create table if not exists public.admin_corrections (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id uuid not null,
  appointment_id uuid references public.appointments (id) on delete set null,
  kind text not null,
  before jsonb,
  after jsonb,
  reason text,
  actor_id uuid,
  actor_email text,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists admin_corrections_appt_idx on public.admin_corrections (appointment_id, created_at desc);
create index if not exists admin_corrections_entity_idx on public.admin_corrections (entity, entity_id, created_at desc);

alter table public.admin_corrections enable row level security;
drop policy if exists "admins read corrections" on public.admin_corrections;
create policy "admins read corrections" on public.admin_corrections for select to authenticated using (public.is_admin());

create or replace function public.log_correction(
  p_entity text, p_entity_id uuid, p_appointment_id uuid, p_kind text, p_before jsonb, p_after jsonb, p_reason text
) returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.admin_corrections (entity, entity_id, appointment_id, kind, before, after, reason, actor_id, actor_email, actor_name)
  values (
    p_entity, p_entity_id, p_appointment_id, p_kind, p_before, p_after, nullif(left(trim(coalesce(p_reason, '')), 300), ''),
    auth.uid(), auth.jwt() ->> 'email',
    (select nullif(trim(a.full_name), '') from public.admins a where a.user_id = auth.uid())
  );
end $$;

-- 3. Propinas fuera del saldo del servicio ---------------------------------------------------

create or replace function public.recalculate_appointment_payment(p_appointment_id uuid)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_paid numeric(12, 2);
  v_total numeric(12, 2);
begin
  if p_appointment_id is null then return; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
   where appointment_id = p_appointment_id and voided_at is null and kind = 'servicio';
  select coalesce(
           (select s.final_price from public.services s where s.appointment_id = a.id order by s.created_at desc limit 1),
           a.adjusted_price, a.agreed_price)
    into v_total from public.appointments a where a.id = p_appointment_id;
  update public.appointments
     set amount_paid = v_paid,
         payment_status = case when v_paid <= 0 then 'pendiente' when v_total is null or v_paid < v_total then 'parcial' else 'pagado' end
   where id = p_appointment_id;
end $$;

create or replace function public.recalculate_service_payment()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare
  target uuid;
  total numeric(12, 2);
  price numeric(12, 2);
begin
  foreach target in array array_remove(array[new.service_id, old.service_id], null) loop
    select coalesce(sum(amount), 0) into total from public.payments
     where service_id = target and voided_at is null and kind = 'servicio';
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

-- 4. Agenda: los turnos pasados (históricos) no se bloquean por conflictos actuales ------------

create or replace function public.check_appointment_capacity()
returns trigger language plpgsql security definer set search_path to ''
as $$
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
  if new.confirmed_start < now() - interval '1 hour' then
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
end $$;

-- 5. Precio final de referencia y estado comercial -------------------------------------------

create or replace function public.appointment_final_price(p_id uuid)
returns numeric language sql stable security definer set search_path to ''
as $$
  select coalesce(
    (select s.final_price from public.services s where s.appointment_id = a.id order by s.created_at limit 1),
    a.adjusted_price,
    greatest(coalesce(a.agreed_price, 0) - coalesce(a.discount, 0), 0)
  ) from public.appointments a where a.id = p_id
$$;

create or replace function public.sync_inquiry_payment_status(p_id uuid)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  v_price numeric(12, 2);
  v_paid numeric(12, 2);
begin
  select * into appt from public.appointments where id = p_id;
  if not found or appt.status <> 'realizado' then return; end if;
  v_price := public.appointment_final_price(p_id);
  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null and kind = 'servicio';
  update public.inquiries
     set commercial_status = case when v_price > 0 and v_paid >= v_price then 'cobrado' else 'servicio_realizado' end
   where id = appt.inquiry_id and commercial_status in ('cobrado', 'servicio_realizado');
end $$;

-- 6. Estado del servicio (separado del turno y del pago) -------------------------------------

create or replace function public.admin_set_service_progress(p_id uuid, p_state text)
returns void language plpgsql security definer set search_path to ''
as $$
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
      perform public.admin_set_appointment_status(p_id, 'confirmado');
    end if;
    update public.appointments
       set preparing_since = case when p_state = 'en_proceso' then coalesce(preparing_since, now()) else null end
     where id = p_id;
  end if;
end $$;

-- 7. Fecha y horario (permite fechas pasadas) ------------------------------------------------

create or replace function public.admin_reschedule_appointment(p_id uuid, p_start timestamptz, p_reason text)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  v_before timestamptz;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_start is null then raise exception 'Fecha inválida' using errcode = '22023'; end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;

  v_before := coalesce(appt.confirmed_start, appt.requested_start);
  if v_before = p_start then return; end if;

  if appt.status in ('confirmado', 'realizado') then
    update public.appointments set confirmed_start = p_start where id = p_id;
  else
    update public.appointments set requested_start = p_start where id = p_id;
    if appt.status = 'esperando_cliente' then
      update public.appointment_proposals set proposed_start = p_start where appointment_id = p_id and status = 'pendiente';
    end if;
  end if;

  if appt.status = 'realizado' then
    if p_start > now() + interval '1 day' then
      raise exception 'Un servicio realizado no puede tener fecha futura.' using errcode = '22023';
    end if;
    update public.services set performed_at = p_start where appointment_id = p_id;
  end if;

  perform public.log_correction('appointment', p_id, p_id, 'fecha',
    jsonb_build_object('fecha', v_before), jsonb_build_object('fecha', p_start), p_reason);
end $$;

-- 8. Precio final ajustado (conserva el acordado) --------------------------------------------

create or replace function public.admin_adjust_final_price(p_id uuid, p_price numeric, p_reason text)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_current numeric(12, 2);
  v_paid numeric(12, 2);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_price is null or p_price < 0 or p_price > 100000000 then raise exception 'Precio inválido' using errcode = '22023'; end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;

  v_current := public.appointment_final_price(p_id);
  if v_current = round(p_price, 2) then return; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indicá el motivo del ajuste de precio.' using errcode = '22023';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null and kind = 'servicio';
  if p_price < v_paid then
    raise exception 'El precio no puede ser menor a lo ya cobrado ($%). Corregí primero el importe cobrado.', v_paid using errcode = 'P0001';
  end if;

  update public.appointments set adjusted_price = round(p_price, 2) where id = p_id;
  select id into v_service from public.services where appointment_id = p_id order by created_at limit 1;
  if v_service is not null then
    update public.services
       set final_price = round(p_price, 2),
           payment_status = case when amount_paid <= 0 then 'pendiente' when amount_paid < round(p_price, 2) then 'parcial' else 'cobrado' end
     where id = v_service;
  end if;
  perform public.recalculate_appointment_payment(p_id);
  perform public.sync_inquiry_payment_status(p_id);

  perform public.log_correction('appointment', p_id, p_id, 'precio',
    jsonb_build_object('acordado', appt.agreed_price, 'descuento', appt.discount, 'precio_final', v_current),
    jsonb_build_object('precio_final', round(p_price, 2)), p_reason);
end $$;

-- 9. Importe cobrado (sin duplicar: agrega la diferencia o anula lo excedente) ---------------

create or replace function public.admin_set_collected_amount(p_id uuid, p_amount numeric, p_method text, p_paid_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_price numeric(12, 2);
  v_paid numeric(12, 2);
  v_excess numeric(12, 2);
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  r public.payments%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000000 then raise exception 'Importe inválido' using errcode = '22023'; end if;
  if v_paid_at > now() + interval '1 day' then raise exception 'La fecha de cobro no puede ser futura.' using errcode = '22023'; end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;

  v_price := public.appointment_final_price(p_id);
  if p_amount > 0 and coalesce(v_price, 0) <= 0 then
    raise exception 'El turno no tiene precio: cargá primero el precio final.' using errcode = 'P0001';
  end if;
  if p_amount > v_price then
    raise exception 'El importe cobrado supera el precio final ($%). Ajustá el precio o registrá la diferencia como propina.', v_price using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null and kind = 'servicio';
  if v_paid = round(p_amount, 2) then return; end if;

  if p_amount > v_paid then
    if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then
      raise exception 'Medio de pago inválido' using errcode = '22023';
    end if;
    select id into v_service from public.services where appointment_id = p_id order by created_at limit 1;
    insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, kind, verified_by, verified_by_email, verified_at)
    values (v_service, p_id, round(p_amount - v_paid, 2), p_method, v_paid_at,
            coalesce(nullif(left(trim(coalesce(p_reason, '')), 300), ''), 'Cobro registrado desde edición rápida'),
            'servicio', auth.uid(), auth.jwt() ->> 'email', now());
  else
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Indicá el motivo de la corrección del cobro.' using errcode = '22023';
    end if;
    v_excess := v_paid - round(p_amount, 2);
    for r in
      select * from public.payments
       where appointment_id = p_id and voided_at is null and kind = 'servicio'
       order by paid_at desc, created_at desc
    loop
      exit when v_excess <= 0;
      update public.payments
         set voided_at = now(), voided_by_email = auth.jwt() ->> 'email', void_reason = left('Corrección de cobro: ' || trim(p_reason), 300)
       where id = r.id;
      if r.amount > v_excess then
        insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, concept, kind, rectifies_id, verified_by, verified_by_email, verified_at)
        values (r.service_id, r.appointment_id, r.amount - v_excess, r.method, r.paid_at,
                left(concat_ws(' · ', r.notes, 'Rectifica pago anterior'), 300), r.concept, 'servicio', r.id,
                auth.uid(), auth.jwt() ->> 'email', now());
        v_excess := 0;
      else
        v_excess := v_excess - r.amount;
      end if;
    end loop;
  end if;

  perform public.sync_inquiry_payment_status(p_id);
  perform public.log_correction('appointment', p_id, p_id, 'cobro',
    jsonb_build_object('cobrado', v_paid, 'precio_final', v_price),
    jsonb_build_object('cobrado', round(p_amount, 2), 'medio', p_method), p_reason);
end $$;

-- 10. Propinas / importes adicionales --------------------------------------------------------

create or replace function public.admin_add_tip(p_id uuid, p_amount numeric, p_method text, p_paid_at timestamptz, p_notes text)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_service uuid;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'Importe inválido' using errcode = '22023'; end if;
  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then raise exception 'Medio de pago inválido' using errcode = '22023'; end if;
  if v_paid_at > now() + interval '1 day' then raise exception 'La fecha no puede ser futura.' using errcode = '22023'; end if;
  if not exists (select 1 from public.appointments where id = p_id) then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  select id into v_service from public.services where appointment_id = p_id order by created_at limit 1;
  insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, concept, kind, verified_by, verified_by_email, verified_at)
  values (v_service, p_id, round(p_amount, 2), p_method, v_paid_at, nullif(left(trim(coalesce(p_notes, '')), 300), ''),
          'Propina / adicional', 'propina', auth.uid(), auth.jwt() ->> 'email', now());
  perform public.log_correction('appointment', p_id, p_id, 'propina', null,
    jsonb_build_object('importe', round(p_amount, 2), 'medio', p_method), p_notes);
end $$;

-- 11. Ingresos editables (rectificación si el día está cerrado en caja) ----------------------

create or replace function public.admin_update_payment(
  p_payment_id uuid, p_paid_at timestamptz, p_amount numeric, p_method text, p_concept text, p_notes text,
  p_appointment_id uuid, p_reason text
) returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
  r public.payments%rowtype;
  v_appt uuid;
  v_service uuid;
  v_price numeric(12, 2);
  v_other numeric(12, 2);
  v_closed boolean;
  v_new uuid;
  v_tz constant text := 'America/Argentina/Mendoza';
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into r from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Ingreso inexistente' using errcode = 'P0001'; end if;
  if r.voided_at is not null then raise exception 'Este ingreso está anulado o rectificado: editá el registro vigente.' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'Importe inválido' using errcode = '22023'; end if;
  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then raise exception 'Medio de pago inválido' using errcode = '22023'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then raise exception 'La fecha no puede ser futura.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indicá el motivo de la corrección.' using errcode = '22023'; end if;

  v_appt := coalesce(p_appointment_id, r.appointment_id);
  if v_appt is not null and not exists (select 1 from public.appointments where id = v_appt) then
    raise exception 'El servicio vinculado no existe.' using errcode = 'P0001';
  end if;
  select id into v_service from public.services where appointment_id = v_appt order by created_at limit 1;
  if v_appt is null then v_service := r.service_id; end if;

  if r.kind = 'servicio' and v_appt is not null then
    v_price := public.appointment_final_price(v_appt);
    select coalesce(sum(amount), 0) into v_other from public.payments
     where appointment_id = v_appt and voided_at is null and kind = 'servicio' and id <> r.id;
    if coalesce(v_price, 0) > 0 and v_other + p_amount > v_price then
      raise exception 'El importe supera el saldo del servicio (saldo: $%). Ajustá el precio final primero.', greatest(v_price - v_other, 0)
        using errcode = 'P0001';
    end if;
  end if;

  v_closed := exists (
    select 1 from public.cash_closings c
     where c.day in ((r.paid_at at time zone v_tz)::date, (p_paid_at at time zone v_tz)::date)
  );

  if v_closed then
    update public.payments
       set voided_at = now(), voided_by_email = auth.jwt() ->> 'email', void_reason = left('Rectificado: ' || trim(p_reason), 300)
     where id = r.id;
    insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, concept, kind, rectifies_id, verified_by, verified_by_email, verified_at)
    values (v_service, v_appt, round(p_amount, 2), p_method, p_paid_at, nullif(left(trim(coalesce(p_notes, '')), 300), ''),
            nullif(left(trim(coalesce(p_concept, '')), 200), ''), r.kind, r.id, auth.uid(), auth.jwt() ->> 'email', now())
    returning id into v_new;
  else
    update public.payments
       set paid_at = p_paid_at, amount = round(p_amount, 2), method = p_method,
           concept = nullif(left(trim(coalesce(p_concept, '')), 200), ''),
           notes = nullif(left(trim(coalesce(p_notes, '')), 300), ''),
           appointment_id = v_appt, service_id = v_service, updated_at = now()
     where id = r.id;
    v_new := r.id;
  end if;

  perform public.sync_inquiry_payment_status(v_appt);
  if r.appointment_id is distinct from v_appt then perform public.sync_inquiry_payment_status(r.appointment_id); end if;

  perform public.log_correction('payment', r.id, v_appt, case when v_closed then 'rectificacion' else 'ingreso' end,
    jsonb_build_object('fecha', r.paid_at, 'importe', r.amount, 'medio', r.method, 'concepto', r.concept, 'notas', r.notes, 'turno', r.appointment_id),
    jsonb_build_object('fecha', p_paid_at, 'importe', round(p_amount, 2), 'medio', p_method, 'concepto', p_concept, 'notas', p_notes, 'turno', v_appt, 'registro', v_new),
    p_reason);
  return v_new;
end $$;

-- 12. Egresos editables y anulables (sin borrar historial) -----------------------------------

create or replace function public.admin_update_expense(
  p_id uuid, p_day date, p_category text, p_amount numeric, p_method text, p_description text, p_supplier text,
  p_notes text, p_appointment_id uuid, p_reason text
) returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
  r public.expenses%rowtype;
  v_closed boolean;
  v_new uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into r from public.expenses where id = p_id for update;
  if not found then raise exception 'Egreso inexistente' using errcode = 'P0001'; end if;
  if r.voided_at is not null then raise exception 'Este egreso está anulado o rectificado: editá el registro vigente.' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'Importe inválido' using errcode = '22023'; end if;
  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then raise exception 'Medio de pago inválido' using errcode = '22023'; end if;
  if p_category not in ('productos', 'combustible', 'mantenimiento', 'publicidad', 'otro') then raise exception 'Categoría inválida' using errcode = '22023'; end if;
  if p_day is null or p_day > (now() at time zone 'America/Argentina/Mendoza')::date then raise exception 'La fecha no puede ser futura.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indicá el motivo de la corrección.' using errcode = '22023'; end if;
  if p_appointment_id is not null and not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'El servicio vinculado no existe.' using errcode = 'P0001';
  end if;

  v_closed := exists (select 1 from public.cash_closings c where c.day in (r.spent_on, p_day));

  if v_closed then
    update public.expenses
       set voided_at = now(), voided_by_email = auth.jwt() ->> 'email', void_reason = left('Rectificado: ' || trim(p_reason), 300)
     where id = r.id;
    insert into public.expenses (spent_on, category, amount, method, description, supplier, notes, appointment_id, rectifies_id, is_demo)
    values (p_day, p_category, round(p_amount, 2), p_method, nullif(left(trim(coalesce(p_description, '')), 300), ''),
            nullif(left(trim(coalesce(p_supplier, '')), 120), ''), nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
            p_appointment_id, r.id, r.is_demo)
    returning id into v_new;
  else
    update public.expenses
       set spent_on = p_day, category = p_category, amount = round(p_amount, 2), method = p_method,
           description = nullif(left(trim(coalesce(p_description, '')), 300), ''),
           supplier = nullif(left(trim(coalesce(p_supplier, '')), 120), ''),
           notes = nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
           appointment_id = p_appointment_id, updated_at = now()
     where id = r.id;
    v_new := r.id;
  end if;

  perform public.log_correction('expense', r.id, p_appointment_id, case when v_closed then 'rectificacion' else 'egreso' end,
    jsonb_build_object('fecha', r.spent_on, 'categoria', r.category, 'importe', r.amount, 'medio', r.method, 'concepto', r.description,
                       'proveedor', r.supplier, 'notas', r.notes, 'turno', r.appointment_id),
    jsonb_build_object('fecha', p_day, 'categoria', p_category, 'importe', round(p_amount, 2), 'medio', p_method, 'concepto', p_description,
                       'proveedor', p_supplier, 'notas', p_notes, 'turno', p_appointment_id, 'registro', v_new),
    p_reason);
  return v_new;
end $$;

create or replace function public.admin_void_expense(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to ''
as $$
declare
  r public.expenses%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indicá el motivo de la anulación.' using errcode = '22023'; end if;
  select * into r from public.expenses where id = p_id for update;
  if not found then raise exception 'Egreso inexistente' using errcode = 'P0001'; end if;
  if r.voided_at is not null then return; end if;
  update public.expenses
     set voided_at = now(), voided_by_email = auth.jwt() ->> 'email', void_reason = left(trim(p_reason), 300)
   where id = p_id;
  perform public.log_correction('expense', p_id, r.appointment_id, 'anulacion',
    jsonb_build_object('fecha', r.spent_on, 'importe', r.amount, 'concepto', r.description), null, p_reason);
end $$;

-- 13. Funciones existentes: excluir propinas del saldo y respetar el precio ajustado ----------

create or replace function public.add_payment(p_service_id uuid, p_amount numeric, p_method text, p_paid_at timestamptz, p_notes text)
returns void language plpgsql set search_path to ''
as $$
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
   where (service_id = svc.id or (svc.appointment_id is not null and appointment_id = svc.appointment_id))
     and voided_at is null and kind = 'servicio';
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

create or replace function public.admin_set_appointment_payment(p_id uuid, p_paid boolean, p_method text default 'efectivo', p_amount numeric default null)
returns void language plpgsql set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  svc public.services%rowtype;
  v_paid numeric(12, 2);
  v_balance numeric(12, 2);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;

  if not p_paid then
    update public.payments
       set voided_at = now(), voided_by_email = auth.jwt() ->> 'email', void_reason = 'Marcado como pendiente desde Consultas'
     where appointment_id = p_id and voided_at is null and kind = 'servicio';
    update public.inquiries set commercial_status = 'servicio_realizado' where id = appt.inquiry_id and commercial_status = 'cobrado';
    return;
  end if;

  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then raise exception 'Medio de pago inválido' using errcode = '22023'; end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 100000000) then raise exception 'Importe inválido' using errcode = '22023'; end if;

  if appt.status <> 'realizado' then perform public.admin_set_appointment_status(p_id, 'realizado'); end if;

  select * into svc from public.services where appointment_id = p_id order by created_at limit 1 for update;
  if p_amount is not null and p_amount > 0 then
    update public.services set final_price = p_amount where id = svc.id;
    svc.final_price := p_amount;
  end if;
  if coalesce(svc.final_price, 0) <= 0 then
    raise exception 'El turno no tiene precio cargado: ingresá el importe cobrado.' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.payments where appointment_id = p_id and voided_at is null and kind = 'servicio';
  v_balance := svc.final_price - v_paid;
  if v_balance > 0 then
    insert into public.payments (service_id, appointment_id, amount, method, paid_at, notes, verified_by, verified_by_email, verified_at)
    values (svc.id, p_id, v_balance, p_method, now(), 'Registrado desde Consultas', auth.uid(), auth.jwt() ->> 'email', now());
  end if;

  update public.inquiries set commercial_status = 'cobrado' where id = appt.inquiry_id;
  update public.clients set last_interaction_at = now() where id = appt.client_id;
end $$;

create or replace function public.admin_set_appointment_status(p_id uuid, p_status text)
returns void language plpgsql set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_category text;
  v_price numeric(12, 2);
  v_paid numeric(12, 2);
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
    update public.appointments
       set status = 'realizado', confirmed_start = coalesce(confirmed_start, requested_start), confirmed_at = coalesce(confirmed_at, now())
     where id = p_id;
    if v_service is null then
      select category into v_category from public.vehicles where id = appt.vehicle_id;
      insert into public.services (
        appointment_id, client_id, vehicle_id, vehicle_category, wash_type, performed_at, agreed_price, final_price, operator
      ) values (
        appt.id, appt.client_id, appt.vehicle_id, v_category, left(coalesce(nullif(trim(appt.service), ''), 'Lavado'), 120),
        least(coalesce(appt.confirmed_start, appt.requested_start, now()), now()),
        appt.agreed_price,
        coalesce(appt.adjusted_price, greatest(coalesce(appt.agreed_price, 0) - coalesce(appt.discount, 0), 0)),
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
end $$;

-- 14. Permisos -------------------------------------------------------------------------------

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.log_correction(text, uuid, uuid, text, jsonb, jsonb, text)',
    'public.appointment_final_price(uuid)',
    'public.sync_inquiry_payment_status(uuid)',
    'public.admin_set_service_progress(uuid, text)',
    'public.admin_reschedule_appointment(uuid, timestamptz, text)',
    'public.admin_adjust_final_price(uuid, numeric, text)',
    'public.admin_set_collected_amount(uuid, numeric, text, timestamptz, text)',
    'public.admin_add_tip(uuid, numeric, text, timestamptz, text)',
    'public.admin_update_payment(uuid, timestamptz, numeric, text, text, text, uuid, text)',
    'public.admin_update_expense(uuid, date, text, numeric, text, text, text, text, uuid, text)',
    'public.admin_void_expense(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
