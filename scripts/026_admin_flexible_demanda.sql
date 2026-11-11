-- Edición flexible y carga histórica. Requiere las migraciones anteriores hasta 025.
-- Probar en una base aislada. NO aplicar automáticamente en producción.
-- Aditiva: no elimina ni reescribe registros históricos.
begin;

alter table public.appointments add column if not exists service_started_at timestamptz;
alter table public.cash_closings add column if not exists opening jsonb not null default '{}'::jsonb;
alter table public.payments add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.payments add column if not exists entry_request_id uuid;
create unique index if not exists payments_entry_request_unique on public.payments(entry_request_id) where entry_request_id is not null;
-- Los ingresos a cuenta tienen concepto obligatorio, aunque aún no exista un turno.
alter table public.payments drop constraint if exists payments_target_check;
alter table public.payments add constraint payments_target_check check (
  service_id is not null or appointment_id is not null or length(trim(coalesce(concept,'')))>=2
);

create table if not exists public.admin_demand_entries (
  request_id uuid primary key,
  appointment_id uuid references public.appointments(id) on delete set null,
  payload_hash text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.cash_closing_revisions (
  id bigint generated always as identity primary key,
  day date not null,
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  reason text,
  actor_id uuid default auth.uid(),
  actor_email text default (auth.jwt()->>'email'),
  created_at timestamptz not null default now()
);
alter table public.admin_demand_entries enable row level security;
alter table public.cash_closing_revisions enable row level security;
revoke all on public.admin_demand_entries, public.cash_closing_revisions from public, anon, authenticated;
drop policy if exists demand_entries_admin_read on public.admin_demand_entries;
create policy demand_entries_admin_read on public.admin_demand_entries for select to authenticated using(public.is_admin());
drop policy if exists closing_revisions_admin_read on public.cash_closing_revisions;
create policy closing_revisions_admin_read on public.cash_closing_revisions for select to authenticated using(public.is_admin());
grant select on public.admin_demand_entries, public.cash_closing_revisions to authenticated;

-- No combina preparación de propuesta con inicio real del lavado.
create or replace function public.admin_set_service_progress(p_id uuid, p_state text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.appointments%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  if p_state is null or p_state not in ('pendiente','en_proceso','realizado') then raise exception 'Estado inválido' using errcode='22023'; end if;
  select * into a from public.appointments where id=p_id for update;
  if not found then raise exception 'Turno inexistente'; end if;
  if a.status in ('cancelado','rechazado') then raise exception 'Reactivá el turno antes de cambiar el servicio.'; end if;
  if p_state='realizado' then
    if a.status<>'realizado' then perform public.admin_set_appointment_status(p_id,'realizado'); end if;
    update public.appointments set service_started_at=null where id=p_id;
  else
    if a.status='realizado' then perform public.admin_set_appointment_status(p_id,'confirmado'); end if;
    update public.appointments set service_started_at=case when p_state='en_proceso' then coalesce(service_started_at,now()) else null end where id=p_id;
  end if;
end $$;

-- Un ingreso puede cargarse con su fecha bancaria real, aun sin turno vinculado.
create or replace function public.admin_record_income(p_request_id uuid,p_amount numeric,p_method text,p_paid_at timestamptz,p_concept text,p_notes text,p_client_id uuid default null,p_appointment_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.payments%rowtype; appt public.appointments%rowtype; srv uuid; client uuid:=p_client_id; result uuid; paid numeric;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  if p_request_id is null or p_amount is null or p_amount<=0 or p_amount>100000000 or p_paid_at is null
    or (p_paid_at at time zone 'America/Argentina/Mendoza')::date>(now() at time zone 'America/Argentina/Mendoza')::date
    or p_method is null or p_method not in ('efectivo','transferencia','mercadopago','otro')
    or length(trim(coalesce(p_concept,''))) not between 2 and 200 then raise exception 'Revisá importe, fecha, medio y concepto.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,28));
  select * into existing from public.payments where entry_request_id=p_request_id;
  if found then
    if existing.amount<>round(p_amount,2) or existing.method<>p_method or existing.paid_at<>p_paid_at
      or existing.appointment_id is distinct from p_appointment_id or existing.concept is distinct from trim(p_concept)
      or existing.notes is distinct from nullif(trim(p_notes),'')
      or (p_client_id is not null and existing.client_id is distinct from p_client_id)
      or existing.voided_at is not null then raise exception 'La carga ya existe con otros datos. Revisá el ingreso original.'; end if;
    return existing.id;
  end if;
  if client is not null and not exists(select 1 from public.clients where id=client) then raise exception 'Cliente inexistente'; end if;
  if p_appointment_id is not null then
    select * into appt from public.appointments where id=p_appointment_id for update;
    if not found or appt.status not in ('confirmado','realizado') then raise exception 'El turno debe estar confirmado o realizado.'; end if;
    if client is not null and client<>appt.client_id then raise exception 'El turno pertenece a otro cliente.'; end if;
    client:=appt.client_id;
    select coalesce(sum(amount),0) into paid from public.payments where appointment_id=appt.id and kind='servicio' and voided_at is null;
    if paid+round(p_amount,2)>public.appointment_final_price(appt.id) then raise exception 'El cobro supera el saldo. Revisá el precio o el importe.'; end if;
    select id into srv from public.services where appointment_id=appt.id limit 1;
  end if;
  insert into public.payments(client_id,service_id,appointment_id,entry_request_id,amount,method,paid_at,concept,notes,verified_by,verified_by_email,verified_at)
    values(client,srv,p_appointment_id,p_request_id,round(p_amount,2),p_method,p_paid_at,trim(p_concept),nullif(trim(p_notes),''),auth.uid(),auth.jwt()->>'email',now()) returning id into result;
  if p_appointment_id is not null then perform public.sync_inquiry_payment_status(p_appointment_id); end if;
  return result;
end $$;

-- Una sola transacción: el precio y el movimiento cambian juntos o no cambia nada.
create or replace function public.admin_correct_payment(
  p_payment_id uuid, p_paid_at timestamptz, p_amount numeric, p_method text,
  p_concept text, p_notes text, p_appointment_id uuid, p_reason text,
  p_adjust_price boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.payments%rowtype; appt uuid; target numeric; paid numeric; result uuid; after_payment boolean;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  select * into r from public.payments where id=p_payment_id for update;
  if not found or r.voided_at is not null then raise exception 'El ingreso no existe o ya fue rectificado.'; end if;
  appt:=coalesce(p_appointment_id,r.appointment_id);
  if appt is not null then perform 1 from public.appointments where id=appt for update; end if;
  if p_adjust_price then
    if appt is null or r.kind<>'servicio' then raise exception 'Solo se ajusta el precio de un pago de servicio vinculado.'; end if;
    if r.appointment_id is distinct from appt then raise exception 'Corregí primero la vinculación del ingreso, sin ajustar el precio.'; end if;
    if p_amount is null or p_amount<=0 or p_amount>100000000 then raise exception 'Importe inválido' using errcode='22023'; end if;
    select coalesce(sum(amount),0) into paid from public.payments where appointment_id=appt and kind='servicio' and voided_at is null;
    target:=round(paid-r.amount+p_amount,2);
    after_payment:=target<paid;
    if not after_payment then perform public.admin_adjust_final_price(appt,target,p_reason); end if;
  end if;
  result:=public.admin_update_payment(p_payment_id,p_paid_at,p_amount,p_method,p_concept,p_notes,p_appointment_id,p_reason);
  if p_adjust_price and after_payment then perform public.admin_adjust_final_price(appt,target,p_reason); end if;
  update public.payments set client_id=coalesce((select client_id from public.appointments where id=appt),r.client_id) where id=result;
  return result;
end $$;

-- Carga directa: fecha del lavado, fecha del ingreso y fecha de carga son independientes.
-- request_id evita duplicar el lavado ante un doble clic/reintento de la misma carga.
create or replace function public.admin_register_demand_service(p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  req uuid:=nullif(p->>'request_id','')::uuid;
  previous public.admin_demand_entries%rowtype;
  client_id uuid:=nullif(p->>'client_id','')::uuid;
  vehicle_id uuid:=nullif(p->>'vehicle_id','')::uuid;
  phone text:=regexp_replace(coalesce(p->>'whatsapp',''),'\D','','g');
  name text:=trim(coalesce(p->>'full_name',''));
  category text:=p->>'vehicle_category';
  service text:=trim(coalesce(p->>'service',''));
  performed timestamptz:=nullif(p->>'performed_at','')::timestamptz;
  received timestamptz:=nullif(p->>'paid_at','')::timestamptz;
  price numeric(12,2):=round(nullif(p->>'final_price','')::numeric,2);
  paid numeric(12,2):=coalesce(round(nullif(p->>'amount_paid','')::numeric,2),0);
  duration integer:=coalesce(nullif(p->>'duration','')::integer,90);
  source text:=coalesce(nullif(p->>'source',''),'whatsapp');
  method text:=p->>'method';
  inquiry uuid; appt uuid; srv uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  if req is null then raise exception 'Falta el identificador de la carga.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(req::text,26));
  select * into previous from public.admin_demand_entries where request_id=req;
  if found then
    if previous.payload_hash<>md5(p::text) then raise exception 'Esta carga ya se guardó con otros datos. Abrí un formulario nuevo.'; end if;
    if previous.appointment_id is null then raise exception 'La carga original fue eliminada. Revisá el historial.'; end if;
    return previous.appointment_id;
  end if;
  if length(name) not between 2 and 120 or phone!~'^[1-9][0-9]{7,14}$' then raise exception 'Revisá el nombre y WhatsApp.' using errcode='22023'; end if;
  if length(service) not between 2 and 120 or length(trim(coalesce(p->>'address',''))) not between 5 and 200 then raise exception 'Revisá el servicio y domicilio.' using errcode='22023'; end if;
  if category is null or category not in ('auto','suv','pickup','otro') then raise exception 'Vehículo inválido' using errcode='22023'; end if;
  if source not in ('whatsapp','telefono','instagram','presencial','otro') or duration not between 15 and 540 then raise exception 'Origen o duración inválidos' using errcode='22023'; end if;
  if performed is null or (performed at time zone 'America/Argentina/Mendoza')::date>(now() at time zone 'America/Argentina/Mendoza')::date then raise exception 'Indicá una fecha de lavado de hoy o anterior.' using errcode='22023'; end if;
  if price is null or price<0 or price>100000000 or paid<0 or paid>price then raise exception 'Revisá el precio y el cobro.' using errcode='22023'; end if;
  if paid>0 and (received is null or (received at time zone 'America/Argentina/Mendoza')::date>(now() at time zone 'America/Argentina/Mendoza')::date or method is null or method not in ('efectivo','transferencia','mercadopago','otro')) then raise exception 'Indicá fecha real y medio del cobro.' using errcode='22023'; end if;
  if client_id is not null then
    perform 1 from public.clients c where c.id=client_id and c.whatsapp=phone for update;
    if not found then raise exception 'El cliente seleccionado no coincide con el WhatsApp.'; end if;
  else
    insert into public.clients(full_name,whatsapp,source) values(name,phone,source)
      on conflict(whatsapp) do update set last_interaction_at=now()
      returning id into client_id;
  end if;
  if vehicle_id is not null then
    select v.category into category from public.vehicles v where v.id=vehicle_id and v.client_id=client_id;
    if not found then raise exception 'El vehículo no pertenece al cliente.'; end if;
  else
    select v.id into vehicle_id from public.vehicles v where v.client_id=client_id and v.category=category
      and lower(coalesce(v.brand,''))=lower(trim(coalesce(p->>'brand','')))
      and lower(coalesce(v.model,''))=lower(trim(coalesce(p->>'model','')))
      and (nullif(trim(p->>'brand'),'') is not null or nullif(trim(p->>'model'),'') is not null) limit 1;
    if vehicle_id is null then
      insert into public.vehicles(client_id,category,category_label,brand,model)
      values(client_id,category,nullif(trim(p->>'category_label'),''),nullif(trim(p->>'brand'),''),nullif(trim(p->>'model'),'')) returning id into vehicle_id;
    end if;
  end if;
  insert into public.inquiries(client_id,vehicle_id,source,service,commercial_status)
    values(client_id,vehicle_id,source,service,case when paid>0 and paid=price then 'cobrado' else 'servicio_realizado' end) returning id into inquiry;
  insert into public.appointments(client_id,vehicle_id,inquiry_id,service,address,neighborhood,confirmed_start,confirmed_at,duration_minutes,water_supply,agreed_price,operator,status)
    values(client_id,vehicle_id,inquiry,service,trim(p->>'address'),nullif(trim(p->>'neighborhood'),''),performed,now(),duration,
      case when p->>'water_supply'='propia' then 'propia' else 'domicilio' end,price,nullif(trim(p->>'operator'),''),'realizado') returning id into appt;
  insert into public.appointment_vehicles(appointment_id,vehicle_id,position,category,price_applied,classification,needs_review)
    values(appt,vehicle_id,1,category,price,'manual',false);
  insert into public.services(appointment_id,client_id,vehicle_id,vehicle_category,wash_type,performed_at,agreed_price,final_price,operator,notes)
    values(appt,client_id,vehicle_id,case when category='otro' then null else category end,service,performed,price,price,nullif(trim(p->>'operator'),''),nullif(trim(p->>'notes'),'')) returning id into srv;
  if paid>0 then
    insert into public.payments(service_id,appointment_id,amount,method,paid_at,notes,verified_by,verified_by_email,verified_at)
      values(srv,appt,paid,method,received,'Carga histórica: cobro registrado por el administrador',auth.uid(),auth.jwt()->>'email',now());
  end if;
  if nullif(trim(p->>'internal_note'),'') is not null then
    insert into public.appointment_notes(appointment_id,body) values(appt,trim(p->>'internal_note'));
  end if;
  insert into public.admin_demand_entries(request_id,appointment_id,payload_hash) values(req,appt,md5(p::text));
  update public.clients set last_interaction_at=now() where id=client_id;
  return appt;
end $$;

-- Cambia detalles del trabajo desde la ficha sin alterar sus pagos ni fechas de cobro.
create or replace function public.admin_edit_demand_details(p_id uuid,p_service text,p_address text,p_operator text,p_duration integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.appointments%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  if length(trim(coalesce(p_service,''))) not between 2 and 120 or length(trim(coalesce(p_address,''))) not between 5 and 200
    or p_duration is null or p_duration not between 15 and 540 or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Revisá los detalles y el motivo.' using errcode='22023'; end if;
  select * into a from public.appointments where id=p_id for update;
  if not found then raise exception 'Turno inexistente'; end if;
  update public.appointments set service=trim(p_service),address=trim(p_address),operator=nullif(trim(p_operator),''),duration_minutes=p_duration where id=p_id;
  update public.services set wash_type=trim(p_service),operator=nullif(trim(p_operator),'') where appointment_id=p_id;
  update public.inquiries set service=trim(p_service) where id=a.inquiry_id;
  perform public.log_correction('appointment',p_id,p_id,'datos',
    jsonb_build_object('servicio',a.service,'direccion',a.address,'operador',a.operator,'duracion',a.duration_minutes),
    jsonb_build_object('servicio',trim(p_service),'direccion',trim(p_address),'operador',p_operator,'duracion',p_duration),p_reason);
end $$;

-- Un cierre es una fotografía versionada. Corregir fechas históricas no la borra.
create or replace function public.admin_save_cash_closing(p_day date,p_opening jsonb,p_counted jsonb,p_notes text,p_reason text)
returns numeric language plpgsql security definer set search_path='' as $$
declare prior public.cash_closings%rowtype; saved public.cash_closings%rowtype; expected jsonb; difference numeric:=0; m text; v numeric; opening jsonb:='{}';
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
  if p_day is null or p_day>(now() at time zone 'America/Argentina/Mendoza')::date then raise exception 'Fecha de cierre inválida' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_day::text,27));
  select * into prior from public.cash_closings where day=p_day for update;
  if found and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Indicá el motivo de la actualización del cierre.' using errcode='22023'; end if;
  foreach m in array array['efectivo','transferencia','mercadopago','otro'] loop
    v:=coalesce((p_opening->>m)::numeric,0);
    if v<0 or v>100000000 then raise exception 'Saldo inicial inválido' using errcode='22023'; end if;
    opening:=opening||jsonb_build_object(m,round(v,2));
    v:=(p_counted->>m)::numeric;
    if v is null or v<0 or v>100000000 then raise exception 'Completá el contado de cada medio, incluso si es cero.' using errcode='22023'; end if;
  end loop;
  select jsonb_object_agg(method,round((opening->>method)::numeric+net,2)) into expected from (
    select methods.method,coalesce(sum(mov.amount),0) as net
    from unnest(array['efectivo','transferencia','mercadopago','otro']) as methods(method)
    left join (
      select method,amount from public.payments where voided_at is null and paid_at>=p_day::timestamp at time zone 'America/Argentina/Mendoza' and paid_at<(p_day+1)::timestamp at time zone 'America/Argentina/Mendoza'
      union all select method,-amount from public.expenses where voided_at is null and spent_on=p_day
    ) mov on mov.method=methods.method group by methods.method
  ) totals;
  foreach m in array array['efectivo','transferencia','mercadopago','otro'] loop
    difference:=difference+round((p_counted->>m)::numeric,2)-(expected->>m)::numeric;
  end loop;
  insert into public.cash_closings(day,opening,expected,counted,difference,notes,closed_by_email)
    values(p_day,opening,expected,p_counted,difference,nullif(trim(p_notes),''),auth.jwt()->>'email')
    on conflict(day) do update set opening=excluded.opening,expected=excluded.expected,counted=excluded.counted,difference=excluded.difference,notes=excluded.notes,closed_by_email=excluded.closed_by_email
    returning * into saved;
  insert into public.cash_closing_revisions(day,before_snapshot,after_snapshot,reason)
    values(p_day,case when prior.id is null then null else to_jsonb(prior) end,to_jsonb(saved),nullif(trim(p_reason),''));
  return difference;
end $$;

revoke all on function public.admin_set_service_progress(uuid,text), public.admin_correct_payment(uuid,timestamptz,numeric,text,text,text,uuid,text,boolean),
 public.admin_register_demand_service(jsonb), public.admin_edit_demand_details(uuid,text,text,text,integer,text), public.admin_save_cash_closing(date,jsonb,jsonb,text,text), public.admin_record_income(uuid,numeric,text,timestamptz,text,text,uuid,uuid)
 from public,anon;
grant execute on function public.admin_set_service_progress(uuid,text), public.admin_correct_payment(uuid,timestamptz,numeric,text,text,text,uuid,text,boolean),
 public.admin_register_demand_service(jsonb), public.admin_edit_demand_details(uuid,text,text,text,integer,text), public.admin_save_cash_closing(date,jsonb,jsonb,text,text), public.admin_record_income(uuid,numeric,text,timestamptz,text,text,uuid,uuid)
 to authenticated;
notify pgrst,'reload schema';
commit;
