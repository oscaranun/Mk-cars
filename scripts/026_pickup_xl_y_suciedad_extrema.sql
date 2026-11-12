-- Pick-up XL category + "Suciedad extrema" (+20%) admin-only surcharge.
-- Existing appointments, prices already applied and payments are not touched.

alter table public.services drop constraint if exists services_vehicle_category_check;
alter table public.services add constraint services_vehicle_category_check
  check (vehicle_category is null or vehicle_category = any (array['auto', 'suv', 'pickup', 'pickup_xl']));

alter table public.vehicle_catalog drop constraint if exists vehicle_catalog_category_check;
alter table public.vehicle_catalog add constraint vehicle_catalog_category_check
  check (category = any (array['auto', 'suv', 'pickup', 'pickup_xl']));

alter table public.vehicles drop constraint if exists vehicles_category_check;
alter table public.vehicles add constraint vehicles_category_check
  check (category = any (array['auto', 'suv', 'pickup', 'pickup_xl', 'otro']));

alter table public.appointment_vehicles drop constraint if exists appointment_vehicles_category_check;
alter table public.appointment_vehicles add constraint appointment_vehicles_category_check
  check (category = any (array['auto', 'suv', 'pickup', 'pickup_xl', 'otro']));

alter table public.settings alter column vehicle_prices
  set default '{"auto": 25000, "suv": 30000, "pickup": 35000, "pickup_xl": 40000}'::jsonb;
alter table public.settings alter column duration_defaults
  set default '{"auto": 60, "suv": 75, "pickup": 90, "pickup_xl": 105}'::jsonb;

update public.settings
   set vehicle_prices = coalesce(vehicle_prices, '{}'::jsonb) || '{"pickup_xl": 40000}'::jsonb
 where not (coalesce(vehicle_prices, '{}'::jsonb) ? 'pickup_xl');
update public.settings
   set duration_defaults = coalesce(duration_defaults, '{}'::jsonb) || '{"pickup_xl": 105}'::jsonb
 where not (coalesce(duration_defaults, '{}'::jsonb) ? 'pickup_xl');

-- Accept the new category in the booking / admin RPCs.
do $$
declare
  fn regprocedure;
  def text;
begin
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('submit_booking', 'complete_appointment', 'admin_create_appointment', 'admin_register_completed_service')
  loop
    def := pg_get_functiondef(fn);
    def := replace(def, '(''auto'', ''suv'', ''pickup'')', '(''auto'', ''suv'', ''pickup'', ''pickup_xl'')');
    def := replace(def, '"pickup":35000}', '"pickup":35000,"pickup_xl":40000}');
    execute def;
  end loop;
end $$;

alter table public.appointments add column if not exists extreme_dirt boolean not null default false;
alter table public.appointments add column if not exists extreme_dirt_amount numeric(12, 2) not null default 0;

create or replace function public.admin_set_extreme_dirt(p_id uuid, p_enabled boolean)
returns numeric
language plpgsql
security definer
set search_path to ''
as $function$
declare
  appt public.appointments%rowtype;
  v_service uuid;
  v_current numeric(12, 2);
  v_base numeric(12, 2);
  v_amount numeric(12, 2);
  v_new numeric(12, 2);
  v_paid numeric(12, 2);
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Turno inexistente' using errcode = 'P0001'; end if;
  if coalesce(p_enabled, false) = appt.extreme_dirt then return appt.extreme_dirt_amount; end if;

  v_current := public.appointment_final_price(p_id);

  if p_enabled then
    v_base := greatest(coalesce(appt.agreed_price, 0) - coalesce(appt.discount, 0), 0);
    if v_base <= 0 then
      raise exception 'Cargá primero el precio acordado del lavado.' using errcode = 'P0001';
    end if;
    v_amount := round(v_base * 0.2, 0);
    v_new := v_current + v_amount;
  else
    v_amount := 0;
    v_new := greatest(v_current - appt.extreme_dirt_amount, 0);
    select coalesce(sum(amount), 0) into v_paid from public.payments
     where appointment_id = p_id and voided_at is null and kind = 'servicio';
    if v_new < v_paid then
      raise exception 'No se puede quitar: lo cobrado ($%) supera el nuevo total. Corregí primero el cobro.', v_paid using errcode = 'P0001';
    end if;
  end if;

  update public.appointments
     set extreme_dirt = p_enabled, extreme_dirt_amount = v_amount, adjusted_price = v_new
   where id = p_id;

  select id into v_service from public.services where appointment_id = p_id order by created_at limit 1;
  if v_service is not null then
    update public.services
       set final_price = v_new,
           payment_status = case when amount_paid <= 0 then 'pendiente' when amount_paid < v_new then 'parcial' else 'cobrado' end
     where id = v_service;
  end if;
  perform public.recalculate_appointment_payment(p_id);
  perform public.sync_inquiry_payment_status(p_id);

  perform public.log_correction('appointment', p_id, p_id, 'precio',
    jsonb_build_object('precio_final', v_current, 'suciedad_extrema', appt.extreme_dirt_amount),
    jsonb_build_object('precio_final', v_new, 'suciedad_extrema', v_amount),
    case when p_enabled then 'Suciedad extrema +20%' else 'Se quitó suciedad extrema' end);

  return v_amount;
end $function$;

revoke all on function public.admin_set_extreme_dirt(uuid, boolean) from public, anon;
grant execute on function public.admin_set_extreme_dirt(uuid, boolean) to authenticated;
