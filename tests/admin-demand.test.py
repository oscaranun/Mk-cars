"""Local PostgreSQL only. Uses synthetic data and Auth/storage stubs; no hosted DB credentials.

The historical forward catalogue/roles migrations are absent; the explicit fixture
is not a production dump. Tests exercise the actual 021/026 functions in isolation.
"""
import concurrent.futures
import pathlib
import subprocess
import time
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTAINER = "mk-demand-test-" + uuid.uuid4().hex[:10]
ADMIN = "set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';"
PAYLOAD = """jsonb_build_object('request_id',gen_random_uuid(),'full_name','Cliente Ficticio','whatsapp','5492619999999',
 'vehicle_category','auto','brand','Marca Ficticia','model','Modelo Ficticio','service','Lavado prueba',
 'address','Domicilio ficticio 123','performed_at',current_date-2+time '06:00','paid_at',current_date-1+time '15:30',
 'final_price',1250.50,'amount_paid',500.25,'method','transferencia','source','whatsapp')"""

def sql(body, check=True):
    r = subprocess.run(["docker","exec","-i",CONTAINER,"psql","-XqAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","demand"],input=body,text=True,capture_output=True)
    if check and r.returncode: raise AssertionError(r.stderr)
    return r

class DemandTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(["docker","run","--name",CONTAINER,"-e","POSTGRES_PASSWORD=local-only","-e","POSTGRES_DB=demand","-d","postgres:17-alpine"],check=True,capture_output=True)
        for _ in range(100):
            if subprocess.run(["docker","exec",CONTAINER,"pg_isready","-h","127.0.0.1","-U","postgres"],capture_output=True).returncode==0: break
            time.sleep(.2)
        setup="""
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email','test@example.invalid')$$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
grant usage on schema public,auth to anon,authenticated,service_role;
"""
        for filename in ['001_mk_cars_schema.sql','002_mk_cars_crm_operations.sql','004_whatsapp_confirmations.sql','008_caja_y_gastos.sql']:
            setup+=(ROOT/'scripts'/filename).read_text()
        setup+="""
create table public.blocked_dates(day date primary key,reason text);
create table public.vehicle_catalog(id uuid primary key default gen_random_uuid(),brand text,model text,category text);
alter table public.vehicles add column catalog_id uuid;
alter table public.admins add column full_name text;
alter table public.settings add column vehicle_prices jsonb default '{"auto":25000,"suv":30000,"pickup":35000}';
create table public.appointment_vehicles(id uuid primary key default gen_random_uuid(),appointment_id uuid references public.appointments(id) on delete cascade,vehicle_id uuid references public.vehicles(id),position int,category text,price_applied numeric,classification text,needs_review boolean);
alter table public.clients add column is_demo boolean default false;
alter table public.appointments add column is_demo boolean default false;
alter table public.services add column is_demo boolean default false;
alter table public.payments add column is_demo boolean default false;
alter table public.expenses add column is_demo boolean default false;
"""
        for filename in ['011_propuestas_y_cobros.sql','013_horario_ampliado_y_servicio_realizado.sql','014_seguimiento_duraciones_y_auditoria.sql','016_nombre_por_turno.sql','018_edicion_rapida_turnos.sql','019_crm_pro.sql','020_historial_por_usuario.sql','021_edicion_operativa.sql','022_fechas_pasadas_admin.sql','023_vehiculo_otro.sql','024_sin_traslado.sql','025_whatsapp_internacional.sql']:
            setup+=(ROOT/'scripts'/filename).read_text()
        setup+="grant select,insert,update,delete on all tables in schema public to authenticated;grant usage,select on all sequences in schema public to authenticated;"
        setup+=(ROOT/'scripts/026_admin_flexible_demanda.sql').read_text()
        setup+="insert into auth.users(id) values('00000000-0000-0000-0000-000000000001');insert into public.admins(user_id)values('00000000-0000-0000-0000-000000000001');"
        sql(setup)

    @classmethod
    def tearDownClass(cls): subprocess.run(["docker","rm","-f",CONTAINER],capture_output=True)

    def tx(self,body):return sql('begin;'+ADMIN+body+'rollback;').stdout.strip().splitlines()

    def test_historical_service_and_payment_dates_are_independent(self):
        self.assertEqual(self.tx(f"select public.admin_register_demand_service({PAYLOAD}) is not null;select (s.performed_at at time zone 'UTC')::date=current_date-2,(p.paid_at at time zone 'UTC')::date=current_date-1,p.amount=500.25 from public.services s join public.payments p on p.service_id=s.id;select final_price=1250.50,amount_paid=500.25 from public.services;"),['t','t|t|t','t|t'])

    def test_idempotency_and_reuses_vehicle(self):
        result=self.tx(f"""do $$declare p jsonb:={PAYLOAD};a uuid;b uuid;begin a:=public.admin_register_demand_service(p);b:=public.admin_register_demand_service(p);if a<>b then raise exception 'Duplicate request';end if;perform public.admin_register_demand_service(p||jsonb_build_object('request_id',gen_random_uuid()));end $$;select count(*) from public.appointments;select count(*) from public.vehicles;""")
        self.assertEqual(result,['2','1'])

    def test_rejects_cross_client_vehicle_and_rolls_back(self):
        result=sql('begin;'+ADMIN+f"select public.admin_register_demand_service({PAYLOAD}||jsonb_build_object('vehicle_id',gen_random_uuid()));",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('no pertenece',result.stderr)

    def test_atomic_price_and_payment_correction_rolls_back(self):
        result=self.tx(f"""do $$declare a uuid;p uuid;begin a:=public.admin_register_demand_service({PAYLOAD});select id into p from public.payments where appointment_id=a;begin perform public.admin_correct_payment(p,now(),1500,'invalid',null,null,a,'Prueba de fallo',true);raise exception 'Expected failure';exception when sqlstate '22023' then null;end; if public.appointment_final_price(a)<>1250.50 then raise exception 'Partial price change';end if; if(select amount from public.payments where id=p)<>500.25 then raise exception 'Partial payment change';end if;end $$;select true;""")
        self.assertEqual(result,['t'])

    def test_correcting_closed_day_keeps_original_and_real_date(self):
        result=self.tx(f"""do $$declare a uuid;p uuid;n uuid;begin a:=public.admin_register_demand_service({PAYLOAD});select id into p from public.payments where appointment_id=a;insert into public.cash_closings(day,expected,counted,difference)values(current_date-1,'{{}}','{{}}',0);n:=public.admin_correct_payment(p,(current_date-1+time '14:30') at time zone 'UTC',1000,'transferencia',null,null,a,'Corrección de importe',false);if n=p then raise exception 'Original replaced';end if;if not exists(select 1 from public.payments where id=p and voided_at is not null)then raise exception 'Missing history';end if;end $$;select sum(amount)from public.payments where voided_at is null;""")
        self.assertEqual(result,['1000.00'])

    def test_closed_expense_correction_has_single_active_amount(self):
        result=self.tx("""do $$declare e uuid;begin insert into public.expenses(spent_on,amount,method,category)values(current_date-1,10000,'efectivo','otro')returning id into e;insert into public.cash_closings(day,expected,counted,difference)values(current_date-1,'{}','{}',0);perform public.admin_update_expense(e,current_date-1,'otro',12000,'efectivo','Corregido',null,null,null,'Corrección de gasto');end $$;select sum(amount)from public.expenses where voided_at is null;select count(*)from public.expenses;""")
        self.assertEqual(result,['12000.00','2'])

    def test_closing_counts_only_active_expenses_and_versions_updates(self):
        result=self.tx("""insert into public.expenses(spent_on,amount,method,category,voided_at)values(current_date-1,10000,'efectivo','otro',now());insert into public.expenses(spent_on,amount,method,category)values(current_date-1,12000,'efectivo','otro');select public.admin_save_cash_closing(current_date-1,'{"efectivo":20000}','{"efectivo":8000,"transferencia":0,"mercadopago":0,"otro":0}',null,null);select public.admin_save_cash_closing(current_date-1,'{"efectivo":20000}','{"efectivo":7900,"transferencia":0,"mercadopago":0,"otro":0}',null,'Reconteo');select count(*)from public.cash_closing_revisions;""")
        self.assertEqual(result,['0.00','-100.00','2'])

    def test_no_closing_without_actual_count(self):
        r=sql('begin;'+ADMIN+"select public.admin_save_cash_closing(current_date,'{}','{}',null,null);",False)
        self.assertNotEqual(r.returncode,0);self.assertIn('Completá',r.stderr)

    def test_anonymous_and_nonadmin_cannot_write(self):
        for prefix in ['set role anon;','set role authenticated;']:
            r=sql(prefix+f"select public.admin_register_demand_service({PAYLOAD});",False)
            self.assertNotEqual(r.returncode,0)

    def test_edit_service_details_does_not_change_payment_date(self):
        result=self.tx(f"""do $$declare a uuid;d timestamptz;begin a:=public.admin_register_demand_service({PAYLOAD});select paid_at into d from public.payments where appointment_id=a;perform public.admin_edit_demand_details(a,'Lavado corregido','Otra dirección ficticia 456','Operario prueba',120,'Datos corregidos');if(select paid_at from public.payments where appointment_id=a)<>d then raise exception 'Payment moved';end if;end $$;select wash_type from public.services;""")
        self.assertEqual(result,['Lavado corregido'])

    def test_standalone_bank_income_is_idempotent(self):
        result=self.tx("""do $$declare req uuid:=gen_random_uuid();a uuid;b uuid;begin
 a:=public.admin_record_income(req,1234.50,'transferencia',(current_date-4+time '13:45') at time zone 'UTC','Ingreso a cuenta',null);
 b:=public.admin_record_income(req,1234.50,'transferencia',(current_date-4+time '13:45') at time zone 'UTC','Ingreso a cuenta',null);
 if a<>b then raise exception 'Duplicate income';end if;end $$;
 select count(*),sum(amount) from public.payments;
 select count(*)from public.appointments;""")
        self.assertEqual(result,['1|1234.50','0'])

    def test_income_applies_only_to_its_client_and_remaining_balance(self):
        result=self.tx(f"""do $$declare a uuid;c uuid;begin a:=public.admin_register_demand_service({PAYLOAD});select client_id into c from public.appointments where id=a;
 perform public.admin_record_income(gen_random_uuid(),750.25,'efectivo',now(),'Saldo del lavado',null,c,a);
 begin perform public.admin_record_income(gen_random_uuid(),1,'efectivo',now(),'Cobro excedente',null,c,a);raise exception 'Overpayment accepted';exception when sqlstate 'P0001' then if sqlerrm not like 'El cobro supera%' then raise;end if;end;
 end $$;select amount_paid,payment_status from public.services;""")
        self.assertEqual(result,['1250.50|cobrado'])

    def test_income_rectification_preserves_client_link(self):
        result=self.tx(f"""do $$declare a uuid;c uuid;p uuid;n uuid;begin a:=public.admin_register_demand_service({PAYLOAD});select client_id into c from public.appointments where id=a;
 p:=public.admin_record_income(gen_random_uuid(),100,'transferencia',(current_date-3)::timestamptz,'A cuenta del cliente',null,c,null);
 insert into public.cash_closings(day,expected,counted,difference)values(current_date-3,'{{}}','{{}}',0);
 n:=public.admin_correct_payment(p,(current_date-3)::timestamptz,150,'transferencia','A cuenta del cliente',null,null,'Importe corregido',false);
 if not exists(select 1 from public.payments where id=n and client_id=c and amount=150)then raise exception 'Client link lost';end if;
 end $$;select true;""")
        self.assertEqual(result,['t'])

if __name__=='__main__':
    try:unittest.main(verbosity=2)
    finally:subprocess.run(["docker","rm","-f",CONTAINER],capture_output=True)
