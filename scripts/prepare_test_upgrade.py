"""Prepare a single transactional upgrade for the legacy test database.

Does not connect to any database. Does not seed or delete business data.
The named owner must already be a member of public.admins.
"""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def upgrade_sql(owner_email):
    email = owner_email.strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", email):
        raise ValueError("Correo de propietario inválido")
    pieces = ["""-- ACTUALIZACION DE MK-CARS-PRUEBAS. Revisar y respaldar antes de ejecutar.
-- NO ejecutar en la base del sitio habitual. No crea usuarios ni cambia contraseñas.
begin;
""", f"""do $$begin
  if not exists(select 1 from public.admins a join auth.users u on u.id=a.user_id
    where lower(u.email)='{email}') then
    raise exception 'El propietario indicado no es administrador existente de esta base. No se aplicó la actualización.';
  end if;
end $$;
"""]
    # The legacy catalogue/blocked dates/appointment_vehicles schema already exists
    # in this test database. Demo columns are prerequisites of later functions;
    # deliberately omit 009 (it schedules generation/deletion of sample data).
    for table in ["clients", "appointments", "services", "payments", "expenses"]:
        pieces.append(f"alter table public.{table} add column if not exists is_demo boolean not null default false;\n")
    names = ["005_admin_roles.sql"] + [
        next(ROOT.glob(f"{number:03}_*.sql")).name for number in range(11, 27)
    ]
    for name in names:
        source = (ROOT / name).read_text()
        # One outer transaction; embedded PL/pgSQL BEGIN/END stays untouched.
        source = re.sub(r"(?im)^\s*(?:begin|commit);\s*$", "", source)
        pieces.append(f"\n-- INICIO {name}\n{source}\n")
    pieces.append(f"""
do $$begin
  if exists(select 1 from public.admins where role='owner') and not exists(
    select 1 from public.admins a join auth.users u on u.id=a.user_id
    where lower(u.email)='{email}' and a.role='owner') then
    raise exception 'Ya existe otro propietario. Pedile que asigne los permisos desde el panel.';
  end if;
  update public.admins a set role='owner'
    from auth.users u where u.id=a.user_id and lower(u.email)='{email}';
end $$;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.appointment_notes,public.appointment_offers,
 public.appointment_offer_events,public.client_contacts,public.appointment_changes,
 public.appointment_photos,public.client_packages,public.coupons,public.cash_closings,
 public.recurring_expenses,public.admin_tasks,public.activity_log,public.admin_corrections to authenticated;
grant usage,select on all sequences in schema public to authenticated;
notify pgrst,'reload schema';
commit;
select 'Actualización completa. Cerrá sesión y volvé a ingresar al panel de pruebas.' as resultado;
""")
    return "".join(pieces)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(upgrade_sql(args.owner_email))
    print(f"Archivo preparado: {args.output}. No se ejecutó SQL.")
