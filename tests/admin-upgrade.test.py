"""Exercise the complete legacy upgrade on disposable PostgreSQL, never hosted data."""
import importlib.util
from pathlib import Path
import subprocess
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

legacy = module('demand_cases', ROOT/'tests/admin-demand.test.py')
builder = module('upgrade_builder', ROOT/'scripts/prepare_test_upgrade.py')


class LegacyUpgradeTests(legacy.DemandTests):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['docker','run','--name',legacy.CONTAINER,'-e','POSTGRES_PASSWORD=local-only','-e','POSTGRES_DB=demand','-d','postgres:17-alpine'],check=True,capture_output=True)
        for _ in range(100):
            if subprocess.run(['docker','exec',legacy.CONTAINER,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode == 0:
                break
            time.sleep(.2)
        setup="""
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email','owner@example.invalid')$$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
grant usage on schema public,auth to anon,authenticated,service_role;
"""
        for number in [1,2,4,6,8]:
            setup += next((ROOT/'scripts').glob(f'{number:03}_*.sql')).read_text()
        # Explicit fixture for the unversioned catalogue and availability schema.
        setup += """
create table public.blocked_dates(day date primary key,reason text);
create table public.vehicle_catalog(id uuid primary key default gen_random_uuid(),brand text,model text,category text);
alter table public.vehicles add column catalog_id uuid;
alter table public.settings add column vehicle_prices jsonb default '{"auto":25000,"suv":30000,"pickup":35000}';
create table public.appointment_vehicles(id uuid primary key default gen_random_uuid(),appointment_id uuid references public.appointments(id) on delete cascade,vehicle_id uuid references public.vehicles(id),position int,category text,price_applied numeric,classification text,needs_review boolean);
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000001','owner@example.invalid');
insert into public.admins(user_id)values('00000000-0000-0000-0000-000000000001');
"""
        legacy.sql(setup)
        cls.bundle = builder.upgrade_sql('owner@example.invalid')
        legacy.sql(cls.bundle)

    def test_owner_bootstrap_and_staff_cannot_promote_self(self):
        self.assertEqual(self.tx('select public.is_owner();'), ['t'])
        result = legacy.sql("begin;insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000002','staff@example.invalid');insert into public.admins(user_id)values('00000000-0000-0000-0000-000000000002');set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';update public.admins set role='owner';",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('permission denied',result.stderr)

    def test_upgrade_can_be_reapplied(self):
        legacy.sql(self.bundle)
        self.assertEqual(self.tx('select public.is_owner();'), ['t'])


if __name__ == '__main__':
    try:
        unittest.main(verbosity=2)
    finally:
        subprocess.run(['docker','rm','-f',legacy.CONTAINER],capture_output=True)
