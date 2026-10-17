-- Mercado Pago como medio de pago, tabla de gastos y soporte para cierre de caja diario.

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('efectivo', 'transferencia', 'mercadopago', 'otro'));

create or replace function public.add_payment(p_service_id uuid, p_amount numeric, p_method text, p_paid_at timestamp with time zone, p_notes text)
 returns void
 language plpgsql
 set search_path to ''
as $function$
declare
  svc public.services%rowtype;
  v_inquiry uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into svc from public.services where id = p_service_id for update;
  if not found then
    raise exception 'Servicio inexistente' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor a cero.' using errcode = '22023';
  end if;
  if p_amount > svc.final_price - svc.amount_paid then
    raise exception 'El importe supera el saldo pendiente.' using errcode = 'P0001';
  end if;
  if p_method not in ('efectivo', 'transferencia', 'mercadopago', 'otro') then
    raise exception 'Medio de pago inválido' using errcode = '22023';
  end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then
    raise exception 'Fecha de pago inválida' using errcode = '22023';
  end if;

  insert into public.payments (service_id, amount, method, paid_at, notes)
  values (p_service_id, round(p_amount, 2), p_method, p_paid_at, nullif(trim(p_notes), ''));

  if svc.amount_paid + p_amount >= svc.final_price then
    select inquiry_id into v_inquiry from public.appointments where id = svc.appointment_id;
    update public.inquiries set commercial_status = 'cobrado' where id = v_inquiry;
  end if;
end;
$function$;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  category text not null check (category in ('productos', 'combustible', 'mantenimiento', 'publicidad', 'otro')),
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'efectivo' check (method in ('efectivo', 'transferencia', 'mercadopago', 'otro')),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_spent_on_idx on public.expenses (spent_on desc);

alter table public.expenses enable row level security;
drop policy if exists expenses_admin_all on public.expenses;
create policy expenses_admin_all on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
