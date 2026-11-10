-- Allows "otro" vehicles (moto, cuatriciclo, etc.) with a free-text label, added from the admin panel.
alter table public.vehicles add column if not exists category_label text;

alter table public.vehicles drop constraint if exists vehicles_category_check;
alter table public.vehicles add constraint vehicles_category_check
  check (category = any (array['auto', 'suv', 'pickup', 'otro']));

alter table public.vehicles drop constraint if exists vehicles_category_label_check;
alter table public.vehicles add constraint vehicles_category_label_check
  check (
    (category <> 'otro' or length(trim(coalesce(category_label, ''))) between 2 and 40)
    and (category_label is null or length(category_label) <= 40)
  );

alter table public.appointment_vehicles drop constraint if exists appointment_vehicles_category_check;
alter table public.appointment_vehicles add constraint appointment_vehicles_category_check
  check (category = any (array['auto', 'suv', 'pickup', 'otro']));
