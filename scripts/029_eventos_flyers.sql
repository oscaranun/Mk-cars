-- Flyers de eventos con link propio (/evento/<slug>). Solo administradores pueden gestionarlos.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  title text not null check (char_length(title) between 3 and 120),
  event_date date,
  place text check (char_length(place) <= 120),
  description text check (char_length(description) <= 500),
  button_label text not null default 'Reservá tu turno' check (char_length(button_label) between 2 and 40),
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists events_admin_all on public.events;
create policy events_admin_all on public.events for all to authenticated using (is_admin()) with check (is_admin());

-- submit_booking acepta origen "evento:<slug>" además de "whatsapp_flyer" y "web".
do $mig$
declare d text; n text;
begin
  select pg_get_functiondef('public.submit_booking(jsonb)'::regprocedure) into d;
  n := replace(d,
    $x$case when payload ->> 'origen_reserva' = 'whatsapp_flyer' then 'whatsapp_flyer' else 'web' end$x$,
    $x$case when payload ->> 'origen_reserva' = 'whatsapp_flyer' or coalesce(payload ->> 'origen_reserva', '') ~ '^evento:[a-z0-9]+(-[a-z0-9]+)*$' then payload ->> 'origen_reserva' else 'web' end$x$);
  if n <> d then execute n; end if;
end
$mig$;
