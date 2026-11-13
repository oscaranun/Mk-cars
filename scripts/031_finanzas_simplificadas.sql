-- Finanzas simplificadas (panel de pruebas):
-- conceptos predeterminados de ingresos/gastos editables y otros ingresos que no vienen de un turno.

create table if not exists public.finance_concepts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ingreso', 'gasto')),
  name text not null check (length(trim(name)) between 2 and 60),
  default_amount numeric(12, 2) check (default_amount is null or default_amount > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists finance_concepts_kind_name_key on public.finance_concepts (kind, lower(trim(name)));

alter table public.finance_concepts enable row level security;
drop policy if exists finance_concepts_admin_all on public.finance_concepts;
create policy finance_concepts_admin_all on public.finance_concepts
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.finance_concepts (kind, name) values
  ('gasto', 'Productos'),
  ('gasto', 'Combustible'),
  ('gasto', 'Mantenimiento'),
  ('gasto', 'Publicidad'),
  ('gasto', 'Honorarios Cristian'),
  ('gasto', 'Honorarios Rodrigo'),
  ('ingreso', 'Lavado fuera de turno'),
  ('ingreso', 'Venta de productos'),
  ('ingreso', 'Aporte de socios')
on conflict do nothing;

create table if not exists public.other_incomes (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  concept text not null check (length(trim(concept)) between 2 and 60),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 100000000),
  method text not null check (method in ('efectivo', 'transferencia', 'mercadopago', 'otro')),
  notes text check (notes is null or length(notes) <= 500),
  is_demo boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists other_incomes_received_on_idx on public.other_incomes (received_on desc);

alter table public.other_incomes enable row level security;
drop policy if exists other_incomes_admin_all on public.other_incomes;
create policy other_incomes_admin_all on public.other_incomes
  for all using (public.is_admin()) with check (public.is_admin());
