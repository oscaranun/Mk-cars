-- 015: seguimiento manual de reseñas de Google por cliente.
-- Solo agrega columnas con valores por defecto: no modifica datos existentes.

alter table public.clients
  add column if not exists review_status text not null default 'pendiente'
    check (review_status in ('pendiente', 'solicitada', 'recibida')),
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_requested_by uuid,
  add column if not exists review_requested_by_name text,
  add column if not exists review_request_count integer not null default 0,
  add column if not exists review_received_at timestamptz,
  add column if not exists review_received_by uuid,
  add column if not exists review_received_by_name text,
  add column if not exists review_note text;

create index if not exists clients_review_status_idx on public.clients (review_status);

-- Registra la acción con el usuario autenticado (no confiable desde el cliente).
create or replace function public.set_client_review(p_client_id uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_action not in ('solicitada', 'recibida', 'pendiente') then
    raise exception 'invalid action' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(a.full_name), ''), u.email)
    into v_name
    from public.admins a
    join auth.users u on u.id = a.user_id
   where a.user_id = v_uid;

  if p_action = 'solicitada' then
    update public.clients
       set review_status = case when review_status = 'recibida' then 'recibida' else 'solicitada' end,
           review_requested_at = now(),
           review_requested_by = v_uid,
           review_requested_by_name = v_name,
           review_request_count = review_request_count + 1
     where id = p_client_id;
  elsif p_action = 'recibida' then
    update public.clients
       set review_status = 'recibida',
           review_received_at = now(),
           review_received_by = v_uid,
           review_received_by_name = v_name,
           review_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
     where id = p_client_id;
  else
    update public.clients
       set review_status = case when review_requested_at is null then 'pendiente' else 'solicitada' end,
           review_received_at = null,
           review_received_by = null,
           review_received_by_name = null,
           review_note = null
     where id = p_client_id;
  end if;

  if not found then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_client_review(uuid, text, text) from public, anon;
grant execute on function public.set_client_review(uuid, text, text) to authenticated;
