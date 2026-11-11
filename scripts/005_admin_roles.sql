-- Prerrequisito de perfiles del panel. No designa propietarios automáticamente.
-- Instalar antes de 020/026 en bases antiguas que solo tenían admins.user_id.
begin;
alter table public.admins
  add column if not exists full_name text,
  add column if not exists role text not null default 'staff',
  add column if not exists permissions text[] not null default '{}'::text[];
do $$begin
  if not exists(select 1 from pg_constraint where conrelid='public.admins'::regclass and conname='admins_role_check') then
    alter table public.admins add constraint admins_role_check check(role in ('owner','staff'));
  end if;
end $$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.admins where user_id=auth.uid() and role='owner');
$$;
revoke all on function public.is_owner() from public,anon;
grant execute on function public.is_owner() to authenticated;

-- El panel administra usuarios mediante service_role tras comprobar is_owner.
-- Ningún administrador puede ascender su propio rol por una escritura REST.
do $$declare p record;begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='admins' loop
    execute format('drop policy %I on public.admins',p.policyname);
  end loop;
end $$;
alter table public.admins enable row level security;
create policy admins_read_profiles on public.admins for select to authenticated using(public.is_admin());
revoke insert,update,delete on public.admins from anon,authenticated;
grant select on public.admins to authenticated;
grant all on public.admins to service_role;
notify pgrst,'reload schema';
commit;
