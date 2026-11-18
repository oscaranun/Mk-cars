"""Migration 033 on disposable PostgreSQL only; never reads hosted credentials."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import time
import unittest
import uuid
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
CONTAINER='mk-cashflow-'+uuid.uuid4().hex[:10]
OWNER='00000000-0000-0000-0000-000000000001'
STAFF='00000000-0000-0000-0000-000000000002'
STRANGER='00000000-0000-0000-0000-000000000003'
PAYLOAD='\'{"schemaVersion":1,"ticket":30000}\'::jsonb'

def sql(body,check=True):
    result=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-XqAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d','flow'],input=body,text=True,capture_output=True)
    if check and result.returncode:raise AssertionError(result.stderr)
    return result

def session(user):return f"set local role authenticated;set local request.jwt.claim.sub='{user}';"

class CashflowDB(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['docker','run','--name',CONTAINER,'-e','POSTGRES_PASSWORD=local-only','-e','POSTGRES_DB=flow','-d','postgres:17-alpine'],check=True,capture_output=True)
        for _ in range(100):
            if subprocess.run(['docker','exec',CONTAINER,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0:break
            time.sleep(.2)
        sql(f"""create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.admins(user_id uuid primary key,role text,permissions text[]);
create table public.payments(id integer primary key,amount numeric);
insert into public.payments values(1,35000);
insert into auth.users values('{OWNER}'),('{STAFF}'),('{STRANGER}');
insert into public.admins values('{OWNER}','owner','{{}}'),('{STAFF}','staff','{{flujo-de-fondos}}'),('{STRANGER}','staff','{{turnos}}');
grant usage on schema public,auth to authenticated,anon;
"""+(ROOT/'scripts/033_flujo_de_fondos.sql').read_text())

    @classmethod
    def tearDownClass(cls):subprocess.run(['docker','rm','-f',CONTAINER],capture_output=True)

    def test_owner_save_is_versioned_and_keeps_previous_configuration(self):
        result=sql('begin;'+session(OWNER)+f"select public.save_cashflow_config({PAYLOAD},0);select public.save_cashflow_config({PAYLOAD},1);select count(*)from public.cashflow_config_revisions;select version from public.cashflow_config;rollback;").stdout.strip().splitlines()
        self.assertEqual(result,['1','2','2','2'])

    def test_staff_can_read_authorized_config_but_cannot_save(self):
        result=sql('begin;'+session(OWNER)+f"select public.save_cashflow_config({PAYLOAD},0);reset role;"+session(STAFF)+"select count(*)from public.cashflow_config;rollback;").stdout.strip().splitlines()
        self.assertEqual(result,['1','1'])
        denied=sql('begin;'+session(STAFF)+f"select public.save_cashflow_config({PAYLOAD},0);",False)
        self.assertNotEqual(denied.returncode,0);self.assertIn('42501',denied.stderr)

    def test_ungranted_staff_has_no_financial_config_rows(self):
        result=sql('begin;'+session(OWNER)+f"select public.save_cashflow_config({PAYLOAD},0);reset role;"+session(STRANGER)+"select count(*)from public.cashflow_config;select count(*)from public.cashflow_config_revisions;rollback;").stdout.strip().splitlines()
        self.assertEqual(result,['1','0','0'])

    def test_direct_writes_and_anonymous_access_are_denied(self):
        for prefix,query in [(session(OWNER),f"insert into public.cashflow_config(id,config,version)values(1,{PAYLOAD},1);"),
                             ('set local role anon;',f"select public.save_cashflow_config({PAYLOAD},0);"),
                             ('set local role anon;','select * from public.cashflow_config;')]:
            self.assertNotEqual(sql('begin;'+prefix+query,False).returncode,0)

    def test_stale_version_does_not_overwrite_a_newer_plan(self):
        result=sql('begin;'+session(OWNER)+f"select public.save_cashflow_config({PAYLOAD},0);select public.save_cashflow_config({PAYLOAD},0);",False)
        self.assertNotEqual(result.returncode,0);self.assertIn('40001',result.stderr)

    def test_concurrent_first_save_accepts_only_one_version_zero(self):
        with ThreadPoolExecutor(max_workers=2)as pool:
            results=list(pool.map(lambda _:sql('begin;'+session(OWNER)+f"select public.save_cashflow_config({PAYLOAD},0);commit;",False),range(2)))
        self.assertEqual(sum(r.returncode==0 for r in results),1)
        self.assertEqual(sql('select count(*)from public.cashflow_config_revisions;').stdout.strip(),'1')
        sql('truncate public.cashflow_config_revisions,public.cashflow_config;')

    def test_invalid_payload_rejected_without_creating_a_version(self):
        for value in ["'{}'::jsonb","'[]'::jsonb",'null']:
            self.assertNotEqual(sql('begin;'+session(OWNER)+f"select public.save_cashflow_config({value},0);",False).returncode,0)

    def test_private_installer_seeds_once_and_never_overwrites_model_edits_or_ledger(self):
        spec=importlib.util.spec_from_file_location('activation',ROOT/'scripts/prepare_cashflow_activation.py')
        activation=importlib.util.module_from_spec(spec);spec.loader.exec_module(activation)
        model=json.loads((ROOT/'tests/fixtures/cashflow-workbook.json').read_text())
        model['config']['investments'][0]['label']="Activo'; DROP TABLE public.payments; --"
        script=activation.prepare(model,(ROOT/'scripts/033_flujo_de_fondos.sql').read_text())
        sql(script)
        self.assertEqual(sql("select version,config->>'ticket',original_config->>'ticket' from public.cashflow_config;").stdout.strip(),'1|30000.0|30000.0')
        sql('begin;'+session(OWNER)+"select public.save_cashflow_config(jsonb_build_object('schemaVersion',1,'ticket',35000),1);commit;")
        sql(script)
        self.assertEqual(sql("select version,config->>'ticket',original_config->>'ticket' from public.cashflow_config;").stdout.strip(),'2|35000|30000.0')
        self.assertEqual(sql('select amount from public.payments;').stdout.strip(),'35000')
        self.assertEqual(sql('select count(*)from public.cashflow_config_revisions;').stdout.strip(),'2')
        sql('truncate public.cashflow_config_revisions,public.cashflow_config;')

if __name__=='__main__':
    try:unittest.main(verbosity=2)
    finally:subprocess.run(['docker','rm','-f',CONTAINER],capture_output=True)
