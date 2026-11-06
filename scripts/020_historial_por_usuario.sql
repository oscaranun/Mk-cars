-- Historial automático: cada alta, cambio o baja hecha por un usuario del panel queda registrada con su nombre.

alter table public.activity_log
  add column if not exists actor_id uuid,
  add column if not exists actor_name text,
  add column if not exists changes jsonb,
  add column if not exists source text not null default 'manual';

create index if not exists activity_log_actor_idx on public.activity_log (actor_id, created_at desc);

create or replace function public.activity_fill_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_id is null then new.actor_id := auth.uid(); end if;
  if new.actor_email is null then new.actor_email := auth.jwt() ->> 'email'; end if;
  if new.actor_name is null and new.actor_id is not null then
    select nullif(trim(a.full_name), '') into new.actor_name from public.admins a where a.user_id = new.actor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_log_fill_actor on public.activity_log;
create trigger activity_log_fill_actor
  before insert on public.activity_log
  for each row execute function public.activity_fill_actor();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '[]'::jsonb;
  k text;
begin
  -- Solo cambios hechos por usuarios logueados (no reservas públicas ni procesos del sistema).
  if auth.uid() is null then return null; end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      continue when k in ('id', 'created_at', 'updated_at', 'last_interaction_at');
      if v_new -> k is distinct from v_old -> k then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'field', k,
          'from', left(v_old ->> k, 80),
          'to', left(v_new ->> k, 80)
        ));
      end if;
    end loop;
    if jsonb_array_length(v_changes) = 0 then return null; end if;
  end if;

  insert into public.activity_log (entity, entity_id, action, detail, changes, source)
  values (
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'day'),
    case tg_op when 'INSERT' then 'creó' when 'UPDATE' then 'modificó' else 'eliminó' end,
    left(coalesce(
      v_row ->> 'full_name', v_row ->> 'contact_name', v_row ->> 'title', v_row ->> 'description',
      v_row ->> 'code', v_row ->> 'service', v_row ->> 'wash_type', v_row ->> 'reason',
      nullif(concat_ws(' ', v_row ->> 'brand', v_row ->> 'model'), ''),
      case when v_row ? 'amount' then '$' || (v_row ->> 'amount') end
    ), 200),
    case when tg_op = 'UPDATE' then v_changes end,
    'auto'
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'vehicles', 'appointments', 'inquiries', 'services', 'payments', 'expenses',
    'blocked_dates', 'appointment_offers', 'appointment_notes', 'client_contacts',
    'settings', 'vehicle_catalog', 'admins'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t || '_audit', t
    );
  end loop;
end $$;

-- Completa nombres en registros anteriores cuando se conoce el usuario por email.
update public.activity_log l
   set actor_name = nullif(trim(a.full_name), ''), actor_id = u.id
  from auth.users u
  join public.admins a on a.user_id = u.id
 where l.actor_name is null and l.actor_email = u.email;
