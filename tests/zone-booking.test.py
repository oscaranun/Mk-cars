"""Integration tests against an isolated PostgreSQL container, NEVER the configured Supabase.

Run: python tests/zone-booking.test.py
The missing forward catalog migration is represented by a minimal schema fixture;
the retained multi-vehicle submit_booking implementation is extracted without running
any rollback SQL. This does not establish equivalence with all production functions.
"""
import concurrent.futures
import pathlib
import subprocess
import time
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTAINER = "mk-zones-test-" + uuid.uuid4().hex[:10]


def sql(body, check=True):
    result = subprocess.run(["docker", "exec", "-i", CONTAINER, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "zones"], input=body, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result


ADMIN = "set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';"
PAYLOAD = """'{"full_name":"Cliente Prueba","whatsapp":"5492611234567","address":"Dirección de prueba 123","vehicles":[{"category":"auto","brand":"Prueba","model":"Prueba"}],"service":"Lavado","water_supply":"domicilio","extras":[]}'::jsonb"""
DAY = "(current_date+7)"


class ZoneBookingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(["docker", "run", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=isolated-test-only", "-e", "POSTGRES_DB=zones", "-d", "postgres:17-alpine"], check=True, capture_output=True)
        for _ in range(60):
            if subprocess.run(["docker", "exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], capture_output=True).returncode == 0:
                break
            time.sleep(.2)
        setup = """
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
grant usage on schema auth to anon,authenticated,service_role;
"""
        setup += (ROOT / "scripts/001_mk_cars_schema.sql").read_text()
        setup += (ROOT / "scripts/002_mk_cars_crm_operations.sql").read_text()
        setup += (ROOT / "scripts/004_whatsapp_confirmations.sql").read_text()
        setup += """
create table public.blocked_dates(day date primary key,reason text not null default '',created_at timestamptz default now());
create table public.appointment_vehicles(id uuid primary key default gen_random_uuid(),appointment_id uuid references public.appointments(id),vehicle_id uuid references public.vehicles(id),position integer);
alter table public.settings add column vehicle_prices jsonb default '{"auto":25000,"suv":30000,"pickup":35000}';
insert into auth.users(id) values('00000000-0000-0000-0000-000000000001');
insert into public.admins(user_id) values('00000000-0000-0000-0000-000000000001');
-- Supabase grants the authenticated role table privileges; the SQL in this repo
-- relies on those platform defaults plus its admin RLS policies. Mirror them only
-- on the legacy fixture tables, BEFORE 010 applies its narrower new-table grants.
grant select,insert,update,delete on all tables in schema public to authenticated;
"""
        retained = (ROOT / "scripts/003_vehicle_catalog_rollback.sql").read_text()
        setup += retained[retained.index("create or replace function public.submit_booking"):retained.index("$function$;", retained.index("create or replace function public.submit_booking"))+len("$function$;")]
        setup += (ROOT / "scripts/010_zone_booking.sql").read_text()
        sql(setup)

    @classmethod
    def tearDownClass(cls):
        subprocess.run(["docker", "rm", "-f", CONTAINER], capture_output=True)

    def run_transaction(self, body):
        return sql("begin;" + ADMIN + body + "rollback;").stdout.strip()

    def prepare(self):
        return """
update public.zone_booking_settings set enabled=true;
update public.operating_zones set active=true,polygon='[[-68.9,-33.0],[-68.8,-33.0],[-68.8,-32.8],[-68.9,-32.8],[-68.9,-33.0]]';
update public.zone_weekly_schedule set enabled=true,flexible=true,capacity=1;
"""

    def test_flag_off_and_no_invented_geometry(self):
        self.assertEqual(self.run_transaction("select (public.zone_availability(-32.9,-68.85,1)->>'enabled')::boolean;"), "f")
        self.assertEqual(self.run_transaction("select count(*) from public.operating_zones where active or polygon is not null;"), "0")

    def test_geometry_and_priority(self):
        result = self.run_transaction(self.prepare() + """
update public.operating_zones set priority=99 where name='Capital';
select name from public.operating_zones where id=public.zone_resolve(-32.9,-68.85);
select public.zone_ring_contains('[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]',0,1);
select public.zone_resolve(0,0) is null;
""")
        self.assertEqual(result.splitlines(), ["Capital", "t", "t"])

    def test_capacity_waitlist_and_no_appointment_before_acceptance(self):
        result = self.run_transaction(self.prepare()+f"""
select public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false) is not null;
select public.submit_zone_booking(jsonb_set({PAYLOAD},'{{whatsapp}}','"5492611234568"'),{DAY},-32.9,-68.85,true) is not null;
select string_agg(status,',' order by status) from public.zone_booking_requests;
select public.zone_day_used({DAY});
select count(*) from public.appointments;
""")
        self.assertEqual(result.splitlines(), ["t", "t", "espera,recibida", "1", "0"])

    def test_full_date_rejects_without_opt_in(self):
        result = sql("begin;"+ADMIN+self.prepare()+f"select public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);select public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("fecha se completó",result.stderr)

    def test_blocked_date_and_manual_review(self):
        self.assertEqual(self.run_transaction(self.prepare()+f"select public.submit_zone_booking({PAYLOAD},null,0,0,false) is not null;select status from public.zone_booking_requests;" ).splitlines(),["t","revision"])
        result = sql("begin;"+ADMIN+self.prepare()+f"insert into public.blocked_dates(day) values({DAY});select public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("no visitamos",result.stderr)

    def test_proposal_and_acceptance_create_legacy_entities_atomically(self):
        result = self.run_transaction(self.prepare()+f"""
do $$declare r uuid;begin
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'propose',({DAY}::text||'T09:00:00-03:00')::timestamptz,90,25000,null);
 if (select count(*) from public.appointments)<>0 then raise exception 'Premature appointment';end if;
 perform public.manage_zone_request(r,'client_accepted');
end $$;
select status from public.zone_booking_requests;
select status from public.appointments;
select commercial_status from public.inquiries;
select count(*) from public.zone_booking_events;
""")
        self.assertEqual(result.splitlines(),["confirmada","confirmado","convertida","3"])

    def test_proposal_overlap_and_late_hours_rejected(self):
        for hour, duration, expected in [("08:00",90,"09:00"),("17:30",90,"18:00"),("17:30",540,"18:00")]:
            result=sql("begin;"+ADMIN+self.prepare()+f"""do $$declare r uuid;begin r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);perform public.manage_zone_request(r,'propose',({DAY}::text||'T{hour}:00-03:00')::timestamptz,{duration},25000,null);end $$;""",False)
            self.assertNotEqual(result.returncode,0)
            self.assertIn(expected,result.stderr)

    def test_acceptance_rechecks_conflicts_and_rolls_back(self):
        result=sql("begin;"+ADMIN+self.prepare()+f"""
update public.zone_weekly_schedule set capacity=4;
do $$declare r uuid; s uuid;start timestamptz:=({DAY}::text||'T09:00:00-03:00')::timestamptz;begin
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 s:=public.submit_zone_booking(jsonb_set({PAYLOAD},'{{whatsapp}}','"5492611234568"'),{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'propose',start,90,25000,null);
 perform public.manage_zone_request(s,'propose',start,90,25000,null);
 perform public.manage_zone_request(r,'client_accepted');
 begin perform public.manage_zone_request(s,'client_accepted');raise exception 'TEST: overlap accepted';
 exception when sqlstate 'P0001' then
  if sqlerrm not like 'La unidad móvil ya tiene un turno%' then raise;end if;
 end;
 if (select count(*) from public.appointments)<>1 then raise exception 'TEST: non-atomic acceptance';end if;
 if (select status from public.zone_booking_requests where id=s)<>'propuesta' then raise exception 'TEST: pending proposal lost';end if;
end $$;rollback;
""")
        self.assertEqual(result.returncode,0)

    def test_cancel_releases_capacity_and_keeps_history(self):
        result=self.run_transaction(self.prepare()+f"""
do $$declare r uuid;begin
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'cancel',null,null,null,'Cliente canceló');
end $$;
select public.zone_day_used({DAY});select count(*) from public.zone_booking_requests;select count(*) from public.zone_booking_events;
""")
        self.assertEqual(result.splitlines(),["0","1","2"])

    def test_configuration_updates_and_override(self):
        result=self.run_transaction(f"""
select public.configure_zone_booking('weekly','{{"weekday":0,"zone_ids":[],"flexible":true,"enabled":true,"capacity":2}}');
select public.configure_zone_booking('override',jsonb_build_object('day',{DAY},'zone_ids','[]'::jsonb,'flexible',true,'enabled',false,'capacity',1));
select enabled from public.zone_day_plan({DAY});
""")
        self.assertEqual(result.splitlines()[-1],"f")

    def test_sunday_requires_explicit_programming(self):
        sunday="(current_date+7+(7-extract(dow from current_date)::int)%7)"
        result=sql("begin;"+ADMIN+f"select public.assert_business_hours(({sunday}::text||'T09:00:00-03:00')::timestamptz,90);",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("domingos",result.stderr)
        result=self.run_transaction(self.prepare()+f"select public.assert_business_hours(({sunday}::text||'T09:00:00-03:00')::timestamptz,90);select true;")
        self.assertEqual(result.splitlines()[-1],"t")

    def test_legacy_confirmation_cannot_exceed_shared_daily_cap(self):
        result=sql("begin;"+ADMIN+self.prepare()+f"""
select public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
do $$declare inquiry uuid; a uuid; start timestamptz:=({DAY}::text||'T12:00:00-03:00')::timestamptz;begin
 inquiry:=public.submit_booking(jsonb_set({PAYLOAD},'{{whatsapp}}','"5492611234568"')||jsonb_build_object('requested_start',start));
 select id into a from public.appointments where inquiry_id=inquiry;
 update public.appointments set status='confirmado',confirmed_start=start where id=a;
end $$;
""",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("cupo diario",result.stderr)

    def test_z_concurrent_last_slot(self):
        # Only synthetic local data is committed to exercise transaction visibility.
        sql(self.prepare())
        barrier="""select pg_sleep(0.3);"""
        try:
            def attempt(phone):
                payload=f"jsonb_set({PAYLOAD},'{{whatsapp}}','\"{phone}\"')"
                return sql("begin;"+ADMIN+barrier+f"select public.submit_zone_booking({payload},{DAY},-32.9,-68.85,false);commit;",False)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                results=list(pool.map(attempt,["5492611234570","5492611234571"]))
            self.assertEqual(sum(r.returncode==0 for r in results),1)
            self.assertEqual(sql(f"select public.zone_day_used({DAY});").stdout.strip(),"1")
        finally:
            sql("delete from public.zone_booking_events;delete from public.zone_booking_requests;update public.zone_booking_settings set enabled=false;update public.operating_zones set active=false,polygon=null;")

    def test_editable_hours_and_pause_enforced_for_proposals(self):
        result=self.run_transaction(self.prepare()+f"""
update public.zone_booking_settings set day_start='08:00',day_end='20:00',pause_start='12:00',pause_end='13:00';
do $$declare r uuid;u uuid:=public.zone_primary_unit();begin
 perform public.zone_assert_window(({DAY}::text||'T19:00:00-03:00')::timestamptz,60,u);
 perform public.assert_business_hours(({DAY}::text||'T19:00:00-03:00')::timestamptz,60);
 begin perform public.zone_assert_window(({DAY}::text||'T11:30:00-03:00')::timestamptz,90,u);raise exception 'TEST: pause ignored';
 exception when sqlstate 'P0001' then if sqlerrm not like '%pausa configurada%' then raise;end if;end;
 perform public.zone_assert_window(({DAY}::text||'T13:00:00-03:00')::timestamptz,60,u);
end $$;select true;
""")
        self.assertEqual(result.splitlines()[-1],"t")

    def test_multiple_units_allow_parallel_work_but_not_unit_overlap(self):
        result=self.run_transaction(self.prepare()+f"""
update public.zone_weekly_schedule set capacity=10;
do $$declare a uuid;b uuid;u uuid;appt uuid;start timestamptz:=({DAY}::text||'T09:00:00-03:00')::timestamptz;begin
 insert into public.mobile_units(name) values('Segunda unidad') returning id into u;
 a:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 b:=public.submit_zone_booking(jsonb_set({PAYLOAD},'{{whatsapp}}','"5492611234568"'),{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(a,'propose',start,90,25000,null,public.zone_primary_unit());
 perform public.manage_zone_request(b,'propose',start,90,25000,null,u);
 perform public.manage_zone_request(a,'client_accepted');perform public.manage_zone_request(b,'client_accepted');
 select appointment_id into appt from public.zone_booking_requests where id=b;
 begin perform public.zone_assign_unit(appt,public.zone_primary_unit());raise exception 'TEST: conflicting reassignment';
 exception when sqlstate 'P0001' then if sqlerrm not like 'La unidad móvil ya tiene un turno%' then raise;end if;end;
 if (select mobile_unit_id from public.appointments where id=appt)<>u then raise exception 'TEST: invalid reassignment persisted';end if;
 update public.appointments set operator='Operario de prueba' where id=(select appointment_id from public.zone_booking_requests where id=a);
 begin update public.appointments set operator='Operario de prueba' where id=appt;raise exception 'TEST: operator double booked';
 exception when sqlstate 'P0001' then if sqlerrm not like 'El operario ya tiene un turno%' then raise;end if;end;
 begin perform public.zone_assert_window(start,90,u);raise exception 'TEST: unit overlap';
 exception when sqlstate 'P0001' then if sqlerrm not like 'La unidad móvil ya tiene un turno%' then raise;end if;end;
end $$;
select count(distinct mobile_unit_id) from public.appointments where status='confirmado';
""")
        self.assertEqual(result.splitlines()[-1],"2")

    def test_margin_and_travel_are_combined(self):
        result=self.run_transaction(self.prepare()+f"""
update public.zone_booking_settings set travel_minutes=20,buffer_minutes=15;
do $$declare r uuid;u uuid:=public.zone_primary_unit();start timestamptz:=({DAY}::text||'T09:00:00-03:00')::timestamptz;begin
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'propose',start,60,25000,null,u);perform public.manage_zone_request(r,'client_accepted');
 begin perform public.zone_assert_window(start+interval '90 minutes',60,u);raise exception 'TEST: margin ignored';
 exception when sqlstate 'P0001' then if sqlerrm not like 'La unidad móvil ya tiene un turno%' then raise;end if;end;
 perform public.zone_assert_window(start+interval '95 minutes',60,u);
end $$;select true;
""")
        self.assertEqual(result.splitlines()[-1],"t")

    def test_service_estimate_snapshot_and_minutes_limit(self):
        result=self.run_transaction(self.prepare()+f"""
update public.zone_weekly_schedule set capacity=30;
do $$declare s uuid;r uuid;begin
 insert into public.zone_service_types(name,minutes_per_vehicle) values('Servicio largo',480) returning id into s;
 r:=public.submit_zone_booking({PAYLOAD}||jsonb_build_object('service_type_id',s),{DAY},-32.9,-68.85,false);
 update public.zone_service_types set minutes_per_vehicle=300 where id=s;
 if (select planned_minutes from public.zone_booking_requests where id=r)<>480 then raise exception 'TEST: snapshot changed';end if;
 if public.zone_day_free_minutes({DAY})<>30 then raise exception 'TEST: missing minute budget';end if;
 begin perform public.submit_zone_booking(jsonb_set({PAYLOAD},'{{whatsapp}}','"5492611234568"'),{DAY},-32.9,-68.85,false);raise exception 'TEST: overbooked workday';
 exception when sqlstate 'P0001' then if sqlerrm not like 'La fecha se completó%' then raise;end if;end;
end $$;select true;
""")
        self.assertEqual(result.splitlines()[-1],"t")

    def test_cannot_deactivate_unit_with_pending_proposal(self):
        result=self.run_transaction(self.prepare()+f"""
do $$declare u uuid;r uuid;begin
 insert into public.mobile_units(name) values('Segunda unidad') returning id into u;
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'propose',({DAY}::text||'T09:00:00-03:00')::timestamptz,90,25000,null,u);
 begin perform public.configure_zone_booking('unit',jsonb_build_object('id',u,'name','Segunda unidad','active',false));raise exception 'TEST: unit disabled';
 exception when sqlstate 'P0001' then if sqlerrm not like '%propuestas pendientes%' then raise;end if;end;
 if not(select active from public.mobile_units where id=u) then raise exception 'TEST: unit modified';end if;
end $$;select true;
""")
        self.assertEqual(result.splitlines()[-1],"t")

    def test_configuration_cannot_invalidate_confirmed_work(self):
        result=self.run_transaction(self.prepare()+f"""
do $$declare r uuid;begin
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'propose',({DAY}::text||'T09:00:00-03:00')::timestamptz,90,25000,null);
 perform public.manage_zone_request(r,'client_accepted');
 begin perform public.configure_zone_booking('settings','{{"enabled":true,"horizon_days":42,"day_start":"10:00","day_end":"18:00"}}');raise exception 'TEST: invalidated confirmed';
 exception when sqlstate 'P0001' then if sqlerrm not like '%jornada configurada%' then raise;end if;end;
 if (select day_start from public.zone_booking_settings where id=1)<>time '09:00' then raise exception 'TEST: config not rolled back';end if;
end $$;select true;
""")
        self.assertEqual(result.splitlines()[-1],"t")

    def test_authenticated_admin_uses_unit_aware_legacy_conflict_rpc(self):
        result=self.run_transaction(self.prepare()+f"""
update public.zone_weekly_schedule set capacity=10;
do $$declare r uuid;u uuid;start timestamptz:=({DAY}::text||'T09:00:00-03:00')::timestamptz;begin
 insert into public.mobile_units(name)values('Otra unidad')returning id into u;
 r:=public.submit_zone_booking({PAYLOAD},{DAY},-32.9,-68.85,false);
 perform public.manage_zone_request(r,'propose',start,90,25000,null,u);perform public.manage_zone_request(r,'client_accepted');
end $$;
set local role authenticated;
select count(*) from public.appointment_slot_conflicts(({DAY}::text||'T09:00:00-03:00')::timestamptz,90,null,null);
select count(*) from public.mobile_units;
""")
        self.assertEqual(result.splitlines()[-2:],["0","2"])

    def test_anonymous_no_request_data_or_admin_rpc_access(self):
        for query in ["select payload from public.zone_booking_requests;", "select public.configure_zone_booking('settings','{}');", "select public.submit_zone_booking('{}',null,0,0,false);"]:
            result=sql("set role anon;"+query,False)
            self.assertNotEqual(result.returncode,0)
            self.assertIn("permission denied",result.stderr)

    def test_authenticated_non_admin_denied(self):
        result=sql("set role authenticated;select public.configure_zone_booking('settings','{}');",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("No autorizado",result.stderr)

    def test_week_copy_and_existing_overrides_preserved(self):
        result=self.run_transaction(f"select public.configure_zone_booking('copy',jsonb_build_object('target',{DAY}));select count(*) from public.zone_day_overrides;")
        self.assertEqual(result.splitlines()[-1],"7")
        result=sql("begin;"+ADMIN+f"select public.configure_zone_booking('copy',jsonb_build_object('target',{DAY}));select public.configure_zone_booking('copy',jsonb_build_object('target',{DAY}));",False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("no se sobrescribió",result.stderr)


if __name__ == "__main__":
    try:
        unittest.main(verbosity=2)
    finally:
        subprocess.run(["docker","rm","-f",CONTAINER],capture_output=True)
