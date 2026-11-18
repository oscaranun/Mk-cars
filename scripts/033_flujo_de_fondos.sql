-- Solo configuración e historial del modelo financiero. No modifica movimientos.
begin;
create table if not exists public.cashflow_config (
  id smallint primary key check(id=1),
  config jsonb not null check(jsonb_typeof(config)='object'),
  original_config jsonb check(original_config is null or jsonb_typeof(original_config)='object'),
  source jsonb check(source is null or jsonb_typeof(source)='object'),
  observations jsonb check(observations is null or jsonb_typeof(observations)='array'),
  version integer not null check(version>0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table if not exists public.cashflow_config_revisions (
  id bigint generated always as identity primary key,
  version integer not null,
  before_config jsonb,
  after_config jsonb not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.cashflow_config add column if not exists original_config jsonb;
alter table public.cashflow_config add column if not exists source jsonb;
alter table public.cashflow_config add column if not exists observations jsonb;
create or replace function public.can_read_cashflow()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.admins a where a.user_id=auth.uid()
    and (a.role='owner' or 'flujo-de-fondos'=any(a.permissions)));
$$;
revoke all on function public.can_read_cashflow() from public,anon;
grant execute on function public.can_read_cashflow() to authenticated;
alter table public.cashflow_config enable row level security;
alter table public.cashflow_config_revisions enable row level security;
revoke all on public.cashflow_config,public.cashflow_config_revisions from public,anon,authenticated;
grant select on public.cashflow_config,public.cashflow_config_revisions to authenticated;
drop policy if exists cashflow_config_read on public.cashflow_config;
create policy cashflow_config_read on public.cashflow_config for select to authenticated using(public.can_read_cashflow());
drop policy if exists cashflow_revisions_read on public.cashflow_config_revisions;
create policy cashflow_revisions_read on public.cashflow_config_revisions for select to authenticated using(public.can_read_cashflow());

create or replace function public.save_cashflow_config(p_config jsonb,p_version integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_version integer; old_config jsonb; new_version integer;
begin
  if not exists(select 1 from public.admins where user_id=auth.uid() and role='owner') then
    raise exception 'Solo el propietario puede modificar los supuestos financieros.' using errcode='42501';
  end if;
  if p_version is null or p_version<0 or p_config is null or jsonb_typeof(p_config)<>'object'
    or octet_length(p_config::text)>100000 or p_config->>'schemaVersion' is distinct from '1' then
    raise exception 'Configuración inválida' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(330033);
  select version,config into current_version,old_config from public.cashflow_config where id=1 for update;
  if coalesce(current_version,0)<>p_version then
    raise exception 'La configuración cambió; recargá antes de guardar.' using errcode='40001';
  end if;
  new_version:=coalesce(current_version,0)+1;
  insert into public.cashflow_config(id,config,version,updated_by)values(1,p_config,new_version,auth.uid())
    on conflict(id)do update set config=excluded.config,version=excluded.version,updated_at=now(),updated_by=auth.uid();
  insert into public.cashflow_config_revisions(version,before_config,after_config,actor_id)values(new_version,old_config,p_config,auth.uid());
  return new_version;
end $$;
revoke all on function public.save_cashflow_config(jsonb,integer) from public,anon;
grant execute on function public.save_cashflow_config(jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
