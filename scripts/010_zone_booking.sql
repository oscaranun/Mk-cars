-- Issue #33. Revisar y probar en una base aislada antes de autorizar producción.
-- Aditiva: no borra ni reescribe reservas históricas. Feature flag inicialmente false.
begin;

create table public.operating_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  neighborhoods text[] not null default '{}',
  polygon jsonb,
  priority integer not null default 0,
  active boolean not null default false
);
create table public.zone_booking_settings (
  id smallint primary key check (id = 1),
  enabled boolean not null default false,
  minutes_per_vehicle integer not null default 90 check (minutes_per_vehicle between 15 and 540),
  horizon_days integer not null default 42 check (horizon_days between 7 and 90),
  day_start time not null default '09:00',
  day_end time not null default '18:00',
  travel_minutes integer not null default 30 check (travel_minutes between 0 and 240),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 120),
  pause_start time,
  pause_end time,
  check (day_start < day_end),
  check ((pause_start is null and pause_end is null) or
    (pause_start is not null and pause_end is not null and day_start <= pause_start and pause_start < pause_end and pause_end <= day_end))
);
insert into public.zone_booking_settings(id) values (1);
update public.zone_booking_settings set travel_minutes=coalesce((select travel_minutes from public.settings where id=1),30);
create table public.mobile_units (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  active boolean not null default true,
  is_primary boolean not null default false
);
create unique index mobile_units_one_primary on public.mobile_units(is_primary) where is_primary;
insert into public.mobile_units(name,is_primary) values ('Peugeot Partner',true);
create table public.zone_service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  minutes_per_vehicle integer not null check (minutes_per_vehicle between 15 and 540),
  active boolean not null default true,
  is_default boolean not null default false
);
create unique index zone_services_one_default on public.zone_service_types(is_default) where is_default;
insert into public.zone_service_types(name,minutes_per_vehicle,is_default) values ('Lavado premium a domicilio',90,true);
alter table public.appointments add column mobile_unit_id uuid references public.mobile_units(id);
create index appointments_mobile_unit_start on public.appointments(mobile_unit_id,confirmed_start) where status='confirmado';
create table public.zone_weekly_schedule (
  weekday smallint primary key check (weekday between 0 and 6),
  zone_ids uuid[] not null default '{}',
  flexible boolean not null default false,
  enabled boolean not null default true,
  capacity integer not null default 4 check (capacity between 1 and 30)
);
create table public.zone_day_overrides (
  day date primary key,
  zone_ids uuid[] not null default '{}',
  flexible boolean not null default false,
  enabled boolean not null default true,
  capacity integer not null default 4 check (capacity between 1 and 30),
  reason text not null default '' check (length(reason) <= 200)
);
create table public.zone_booking_requests (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.operating_zones(id),
  requested_day date,
  payload jsonb not null,
  vehicle_count integer not null check (vehicle_count between 1 and 10),
  status text not null check (status in ('recibida', 'espera', 'revision', 'propuesta', 'confirmada', 'cancelada')),
  proposed_start timestamptz,
  duration_minutes integer check (duration_minutes between 15 and 540),
  agreed_price numeric(12,2) check (agreed_price >= 0),
  service_type_id uuid references public.zone_service_types(id),
  planned_minutes integer not null default 90 check (planned_minutes between 15 and 5400),
  mobile_unit_id uuid references public.mobile_units(id),
  appointment_id uuid unique references public.appointments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'propuesta' or (proposed_start is not null and duration_minutes is not null)),
  check (status <> 'confirmada' or appointment_id is not null)
);
create index zone_requests_day on public.zone_booking_requests(requested_day, status);
create index zone_requests_phone on public.zone_booking_requests((payload->>'whatsapp'), created_at);
create table public.zone_booking_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.zone_booking_requests(id),
  actor uuid default auth.uid(),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Examples only: geometry must be configured by an operator before a zone can be active.
with examples(day, name, neighborhoods) as (values
 (1, 'Chacras y Palmares', array['Chacras de Coria','Palmares Valley','Palmares','Abariguay']),
 (2, 'Godoy Cruz', array['Godoy Cruz','Bombal Sur','Benegas']),
 (3, 'Luján', array['Luján','Carrodilla','Mayor Drummond']),
 (4, 'Capital', array['Capital','Quinta Sección','Sexta Sección']),
 (5, 'Las Heras', array['Las Heras','El Challao'])
), inserted as (
 insert into public.operating_zones(name, neighborhoods) select name, neighborhoods from examples returning id, name
)
insert into public.zone_weekly_schedule(weekday, zone_ids)
select e.day, array[i.id] from examples e join inserted i using(name);
insert into public.zone_weekly_schedule(weekday, flexible, enabled) values (6, true, true), (0, true, false);

-- Exact geographic coverage is checked by the server using the existing polygon.
-- Operating polygons only refine it; they never enlarge public coverage.
create function public.zone_ring_contains(p_ring jsonb, p_lat double precision, p_lng double precision)
returns boolean language plpgsql immutable set search_path = '' as $$
declare i int; j int; x double precision; y double precision; px double precision; py double precision; inside boolean := false;
begin
 if p_ring is null or jsonb_typeof(p_ring) <> 'array' or jsonb_array_length(p_ring) < 4 then return false; end if;
 j := jsonb_array_length(p_ring)-1;
 for i in 0..jsonb_array_length(p_ring)-1 loop
  x := (p_ring->i->>0)::double precision; y := (p_ring->i->>1)::double precision;
  px := (p_ring->j->>0)::double precision; py := (p_ring->j->>1)::double precision;
  if abs((p_lng-x)*(py-y)-(p_lat-y)*(px-x)) < 1e-10
   and p_lng between least(x,px) and greatest(x,px) and p_lat between least(y,py) and greatest(y,py) then return true; end if;
  if (y > p_lat) <> (py > p_lat) then
   if p_lng < (px-x)*(p_lat-y)/(py-y)+x then inside := not inside; end if;
  end if;
  j := i;
 end loop;
 return inside;
end $$;

create function public.zone_resolve(p_lat double precision, p_lng double precision)
returns uuid language sql stable security definer set search_path = '' as $$
 select id from public.operating_zones where active and public.zone_ring_contains(polygon, p_lat, p_lng)
 order by priority desc, id limit 1
$$;

create function public.zone_day_plan(p_day date)
returns table(zone_ids uuid[], flexible boolean, enabled boolean, capacity integer)
language sql stable security definer set search_path = '' as $$
 select coalesce(o.zone_ids,w.zone_ids), coalesce(o.flexible,w.flexible),
  coalesce(o.enabled,w.enabled) and not exists(select 1 from public.blocked_dates where day = p_day),
  coalesce(o.capacity,w.capacity)
 from public.zone_weekly_schedule w left join public.zone_day_overrides o on o.day = p_day
 where w.weekday = extract(dow from p_day)
$$;

-- Capacity is shared by the single Partner, across every zone. Cupos are vehicles, not forms.
create function public.zone_day_used(p_day date, p_exclude uuid default null, p_exclude_appointment uuid default null)
returns integer language sql stable security definer set search_path = '' as $$
 select (coalesce((select sum(r.vehicle_count) from public.zone_booking_requests r
  where r.id is distinct from p_exclude and r.status in ('recibida','propuesta')
   and coalesce((r.proposed_start at time zone 'America/Argentina/Mendoza')::date, r.requested_day) = p_day),0)
 + coalesce((select sum(greatest(1,(select count(*) from public.appointment_vehicles av where av.appointment_id=a.id)))
  from public.appointments a where a.id is distinct from p_exclude_appointment and a.status in ('solicitado','reprogramado','esperando_cliente','confirmado','realizado')
   and (coalesce(a.confirmed_start,(select p.proposed_start from public.appointment_proposals p where p.appointment_id=a.id and p.status='pendiente' limit 1),a.requested_start) at time zone 'America/Argentina/Mendoza')::date=p_day),0))::integer
$$;

create function public.zone_primary_unit() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.mobile_units where is_primary limit 1
$$;

create function public.zone_assert_window(p_start timestamptz,p_duration integer,p_unit uuid,p_exclude uuid default null)
returns void language plpgsql stable security definer set search_path='' as $$
declare s public.zone_booking_settings%rowtype; d date; local_start timestamp; local_end timestamp; gap integer;
begin
 select * into s from public.zone_booking_settings where id=1;
 local_start:=p_start at time zone 'America/Argentina/Mendoza';
 local_end:=local_start+make_interval(mins=>p_duration);d:=local_start::date;
 if p_start is null or p_duration is null or p_duration not between 15 and 540
  or local_start::time<s.day_start or local_end>d+s.day_end then
  raise exception 'El servicio debe entrar en la jornada configurada (% a %)',s.day_start,s.day_end using errcode='P0001';end if;
 if not exists(select 1 from public.mobile_units where id=p_unit and active) then raise exception 'La unidad móvil no está activa' using errcode='P0001';end if;
 if s.pause_start is not null and tsrange(local_start,local_end) && tsrange(d+s.pause_start,d+s.pause_end) then
  raise exception 'El servicio se superpone con la pausa configurada' using errcode='P0001';end if;
 gap:=s.travel_minutes+s.buffer_minutes;
 if exists(select 1 from public.appointments a where a.id is distinct from p_exclude and a.status='confirmado'
  and coalesce(a.mobile_unit_id,public.zone_primary_unit())=p_unit
  and tstzrange(a.confirmed_start,a.confirmed_start+make_interval(mins=>a.duration_minutes))
   && tstzrange(p_start-make_interval(mins=>gap),p_start+make_interval(mins=>p_duration+gap))) then
  raise exception 'La unidad móvil ya tiene un turno en ese horario, incluido traslado y margen' using errcode='P0001';end if;
end $$;

-- Pending requests reserve minutes, not a fictitious hour. Conservative travel allowance
-- is counted per request; actual gaps are checked again when proposing/confirming.
create function public.zone_day_free_minutes(p_day date,p_exclude uuid default null,p_exclude_appointment uuid default null)
returns integer language sql stable security definer set search_path='' as $$
 select greatest(0,
  ((extract(epoch from (s.day_end-s.day_start))-coalesce(extract(epoch from(s.pause_end-s.pause_start)),0))/60)::integer
   *(select count(*)::integer from public.mobile_units where active)
  -coalesce((select sum(coalesce(r.duration_minutes,r.planned_minutes)+s.travel_minutes+s.buffer_minutes)
   from public.zone_booking_requests r where r.id is distinct from p_exclude and r.status in ('recibida','propuesta')
    and coalesce((r.proposed_start at time zone 'America/Argentina/Mendoza')::date,r.requested_day)=p_day),0)::integer
  -coalesce((select sum(a.duration_minutes+s.travel_minutes+s.buffer_minutes) from public.appointments a
   where a.id is distinct from p_exclude_appointment and a.status in ('solicitado','reprogramado','esperando_cliente','confirmado','realizado')
    and (coalesce(a.confirmed_start,(select p.proposed_start from public.appointment_proposals p where p.appointment_id=a.id and p.status='pendiente' limit 1),a.requested_start) at time zone 'America/Argentina/Mendoza')::date=p_day),0)::integer)
 from public.zone_booking_settings s where id=1
$$;

create function public.zone_day_can_fit(p_day date,p_duration integer)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.zone_booking_settings s cross join public.mobile_units u
  cross join lateral generate_series(
   (p_day+s.day_start) at time zone 'America/Argentina/Mendoza',
   ((p_day+s.day_end) at time zone 'America/Argentina/Mendoza')-make_interval(mins=>p_duration),interval '1 minute') candidate
  where s.id=1 and u.active and p_duration between 15 and 540
   and (s.pause_start is null or not(tstzrange(candidate,candidate+make_interval(mins=>p_duration)) &&
    tstzrange((p_day+s.pause_start) at time zone 'America/Argentina/Mendoza',(p_day+s.pause_end) at time zone 'America/Argentina/Mendoza')))
   and not exists(select 1 from public.appointments a where a.status='confirmado'
    and coalesce(a.mobile_unit_id,public.zone_primary_unit())=u.id
    and tstzrange(a.confirmed_start,a.confirmed_start+make_interval(mins=>a.duration_minutes)) &&
     tstzrange(candidate-make_interval(mins=>s.travel_minutes+s.buffer_minutes),candidate+make_interval(mins=>p_duration+s.travel_minutes+s.buffer_minutes))))
$$;

-- Only the Next server may call availability/submit (geographic coverage checked there).
create function public.zone_availability(p_lat double precision, p_lng double precision, p_vehicles integer default 1,p_service uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare z uuid; result jsonb; minutes integer; gap integer; today date := (now() at time zone 'America/Argentina/Mendoza')::date;
begin
 if not (select enabled from public.zone_booking_settings where id=1) then return jsonb_build_object('enabled',false,'zone',null,'manual',false,'dates','[]'::jsonb); end if;
 if p_vehicles not between 1 and 10 then raise exception 'Cantidad de vehículos inválida' using errcode='22023'; end if;
 select minutes_per_vehicle into minutes from public.zone_service_types where active and (id=p_service or (p_service is null and is_default));
 if minutes is null then raise exception 'Servicio no disponible' using errcode='22023';end if;
 select travel_minutes+buffer_minutes into gap from public.zone_booking_settings where id=1;
 z := public.zone_resolve(p_lat,p_lng);
 if z is null then return jsonb_build_object('enabled',true,'zone',null,'manual',true,'dates','[]'::jsonb); end if;
 select coalesce(jsonb_agg(jsonb_build_object('day',d.day,'remaining',least(greatest(0,p.capacity-public.zone_day_used(d.day)),greatest(0,public.zone_day_free_minutes(d.day)-gap)/minutes),
  'full',p.capacity-public.zone_day_used(d.day)<p_vehicles or public.zone_day_free_minutes(d.day)<minutes*p_vehicles+gap or not public.zone_day_can_fit(d.day,minutes*p_vehicles)) order by d.day),'[]'::jsonb) into result
 from (select today + i as day from generate_series(1,(select horizon_days from public.zone_booking_settings where id=1)) i) d
 cross join lateral public.zone_day_plan(d.day) p
 where p.enabled and (p.flexible or z=any(p.zone_ids));
 return jsonb_build_object('enabled',true,'zone',(select jsonb_build_object('id',id,'name',name) from public.operating_zones where id=z),'manual',false,'dates',result);
end $$;

create function public.submit_zone_booking(p_payload jsonb, p_day date, p_lat double precision, p_lng double precision, p_waitlist boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare z uuid; n integer; plan record; result uuid; target_status text; service public.zone_service_types%rowtype; gap integer;
begin
 perform 1 from public.zone_booking_settings where id=1 for share;
 if not (select enabled from public.zone_booking_settings where id=1) then raise exception 'La reserva por zonas no está habilitada'; end if;
 if jsonb_typeof(p_payload->'vehicles') is distinct from 'array' then raise exception 'Vehículos inválidos'; end if;
 n := jsonb_array_length(p_payload->'vehicles');
 select * into service from public.zone_service_types where active and
  (id=nullif(p_payload->>'service_type_id','')::uuid or (nullif(p_payload->>'service_type_id','') is null and is_default));
 if not found then raise exception 'Servicio no disponible' using errcode='22023';end if;
 p_payload:=p_payload||jsonb_build_object('service',service.name,'service_type_id',service.id);
 select travel_minutes+buffer_minutes into gap from public.zone_booking_settings where id=1;
 if n not between 1 and 10 or coalesce(p_payload->>'whatsapp','') !~ '^549[0-9]{10}$'
  or length(coalesce(p_payload->>'full_name','')) not between 3 and 120
  or length(coalesce(p_payload->>'address','')) not between 5 and 200 then raise exception 'Datos inválidos' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_payload->>'whatsapp', 33));
 if (select count(*) from public.zone_booking_requests where payload->>'whatsapp'=p_payload->>'whatsapp' and created_at>now()-interval '1 hour')>=3 then
  raise exception 'Ya recibimos varias solicitudes tuyas. Te contactaremos a la brevedad.' using errcode='P0002'; end if;
 z := public.zone_resolve(p_lat,p_lng);
 if z is null then target_status := 'revision'; p_day := null;
 else
  if p_day is null or p_day <= (now() at time zone 'America/Argentina/Mendoza')::date
   or p_day > (now() at time zone 'America/Argentina/Mendoza')::date+(select horizon_days from public.zone_booking_settings where id=1) then raise exception 'Elegí una fecha disponible' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mk-zone-day:'||p_day,0));
  select * into plan from public.zone_day_plan(p_day);
  if plan.enabled is distinct from true or not (plan.flexible or z=any(plan.zone_ids)) then raise exception 'Ese día no visitamos tu zona' using errcode='P0001'; end if;
  if public.zone_day_used(p_day)+n>plan.capacity or public.zone_day_free_minutes(p_day)<service.minutes_per_vehicle*n+gap
   or not public.zone_day_can_fit(p_day,service.minutes_per_vehicle*n) then
   if not p_waitlist then raise exception 'La fecha se completó. Elegí otra fecha o sumate a la lista de espera.' using errcode='P0001'; end if;
   target_status := 'espera';
  else target_status := 'recibida'; end if;
 end if;
 insert into public.zone_booking_requests(zone_id,requested_day,payload,vehicle_count,status,service_type_id,planned_minutes)
 values(z,p_day,p_payload-'requested_start',n,target_status,service.id,service.minutes_per_vehicle*n) returning id into result;
 insert into public.zone_booking_events(request_id,action) values(result,'recibida');
 return result;
end $$;

-- All confirmations (legacy and zones) serialize on the date before the legacy capacity trigger.
create function public.zone_guard_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
declare day date; plan record; vehicles integer;
begin
 if new.status <> 'confirmado' then return new; end if;
 perform 1 from public.zone_booking_settings where id=1 for share;
 if not coalesce((select enabled from public.zone_booking_settings where id=1),false) then return new; end if;
 day := (new.confirmed_start at time zone 'America/Argentina/Mendoza')::date;
 perform pg_advisory_xact_lock(hashtextextended('mk-zone-day:'||day,0));
 select * into plan from public.zone_day_plan(day);
 if plan.enabled is distinct from true then raise exception 'La jornada está bloqueada' using errcode='P0001'; end if;
 if tg_op='INSERT' or old.status<>'confirmado' or old.confirmed_start is distinct from new.confirmed_start then
  select greatest(1,count(*))::integer into vehicles from public.appointment_vehicles where appointment_id=new.id;
  if public.zone_day_used(day,null,new.id)+vehicles>plan.capacity then raise exception 'Se alcanzó el cupo diario' using errcode='P0001'; end if;
 end if;
 new.mobile_unit_id:=coalesce(new.mobile_unit_id,public.zone_primary_unit());
 perform 1 from public.mobile_units where id=new.mobile_unit_id for share;
 perform public.zone_assert_window(new.confirmed_start,new.duration_minutes,new.mobile_unit_id,new.id);
 if public.zone_day_free_minutes(day,null,new.id)<new.duration_minutes+(select travel_minutes+buffer_minutes from public.zone_booking_settings where id=1) then
  raise exception 'No quedan minutos disponibles en la jornada' using errcode='P0001';end if;
 if exists(select 1 from public.appointment_slot_conflicts(new.confirmed_start,new.duration_minutes,new.id,new.operator) where same_operator) then
  raise exception 'El operario ya tiene un turno en ese horario' using errcode='P0001';end if;
 return new;
end $$;
create trigger aaa_zone_confirmation_guard before insert or update of status,confirmed_start,duration_minutes,mobile_unit_id,operator on public.appointments
for each row execute function public.zone_guard_confirmation();

create function public.manage_zone_request(p_id uuid,p_action text,p_start timestamptz default null,p_duration integer default null,p_price numeric default null,p_reason text default null,p_unit uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.zone_booking_requests%rowtype; plan record; day date; appointment uuid; inquiry uuid; gap integer;
begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
 perform 1 from public.zone_booking_settings where id=1 for share;
 select * into r from public.zone_booking_requests where id=p_id for update;
 if not found then raise exception 'Solicitud inexistente' using errcode='P0001'; end if;
 if r.status in ('confirmada','cancelada') then raise exception 'Gestioná el turno confirmado desde su ficha o la solicitud ya está cerrada' using errcode='P0001'; end if;
 if p_action='cancel' then
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Indicá un motivo de cancelación' using errcode='22023'; end if;
  update public.zone_booking_requests set status='cancelada',updated_at=now() where id=p_id;
 elsif p_action='client_rejected' then
  if r.status<>'propuesta' then raise exception 'No hay una propuesta pendiente' using errcode='P0001'; end if;
  update public.zone_booking_requests set status=case when zone_id is null then 'revision' else 'espera' end,proposed_start=null,updated_at=now() where id=p_id;
 elsif p_action in ('propose','client_accepted') then
  if p_action='client_accepted' then
   if r.status<>'propuesta' then raise exception 'No hay una propuesta pendiente' using errcode='P0001'; end if;
   p_start:=r.proposed_start; p_duration:=r.duration_minutes; p_price:=r.agreed_price;p_unit:=r.mobile_unit_id;
  end if;
  if p_start is null or p_start<=now() or p_duration is null or p_duration not between 15 and 540 or p_price<0 then raise exception 'Fecha, duración o precio inválidos' using errcode='22023'; end if;
  day:=(p_start at time zone 'America/Argentina/Mendoza')::date;
  perform pg_advisory_xact_lock(hashtextextended('mk-zone-day:'||day,0));
  select * into plan from public.zone_day_plan(day);
  if plan.enabled is distinct from true then raise exception 'La jornada está bloqueada' using errcode='P0001'; end if;
  if r.zone_id is not null and not(plan.flexible or r.zone_id=any(plan.zone_ids)) then raise exception 'Ese día corresponde a otra zona; configurá una excepción primero' using errcode='P0001'; end if;
  if public.zone_day_used(day,r.id)+r.vehicle_count>plan.capacity then raise exception 'Se alcanzó el cupo diario' using errcode='P0001'; end if;
  p_unit:=coalesce(p_unit,r.mobile_unit_id,public.zone_primary_unit());
  perform 1 from public.mobile_units where id=p_unit for share;
  perform public.zone_assert_window(p_start,p_duration,p_unit);
  select travel_minutes+buffer_minutes into gap from public.zone_booking_settings where id=1;
  if public.zone_day_free_minutes(day,r.id)<p_duration+gap then raise exception 'No quedan minutos disponibles en la jornada' using errcode='P0001';end if;
  if p_action='propose' then
   update public.zone_booking_requests set status='propuesta',proposed_start=p_start,duration_minutes=p_duration,agreed_price=p_price,mobile_unit_id=p_unit,updated_at=now() where id=p_id;
  else
   -- Creates the existing CRM entities only after explicit manual acceptance.
   -- requested_start is the real accepted time, never an invented client-selected time.
   inquiry:=public.submit_booking(r.payload||jsonb_build_object('requested_start',p_start));
   select id into appointment from public.appointments where inquiry_id=inquiry;
   if appointment is null then raise exception 'No se pudo vincular el turno creado' using errcode='P0001'; end if;
   update public.zone_booking_requests set status='confirmada',appointment_id=appointment,updated_at=now() where id=p_id;
   update public.appointments set status='confirmado',confirmed_start=p_start,confirmed_at=now(),duration_minutes=p_duration,agreed_price=p_price,mobile_unit_id=p_unit where id=appointment;
   update public.inquiries set commercial_status='convertida' where id=inquiry;
  end if;
 else raise exception 'Acción inválida' using errcode='22023'; end if;
 insert into public.zone_booking_events(request_id,action,details) values(p_id,p_action,jsonb_build_object('start',p_start,'duration',p_duration,'price',p_price,'unit',p_unit,'reason',left(p_reason,200)));
end $$;

-- Admin-only tables, no public access to request payloads or event history.
do $$ declare t text; begin
 foreach t in array array['operating_zones','zone_booking_settings','zone_weekly_schedule','zone_day_overrides','zone_booking_requests','zone_booking_events','mobile_units','zone_service_types'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
  execute format('grant select on table public.%I to authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())',t||'_admin_read',t);
 end loop;
end $$;

create function public.configure_zone_booking(p_kind text,p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; v_day date; zone_ids uuid[]; item jsonb; w integer; scheduled_appt record;
begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
 if p_kind='zone' then
  target:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
  if coalesce((p_data->>'active')::boolean,false) and p_data->'polygon'='null'::jsonb then raise exception 'Configurá el polígono antes de activar la zona'; end if;
  insert into public.operating_zones(id,name,neighborhoods,polygon,priority,active)
  values(target,p_data->>'name',array(select jsonb_array_elements_text(p_data->'neighborhoods')),nullif(p_data->'polygon','null'::jsonb),(p_data->>'priority')::int,(p_data->>'active')::boolean)
  on conflict(id) do update set name=excluded.name,neighborhoods=excluded.neighborhoods,polygon=excluded.polygon,priority=excluded.priority,active=excluded.active;
 elsif p_kind in ('weekly','override','copy') then
  zone_ids:=array(select jsonb_array_elements_text(p_data->'zone_ids')::uuid);
  if exists(select 1 from unnest(zone_ids) z where not exists(select 1 from public.operating_zones where id=z)) then raise exception 'Zona inválida'; end if;
  if p_kind='weekly' then
   insert into public.zone_weekly_schedule(weekday,zone_ids,flexible,enabled,capacity) values((p_data->>'weekday')::int,zone_ids,(p_data->>'flexible')::boolean,(p_data->>'enabled')::boolean,(p_data->>'capacity')::int)
   on conflict(weekday) do update set zone_ids=excluded.zone_ids,flexible=excluded.flexible,enabled=excluded.enabled,capacity=excluded.capacity;
  elsif p_kind='override' then
   v_day:=(p_data->>'day')::date;
   perform pg_advisory_xact_lock(hashtextextended('mk-zone-day:'||v_day,0));
   if public.zone_day_used(v_day)>(p_data->>'capacity')::int and (p_data->>'enabled')::boolean then raise exception 'El nuevo cupo es menor que la demanda existente; revisá la agenda'; end if;
   insert into public.zone_day_overrides(day,zone_ids,flexible,enabled,capacity,reason) values(v_day,zone_ids,(p_data->>'flexible')::boolean,(p_data->>'enabled')::boolean,(p_data->>'capacity')::int,coalesce(p_data->>'reason',''))
   on conflict(day) do update set zone_ids=excluded.zone_ids,flexible=excluded.flexible,enabled=excluded.enabled,capacity=excluded.capacity,reason=excluded.reason;
  else
   for w in 0..6 loop
    v_day:=(p_data->>'target')::date+w;
    perform pg_advisory_xact_lock(hashtextextended('mk-zone-day:'||v_day,0));
    if exists(select 1 from public.zone_day_overrides where day=v_day) then raise exception 'La semana destino tiene excepciones; no se sobrescribió nada'; end if;
    if public.zone_day_used(v_day)>0 then raise exception 'La semana destino tiene solicitudes o reservas; no se sobrescribió nada'; end if;
    if p_data->>'source' is null then
     insert into public.zone_day_overrides(day,zone_ids,flexible,enabled,capacity,reason)
      select v_day,s.zone_ids,s.flexible,s.enabled,s.capacity,'Copia de plantilla semanal' from public.zone_weekly_schedule s where weekday=extract(dow from v_day);
    else
     insert into public.zone_day_overrides(day,zone_ids,flexible,enabled,capacity,reason)
      select v_day,p.zone_ids,p.flexible,p.enabled,p.capacity,'Copia de semana' from public.zone_day_plan((p_data->>'source')::date+w) p;
    end if;
   end loop;
  end if;
 elsif p_kind='unit' then
  target:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  perform 1 from public.mobile_units where id=target for update;
  if (p_data->>'active')::boolean is false and exists(select 1 from public.mobile_units where id=target and is_primary) then raise exception 'La Partner principal debe permanecer activa' using errcode='P0001';end if;
  if (p_data->>'active')::boolean is false and (
   exists(select 1 from public.appointments a where mobile_unit_id=target and status in ('confirmado','solicitado','reprogramado','esperando_cliente')
    and coalesce(a.confirmed_start,(select p.proposed_start from public.appointment_proposals p where p.appointment_id=a.id and p.status='pendiente' limit 1),a.requested_start)+make_interval(mins=>a.duration_minutes)>now())
   or exists(select 1 from public.zone_booking_requests where mobile_unit_id=target and status='propuesta')) then
   raise exception 'La unidad tiene turnos o propuestas pendientes; reasignalos antes de desactivarla' using errcode='P0001';end if;
  insert into public.mobile_units(id,name,active) values(target,p_data->>'name',(p_data->>'active')::boolean)
   on conflict(id) do update set name=excluded.name,active=excluded.active;
 elsif p_kind='service' then
  target:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  if (p_data->>'active')::boolean is false and exists(select 1 from public.zone_service_types where id=target and is_default) then raise exception 'El servicio base debe permanecer activo' using errcode='P0001';end if;
  insert into public.zone_service_types(id,name,minutes_per_vehicle,active)
   values(target,p_data->>'name',(p_data->>'minutes_per_vehicle')::integer,(p_data->>'active')::boolean)
   on conflict(id) do update set name=excluded.name,minutes_per_vehicle=excluded.minutes_per_vehicle,active=excluded.active;
 elsif p_kind='settings' then
  update public.zone_booking_settings set enabled=(p_data->>'enabled')::boolean,
   minutes_per_vehicle=coalesce((p_data->>'minutes_per_vehicle')::int,minutes_per_vehicle),
   horizon_days=(p_data->>'horizon_days')::int,
   day_start=coalesce((p_data->>'day_start')::time,day_start),day_end=coalesce((p_data->>'day_end')::time,day_end),
   travel_minutes=coalesce((p_data->>'travel_minutes')::int,travel_minutes),buffer_minutes=coalesce((p_data->>'buffer_minutes')::int,buffer_minutes),
   pause_start=case when p_data ? 'pause_start' then nullif(p_data->>'pause_start','')::time else pause_start end,
   pause_end=case when p_data ? 'pause_end' then nullif(p_data->>'pause_end','')::time else pause_end end where id=1;
  if (p_data->>'enabled')::boolean then
   for scheduled_appt in select * from public.appointments where status='confirmado' and confirmed_start>now() loop
    perform public.zone_assert_window(scheduled_appt.confirmed_start,scheduled_appt.duration_minutes,coalesce(scheduled_appt.mobile_unit_id,public.zone_primary_unit()),scheduled_appt.id);
   end loop;
  end if;
 else raise exception 'Configuración inválida'; end if;
 insert into public.zone_booking_events(action,details) values('config:'||p_kind,p_data);
end $$;

-- Preserve the legacy business-hours contract when disabled; permit an explicitly
-- enabled Sunday when zones are active (also when later rescheduling that appointment).
create or replace function public.assert_business_hours(p_start timestamptz,p_duration integer)
returns void language plpgsql stable set search_path='' as $$
declare local_start timestamp:=p_start at time zone 'America/Argentina/Mendoza'; local_end timestamp:=(p_start+make_interval(mins=>p_duration)) at time zone 'America/Argentina/Mendoza';s public.zone_booking_settings%rowtype;open_at time:='09:00';close_at time:='18:00';
begin
 select * into s from public.zone_booking_settings where id=1;
 if s.enabled then
  open_at:=s.day_start;close_at:=s.day_end;
  if not coalesce((select enabled from public.zone_day_plan(local_start::date)),false) then raise exception 'La jornada está bloqueada' using errcode='P0001';end if;
  if s.pause_start is not null and tsrange(local_start,local_end) && tsrange(local_start::date+s.pause_start,local_start::date+s.pause_end) then raise exception 'El servicio se superpone con la pausa configurada' using errcode='P0001';end if;
 end if;
 if extract(isodow from local_start)=7 and not s.enabled then
  raise exception 'Los domingos no se atiende salvo programación explícita.' using errcode='P0001'; end if;
 if p_start is null or p_duration is null or p_duration not between 15 and 540 or local_start::time<open_at or local_end::time>close_at or local_end::date<>local_start::date then
  raise exception 'El turno debe estar dentro de la jornada configurada (% a %).',open_at,close_at using errcode='P0001'; end if;
end $$;

create function public.zone_assign_unit(p_id uuid,p_unit uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.appointments%rowtype;
begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501';end if;
 if not coalesce((select enabled from public.zone_booking_settings where id=1),false) then raise exception 'La modalidad por zonas debe estar activa para reasignar unidades' using errcode='P0001';end if;
 select * into a from public.appointments where id=p_id for update;
 if not found or a.status not in ('solicitado','reprogramado','esperando_cliente','confirmado') then raise exception 'El turno no admite reasignación de unidad' using errcode='P0001';end if;
 if not exists(select 1 from public.mobile_units where id=p_unit and active) then raise exception 'Unidad inactiva' using errcode='P0001';end if;
 update public.appointments set mobile_unit_id=p_unit where id=p_id;
 insert into public.zone_booking_events(request_id,action,details)
  values((select id from public.zone_booking_requests where appointment_id=p_id),'unit_assigned',jsonb_build_object('appointment_id',p_id,'old_unit',a.mobile_unit_id,'unit',p_unit));
end $$;

create or replace function public.appointment_slot_conflicts(
 p_start timestamptz,p_duration integer,p_exclude uuid default null,p_operator text default null
) returns table(id uuid,confirmed_start timestamptz,duration_minutes integer,operator text,same_operator boolean)
language sql stable set search_path='' as $$
 select a.id,a.confirmed_start,a.duration_minutes,a.operator,
  (nullif(trim(p_operator),'') is not null and lower(trim(a.operator))=lower(trim(p_operator)))
 from public.appointments a
 cross join public.settings s cross join public.zone_booking_settings z
 where s.id=1 and z.id=1 and a.status='confirmado' and a.id is distinct from p_exclude
  and (not z.enabled or coalesce(a.mobile_unit_id,public.zone_primary_unit())=
    coalesce((select mobile_unit_id from public.appointments where id=p_exclude),public.zone_primary_unit())
   or (nullif(trim(p_operator),'') is not null and lower(trim(a.operator))=lower(trim(p_operator))))
  and tstzrange(a.confirmed_start,a.confirmed_start+make_interval(mins=>a.duration_minutes)) &&
   tstzrange(p_start-make_interval(mins=>case when z.enabled then z.travel_minutes+z.buffer_minutes else s.travel_minutes end),
    p_start+make_interval(mins=>p_duration+case when z.enabled then z.travel_minutes+z.buffer_minutes else s.travel_minutes end))
$$;

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
  if coalesce((select enabled from public.zone_booking_settings where id=1),false) then return new;end if;
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
revoke all on function public.zone_ring_contains(jsonb,double precision,double precision), public.zone_resolve(double precision,double precision), public.zone_day_plan(date), public.zone_day_used(date,uuid,uuid), public.zone_availability(double precision,double precision,integer,uuid), public.submit_zone_booking(jsonb,date,double precision,double precision,boolean), public.zone_guard_confirmation(), public.manage_zone_request(uuid,text,timestamptz,integer,numeric,text,uuid), public.configure_zone_booking(text,jsonb), public.zone_primary_unit(), public.zone_assert_window(timestamptz,integer,uuid,uuid), public.zone_day_free_minutes(date,uuid,uuid), public.zone_day_can_fit(date,integer) from public,anon,authenticated;
revoke all on function public.zone_assign_unit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.zone_assign_unit(uuid,uuid) to authenticated;
grant execute on function public.zone_availability(double precision,double precision,integer,uuid), public.submit_zone_booking(jsonb,date,double precision,double precision,boolean) to service_role;
grant execute on function public.configure_zone_booking(text,jsonb), public.manage_zone_request(uuid,text,timestamptz,integer,numeric,text,uuid), public.zone_day_plan(date), public.zone_day_used(date,uuid,uuid), public.zone_day_free_minutes(date,uuid,uuid), public.zone_primary_unit() to authenticated;
commit;
