-- CRM pro: patentes, lista de precios por servicio, fotos, fidelidad, abonos, cupones,
-- cierre de caja, gastos fijos, tareas y registro general de actividad.

alter table public.vehicles add column if not exists plate text;
create index if not exists vehicles_plate_idx on public.vehicles (upper(plate));

alter table public.settings add column if not exists service_prices jsonb not null default '[]'::jsonb;
alter table public.settings add column if not exists loyalty_every int not null default 6;

create table if not exists public.appointment_photos (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('antes', 'despues')),
  path text not null,
  uploaded_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists appointment_photos_appt_idx on public.appointment_photos (appointment_id);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  total_washes int not null check (total_washes between 1 and 100),
  used_washes int not null default 0 check (used_washes >= 0),
  price numeric not null default 0 check (price >= 0),
  expires_on date,
  created_at timestamptz not null default now(),
  constraint client_packages_used_lte_total check (used_washes <= total_washes)
);
create index if not exists client_packages_client_idx on public.client_packages (client_id);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('porcentaje', 'monto')),
  value numeric not null check (value > 0),
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0 check (uses >= 0),
  expires_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  expected jsonb not null,
  counted jsonb not null,
  difference numeric not null,
  notes text,
  closed_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null,
  method text not null default 'efectivo',
  amount numeric not null check (amount > 0),
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_generated_month text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_on date not null,
  client_id uuid references public.clients(id) on delete set null,
  done_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists admin_tasks_due_idx on public.admin_tasks (due_on) where done_at is null;

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_email text,
  entity text not null,
  entity_id text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);

do $$
declare t text;
begin
  foreach t in array array['appointment_photos','client_packages','coupons','cash_closings','recurring_expenses','admin_tasks','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('lavados', 'lavados', false)
on conflict (id) do nothing;
